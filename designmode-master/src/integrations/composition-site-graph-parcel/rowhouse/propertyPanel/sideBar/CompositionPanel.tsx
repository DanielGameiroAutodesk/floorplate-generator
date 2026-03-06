import styles from "./RowHousePropertyPanel.module.pcss"
import { useMemo } from "preact/hooks"
import type { ParcelCompositionElement } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { isParcelComposition, updateTemplate } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import CompositionSelection from "src/integrations/composition-site-graph/graph-element/CompositionSelection"
import SelectRowhouses from "src/integrations/composition-site-graph/graph-element/CompositionSelection"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type {
  CompositionElement,
  GraphToChildrenConnection,
  LineSettings,
} from "src/integrations/composition-site-graph/graph-element/types"
import {
  DEFAULT_LINE_SETTINGS,
  isCompositionElement,
} from "src/integrations/composition-site-graph/graph-element/types"
import type { TemplateInUse } from "src/integrations/composition-site-graph-parcel/rowhouse/isTemplateInUse"
import { isTemplateInUseByElements } from "src/integrations/composition-site-graph-parcel/rowhouse/isTemplateInUse"
import ParcelTemplateAPI from "src/integrations/composition-site-graph-parcel/templates/ParcelTemplateAPI"
import { TemplateList } from "./components/TemplateList"
import { useCallback, useState } from "react"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import { RowHouseTypologiesPopup } from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/popout/RowHouseTypologiesPopup"
import type { InternalPath } from "src/lib/element/path"
import { getParentPath, mergePath } from "src/lib/element/path"
import RowhouseTemplateElementAPI from "src/integrations/composition-site-graph-parcel/rowhouse/RowhouseTemplateElementAPI"
import CurrentTemplate from "src/integrations/composition-site-graph-parcel/templates/CurrentTemplate"
import { isDefined, uniq } from "src/lib/array"

import type { Child, Urn } from "@spacemakerai/element-types"
import { useTranslator } from "src/i18n"
import { AnalyticsLegacy } from "src/core/analytics"
import {
  CompositionEventNames,
  CompositionTrackingDataNames,
} from "src/integrations/composition/CompositionMixpanelEventNames"
import { useRecoilValue } from "recoil"
import { rowhouseToolState } from "src/integrations/composition-site-graph-parcel/rowhouse/toolState"
import CompositionLineSettings from "./components/CompositionLineSettings"
import Composition from "src/integrations/composition-site-graph/graph-element/composition"
import type { Graph } from "src/integrations/composition-site-graph/graph/types"
import { newRowHouseLineSettingsSignal } from "src/integrations/composition-site-graph/graph-element/DrawCompositionGraph"
import uniqBy from "lodash/uniqBy"
import type { PrivateOutdoorSpaceElement } from "src/integrations/composition-site-graph-parcel/privateOutdoorSpace/privateOutdoorSpaceGenerator"
import { isPrivateOutdoorSpaceElement } from "src/integrations/composition-site-graph-parcel/privateOutdoorSpace/privateOutdoorSpaceGenerator"
import { newId, parseUrn } from "src/lib/element/urn"
import type { WithIndeterminateValues } from "src/lib/indeterminate"
import indeterminate from "src/lib/indeterminate"
import { rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import { elementState } from "src/core/elements/ElementState"
import { exitCurrentTool } from "src/core/toolsState"
import { canEditProposalSignal } from "src/core/edit-access-state"
import {
  resetHighlightedFillSignal,
  selectedNodesSignal,
  setHighlightedFillArraySignalValue,
  setSelectionSetSignalValue,
} from "src/core/selection/selectionState"
import { batch } from "@preact/signals"
import PropertyPanel from "src/lib/components/PropertyPanel"
import { internalPathToSelectionPath } from "src/core/selection/selectionTypes"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

/**
 * Naively goes through the graph and stuffs all the properties of the coEdge on the side in lineSettings
 * Assumptions:
 * - there are props on at least one side
 * - there are parcelParameters in those props to change the buffer of
 */
function updatePropertiesBasedOnLineSettings(g: Graph, lineSettings: LineSettings) {
  const coEdgesWithPropsOnCorrectSide = Object.fromEntries(
    Object.entries(g._coEdges).map(([coEdgeId, coEdge]) => {
      const otherCoEdge = Object.values(g._coEdges).find(
        (otherCoEdge) => otherCoEdge.edgeId === coEdge.edgeId && coEdge.reverse !== otherCoEdge.reverse,
      )
      // Basically: What if there are props on both sides of the line? We prefer to keep the ones on the side we are not changing
      const oldProps =
        lineSettings.placementSide === "left" && coEdge.reverse
          ? (coEdge.properties ?? otherCoEdge?.properties)
          : lineSettings.placementSide === "right" && !coEdge.reverse
            ? (otherCoEdge?.properties ?? coEdge.properties)
            : undefined
      const props = {
        ...oldProps,
        parcelParameters: {
          ...oldProps?.parcelParameters,
          buffer: lineSettings.buffer,
        },
      }
      return [
        coEdgeId,
        {
          ...coEdge,
          properties:
            (lineSettings.placementSide === "left" && coEdge.reverse) ||
            (lineSettings.placementSide === "right" && !coEdge.reverse)
              ? props
              : undefined,
        },
      ]
    }),
  )
  return {
    ...g,
    _coEdges: {
      ...g._coEdges,
      ...coEdgesWithPropsOnCorrectSide,
    },
  }
}

// This function copies coEdge => child connections from non-empty co-edges to the opposite co-edge, regardless of
// the opposite co-edge has parcelparameters (should place children)
function updateGraphToChildrenConnection(compElement: CompositionElement, oldGraph: Graph) {
  const newGraphToChildrenConnection: GraphToChildrenConnection = {
    edges: { ...compElement.properties.definingRepresentation.graphToChildrenConnection.edges },
    coEdges: { ...compElement.properties.definingRepresentation.graphToChildrenConnection.coEdges },
  }
  Object.entries(compElement.properties.definingRepresentation.graphToChildrenConnection.coEdges).forEach(
    ([key, currentValue]) => {
      if (currentValue.length === 0) return
      const currentCoEdge = oldGraph._coEdges[key]
      const currentChildren = [...currentValue]
      Object.entries(oldGraph._coEdges).forEach(([key, value]) => {
        if (value.edgeId === currentCoEdge.edgeId && value.reverse !== currentCoEdge.reverse) {
          newGraphToChildrenConnection.coEdges[key] = currentChildren.reverse()
        }
      })
    },
  )
  return newGraphToChildrenConnection
}

function getLineSettingsForElement(element: CompositionElement): LineSettings {
  const firstCoEdgeWithProps = Object.values(element.properties.definingRepresentation.graph._coEdges).find((coEdge) =>
    isDefined(coEdge.properties?.parcelParameters),
  )
  if (!firstCoEdgeWithProps) {
    return DEFAULT_LINE_SETTINGS
  }
  const buffer = firstCoEdgeWithProps.properties?.parcelParameters?.buffer ?? 0
  const placementSide = firstCoEdgeWithProps.reverse ? "left" : "right"
  return {
    buffer,
    placementSide,
  }
}

function useLineSettings(
  compositionElements: { path: InternalPath; element: CompositionElement }[],
): [WithIndeterminateValues<LineSettings>, (settings: Partial<LineSettings>) => void] {
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value
  const actionAPI = useActionAPI()

  const currentTemplate = CurrentTemplate.templateSignal.value

  //TODO: Keep track of old linesettings per element so we can apply partial linesettings per element
  const lineSettings: WithIndeterminateValues<LineSettings> = useMemo(() => {
    const lineSettings: LineSettings[] = compositionElements.map(({ element }) => {
      return getLineSettingsForElement(element)
    })
    return indeterminate.getFromObjects(lineSettings)
  }, [compositionElements])

  const setLineSettings = useCallback(
    (lineSettings: Partial<LineSettings>) => {
      SelectRowhouses.setActive(false)
      if (!currentTemplate) {
        throw new Error("NO CURRENT TEMPLATE")
      }

      const actions = compositionElements.flatMap(({ path, element }) => {
        const oldGraph = element.properties.definingRepresentation.graph
        const newGraphToChildrenConnection = updateGraphToChildrenConnection(element, oldGraph)

        const mergedLineSettings = { ...getLineSettingsForElement(element), ...lineSettings }

        const graph = updatePropertiesBasedOnLineSettings(
          element.properties.definingRepresentation.graph,
          mergedLineSettings,
        )
        const updatedCompositionElement: CompositionElement = {
          ...element,
          properties: {
            ...element.properties,
            definingRepresentation: { graph, graphToChildrenConnection: newGraphToChildrenConnection },
          },
        }
        const result = Composition.updateGraph(
          updatedCompositionElement,
          graph,
          currentTemplate,
          terrain.elevationAt,
          (urn: Urn) => proposal.snapshot.getFormaElementOrThrow(urn),
        )

        return actionAPI.update.subTree(path, result.rootUrn, result.elements, new Set(), result.representations)
      })

      actionAPI.apply("Update graph", actions)
      SelectRowhouses.setActive(true)
    },
    [actionAPI, compositionElements, currentTemplate, proposal.snapshot, terrain.elevationAt],
  )
  return [lineSettings, setLineSettings]
}

export function EditCompositionPanel({
  compositionElements,
}: {
  compositionElements: { path: InternalPath; element: CompositionElement }[]
}) {
  const t = useTranslator()
  const childSelection = CompositionSelection.selectionSignal.value
  const templates = ParcelTemplateAPI.templatesSignal.value
  const snapshot = elementState.currentSnapshot.value
  const actionAPI = useActionAPI()
  const terrain = terrainSignal.value
  const [lineSettings, setLineSettings] = useLineSettings(compositionElements)

  const release = useRelease()

  const [clickedTemplate, setClickedTemplate] = useState<ParcelTemplate | undefined>()

  const parcelElements = useMemo(() => {
    return compositionElements.flatMap(
      ({ element }) =>
        element.children?.map(({ urn }) => snapshot.getFormaElement(urn)).filter(isParcelComposition) ?? [],
    )
  }, [compositionElements, snapshot])

  const selectedParcelElements: ParcelCompositionElement[] = useMemo(() => {
    return compositionElements.flatMap(
      ({ element }) =>
        element.children
          ?.filter((child) => childSelection.has(internalPathToSelectionPath(child.key)))
          ?.map(({ urn }) => snapshot.getFormaElement(urn))
          .filter(isParcelComposition) ?? [],
    )
  }, [compositionElements, childSelection, snapshot])

  const getTemplateUsage = useCallback(
    (template: ParcelTemplate): TemplateInUse => {
      return isTemplateInUseByElements(template, selectedParcelElements)
    },
    [selectedParcelElements],
  )

  const onSelectTemplate = useCallback(
    (template: ParcelTemplate) => {
      const selection: InternalPath[] =
        childSelection.size === 0
          ? compositionElements.flatMap(
              ({ path, element }) => element.children?.map((child) => mergePath(path, child.key)) ?? [],
            )
          : compositionElements.flatMap(
              ({ path, element }) =>
                element.children
                  ?.map((child) =>
                    childSelection.has(internalPathToSelectionPath(child.key)) ? mergePath(path, child.key) : undefined,
                  )
                  .filter(isDefined) ?? [],
            )

      RowhouseTemplateElementAPI.setTemplateForCurrentSelection(template, snapshot, terrain, actionAPI, selection)
    },
    [actionAPI, childSelection, compositionElements, snapshot, terrain],
  )

  const templatesInSelection = useMemo(() => {
    return Object.values(templates ?? {}).filter((template) => {
      return isTemplateInUseByElements(template, parcelElements).inUse
    })
  }, [parcelElements, templates])

  const parcelsWithDeletedTemplates: ParcelTemplate[] = useMemo((): ParcelTemplate[] => {
    const uniqueParcels = uniqBy(parcelElements, (r) => r.urn)
    const parcelsWithoutExistingTemplates = uniqueParcels.filter(
      // We check on .id because we don't want outdated templates to show up as deleted.
      (parcel) => !templatesInSelection.some((t) => parseUrn(t.element.urn).id === parseUrn(parcel.urn).id),
    )
    return parcelsWithoutExistingTemplates
      .map((parcelElement) => {
        const rowHouse = parcelElement.children
          ?.map((child) => snapshot.getFormaElement(child.urn))
          .find(rowHouseApi.isRowHouseElement)
        const privateOutdoorSpaceElement: PrivateOutdoorSpaceElement | undefined = parcelElement.children
          ?.map((child) => snapshot.getFormaElement(child.urn))
          .find(isPrivateOutdoorSpaceElement)
        if (!rowHouse) return
        if (!privateOutdoorSpaceElement) return
        const temp: ParcelTemplate = {
          id: newId(),
          element: parcelElement,
          name: `Deleted: ${rowHouse.properties.generator.parameters.typeName}`,
          rowHouseElement: rowHouse,
          privateOutdoorSpaceElement: privateOutdoorSpaceElement,
          representations: {
            volumeMesh: new Map(),
            footprint: new Map(),
            terrainShape: new Map(),
            terrainTexture: new Map(),
            buildingFloors3DSketch_UNSTABLE: new Map(),
          },
        }
        return updateTemplate(temp, parcelElement.properties.generator.parameters, {
          ...temp.rowHouseElement.properties.generator.parameters,
          typeName: `Deleted: ${temp.rowHouseElement.properties.generator.parameters.typeName}`,
        })
      })
      .filter(isDefined)
  }, [snapshot, parcelElements, templatesInSelection])

  const onHover = useCallback(
    (template: ParcelTemplate | undefined) => {
      if (!isDefined(template)) {
        resetHighlightedFillSignal()
        return
      }
      const paths = new Set<InternalPath>()
      for (const { path: _path, element } of snapshot.traverseNodesDepthFirstIterable()) {
        if (!compositionElements.some(({ path }) => _path.startsWith(path))) continue
        if (isParcelComposition(element) && element.urn === template.element.urn) {
          paths.add(_path)
        }
      }
      setHighlightedFillArraySignalValue([...paths])
    },
    [compositionElements, snapshot],
  )

  return (
    <PropertyPanel.BorderContainer>
      <PropertyPanel.AutomationHeader
        editAccess={canEditProposalSignal.value}
        title={t(($) => $.rowhouse.name)}
        release={release}
      />
      <CompositionLineSettings setLineSettings={setLineSettings} lineSettings={lineSettings} />
      <hr className={styles.Divider} />
      <p className={styles.SubHeader}>{t(($) => $.rowhouse.plural)}</p>
      <TemplateList
        templates={[...templatesInSelection, ...parcelsWithDeletedTemplates]}
        onClickTemplate={setClickedTemplate}
        isTemplateInUseForSelection={getTemplateUsage}
        onHover={onHover}
      />

      {clickedTemplate && (
        <RowHouseTypologiesPopup
          onSelectTemplate={onSelectTemplate}
          initialTemplate={clickedTemplate}
          close={() => setClickedTemplate(undefined)}
          getTemplateUsage={getTemplateUsage}
        />
      )}
    </PropertyPanel.BorderContainer>
  )
}

export function NewCompositionPanel() {
  const t = useTranslator()
  const [clickedTemplate, setClickedTemplate] = useState<ParcelTemplate | undefined>()
  const rowhouseTool = useRecoilValue(rowhouseToolState)

  const onClickTemplate = useCallback(
    (template: ParcelTemplate) => {
      // Don't track this with new tracking schema
      AnalyticsLegacy.track(CompositionEventNames.Templates_OpenTypePanel, {
        [CompositionTrackingDataNames.templateId]: template.id,
        [CompositionTrackingDataNames.tool]: rowhouseTool,
      })
      setClickedTemplate(template)
    },
    [rowhouseTool],
  )

  const onClosePopup = useCallback(() => {
    // Don't track this with new tracking schema
    AnalyticsLegacy.track(CompositionEventNames.Templates_CloseTypePanel, {
      [CompositionTrackingDataNames.tool]: rowhouseTool,
    })
    setClickedTemplate(undefined)
  }, [rowhouseTool])

  const lineSettings = newRowHouseLineSettingsSignal.value
  return (
    <PropertyPanel.BorderContainer>
      <PropertyPanel.AutomationHeader editAccess={canEditProposalSignal.value} title={t(($) => $.rowhouse.name)} />
      <CompositionLineSettings
        setLineSettings={(ls) => {
          newRowHouseLineSettingsSignal.value = { ...newRowHouseLineSettingsSignal.value, ...ls }
        }}
        lineSettings={indeterminate.makeIndeterminateObject(lineSettings)}
      />
      <hr className={styles.Divider} />
      <p className={styles.SubHeader}>{t(($) => $.rowhouse.plural)}</p>
      <TemplateList
        templates={CurrentTemplate.templateSignal.value ? [CurrentTemplate.templateSignal.value] : []}
        onClickTemplate={onClickTemplate}
        isTemplateInUseForSelection={() => ({ inUse: false })}
      />

      {clickedTemplate && (
        <RowHouseTypologiesPopup
          onSelectTemplate={CurrentTemplate.setTemplate}
          initialTemplate={clickedTemplate}
          close={onClosePopup}
          getTemplateUsage={(template) =>
            template === CurrentTemplate.templateSignal.value ? { inUse: true, comparison: "EQUAL" } : { inUse: false }
          }
        />
      )}
    </PropertyPanel.BorderContainer>
  )
}

function useRelease() {
  const selectedNodes = selectedNodesSignal.value
  const proposal = elementState.currentProposalSignal.value

  const actionAPI = useActionAPI()

  const compositionElementsToRelease = useMemo(() => {
    return uniq(
      selectedNodes
        .map((node) => {
          if (node.element == null) return
          if (isCompositionElement(node.element)) {
            return node.path
          }
        })
        .filter(isDefined),
    )
  }, [selectedNodes])

  const showRelease = useMemo(() => {
    return compositionElementsToRelease.length > 0
  }, [compositionElementsToRelease.length])

  const release = useCallback(() => {
    const actions: Action[] = []
    const newPaths: InternalPath[] = []
    const newChildren: { path: InternalPath; child: Child }[] = []
    compositionElementsToRelease.forEach((path) => {
      const element = proposal.snapshot.getNode(path)?.element
      if (element?.children) {
        newChildren.push(
          ...element.children.map((child) => {
            const transform = proposal.snapshot.getNodeOrThrow(path + "/" + child.key).globalMatrix
            return {
              child: { ...child, transform: transform.toArray() },
              path,
            }
          }),
        )
      }
      actions.push(...actionAPI.delete.one(path))
    })
    newChildren.forEach(({ child, path }) => {
      actions.push(
        ...actionAPI.add.one(proposal.snapshot.getFormaElementOrThrow(child.urn), false, {
          parentPath: getParentPath(path),
          child,
        }),
      )
    })
    batch(() => {
      setSelectionSetSignalValue(new Set(newPaths))
      actionAPI.apply("Release parcel element from line ", actions)
    })
  }, [compositionElementsToRelease, actionAPI, proposal.snapshot])
  if (!showRelease) return undefined
  return release
}

export function EditCompositionWrapper({ path }: { path: InternalPath }) {
  const proposal = elementState.currentProposalSignal.value

  const element = useMemo(() => {
    const element = proposal.snapshot.getNode(path)?.element
    if (!isCompositionElement(element)) {
      console.error("Not a composing element")
      exitCurrentTool()
      return undefined
    }
    return element
  }, [path, proposal.snapshot])

  const compositionElements = useMemo(() => {
    if (!element) return undefined
    return [{ element, path }]
  }, [element, path])

  if (!compositionElements) return null

  return <EditCompositionPanel compositionElements={compositionElements} />
}
