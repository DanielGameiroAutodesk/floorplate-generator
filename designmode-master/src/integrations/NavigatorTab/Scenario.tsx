import { useState } from "preact/hooks"
import styles from "./Scenario.module.css"
import { proposalScenarioInfoSignal } from "src/integrations/Scenarios/scenarioSelectors"
import { SITE_DESIGN_AUTHORING_ENGINE, loadScenario } from "src/integrations/Scenarios/scenario"
import useLazyLoadScript from "src/lib/useLazyLoadScript"
import type { StandardHostV1 } from "./scenario-model-list"
import { scenarioStateSignal } from "src/integrations/Scenarios/scenario"

/**
 * @deprecated This component is getting deprecated. `ScenarioModelList` is used as Modal.
 */
export function Scenario() {
  const proposalScenarioInfo = proposalScenarioInfoSignal.value
  const isLoaded = useLazyLoadScript("/web-components/scenario-model-list/scenario-model-list.js", "design-mode")
  const scenarioData = scenarioStateSignal.value
  const [isSyncingModel, setIsSyncingModel] = useState(false)

  const refreshScenarioData = () => {
    setIsSyncingModel(true)
    void loadScenario().finally(() => setIsSyncingModel(false))
  }

  if (!proposalScenarioInfo || !scenarioData) {
    return null
  }
  const activeModel = scenarioData.scenario.models?.filter(
    (model) => model.authoringEngine === SITE_DESIGN_AUTHORING_ENGINE,
  )[0]

  const activeModels = activeModel
    ? [
        {
          hubId: scenarioData.scenario.scenario.hubId,
          projectId: activeModel.accProjectId,
          fileLineageUrn: activeModel.fileUrn,
          fileVersionUrn: activeModel.fileUrn, //for future support of file versioning
          parentFolderUrn: scenarioData.scenario.scenario.folderUrn, //TODO: not needed for scenario model list - will be removed
        },
      ]
    : []

  return (
    <div className={styles.ScenarioContainer}>
      <h3 className={styles.Header}>Scenario</h3>
      {!isLoaded && <div>Loading...</div>}
      {isLoaded && (
        <scenario-model-list
          ouiContext={{ ouiHostId: SITE_DESIGN_AUTHORING_ENGINE }}
          //TODO: code up which operations are supported by site design
          modelListPanel={{
            supportedOperations: [],
          }}
          scenario={{
            projectId: scenarioData.scenario.scenario.accProjectId,
            fileLineageUrn: scenarioData.scenario.scenario.fileUrn,
            fileVersionUrn: scenarioData.scenario.scenario.fileUrn,
            scenarioId: scenarioData.scenario.scenario.id,
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
      )}
    </div>
  )
}
