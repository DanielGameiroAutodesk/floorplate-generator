import type { BufferGeometry, Mesh } from "three"
import { getRelativeUrl } from "src/integrations/spaces/loadSpaceRenderables"
import { yUpToZUp } from "src/lib/download-helpers"
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js"

/**
 * Download and parse terrain from a service endpoint
 * Assumes there is one Mesh in the GLB
 */
export const downloadTerrainFromSpace = async (url: string): Promise<BufferGeometry | null> => {
  const relativeUrl = getRelativeUrl(url)

  try {
    const glb = await fetch(relativeUrl).then((res) => res.arrayBuffer())
    const loader = new GLTFLoader()
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(
        glb,
        "",
        (gltf) => resolve(gltf),
        (error) => {
          console.error("Error parsing terrain GLB:", error)
          reject(
            new Error(`Failed to parse terrain GLB: ${error instanceof Error ? error.message : JSON.stringify(error)}`),
          )
        },
      )
    })

    const bufferGeos: BufferGeometry[] = []

    gltf.scene.traverse((child) => {
      if (child.type === "Mesh") {
        const mesh = child as Mesh
        if (mesh.geometry) {
          bufferGeos.push(mesh.geometry)
        }
      }
    })

    if (bufferGeos.length > 0) {
      const terrainGeometry = bufferGeos[0]
      terrainGeometry.applyMatrix4(yUpToZUp)
      return terrainGeometry
    } else {
      console.warn("No terrain geometry found in GLB file")
      return null
    }
  } catch (error) {
    console.error("Error downloading terrain from space:", error)
    return null
  }
}
