import { useComputed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { selectedNodesSignal } from "src/core/selection/selectionState"
import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import type { Renderable } from "src/integrations/renderables/renderable"
import { visualizationSettingsSignal } from "src/integrations/renderables/visualizationSettings"
import type { Camera, Matrix4, Ray } from "three"
import { Plane, Vector3 } from "three"

export function removeZ(m: Matrix4) {
  const newMatrix = m.clone()
  newMatrix.elements[14] = 0
  return newMatrix
}

const planeHelper = new Plane()
const UP = new Vector3(0, 0, 1)
const intersectionTarget = new Vector3()
export const getPositionAtElevation = (ray: Ray, elevation: number): number[] => {
  planeHelper.set(UP, -elevation)
  ray.intersectPlane(planeHelper, intersectionTarget)
  return [intersectionTarget.x, intersectionTarget.y]
}

export function pointPointDistance(point1: number[], point2: number[]): number {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

export function pixelsToMetersAtPosition(pixels: number, camera: Camera, referencePosition: Vector3): number {
  const height = document.getElementById("MAP_VIEW_CANVAS_ID")?.offsetHeight || window.innerHeight
  const hundredPixelHeightNormalized = 100 / (height / 2)

  let metersPerPixel =
    referencePosition
      .clone()
      .project(camera)
      .add(new Vector3(0, hundredPixelHeightNormalized, 0))
      .unproject(camera)
      .distanceTo(referencePosition) / 100

  return metersPerPixel * pixels
}

export function applyMatrixToPolygon(boundingPolygon: number[][], matrix: Matrix4) {
  const p = applyMatrixToPositions(new Float32Array(boundingPolygon.flat()), matrix)
  let k = 0
  for (let i = 0; i < boundingPolygon.length; i++) {
    for (let j = 0; j < boundingPolygon[i].length; j++) {
      boundingPolygon[i][j] = p[k++]
    }
  }
  return boundingPolygon
}

export function applyMatrixToPositions(positions: Float32Array, transform: Matrix4, itemSize = 3) {
  const vec = new Vector3()
  for (let i = 0; i < positions.length / itemSize; i++) {
    vec.set(positions[i * itemSize], positions[i * itemSize + 1], positions[i * itemSize + 2])
    vec.applyMatrix4(transform)
    positions[i * itemSize] = vec.x
    positions[i * itemSize + 1] = vec.y
    positions[i * itemSize + 2] = vec.z
  }
  return positions
}

export function useMoveGroup(show: boolean = true) {
  const { moveGroup2D, moveGroup3D } = useComputed(() => {
    const proposal = elementState.currentProposalSignal.value
    const visualizationSettings = visualizationSettingsSignal.value

    const renderables3d: Renderable[] = []
    const renderables2d: Renderable[] = []

    const nodes = proposal.snapshot.getNodesWithAllDescendants(selectedNodesSignal.value)
    for (const node of nodes) {
      if (node === proposal.terrain?.node) continue
      renderables3d.push(...node.renderableForOutlines.getOrCompute())
      renderables3d.push(
        ...(node.renderables3dForUnits(visualizationSettings).getOrCompute() ?? node.renderables3d.getOrCompute()),
      )
      renderables2d.push(...(node.renderables2d.getOrCompute() ?? []))
    }

    const moveGroup2D = new RenderGroup("Move Group 2D", renderables2d.reverse()) //Reverse list to make rendering order take layer order into account.
    moveGroup2D.name = "Move Group 2D"
    moveGroup2D.userData.id = "MoveGroup2D"
    moveGroup2D.matrixAutoUpdate = true
    let childZ = 10 // some z above base merged renderables
    moveGroup2D.children.forEach((c) => {
      c.position.z = childZ++
    })
    return {
      moveGroup2D,
      moveGroup3D: new RenderGroup("movegroup-3d", renderables3d),
    }
  }).value

  useObjectLifecycle(moveGroup2D, show, sceneManager.overlay.scene)
  useObjectLifecycle(moveGroup3D, show, sceneManager.scene)

  return { moveGroup3D, moveGroup2D }
}

// from https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon
export function doEdgesIntersect(
  v1x1: number,
  v1y1: number,
  v1x2: number,
  v1y2: number,
  v2x1: number,
  v2y1: number,
  v2x2: number,
  v2y2: number,
) {
  let d1, d2
  let a1, a2, b1, b2, c1, c2

  // Convert vector 1 to a line (line 1) of infinite length.
  // We want the line in linear equation standard form: A*x + B*y + C = 0
  // See: http://en.wikipedia.org/wiki/Linear_equation
  a1 = v1y2 - v1y1
  b1 = v1x1 - v1x2
  c1 = v1x2 * v1y1 - v1x1 * v1y2

  // Every point (x,y), that solves the equation above, is on the line,
  // every point that does not solve it, is not. The equation will have a
  // positive result if it is on one side of the line and a negative one
  // if is on the other side of it. We insert (x1,y1) and (x2,y2) of vector
  // 2 into the equation above.
  d1 = a1 * v2x1 + b1 * v2y1 + c1
  d2 = a1 * v2x2 + b1 * v2y2 + c1

  // If d1 and d2 both have the same sign, they are both on the same side
  // of our line 1 and in that case no intersection is possible. Careful,
  // 0 is a special case, that's why we don't test ">=" and "<=",
  // but "<" and ">".
  if (d1 > 0 && d2 > 0) return false
  if (d1 < 0 && d2 < 0) return false

  // The fact that vector 2 intersected the infinite line 1 above doesn't
  // mean it also intersects the vector 1. Vector 1 is only a subset of that
  // infinite line 1, so it may have intersected that line before the vector
  // started or after it ended. To know for sure, we have to repeat the
  // the same test the other way round. We start by calculating the
  // infinite line 2 in linear equation standard form.
  a2 = v2y2 - v2y1
  b2 = v2x1 - v2x2
  c2 = v2x2 * v2y1 - v2x1 * v2y2

  // Calculate d1 and d2 again, this time using points of vector 1.
  d1 = a2 * v1x1 + b2 * v1y1 + c2
  d2 = a2 * v1x2 + b2 * v1y2 + c2

  // Again, if both have the same sign (and neither one is 0),
  // no intersection is possible.
  if (d1 > 0 && d2 > 0) return false
  if (d1 < 0 && d2 < 0) return false

  // If we get here, only two possibilities are left. Either the two
  // vectors intersect in exactly one point or they are collinear, which
  // means they intersect in any nubemr of points from zero to infinite.
  if (a1 * b2 - a2 * b1 === 0) return false

  // If they are not collinear, they must intersect in exactly one point.
  return true
}
