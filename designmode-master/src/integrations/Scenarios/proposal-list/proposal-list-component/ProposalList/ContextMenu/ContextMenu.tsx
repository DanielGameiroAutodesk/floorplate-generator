import type { Urn } from "forma-elements"
import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { exportProposal } from "src/integrations/Scenarios/proposal-list/proposal-list-component/services/Export"
import { createDuplicateProposal } from "src/integrations/Scenarios/proposal-list/proposal-list-component/services/ProposalElements"
import {
  downloadRevitAddIn,
  editInRevit,
} from "src/integrations/Scenarios/proposal-list/proposal-list-component/services/RevitIntegration"
import analytics from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/analytics"
import { captureException } from "@sentry/browser"
import { ClickOutside } from "src/lib/components/ClickOutside"
import { parseUrn } from "src/lib/element/urn"
import { downloadIfcFile } from "src/integrations/Scenarios/proposal-list/proposal-list-component/services/IfcDownload"
import { getTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

type ContextMenuProps = {
  projectId: string
  proposalUrn: Urn
  close: () => void
  position: number[]
  isDeleteEligible: boolean
  onDeleteProposal: (urn: Urn) => Promise<void>
  onStartRename: () => void
  onCreateNewProposal: (urn: Urn) => void
  onProposalClick: (proposalUrn: Urn, revision?: string) => void
  isViewer: boolean
  setSaveToDocs: (state: boolean) => void
}

export function ContextMenu({
  projectId,
  proposalUrn,
  close,
  position,
  isDeleteEligible,
  onDeleteProposal,
  onStartRename,
  onCreateNewProposal,
  onProposalClick,
  isViewer,
  setSaveToDocs,
}: ContextMenuProps) {
  const contextContainer = useRef<HTMLDivElement>(null)
  // const [top, setTop] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // setTop(contextContainer.current.getBoundingClientRect().top)
    setVisible(true)
  }, [])

  const deleteProposal = async (proposalUrn: Urn, projectId: string) => {
    try {
      await onDeleteProposal(proposalUrn)
      analytics.track(projectId, "Proposal - Delete")
    } catch (e) {
      captureException(e)
    }
  }

  const onProposalHistoryClick = useCallback(() => {
    analytics.track(projectId, "Proposal - Show proposal history")
    onProposalClick(proposalUrn, parseUrn(proposalUrn).revision)
  }, [onProposalClick, proposalUrn, projectId])

  return (
    <div ref={contextContainer}>
      <div style={{ display: visible ? "inherit" : "none" }}>
        <ClickOutside onClickOutside={close} useCapture>
          <forma-context-menu-container
            left={position[0]}
            top={position[1]}
            className="ProposalMenu"
            style={{ left: position[0], top: position[1] }}
          >
            <forma-context-menu className="ContextMenu">
              <div>
                <forma-context-menu-item
                  text={getTranslator()(($) => $.contextMenu.showProposalHistoryMenuItem)}
                  onClick={(e) => {
                    e.stopPropagation()
                    onProposalHistoryClick()
                    close()
                  }}
                />
              </div>
              {!isViewer && (
                <>
                  <forma-context-menu-item
                    text={getTranslator()(($) => $.contextMenu.renameMenuItem)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onStartRename()
                      analytics.track(projectId, "Proposal - Rename")
                      close()
                    }}
                  />
                  <forma-context-menu-item
                    text={getTranslator()(($) => $.contextMenu.duplicateMenuItem)}
                    onClick={(e) => {
                      e.stopPropagation()
                      void (async () => {
                        try {
                          const proposal = await createDuplicateProposal(proposalUrn)
                          if (proposal) {
                            onCreateNewProposal(proposal.urn)
                            analytics.track(projectId, "Proposal - Duplicate")
                          }
                        } catch (e) {
                          captureException(e)
                        }
                        close()
                      })()
                    }}
                  />
                  <forma-context-menu-item
                    text={getTranslator()(($) => $.contextMenu.deleteMenuItem)}
                    disabled={!isDeleteEligible}
                    onClick={(e) => {
                      if (isDeleteEligible) {
                        e.stopPropagation()
                        if (confirm(getTranslator()(($) => $.confirmDialog.deleteProposalMessage))) {
                          void deleteProposal(proposalUrn, projectId)
                        }
                        close()
                      }
                    }}
                  />
                  <forma-context-menu-divider />
                  <forma-context-menu-sub-menu text={getTranslator()(($) => $.contextMenu.revitSubmenu)}>
                    <forma-context-menu-item
                      text={getTranslator()(($) => $.contextMenu.revitSendToBetaMenuItem)}
                      onClick={(e) => {
                        e.stopPropagation()
                        void (async () => {
                          try {
                            await editInRevit(projectId, proposalUrn)
                            analytics.track(projectId, "Proposal - Send to Revit")
                          } catch (e) {
                            captureException(e)
                          }
                        })()
                        close()
                      }}
                    />
                    <forma-context-menu-item
                      text={getTranslator()(($) => $.contextMenu.revitDownloadAddinMenuItem)}
                      onClick={() => {
                        analytics.track(projectId, "Proposal - Download Addin")
                        downloadRevitAddIn()
                      }}
                    />
                  </forma-context-menu-sub-menu>
                  <forma-context-menu-divider />
                  <forma-context-menu-sub-menu text={getTranslator()(($) => $.contextMenu.exportSubmenu)}>
                    <forma-context-menu-item
                      text={getTranslator()(($) => $.contextMenu.exportAsObjMenuItem)}
                      onClick={(e) => {
                        e.stopPropagation()
                        close()
                        void (async () => {
                          try {
                            await exportProposal(projectId, proposalUrn)
                            analytics.track(projectId, "Export")
                          } catch (e) {
                            captureException(e)
                          }
                        })()
                      }}
                    />
                    <forma-context-menu-item
                      text={getTranslator()(($) => $.contextMenu.exportAsIfcToDocs)}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSaveToDocs(true)
                        close()
                      }}
                    />
                    <forma-context-menu-item
                      text={getTranslator()(($) => $.contextMenu.exportAsIfcBetaMenuItem)}
                      onClick={(e) => {
                        e.stopPropagation()
                        close()
                        void (async () => {
                          await downloadIfcFile(projectId, proposalUrn)
                          analytics.track(projectId, "Proposal - Download IFC")
                        })()
                      }}
                    />
                  </forma-context-menu-sub-menu>
                </>
              )}
            </forma-context-menu>
          </forma-context-menu-container>
        </ClickOutside>
      </div>
    </div>
  )
}
