import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { Proposal } from "src/core/elements/Proposal"
import type { ValidationError } from "src/core/elements/validation/geometry-validation/errors"
import type { NewTerrainState } from "src/core/terrain/new-terrain-state"
import type { Box3 } from "three"
import { Box2, Vector2 } from "three"

const BBOX_MAX_DISTANCE = 1e5

function toBox2(box3: Box3): Box2 {
  return new Box2(new Vector2(box3.min.x, box3.min.y), new Vector2(box3.max.x, box3.max.y))
}

const toplevelNodeCache = new WeakMap<ChildNodeContainer, Box2 | undefined>()

function calculateBox2(node: ChildNodeContainer, proposal: Proposal, terrain: NewTerrainState): Box2 | undefined {
  const bboxForSubtree = proposal.snapshot.getDescendantsOfNode(node).reduce<Box3 | undefined>((prev, curr) => {
    const currBbox = curr.bbox(terrain.terrainSamplerData).getOrCompute()
    if (prev && currBbox) {
      prev.expandByPoint(currBbox.min)
      prev.expandByPoint(currBbox.max)
    } else if (currBbox) {
      return currBbox
    }
    return prev
  }, node.bbox(terrain.terrainSamplerData).getOrCompute())

  return bboxForSubtree ? toBox2(bboxForSubtree) : undefined
}

export function validateOutOfBounds(proposal: Proposal, terrain: NewTerrainState) {
  // TODO: Support non-element terrains from the new terrain state
  const terrainNodeBbox = proposal.terrain?.node.bbox(terrain.terrainSamplerData).getOrCompute()
  if (!terrainNodeBbox) return []
  const terrainNodeBbox2 = toBox2(terrainNodeBbox)

  return proposal.getToplevelNodes().flatMap<ValidationError>((node) => {
    if (!toplevelNodeCache.has(node)) toplevelNodeCache.set(node, calculateBox2(node, proposal, terrain))

    const box2ForNodeSubtree = toplevelNodeCache.get(node)
    if (!box2ForNodeSubtree) return []

    if (!terrainNodeBbox2?.intersectsBox(box2ForNodeSubtree)) {
      return [{ type: "out-of-bounds-element", path: node.path }]
    }

    const isValidBoundingBox =
      Math.max(...box2ForNodeSubtree.max) < BBOX_MAX_DISTANCE &&
      Math.min(...box2ForNodeSubtree.min) > -BBOX_MAX_DISTANCE
    if (!isValidBoundingBox) {
      return [{ type: "invalid-bbox-element", path: node.path }]
    }

    return []
  })
}
