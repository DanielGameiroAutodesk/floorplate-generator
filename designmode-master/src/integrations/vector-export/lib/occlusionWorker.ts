import type { BufferGeometry, OrthographicCamera, PerspectiveCamera } from "three"
import type { MeshBVH, SerializedBVH } from "three-mesh-bvh"
import {
  deserializeBufferGeometry,
  deserializeCamera,
  deserializeLine3,
  deserializeMeshBVH,
  serializeLine3,
  type CameraComponents,
  type LineComponents,
} from "./workerUtils"
import { occludeByObjectsAndTerrain } from "./occlusion"

export type WorkerMessage =
  | {
      type: "initialize"
      data: {
        camera: CameraComponents
        objectsBVH: SerializedBVH
        objectsBVHGeometry: string
        terrainBVH: SerializedBVH | null
        terrainBVHGeometry: string | null
      }
    }
  | {
      type: "process"
      data: {
        allLines: LineComponents[]
      }
    }

let camera: OrthographicCamera | PerspectiveCamera
let objectsBVHGeometry: BufferGeometry
let objectsBVH: MeshBVH
let terrainBVHGeometry: BufferGeometry | null
let terrainBVH: MeshBVH | null

self.onmessage = function (event: MessageEvent<MessageEvent>) {
  const { type, data } = event.data

  try {
    if (type === "initialize") {
      camera = deserializeCamera(data.camera)
      objectsBVHGeometry = deserializeBufferGeometry(data.objectsBVHGeometry)
      objectsBVH = deserializeMeshBVH(data.objectsBVH, objectsBVHGeometry)
      terrainBVHGeometry = data.terrainBVHGeometry ? deserializeBufferGeometry(data.terrainBVHGeometry) : null
      terrainBVH =
        data.terrainBVH && terrainBVHGeometry ? deserializeMeshBVH(data.terrainBVH, terrainBVHGeometry) : null
    } else if (type === "process") {
      const allLines = data.allLines.map(deserializeLine3)
      // Perform occlusion processing using the initialized state
      const result = occludeByObjectsAndTerrain(allLines, camera, objectsBVH, terrainBVH)
      self.postMessage({
        visible: result.visible.map(serializeLine3),
        hidden: result.hidden.map(serializeLine3),
        visibleBelow: result.visibleBelow.map(serializeLine3),
      })
    }
  } catch (error) {
    if (error instanceof Error) self.postMessage({ error: error.message })
    else self.postMessage({ error: "Unknown error" })
  }
}

export {}
