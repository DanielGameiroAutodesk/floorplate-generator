import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"
import { Proposal } from "src/core/elements/Proposal"
import type { InternalPath } from "src/lib/element/path"
import type { RepresentationBinary } from "./spaceClient/spaceClientv4"
import { encodePathForInventory } from "./getSiteDesignModelGlb"
import { parseUrn } from "src/lib/element/urn"

type ModelGraphbuildingResult = {
  path: InternalPath
  inventory: InternalPath[]
}

function getLeafChildrenPathsOfNode(snapshot: ElementSnapshot, node: ChildNodeContainer): InternalPath[] {
  const childrenPaths = node.elementContainer.element.children?.map((c) => `${node.path}/${c.key}`)
  if (!childrenPaths) return []
  return childrenPaths.flatMap((path) => {
    const childNode = snapshot.getNode(path)!
    console.log("childNode", childNode)
    if (!childNode.elementContainer.element.children?.length) {
      return [path]
    }
    return getLeafChildrenPathsOfNode(snapshot, childNode)
  })
}

const getSiteDesignModelGraphbuildings = (): ModelGraphbuildingResult[] => {
  const currentSnapshot = elementState.currentSnapshot.peek()

  return [...currentSnapshot.nodes.entries()]
    .filter(([, node]) => {
      const container = node.elementContainer

      const graphBuilding = container.element.representations?.graphBuilding
      return !!graphBuilding
    })
    .map(([path, node]) => {
      // recursively get all children paths of this node
      const childrenPaths = getLeafChildrenPathsOfNode(currentSnapshot, node)

      // Do we need path here? or just the leaf nodes (children?)
      return { path, inventory: [path, ...childrenPaths] }
    })
}

export const getSiteDesignModelGraphbuildingRepresentations = (): RepresentationBinary[] => {
  const currentSnapshot = elementState.currentSnapshot.peek()
  const proposal = Proposal.of(currentSnapshot)
  const proposalUrn = proposal.urn
  const { authcontext } = parseUrn(proposalUrn)

  const graphbuildings = getSiteDesignModelGraphbuildings()
  return graphbuildings.map((graphbuilding) => ({
    typeid: "autodesk.aec.forma:representation-binary-1.0.0",
    name: encodePathForInventory(graphbuilding.path),
    inventoryIds: graphbuilding.inventory.map(encodePathForInventory),
    serviceEndpoint: `/api/carbon-representation-service/v1/${encodeURIComponent(proposalUrn)}/${encodeURIComponent(graphbuilding.path)}?authcontext=${encodeURIComponent(authcontext)}`,
    format: "application/json",
    purpose: "graph-building",
    id: encodePathForInventory(graphbuilding.path),
  }))
}
