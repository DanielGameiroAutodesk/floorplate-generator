import { parseUrn } from "src/lib/element/urn"
import { getOrCompute } from "./internal/get-or-compute"
import type { Urn } from "forma-elements"
import { ElementKeyPath } from "src/lib/element/path"
import type { ChildNodeContainer } from "./ChildNodeContainer"

const baseCache = new WeakMap<ChildNodeContainer, Base>()

/**
 * This represents the concept base in a proposal.
 *
 * Also known as scenario.
 */
export class Base {
  private constructor(public readonly node: ChildNodeContainer) {}

  static of(node: ChildNodeContainer) {
    return getOrCompute(baseCache, node, () => new Base(node))
  }

  get key(): string {
    return this.node.child.key
  }

  get urn(): Urn {
    return this.node.elementContainer.element.urn
  }

  get path(): ElementKeyPath {
    return ElementKeyPath.of(this.node.path)
  }

  get container() {
    return this.node.elementContainer
  }

  get element() {
    return this.node.elementContainer.element
  }

  get elementId(): string {
    return parseUrn(this.urn).id
  }
}
