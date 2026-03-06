import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { BufferGeometry } from "three"
import { Color, Matrix4 } from "three"
import { useCallback } from "preact/hooks"
import { parseUrn } from "src/lib/element/urn"
import { buildGeoFromBlockWithHole } from "src/integrations/building-systems-common/buildGeoWithHoles"
import hull from "hull.js"
import { setBuildingFunction } from "./conceptualBuildingFunction"
import type { InternalPath } from "src/lib/element/path"
import { elementState } from "src/core/elements/ElementState"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { Selectable, SelectionMode } from "src/core/elements/element-container-derived-data/selectables"
import { calculateEdgesGeometry } from "src/lib/three/geometryUtils"
import { mergeFloat32Arrays } from "src/integrations/building-systems-common/geoHelpers"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { getRepresentationJsonUnsafe } from "@spacemakerai/elements-client"
import { isDefined } from "src/lib/array"

/**
 * Creates a simplified volume from a geometry by calculating a XY-plane footprint using concave
 * hull and extruding that footprint to match the original geometry's height and elevation.
 * @param geometry
 */
export function geometryToExtrudedFootprint(zUp: BufferGeometry, concavity: number = 30) {
  const positions = zUp.getAttribute("position")
  const vertices = Array.from(positions.array)
  const coords: number[][] = []
  let elevation = Number.MAX_SAFE_INTEGER
  let height = Number.MIN_SAFE_INTEGER
  for (let i = 0; i < positions.count; i++) {
    let [x, y, z] = vertices.slice(i * positions.itemSize, i * positions.itemSize + 3)
    coords.push([x, y])
    elevation = Math.min(elevation, z)
    height = Math.max(height, z - elevation)
  }
  const footprint = hull(coords, concavity) as number[][]
  let volume = {
    coordinates: [footprint],
    elevation,
    height,
  }
  return volume
}

export namespace conceptualElementsApi {
  export const getFunctionIds = (urn: Urn, elements: FormaElementLookup) => {
    let buildingFunctions: string[] = []
    const element = elements.getOrThrow(urn)

    function getFloorFunctions(floorElement: FormaElement) {
      if (floorElement.representations?.gfaUnits) {
        const gfaUnits = getRepresentationJsonUnsafe(floorElement.representations.gfaUnits)
        return gfaUnits.map((unit) => unit.functionId).filter(isDefined)
      }
      return ["unspecified"]
    }

    if (element.properties?.category === "building" && element.children) {
      buildingFunctions = element.children.flatMap((child) => getFloorFunctions(elements.getOrThrow(child.urn)))
    } else if (element.properties?.category === "floor") {
      buildingFunctions = getFloorFunctions(element)
    } else {
      buildingFunctions = [element.properties?.functionId ?? "unspecified"]
    }
    return (
      buildingFunctions
        // Remove duplicates
        .filter((v, i, a) => a.indexOf(v) === i)
    )
  }

  export const is3dSketchOwned = (element: FormaElement): boolean => {
    return (
      parseUrn(element.urn).system === "integrate" &&
      (element.properties?.spacemakerObjectStorageReferenceFormats?.includes("axm") ||
        element.properties?.spacemakerObjectStorageReferenceFormats?.includes("wsm"))
    )
  }

  export const is3dSketchBuilding = (element: FormaElement) =>
    is3dSketchOwned(element) && element.properties?.category === "building"

  export const is3dSketchFloor = (element: FormaElement) =>
    parseUrn(element.urn).system === "integrate" && element.properties?.category === "floor"

  export const is3DSketchBuildingElement = (element: FormaElement) => {
    return (
      parseUrn(element.urn).system === "integrate" &&
      element.properties?.category &&
      ["building", "floor"].includes(element.properties.category)
    )
  }

  export const createSelectablesForBuilding = (
    container: ElementContainer,
  ): { selectionMode: SelectionMode; selectables: Selectable[] } | undefined => {
    const element = container.element
    if (!conceptualElementsApi.is3dSketchBuilding(element)) return
    if (!element.children || element.children.length == 0) return

    const floors = element.children.map((child) => {
      const childContainer = container.children.find((c) => c.element.urn == child.urn)
      if (!childContainer) throw new Error("3DS building selectables: Didn't find child container")
      const volumeMesh = childContainer.representations.volumeMesh
      // NOTE: temporarily not throwing breaking error in this case because it is triggered too often
      //       we are currently working on getting to the root cause of the issue..
      // if (!volumeMesh) throw new Error("3DS building selectables: Didn't find floor volumeMesh")
      if (!volumeMesh) return null
      const geometry = volumeMesh.clone()
      if (child.transform) geometry.applyMatrix4(new Matrix4().fromArray(child.transform))
      return { subPath: child.key, geometry }
    })

    if (floors.some((f: unknown | null) => f === null)) {
      return
    }

    const floorSelectables: Selectable[] = floors.map((floor) => ({
      target: { type: "element", subPath: floor!.subPath },
      selectable3d: {
        hitbox: floor!.geometry,
        outlines: calculateEdgesGeometry(floor!.geometry),
      },
    }))

    const topFloor = floors.at(-1)!
    const extrudedFootprint = geometryToExtrudedFootprint(topFloor.geometry, Infinity) // Infinity for convex footprint
    const roofGeometry = buildGeoFromBlockWithHole({
      color: new Color("white"),
      height: 0.001,
      coordinates: extrudedFootprint.coordinates as [number, number][][],
      elevation: extrudedFootprint.elevation + extrudedFootprint.height + 0.01,
    })

    const mergedFloorOutlines = mergeFloat32Arrays(floorSelectables.map((s) => s.selectable3d!.outlines!))
    const roofSelectable: Selectable = {
      target: { type: "element" },
      selectable3d: { hitbox: roofGeometry, outlines: mergedFloorOutlines },
    }
    return { selectionMode: "custom-selectables-only", selectables: [roofSelectable, ...floorSelectables] }
  }

  export const isElement3DSCorrupted = (elementContainer: ElementContainer): boolean => {
    if (
      is3DSketchBuildingElement(elementContainer.element) &&
      elementContainer.element.properties?.category === "building" &&
      !!elementContainer.element.representations?.buildingFloors3DSketch_UNSTABLE &&
      elementContainer.children.some((ec) => !ec.representations.volumeMesh)
    ) {
      return true
    }
    return false
  }

  export const does3DSBuildingRequireGraphBuildingBackfill = (elementContainer: ElementContainer): boolean => {
    // we need to backfill if no graphBuilding or if there is evidence the existing graphBuilding is wrong
    if (
      !elementContainer.element.representations?.graphBuilding_approximation ||
      Math.abs(elementContainer.representations?.buildingFloors3DSketch_UNSTABLE?.floors3d?.[0]?.elevation || 0) >
        0.005 ||
      elementContainer.representations?.buildingFloors3DSketch_UNSTABLE?.floors3d?.some(
        (f) => f.floorOutline?.length === 0,
      )
    ) {
      return true
    }
    return false
  }
}

export function useIsPathTo3dSketchFloor() {
  const snapshot = elementState.currentSnapshot.value

  return useCallback(
    (path: string) => {
      const element = snapshot.getNode(path)?.element
      let isPathToFloor = element && conceptualElementsApi.is3dSketchFloor(element)
      return isPathToFloor
    },
    [snapshot],
  )
}

export function useSetFloorFunction() {
  return useCallback((floorPath: InternalPath, functionId: string) => {
    const floorElement = elementState.currentSnapshot.peek().getNode(floorPath)?.elementContainer.element
    if (!floorElement) return
    return setBuildingFunction([{ path: floorPath, element: floorElement }], functionId)
  }, [])
}
