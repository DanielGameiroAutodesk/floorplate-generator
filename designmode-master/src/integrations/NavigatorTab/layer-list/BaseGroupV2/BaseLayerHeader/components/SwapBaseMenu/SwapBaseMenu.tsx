import { parseUrn } from "src/lib/element/urn"
import { ClickOutside } from "src/lib/components/ClickOutside2"
import { BaseLayerIndicator } from "src/integrations/NavigatorTab/layer-list/BaseGroupV2/BaseLayerHeader/components/BaseLayerIndicator/BaseLayerIndicator"
import styles from "./SwapBaseMenu.module.pcss"
import useBaseUtils from "src/core/useBaseUtils"
import { useState } from "react"
import { useEffect, useRef } from "preact/hooks"
import { useTranslator } from "src/i18n"

function LoadingRows() {
  const session = sessionStorage.getItem("forma-designmode-prev-num-bases")
  const numRows = session ? parseInt(session) : 1
  return (
    <>
      {[...Array(numRows)].map((r) => (
        <weave-menu-item key={r} disabled={true} nocheck={true}>
          <div className={styles.SwapBaseMenuRow} style={{ height: "24px" }}>
            <weave-skeleton-item radius="50%" width="16px" height="6px" />
            <weave-skeleton-item radius="6px" width="140px" height="6px" />
          </div>
        </weave-menu-item>
      ))}
    </>
  )
}

export function SwapBaseMenu({
  closeMenus,
  setLoading,
  setIsEditingName,
}: {
  closeMenus: () => void
  setIsEditingName: (editing: boolean) => void
  setLoading: (loading: boolean) => void
}) {
  const t = useTranslator()
  const { bases, swapBase, isFetching, isCurrentBase, addBase, deleteBase, duplicateBase } = useBaseUtils()
  const ref = useRef<HTMLDivElement>(null)
  const [topPos, setTopPos] = useState(-15)

  /* Hack to close other submenus when opening a submenu from another row*/
  const [activeMenuIndex, setActiveMenuIndex] = useState(-1)

  /* Reposition menu when bottom overflows */
  useEffect(() => {
    if (!ref.current) return
    const menuRect = ref.current.getBoundingClientRect()
    if (menuRect.bottom > document.body.clientHeight) {
      setTopPos(-30 - menuRect.height)
    }
  }, [ref])

  return (
    <ClickOutside onClickOutside={closeMenus}>
      <weave-menu
        title={t(($) => $.base.swapBaseButton)}
        open={true}
        left={15}
        top={topPos}
        noedit={true}
        onContextMenu={(e) => e.preventDefault()}
        minwidth={260}
        maxwidth={260}
      >
        <weave-tooltip text={t(($) => $.base.addNewBaseButton)} slot="headericons">
          <weave-icon-button
            onClick={() => {
              closeMenus()
              addBase()
              setIsEditingName(true)
            }}
          >
            <weave-solid-slim-plus-operator slot="icon"></weave-solid-slim-plus-operator>
          </weave-icon-button>
        </weave-tooltip>
        <div ref={ref}>
          {isFetching && <LoadingRows />}
          {!isFetching &&
            bases
              .sort((a, b) => (parseUrn(a.urn).revision < parseUrn(b.urn).revision ? -1 : 1))
              .map((base, i) => (
                <weave-menu-item
                  key={parseUrn(base.urn).id}
                  selected={isCurrentBase(base)}
                  nocheck={true}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    setActiveMenuIndex(i)
                    e.stopPropagation()
                  }}
                >
                  <div
                    className={styles.SwapBaseMenuRow}
                    onClick={() => {
                      setLoading(true)
                      closeMenus()
                      void swapBase(base).then(() => {
                        setLoading(false)
                      })
                    }}
                  >
                    <BaseLayerIndicator base={base} />
                    <span>{base.properties?.name || t(($) => $.base.untitledBaseLabel)}</span>
                  </div>
                  <weave-menu-sub nochecks top="10" slot="submenu">
                    {/* Hack to close other submenus when opening a submenu from another row*/}
                    {activeMenuIndex === i && (
                      <>
                        <weave-menu-item
                          nocheck
                          disabled={isCurrentBase(base) || bases.length === 1}
                          onClick={() => {
                            if (
                              !confirm(
                                t(($) => $.navigator.base.deleteConfirmation, { name: base?.properties?.name ?? "" }),
                              )
                            )
                              return
                            setLoading(true)
                            void deleteBase(base).then(() => {
                              setLoading(false)
                            })
                            setActiveMenuIndex(-1)
                          }}
                        >
                          {t(($) => $.ui.delete)}
                        </weave-menu-item>
                        <weave-menu-item
                          nocheck
                          onClick={() => {
                            setLoading(true)
                            closeMenus()
                            void duplicateBase(base).then((duplicatedBase) => {
                              if (duplicatedBase) {
                                void swapBase(duplicatedBase).then(() => {
                                  setLoading(false)
                                  setIsEditingName(true)
                                })
                              } else {
                                setLoading(false)
                              }
                              setActiveMenuIndex(-1)
                            })
                          }}
                        >
                          {t(($) => $.ui.duplicate)}
                        </weave-menu-item>
                        <weave-menu-item
                          nocheck
                          disabled={!isCurrentBase(base)}
                          onClick={() => {
                            closeMenus()
                            setIsEditingName(true)
                          }}
                        >
                          {t(($) => $.ui.rename)}
                        </weave-menu-item>
                      </>
                    )}
                  </weave-menu-sub>
                </weave-menu-item>
              ))}
        </div>
      </weave-menu>
    </ClickOutside>
  )
}
