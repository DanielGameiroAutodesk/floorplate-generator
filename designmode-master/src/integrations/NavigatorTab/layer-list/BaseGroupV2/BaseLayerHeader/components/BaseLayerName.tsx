import styles from "src/integrations/NavigatorTab/layer-list/Layer/Category.module.pcss"
import TextInput from "src/integrations/inputs/TextInput"
import type { FormaElement } from "@spacemakerai/element-types"
import { useEffect, useRef } from "react"
import useBaseUtils from "src/core/useBaseUtils"
import useSingleAndDoubleClick from "./useSingleAndDoubleClick"
import { BaseLayerIndicator } from "./BaseLayerIndicator/BaseLayerIndicator"
import { LayerSkeleton } from "src/integrations/NavigatorTab/layer-list/Layer/CategoryLayer"
import { useTranslator } from "src/i18n"

export default function BaseLayerName({
  base,
  onCollapseToggle,
  isEditingName,
  setIsEditingName,
  isEditingIndicator,
  setIsEditingIndicator,
  isLoading,
  closeMenus,
}: {
  base: FormaElement
  onCollapseToggle: () => void
  isEditingName: boolean
  setIsEditingName: (isEditing: boolean) => void
  isEditingIndicator: boolean
  setIsEditingIndicator: (isEditing: boolean) => void
  isLoading: boolean
  closeMenus: () => void
}) {
  const t = useTranslator()
  const indicatorRef = useRef<HTMLInputElement>(null)
  const { updateBaseIndicator, updateBaseName } = useBaseUtils()

  const onSingleClickName = () => {
    onCollapseToggle()
    closeMenus()
  }

  const onDoubleClickName = () => {
    closeMenus()
    setIsEditingName(true)
  }

  const onClickName = useSingleAndDoubleClick({ onClick: onSingleClickName, onDoubleClick: onDoubleClickName })

  useEffect(() => {
    if (isEditingIndicator) indicatorRef.current?.select()
  }, [isEditingIndicator])

  if (isLoading) return <LayerSkeleton />

  return (
    <>
      <div className={[styles.Icon, styles.BaseLayerIcon].join(" ")}>
        {!isEditingIndicator && <BaseLayerIndicator base={base} />}
        {isEditingIndicator && (
          <input
            autoComplete="off"
            ref={indicatorRef}
            name="base-indicator"
            value={base.properties?.indicator || ""}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder={"A"}
            onBlur={(e) => {
              const newIndicator = e.currentTarget.value
              if (base.properties?.indicator !== newIndicator) updateBaseIndicator(base, newIndicator)
              setIsEditingIndicator(false)
            }}
            maxLength={1}
          />
        )}
      </div>
      <div className={[styles.Name, isEditingName ? styles.BaseNameEdit : ""].join(" ")} id="base-name">
        {!isEditingName && (
          <span
            onClick={(e) => {
              e.stopPropagation()
              onClickName()
            }}
          >
            {base.properties?.name || t(($) => $.base.untitledBaseLabel)}
          </span>
        )}
        {isEditingName && (
          <TextInput
            name="base-name"
            initialValue={base.properties?.name || ""}
            placeholder={t(($) => $.base.untitledBaseLabel)}
            onBlur={(newName) => {
              if (base.properties?.name !== newName) updateBaseName(base, newName)
              setIsEditingName(false)
            }}
            isSelected={isEditingName}
          />
        )}
      </div>
    </>
  )
}
