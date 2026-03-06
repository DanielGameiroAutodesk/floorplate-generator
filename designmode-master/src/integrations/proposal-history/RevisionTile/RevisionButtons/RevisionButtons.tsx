import VerticalThreeDotIcon from "src/lib/components/icons/VerticalThreeDotIcon/VerticalThreeDotIcon"
import { useState } from "preact/hooks"
import type { Revision } from "src/integrations/proposal-history/utils/identifyPeriodsAlgorithm"
import styles from "src/integrations/proposal-history/RevisionTile/RevisionTile.module.pcss"
import combineClasses from "src/lib/combineClasses"
import PinButton from "./PinButton"
import BranchMenuItem from "./BranchMenuItem"
import { ClickOutside } from "src/lib/components/ClickOutside"
import getUrlToRevision from "src/integrations/proposal-history/utils/getUrlToRevision"
import type { Urn } from "@spacemakerai/element-types"
import type { RevisionMetadata, RevisionMetadataBody } from "src/core/proposal-element-system/ProposalClient"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { useTranslator } from "src/i18n"

type MenuPosition = {
  top: number
}

type RevisionButtonsProps = {
  revision: Revision
  revisionMetadata?: RevisionMetadata
  addRevisionMetadata: (revisionUrn: Urn, body: RevisionMetadataBody) => void
  onRename: () => void
}

export default function RevisionButtons({
  revision,
  revisionMetadata,
  addRevisionMetadata,
  onRename,
}: RevisionButtonsProps) {
  const t = useTranslator()
  const isDisabled = editAccessLevelSignal.value !== "edit"

  const [showMenu, setShowMenu] = useState<MenuPosition | null>(null)
  const isPinned = !!revisionMetadata?.pinnedBy

  const pinVersion = () => {
    addRevisionMetadata(revision.urn, { ...revisionMetadata, pinnedBy: revision.user })
  }

  const unpinVersion = () => {
    addRevisionMetadata(revision.urn, { ...revisionMetadata, pinnedBy: undefined })
  }

  return (
    <div className={styles.ButtonsWrapper}>
      <div className={combineClasses([styles.PinButton], { [styles.PinnedButton]: isPinned })}>
        <PinButton disabled={isDisabled} isPinned={isPinned} pinVersion={pinVersion} unpinVersion={unpinVersion} />
      </div>
      <div className={styles.MenuButton}>
        <weave-icon-button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu((current) => {
              if (current) return null
              return {
                top: e.currentTarget.getBoundingClientRect().top,
              }
            })
          }}
        >
          <VerticalThreeDotIcon />
        </weave-icon-button>
      </div>
      {showMenu && (
        <ClickOutside onClickOutside={() => setShowMenu(null)}>
          <forma-context-menu-container top={showMenu.top}>
            <forma-context-menu>
              {!isDisabled && (
                <>
                  <BranchMenuItem revisionUrn={revision.urn} />
                  <forma-context-menu-divider />
                  <forma-context-menu-item
                    text={t(($) => $.proposalHistory.nameThisVersionAction)}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(null)
                      onRename()
                    }}
                  />
                  <forma-context-menu-item
                    text={
                      isPinned
                        ? t(($) => $.proposalHistory.unpinVersionAction)
                        : t(($) => $.proposalHistory.pinVersionAction)
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      isPinned ? unpinVersion() : pinVersion()
                      setShowMenu(null)
                    }}
                  />
                  <forma-context-menu-divider />
                </>
              )}
              <forma-context-menu-item
                text={t(($) => $.proposalHistory.copyLinkButton)}
                onClick={(e) => {
                  async function run() {
                    e.stopPropagation()
                    const { time, url } = getUrlToRevision(revision)
                    setShowMenu(null)

                    await navigator.clipboard.writeText(url)
                    window.forma_toasts.push({
                      content: t(($) => $.proposalHistory.linkToVersionCopied, { time }),
                      status: "success",
                    })
                  }
                  void run()
                }}
              />
            </forma-context-menu>
          </forma-context-menu-container>
        </ClickOutside>
      )}
    </div>
  )
}
