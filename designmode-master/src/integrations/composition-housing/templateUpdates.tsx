import { useCallback, useEffect, useErrorBoundary, useMemo, useState } from "preact/hooks"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import ParcelTemplateAPI from "src/integrations/composition-site-graph-parcel/templates/ParcelTemplateAPI"
import type {
  ParcelCompositionElement,
  ParcelParameters,
} from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { isParcelComposition, updateTemplate } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { parseUrn } from "src/lib/element/urn"
import type { InternalPath } from "src/lib/element/path"
import type { Urn } from "@spacemakerai/element-types"
import Preview from "src/integrations/composition-site-graph-parcel/rowhouse/preview"
import RowhouseTemplateElementAPI from "src/integrations/composition-site-graph-parcel/rowhouse/RowhouseTemplateElementAPI"
import { CompositionEventNames } from "src/integrations/composition/CompositionMixpanelEventNames"
import type { RowHouseParameters } from "src/integrations/composition-row-house-generator/api"
import { rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import type { EditingParameters } from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/popout/RowHouseTypologiesPopup"
import { EditHouseTypologyPopup } from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/popout/RowHouseTypologiesPopup"
import { captureException } from "@sentry/browser"
import { AnalyticsLegacy } from "src/core/analytics"
import type { GeometryAlertsMessageId } from "src/core/geometry-alerts"
import { GeometryAlertsAPI } from "src/core/geometry-alerts"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"
import { useComputed } from "@preact/signals"
import {
  resetHighlightedFillSignal,
  setHighlightedFillArraySignalValue,
  setSelectionSignalValue,
} from "src/core/selection/selectionState"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type ParcelElementWithPaths = { currentParcelElement: ParcelCompositionElement; paths: InternalPath[] }
type TemplateUpdate = ParcelElementWithPaths & { newParcelTemplate: ParcelTemplate }

export function getUpdatesForParcelTemplate(
  parcelTemplate: ParcelTemplate,
  allParcelElementsInProposal: ParcelElementWithPaths[],
): TemplateUpdate[] {
  const templateUrn = parseUrn(parcelTemplate.element.urn)
  const sameIdElements = allParcelElementsInProposal.filter(
    (e) => parseUrn(e.currentParcelElement.urn).id === templateUrn.id,
  )
  const outdatedRevisionElements = sameIdElements.filter(
    (e) => parseUrn(e.currentParcelElement.urn).revision < templateUrn.revision,
  )
  return outdatedRevisionElements.map(
    (elementWithPaths): TemplateUpdate => ({ ...elementWithPaths, newParcelTemplate: parcelTemplate }),
  )
}

export function getAllParcelElementsInProposal(snapshot: ElementSnapshot): ParcelElementWithPaths[] {
  const parcelUrnToElementAndPaths: Record<Urn, ParcelElementWithPaths> = {}
  for (const node of snapshot.traverseNodesDepthFirstIterable()) {
    const element = node.elementContainer.element
    if (!isParcelComposition(element)) {
      continue
    }
    const urn = element.urn
    if (!parcelUrnToElementAndPaths[urn]) {
      parcelUrnToElementAndPaths[urn] = { currentParcelElement: element, paths: [] }
    }
    parcelUrnToElementAndPaths[urn].paths.push(node.path)
  }
  return Object.values(parcelUrnToElementAndPaths)
}

function useTemplateUpdatesAvailable(): TemplateUpdate[] {
  const parcelElements = useComputed(() => getAllParcelElementsInProposal(elementState.currentSnapshot.value)).value
  const templates = ParcelTemplateAPI.templatesSignal.value

  return useMemo(() => {
    if (!templates) return []
    return Object.values(templates).flatMap((template) => getUpdatesForParcelTemplate(template, parcelElements))
  }, [templates, parcelElements])
}

const TEMPLATE_UPDATES_AVAILABLE_MESSAGE_ID = "template-updates-available"

export function TemplateUpdatesChecker() {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("TemplateUpdatesChecker error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "composition", feature: "template-updates" } })
    window.forma_toasts.push({ content: "Error in template updates checker", status: "warning" })
  })

  const [Component, setComponent] = useState<JSX.Element | null>(null)

  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value
  const actionAPI = useActionAPI()
  const updatesAvailable = useTemplateUpdatesAvailable()

  const allUpdatePaths = useMemo(
    () => updatesAvailable.reduce((acc, cur) => [...acc, ...cur.paths], [] as InternalPath[]),
    [updatesAvailable],
  )

  const onStartUpdatePreview = useCallback(
    (update: TemplateUpdate) => {
      const { actions } = RowhouseTemplateElementAPI.getActionsForReplacingOutdatedTemplate(
        update.currentParcelElement.urn,
        update.newParcelTemplate,
        proposal,
        terrain,
        actionAPI,
      )
      actionAPI.preview_UNSTABLE(actions)
    },
    [proposal, terrain, actionAPI],
  )

  const onUpdateTemplate = useCallback(
    (update: TemplateUpdate) => {
      const { actions, trackingData } = RowhouseTemplateElementAPI.getActionsForReplacingOutdatedTemplate(
        update.currentParcelElement.urn,
        update.newParcelTemplate,
        proposal,
        terrain,
        actionAPI,
      )
      actionAPI.apply(CompositionEventNames.OutdatedTemplates_Update, actions, trackingData)
    },
    [proposal, terrain, actionAPI],
  )

  const onPublishDetachedTemplate = useCallback(
    async (update: TemplateUpdate, rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => {
      const detachedTemplate = await ParcelTemplateAPI.addTemplate(
        rowHouseParameters.typeName,
        rowHouseParameters,
        parcelParameters,
      )
      const { actions, trackingData } = RowhouseTemplateElementAPI.getActionsForReplacingOutdatedTemplate(
        update.currentParcelElement.urn,
        detachedTemplate,
        proposal,
        terrain,
        actionAPI,
      )
      actionAPI.apply(CompositionEventNames.OutdatedTemplates_Detach_Complete, actions, trackingData)
    },
    [actionAPI, proposal, terrain],
  )

  const onUpdateDetachedTemplate = useCallback(
    (update: TemplateUpdate, rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => {
      const detachedTemplate = updateTemplate(update.newParcelTemplate, parcelParameters, rowHouseParameters)
      const { actions } = RowhouseTemplateElementAPI.getActionsForReplacingOutdatedTemplate(
        update.currentParcelElement.urn,
        detachedTemplate,
        proposal,
        terrain,
        actionAPI,
      )
      actionAPI.preview_UNSTABLE(actions)
    },
    [actionAPI, proposal, terrain],
  )

  const onDetachTemplate = useCallback(
    (update: TemplateUpdate) => {
      const rowhouseElement = update.currentParcelElement.children
        ?.map((child) => proposal.snapshot.getFormaElement(child.urn))
        .find(rowHouseApi.isRowHouseElement)
      if (!rowhouseElement) {
        throw new Error("Could not find rowhouse element when detaching outdated template")
      }
      const parcelParameters = update.currentParcelElement.properties.generator.parameters
      const rowHouseParameters = rowhouseElement.properties.generator.parameters

      const templateName = `${rowHouseParameters.typeName} copy`
      // Don't track this with new tracking schema
      AnalyticsLegacy.track(CompositionEventNames.OutdatedTemplates_Detach_Start)

      const parameters: EditingParameters = {
        rowHouseParameters: { ...rowHouseParameters, typeName: templateName },
        parcelParameters,
        editNameUponOpen: true,
      }

      setComponent(() => (
        <EditHouseTypologyPopup
          initialTemplateParameters={parameters}
          onCancel={() => {
            setComponent(null)
            actionAPI.resetPreview_UNSTABLE()
          }}
          onPublish={async (rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => {
            await onPublishDetachedTemplate(update, rowHouseParameters, parcelParameters)
            setComponent(null)
          }}
          onUpdate={(rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => {
            return onUpdateDetachedTemplate(update, rowHouseParameters, parcelParameters)
          }}
        />
      ))
    },
    [actionAPI, proposal, onPublishDetachedTemplate, onUpdateDetachedTemplate],
  )

  useEffect(() => {
    const addedMessageIds: GeometryAlertsMessageId[] = []
    for (let update of updatesAvailable) {
      const messageId = `${TEMPLATE_UPDATES_AVAILABLE_MESSAGE_ID}-${update.newParcelTemplate.id}`
      GeometryAlertsAPI.add({
        id: messageId,
        title: () => update.newParcelTemplate.name,
        count: update.paths.length,
        subTitle: (t) => t(($) => $.ui.newVersionAvailable),
        icon: (
          <Preview
            parcelParameters={update.newParcelTemplate.element.properties.generator.parameters}
            rowHouseParameters={update.newParcelTemplate.rowHouseElement.properties.generator.parameters}
          />
        ),
        style: "primary",

        onHover: () => {
          setHighlightedFillArraySignalValue(update.paths)
          return () => resetHighlightedFillSignal()
        },
        onClick: () => {
          setSelectionSignalValue(update.paths)
        },
        actions: [
          {
            name: (t) => t(($) => $.ui.detach),
            variant: "flat",
            onClick: () => onDetachTemplate(update),
          },
          {
            name: (t) => t(($) => $.ui.update),
            variant: "outlined",
            onClick: () => onUpdateTemplate(update),
            onHover: () => {
              onStartUpdatePreview(update)
              return () => {
                actionAPI.resetPreview_UNSTABLE()
              }
            },
          },
        ],
      })
      addedMessageIds.push(messageId)
    }
    return () => {
      addedMessageIds.forEach(GeometryAlertsAPI.remove)
    }
  }, [actionAPI, allUpdatePaths, onDetachTemplate, onStartUpdatePreview, onUpdateTemplate, updatesAvailable])

  if (error) return null

  return Component
}
