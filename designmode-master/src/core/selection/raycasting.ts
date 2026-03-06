import sceneManager from "src/core/three/sceneManager"
import type { Camera, Intersection, Object3D } from "three"
import { Raycaster, Vector2, Vector3 } from "three"
import { Line2 } from "three/addons/lines/Line2.js"
import type { SelectionPath } from "./selectionTypes"

export type RaycastObject<TObject extends Object3D, TData extends Record<string, any>> = {
  object: TObject
  data: TData
}

export type RaycastType =
  | "3d" // Represent a normal raycast
  | "2d" // Raycast towards terrain, then do a vertical raycast at xy of terrain intersection. This is used for 2d geometry

export type RaycastData = { raycastType: RaycastType; selection: SelectionPath }

export type RaycastTarget = { object3d: Object3D; type: RaycastType }
export type RaycastTarget2d = RaycastTarget & { type: "2d" }
export type RaycastTarget3d = RaycastTarget & { type: "3d" }

const overlayRaycaster = new Raycaster()
overlayRaycaster.params.Line = { threshold: 5 }
overlayRaycaster.params.Line2 = { threshold: 5 }
overlayRaycaster.params.Points = { threshold: 3 }

export function getRaycastTarget(
  raycaster: Raycaster,
  directObjects: Object3D[],
  overlayObjects: Object3D[],
): { closest?: Intersection; allTargetsAtPoint: Intersection[] } {
  const terrain = sceneManager.scene.getObjectByName("Terrain")

  const objectIntersections = raycaster.intersectObjects(directObjects, true)

  const terrainIntersection = terrain ? raycaster.intersectObject(terrain, true)[0] : undefined

  //Don't use intersections behind terrain
  const terrainDistance = terrainIntersection ? terrainIntersection.distance : Infinity
  const furtherThanTerrainIndex = objectIntersections.findIndex((hit) => hit.distance > terrainDistance + 1e-5)
  const relevantObjectIntersections =
    furtherThanTerrainIndex > 0 ? objectIntersections.slice(0, furtherThanTerrainIndex) : objectIntersections
  let relevantHits = terrainIntersection
    ? [...relevantObjectIntersections, terrainIntersection]
    : relevantObjectIntersections

  // filtering based on clipping planes
  // must filter on this first to avoid self-obstructions for geometries intersected by a clipping plane
  const clippingPlanes = sceneManager.sectionBoxClipping.clippingPlanes
  if (clippingPlanes?.length > 0) {
    relevantHits = relevantHits.filter((hit) => {
      const distances = clippingPlanes.map((plane) => plane.distanceToPoint(hit.point))
      // all distances must be positive for the point to be visible
      return !distances.some((d) => d <= 0)
    })
  }

  const candidateShapes = relevantHits
    .filter((hit, i, arr) => arr.findIndex((h) => h.object === hit.object) === i) //Unique objects
    .flatMap((hit): Intersection[] => {
      if (hit === terrainIntersection) {
        overlayRaycaster.set(new Vector3(hit.point.x, hit.point.y, 10000), new Vector3(0, 0, -1))
        return overlayRaycaster.intersectObjects(overlayObjects, true).map(({ object }) => ({
          // Merged intersection from the terrain and the object
          point: hit.point,
          distance: hit.distance,
          object,
        }))
      } else {
        return [hit]
      }
    })

  const closest = candidateShapes[0]
  return { closest, allTargetsAtPoint: candidateShapes }
}

const raycaster = new Raycaster()

function updateRay(event: MouseEvent, camera: Camera) {
  const pointer = new Vector2()
  pointer.x = (event.offsetX / window.innerWidth) * 2 - 1
  pointer.y = -(event.offsetY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
}

export function getTargetPath(
  event: MouseEvent | undefined,
  camera: Camera,
  raycastTargets: Map<Object3D, RaycastData>,
  tabSelectIndex = 0,
): RaycastData | undefined {
  if (event) updateRay(event, camera)

  const directObjects = [...raycastTargets.entries()]
    .filter(([, d]) => d.raycastType === "3d")
    .filter(([o]) => !(o instanceof Line2)) // We need this filter, as basic buildings creates floor lines on the building level
    .map(([o]) => o)
  const overlayObjects = [...raycastTargets.entries()].filter(([, d]) => d.raycastType === "2d").map(([o]) => o)

  const target = getRaycastTarget(raycaster, directObjects, overlayObjects)
  if (!target.closest) {
    return undefined
  }

  const intersection = target.allTargetsAtPoint[tabSelectIndex % target.allTargetsAtPoint.length]
  return raycastTargets.get(intersection.object)
}
