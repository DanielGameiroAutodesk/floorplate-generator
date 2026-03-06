import { elementState } from "src/core/elements/ElementState"
import type { InternalPath } from "src/lib/element/path"
import type { Coord2D } from "src/lib/geometry/geometryTypes"
import type { Matrix4, TypedArray } from "three"
import { Box2, Vector3 } from "three"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { RepresentationType } from "src/core/elements/ElementRepresentations"
import type { BufferAttribute } from "three/src/Three.js"
import type { Polygon } from "geojson"
import { geometry } from "@turf/helpers"
import { captureMessage } from "@sentry/browser"
import { deprecatedComputed } from "src/lib/computed-deprecated"
import { computed } from "@preact/signals"
import { isLineSegmentPartiallyInsidePolygon } from "src/integrations/building-systems-site-study/generator/sketchStuff/sharedDivisionLinesV2/geometry"
import { terrainSignal, type NewTerrainState } from "src/core/terrain/new-terrain-state"
import { SCENARIO_BUNDLE_CHILD_CUSTOM_DATA_KEY } from "src/integrations/Scenarios/scenarioElementUploadState"

export interface AnalysisSelectionAPI {
  /**
   * Get all top level elements that have at least one vertex or coordinate inside at least one
   * of the provided polygons. If an element has a footprint, the footprint will be used to check
   * otherwise the volume mesh will be checked
   * In this context top level elements are elements that are direct children of the root element
   * or children of the proposal base
   * If scenarioChildNodes are provided, they will be added to the candidates
   */
  getTopLevelElementsInsidePolygons: (
    polygons: Coord2D[][],
    options?: {
      includeSubtree?: (path: string) => boolean
      scenarioChildNodes?: ChildNodeContainer[]
    },
  ) => InternalPath[]
  /**
   * Get all top level elements that have at least one vertex or coordinate inside at least one
   * of the provided footprint paths.
   */
  getTopLevelElementsInsideFootprints: (
    paths: InternalPath[],
    options?: {
      includeSubtree?: (path: string) => boolean
      scenarioChildNodes?: ChildNodeContainer[]
    },
  ) => InternalPath[]
}

const reusableVector3 = new Vector3()
const reusablePolygonBoundingBox2 = new Box2()
const reusableMeshBoundingBox2 = new Box2()

const getElementsWithinFootprintCache = (() => {
  let currentKey: string
  const currentCache: Map<InternalPath, boolean> = new Map()
  return (key: string) => {
    if (currentKey !== key) {
      currentCache.clear()
      currentKey = key
    }
    return currentCache
  }
})()

function transformCoordinates(coordinates: number[][], transform: Matrix4): Coord2D[] {
  return coordinates.map((coord) => {
    reusableVector3.set(coord[0], coord[1], 0)
    reusableVector3.applyMatrix4(transform)
    return [reusableVector3.x, reusableVector3.y]
  })
}

function computePolygonBBox2(coordinates: number[][], boundingBox: Box2) {
  let minY = Infinity
  let minX = Infinity
  let maxY = -Infinity
  let maxX = -Infinity
  for (const [x, y] of coordinates) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  boundingBox.min.x = minX
  boundingBox.min.y = minY
  boundingBox.max.x = maxX
  boundingBox.max.y = maxY

  return boundingBox
}

function isInsideVolumeMesh(polygon: Polygon, position: TypedArray) {
  for (let v = 0; v < position.length; v += 3) {
    if (booleanPointInPolygon([position[v], position[v + 1]], polygon)) {
      return true
    }
  }
  return false
}

function isInsideFootprint(polygon: Polygon, footprintCoords: Coord2D[]) {
  for (let coord of footprintCoords) {
    if (booleanPointInPolygon(coord, polygon)) {
      return true
    }
  }
  return isLineSegmentPartiallyInsidePolygon(footprintCoords, polygon.coordinates[0])
}

type PolygonWithBoundingBox = { polygon: Polygon; boundingBox?: Box2 }

const transformedVolumeMeshCache: WeakMap<ChildNodeContainer, BufferAttribute> = new WeakMap()

function createIsChildInsidePolygonChecker(terrain: NewTerrainState, child: ChildNodeContainer) {
  const bbox = child.bbox(terrain.terrainSamplerData).getOrCompute()
  if (!bbox) {
    return () => false
  }

  if (child.elementContainer.representations.footprint) {
    let footprint: RepresentationType<"footprint"> | undefined = undefined
    return (polygonWithBbox: PolygonWithBoundingBox) => {
      reusablePolygonBoundingBox2.min.x = bbox.min.x
      reusablePolygonBoundingBox2.min.y = bbox.min.y
      reusablePolygonBoundingBox2.max.x = bbox.max.x
      reusablePolygonBoundingBox2.max.y = bbox.max.y
      if (!reusablePolygonBoundingBox2.intersectsBox(polygonWithBbox.boundingBox!)) {
        return false
      }
      if (!footprint) {
        footprint = child.elementContainer.getRepresentationOrThrow("footprint")
      }
      let checkCoords: Coord2D[] = []
      if (footprint.geometry.type === "Polygon") {
        checkCoords = transformCoordinates(footprint.geometry.coordinates[0], child.globalMatrix)
      }
      if (footprint.geometry.type === "LineString") {
        checkCoords = transformCoordinates(footprint.geometry.coordinates, child.globalMatrix)
      }
      if (checkCoords.length > 0) {
        return isInsideFootprint(polygonWithBbox.polygon, checkCoords)
      }
      return false
    }
  }
  if (child.elementContainer.representations.volumeMesh) {
    let transformedMesh = transformedVolumeMeshCache.get(child)
    return (polygonWithBbox: PolygonWithBoundingBox) => {
      reusableMeshBoundingBox2.min.x = bbox.min.x
      reusableMeshBoundingBox2.min.y = bbox.min.y
      reusableMeshBoundingBox2.max.x = bbox.max.x
      reusableMeshBoundingBox2.max.y = bbox.max.y
      if (!polygonWithBbox.boundingBox!.intersectsBox(reusableMeshBoundingBox2)) {
        return false
      }
      if (!transformedMesh) {
        const volumeMesh = child.elementContainer.getRepresentationOrThrow("volumeMesh")
        const clone = volumeMesh.clone().getAttribute("position") as BufferAttribute
        clone.applyMatrix4(child.globalMatrix)
        transformedVolumeMeshCache.set(child, clone)
        transformedMesh = clone
      }
      return isInsideVolumeMesh(polygonWithBbox.polygon, transformedMesh.array)
    }
  }
  return () => false
}

const getTopLevelElementsInsidePolygonsSignal = deprecatedComputed(() => {
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value
  return (
    polygons: Coord2D[][],
    options?: {
      cache?: ReturnType<typeof getElementsWithinFootprintCache>
      /**
       * if the path is ignored, the element and all its children will be ignored
       * can be used if there are parts of the tree that are not of interest
       */
      includeSubtree?: (path: string) => boolean
      scenarioChildNodes?: ChildNodeContainer[]
    },
  ): InternalPath[] => {
    const polyogonsWithMemoizedBBox: PolygonWithBoundingBox[] = []
    polygons.forEach((p) => {
      try {
        /**
         * This should probably not be checked here, as we should validate that footprints are
         * valid. But if this fails, designmode crashes, so for now we'll keep it like this
         * and if we get better validation upstream, we can stop doing this check.
         */
        const polygon = geometry("Polygon", [p]) as Polygon
        polyogonsWithMemoizedBBox.push({ polygon })
      } catch {
        console.warn("ignoring polygon with invalid coordinates")
        captureMessage("ignoring polygon with invalid coordinates", { level: "warning" })
      }
    })
    function isChildInside(childNode: ChildNodeContainer) {
      const childrenToCheck = [childNode, ...proposal.snapshot.getDescendantsOfNode(childNode)]
      for (const child of childrenToCheck) {
        const isChildInsidePolygon = createIsChildInsidePolygonChecker(terrain, child)
        for (let polygon of polyogonsWithMemoizedBBox) {
          if (!polygon.boundingBox) {
            polygon.boundingBox = computePolygonBBox2(polygon.polygon.coordinates[0], new Box2())
          }
          if (isChildInsidePolygon(polygon)) {
            return true
          }
        }
      }
      return false
    }

    function isStandaloneChildInside(childNode: ChildNodeContainer) {
      const isChildInsidePolygon = createIsChildInsidePolygonChecker(terrain, childNode)
      for (let polygon of polyogonsWithMemoizedBBox) {
        if (!polygon.boundingBox) {
          polygon.boundingBox = computePolygonBBox2(polygon.polygon.coordinates[0], new Box2())
        }
        if (isChildInsidePolygon(polygon)) {
          return true
        }
      }
      return false
    }
    const candidates = options?.scenarioChildNodes
      ? proposal.getToplevelNodes().concat(options.scenarioChildNodes)
      : proposal.getToplevelNodes()

    return candidates
      .filter((childNode) => {
        if (options?.includeSubtree && !options.includeSubtree(childNode.path)) {
          return false
        }
        if (childNode.elementContainer.element.urn.startsWith("urn:adsk-forma-elements:terrain")) {
          return false
        }

        const elementTransform = childNode.globalMatrix.toArray()
        const urn = childNode.elementContainer.element.urn
        const cacheKey = `${urn}:${elementTransform.toString()}`
        const cacheResult = options?.cache?.get(cacheKey)
        if (typeof cacheResult === "boolean") {
          return cacheResult
        }

        const isScenarioBundleChild =
          childNode.elementContainer.customData?.[SCENARIO_BUNDLE_CHILD_CUSTOM_DATA_KEY] === true
        const result = isScenarioBundleChild ? isStandaloneChildInside(childNode) : isChildInside(childNode)

        options?.cache?.set(cacheKey, result)
        return result
      })
      .map((child) => child.path)
  }
})

const getTopLevelElementsInsideFootprintsSignal = deprecatedComputed(() => {
  const currentSnapshot = elementState.currentSnapshot.value
  const getTopLevelElementsInsidePolygons = getTopLevelElementsInsidePolygonsSignal.value

  return (
    footprintPaths: InternalPath[],
    options?: {
      /**
       * ignore traversing part of a tree based on the path
       * can be used if there are parts of the tree that are not of interest
       */
      includeSubtree?: (path: string) => boolean
      scenarioChildNodes?: ChildNodeContainer[]
    },
  ) => {
    const footprintsCacheKey = footprintPaths
      .sort()
      .map((path) => {
        const childNode = currentSnapshot.getNode(path)
        if (!childNode) throw new Error(`${path} does not exist`)
        const urn = childNode.elementContainer.element.urn
        const worldTransform = childNode.globalMatrix
        return `${urn}:${worldTransform.toArray().toString()}`
      })
      .join("-")
    const cache = getElementsWithinFootprintCache(footprintsCacheKey)

    const validTransformedPolygons: Coord2D[][] = []
    for (let path of footprintPaths) {
      const node = elementState.currentSnapshot.peek().getNode(path)
      if (!node) continue
      const footprint = node.elementContainer.representations.footprint
      if (footprint?.geometry.type === "Polygon") {
        const transformed = transformCoordinates(footprint.geometry.coordinates[0], node.globalMatrix)
        validTransformedPolygons.push(transformed)
      }
    }

    const footprintsSet = new Set(footprintPaths)
    return getTopLevelElementsInsidePolygons(validTransformedPolygons, {
      cache,
      includeSubtree: (path: string) => {
        // don't need to check the footprints we actually are comparing against
        if (footprintsSet.has(path)) {
          return false
        }
        return options?.includeSubtree?.(path) ?? true
      },
      scenarioChildNodes: options?.scenarioChildNodes,
    })
  }
})

// The API carries values and as such is recreated on every value change.
// This is why it is exposed as a reactive value.
export const analysisSelectionApiSignal = computed<AnalysisSelectionAPI>(() => {
  return {
    getTopLevelElementsInsidePolygons: getTopLevelElementsInsidePolygonsSignal.value,
    getTopLevelElementsInsideFootprints: getTopLevelElementsInsideFootprintsSignal.value,
  }
})

export function useAnalysisSelectionAPI(): AnalysisSelectionAPI {
  return analysisSelectionApiSignal.value
}
