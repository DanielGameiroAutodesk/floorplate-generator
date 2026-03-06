import styles from "src/integrations/NavigatorTab/layer-list/Layer/Category.module.pcss"
import type { FormaElement } from "@spacemakerai/element-types"
import { BaseLayerHeaderButtons } from "./components/BaseLayerHeaderButtons/BaseLayerHeaderButtons"
import { useState } from "preact/hooks"
import { useCallback } from "preact/compat"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { SwapBaseMenu } from "./components/SwapBaseMenu/SwapBaseMenu"
import BaseContextMenu from "./components/BaseContextMenu"
import BaseLayerName from "./components/BaseLayerName"

export default function BaseLayerHeader({
  base,
  onCollapseToggle,
}: {
  base: FormaElement
  onCollapseToggle: () => void
}) {
  const [showSwapBaseMenu, setShowSwapBaseMenu] = useState(false)
  const [rightClickMenuPos, setContextMenuPos] = useState<undefined | { x: number; y: number }>(undefined)
  const editAccess = canEditProposalSignal.value
  const [isLoading, setIsLoading] = useState(false)

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingIndicator, setIsEditingIndicator] = useState(false)

  const openContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      if (editAccess) {
        setContextMenuPos({ x: e.clientX, y: e.clientY })
        setShowSwapBaseMenu(false)
      }
    },
    [editAccess],
  )

  const openSwapMenu = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      if (editAccess) {
        setShowSwapBaseMenu(true)
        setContextMenuPos(undefined)
      }
    },
    [editAccess],
  )

  const closeMenus = useCallback(() => {
    setShowSwapBaseMenu(false)
    setContextMenuPos(undefined)
  }, [])

  return (
    <div
      className={[styles.Category, styles.ScenarioHeader].join(" ")}
      onContextMenu={openContextMenu}
      onClick={onCollapseToggle}
      onKeyDown={(e) => {
        if (e.key === "Escape") closeMenus()
      }}
    >
      <BaseLayerName
        base={base}
        isEditingName={isEditingName}
        setIsEditingName={setIsEditingName}
        isEditingIndicator={isEditingIndicator}
        setIsEditingIndicator={setIsEditingIndicator}
        onCollapseToggle={onCollapseToggle}
        isLoading={isLoading}
        closeMenus={closeMenus}
      />
      {!isEditingName && <BaseLayerHeaderButtons openSwapMenu={openSwapMenu} />}
      {showSwapBaseMenu && (
        <SwapBaseMenu closeMenus={closeMenus} setLoading={setIsLoading} setIsEditingName={setIsEditingName} />
      )}
      {rightClickMenuPos && (
        <BaseContextMenu
          setLoading={setIsLoading}
          base={base}
          closeMenus={closeMenus}
          position={rightClickMenuPos}
          initiateChangeName={() => setIsEditingName(true)}
          initiateChangeIndicator={() => setIsEditingIndicator(true)}
          openSwapMenu={openSwapMenu}
        />
      )}
    </div>
  )
}
