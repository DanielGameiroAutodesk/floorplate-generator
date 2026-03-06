import ParcelTemplateAPI from "src/integrations/composition-site-graph-parcel/templates/ParcelTemplateAPI"
import { useCallback, useState } from "react"
import type { TemplateInUse } from "src/integrations/composition-site-graph-parcel/rowhouse/isTemplateInUse"
import styles from "./TemplateList.module.pcss"
import Preview from "src/integrations/composition-site-graph-parcel/rowhouse/preview"
import { Pencil } from "src/lib/components/icons/pencil"
import { useMemo } from "preact/hooks"
import { HamburgerIcon } from "src/lib/components/icons/HamburgerIcon"
import { RowhouseContextMenu } from "./RowHouseContextMenu"
import TextInput from "src/integrations/inputs/TextInput"
import RowhouseTemplateElementAPI from "src/integrations/composition-site-graph-parcel/rowhouse/RowhouseTemplateElementAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { setNameOnTemplateAndElements } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import {
  CompositionEventNames,
  CompositionTrackingDataNames,
} from "src/integrations/composition/CompositionMixpanelEventNames"
import { PlusIcon } from "src/lib/components/icons/PlusIcon"
import { AnalyticsLegacy } from "src/core/analytics"
import { rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import { elementState } from "src/core/elements/ElementState"
import { terrainSignal } from "src/core/terrain/new-terrain-state"
import { useTranslator } from "src/i18n"

export function TemplateList({
  onEdit,
  onSelect,
  onCreateNew,
  onDuplicate,
  onHover,
  getTemplateUsage,
}: {
  onEdit: (template: ParcelTemplate) => void
  onSelect: (template: ParcelTemplate) => void
  onCreateNew: () => void
  onDuplicate: (template: ParcelTemplate) => void
  onHover?: (template: ParcelTemplate | undefined) => void
  getTemplateUsage: (typology: ParcelTemplate) => TemplateInUse
}) {
  const actionAPI = useActionAPI()
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value

  const templates = ParcelTemplateAPI.templatesSignal.value

  const onUpdateTemplateName = useCallback(
    (templateId: string, name: string) => {
      const currentTemplate = Object.values(templates || {}).find((template) => template.id === templateId)
      if (currentTemplate == null) return

      const newTemplate: ParcelTemplate = setNameOnTemplateAndElements(currentTemplate, name)
      void ParcelTemplateAPI.updateTemplate(newTemplate)

      const { actions, trackingData } = RowhouseTemplateElementAPI.getActionsForUpdatedTemplate(
        newTemplate,
        proposal,
        terrain,
        actionAPI,
      )

      actionAPI.apply(CompositionEventNames.Templates_Rename, actions, trackingData)
    },
    [actionAPI, proposal, templates, terrain],
  )

  const onDelete = useCallback((id: string) => {
    // Don't track this with new tracking schema
    AnalyticsLegacy.track(CompositionEventNames.Templates_Delete, {
      [CompositionTrackingDataNames.templateId]: id,
    })
    ParcelTemplateAPI.deleteTemplate(id)
  }, [])

  const t = useTranslator()

  if (!templates) {
    return <div>{t(($) => $.rowhouse.loading)}</div>
  }

  return (
    <div className={styles.TemplateListContainer}>
      <CreateNewTemplateRow onClick={onCreateNew} />
      {Object.values(ParcelTemplateAPI.templatesSignal?.value ?? []).map((template) => (
        <TemplateListRow
          key={template.id}
          template={template}
          onEditOpen={() => {
            onEdit(template)
          }}
          onEditTemplateName={onUpdateTemplateName}
          onSelect={(template) => {
            onSelect(template)
          }}
          onHover={onHover}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          isTemplateInUseForSelection={getTemplateUsage}
        />
      ))}
    </div>
  )
}

export function PreviewItem({
  template,
  isTemplateInUseForSelection,
}: {
  template: ParcelTemplate
  isTemplateInUseForSelection: (typology: ParcelTemplate) => TemplateInUse
}) {
  const borderColor = useMemo(() => {
    const inUse = isTemplateInUseForSelection(template)

    if (!inUse.inUse) {
      return undefined
    }
    switch (inUse.comparison) {
      case "TEMPLATE_IS_OLDER":
      case "TEMPLATE_IS_NEWER":
      case "MIXED":
        return "var(--status-color-warning)"
      case "EQUAL":
        return "#0696d7"
    }
  }, [isTemplateInUseForSelection, template])

  return (
    <div
      className={styles.TemplateListPreviewContainer}
      style={borderColor ? { outline: `1px solid ${borderColor}` } : undefined}
    >
      <Preview
        rowHouseParameters={template.rowHouseElement.properties.generator.parameters}
        parcelParameters={template.element.properties.generator.parameters}
      />
    </div>
  )
}

function CreateNewTemplateRow({ onClick }: { onClick: () => void }) {
  const t = useTranslator()
  return (
    <div className={styles.TemplateListRow}>
      <div className={styles.TemplateListRowTitleContainer} onClick={onClick}>
        <div className={styles.TemplateListPreviewContainer}>
          <PlusIcon />
        </div>
        <div className={styles.TemplateListRowTitle}>{t(($) => $.rowhouse.createNew)}</div>
      </div>
    </div>
  )
}

function TemplateListRow({
  template,
  onSelect,
  onEditTemplateName,
  onDelete,
  onEditOpen,
  onDuplicate,
  onHover,
  isTemplateInUseForSelection,
}: {
  template: ParcelTemplate
  onSelect: (typology: ParcelTemplate) => void
  onEditTemplateName: (templateId: string, name: string) => void
  onEditOpen: () => void
  onDelete: (id: string) => void
  onHover?: (template: ParcelTemplate | undefined) => void
  onDuplicate: (typology: ParcelTemplate) => void
  isTemplateInUseForSelection: (typology: ParcelTemplate) => TemplateInUse
}) {
  const [editName, setEditName] = useState<boolean>(false)
  const [contextMenuOpenPosition, setContextMenuOpenPosition] = useState<undefined | { top: number; left: number }>(
    undefined,
  )

  const onEdit = useCallback(
    (e: Event) => {
      e.stopPropagation()
      onEditOpen()
    },
    [onEditOpen],
  )

  const onContextMenu = useCallback((e: MouseEvent) => {
    setContextMenuOpenPosition({ top: e.clientY, left: e.clientX })
    e.stopPropagation()
  }, [])

  return (
    <div className={styles.TemplateListRow} onClick={() => onSelect(template)}>
      {editName ? (
        <div className={styles.TemplateListRowTitleContainer}>
          <PreviewItem template={template} isTemplateInUseForSelection={isTemplateInUseForSelection} />
          <RowhouseTitleEdit
            title={rowHouseApi.getTemplateName(template.rowHouseElement)}
            updateTitle={(title) => onEditTemplateName(template.id, title)}
            toggleEdit={setEditName}
          />
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line react/no-unknown-property */}
          <div className={styles.TemplateListRowTitleContainer} onDblClick={() => setEditName(true)}>
            <PreviewItem template={template} isTemplateInUseForSelection={isTemplateInUseForSelection} />
            <div className={styles.TemplateListRowTitle}>{rowHouseApi.getTemplateName(template.rowHouseElement)}</div>
          </div>

          <div className={styles.TemplateListRowButtonContainer}>
            <weave-icon-button
              onClick={onEdit}
              onMouseEnter={() => onHover && onHover(template)}
              onMouseLeave={() => onHover && onHover(undefined)}
            >
              <Pencil />
            </weave-icon-button>
            <weave-icon-button onClick={onContextMenu}>
              <HamburgerIcon />
            </weave-icon-button>
          </div>

          {contextMenuOpenPosition && (
            <RowhouseContextMenu
              close={() => setContextMenuOpenPosition(undefined)}
              contextMenuOpenPosition={contextMenuOpenPosition}
              toggleEditName={setEditName}
              onDelete={() => onDelete(template.id)}
              onDuplicate={() => onDuplicate(template)}
              onEditOpen={onEditOpen}
            />
          )}
        </>
      )}
    </div>
  )
}

function RowhouseTitleEdit({
  title,
  updateTitle,
  toggleEdit,
}: {
  title: string
  updateTitle: (title: string) => void
  toggleEdit: (edit: boolean) => void
}) {
  return (
    <div
      className={styles.TemplateListRowTitleEdit}
      onKeyDown={(e) => {
        e.stopPropagation()
      }}
    >
      <TextInput
        initialValue={title}
        onBlur={(value) => {
          updateTitle(value)
          toggleEdit(false)
        }}
      />
    </div>
  )
}
