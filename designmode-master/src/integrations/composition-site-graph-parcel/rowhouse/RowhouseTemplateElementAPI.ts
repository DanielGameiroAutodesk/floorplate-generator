import type { InternalPath } from "src/lib/element/path"
import { getLeafKey, getParentPath } from "src/lib/element/path"
import type { ChildKey, CompositionElement } from "src/integrations/composition-site-graph/graph-element/types"
import { isCompositionElement } from "src/integrations/composition-site-graph/graph-element/types"

import Composition from "src/integrations/composition-site-graph/graph-element/composition"
import type { Action, ActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { isDefined } from "src/lib/array"
import type { TemplateInUse } from "./isTemplateInUse"
import { isTemplateInUseByElements, isTemplateUsedByElement } from "./isTemplateInUse"
import { isParcelComposition, toElements } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { Urn } from "@spacemakerai/element-types"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import { getElevationInLocalCoordinateSystem } from "src/integrations/composition-site-graph/tools/getGlobalTerrainPosition"
import type { TrackingData } from "src/core/analytics"
import {
  CompositionEventNames,
  CompositionTrackingDataNames,
} from "src/integrations/composition/CompositionMixpanelEventNames"
import { rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import { mapOfFormaElements } from "src/lib/element/utils"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import type { Proposal } from "src/core/elements/Proposal"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { NewTerrainState } from "src/core/terrain/new-terrain-state"

function setTemplateForCurrentSelection(
  template: ParcelTemplate,
  snapshot: ElementSnapshot,
  terrain: NewTerrainState,
  actionAPI: ActionAPI,
  selectedPaths: InternalPath[],
) {
  const selectedParcelElements = selectedPaths
    .map((path) => ({ path, element: snapshot.getNode(path)?.element }))
    .filter(({ element }) => isParcelComposition(element))

  let compositionElements: Record<InternalPath, { childKeys: ChildKey[]; element: CompositionElement }> = {}
  let singleElements: InternalPath[] = []

  for (let { path } of selectedParcelElements) {
    const parentPath = getParentPath(path)!
    const parent = snapshot.getNode(parentPath)?.element
    if (isCompositionElement(parent)) {
      if (!(parentPath in compositionElements)) compositionElements[parentPath] = { childKeys: [], element: parent }
      compositionElements[parentPath].childKeys.push(getLeafKey(path))
    } else {
      singleElements.push(path)
    }
  }
  const actions: Action[] = []
  for (let [parentPath, { element, childKeys }] of Object.entries(compositionElements)) {
    const getElevation = (x: number, y: number) => {
      return getElevationInLocalCoordinateSystem(
        { x, y },
        snapshot.getNodeOrThrow(parentPath).globalMatrix,
        terrain.elevationAt,
      )
    }

    const result = Composition.setTemplatesForPaths(element, childKeys, template, getElevation, (urn) =>
      snapshot.getFormaElementOrThrow(urn),
    )

    actions.push(
      ...actionAPI.update.subTree(parentPath, result.rootUrn, result.elements, new Set(), result.representations),
    )
  }
  for (let path of singleElements) {
    const { elements, rootUrn } = toElements(template)
    actions.push(...actionAPI.update.subTree(path, rootUrn, elements, new Set(), template.representations))
  }

  actionAPI.apply(CompositionEventNames.Parcel_SetTemplate, actions, {
    [CompositionTrackingDataNames.templateId]: template.id,
    numElements: selectedPaths.length,
    eventType: "update",
    elementCategory: "",
  })
}

function getTemplatesForCurrentSelection(
  selectedNodes: ChildNodeContainer[],
  templates: Record<string, ParcelTemplate> | undefined,
) {
  if (!isDefined(templates)) return []
  return Object.values(templates).filter(
    (template) =>
      isTemplateInUseByElements(template, selectedNodes.map((node) => node.element).filter(isParcelComposition)).inUse,
  )
}

function getSelectedParcels(selectedNodes: ChildNodeContainer[]) {
  return selectedNodes
    .map((node) => {
      if (isParcelComposition(node.element)) {
        return node.element
      }
    })
    .filter(isDefined)
}

function isTemplateUsedInCurrentSelection(
  template: ParcelTemplate,
  selectedNodes: ChildNodeContainer[],
): TemplateInUse {
  const selectedParcels = selectedNodes.map((node) => node.element).filter(isParcelComposition)
  return isTemplateInUseByElements(template, selectedParcels)
}

function getActionsForUpdatedTemplate(
  newTemplate: ParcelTemplate,
  proposal: Proposal,
  terrain: NewTerrainState,
  actionAPI: ActionAPI,
): { actions: Action[]; trackingData: TrackingData } {
  const trackingData: TrackingData = {
    [CompositionTrackingDataNames.templateId]: newTemplate.id,
    numElements: 0,
    eventType: "update",
    elementCategory: "",
  }

  const pathsToUpdate: InternalPath[] = []
  for (const node of proposal.snapshot.traverseNodesDepthFirstIterable()) {
    const element = node.element
    if (rowHouseApi.isRowHouseElement(element) && isTemplateUsedByElement(newTemplate, element).inUse) {
      //TODO is this how we want to do it??
      const parentPath = getParentPath(node.path)
      if (parentPath != null) {
        pathsToUpdate.push(parentPath)
      }
    }
  }

  trackingData.numElements = pathsToUpdate.length

  const actions = getActionsForUpdatingTemplateAtPaths(pathsToUpdate, newTemplate, proposal, terrain, actionAPI)
  return { actions, trackingData }
}

function getActionsForUpdatingTemplateAtPaths(
  pathsToUpdate: InternalPath[],
  newTemplate: ParcelTemplate,
  proposal: Proposal,
  terrain: NewTerrainState,
  actionAPI: ActionAPI,
): Action[] {
  const compositionActions: Record<InternalPath, { childKeys: ChildKey[]; element: CompositionElement }> = {}
  const singleActions: InternalPath[] = []
  for (let path of pathsToUpdate) {
    const parentPath = getParentPath(path)!
    const parent = proposal.snapshot.getNode(parentPath)?.element
    if (isCompositionElement(parent)) {
      if (!compositionActions[parentPath]) compositionActions[parentPath] = { childKeys: [], element: parent }
      compositionActions[parentPath].childKeys.push(getLeafKey(path))
    } else {
      singleActions.push(path)
    }
  }

  const actions: Action[] = []

  for (let [parentPath, { element, childKeys }] of Object.entries(compositionActions)) {
    const getElevation = (x: number, y: number) => {
      return getElevationInLocalCoordinateSystem(
        { x, y },
        proposal.snapshot.getNodeOrThrow(parentPath).globalMatrix,
        terrain.elevationAt,
      )
    }

    const result = Composition.setTemplatesForPaths(element, childKeys, newTemplate, getElevation, (urn) =>
      proposal.snapshot.getFormaElementOrThrow(urn),
    )
    actions.push(
      ...actionAPI.update.subTree(parentPath, result.rootUrn, result.elements, new Set(), result.representations),
    )
  }
  for (let path of singleActions) {
    const elements = mapOfFormaElements(
      newTemplate.element,
      newTemplate.rowHouseElement,
      newTemplate.privateOutdoorSpaceElement,
    )

    actions.push(
      ...actionAPI.update.subTree(path, newTemplate.element.urn, elements, new Set(), newTemplate.representations),
    )
  }
  return actions
}

function getActionsForReplacingOutdatedTemplate(
  oldTemplateUrn: Urn,
  newTemplate: ParcelTemplate,
  proposal: Proposal,
  terrain: NewTerrainState,
  actionAPI: ActionAPI,
): { actions: Action[]; trackingData: TrackingData } {
  const trackingData: TrackingData = {
    [CompositionTrackingDataNames.templateId]: newTemplate.id,
    numElements: 0,
    eventType: "update",
    elementCategory: "",
  }

  const pathsToUpdate: InternalPath[] = []
  for (const node of proposal.snapshot.traverseNodesDepthFirstIterable()) {
    if (isParcelComposition(node.element) && node.element.urn == oldTemplateUrn) {
      pathsToUpdate.push(node.path)
    }
  }

  trackingData.numElements = pathsToUpdate.length

  const actions = getActionsForUpdatingTemplateAtPaths(pathsToUpdate, newTemplate, proposal, terrain, actionAPI)
  return { actions, trackingData }
}

export default {
  setTemplateForCurrentSelection,
  getTemplatesForCurrentSelection,
  getSelectedParcels,
  isTemplateUsedInCurrentSelection,
  getActionsForUpdatedTemplate,
  getActionsForReplacingOutdatedTemplate,
}
