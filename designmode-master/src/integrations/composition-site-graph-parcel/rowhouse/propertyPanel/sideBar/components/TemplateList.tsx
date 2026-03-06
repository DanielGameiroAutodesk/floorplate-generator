import styles from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/sideBar/RowHousePropertyPanel.module.pcss"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import { useTranslator } from "src/i18n"
import { PreviewItem } from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/popout/TemplateList"
import type { TemplateInUse } from "src/integrations/composition-site-graph-parcel/rowhouse/isTemplateInUse"
import { rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import Notifications_16 from "src/lib/components/icons/Notifications_16"
import {
  getAllParcelElementsInProposal,
  getUpdatesForParcelTemplate,
} from "src/integrations/composition-housing/templateUpdates"
import { useMemo } from "preact/hooks"
import type { ParcelCompositionElement } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { InternalPath } from "src/lib/element/path"
import { useCallback } from "preact/compat"
import { AnalyticsLegacy } from "src/core/analytics"
import { CompositionEventNames } from "src/integrations/composition/CompositionMixpanelEventNames"
import { GeometryAlertsAPI } from "src/core/geometry-alerts"
import { elementState } from "src/core/elements/ElementState"
import { useComputed } from "@preact/signals"

export function TemplateRow({
  title,
  parcelTemplate,
  onClick,
  onHover,
  isTemplateInUseForSelection,
  allParcelElementsInProposal,
}: {
  title: string
  parcelTemplate: ParcelTemplate
  onClick: () => void
  onHover?: (template: ParcelTemplate | undefined) => void
  isTemplateInUseForSelection: (typology: ParcelTemplate) => TemplateInUse
  allParcelElementsInProposal: { currentParcelElement: ParcelCompositionElement; paths: InternalPath[] }[]
}) {
  const t = useTranslator()
  const templateUpdates = useMemo(() => {
    return getUpdatesForParcelTemplate(parcelTemplate, allParcelElementsInProposal)
  }, [allParcelElementsInProposal, parcelTemplate])
  const hasUpdate = useMemo(() => {
    return templateUpdates.length > 0
  }, [templateUpdates])
  const onUpdatesAvailableClick = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    // Don't track this with new tracking schema
    AnalyticsLegacy.track(CompositionEventNames.OutdatedTemplates_OpenPopup, { source: "housePropertyPanel" })
    GeometryAlertsAPI.setVisibility("open")
  }, [])
  return (
    <div
      className={styles.TemplateButton}
      onClick={onClick}
      onMouseEnter={() => onHover && onHover(parcelTemplate)}
      onMouseLeave={() => onHover && onHover(undefined)}
    >
      <div className={styles.PreviewContainer36}>
        <PreviewItem template={parcelTemplate} isTemplateInUseForSelection={isTemplateInUseForSelection} />
      </div>
      <p>{title}</p>
      {hasUpdate && (
        <weave-tooltip text={t(($) => $.tooltips.templates.updatesAvailable)} nub="down-center">
          <weave-icon-button onClick={onUpdatesAvailableClick}>
            <Notifications_16 slot={"icon"} />
          </weave-icon-button>
        </weave-tooltip>
      )}
    </div>
  )
}

export function TemplateList({
  onHover,
  templates,
  onClickTemplate,
  isTemplateInUseForSelection,
}: {
  onHover?: (template: ParcelTemplate | undefined) => void
  templates: ParcelTemplate[]
  onClickTemplate: (template: ParcelTemplate) => void
  isTemplateInUseForSelection: (typology: ParcelTemplate) => TemplateInUse
}) {
  const allParcelElementsInProposal = useComputed(() =>
    getAllParcelElementsInProposal(elementState.currentSnapshot.value),
  ).value
  return (
    <div className={styles.TemplateList}>
      {templates.map((template) => (
        <TemplateRow
          key={template.id}
          parcelTemplate={template}
          title={rowHouseApi.getTemplateName(template.rowHouseElement)}
          onHover={onHover}
          onClick={() => onClickTemplate(template)}
          isTemplateInUseForSelection={isTemplateInUseForSelection}
          allParcelElementsInProposal={allParcelElementsInProposal}
        />
      ))}
    </div>
  )
}
