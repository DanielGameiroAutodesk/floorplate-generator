import type { Urn } from "forma-elements"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { isTerrainElement } from "src/core/terrain/terrain-types"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { getElementsClient } from "src/core/elements-loading/loading"
import { loadTerrainDataAndCreateElementContainer } from "src/core/terrain/terrain-container"
import type { Proposal } from "src/core/elements/Proposal"

function getTerrainElement(proposalUrn: Urn, elements: FormaElementLookup) {
  const proposalElement = elements.getOrThrow(proposalUrn)
  for (const child of proposalElement.children ?? []) {
    const childElement = elements.get(child.urn)
    // Ignore the case where element does not exist in the graph, since the loading
    // code as of writing does not fail for those cases.
    if (childElement && isTerrainElement(childElement)) {
      return childElement
    }
  }

  return undefined
}

export type PendingTerrainUpdate = { oldurn: Urn; newurn: Urn }

export function getPendingTerrainUpdate(): PendingTerrainUpdate | undefined {
  const url = new URL(window.location.href)
  const oldurn = url.searchParams.get("oldterrain") as Urn | undefined
  const newurn = url.searchParams.get("newterrain") as Urn | undefined
  if (oldurn && newurn) {
    return { oldurn, newurn }
  }
  return undefined
}

export function clearPendingTerrainUpdate() {
  const url = new URL(window.location.href)
  url.searchParams.delete("oldterrain")
  url.searchParams.delete("newterrain")
  window.history.replaceState(null, "", url)
}

export async function updateTerrain(
  prevProposal: Proposal,
  pendingUpdate: PendingTerrainUpdate,
): Promise<ElementSnapshot> {
  console.log("Updating terrain", pendingUpdate)

  const { element: newTerrainElement } = await getElementsClient().getElementAutoBatched(pendingUpdate.newurn)
  if (!isTerrainElement(newTerrainElement)) {
    throw new Error(`Element ${pendingUpdate.newurn} is not a terrain element`)
  }

  const terrainContainer = await loadTerrainDataAndCreateElementContainer(newTerrainElement)

  const prevTerrainNode = prevProposal.terrain?.node
  if (!prevTerrainNode) {
    throw new Error("No terrain element in proposal")
  }

  return prevProposal.snapshot.edit(({ updateElement }) => {
    updateElement("proposal", { ...prevTerrainNode.child, urn: newTerrainElement.urn }, terrainContainer)
  })
}

export async function getTerrainContainer(
  proposalUrn: Urn,
  elements: FormaElementLookup,
  prevSnapshot: ElementSnapshot | undefined,
): Promise<ElementContainer | undefined> {
  const terrainElement = getTerrainElement(proposalUrn, elements)
  if (!terrainElement) return undefined
  const prevTerrainContainer = terrainElement ? prevSnapshot?.getElementContainer(terrainElement.urn) : undefined
  return prevTerrainContainer ?? (await loadTerrainDataAndCreateElementContainer(terrainElement))
}
