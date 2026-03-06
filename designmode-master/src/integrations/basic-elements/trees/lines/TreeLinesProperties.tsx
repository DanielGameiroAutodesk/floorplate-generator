import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import { isDefined } from "src/lib/array"
import type { TreeLineConfig } from "./TreeLinesGenerator"
import { TreeLineConfigProperty } from "./TreeLinesGenerator"
import { scenarioModeSignal, selectionSetSignal } from "src/core/selection/selectionState"
import { defaultTreeLineConfig, getTreeInputConfigs } from "src/integrations/basic-elements/trees/defaults"
import { AnalyticsUtils } from "src/core/analytics"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import {
  VegetationAutomationPropertyPanel,
  VegetationLineProperties,
} from "src/integrations/basic-elements/trees/VegetationAutomationPropertyPanel"
import { useUpdateLineWidth } from "src/integrations/HandleProperties/LineWidthProperty"
import { currentLineWidth } from "src/integrations/HandleProperties/lineWidth"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import { WeaveInputComponent, withAccess, withImperial } from "src/lib/components/LengthInput/WeaveInputHelpers"
import { feetToMeter } from "src/lib/measurementSystem"
import styles from "src/lib/components/automations/AutomationPropertyPanel.module.pcss"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { elementState } from "src/core/elements/ElementState"
import { useComputed } from "@preact/signals"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

let debounce: NodeJS.Timeout | undefined

function useAllSelectedHasTreeLineNodes(): ChildNodeContainer[] {
  return useComputed(() => {
    const selection = selectionSetSignal.value
    if (selection.size === 0) return []

    const result: ChildNodeContainer[] = []

    const snapshot = elementState.currentSnapshot.value
    for (const item of selection) {
      const node = snapshot.getNode(item)
      if (!node) continue
      const element = node.elementContainer.element
      if (element.properties?.category !== "tree_line") return []
      result.push(node)
    }

    return result
  }).value
}

export const TreeLineProperties = () => {
  const nodes = useAllSelectedHasTreeLineNodes()
  return nodes.length > 0 ? <LineProperties nodes={nodes} /> : null
}

const LineProperties = ({ nodes }: { nodes: ChildNodeContainer[] }) => {
  const t = useTranslator()
  const imperialUnits = useIsImperial()
  const pathInfo = nodes
    .map(({ path, elementContainer }) => {
      const geojson = elementContainer.representations.footprint as BasicFeature
      if (!geojson) return
      return { path, element: elementContainer.element, geojson }
    })
    .filter(isDefined)
  const updateLineWidth = useUpdateLineWidth(pathInfo)

  const ActionAPI = useActionAPI()

  const [currentConfig, setCurrentConfig] = useState(defaultTreeLineConfig(imperialUnits))

  useEffect(() => {
    const selectedFirstConfig = nodes
      .map(({ elementContainer }) => elementContainer.element.properties?.[TreeLineConfigProperty])
      .filter(isDefined)[0] as TreeLineConfig

    if (selectedFirstConfig) setCurrentConfig(selectedFirstConfig)
  }, [nodes])

  const inScenario = AnalyticsUtils.trackedInScenarioFlag([scenarioModeSignal.value])
  const updateConfig = useCallback(
    (newCfg: TreeLineConfig) => {
      clearTimeout(debounce)
      const trackingData = {
        elementCategory: "tree_line",
        numElements: nodes.length,
        tool: "tree line properties",
        eventType: "update",
        inScenario,
      }

      const basicActions = nodes.map(({ path }) =>
        BasicElementAPI.updateProperties(path, {
          // TODO: Not sure why this cast is supposed to be safe.
          treeLineGenerator: newCfg as TreeLineConfig & { id: string },
        }),
      )

      const coreActions = BasicElementAPI.basicActionsToCoreActions(basicActions)
      ActionAPI.apply("Update tree line generator properties", coreActions, trackingData)
    },
    [nodes, inScenario, ActionAPI],
  )

  const onUpdateProperties = useCallback(
    (newProperties: Partial<TreeLineConfig>) => {
      const updatedCfg = {
        ...currentConfig,
        ...newProperties,
      }

      setCurrentConfig(updatedCfg)
      updateConfig(updatedCfg)
    },
    [currentConfig, updateConfig],
  )
  const lineWidth = currentLineWidth(pathInfo, imperialUnits)
  const inputConfigs = useMemo(() => getTreeInputConfigs(imperialUnits), [imperialUnits])

  return (
    <VegetationAutomationPropertyPanel>
      <VegetationLineProperties
        onUpdateVegetationProperties={onUpdateProperties}
        vegetationProperties={currentConfig}
        inputConfig={inputConfigs}
      />
      <div className={styles.AutomationRow}>
        <div className={styles.AutomationInputWithIcon}>
          <label htmlFor="lineWidth" className={styles.AutomationIconLabel}>
            <weave-tooltip text={t(($) => $.tooltips.lineWidth)}>
              <div style={{ width: "16px", height: "16px", display: "flex", justifyContent: "center" }}>W</div>
            </weave-tooltip>
          </label>
          <DistanceInput
            id={"lineWidth"}
            metricValue={lineWidth}
            onChangeValue={updateLineWidth}
            editAccess={canEditProposalSignal.value}
            metricMin={imperialUnits ? feetToMeter(4) : 1}
            isMixed={lineWidth === undefined}
          />
        </div>
      </div>
    </VegetationAutomationPropertyPanel>
  )
}

const DistanceInput = withAccess(withImperial(WeaveInputComponent))
