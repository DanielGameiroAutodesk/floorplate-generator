import { getRelativeUrl } from "src/integrations/spaces/loadSpaceRenderables"
import type { BufferGeometry, Mesh } from "three"
import { pollForRepresentation } from "./scenariosClient"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { yUpToZUp } from "src/lib/download-helpers"

/**
 * Download and parse terrain from a service endpoint
 * Assumes there is one Mesh in the GLB
 */
export const downloadTerrainFromScenario = async (url: string): Promise<BufferGeometry | null> => {
  const relativeUrl = getRelativeUrl(url)

  const buffer = await pollForRepresentation(relativeUrl)

  const glb = await new GLTFLoader().parseAsync(buffer, "")

  const bufferGeos: BufferGeometry[] = []
  glb.scene.traverse((child) => {
    if (child.type === "Mesh") {
      const mesh = child as Mesh
      if (mesh.geometry) {
        mesh.geometry.applyMatrix4(yUpToZUp)
        mesh.geometry.applyMatrix4(mesh.matrixWorld)
        bufferGeos.push(mesh.geometry)
      }
    }
  })

  if (bufferGeos.length > 0) {
    return bufferGeos[0]
  } else {
    console.warn("No terrain geometry found in GLB file")
    return null
  }
}
