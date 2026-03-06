import type { ParcelCompositionElement } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { toElements } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { InternalPath } from "src/lib/element/path"
import { useMemo } from "preact/hooks"
import { isTemplateInUseByElements } from "src/integrations/composition-site-graph-parcel/rowhouse/isTemplateInUse"
import ParcelTemplateAPI from "src/integrations/composition-site-graph-parcel/templates/ParcelTemplateAPI"
import { TemplateList } from "./components/TemplateList"
import { RowHouseTypologiesPopup } from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/popout/RowHouseTypologiesPopup"
import { useState } from "react"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import styles from "./RowHousePropertyPanel.module.pcss"
import { useCallback } from "preact/compat"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useTranslator } from "src/i18n"
import { AnalyticsLegacy } from "src/core/analytics"
import {
  CompositionEventNames,
  CompositionTrackingDataNames,
} from "src/integrations/composition/CompositionMixpanelEventNames"

const TRACKING_CONTEXT = "Edit parcel composition"

export function EditParcelCompositionPanel({
  parcelElements,
}: {
  parcelElements: {
    element: ParcelCompositionElement
    path: InternalPath
  }[]
}) {
  const t = useTranslator()
  const templates = ParcelTemplateAPI.templatesSignal.value
  const actionAPI = useActionAPI()

  const [clickedTemplate, setClickedTemplate] = useState<ParcelTemplate | undefined>()

  const onClickTemplate = useCallback((template: ParcelTemplate) => {
    // Don't track this with new tracking schema
    AnalyticsLegacy.track(CompositionEventNames.Templates_OpenTypePanel, {
      [CompositionTrackingDataNames.templateId]: template.id,
      [CompositionTrackingDataNames.tool]: TRACKING_CONTEXT,
    })
    setClickedTemplate(template)
  }, [])

  const onClosePopup = useCallback(() => {
    // Don't track this with new tracking schema
    AnalyticsLegacy.track(CompositionEventNames.Templates_CloseTypePanel, {
      [CompositionTrackingDataNames.tool]: TRACKING_CONTEXT,
    })
    setClickedTemplate(undefined)
  }, [])

  const templatesInSelection = useMemo(() => {
    return Object.values(templates ?? {}).filter((template) => {
      return isTemplateInUseByElements(
        template,
        parcelElements.map(({ element }) => element),
      ).inUse
    })
  }, [parcelElements, templates])

  const onSelectTemplate = useCallback(
    (template: ParcelTemplate) => {
      const { elements, rootUrn } = toElements(template)
      actionAPI.apply(
        "Set templates for single parcel",
        parcelElements.flatMap(({ path }) =>
          actionAPI.update.subTree(path, rootUrn, elements, new Set(), template.representations),
        ),
      )
    },
    [actionAPI, parcelElements],
  )

  return (
    <div style={{ marginBottom: "12px" }}>
      <p className={styles.SubHeader}>{t(($) => $.rowhouse.plural)}</p>
      <TemplateList
        templates={templatesInSelection}
        onClickTemplate={onClickTemplate}
        isTemplateInUseForSelection={() => ({ inUse: false })}
      />
      {clickedTemplate && (
        <RowHouseTypologiesPopup
          onSelectTemplate={onSelectTemplate}
          initialTemplate={clickedTemplate}
          close={onClosePopup}
          getTemplateUsage={(template) =>
            templatesInSelection.includes(template) ? { inUse: true, comparison: "EQUAL" } : { inUse: false }
          }
        />
      )}
    </div>
  )
}
