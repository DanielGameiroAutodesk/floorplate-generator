import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { Proposal } from "src/core/elements/Proposal"
import type { ValidationError } from "src/core/elements/validation/geometry-validation/errors"
import type { Box3, Matrix4 } from "three"
import type { NewTerrainState } from "src/core/terrain/new-terrain-state"

function matrixHash(matrix: Matrix4): string {
  return matrix.toArray().join(",")
}

function hashTransformAndUrn(node: ChildNodeContainer): string {
  return [matrixHash(node.globalMatrix), node.elementContainer.element.urn].join(":")
}

const toplevelNodeCache = new WeakMap<ChildNodeContainer, Box3 | undefined>()
function calculateBbboxForSubtree(
  node: ChildNodeContainer,
  proposal: Proposal,
  terrain: NewTerrainState,
): Box3 | undefined {
  return proposal.snapshot.getDescendantsOfNode(node).reduce<Box3 | undefined>((prev, curr) => {
    const currBbox = curr.bbox(terrain.terrainSamplerData).getOrCompute()
    if (prev && currBbox) {
      prev.expandByPoint(currBbox.min)
      prev.expandByPoint(currBbox.max)
    } else if (currBbox) {
      return currBbox
    }
    return prev
  }, node.bbox(terrain.terrainSamplerData).getOrCompute())
}

function hashCategoryAndBbox(
  node: ChildNodeContainer,
  proposal: Proposal,
  terrain: NewTerrainState,
): string | undefined {
  const category = node.elementContainer.element.properties?.category ?? "generic"
  if (!toplevelNodeCache.has(node)) {
    toplevelNodeCache.set(node, calculateBbboxForSubtree(node, proposal, terrain))
  }

  const bbox = toplevelNodeCache.get(node)
  if (!bbox) return undefined

  const bboxHash = [bbox.min, bbox.max].flatMap((v) => v.toArray()).join(",")

  return [category, bboxHash].join(":")
}

// What is a duplicate element?
// The same urn at the same location is at least a duplicate, however; copy-pasting an element or placing from library
// can sometimes create an element which is identical except it's urn. We want to detect those as well, but this data
// is not easily available.

export function validateDuplicateElements(proposal: Proposal, terrain: NewTerrainState): ValidationError[] {
  const errors: ValidationError[] = []

  const seenHashesTransformAndUrn = new Set<string>()
  const elementHash = new Set<string>()
  for (const node of proposal.getToplevelNodes()) {
    const transformAndUrn = hashTransformAndUrn(node)
    const categoryAndBbox = hashCategoryAndBbox(node, proposal, terrain)

    if (seenHashesTransformAndUrn.has(transformAndUrn) || (categoryAndBbox && elementHash.has(categoryAndBbox))) {
      errors.push({ type: "duplicate-element", path: node.path })
    }
    seenHashesTransformAndUrn.add(transformAndUrn)
    if (categoryAndBbox) elementHash.add(categoryAndBbox)
  }

  return errors
}
