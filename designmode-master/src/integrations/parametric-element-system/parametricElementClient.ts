import type {
  NotPersistedContainers,
  Result,
  SavingError,
  SavingResult,
  SavingSuccess,
} from "src/core/elements-saving/result"
import { genericSaveError, isErr, ok } from "src/core/elements-saving/result"
import type { Child, FormaElement, Properties, Urn, Volume25DCollection } from "@spacemakerai/element-types"
import type { FetchError } from "src/lib/request"
import { requestApiGateway } from "src/lib/request"
import type { BufferGeometry } from "three"
import { parseUrn } from "src/lib/element/urn"
import { Document, NodeIO, VertexLayout } from "@gltf-transform/core"
import { buildNodeVertexColors, zUpToYUp } from "./gltf"
import { captureException } from "@sentry/browser"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import type { ParcelCompositionElement } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { isCompositionElement } from "src/integrations/composition-site-graph/graph-element/types"
import { rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import { generateSemanticMesh } from "src/integrations/composition-row-house-generator/semanticMesh"
import type { GFAUnit } from "src/lib/element/types"
import { validateIsElementResponse } from "src/lib/elementFormatUtils"
import { elementResponseToMap, getRepresentationJsonUnsafe } from "@spacemakerai/elements-client"
import { LDFlag, isFlagActive } from "src/lib/featureToggling"

function captureParametricSystemsFetchError(error: FetchError) {
  const level = error.responseCode === 401 || error.responseCode === 403 || !error.responseCode ? "warning" : "error"
  captureException(error, {
    level,
    tags: {
      responseCode: error.responseCode,
      ...(error.requestId ? { requestId: error.requestId } : {}),
    },
  })
}

/**
 * This type represents the parametric elements as they are consumed in Design Mode.
 * Our internal representation is put in `properties.generator`.
 * Most representations are put in Design Mode's state (ex. volumeMesh can be accessed through elementStateAPI).
 *
 * The reason that the volume25DCollection_INTERNAL is put on the element is so we can access it to save it later when
 * mapping over to {@link ParametricElement}. It is only meant to be used by us.
 */
export type ParametricElementFormaElement = {
  properties: ParametricElementProperties & Required<Pick<Properties, "areaStatsReps">>
  volume25DCollection_INTERNAL?: Volume25DCollection
  gfaUnits_INTERNAL?: GFAUnit[]
} & FormaElement

export type ParametricElementProperties = {
  generator: {
    generatorId: string
    parameters: Record<string, any>
  }
  category: string
}

/**
 * This is the version of a parametric element we would like to actually send to the PUT endpoint in the backend.
 * The reason this looks different than a FormaElement is because:
 * 1. FormaElements' representations can be links that needs to be created on the backend - but here we send them as data.
 *    (example: volume25DCollection)
 * 2. Our internal domain understanding of parametric elements is different than FormaElements, making us want to put
 *    parameters in other places (such as in the generator). Creating a completely separate type makes that clearer.
 *
 * To see how this data actually looks, see the `ParametricElement` type defined in the backend:
 * https://github.com/spacemakerai/parametric-element-api
 */
export type ParametricElement = {
  id: string
  volume25DCollection?: Volume25DCollection
  gfaUnits?: GFAUnit[]
  properties: ParametricElementProperties
  children?: Child[]
  metadata?: Record<string, any>
}
export type ParametricElements = {
  [key: string]: ParametricElement
}

async function generateGlb(bufferGeometry: BufferGeometry, elementId: string) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene()
  const positions = new Float32Array(bufferGeometry.attributes.position.array)
  const colors = new Float32Array(bufferGeometry.attributes.color.array)
  colors.forEach((value, index, array) => {
    array[index] = value / 255
  })

  const node = buildNodeVertexColors(doc, buffer, elementId, positions, colors)
  scene.addChild(node)
  return await new NodeIO().setVertexLayout(VertexLayout.SEPARATE).writeBinary(doc)
}

export function transformParametricElement(element: FormaElement): FormaElement {
  if (lineBuildingApi.isLineBuildingFormaElement(element)) {
    const parameters = element.properties?.generator.parameters
    const { element: _element } = lineBuildingApi.run(parameters)
    return {
      ...element,
      properties: {
        ...element.properties,
        areaStatsReps: { ...(element.properties?.areaStatsReps ?? {}), ..._element.properties.areaStatsReps },
      },
    }
  }
  //TODO: Move this monkey-patch to backend
  if (isCompositionElement(element)) {
    return {
      ...element,
      properties: {
        ...element.properties,
        capabilities: {
          ...element.properties?.capabilities,
          updateTransform: {
            script: {
              url: "/api/parametric/capabilities",
              function: "move",
            },
          },
        },
      },
    }
  }
  return element
}

export namespace parametricElementClient {
  export const SYSTEM_NAME = "parametric"

  export function saveParametricElementWithoutGeo(
    element: ParametricElementFormaElement | ParcelCompositionElement,
    authContext: string,
  ): Promise<SavingResult> {
    const { revision, id } = parseUrn(element.urn)
    const volume25DCollection =
      "volume25DCollection_INTERNAL" in element ? element.volume25DCollection_INTERNAL : undefined
    const gfaUnits = "gfaUnits_INTERNAL" in element ? element.gfaUnits_INTERNAL : undefined
    const parametricElement: ParametricElement = {
      id: id,
      ...(volume25DCollection ? { volume25DCollection: volume25DCollection } : {}),
      ...(gfaUnits ? { gfaUnits: gfaUnits } : {}),
      properties: {
        ...element.properties,
      },
      children: element.children,
      ...(element.metadata ? { metadata: element.metadata } : {}),
    }
    const parametricElements: ParametricElements = { [id]: parametricElement }

    return putJson(id, authContext, revision, parametricElements)
  }

  export function saveParametricElement(
    element: ParametricElementFormaElement,
    _bufferGeometry: BufferGeometry,
    authContext: string,
  ) {
    const bufferGeometry = _bufferGeometry.clone().applyMatrix4(zUpToYUp)
    const { revision, id } = parseUrn(element.urn)
    const request = generateGlb(bufferGeometry, id).then((glb) => putGlb(id, authContext, revision, glb))

    const parametricElement: ParametricElement = {
      id: id,
      volume25DCollection: element.volume25DCollection_INTERNAL,
      // Some code paths, such as template renaming, will not have the expected data
      // modal that includes element.gfaUnits_INTERNAL. Instead we get the original
      // FormaElement that was returned from the API with some modifications.
      // This is a workaround trying to deal with that. Ideally we should fix the inconsistencies
      // in the code paths.
      gfaUnits:
        element.gfaUnits_INTERNAL ??
        (element.representations?.gfaUnits ? getRepresentationJsonUnsafe(element.representations.gfaUnits) : undefined),
      properties: {
        ...element.properties,
      },
      children: element.children,
      ...(element.metadata ? { metadata: element.metadata } : {}),
    }
    const parametricElements: ParametricElements = { [id]: parametricElement }
    const jsonRequest = putJson(id, authContext, revision, parametricElements)
    return { jsonRequest, glbRequest: request }
  }

  const saveSingle = async (
    element: ParametricElementFormaElement,
    geometry: BufferGeometry | undefined,
    authcontext: string,
  ): Promise<SavingResult> => {
    if (lineBuildingApi.isLineBuildingFormaElement(element) && isFlagActive(LDFlag.LineBuildingsMeshBackend)) {
      return await saveParametricElementWithoutGeo(element, authcontext)
    }

    let elementSaving: Promise<SavingResult>
    let dependencies: Promise<Result<unknown, SavingError>>[] = []

    // Note that the following saving logic persists the element itself
    // in paralllel with the dependencies (representations) of the element.
    // If a dependency fails to save, the element will have a reference
    // to non-existing data. Below we ensure those elements are never returned.

    if (geometry) {
      const { jsonRequest, glbRequest } = saveParametricElement(element, geometry, authcontext)
      elementSaving = jsonRequest
      dependencies.push(glbRequest)

      if (rowHouseApi.isRowHouseElement(element)) {
        dependencies.push(
          generateSemanticMesh(element.properties.generator.parameters).then((glb) => {
            const { id, revision } = parseUrn(element.urn)
            return putSemanticMeshGlb(id, authcontext, revision, glb)
          }),
        )
      }

      if (lineBuildingApi.isLineBuildingFormaElement(element)) {
        dependencies.push(
          lineBuildingApi.createSemanticMeshGlb(element).then((glb) => {
            const { id, revision } = parseUrn(element.urn)
            return putSemanticMeshGlb(id, authcontext, revision, glb)
          }),
        )
      }
    } else {
      elementSaving = saveParametricElementWithoutGeo(element, authcontext)
    }

    const firstDependencyError = (await Promise.all(dependencies)).find(isErr)
    if (firstDependencyError) {
      return firstDependencyError
    }

    return await elementSaving
  }

  export const save = (
    notPersistedContainers: NotPersistedContainers[],
    getVolumeMeshByUrn: (urn: Urn) => BufferGeometry | undefined,
    authContext: string,
  ): Promise<SavingResult[]> => {
    return saveLowLevel(
      notPersistedContainers.map(({ urn, container }) => {
        const element = container.element as ParametricElementFormaElement
        const volumeMesh = getVolumeMeshByUrn(urn)
        return { element, volumeMesh }
      }),
      authContext,
    )
  }

  export const saveLowLevel = (
    toBeSaved: {
      element: ParametricElementFormaElement
      volumeMesh: BufferGeometry | undefined
    }[],
    authContext: string,
  ): Promise<SavingResult[]> => {
    return Promise.all(
      toBeSaved.map(({ element, volumeMesh }) => {
        return saveSingle(element, volumeMesh, authContext)
      }),
    )
  }

  export const putJson = async (
    elementId: string,
    authContext: string,
    revision: string,
    parametricElements: ParametricElements,
  ): Promise<SavingResult> => {
    const url = `/api/${SYSTEM_NAME}/elements/${elementId}/revisions/${revision}?authcontext=${authContext}&newRepresentations`
    return requestApiGateway(url, {
      method: "PUT",
      body: JSON.stringify(parametricElements),
    })
      .then((res) => res.json())
      .then(validateIsElementResponse)
      .then(elementResponseToMap)
      .then((res) =>
        ok<SavingSuccess>({
          updatedElementsFromSystem: res,
        }),
      )
      .catch((error) => {
        captureParametricSystemsFetchError(error)
        return genericSaveError(error)
      })
  }

  export const putGlb = async (
    elementId: string,
    authContext: string,
    revision: string,
    glb: ArrayBuffer,
  ): Promise<Result<Response, SavingError>> => {
    const url = `/api/${SYSTEM_NAME}/elements/${elementId}/revisions/${revision}/glb?authcontext=${authContext}`
    return requestApiGateway(url, { method: "PUT", body: glb, headers: { "content-type": "application/octet-stream" } })
      .then((r) => ok(r))
      .catch((error: FetchError) => {
        captureParametricSystemsFetchError(error)
        return genericSaveError(error, { isReported: true })
      })
  }

  export const putSemanticMeshGlb = async (
    elementId: string,
    authContext: string,
    revision: string,
    glb: ArrayBuffer,
  ): Promise<Result<Response, SavingError>> => {
    const url = `/api/${SYSTEM_NAME}/elements/${elementId}/revisions/${revision}/semanticmesh?authcontext=${authContext}`
    return requestApiGateway(url, { method: "PUT", body: glb, headers: { "content-type": "application/octet-stream" } })
      .then((r) => ok(r))
      .catch((error: FetchError) => {
        captureParametricSystemsFetchError(error)
        return genericSaveError(error, { isReported: true })
      })
  }
}
