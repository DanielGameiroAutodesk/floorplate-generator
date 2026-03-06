import type { Urn, FormaElement, RepresentationSelection } from "forma-elements"
import type { ElementSystem } from "src/core/element-systems"
import { NO_OVERRIDE } from "src/core/element-systems"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { conceptualElementsApi } from "src/integrations/conceptual-squad/conceptualElementsApi"
import { contextualDataApi } from "src/integrations/contextual-data/api"
import type { BuildingPieceMesh } from "src/lib/visualizationSettings"
import type { PartialBuildingPieceMesh } from "src/integrations/wsm-tools/wsr/api/usePrepareWSRSaveActions"
import type { FeatureCollection, Geometry } from "geojson"
import { mergeOkAndFlatMapAsync } from "src/core/elements-saving/result"
import { loadPersistedElementsAndChildren } from "src/core/elements-saving/loading"
import { saveElementsBatched } from "./integrate-element-saving"
import type { NotPersistedContainers, Result, SavingError } from "src/core/elements-saving/result"
import { getIntegrateAreaStatsSurfaces } from "src/integrations/conceptual-squad/area-stats-surfaces"
import type { CustomData } from "src/core/elements/custom-data"
import { createCustomData } from "src/core/elements/custom-data"
import { elementState } from "src/core/elements/ElementState"
import type { Selectable, SelectionMode } from "src/core/elements/element-container-derived-data/selectables"
import { generateEdgesGeometryNormalSensitive } from "./normal-sensitive-edges-geometry"
import { BufferAttribute, BufferGeometry, Color, EdgesGeometry } from "three"
import { generateColorArray } from "src/lib/three/geometryUtils"

export type PreparedLinkedRepresentation = {
  properties?: Record<string, unknown>
  selection?: RepresentationSelection
  /**
   * If this is strictly equal to another data method within the same save, it will only be invoked once and
   * reused. For example, if a bunch of floor elements share a glb, then create one getData method and use it
   * for every floor along with a selection for each floor.
   * */
  getData: () => Promise<BodyInit> | BodyInit
}
export type IntegratePreparedLinkedRepresentations = Record<string, PreparedLinkedRepresentation>

export const IntegrateCustomDataSymbol = Symbol("integrate_custom_data")
export type IntegrateCustomData = {
  preparedLinkedRepresentations: IntegratePreparedLinkedRepresentations
  representationsToDelete?: Set<string>
}
export function createIntegrateElementCustomData(customData: IntegrateCustomData): CustomData {
  return createCustomData({
    [IntegrateCustomDataSymbol]: customData,
  })
}
export function extractIntegrateElementContainerCustomData(
  elementContainer: ElementContainer,
): IntegrateCustomData | undefined {
  const integrateCustomData = elementContainer.customData?.[IntegrateCustomDataSymbol] as IntegrateCustomData

  return integrateCustomData
}

export class IntegrateElementSystem implements ElementSystem {
  async saveHandler(containersToSave: NotPersistedContainers[], authcontext: string) {
    const result: Result<Urn, SavingError>[] = []
    for await (const persistedUrnsBatch of saveElementsBatched(containersToSave, authcontext)) {
      result.push(...persistedUrnsBatch)
    }
    return mergeOkAndFlatMapAsync(result, (urns) => loadPersistedElementsAndChildren(new Set(urns)))
  }

  generateSelectables(
    container: ElementContainer,
  ): { selectionMode: SelectionMode; selectables: Selectable[] } | undefined {
    if (conceptualElementsApi.is3dSketchBuilding(container.element)) {
      return conceptualElementsApi.createSelectablesForBuilding(container)
    }
    // for 3DS generic elements we want to customize selectables so that we show edges
    // even if the element geoemetry is curved
    else if (
      !conceptualElementsApi.is3dSketchFloor(container.element) &&
      conceptualElementsApi.is3dSketchOwned(container.element) &&
      container.representations.volumeMesh
    ) {
      const volumeMesh = container.representations.volumeMesh
      const edgeGeo = new EdgesGeometry(volumeMesh)
      const selectable: Selectable = {
        target: { type: "element" },
        selectable3d: { hitbox: volumeMesh, outlines: edgeGeo.attributes.position.array as Float32Array },
      }
      return { selectionMode: "custom-selectables-only", selectables: [selectable] }
    }
    const terrainTextureRepresentation = container.representations.terrainTexture
    if (terrainTextureRepresentation) {
      const bbox = terrainTextureRepresentation.properties.boundingBox
      const geoJson: FeatureCollection<Geometry> = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: bbox,
            },
            properties: {},
          },
        ],
      }
      return {
        selectionMode: "custom-selectables-only",
        selectables: [{ target: { type: "element" }, selectable2d: { terrainShape: geoJson } }],
      }
    }
    return undefined
  }

  generateUnitMeshes(element: FormaElement): BuildingPieceMesh[] | typeof NO_OVERRIDE {
    if (
      conceptualElementsApi.is3dSketchFloor(element) &&
      element.properties?.partialBuildingPieceMeshes &&
      element.properties?.partialBuildingPieceMeshes.length > 0
    ) {
      const buildingPieceMeshes: BuildingPieceMesh[] = []
      element.properties.partialBuildingPieceMeshes.forEach((bpmAsArray: PartialBuildingPieceMesh) => {
        buildingPieceMeshes.push({
          info: bpmAsArray.info,
          geo: {
            position: new Float32Array(bpmAsArray.geoArray.positionArray),
            normal: bpmAsArray.geoArray.normalArray
              ? new Float32Array(bpmAsArray.geoArray.normalArray)
              : computeNormalsFromPosition(bpmAsArray.geoArray.positionArray),
          },
        })
      })

      return buildingPieceMeshes
    }

    return NO_OVERRIDE
  }

  generateEdgeOutlines(element: FormaElement) {
    const snapshot = elementState.currentSnapshot.peek()
    const container = snapshot.getElementContainer(element.urn)!

    if (container && contextualDataApi.isLoD2Building(element)) {
      return contextualDataApi.generateOutlines(container)
    }
    // we want smooth outlines for any integrate element that is 3DS-owned and
    // we need both because floors don't pass the is3dsOwned test
    else if (conceptualElementsApi.is3dSketchFloor(element) || conceptualElementsApi.is3dSketchOwned(element)) {
      const volumeMesh = container.representations.volumeMesh!
      const smoothEdgeGeo = generateEdgesGeometryNormalSensitive(volumeMesh)
      return smoothEdgeGeo.attributes.position.array as Float32Array
    }
  }

  generateAreaStatsSurfaces(elementContainer: ElementContainer) {
    return getIntegrateAreaStatsSurfaces(elementContainer)
  }

  generateVolumeMeshRenderables3d: ElementSystem["generateVolumeMeshRenderables3d"] = (container) => {
    const element = container.element
    const is3dSketch = conceptualElementsApi.is3dSketchOwned(element) || conceptualElementsApi.is3dSketchFloor(element)
    if (is3dSketch && element.properties?.category !== "constraints") {
      const geometry = container.representations.volumeMesh

      if (geometry) {
        const newGeom = new BufferGeometry()
        newGeom.setAttribute("position", geometry?.getAttribute("position").clone())

        if (geometry.hasAttribute("normal")) {
          newGeom.setAttribute("normal", geometry?.getAttribute("normal").clone())
        }

        if (geometry.hasAttribute("color")) {
          if (element.properties?.color) {
            const color = new Color(element.properties?.color)
            const colorArray = generateColorArray(color, geometry.getAttribute("position").array.length / 3)
            newGeom.setAttribute("color", new BufferAttribute(colorArray, 3, true))
          } else {
            newGeom.setAttribute("color", new BufferAttribute(geometry.getAttribute("color").array, 3, true))
          }
        }

        // Generate an index if we don't have one already. At other stages in the pipeline, indexed
        // geometry gets converted to non indexed, then reconverted back to indexed, so we can't
        // always be sure an index is attached to our geometry. However, our renderSpec (see renderable.ts)
        // has shouldHaveIndex as true so we just generate a sequential index if one doesn't
        // already exist.
        if (!geometry.index || geometry.index.array.length == 0) {
          newGeom.setIndex([...new Array(geometry.getAttribute("position").array.length / 3).keys()])
        } else {
          newGeom.setIndex(geometry.index)
        }

        newGeom.computeBoundingBox()
        newGeom.computeBoundingSphere()

        return [{ type: "3d", renderingSpec: "i3ds", geometry: newGeom }]
      }
    }
    return undefined
  }
}

// Helper function that computes a float 32 array from an array of positions.
function computeNormalsFromPosition(positionArray: number[]) {
  const normal = new Float32Array(positionArray.length)

  for (let i = 0; i + 8 < positionArray.length; i += 9) {
    // Make vectors for 2 sides of the triangle
    const x1 = positionArray[i + 3] - positionArray[i]
    const y1 = positionArray[i + 4] - positionArray[i + 1]
    const z1 = positionArray[i + 5] - positionArray[i + 2]
    const x2 = positionArray[i + 6] - positionArray[i]
    const y2 = positionArray[i + 7] - positionArray[i + 1]
    const z2 = positionArray[i + 8] - positionArray[i + 2]

    let nx = y1 * z2 - z1 * y2,
      ny = z1 * x2 - x1 * z2,
      nz = x1 * y2 - y1 * x2
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    nx *= 1 / length
    ny *= 1 / length
    nz *= 1 / length

    normal[i] = nx
    normal[i + 1] = ny
    normal[i + 2] = nz
    normal[i + 3] = nx
    normal[i + 4] = ny
    normal[i + 5] = nz
    normal[i + 6] = nx
    normal[i + 7] = ny
    normal[i + 8] = nz
  }

  return normal
}
