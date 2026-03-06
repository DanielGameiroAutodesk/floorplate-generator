import { render } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import type { WeaveModalElement } from "src/lib/type-declarations/forma-declarations"
import { unitSettingsSignal } from "src/lib/unitSettings"
import { projectSignal } from "src/core/project/project"
import useLazyLoadScript from "src/lib/useLazyLoadScript"
import { createFilePlus, createScenario } from "src/integrations/spaces/spaceClient/spaceClientv4"
import { getScenarioProjectInfo } from "src/integrations/Scenarios/scenariosClient"

interface ContextualDataModalProps {
  onClose: () => void
}

type ScenarioReferenceState = {
  hubId: string
  projectId: string
  fileLineageUrn: string
  fileVersionUrn: string
  parentFolderUrn: string
  scenarioId: string
} | null

async function createNewScenario(): Promise<ScenarioReferenceState> {
  const project = projectSignal.peek()
  if (!project?.unifiedProjectId) {
    console.error("No unified project ID available")
    return null
  }

  // Get ACC project info (accProjectId and folderId)
  const projectInfo = await getScenarioProjectInfo(project.unifiedProjectId)
  const { accProjectId, folderId } = projectInfo

  // Generate a unique suffix for the names
  const uniqueSuffix = crypto.randomUUID().slice(0, 8)
  const filePlusName = `Contextual Data Scenario ${uniqueSuffix}`
  const scenarioName = `Contextual Data ${uniqueSuffix}`

  // Create a File+ document for the scenario
  const filePlusResponse = await createFilePlus({
    projectId: accProjectId,
    folderId: folderId,
    name: filePlusName,
    contentType: "application/vnd.autodesk.space+aecdm",
  })

  const { fileUrn } = filePlusResponse

  // Create a scenario within the File+
  const scenarioResponse = await createScenario({
    projectId: accProjectId,
    fileUrn,
    name: scenarioName,
    models: [],
  })

  return {
    hubId: scenarioResponse.hubId,
    projectId: accProjectId,
    fileLineageUrn: fileUrn,
    fileVersionUrn: "not_needed_for_context_service",
    parentFolderUrn: scenarioResponse.folderUrn,
    scenarioId: scenarioResponse.id,
  }
}

function ContextualDataModal({ onClose }: ContextualDataModalProps) {
  const modalRef = useRef<WeaveModalElement>(null)
  const isLoaded = useLazyLoadScript("/context-service-ui/r3/web-components.js", "design-mode")
  const unitSystem = unitSettingsSignal.value?.lengthUnit

  const [scenarioState, setScenarioState] = useState<ScenarioReferenceState>(null)
  const [isLoadingScenario, setIsLoadingScenario] = useState(true)

  useEffect(() => {
    createNewScenario()
      .then((state) => {
        setScenarioState(state)
        setIsLoadingScenario(false)
      })
      .catch((error) => {
        console.error("Failed to create scenario:", error)
        setIsLoadingScenario(false)
      })
  }, [])

  const isReady = isLoaded && !isLoadingScenario && scenarioState !== null

  return (
    <weave-modal width="1400px" height="900px" ref={modalRef} hideclose={false} onClose={onClose} open={true}>
      <p slot="title">Order contextual data</p>
      <div
        slot="content"
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          overflow: "hidden",
          margin: 0,
          padding: 0,
          boxSizing: "border-box",
        }}
      >
        {!isReady && <div>Loading...</div>}
        {isReady && scenarioState && (
          <forma-context-service
            ouiContext={{
              ouiHostId: "site-design",
              ouiEnv: "prd",
            }}
            standardHostV1={{
              settings: {
                theme: "light",
                locale: "en-US",
                region: "USA",
                density: "medium",
                canProvideTransparentHostWindow: false,
              },
            }}
            settingsV1={{
              unitSystem: unitSystem === "m" ? "metric" : "imperial",
            }}
            scenarioReferenceV1={{
              hubId: scenarioState.hubId,
              projectId: scenarioState.projectId,
              fileLineageUrn: scenarioState.fileLineageUrn,
              fileVersionUrn: scenarioState.fileVersionUrn,
              parentFolderUrn: scenarioState.parentFolderUrn,
              scenarioId: scenarioState.scenarioId,
            }}
            activeModelsV1={{
              activeModels: [],
              geolocations: [],
            }}
            microAppManagementV1={{
              disableState: false,
            }}
            contextualDataV1={
              projectSignal.value?.geoLocation
                ? {
                    geolocation: {
                      latitude: projectSignal.value.geoLocation[0],
                      longitude: projectSignal.value.geoLocation[1],
                    },
                  }
                : {}
            }
            onCloseSelf={() => onClose()}
            onModelComplete={(e: any) => {
              console.log(e)
              // refresh terrain state,
              // get new scenario models,
              // move the model if new geoLocation is set by contextual data
            }}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>
    </weave-modal>
  )
}

export function showContextualDataModal(): Promise<void> {
  return new Promise<void>((resolve) => {
    const container = document.createElement("div")
    document.body.appendChild(container)

    const handleClose = () => {
      render(null, container)
      document.body.removeChild(container)
      resolve()
    }

    render(<ContextualDataModal onClose={handleClose} />, container)
  })
}
