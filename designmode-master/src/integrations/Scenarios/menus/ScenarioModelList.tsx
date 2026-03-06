import { loadScenario, SITE_DESIGN_AUTHORING_ENGINE } from "src/integrations/Scenarios/scenario"
import { ClickOutside } from "src/lib/components/ClickOutside"
import type {
  ModelReference,
  ScenarioReference,
  StandardHostV1,
} from "src/integrations/NavigatorTab/scenario-model-list"
import { useState } from "preact/hooks"

interface ScenarioModelList {
  open: boolean
  onClickOutside: () => void
  scenarioData: ScenarioReference
  activeModels?: ModelReference[] | null
}
export function ScenarioModelList({ open, onClickOutside, scenarioData, activeModels = null }: ScenarioModelList) {
  const [isSyncingModel, setIsSyncingModel] = useState(false)

  const refreshScenarioData = () => {
    setIsSyncingModel(true)
    void loadScenario().finally(() => setIsSyncingModel(false))
  }

  return (
    <ClickOutside onClickOutside={onClickOutside} style={{ display: "inherit" }} useCapture>
      <weave-menu open={open} left={15} top={0} minwidth={260} maxwidth={260}>
        <scenario-model-list
          ouiContext={{ ouiHostId: SITE_DESIGN_AUTHORING_ENGINE }}
          //TODO: code up which operations are supported by site design
          modelListPanel={{
            supportedOperations: [],
          }}
          scenario={{
            projectId: scenarioData.projectId,
            fileLineageUrn: scenarioData.fileLineageUrn,
            fileVersionUrn: scenarioData.fileVersionUrn,
            scenarioId: scenarioData.scenarioId,
          }}
          //todo: might have to be set for region
          standardHost={{
            settings: {} as StandardHostV1["settings"],
          }}
          activeModels={{
            activeModels: activeModels,
          }}
          isSyncingModel={isSyncingModel}
          onNotifyScenarioUpdated={refreshScenarioData}
          // TODO: on disconnect we might want to have some special logic if it is about SD models
          onDisconnectScenario={refreshScenarioData}
        />
      </weave-menu>
    </ClickOutside>
  )
}
