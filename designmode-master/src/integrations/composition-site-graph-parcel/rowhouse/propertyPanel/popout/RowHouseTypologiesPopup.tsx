import ParcelTemplateAPI from "src/integrations/composition-site-graph-parcel/templates/ParcelTemplateAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useCallback, useEffect, useState } from "react"
import type { CameraPreset } from "src/integrations/composition-site-graph-parcel/rowhouse/preview"
import Preview from "src/integrations/composition-site-graph-parcel/rowhouse/preview"
import styles from "./RowhouseTypologiesPopup.module.pcss"

import { TemplateList } from "./TemplateList"
import RowhouseTemplateElementAPI from "src/integrations/composition-site-graph-parcel/rowhouse/RowhouseTemplateElementAPI"
import PopUpBox from "src/lib/components/PopUps/PopUpBox"
import { EditingHeader, EditTemplateParameters } from "./edit-form/EditTemplateParameters"
import type { ParcelParameters } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import {
  defaultParcelParameters,
  isParcelComposition,
  updateTemplate,
} from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { TemplateInUse } from "src/integrations/composition-site-graph-parcel/rowhouse/isTemplateInUse"
import { isTemplateUsedByParcelElement } from "src/integrations/composition-site-graph-parcel/rowhouse/isTemplateInUse"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import type { InternalPath } from "src/lib/element/path"
import { useTranslator } from "src/i18n"
import SelectRowhouses from "src/integrations/composition-site-graph/graph-element/CompositionSelection"
import {
  CompositionEventNames,
  CompositionTrackingDataNames,
} from "src/integrations/composition/CompositionMixpanelEventNames"
import { AnalyticsLegacy } from "src/core/analytics"
import { isDefined } from "src/lib/array"
import type { RowHouseParameters } from "src/integrations/composition-row-house-generator/api"
import { defaultRowHouseParameters } from "src/integrations/composition-row-house-generator/api"
import { elementState } from "src/core/elements/ElementState"
import { resetHighlightedFillSignal, setHighlightedFillArraySignalValue } from "src/core/selection/selectionState"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type TemplateParameters = { rowHouseParameters: RowHouseParameters; parcelParameters: ParcelParameters }
export type EditingParameters = { editNameUponOpen: boolean } & TemplateParameters

function getParametersFromTemplate(template: ParcelTemplate): TemplateParameters {
  return {
    rowHouseParameters: template.rowHouseElement.properties.generator.parameters,
    parcelParameters: template.element.properties.generator.parameters,
  }
}

export function RowHouseTypologiesPopup({
  onSelectTemplate,
  close,
  initialTemplate,
  getTemplateUsage,
}: {
  onSelectTemplate: (template: ParcelTemplate) => void
  close: () => void
  initialTemplate?: ParcelTemplate
  getTemplateUsage: (template: ParcelTemplate) => TemplateInUse
}) {
  const t = useTranslator()
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value
  const actionAPI = useActionAPI()

  // previousTemplate is only set when editing a template that already exists -- it is undefined
  // when editing a new template not yet created. (editingParameters is set in either case)
  const [previousTemplate, setPreviousTemplate] = useState<ParcelTemplate | undefined>()
  const [previewParameters, setPreviewParameters] = useState<TemplateParameters | undefined>(
    initialTemplate && getParametersFromTemplate(initialTemplate),
  )
  const [editingParameters, setEditingParameters] = useState<EditingParameters | undefined>()

  useEffect(() => {
    return () => {
      resetHighlightedFillSignal()
    }
  }, [])

  const onCancelEditing = useCallback(() => {
    // Don't track this with new tracking schema
    AnalyticsLegacy.track(CompositionEventNames.Templates_Cancel, {
      [CompositionTrackingDataNames.templateId]: previousTemplate?.id ?? "",
    })

    setPreviousTemplate(undefined)
    setEditingParameters(undefined)
    resetHighlightedFillSignal()
  }, [previousTemplate?.id])

  const onUpdate = useCallback(
    (rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => {
      if (!previousTemplate) return

      const newTemplate = updateTemplate(previousTemplate, parcelParameters, rowHouseParameters)
      setPreviousTemplate(newTemplate)
      const { actions } = RowhouseTemplateElementAPI.getActionsForUpdatedTemplate(
        newTemplate,
        proposal,
        terrain,
        actionAPI,
      )
      actionAPI.preview_UNSTABLE(actions)
      SelectRowhouses.setActive(false)
    },
    [previousTemplate, proposal, terrain, actionAPI],
  )

  const onPublish = useCallback(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => {
      setEditingParameters(undefined)
      setPreviousTemplate(undefined)
      if (!previousTemplate) {
        // Create new template in library
        void ParcelTemplateAPI.addTemplate(rowHouseParameters.typeName, rowHouseParameters, parcelParameters).then(
          (template: ParcelTemplate) => {
            // Run onSelectTemplate with the new template to apply it on selected houses in the scene
            onSelectTemplate(template)
            // Don't track this with new tracking schema
            AnalyticsLegacy.track(CompositionEventNames.Templates_Publish, {
              [CompositionTrackingDataNames.templateId]: template.id,
            })
          },
        )
      } else {
        // Update existing template (will also update name according to rowHouseParameters.typeName)
        const newTemplate = updateTemplate(previousTemplate, parcelParameters, rowHouseParameters)
        if (newTemplate.id === initialTemplate?.id) {
          setPreviewParameters({ rowHouseParameters, parcelParameters })
        }
        void ParcelTemplateAPI.updateTemplate(newTemplate)
        // Don't track this with new tracking schema
        AnalyticsLegacy.track(CompositionEventNames.Templates_Publish, {
          [CompositionTrackingDataNames.templateId]: newTemplate.id,
        })
        //TODO set URNs persisted true.

        const { actions, trackingData } = RowhouseTemplateElementAPI.getActionsForUpdatedTemplate(
          newTemplate,
          proposal,
          terrain,
          actionAPI,
        )

        actionAPI.apply(CompositionEventNames.Parcel_UpdateTemplate, actions, trackingData)
        SelectRowhouses.setActive(true)
        resetHighlightedFillSignal()
      }
    },
    [previousTemplate, onSelectTemplate, initialTemplate?.id, proposal, terrain, actionAPI],
  )

  const onStartEditingExistingTemplate = useCallback(
    (template: ParcelTemplate) => {
      const templateParameters = getParametersFromTemplate(template)
      setEditingParameters({ ...templateParameters, editNameUponOpen: false })
      setPreviousTemplate(template)

      const paths = new Set<InternalPath>()
      for (const { path, element } of proposal.snapshot.traverseNodesDepthFirstIterable()) {
        if (isParcelComposition(element) && isTemplateUsedByParcelElement(template, element).inUse) {
          paths.add(path)
        }
      }

      setHighlightedFillArraySignalValue([...paths])
    },
    [proposal],
  )

  const onStartEditingNewTemplate = useCallback((templateName: string, templateParameters: TemplateParameters) => {
    const templateParametersWithName: EditingParameters = {
      ...templateParameters,
      rowHouseParameters: {
        ...templateParameters.rowHouseParameters,
        typeName: templateName,
      },
      editNameUponOpen: true,
    }
    setEditingParameters(templateParametersWithName)
    setPreviousTemplate(undefined)
  }, [])

  const onHover = useCallback(
    (template: ParcelTemplate | undefined) => {
      if (!isDefined(template)) {
        resetHighlightedFillSignal()
        return
      }
      const paths = new Set<InternalPath>()
      for (const { path, element } of proposal.snapshot.traverseNodesDepthFirstIterable()) {
        if (isParcelComposition(element) && element.urn === template.element.urn) {
          paths.add(path)
        }
      }
      setHighlightedFillArraySignalValue([...paths])
    },
    [proposal],
  )

  if (editingParameters) {
    return (
      <EditHouseTypologyPopup
        initialTemplateParameters={editingParameters}
        onCancel={onCancelEditing}
        onPublish={onPublish}
        onUpdate={onUpdate}
      />
    )
  }

  return (
    <PopUpBox.Container
      id={"rowhouse-popup"}
      header={<PopUpBox.DefaultHeader onClose={close} title={`${t(($) => $.rowhouse.name)} templates`} />}
      top={500}
      minDistanceToScreenBottom={506}
      onKeyDown={(e) => {
        if (e.key == " ") e.stopPropagation()
        if (e.key == "Escape") {
          e.stopPropagation()
        }
      }}
    >
      <div className={styles.PopupContent}>
        <div className={styles.PopupThumbnailContainer}>
          {previewParameters && <Preview {...previewParameters} draggable={true} />}
        </div>
        <TemplateList
          onEdit={onStartEditingExistingTemplate}
          onCreateNew={() => {
            // Don't track this with new tracking schema
            AnalyticsLegacy.track(CompositionEventNames.Templates_Add)
            onStartEditingNewTemplate(ParcelTemplateAPI.getNextUnusedTypeName(), {
              rowHouseParameters: defaultRowHouseParameters,
              parcelParameters: defaultParcelParameters,
            })
          }}
          onDuplicate={(template: ParcelTemplate) => {
            AnalyticsLegacy.track(CompositionEventNames.Templates_Duplicate, {
              [CompositionTrackingDataNames.templateId]: template.id,
            })
            onStartEditingNewTemplate(template.name + " copy", getParametersFromTemplate(template))
          }}
          onSelect={(template) => {
            setPreviewParameters(getParametersFromTemplate(template))
            onSelectTemplate(template)
          }}
          getTemplateUsage={getTemplateUsage}
          onHover={onHover}
        />
      </div>
    </PopUpBox.Container>
  )
}

type EditPopupParameters = {
  templateId?: string
  initialTemplateParameters: EditingParameters
  onCancel: () => void
  onPublish: (rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => Promise<void>
  onUpdate: (rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => void
}

export function EditHouseTypologyPopup({
  templateId,
  initialTemplateParameters,
  onCancel,
  onPublish,
  onUpdate,
}: EditPopupParameters) {
  const [previewCameraPreset, setPreviewCameraPreset] = useState<CameraPreset>("default")
  const [editingParameters, setEditingParameters] = useState<TemplateParameters>(initialTemplateParameters)
  const [renamingTemplateInHeader, setRenamingTemplateInHeader] = useState<boolean>(
    initialTemplateParameters.editNameUponOpen,
  )

  const onUpdateParameters = useCallback(
    (rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => {
      setEditingParameters({ rowHouseParameters, parcelParameters })
      onUpdate(rowHouseParameters, parcelParameters)
    },
    [onUpdate],
  )

  const onRenameFromHeader = useCallback(
    (name: string) => {
      if (editingParameters && name.length > 0) {
        setEditingParameters({
          ...editingParameters,
          rowHouseParameters: { ...editingParameters.rowHouseParameters, typeName: name },
        })
      }
      setRenamingTemplateInHeader(false)
    },
    [editingParameters, setEditingParameters, setRenamingTemplateInHeader],
  )
  const setFunctionId = useCallback(
    (functionId: string) => {
      if (editingParameters === undefined) return
      setEditingParameters({
        ...editingParameters,
        rowHouseParameters: { ...editingParameters.rowHouseParameters, functionId },
      })
    },
    [editingParameters, setEditingParameters],
  )
  return (
    <PopUpBox.Container
      id={"rowhouse-popup"}
      onHeaderDblClick={() => {
        setRenamingTemplateInHeader(true)
      }}
      header={
        <EditingHeader
          templateName={editingParameters.rowHouseParameters.typeName}
          currentlyRenaming={renamingTemplateInHeader}
          onRename={onRenameFromHeader}
          onCancel={onCancel}
        />
      }
      top={500}
      minDistanceToScreenBottom={747}
      onKeyDown={(e) => {
        if (e.key == " ") e.stopPropagation()
        if (e.key == "Enter") {
          e.stopPropagation()
          void onPublish(editingParameters.rowHouseParameters, editingParameters.parcelParameters)
        }
        if (e.key == "Escape") {
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <div className={styles.PopupContent}>
        <div className={styles.PopupThumbnailContainer}>
          {editingParameters && <Preview {...editingParameters} cameraPreset={previewCameraPreset} draggable={true} />}
        </div>
        <EditTemplateParameters
          {...editingParameters}
          templateId={templateId || ""}
          functionId={editingParameters.rowHouseParameters?.functionId || "unspecified"}
          setFunctionId={setFunctionId}
          onPublish={onPublish}
          onChange={onUpdateParameters}
          onChangeCameraPreset={setPreviewCameraPreset}
        />
      </div>
    </PopUpBox.Container>
  )
}
