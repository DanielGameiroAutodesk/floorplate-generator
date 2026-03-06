import type { Urn } from "@spacemakerai/element-types"
import type { BufferGeometry } from "three"
import { parseUrn } from "src/lib/element/urn"
import type { Proposal } from "./elements/Proposal"

// TODO: Consider finding a better place for this

/**
 * Contains all triangles in the tree of the glb pointed to by volumeMesh.node_id.
 * All geometry merged and glb-matrices applied. No transforms from the element systems are applied
 */
export type VolumeMesh = { position: Float32Array; index?: Uint8Array | Uint16Array | Uint32Array }

// TODO: Can we deal with terrain directly in elementState instead of having this util?
export function getVolumeMeshWithTerrainFallback(proposal: Proposal, urn: Urn): VolumeMesh | undefined {
  const container = proposal.snapshot.getElementContainer(urn)

  let geometry: BufferGeometry | undefined
  geometry = container?.representations.volumeMesh

  // Temporary fix for terrain, as it does not have geometry in the bufferGeometryState
  if (parseUrn(urn).system === "terrain" && proposal.terrain) {
    geometry = proposal.terrain.mesh.geometry
  }

  if (geometry) {
    return {
      position: geometry.getAttribute("position").array as Float32Array,
      index: geometry.getIndex()?.array as Uint8Array | Uint16Array | Uint32Array | undefined,
    }
  }
}
