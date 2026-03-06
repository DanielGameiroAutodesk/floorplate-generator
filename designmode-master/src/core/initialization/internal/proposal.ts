import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import { getRepresentationsByUrn } from "src/core/elements-loading/loading"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"

import { Matrix4 } from "three"
import { getElementsWithChildren } from "src/core/elements-loading/elementFetching"
import { isReadonlyRegardlessOfInitializationSignal } from "src/core/edit-access-state"
import { validateState } from "src/core/elements/validation/element-validation/validate"
import { PROJECT_ID } from "src/core/project/project"
import { parseUrn } from "src/lib/element/urn"

import { createElementSnapshot, initializeElementStateForRecovery } from "./element-state"
import { findBaseChild } from "src/lib/element/base"
import { captureMessage } from "@sentry/browser"
import type { FormaElementBox } from "src/lib/element/statebox"
import { createElementBoxMapFromServerElements } from "src/lib/element/statebox"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"
import { getInMapOrThrow, mergeMaps } from "src/lib/map"
import { signal } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { clearPendingTerrainUpdate, getPendingTerrainUpdate, getTerrainContainer, updateTerrain } from "./terrain"
import { refreshComponentsInBackground } from "./components"
import { Proposal, type ProposalElement } from "src/core/elements/Proposal"
import { getTranslator } from "src/i18n"

type ElementsData = {
  rootUrn: Urn
  elements: Map<Urn, FormaElementBox>
}

function getProposalChildrenUrns(proposal: FormaElement): Set<Urn> {
  return new Set(proposal.children?.map((child) => child.urn) ?? [])
}

function flattenChildren(group: Child, groupElement: FormaElement) {
  return (groupElement.children || []).map((child) => {
    if (group.transform) {
      if (child.transform) {
        const transform = new Matrix4()
          .fromArray(group.transform)
          .multiply(new Matrix4().fromArray(child.transform))
          .toArray()
        return { ...child, transform }
      } else {
        return { ...child, transform: group.transform }
      }
    }
    return child
  })
}

// TODO: Is this still needed?
function explodeGroupsIfNecessaryMutatingProposal({ rootUrn, elements }: ElementsData) {
  const proposal = getInMapOrThrow(elements, rootUrn).element as ProposalElement
  const flags = proposal.properties?.flags || {}
  const nonScenarioGroup = (c: Child) =>
    elements.get(c.urn)?.element.properties?.category === "group" && !flags[c.key]?.scenario
  const nonScenarioGroups = proposal.children?.filter(nonScenarioGroup)
  const scenario = findBaseChild(proposal)
  const groupsOnScenario =
    scenario &&
    elements
      .get(scenario.urn)
      ?.element.children?.filter((c) => elements.get(c.urn)?.element.properties?.category === "group")

  if ((nonScenarioGroups && nonScenarioGroups.length > 0) || (groupsOnScenario && groupsOnScenario.length > 0)) {
    // Log this to Sentry so we can track if this is still happening/needed for todays active proposals.
    captureMessage("Legacy groups detected", {
      level: "warning",
    })
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.proposal.errors.flatteningGroups),
      status: "warning",
    })
    proposal.children = proposal.children?.flatMap((child) => {
      if (nonScenarioGroup(child)) {
        return flattenChildren(child, getInMapOrThrow(elements, child.urn).element)
      } else if (scenario && child.urn === scenario.urn) {
        const scenarioElement = getInMapOrThrow(elements, child.urn).element
        if (scenarioElement.children) {
          scenarioElement.children = scenarioElement.children.flatMap((schild) => {
            return flattenChildren(schild, getInMapOrThrow(elements, schild.urn).element)
          })
        }
        return child
      } else {
        return child
      }
    })
  }
}

export const proposalFreshLoadSignal = signal<
  | {
      executionId: symbol
      proposalId: string
      revision: string | undefined
      completed: boolean
    }
  | undefined
>(undefined)

function isProposalFreshLoadSuperseeded(executionId: symbol) {
  return proposalFreshLoadSignal.peek()?.executionId !== executionId
}

function setProposalFreshLoadComplete(executionId: symbol) {
  if (isProposalFreshLoadSuperseeded(executionId)) return
  void refreshComponentsInBackground()
  proposalFreshLoadSignal.value = {
    ...proposalFreshLoadSignal.peek()!,
    completed: true,
  }
}

// (!) Be aware of async boundaries during this method invocation and what state is operated on when.
async function refreshProposalInBackground(loadingId: symbol, proposalUrn: Urn) {
  console.log("Checking for newer proposal")

  const { id: proposalId, revision: previousRevision } = parseUrn(proposalUrn)
  const { proposal } = await ProposalClientV3.get(proposalId, PROJECT_ID, undefined)

  if (isProposalFreshLoadSuperseeded(loadingId)) {
    return
  }

  const latestRevision = parseUrn(proposal.urn).revision
  if (latestRevision === previousRevision) {
    setProposalFreshLoadComplete(loadingId)
    return
  }

  void bootstrapProposal(loadingId, proposal, { isProposalFresh: true })
}

export async function bootstrapProposal(
  loadingId: symbol,
  proposal: ProposalElement,
  options: {
    isProposalFresh: boolean
  },
) {
  const prevSnapshot = elementState.currentSnapshotOrUndefinedSignal.peek()
  const knownElementsDeep = mergeMaps<Urn, FormaElementBox>(
    createElementBoxMapFromServerElements(proposal),
    prevSnapshot?.getFormaElementBoxes() ?? new Map([]),
  )
  const unknownUrns = Array.from(getProposalChildrenUrns(proposal)).filter((urn) => !knownElementsDeep.has(urn))
  const loadedElementsDeep = await getElementsWithChildren(unknownUrns)
  const isInScenario = !!proposal.properties.scenario

  if (isProposalFreshLoadSuperseeded(loadingId)) {
    return
  }

  const state: ElementsData = {
    rootUrn: proposal.urn,
    elements: mergeMaps(knownElementsDeep, loadedElementsDeep),
  }

  const pendingTerrainUpdate = getPendingTerrainUpdate()

  // TODO: Shouldn't this generate a new root URN?
  explodeGroupsIfNecessaryMutatingProposal(state)

  const errors = validateState(state.rootUrn, bindFormaElementLookupForBoxMap(state.elements))

  const newElements = prevSnapshot
    ? new Map(Array.from(state.elements).filter(([urn]) => !prevSnapshot.elements.has(urn)))
    : state.elements
  const representations = await getRepresentationsByUrn(bindFormaElementLookupForBoxMap(newElements))

  const terrainContainer = await getTerrainContainer(
    state.rootUrn,
    bindFormaElementLookupForBoxMap(state.elements),
    prevSnapshot,
  )

  if (!terrainContainer && !isInScenario) {
    throw new Error("No terrain element in proposal")
  }

  if (isProposalFreshLoadSuperseeded(loadingId)) {
    return
  }

  if (errors.length > 0) {
    initializeElementStateForRecovery(
      state.rootUrn,
      state.elements,
      representations,
      terrainContainer,
      prevSnapshot,
      errors,
    )
  } else {
    let snapshot = createElementSnapshot(state.rootUrn, state.elements, representations, terrainContainer, prevSnapshot)

    if (!isReadonlyRegardlessOfInitializationSignal.peek() && pendingTerrainUpdate) {
      snapshot = await updateTerrain(Proposal.of(snapshot), pendingTerrainUpdate)
      clearPendingTerrainUpdate()
    }

    if (isProposalFreshLoadSuperseeded(loadingId)) {
      return
    }

    elementState.reset(snapshot)
  }

  if (options.isProposalFresh) {
    setProposalFreshLoadComplete(loadingId)
  } else {
    void refreshProposalInBackground(loadingId, state.rootUrn)
  }
}
