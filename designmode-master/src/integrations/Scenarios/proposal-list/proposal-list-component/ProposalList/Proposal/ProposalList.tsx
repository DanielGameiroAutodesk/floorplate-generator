import type { Urn } from "forma-elements"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import ProjectIdContext from "src/integrations/Scenarios/proposal-list/proposal-list-component/Context/ProjectIdContext"
import * as ProposalElements from "src/integrations/Scenarios/proposal-list/proposal-list-component/services/ProposalElements"
import { captureException } from "@sentry/browser"
import { parseUrn } from "src/lib/element/urn"
import { CreateProposal } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/CreateProposal/CreateProposal"
import ProposalFilter from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/ProposalFilter/ProposalFilter"
import { getScenario } from "./utils"
import styles from "src/integrations/Scenarios/proposal-list/proposal-list-component/styles/index.module.css"
import { Proposal } from "./ProposalItem"
import type { ProposalElement } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/types"
import { useFilter } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/useFilter"
import { useProposals } from "src/integrations/Scenarios/proposal-list/proposal-list-component/hooks/useProposals"
import { useScenarios } from "src/integrations/Scenarios/proposal-list/proposal-list-component/hooks/useScenarios"
import { useActiveConnections } from "src/integrations/Scenarios/proposal-list/proposal-list-component/hooks/useActiveConnections"
import ErrorIcon from "src/integrations/Scenarios/proposal-list/proposal-list-component/icons/ErrorIcon"
import { FormaProposalListSkeleton } from "src/integrations/Scenarios/proposal-list/proposal-list-component/Skeleton/ProposalListSkeleton"
import { useProjectRole } from "src/integrations/Scenarios/proposal-list/proposal-list-component/hooks/useProjectRole"
import { PROPOSALS_UPDATED } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/events"
import CompareSelector, {
  CompareButton,
  LeftArrowButton,
} from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/CompareSelector/CompareSelector"
import { useSort } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/useSort"
import { SortOption } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/ProposalFilter/SortOptions"
import { getTranslator, useTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

type ProposalListProps = {
  projectid: string
  proposalelementid?: Urn | string
  onproposalclick?: (urn: Urn, revision?: string) => void | string
  createproposaldisabled?: string
  clientId?: string
}

enum Mode {
  SELECT = "select",
  COMPARE = "compare",
}

export const ProposalList = ({
  projectid: projectId,
  proposalelementid: proposalElementId,
  createproposaldisabled,
  onproposalclick,
  clientId,
}: ProposalListProps) => {
  const t = useTranslator()
  const [storedFilter, setStoredFilter] = useFilter(projectId)
  const [proposalFilter, setProposalFilter] = useState<Set<Urn>>(storedFilter || new Set())
  const [sortBy, setSortBy] = useSort(projectId)

  const { proposalState, refetchProposals, updateProposals, deleteProposal } = useProposals(projectId)
  const scenarios = useScenarios(projectId)
  const activeConnections = useActiveConnections(proposalElementId)
  const projectRole = useProjectRole(projectId)
  const [mode, setMode] = useState<Mode>(Mode.SELECT)

  useEffect(() => {
    const refetch = () => {
      refetchProposals()
    }

    window.addEventListener(PROPOSALS_UPDATED, refetch)
    return () => {
      window.removeEventListener(PROPOSALS_UPDATED, refetch)
    }
  }, [refetchProposals])

  const onProposalClick = useCallback(
    (proposalUrn: Urn, revision?: string) => {
      if (!onproposalclick) return
      if (typeof onproposalclick === "string") {
        // @ts-expect-error: TODO: Cleanup this way?
        window[onproposalclick](proposalUrn, revision)
      } else {
        onproposalclick(proposalUrn, revision)
      }
    },
    [onproposalclick],
  )

  const onCreateNewProposal = useCallback(
    (proposalUrn: Urn) => {
      refetchProposals()
      onproposalclick?.(proposalUrn)
    },
    [onproposalclick, refetchProposals],
  )

  const onClick = useCallback(
    (event: MouseEvent) => {
      const targetItem = (event.target as HTMLElement).closest("div > div") as HTMLElement
      const newProposalUrn = targetItem.dataset.proposalUrn as Urn

      if (
        !event.target?.dispatchEvent(
          new CustomEvent("ProposalClick", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: newProposalUrn,
          }),
        )
      ) {
        // Event was cancelled by event.preventDefault();
        return false
      }

      if (parseUrn(newProposalUrn).id !== proposalElementId) {
        onProposalClick(newProposalUrn)
      }
    },
    [proposalElementId, onProposalClick],
  )

  const onRenameProposal = useCallback(
    async (proposal: ProposalElement, newName: string) => {
      try {
        const proposals = await ProposalElements.getProposals(projectId)

        const nameExists = proposals.find(({ properties }) => properties?.name === newName)
        let name = newName

        if (nameExists) {
          const m = name.match("(.*) (([0-9]+))?$")
          if (m) {
            const [, baseName, , digit] = m
            if (digit) {
              name = `${baseName} ${parseInt(digit, 10) + 1}`
            } else {
              name = `${baseName} 1`
            }
          } else {
            name = `${name} 1`
          }
          window.forma_toasts.push({
            status: "warning",
            content: getTranslator()(($) => $.toast.proposalRenamedWarning, { name }),
          })
        }

        const response = await ProposalElements.renameProposal(proposal, name, clientId)
        const { id } = parseUrn(proposal.urn)

        const foundKey = Object.keys(response).find((urn) => parseUrn(urn as Urn).id === id)
        const newRevision = foundKey ? response[foundKey] : undefined
        if (!newRevision) {
          throw new Error("Element missing from response")
        }
        updateProposals([newRevision])
      } catch (error) {
        captureException(error)
      }
    },
    [projectId, clientId, updateProposals],
  )

  const onDeleteProposal = useCallback(
    async (urn: Urn) => {
      try {
        await ProposalElements.deleteProposal(urn)

        deleteProposal(urn)

        if (proposalElementId === parseUrn(urn).id) {
          if (proposalState.status === "success") {
            const firstOtherProposal = proposalState.data.find(({ urn }) => parseUrn(urn).id !== proposalElementId)
            if (firstOtherProposal) {
              onProposalClick(firstOtherProposal.urn)
            }
          }
        }
      } catch (error) {
        captureException(error)
      }
    },
    [deleteProposal, onProposalClick, proposalElementId, proposalState],
  )

  const matchesFilter = useCallback(
    (proposal: ProposalElement) => {
      const filterElementIds = Array.from(proposalFilter)
        .map(parseUrn)
        .map(({ id }) => id)

      if (filterElementIds.length && proposal.properties) {
        const markedAsBase = Object.entries(proposal.properties.flags).find(([, flags]) => flags?.scenario)
        const baseComponentKey = markedAsBase?.[0]
        const baseComponent = proposal.children?.find((child) => child.key === baseComponentKey)

        if (baseComponent) {
          return filterElementIds.includes(parseUrn(baseComponent.urn).id)
        }
        return false
      }
      return true
    },
    [proposalFilter],
  )

  const sortedProposals = useMemo(() => {
    if (proposalState.status !== "success") return []

    const proposals = [...proposalState.data]
    switch (sortBy) {
      case SortOption.A_Z:
        return proposals.sort((a, b) => {
          const nameA = a.properties?.name || ""
          const nameB = b.properties?.name || ""
          return nameA.localeCompare(nameB)
        })
      case SortOption.Z_A:
        return proposals.sort((a, b) => {
          const nameA = a.properties?.name || ""
          const nameB = b.properties?.name || ""
          return nameB.localeCompare(nameA)
        })
      case SortOption.EDITED:
      default:
        return proposals.sort((a, b) => parseInt(parseUrn(b.urn).revision, 10) - parseInt(parseUrn(a.urn).revision, 10))
    }
  }, [proposalState, sortBy])

  const proposalsMatchingFilter = sortedProposals.filter(matchesFilter)

  if (proposalState.status === "error") {
    return (
      <div className={styles.emptyList}>
        <ErrorIcon />
        <div className={styles.emptyListDescription}>{t(($) => $.error.couldNotLoadProposals)}</div>
        <weave-button variant={"outlined"} onClick={refetchProposals}>
          {t(($) => $.error.retryButton)}
        </weave-button>
      </div>
    )
  }

  if (proposalState.status === "fetching" || projectRole.status === "fetching") {
    return <FormaProposalListSkeleton />
  }

  return (
    <>
      <ProjectIdContext.Provider value={projectId}>
        <div className={styles.wrapper}>
          <div className={styles.header}>
            {mode == Mode.SELECT ? (
              <h2 className={styles.proposalHeader}>{t(($) => $.proposalList.headerText)}</h2>
            ) : (
              <>
                <LeftArrowButton onClick={() => setMode(Mode.SELECT)} />
                <h2 className={styles.proposalHeader}>{t(($) => $.compareMode.headerText)}</h2>
              </>
            )}

            <div className={styles.proposalGroup}>
              {mode == Mode.SELECT && (
                <CompareButton
                  tooltipText={
                    proposalsMatchingFilter.length < 2
                      ? t(($) => $.proposalList.createAnotherToCompare)
                      : t(($) => $.proposalList.selectProposalsToCompare)
                  }
                  disabled={proposalsMatchingFilter.length < 2}
                  onClick={() => setMode(Mode.COMPARE)}
                />
              )}
              {mode == Mode.SELECT && (
                <ProposalFilter
                  proposalFilter={proposalFilter}
                  scenarios={scenarios.status === "success" ? scenarios.data : []}
                  setProposalFilter={setProposalFilter}
                  setStoredFilter={setStoredFilter}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                />
              )}
              {projectRole.role !== "viewer" && mode == Mode.SELECT && (
                <CreateProposal
                  projectId={projectId}
                  proposalElementId={proposalElementId}
                  onCreateNewProposal={onCreateNewProposal}
                  disabled={createproposaldisabled !== undefined}
                />
              )}
            </div>
          </div>
          {mode == Mode.SELECT && (
            <div className={styles.sortSectionHeader}>
              {sortBy === SortOption.EDITED && t(($) => $.sortOptions.lastEdited)}
              {sortBy === SortOption.A_Z && t(($) => $.sortOptions.alphabeticalAscending)}
              {sortBy === SortOption.Z_A && t(($) => $.sortOptions.alphabeticalDescending)}
            </div>
          )}
          {mode == Mode.SELECT ? (
            <div className={styles.proposalList}>
              {proposalsMatchingFilter.map((proposal) => (
                <Proposal
                  key={`proposal-item-${proposal.urn}`}
                  activeUsers={activeConnections
                    .filter(({ payload }) => parseUrn(proposal.urn).id === payload?.proposalId)
                    .map(({ user, id }) => {
                      return {
                        ...user,
                        connectionId: id,
                      }
                    })}
                  projectId={projectId}
                  onClick={onClick}
                  onProposalClick={onProposalClick}
                  proposal={proposal}
                  projectRole={projectRole.role}
                  scenario={getScenario(proposal, scenarios.status === "success" ? scenarios.data : [])}
                  isActive={proposalElementId === parseUrn(proposal.urn).id}
                  isDeleteEligible={proposalState.data.length > 1}
                  onDeleteProposal={onDeleteProposal}
                  onRenameProposal={onRenameProposal}
                  onCreateNewProposal={onCreateNewProposal}
                />
              ))}
            </div>
          ) : (
            <CompareSelector
              proposals={proposalsMatchingFilter}
              projectId={projectId}
              selectedProposalUrn={
                proposalsMatchingFilter.find((proposal) => parseUrn(proposal.urn).id === proposalElementId)?.urn
              }
            />
          )}
        </div>
      </ProjectIdContext.Provider>
    </>
  )
}
