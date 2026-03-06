import {
  type BufferGeometry,
  OrthographicCamera,
  PerspectiveCamera,
  type Camera,
  type EulerTuple,
  type Vector3Tuple,
  Line3,
  Vector3,
  BufferGeometryLoader,
} from "three"
import { MeshBVH, type SerializedBVH } from "three-mesh-bvh"

export type CameraComponents = {
  type: string
  fov: number | undefined
  aspect: number | undefined
  near: number
  far: number
  top: number | undefined
  bottom: number | undefined
  left: number | undefined
  right: number | undefined
  zoom: number
  position: Vector3Tuple
  rotation: EulerTuple
  up: Vector3Tuple
}

export function serializeCamera(camera: Camera): CameraComponents {
  const cam = camera as PerspectiveCamera | OrthographicCamera
  return {
    zoom: cam.zoom,
    type: cam.type,
    fov: cam instanceof PerspectiveCamera ? cam.fov : undefined,
    aspect: cam instanceof PerspectiveCamera ? cam.aspect : undefined,
    near: cam.near,
    far: cam.far,
    position: cam.position.toArray(),
    rotation: cam.rotation.toArray(),
    up: cam.up.toArray(),
    top: cam instanceof OrthographicCamera ? cam.top : undefined,
    bottom: cam instanceof OrthographicCamera ? cam.bottom : undefined,
    left: cam instanceof OrthographicCamera ? cam.left : undefined,
    right: cam instanceof OrthographicCamera ? cam.right : undefined,
  }
}

export const deserializeCamera = (components: CameraComponents) => {
  let camera
  if (components.type === "PerspectiveCamera") {
    camera = new PerspectiveCamera(components.fov, components.aspect, components.near, components.far)
  } else if (components.type === "OrthographicCamera") {
    camera = new OrthographicCamera(
      components.left,
      components.right,
      components.top,
      components.bottom,
      components.near,
      components.far,
    )
  } else {
    // Handle other camera types if necessary
    const errorMessage = "Unsupported camera type"
    self.postMessage({ event: "error", content: errorMessage })
    throw new Error(errorMessage)
  }

  camera.position.fromArray(components.position)
  camera.rotation.fromArray(components.rotation)
  camera.up.fromArray(components.up)
  camera.zoom = components.zoom
  camera.updateProjectionMatrix()
  return camera
}

export function serializeBufferGeometry(geometry: BufferGeometry): string {
  const json = geometry.toJSON()
  return JSON.stringify(json)
}

export function deserializeBufferGeometry(data: string): BufferGeometry {
  const loader = new BufferGeometryLoader()
  return loader.parse(JSON.parse(data))
}

export function serializeMeshBVH(bvh: MeshBVH): SerializedBVH {
  return MeshBVH.serialize(bvh)
}

export function deserializeMeshBVH(data: SerializedBVH, geometry: BufferGeometry): MeshBVH {
  return MeshBVH.deserialize(data, geometry)
}

export function serializeLine3(line: Line3) {
  return {
    start: line.start.toArray(),
    end: line.end.toArray(),
  }
}

export type LineComponents = { start: Vector3Tuple; end: Vector3Tuple }

export function deserializeLine3(data: LineComponents): Line3 {
  const start = new Vector3().fromArray(data.start)
  const end = new Vector3().fromArray(data.end)
  return new Line3(start, end)
}
