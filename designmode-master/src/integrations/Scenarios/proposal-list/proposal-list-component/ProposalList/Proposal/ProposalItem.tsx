import type { FormaElement, Urn } from "forma-elements"
import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { displayName } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/displayName"
import { captureException } from "@sentry/browser"
import type { UserWithConnectionId } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/websocketBusinessLogic"
import { ContextMenu } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/ContextMenu/ContextMenu"
import Userlist from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/UserList/UserList"
import styles from "src/integrations/Scenarios/proposal-list/proposal-list-component/styles/index.module.css"
import type { ProposalElement } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/types"
import type { Role } from "src/integrations/Scenarios/proposal-list/proposal-list-component/hooks/useProjectRole"
import { SaveToDocs } from "./SaveToDocs"
import { migrateProposalsToScenarios } from "src/integrations/Scenarios/migration/proposalMigrationUtils"
import SpinnerIcon from "src/lib/components/icons/Spinner"
import { ExpandedTooltip } from "src/lib/components/ExpandedTooltip"
import ConnectToScenarioImg from "src/integrations/Scenarios/assets/ConnectToScenario.svg"
import { useTranslator } from "src/i18n"
import { formatRelativeTime } from "src/integrations/Scenarios/utils/relativeTime"
import { ScenarioIcon } from "src/integrations/Scenarios/proposal-list/proposal-list-component/icons/ScenarioIcon"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"
import { FormaElementBox } from "src/lib/element/statebox"
import { parseUrn } from "src/lib/element/urn"
import { PROJECT_ID } from "src/core/project/project"
import { elementState } from "src/core/elements/ElementState"
import { elementContainerTreeFromObjects } from "src/core/elements/elementContainersFromObjects"
import { dispatchProposalUpdated } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/events"
import { ScenarioModelList } from "src/integrations/Scenarios/menus/ScenarioModelList"

interface ProposalProps {
  projectId: string
  proposal: ProposalElement
  scenario?: FormaElement
  activeUsers: UserWithConnectionId[]
  isActive: boolean
  isDeleteEligible: boolean
  projectRole: Role
  onClick: (e: MouseEvent) => void
  onProposalClick: (proposalUrn: Urn, revision?: string) => void
  onDeleteProposal: (urn: Urn) => Promise<void>
  onRenameProposal: (proposal: ProposalElement, newName: string) => Promise<void>
  onCreateNewProposal: (urn: Urn) => void
}

export const Proposal = ({
  projectId,
  proposal,
  activeUsers,
  projectRole,
  isActive,
  isDeleteEligible,
  onClick,
  onDeleteProposal,
  onRenameProposal,
  onCreateNewProposal,
  onProposalClick,
}: ProposalProps) => {
  const [menuOpen, setMenuOpen] = useState<[number, number] | undefined>()
  const [scenarioMenuOpen, setScenarioMenuOpen] = useState(false)
  const [saveToDocs, setSaveToDocs] = useState<boolean>(false)
  const [linkingScenario, setLinkingScenario] = useState(false)
  const t = useTranslator()

  const onMore = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    const target = (e.target as HTMLElement).getBoundingClientRect()
    setMenuOpen([target.left + 20, target.top + 2])
  }, [])

  const [name, setName] = useState<string>(proposal?.properties?.name || displayName(proposal.urn))
  const [hoveringName, setHoverName] = useState(false)

  const handleLinkProposal = async (e: MouseEvent) => {
    e.stopPropagation()
    if (proposal.properties?.scenario) {
      setScenarioMenuOpen(true)
      return
    }

    try {
      setLinkingScenario(true)
      const result = await migrateProposalsToScenarios([proposal.urn])
      setLinkingScenario(false)

      window.forma_toasts.push({
        content: {
          title: "Linked success",
          text: result.results[0].name,
        },
        autoDismiss: true,
        timeout: 10000,
      })

      dispatchProposalUpdated(parseUrn(proposal.urn).id)
      if (proposal.urn === elementState.currentProposalSignal.peek().urn) {
        try {
          const { id: proposalId } = parseUrn(proposal.urn)

          const proposalResponse = await ProposalClientV3.get(proposalId, PROJECT_ID)

          const currentRootUrn = elementState.currentSnapshot.peek().rootUrn
          if (parseUrn(currentRootUrn).id !== proposalId) {
            console.warn("Proposal has changed in the meantime")
            return
          }

          const elements = new Map(
            Array.from(proposalResponse.response.entries()).map(([urn, element]) => [
              urn,
              FormaElementBox.fromServer(element),
            ]),
          )

          elementState.updateProposal(
            elementContainerTreeFromObjects(
              proposalResponse.rootUrn,
              elements,
              {
                volumeMesh: new Map(),
                footprint: new Map(),
                terrainShape: new Map(),
                terrainTexture: new Map(),
                buildingFloors3DSketch_UNSTABLE: new Map(),
              },
              elementState.currentSnapshot.peek().elements,
            ),
          )
        } catch (error) {
          // Don't throw - server is already updated, UI will sync on reload
          console.error("Failed to refresh proposal after scenario link", error)
        }
      }
    } catch (error) {
      console.error("Linking failed", error)
      setLinkingScenario(false)
    }
  }

  useEffect(() => {
    if (proposal?.properties?.name) {
      setName(proposal?.properties?.name)
    }
  }, [proposal?.properties?.name])

  const [editingName, setEditingName] = useState<boolean>(false)
  const onDoubleClickName = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      setEditingName(true)
    },
    [setEditingName],
  )

  const nameInputField = useRef<HTMLInputElement>(null)
  const nameSpan = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (editingName) {
      nameInputField?.current?.select()
      nameInputField?.current?.focus()
    }
  }, [editingName, nameInputField])

  const renameProposal = useCallback(async () => {
    try {
      if (proposal.properties?.name !== name) {
        await onRenameProposal(proposal, name)
      }
    } catch (e) {
      captureException(e)
    }
  }, [onRenameProposal, name, proposal])

  useEffect(() => {
    if (editingName == false) {
      void renameProposal()
    }
  }, [editingName, renameProposal])

  const onBlur = useCallback((e: Event) => {
    e.stopPropagation()
    setEditingName(false)
  }, [])

  const onKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === "Enter") {
        setEditingName(false)
      }
      if (e.code === "Escape") {
        setName(proposal.properties?.name || "")
        setEditingName(false)
      }
    },
    [proposal.properties?.name],
  )

  const onNameInput = useCallback(
    (e: Event) => {
      e.stopPropagation()
      setName((e.target as HTMLInputElement).value)
    },
    [setName],
  )

  const isViewer = projectRole === "viewer"

  return (
    <div
      onContextMenu={(e: MouseEvent) => {
        e.preventDefault()
        setMenuOpen([e.clientX, e.clientY])
      }}
    >
      <div
        className={styles.proposal}
        data-proposal-urn={proposal.urn}
        onClick={(e: MouseEvent) => !hoveringName && onClick(e)}
        height={80}
        selected={isActive}
      >
        <div>
          {editingName ? (
            <input
              slot="title"
              className={styles.nameInput}
              ref={nameInputField}
              value={name}
              onKeyUp={onKeyUp}
              onInput={onNameInput}
              onBlur={onBlur}
            />
          ) : (
            <>
              <weave-tooltip slot="title" nub="down-center" text={name}>
                <h3
                  className={styles.title}
                  // eslint-disable-next-line react/no-unknown-property
                  onDblClick={(e: MouseEvent) => {
                    if (!isViewer) onDoubleClickName(e)
                  }}
                  ref={nameSpan}
                  onMouseEnter={() => setHoverName(true)}
                  onMouseLeave={() => setHoverName(false)}
                >
                  {name}
                </h3>
              </weave-tooltip>
            </>
          )}
          <p>
            {formatRelativeTime(
              proposal.metadata?.createdAt,
              t(($) => $.relativeTime.today),
              t.locale,
            )}
          </p>
        </div>
        {activeUsers.length > 0 && <Userlist users={activeUsers} />}
        <weave-tripple-dot
          slot="icon"
          style={{ marginLeft: "auto", transform: "rotate(90deg)", cursor: "pointer" }}
          onClick={onMore}
          className={styles.contextMenu}
        />
        {menuOpen && (
          <ContextMenu
            projectId={projectId}
            position={menuOpen}
            proposalUrn={proposal.urn}
            close={() => setMenuOpen(undefined)}
            onDeleteProposal={onDeleteProposal}
            isDeleteEligible={isDeleteEligible}
            onStartRename={() => setEditingName(true)}
            onCreateNewProposal={onCreateNewProposal}
            onProposalClick={onProposalClick}
            isViewer={isViewer}
            setSaveToDocs={setSaveToDocs}
          />
        )}
        <>
          <button
            onClick={(e) => {
              void handleLinkProposal(e)
            }}
            data-has-scenario={!!proposal.properties?.scenario}
            data-linking-scenario={linkingScenario}
            className={styles.scenarioButton}
            id={`connect-to-scenario-${proposal.urn}`}
            key={`connect-to-scenario-${proposal.urn}`}
            disabled={linkingScenario}
          >
            {linkingScenario ? <SpinnerIcon /> : <ScenarioIcon />}
          </button>
          {!proposal.properties?.scenario && (
            <ExpandedTooltip
              title={(t) => t(($) => $.scenarios.proposals.connectToScenario)}
              icon={
                <img
                  src={ConnectToScenarioImg}
                  alt={t(($) => $.building.lineBuilding.releaseToBasicAnimationAlt)}
                  loading="lazy"
                  style={"width: 100%"}
                />
              }
              bodyText={(t) => t(($) => $.scenarios.proposals.connectToScenarioDesc)}
              target={`connect-to-scenario-${proposal.urn}`}
              position="right"
            />
          )}
          {proposal.properties?.scenario && (
            <ScenarioModelList
              open={scenarioMenuOpen}
              onClickOutside={() => setScenarioMenuOpen(false)}
              scenarioData={{
                projectId: proposal.properties.scenario.accProjectId,
                fileLineageUrn: proposal.properties.scenario.fileUrn,
                fileVersionUrn: proposal.properties.scenario.fileUrn,
                scenarioId: proposal.properties.scenario.scenarioId,
              }}
            />
          )}
        </>
      </div>
      {saveToDocs && (
        <SaveToDocs
          proposalUrn={proposal.urn}
          filename={proposal.properties?.name || ""}
          setSaveToDocs={setSaveToDocs}
        />
      )}
    </div>
  )
}
