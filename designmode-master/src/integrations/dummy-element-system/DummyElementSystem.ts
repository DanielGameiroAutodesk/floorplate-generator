import type { ElementSystem } from "src/core/element-systems"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { BoxGeometry, BufferAttribute } from "three"
import { mapOfFormaElements } from "src/lib/element/utils"

/**
 * This system generates an empty element with a black box as its geometry.
 * UseCase: LocalElementSystems that live behind a feature flag leave behind
 * proposal with links to systems that don't have a backend. When the users
 * re-enters those proposals in another tab, or without the flag it would
 * normally fails. Instead you can use this class to generate a dummy element.
 */
export default class DummyElementSystem implements ElementSystem {
  name: string

  constructor(name: string) {
    this.name = name
  }

  elementsClientElementsBypass = (urns: Urn[]): Promise<Map<Urn, FormaElement>>[] => {
    window.forma_toasts.push({
      content: `You have unknown elements in your proposal: ${urns.join(", ")}`,
      status: "warning",
      autoDismiss: false,
    })
    return urns.map((urn: Urn) => {
      return Promise.resolve(mapOfFormaElements({ urn }))
    })
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  customFetchVolumeMesh = async () => {
    const blackbox = new BoxGeometry(10, 10, 10)
    const colors = new Uint8Array(blackbox.getAttribute("position").array.length).fill(0)
    blackbox.setAttribute("color", new BufferAttribute(colors, 3, true))
    return blackbox
  }
}
