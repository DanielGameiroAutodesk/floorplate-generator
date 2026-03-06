import { computed } from "@preact/signals"
import { explicitSignal } from "src/lib/signal"
import type { VolumeMesh } from "src/core/volume-mesh"
import { type BufferGeometry, Matrix4, Mesh } from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { PROJECT_ID } from "src/core/project/project"
import type { Urn } from "forma-elements"
import { scenarioRenderablesSignal, scenarioStateSignal } from "./scenario"
import { mergeScenarioGeometries } from "./internal/mergeScenarioGeometries"
import type { Child, FormaElement } from "@spacemakerai/element-types"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { createCustomData } from "src/core/elements/custom-data"
import { captureException } from "@sentry/browser"

type DerivedChildInfo = { key: string; modelRepId: string; geometry: BufferGeometry }

type ScenarioDerivedPayload = {
  scenarioKey: string
  volumeMesh: VolumeMesh
  childInfos: DerivedChildInfo[]
  childNodes: ChildNodeContainer[]
}

type ScenarioUploadState = {
  scenarioKey: string
  uploadPromise?: Promise<Urn | undefined>
  parentUrn?: Urn
}

const [scenarioUploadStateSignal, setScenarioUploadStateSignalValue] = explicitSignal<ScenarioUploadState | undefined>(
  undefined,
)

const scenarioDerivedPayloadSignal = computed<ScenarioDerivedPayload | undefined>(() =>
  deriveScenarioPayload(scenarioStateSignal.value, scenarioRenderablesSignal.value),
)

const scenarioActiveUploadStateSignal = computed<ScenarioUploadState | undefined>(() => {
  const payload = scenarioDerivedPayloadSignal.value
  const uploadState = scenarioUploadStateSignal.value
  if (!payload || !uploadState || uploadState.scenarioKey !== payload.scenarioKey) return undefined
  return uploadState
})

export const scenarioVolumeMeshSignal = computed(() => {
  const payload = scenarioDerivedPayloadSignal.value
  if (!payload) return undefined
  return { scenarioKey: payload.scenarioKey, volumeMesh: payload.volumeMesh }
})

export const scenarioElementUploadSignal = computed<Promise<Urn | undefined>>(() => {
  const uploadState = scenarioActiveUploadStateSignal.value
  if (uploadState?.uploadPromise) return uploadState.uploadPromise
  if (uploadState?.parentUrn) return Promise.resolve(uploadState.parentUrn)
  return Promise.resolve(undefined)
})

export const scenarioChildNodesSignal = computed(() => scenarioDerivedPayloadSignal.value?.childNodes)

const IDENTITY = new Matrix4()

export const SCENARIO_BUNDLE_CHILD_CUSTOM_DATA_KEY = Symbol("ScenarioBundleChild")
export const SCENARIO_MODEL_REP_ID_CUSTOM_DATA_KEY = Symbol("ScenarioModelId")

function deriveScenarioPayload(
  scenarioState: (typeof scenarioStateSignal)["value"],
  scenarioRenderables: (typeof scenarioRenderablesSignal)["value"],
): ScenarioDerivedPayload | undefined {
  const scenario = scenarioState?.scenario.scenario
  const renderables = scenarioRenderables ?? []
  const mergedGeometry = mergeScenarioGeometries(renderables)

  if (!scenario || renderables.length === 0 || !mergedGeometry) return undefined

  const childInfos = deriveChildInfos(renderables)
  const scenarioKey = `${scenario.id}::${scenario.revision}`
  const volumeMesh: VolumeMesh = {
    position: mergedGeometry.attributes.position.array as Float32Array,
    index: mergedGeometry.index?.array as Uint8Array | Uint16Array | Uint32Array | undefined,
  }
  const childNodes = childInfos.map(buildChildNodeFromInfo)

  return { scenarioKey, volumeMesh, childInfos, childNodes }
}

function buildChildNodeFromInfo(info: DerivedChildInfo): ChildNodeContainer {
  const { key, modelRepId, geometry } = info
  const mockUrn = `urn:adsk-forma-elements:basic:${PROJECT_ID}:scenario-${key}:0` as Urn
  const element: FormaElement = { urn: mockUrn, children: [], properties: {} }
  const child: Child = { urn: mockUrn, key }

  const customData = createCustomData({
    [SCENARIO_BUNDLE_CHILD_CUSTOM_DATA_KEY]: true,
    [SCENARIO_MODEL_REP_ID_CUSTOM_DATA_KEY]: modelRepId,
  })

  const elementContainer = ElementContainer.fromDraftElement(
    element,
    [],
    {
      volumeMesh: geometry,
      footprint: undefined,
      terrainShape: undefined,
      terrainTexture: undefined,
      buildingFloors3DSketch_UNSTABLE: undefined,
    },
    customData,
  )
  return new ChildNodeContainer(`root/${key}`, child, elementContainer, IDENTITY, "proposal")
}

function shortHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

function deriveChildInfos(renderables: BufferGeometry[]): DerivedChildInfo[] {
  return renderables.map((geometry, index) => {
    const modelRepId = (geometry.userData?.modelRepId as string | undefined) ?? ""
    const key = modelRepId ? `scenario-${index}-${shortHash(modelRepId)}` : `scenario-${index}`
    return { key, modelRepId, geometry }
  })
}

export function triggerScenarioElementUpload(): Promise<Urn | undefined> {
  const payload = scenarioDerivedPayloadSignal.peek()
  if (!payload) return Promise.resolve(undefined)

  const currentUpload = scenarioActiveUploadStateSignal.peek()
  if (currentUpload?.uploadPromise) return currentUpload.uploadPromise
  if (currentUpload?.parentUrn) return Promise.resolve(currentUpload.parentUrn)

  const { scenarioKey, childInfos } = payload

  const uploadPromise = uploadAllViewableElements(childInfos)
    .then((parentUrn) => {
      const payloadNow = scenarioDerivedPayloadSignal.peek()
      if (!payloadNow || payloadNow.scenarioKey !== scenarioKey) return undefined
      setScenarioUploadStateSignalValue(parentUrn ? { scenarioKey, parentUrn } : { scenarioKey })
      return parentUrn
    })
    .catch((e) => {
      const payloadNow = scenarioDerivedPayloadSignal.peek()
      if (!payloadNow || payloadNow.scenarioKey !== scenarioKey) return undefined
      captureException(new Error("Failed to upload scenario elements", { cause: e }))
      setScenarioUploadStateSignalValue({ scenarioKey })
      return undefined
    })

  setScenarioUploadStateSignalValue({ scenarioKey, uploadPromise })
  return uploadPromise
}

function geometryToGlb(geo: BufferGeometry): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const exportMesh = new Mesh(geo)
    exportMesh.applyMatrix4(new Matrix4().makeRotationX(-Math.PI / 2))
    new GLTFExporter().parse(exportMesh, (res) => resolve(res as ArrayBuffer), reject, { binary: true })
  })
}

// TODO: Use IntegrateElementSystem functionality here (for batching, error handling, etc.)
async function uploadGlbAndCreateElement(geo: BufferGeometry): Promise<Urn> {
  const uploadLinkResponse = await fetch(`/api/integrate/upload-link?authcontext=${PROJECT_ID}`)
  if (!uploadLinkResponse.ok) {
    throw new Error(`Failed to get upload link: ${uploadLinkResponse.status} ${uploadLinkResponse.statusText}`)
  }
  const { blobId, url } = await uploadLinkResponse.json()

  const glb = await geometryToGlb(geo)

  const uploadResponse = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "model/gltf-binary" },
    body: glb,
  })
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload GLB: ${uploadResponse.status} ${uploadResponse.statusText}`)
  }

  const createElementResponse = await fetch(`/api/integrate/v2/elements?authcontext=${PROJECT_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { scenariosElement: "true" },
      representations: {
        volumeMesh: { type: "linked" as const, blobId },
      },
    }),
  })
  if (!createElementResponse.ok) {
    throw new Error(`Failed to create element: ${createElementResponse.status} ${createElementResponse.statusText}`)
  }
  const { urn } = await createElementResponse.json()

  return urn
}

async function uploadAllViewableElements(childInfos: DerivedChildInfo[]): Promise<Urn | undefined> {
  if (childInfos.length === 0) return undefined

  const childUrns = await Promise.all(
    childInfos.map(async ({ geometry, key, modelRepId }) => {
      const urn = await uploadGlbAndCreateElement(geometry)
      if (!modelRepId) {
        console.warn("Missing modelRepId in geometry userData")
      }
      return { urn, key, modelRepId }
    }),
  )

  if (childUrns.length === 0) return undefined

  const createParentResponse = await fetch(`/api/integrate/v2/elements?authcontext=${PROJECT_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      children: childUrns.map(({ urn, key }) => ({ urn, key })),
      properties: {
        scenariosElement: "true",
        scenariosElementBundle: "true",
      },
    }),
  })
  if (!createParentResponse.ok) {
    throw new Error(
      `Failed to create parent element: ${createParentResponse.status} ${createParentResponse.statusText}`,
    )
  }
  const { urn: parentUrn } = await createParentResponse.json()

  return parentUrn
}
