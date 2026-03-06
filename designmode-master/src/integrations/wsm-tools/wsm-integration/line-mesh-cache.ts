import { newMeshDataCPP } from "@spacemakerai/web-sketch-renderer/lib/fastDataUtils"
import { TRIANGLE_LIMIT_MESH_TO_BODY } from "src/integrations/wsm-tools/wsr/api/limits"

/**
 * This class is used to cache line meshes created from triangle meshes for
 * WSM inference highlight purposes.
 *
 * Some line meshes are expensive to create, or are expensive in bulk,
 * so we create and retrieve them on demand. So we don't need to process
 * them all at once upfront.
 */
export class LineMeshCache {
  /**
   * Caches from meshId to associated lineMeshId. Note the first field is
   * a string, but it's in the form of "history:object". This is just because
   * WSM.ObjectHistoryID doesn't seem to work well as a key.
   */
  private readonly cache: Map<string, WSM.ObjectHistoryID> = new Map()

  /**
   * This just prevents a line mesh from a mesh id from being created
   * in this class by setting the key to INVALID_ID.
   *
   * @param mesh
   * @returns
   */
  markAsDontCache(mesh: WSM.ObjectHistoryID) {
    if (typeof mesh === "undefined") {
      return
    }
    this.cache.set(`${mesh.History}:${mesh.Object}`, WSM.ObjectHistoryID(mesh.History, WSM.INVALID_ID))
  }

  /**
   * Creates a line mesh for a triangle mesh, or return the id of the existing one.
   *
   * If the line mesh cannot be created, the cache is set to INVALID_ID and that value is returned.
   *
   * @param mesh
   * @returns
   */
  getOrCreateLineMeshFromMesh(mesh: WSM.ObjectHistoryID) {
    if (typeof mesh === "undefined") {
      return
    }
    let lm = this.cache.get(`${mesh.History}:${mesh.Object}`)
    if (typeof lm === "undefined") {
      // Uncomment to profile:
      //console.time(`creating line mesh.. ${mesh.History}:${mesh.Object}`)
      const dataRetriever = newMeshDataCPP()
      dataRetriever.retrieve(mesh.History, mesh.Object, 0.3048)

      if (dataRetriever.nTriangles() < TRIANGLE_LIMIT_MESH_TO_BODY) {
        const lmId = WSM.Utils.CreateLineMeshFromMeshEdges(mesh.History, mesh.Object, 0.99)
        lm = WSM.ObjectHistoryID(mesh.History, lmId)
        this.cache.set(`${mesh.History}:${mesh.Object}`, lm)
      } else {
        // If we're above the triangle limit, set the cache to INVALID_ID
        // so that we don't try to create this again.
        lm = WSM.ObjectHistoryID(mesh.History, WSM.INVALID_ID)
        this.cache.set(`${mesh.History}:${mesh.Object}`, lm)
      }
      //console.timeEnd(`creating line mesh.. ${mesh.History}:${mesh.Object}`)
    }
    return lm
  }
}

export const lineMeshCache = new LineMeshCache()
