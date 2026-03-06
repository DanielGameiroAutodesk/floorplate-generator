import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import {
  scenarioModeSignal,
  selectedPathsInCurrentProposalAsArraySignal,
  selectionSetSignal,
} from "src/core/selection/selectionState"
import type { TreeAreaConfig } from "./TreeAreaGenerator"
import { TreeAreaConfigProperty } from "./TreeAreaGenerator"
import { isDefined } from "src/lib/array"
import { defaultTreeAreaConfig, getTreeInputConfigs } from "src/integrations/basic-elements/trees/defaults"
import type { InternalPath } from "src/lib/element/path"
import { AnalyticsUtils } from "src/core/analytics"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import {
  VegetationAreaProperties,
  VegetationAutomationPropertyPanel,
} from "src/integrations/basic-elements/trees/VegetationAutomationPropertyPanel"
import { elementState } from "src/core/elements/ElementState"
import { useIsImperial } from "src/lib/unitSettings"

function useAllSelectedHasTreeArea(): boolean {
  const selection = selectedPathsInCurrentProposalAsArraySignal.value
  const snapshot = elementState.currentSnapshot.value

  return useMemo(() => {
    return (
      selection.length > 0 &&
      selection.every((path) => snapshot.getNode(path)?.element.properties?.category === "tree_area")
    )
  }, [selection, snapshot])
}

export const TreeAreaProperties = () => {
  const showProperties = useAllSelectedHasTreeArea()
  const paths = selectionSetSignal.value

  return showProperties ? <AreaProperties paths={Array.from(paths)} /> : null
}
let debounce: NodeJS.Timeout | undefined

const AreaProperties = ({ paths }: { paths: InternalPath[] }) => {
  const toplevelNodes = elementState.currentProposalSignal.value
    .getToplevelNodes()
    .filter((tl) => paths.includes(tl.path))

  const ActionAPI = useActionAPI()

  const imperialUnits = useIsImperial()
  const [currentConfig, setCurrentConfig] = useState(defaultTreeAreaConfig(imperialUnits))

  useEffect(() => {
    const selectedFirstConfig = toplevelNodes
      .map((node) => node.elementContainer.element.properties?.[TreeAreaConfigProperty])
      .filter(isDefined)[0] as TreeAreaConfig

    if (selectedFirstConfig) setCurrentConfig(selectedFirstConfig)
  }, [paths, toplevelNodes])

  const inScenario = AnalyticsUtils.trackedInScenarioFlag([scenarioModeSignal.value])
  const updateConfig = useCallback(
    (newCfg: TreeAreaConfig) => {
      debounce && clearTimeout(debounce)

      let trackingData = {
        elementCategory: "tree_area",
        numElements: paths.length,
        tool: "tree area properties",
        eventType: "update",
        inScenario,
      }

      const basicActions = toplevelNodes.map(({ path }) =>
        BasicElementAPI.updateProperties(path, {
          // TODO: Not sure why this cast is supposed to be safe.
          treePlacerGenerator: newCfg as TreeAreaConfig & { id: string },
        }),
      )
      const coreActions = BasicElementAPI.basicActionsToCoreActions(basicActions)
      ActionAPI.apply("Update tree area generator properties", coreActions, trackingData)
    },
    [paths.length, inScenario, toplevelNodes, ActionAPI],
  )

  const onUpdateProperties = useCallback(
    (newCfg: TreeAreaConfig) => {
      setCurrentConfig(newCfg)
      updateConfig(newCfg)
    },
    [updateConfig],
  )

  const inputConfigs = useMemo(() => getTreeInputConfigs(imperialUnits), [imperialUnits])

  return (
    <VegetationAutomationPropertyPanel>
      <VegetationAreaProperties
        vegetationProperties={currentConfig}
        onUpdateVegetationProperties={onUpdateProperties}
        inputConfig={inputConfigs}
      />
    </VegetationAutomationPropertyPanel>
  )
}
