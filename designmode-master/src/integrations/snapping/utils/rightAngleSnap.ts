import type { Object3D, Vector2Like } from "three"
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry, Vector2 } from "three"
import sceneManager from "src/core/three/sceneManager"
import { dispose } from "src/core/three/useObjectLifecycle"

const original = new Vector2()
const before = new Vector2()
const after = new Vector2()
const midpoint = new Vector2()
const directionOfOrigional = new Vector2()

const DEBUG = true
let DEBUG_VISUAL: Object3D | undefined = undefined
let timeout: NodeJS.Timeout

function debugRightAngleSnap(radius: number, closestPoint: Vector2) {
  if (!DEBUG) return
  if (DEBUG_VISUAL) {
    sceneManager.overlay.scene.remove(DEBUG_VISUAL)
    dispose(DEBUG_VISUAL)
  }
  const ring = new Mesh(
    new RingGeometry(radius - 0.2, radius + 0.2, 64, 64),
    new MeshBasicMaterial({ color: "#000000" }),
  )
  ring.position.set(midpoint.x, midpoint.y, 100)
  const point = new Mesh(new CircleGeometry(1, 16), new MeshBasicMaterial({ color: "#aa00ff" }))
  point.position.set(closestPoint.x, closestPoint.y, 101)
  DEBUG_VISUAL = new Group()
  DEBUG_VISUAL.add(ring)
  DEBUG_VISUAL.add(point)

  sceneManager.overlay.scene.add(DEBUG_VISUAL)
  sceneManager.render(false, true)

  timeout && clearTimeout(timeout)
  timeout = setTimeout(() => {
    DEBUG_VISUAL && sceneManager.overlay.scene.remove(DEBUG_VISUAL)
    sceneManager.render(false, true)
  }, 1000)
}

/**
 * For 3 points A, B and P, calculates the closest point Q to P, where the the angle AQB is 90 degrees.
 *
 * @param posP
 * @param posA
 * @param posB
 *
 * @return an object containing the new point Q and the distance from P to Q.
 *
 * TODO: this function created for future implementation of angle-snapping while editing shapes.
 */
export function rightAngleSnap(
  posP: Vector2Like,
  posA: Vector2Like,
  posB: Vector2Like,
): { distance: number; closestPoint: Vector2 } {
  original.set(posP.x, posP.y)
  before.set(posA.x, posA.y)
  after.set(posB.x, posB.y)
  midpoint.subVectors(after, before).multiplyScalar(0.5)
  const radius = midpoint.length()
  midpoint.add(before)

  directionOfOrigional.subVectors(original, midpoint)
  const distance = directionOfOrigional.length()

  const closestPoint = new Vector2().copy(directionOfOrigional).normalize().multiplyScalar(radius).add(midpoint)

  debugRightAngleSnap(radius, closestPoint)

  return {
    distance,
    closestPoint,
  }
}
