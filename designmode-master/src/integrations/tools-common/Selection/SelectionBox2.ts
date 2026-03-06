/**
 * Based on the work done in this js example
 * https://threejs.org/examples/misc_boxselection.html
 */
import type { Camera, InterleavedBufferAttribute, Object3D } from "three"
import {
  AlwaysDepth,
  Box3,
  BufferAttribute,
  Frustum,
  Group,
  Line3,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  Sphere,
  Vector2,
  Vector3,
} from "three"
import { updateOrthographicFrustum } from "./OrthographicFrustum"
import { updatePerspectiveFrustum } from "./PerspectiveFrustum"
import { Line2 } from "three/addons/lines/Line2.js"
import sceneManager from "src/core/three/sceneManager"
import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { dispose } from "src/core/three/useObjectLifecycle"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"

const bbox = new Box3()

const center = new Vector3()
const IDENTITY = new Matrix4()

const bboxPoints = [
  new Vector3(),
  new Vector3(),
  new Vector3(),
  new Vector3(),
  new Vector3(),
  new Vector3(),
  new Vector3(),
  new Vector3(),
]

function pruneObjects(objects: Object3D[], frustum: Frustum, clipFrustum?: Frustum) {
  return objects.filter((object) => {
    if (object instanceof Mesh) {
      if (object.material !== undefined) {
        if (!frustum.intersectsObject(object) || (clipFrustum && !clipFrustum.intersectsObject(object))) {
          return false
        }
        bbox.copy(object.geometry.boundingBox)
        object.matrixWorld && bbox.applyMatrix4(object.matrixWorld)
        return frustum.intersectsBox(bbox) && (!clipFrustum || clipFrustum.intersectsBox(bbox))
      }
    }
  })
}

function bboxCompletelyInsideFrustum(object: Mesh, frustum: Frustum, clipFrustum?: Frustum) {
  bbox.copy(object.geometry.boundingBox!)
  if (!object.matrixWorld.equals(IDENTITY)) {
    bbox.applyMatrix4(object.matrixWorld)
  }

  bboxPoints[0].set(bbox.min.x, bbox.min.y, bbox.min.z)
  bboxPoints[1].set(bbox.max.x, bbox.min.y, bbox.min.z)
  bboxPoints[2].set(bbox.min.x, bbox.max.y, bbox.min.z)
  bboxPoints[3].set(bbox.max.x, bbox.max.y, bbox.min.z)
  bboxPoints[4].set(bbox.min.x, bbox.min.y, bbox.max.z)
  bboxPoints[5].set(bbox.max.x, bbox.min.y, bbox.max.z)
  bboxPoints[6].set(bbox.min.x, bbox.max.y, bbox.max.z)
  bboxPoints[7].set(bbox.max.x, bbox.max.y, bbox.max.z)
  let bboxContainedInFrustum = bboxPoints.every((point) => {
    return frustum.containsPoint(point)
  })
  let bboxContainedInClipFrustum =
    !clipFrustum ||
    bboxPoints.every((point) => {
      return clipFrustum.containsPoint(point)
    })
  return bboxContainedInFrustum && bboxContainedInClipFrustum
}

function bboxIntersectsFrustum(object: Mesh, frustum: Frustum, clipFrustum?: Frustum) {
  bbox.copy(object.geometry.boundingBox!)
  if (!object.matrixWorld.equals(IDENTITY)) {
    bbox.applyMatrix4(object.matrixWorld)
  }
  return frustum.intersectsBox(bbox) && (!clipFrustum || clipFrustum.intersectsBox(bbox))
}

const edge = new Line3()
const sphere = new Sphere()
const point = new Vector3()

function lineIntsersectsFrustum(line: Line3, frustum: Frustum): boolean {
  return frustum.planes.some((plane) => {
    const intersection = plane.intersectLine(line, point)
    return intersection && frustum.intersectsSphere(sphere.set(intersection, 0.01)) //Use sphere to avoid edge case whith frustum.containsPoint() is false when point is ON frustum plane
  })
}

const USE_DEBUG = false
let DEBUG: Group | undefined

function debugLine(line: Line3) {
  if (!DEBUG) {
    DEBUG = new Group()
    DEBUG.name = "SelectionBox2 - DEBUG group"
    sceneManager.scene.add(DEBUG)
  }

  const vis = new Line2(
    new LineGeometry().setPositions([...line.start.toArray(), ...edge.end.toArray()]),
    new LineMaterial({
      depthFunc: AlwaysDepth,
      color: 0xff3c00,
      resolution: new Vector2(window.screen.width, window.screen.height),
    }),
  )
  DEBUG.add(vis)
  sceneManager.render()
}

function edgeIntersects(
  positionAttributes: BufferAttribute | InterleavedBufferAttribute,
  frustum: Frustum,
  line2: boolean,
  clipFrustum?: Frustum,
) {
  if (positionAttributes.count > 5_000) return false //Line overlap check is too expensive for large models TODO: check edges of boundingbox?

  //if (!line2) return false //TODO: fix edge calculation - it creates some extra edges that make selection weird out.
  for (let v = 0; v < positionAttributes.count - 1; v++) {
    const startVertex = v
    let endVertex = v + 1

    if (!line2 && endVertex % 3 === 0) {
      endVertex = endVertex - 3
    } else if (line2 && endVertex % 2 === 0) {
      continue
    }
    edge.start.set(
      positionAttributes.getX(startVertex),
      positionAttributes.getY(startVertex),
      positionAttributes.getZ(startVertex),
    )
    edge.end.set(
      positionAttributes.getX(endVertex),
      positionAttributes.getY(endVertex),
      positionAttributes.getZ(endVertex),
    )
    let cutoffLength = pixelsToMetersAtPosition(20, sceneManager.camera, edge.start)
    if (edge.distance() < cutoffLength) {
      continue
    }
    USE_DEBUG && debugLine(edge)
    if (lineIntsersectsFrustum(edge, frustum) && (!clipFrustum || lineIntsersectsFrustum(edge, clipFrustum))) {
      return true
    }
  }
  return false
}

/**
 * Improves the standard SelectionBox by also supporting intersections on edges of geometries.
 * Also has some memory optimizations to reduce garbage collection
 */
export class SelectionBox2 {
  private frustum = new Frustum()
  private clipFrustum: Frustum | undefined
  private camera: Camera
  private groupOfObjects: Object3D[]
  public startPoint: Vector3
  public endPoint: Vector3
  private collection: Object3D[]

  constructor(camera: Camera) {
    this.camera = camera
    this.groupOfObjects = []
    this.startPoint = new Vector3()
    this.endPoint = new Vector3()
    this.collection = []
  }

  select() {
    this.collection = []
    if (USE_DEBUG && DEBUG) {
      sceneManager.scene.remove(DEBUG)
      dispose(DEBUG)
      DEBUG = undefined
      sceneManager.render()
    }

    this.updateFrustum(this.startPoint, this.endPoint)
    this.updateClipFrustum()
    const pruned = pruneObjects(this.groupOfObjects, this.frustum, this.clipFrustum)
    pruned.forEach((obj) => {
      this.searchChildInFrustum(this.frustum, obj)
    })

    return this.collection
  }

  setCamera(camera: Camera) {
    this.camera = camera
  }

  setObjects(objects: Object3D[]) {
    objects.forEach((o) => {
      if (o instanceof Mesh) {
        if (!o.geometry.boundingBox) {
          o.geometry.computeBoundingBox()
        }
        if (!o.geometry.boundingSphere) {
          o.geometry.computeBoundingSphere()
        }
      }
    })
    this.groupOfObjects = objects
  }

  updateFrustum(startPoint?: Vector3, endPoint?: Vector3) {
    startPoint = startPoint || this.startPoint
    endPoint = endPoint || this.endPoint

    if (this.camera instanceof PerspectiveCamera) {
      updatePerspectiveFrustum(this.frustum, this.camera, startPoint, endPoint)
    } else if (this.camera instanceof OrthographicCamera) {
      updateOrthographicFrustum(this.frustum, this.camera, startPoint, endPoint)
    } else {
      throw new Error("Incompatible camera type for selection")
    }
  }

  updateClipFrustum() {
    const clippingPlanes = sceneManager.sectionBoxClipping.clippingPlanes

    if (clippingPlanes?.length === 6) {
      const [p0, p1, p2, p3, p4, p5] = clippingPlanes
      this.clipFrustum = new Frustum(p0, p1, p2, p3, p4, p5)
    }
  }

  private useAllInsideMode() {
    return this.startPoint.x - this.endPoint.x < 0
  }

  searchChildInFrustum(frustum: Frustum, object: Object3D, clipFrustum?: Frustum) {
    if (!(object instanceof Mesh) || !object.material) return

    const useAllInsideMode = this.useAllInsideMode()

    if (object.geometry.getAttribute(object instanceof Line2 ? "instanceStart" : "position").count > 10_000) {
      if (useAllInsideMode && bboxCompletelyInsideFrustum(object, frustum, clipFrustum)) {
        this.collection.push(object)
      } else if (!useAllInsideMode && bboxIntersectsFrustum(object, frustum, clipFrustum)) {
        this.collection.push(object)
      }
      return
    }

    let allInside = true
    let oneInside = false
    let geometry = object.geometry

    let position: BufferAttribute
    let itemSize = 3

    if (object instanceof Line2) {
      const instanceStart = object.geometry.getAttribute("instanceStart") as InterleavedBufferAttribute
      const vertices: number[] = []
      for (let v = 0; v < instanceStart.count; v++) {
        vertices.push(instanceStart.getX(v), instanceStart.getY(v), instanceStart.getZ(v))
      }
      position = new BufferAttribute(new Float32Array(vertices), 3)
    } else {
      // If indexed, assume all points are referenced in index array
      position = geometry.attributes.position
    }

    if (!object.matrixWorld.equals(IDENTITY)) {
      position = position.clone()
      position.applyMatrix4(object.matrixWorld)
    }

    const numberOfVertices = position.count

    for (let i = 0; i < numberOfVertices; i++) {
      center.set(position.array[i * itemSize], position.array[i * itemSize + 1], position.array[i * itemSize + 2])
      if (frustum.containsPoint(center)) {
        if (!useAllInsideMode) {
          oneInside = true
          break
        }
      } else if (useAllInsideMode) {
        allInside = false
        break
      }
    }
    if (useAllInsideMode ? allInside : oneInside) {
      this.collection.push(object)
      return
    }

    if (useAllInsideMode) return
    const edgeIntersect = edgeIntersects(position, this.frustum, object instanceof Line2)
    if (edgeIntersect) {
      this.collection.push(object)
      return
    }
  }
}
