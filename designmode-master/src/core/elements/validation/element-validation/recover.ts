import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { ElementsValidationError, MissingElementError } from "./types"
import { createUrn, newChildKey, newId, newRevision, replaceRevision } from "src/lib/element/urn"
import { findBaseChild, findBasePath } from "src/lib/element/base"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import type { FormaElementBox } from "src/lib/element/statebox"
import { createElementBoxMapFromDraftElements } from "src/lib/element/statebox"
import { mergeMaps, getInMapOrThrow } from "src/lib/map"
import { PROJECT_ID } from "src/core/project/project"
import type { ProposalElement, ProposalProperties } from "src/core/elements/Proposal"

export function recoverFromValidationErrors(
  rootUrn: Urn,
  elements: Map<Urn, FormaElementBox>,
  errors: ElementsValidationError[],
): { rootUrn: Urn; elements: Map<Urn, FormaElementBox> } {
  let recovered: { rootUrn: Urn; elements: Map<Urn, FormaElementBox> } = { rootUrn, elements }

  if (errors.some((e) => e.type === "MISSING_BASE")) {
    const { proposal, base } = recoverMissingBase(getInMapOrThrow(recovered.elements, recovered.rootUrn).element)
    recovered = {
      rootUrn: proposal.urn,
      elements: mergeMaps(recovered.elements, createElementBoxMapFromDraftElements(proposal, base)),
    }
  }

  if (errors.some((e) => e.type === "MISSING_ELEMENT")) {
    const missingElementsErrors = errors.filter((e): e is MissingElementError => e.type === "MISSING_ELEMENT")
    const { recoveredBase, recoveredProposal } = getProposalAndBaseWithoutErrorSubtrees(
      recovered.rootUrn,
      recovered.elements,
      missingElementsErrors,
    )
    recovered = {
      rootUrn: recoveredProposal.urn,
      elements: mergeMaps(
        recovered.elements,
        createElementBoxMapFromDraftElements(
          recoveredProposal,
          recoveredBase ? { [recoveredBase.urn]: recoveredBase } : {},
        ),
      ),
    }
  }

  return recovered
}

function recoverMissingBase(proposal: FormaElement): { proposal: ProposalElement; base: FormaElement } {
  const baseKey = newChildKey()
  const newBase: FormaElement = {
    urn: createUrn("group", PROJECT_ID, newId(), newRevision()),
    properties: {
      name: "Untitled base",
      category: "group",
      component: true,
      tags: ["scenario", "base"],
      indicator: "*",
    },
  }

  const newProposal: ProposalElement = {
    ...(proposal as ProposalElement),
    urn: replaceRevision(proposal.urn),
    properties: {
      ...(proposal.properties as ProposalProperties),
      flags: { [baseKey]: { fixed: true, locked: true, scenario: true } },
    },
    children: [...(proposal.children ?? []), { key: baseKey, urn: newBase.urn }],
  }

  return { proposal: newProposal, base: newBase }
}

function getProposalAndBaseWithoutErrorSubtrees(
  rootUrn: Urn,
  elements: Map<Urn, FormaElementBox>,
  errors: MissingElementError[],
): { recoveredProposal: FormaElement; recoveredBase?: FormaElement } {
  const proposal = getInMapOrThrow(elements, rootUrn).element
  const basePath = findBasePath(proposal)
  const baseChild = findBaseChild(proposal)
  const base = baseChild && elements.get(baseChild?.urn)?.element

  // First, see if we need to filter out any subtrees with errors in the base layer
  let didFilterAnyBaseChildren = false
  const filteredBaseChildren = base?.children?.filter((child) => {
    const toplevelPath = mergePath(basePath, child.key)
    const anyErrorsOnThisToplevelPath = errors.some((e) => e.path.startsWith(toplevelPath))
    didFilterAnyBaseChildren = didFilterAnyBaseChildren || anyErrorsOnThisToplevelPath
    return !anyErrorsOnThisToplevelPath
  })

  // If so, we create a new base element with the filtered children
  const recoveredBase =
    base && didFilterAnyBaseChildren
      ? { ...base, urn: replaceRevision(base.urn), children: filteredBaseChildren }
      : undefined

  // Next, we filter the children directly on proposal with any subtree errors
  const filteredProposalChildren = proposal.children?.filter((child) => {
    const toplevelPath = mergePath(ROOT_KEY, child.key)
    const anyErrorsOnThisToplevelPath = errors.some((e) => e.path.startsWith(toplevelPath))
    // Only filter proposal subtrees that are not the base layer itself
    const isBaseChild = child.key == baseChild?.key
    return !anyErrorsOnThisToplevelPath || isBaseChild
  })

  // If a new base element was created above, we also need to swap the base URN
  const newProposalChildren = filteredProposalChildren?.map((child) => {
    if (baseChild && recoveredBase && child.key == baseChild.key) {
      return { ...child, urn: recoveredBase.urn }
    }
    return child
  })

  // Build the recovered proposal element and return
  const recoveredProposal = {
    ...proposal,
    urn: replaceRevision(proposal.urn),
    children: newProposalChildren,
  }
  return { recoveredProposal, recoveredBase }
}
