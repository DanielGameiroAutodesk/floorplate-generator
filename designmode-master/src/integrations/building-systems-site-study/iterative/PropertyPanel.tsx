import { type Signal, useComputed } from "@preact/signals"
import { useErrorBoundary, useMemo } from "preact/hooks"
import { Matrix4, Vector3 } from "three"
import { captureException } from "@sentry/browser"
import { feetToMeter } from "@spacemakerai/forma-units"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

import { getTranslator, useTranslator } from "src/i18n/index"
import automationStyles from "src/lib/components/automations/AutomationPropertyPanel.module.pcss"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { type InternalPath, mergePath } from "src/lib/element/path"
import { elementState } from "src/core/elements/ElementState"
import { isDefined } from "src/lib/array"
import { WeaveInputComponent, withAccess, withImperial } from "src/lib/components/LengthInput/WeaveInputHelpers"
import Buffer16 from "src/lib/components/icons/Buffer_16"
import { useReadonlySignal } from "src/lib/signal"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import PropertyPanel from "src/lib/components/PropertyPanel"
import { Analytics } from "src/core/analytics"
import { useIsImperial } from "src/lib/unitSettings"

import type { IterativeExploreState } from "./explore-tool-state"
import { EditSimpleGraphV1Parameters, MultiGeneratorConfigPanel } from "./generators"
import {
  isSiteExploreAreaChildrenGeneratorElement,
  isSiteExploreAreaGraphGeneratorElement,
  SiteExploreArea,
  type SiteExploreAreaChildrenGeneratorElement,
} from "./site-explore-area"
import { createGraphWithEdgesWidth } from "./graph-utils"
import { ITERATIVE_EXPLORE_FEATURE_NAME } from "./constants"

type EditPropertyPanelProps = {
  path: InternalPath
  onRelease?: () => void
  onChange?: (area: SiteExploreArea) => void
  graphEditorSignal: Signal<IterativeExploreState>
  initGridTool: () => void
}

export function EditPropertyPanel({
  path,
  onRelease,
  onChange,
  graphEditorSignal,
  initGridTool,
}: EditPropertyPanelProps) {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("EditPropertyPanel error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "site-design", feature: "iterative-explore" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.siteStudy.errorOccurred), status: "warning" })
  })

  const pathSignal = useReadonlySignal(path)
  const nodeSignal = useComputed(() => elementState.currentSnapshot.value.getNode(pathSignal.value))

  const t = useTranslator()

  if (error) return null
  if (!nodeSignal.value) return null

  return (
    <PropertyPanel.BorderContainer>
      <PropertyPanel.AutomationHeader
        editAccess={canEditProposalSignal.value}
        title={t(($) => $.ui.siteLabel)}
        release={() => {
          if (onRelease) {
            Analytics.track(EventName.Edit, {
              feature_category: FeatureCategory.DesignTool,
              feature: ITERATIVE_EXPLORE_FEATURE_NAME,
              sub_feature: "release",
              object_type: "element",
            })
            onRelease()
          }
        }}
        releaseTooltip={t(($) => $.building.tooltips.releaseToZonesButton)}
      />
      <EditElementPanel
        node={nodeSignal.value}
        onChange={(area) => {
          if (onChange) onChange(area)
        }}
        graphEditorSignal={graphEditorSignal}
        initGridTool={initGridTool}
        disabled={onChange == null}
      />
    </PropertyPanel.BorderContainer>
  )
}

function EditElementPanel({
  node,
  onChange,
  graphEditorSignal,
  disabled,
  initGridTool,
}: {
  node: ChildNodeContainer
  onChange: (area: SiteExploreArea) => void
  disabled?: boolean
  graphEditorSignal: Signal<IterativeExploreState>
  initGridTool: () => void
}) {
  const imperialFlag = useIsImperial()
  const imperialFlagSignal = useReadonlySignal(imperialFlag)
  const nodeSignal = useReadonlySignal(node)
  const areaSignal = useComputed(() => SiteExploreArea.of(nodeSignal.value.elementContainer, imperialFlagSignal.value))
  if (isSiteExploreAreaGraphGeneratorElement(areaSignal.value.element)) {
    return (
      <GraphGeneratorElementEditor
        node={node}
        area={areaSignal.value}
        onChange={onChange}
        graphEditorSignal={graphEditorSignal}
        initGridTool={initGridTool}
        disabled={disabled}
      />
    )
  }
  return null
}

function GraphGeneratorElementEditor({
  node,
  area,
  onChange,
  graphEditorSignal,
  initGridTool,
  disabled,
}: {
  node: ChildNodeContainer
  area: SiteExploreArea
  onChange: (area: SiteExploreArea) => void
  graphEditorSignal: Signal<IterativeExploreState>
  initGridTool: () => void
  disabled?: boolean
}) {
  const t = useTranslator()
  const imperialFlag = useIsImperial()

  const currentSnapshot = elementState.currentSnapshot.value
  const state = graphEditorSignal.value

  // All selectable cells
  const selectableCells = useMemo(() => {
    return new Set(
      (area.element.children || [])
        .filter((child) => {
          const childNodePath = mergePath(node.path, child.key)
          const childNode = currentSnapshot.getNode(childNodePath)
          return childNode && isSiteExploreAreaChildrenGeneratorElement(childNode.element)
        })
        .map((child) => mergePath(node.path, child.key)),
    )
  }, [area.element.children, currentSnapshot, node.path])

  // All selected cells that are ensured to be selectable
  // if no cells are selected, all selectable cells are automatically selected
  const validSelectedCells = useMemo(() => {
    switch (state.type) {
      case "property-panel":
      case "set-grid-position":
        return selectableCells
      case "graph-editor": {
        const validCells = Array.from(state.selectedCells).filter((p) => selectableCells.has(p))
        if (validCells.length > 0) {
          return new Set(validCells)
        }
        return selectableCells
      }
    }
  }, [selectableCells, state])

  // Group elements with the same generator id for "multi-editing"
  const selectedCellElementsGroupedByGenerator = useMemo(() => {
    const currentSnapshot = elementState.currentSnapshot.peek()
    return Array.from(validSelectedCells)
      .map((cellPath): SiteExploreAreaChildrenGeneratorElement | undefined => {
        const element = currentSnapshot.getNode(cellPath)?.element
        if (!element || !isSiteExploreAreaChildrenGeneratorElement(element)) return undefined
        return element
      })
      .filter(isDefined)
      .reduce((acc, element) => {
        const elements = acc.get(element.properties.generator.generatorId) ?? []
        elements.push(element)
        acc.set(element.properties.generator.generatorId, elements)
        return acc
      }, new Map<SiteExploreAreaChildrenGeneratorElement["properties"]["generator"]["generatorId"], SiteExploreAreaChildrenGeneratorElement[]>())
  }, [validSelectedCells])

  const selectedCellsCount = Array.from(validSelectedCells).reduce((acc, [, elements]) => acc + elements.length, 0)

  const fallbackPreviewPolygon: [number, number][] = useMemo(
    () =>
      [new Vector3(0, 0), new Vector3(80, 0), new Vector3(80, 60), new Vector3(0, 60), new Vector3(0, 0)].map(
        (v) =>
          v
            .applyMatrix4(new Matrix4().makeRotationZ(-Math.PI / 6))
            .toArray()
            .slice(0, 2) as [number, number],
      ),
    [],
  )

  const element = area.element
  if (!isSiteExploreAreaGraphGeneratorElement(element)) return null

  const hasSelectedCellsSubset = selectedCellsCount > 0 && selectedCellsCount < selectableCells.size
  const defaultEdgeWidth = imperialFlag ? feetToMeter(40) : 12

  return (
    <>
      <PropertyPanel.SubHeader title={t(($) => $.automation.explore.layoutTitle)} />
      <EditSimpleGraphV1Parameters
        parameters={element.properties.generator.parameters}
        onChange={(parameters) => {
          // Changing properties on top level might make current selected cells disappear. Reset selection to tackle this
          if (graphEditorSignal.value.type === "graph-editor") {
            graphEditorSignal.value = { ...graphEditorSignal.value, selectedCells: new Set() }
          }
          onChange(area.withGeneratorConfig({ ...element.properties.generator, parameters }, imperialFlag))
        }}
        disabled={disabled || hasSelectedCellsSubset}
        graphEditorSignal={graphEditorSignal}
        initGridTool={initGridTool}
      />
      <div className={automationStyles.AutomationRow}>
        {/* TODO: For now the buffer width is set for the entire graph, but in near future
        we should let user set the width on individual edges (division lines).
        So here we are future proofing a bit by setting the same width on all all edges */}
        <BufferWidthParameter
          width={Object.values(element.properties.definingRepresentation.graph.edges)[0]?.width ?? defaultEdgeWidth}
          onChange={(bufferWidth) => {
            const graph = createGraphWithEdgesWidth(element.properties.definingRepresentation.graph, bufferWidth)
            onChange(area.withGraph(graph, imperialFlag))
          }}
          disabled={disabled || hasSelectedCellsSubset}
        />
      </div>
      <hr className={automationStyles.Divider} style={{ marginTop: "10px" }} />
      {Array.from(selectedCellElementsGroupedByGenerator.entries()).map(([generatorId, childElements]) => {
        const currentGeneratorConfigs = childElements.map((childElement) => childElement.properties.generator)
        return (
          <MultiGeneratorConfigPanel
            key={generatorId}
            generatorId={generatorId}
            generators={currentGeneratorConfigs}
            onChange={(updatedGeneratorConfigs) => {
              onChange(
                area.withChildElementsGeneratorConfig(
                  childElements.map((childElement, i) => ({
                    childElement,
                    generatorConfig: {
                      ...currentGeneratorConfigs[i],
                      ...updatedGeneratorConfigs[i],
                    },
                  })),
                  imperialFlag,
                ),
              )
            }}
            previewPolygon={
              childElements.length > 1
                ? fallbackPreviewPolygon
                : childElements[0].properties.generator.parameters.polygon
            }
            disabled={disabled}
          />
        )
      })}
    </>
  )
}

const BufferWidthInput = withAccess(withImperial(WeaveInputComponent))

function BufferWidthParameter({
  width,
  onChange,
  disabled,
}: {
  width: number
  onChange: (width: number) => void
  disabled?: boolean
}) {
  const t = useTranslator()
  const inputId = "site-explore-street-width-input"
  return (
    <div className={automationStyles.AutomationInputWithIcon}>
      <label htmlFor={inputId} className={automationStyles.AutomationIconLabel}>
        <weave-tooltip text={t(($) => $.vegetation.properties.bufferTooltip)}>
          <Buffer16 />
        </weave-tooltip>
      </label>
      <BufferWidthInput
        id={inputId}
        metricValue={width}
        onChangeValue={(width: number) => {
          Analytics.track(
            EventName.Edit,
            {
              feature_category: FeatureCategory.DesignTool,
              feature: ITERATIVE_EXPLORE_FEATURE_NAME,
              sub_feature: "buffer_width",
              object_type: "element",
            },
            { buffer_width: width },
          )
          onChange(width)
        }}
        editAccess={canEditProposalSignal.value}
        metricStep={0.5}
        metricMin={0}
        disabled={disabled}
      />
    </div>
  )
}
