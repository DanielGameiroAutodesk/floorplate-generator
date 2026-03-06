import { ElementKeyPath, ROOT_KEY } from "src/lib/element/path"
import type { ElementSnapshot } from "./ElementSnapshot"
import { Terrain } from "./Terrain"
import { getOrCompute } from "./internal/get-or-compute"
import { Base } from "./Base"
import { parseUrn } from "src/lib/element/urn"
import type { Child, Urn } from "forma-elements"
import type { FormaElement, Properties } from "@spacemakerai/element-types"
import type { ChildNodeContainer } from "./ChildNodeContainer"
import moize from "moize"
import { findBaseChild } from "src/lib/element/base"
import { isTerrainElement } from "src/core/terrain/terrain-types"

const ROOT_PATH = ElementKeyPath.of(ROOT_KEY)

const proposalCache = new WeakMap<ElementSnapshot, Proposal>()

export type ProposalFlags = {
  [id: string]: {
    fixed: boolean
    locked: boolean
    scenario: boolean // TODO: What's the difference between this and base? Both properties exists.
    [flag: string]: boolean
  }
}

export type ProposalProperties = {
  category: "proposal"
  name: string
  flags: ProposalFlags
  scenario?: {
    accProjectId: string
    scenarioId: string
    fileUrn: string
  }
}

export type ProposalElement = FormaElement & {
  properties: Properties & ProposalProperties
  children: Child[]
}

/**
 * This represents the concept proposal.
 */
export class Proposal {
  readonly snapshot: ElementSnapshot
  readonly base: Base
  readonly terrain: Terrain | undefined

  private constructor(snapshot: ElementSnapshot) {
    this.snapshot = snapshot
    this.base = Base.of(findBaseNode(snapshot))

    const terrainNode = findTerrainNode(snapshot)
    this.terrain = terrainNode ? Terrain.of(terrainNode) : undefined
    if (!this.terrain) {
      console.warn("No terrain element in proposal")
    }

    if (!ROOT_PATH.equals(snapshot.rootNode.path)) {
      throw new Error(`Root node should have path '${ROOT_PATH.value}' but found '${snapshot.rootNode.path}'`)
    }
  }

  static of(snapshot: ElementSnapshot) {
    return getOrCompute(proposalCache, snapshot, () => new Proposal(snapshot))
  }

  get urn(): Urn {
    return this.snapshot.rootNode.elementContainer.element.urn
  }

  get container() {
    return this.snapshot.rootNode.elementContainer
  }

  get element(): ProposalElement {
    return this.snapshot.rootNode.elementContainer.element as ProposalElement
  }

  get path(): ElementKeyPath {
    return ROOT_PATH
  }

  get id(): string {
    return parseUrn(this.urn).id
  }

  // Memoize as this is used frequently.
  getToplevelNodes: () => ChildNodeContainer[] = moize(() => {
    return [this.snapshot.rootNode, this.base.node]
      .flatMap((node) => this.snapshot.getChildrenOfNode(node))
      .filter((node) => node !== this.base.node)
  })

  getToplevelElements: () => FormaElement[] = () => {
    return this.getToplevelNodes().map((it) => it.elementContainer.element)
  }
}

/**
 * Assumes that there is a single terrain element living directly on the proposal.
 */
function findTerrainNode(snapshot: ElementSnapshot): ChildNodeContainer | undefined {
  const terrainNodes = snapshot
    .getChildrenOfNode(snapshot.rootNode)
    .filter((node) => isTerrainElement(node.elementContainer.element))
  if (terrainNodes.length === 0) {
    return undefined
  }
  if (terrainNodes.length > 1) {
    throw new Error(
      `Proposal should have exactly one terrain element but found ${terrainNodes.length} with keys: ${terrainNodes.map((it) => it.child.key).join(", ")}`,
    )
  }
  return terrainNodes[0]
}

/**
 * Throws if no base was found on the proposal
 * @returns {ChildNodeContainer}
 */
function findBaseNode(snapshot: ElementSnapshot): ChildNodeContainer {
  const baseChild = findBaseChild(snapshot.rootNode.element)
  if (!baseChild) throw new Error("Proposal must have a base")

  const basePath = `${ROOT_KEY}/${baseChild.key}`
  const baseNode = snapshot.nodes.get(basePath)
  if (!baseNode) throw new Error(`No ChildNodeContainer found for base path ${basePath}`)
  return baseNode
}
