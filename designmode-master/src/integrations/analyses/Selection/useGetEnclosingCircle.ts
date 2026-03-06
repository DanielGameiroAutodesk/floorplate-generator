import * as THREE from "three"
import wetzls from "./wetzls"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { RepresentationType } from "src/core/elements/ElementRepresentations"
import { useCallback } from "preact/hooks"
import { getVisibleNodesSignal } from "src/core/elements/predicates"
import type { Proposal } from "src/core/elements/Proposal"
import { terrainSignal, type NewTerrainState } from "src/core/terrain/new-terrain-state"
import { elementState } from "src/core/elements/ElementState"

const reusableVec3 = new THREE.Vector3()

function getFootprintCoordinates(footprint: RepresentationType<"footprint">, transform: THREE.Matrix4) {
  if (footprint.geometry.type !== "Polygon") return []
  return footprint.geometry.coordinates.flat().map((coord) => {
    reusableVec3.set(coord[0], coord[1], 0)
    reusableVec3.applyMatrix4(transform)
    return { x: reusableVec3.x, y: reusableVec3.y }
  })
}

function getVolumeMeshCoordinates(terrain: NewTerrainState, childNode: ChildNodeContainer): { x: number; y: number }[] {
  const volumeMesh = childNode.elementContainer.getRepresentationOrThrow("volumeMesh")
  const geometry = volumeMesh.clone()
  const position = geometry.getAttribute("position")
  if (position.count > 500) {
    const bbox = childNode.bbox(terrain.terrainSamplerData).getOrCompute()
    if (!bbox) return []
    return [
      { x: bbox.min.x, y: bbox.min.y },
      { x: bbox.max.x, y: bbox.min.y },
      { x: bbox.min.x, y: bbox.max.y },
      { x: bbox.max.x, y: bbox.max.y },
    ]
  } else {
    position.applyMatrix4(childNode.globalMatrix)
    const selectedPoints = []
    for (let v = 0; v < position.array.length; v += 3) {
      selectedPoints.push({ x: position.array[v], y: position.array[v + 1] })
    }
    return selectedPoints
  }
}

function getSelectedPointsOfChild(
  proposal: Proposal,
  terrain: NewTerrainState,
  childNode: ChildNodeContainer,
): { x: number; y: number }[] {
  const container = childNode.elementContainer
  const isTerrain = container.element.urn === proposal.terrain?.urn
  const isVirtual = container.element.properties?.virtual

  if (isTerrain || isVirtual) return []

  let selectedPoints: { x: number; y: number }[] = []

  // Only want to check footprint if it's actually a 3D element.
  // The implications of this is that if a selected site limit has no 3D geometry,
  // the resulting circle will end up in the middle of the scene.
  // it could be argued that this is not correct as there might be a scenario
  // that a user wants an analysis of a site before placing buildings.

  // NOTE: this is to replicate old behavior that was present in previous versions of designmode
  // where it relied on buffer geometry.
  // https://github.com/spacemakerai/designmode/blob/fe74c8652df1ef00d711c3c20113a806cda71a31/src/integrations/analyses/Selection/useGetEnclosingCircle.ts
  if (container.representations.footprint && container.representations.volumeMesh) {
    const footprint = container.getRepresentationOrThrow("footprint")
    selectedPoints = getFootprintCoordinates(footprint, childNode.globalMatrix)
  } else if (container.representations.volumeMesh) {
    selectedPoints = getVolumeMeshCoordinates(terrain, childNode)
  }
  // get child coordinates if possible
  for (const child of proposal.snapshot.getChildrenOfNode(childNode)) {
    const points = getSelectedPointsOfChild(proposal, terrain, child)
    selectedPoints = selectedPoints.concat(points)
  }
  return selectedPoints
}

export function useGetEnclosingCircle() {
  const getVisibleNodes = getVisibleNodesSignal.value
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value

  return useCallback(
    (selectedPaths: string[]) => {
      if (selectedPaths.length === 0) {
        return {
          x: 0,
          y: 0,
          radius: 0,
        }
      }
      const visibleNodes = getVisibleNodes(proposal)
      const selectedPoints: { x: number; y: number }[] = selectedPaths.flatMap((path) => {
        const childNode = proposal.snapshot.getNode(path)
        if (!childNode) return []
        if (!visibleNodes.some((node) => childNode.equals(node))) return []
        return getSelectedPointsOfChild(proposal, terrain, childNode)
      })

      if (selectedPoints.length === 0) {
        return {
          x: 0,
          y: 0,
          radius: 0,
        }
      }

      const enclosingCircle = wetzls(selectedPoints)
      return { x: enclosingCircle.x, y: enclosingCircle.y, radius: enclosingCircle.r }
    },
    [getVisibleNodes, proposal, terrain],
  )
}
