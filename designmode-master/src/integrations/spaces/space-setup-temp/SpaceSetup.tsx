import { useCallback, useEffect, useState } from "preact/hooks"
import {
  type AccHub,
  type ACCProject,
  getHubs,
  getProjectFolderData,
  getProjects,
  getUserinfo,
  type ProjectFolderData,
} from "./accClient"
import styles from "./HubPicker.module.pcss"
import {
  createFilePlus,
  createScenario,
  deleteScenarioModel,
  getScenario,
  type GetScenarioResponse,
  listScenariosInProject,
  type ScenarioResponse,
} from "src/integrations/spaces/spaceClient/spaceClientv4"
import { useTranslator } from "src/i18n"
import { SITE_DESIGN_AUTHORING_ENGINE } from "src/integrations/Scenarios/scenario"

export const SpaceSetup = () => {
  const t = useTranslator()
  const [hubs, setHubs] = useState<AccHub[]>([])
  const [selectedHub, setSelectedHub] = useState<AccHub | null>(null)
  const [selectedProjects, setSelectedProjects] = useState<ACCProject[]>([])
  const [selectedProject, setSelectedProject] = useState<ACCProject | null>(null)
  const [projectFolderData, setProjectFolderData] = useState<ProjectFolderData | null>(null)
  const [existingSpaces, setExistingSpaces] = useState<ScenarioResponse[]>([])
  const [selectedSpace, setSelectedSpace] = useState<ScenarioResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false)
  const [isCreatingSpace, setIsCreatingSpace] = useState(false)
  const [creationCounter, setCreationCounter] = useState(0)
  const [spaceName, setSpaceName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isInternalUser, setIsInternalUser] = useState(false)
  const [scenarioData, setScenarioData] = useState<GetScenarioResponse | null>(null)
  const [isLoadingScenario, setIsLoadingScenario] = useState(false)
  const [hasExistingSiteDesign, setHasExistingSiteDesign] = useState(false)
  const [isDeletingSiteDesign, setIsDeletingSiteDesign] = useState(false)
  // Redirect to home if not internal user

  useEffect(() => {
    void getUserinfo().then(({ email }: { email: string }) => {
      const isInternalUser = email.endsWith("@autodesk.com")
      if (!isInternalUser && window.location.search !== "") {
        window.location.href = window.location.origin + window.location.pathname
      } else {
        setIsInternalUser(isInternalUser)
      }
    })
  }, [setIsInternalUser])

  const fetchAccHubs = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await getHubs()
      setHubs(response.data)
    } catch (err) {
      setError("Failed to load hubs. Please try again.")
      console.error("Error fetching hubs:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAccHubs()
  }, [fetchAccHubs])

  // Counter effect for space creation
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isCreatingSpace) {
      interval = setInterval(() => {
        setCreationCounter((prev) => prev + 1)
      }, 1000)
    } else {
      setCreationCounter(0)
    }
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isCreatingSpace])

  useEffect(() => {
    if (existingSpaces && selectedSpace) {
      setIsLoadingScenario(true)
      getScenario({
        projectId: selectedSpace.accProjectId,
        scenarioId: selectedSpace.id,
        fileUrn: selectedSpace.fileUrn,
      })
        .then((scenario) => {
          if (scenario) {
            setScenarioData(scenario)
          }
        })
        .catch((err) => {
          console.error("Failed to load scenario:", err)
        })
        .finally(() => {
          setIsLoadingScenario(false)
        })
    }
  }, [selectedSpace, existingSpaces])

  useEffect(() => {
    if (scenarioData) {
      const existingSiteDesign = scenarioData.models.find((m) => m.authoringEngine === SITE_DESIGN_AUTHORING_ENGINE)
      setHasExistingSiteDesign(!!existingSiteDesign)
    } else {
      setHasExistingSiteDesign(false)
    }
  }, [scenarioData])

  const handleHubSelect = useCallback(
    async (hubId: string) => {
      const hub = hubs.find((h) => h.id === hubId)
      if (!hub) return

      setSelectedHub(hub)
      setSelectedProject(null)
      setSelectedProjects([])
      setProjectFolderData(null)
      setScenarioData(null)

      setIsLoadingProjects(true)
      try {
        const projects = await getProjects(hub.attributes.sourceId)
        setSelectedProjects(projects.data)
      } catch (err) {
        setError("Failed to load projects. Please try again.")
        console.error("Error fetching projects:", err)
      } finally {
        setIsLoadingProjects(false)
      }
    },
    [hubs],
  )

  const handleProjectSelect = useCallback(
    async (projectId: string) => {
      const project = selectedProjects.find((p) => p.id === projectId)
      if (!project || !selectedHub) return

      setSelectedProject(project)
      setProjectFolderData(null)
      setExistingSpaces([])
      setSelectedSpace(null)
      setScenarioData(null)

      setIsLoadingFolders(true)
      try {
        const folderData = await getProjectFolderData(project)
        setProjectFolderData(folderData)
        console.log("Selected project:", project)
        console.log("Project folder data:", folderData)

        // Fetch existing spaces if we have the required data
        if (folderData.projectFilesFolder) {
          setIsLoadingSpaces(true)
          try {
            const accProjectId = project.id.startsWith("b.") ? project.id.slice(2) : project.id

            // Use v4 API to list all scenarios in the project
            const scenarios = await listScenariosInProject({ projectId: accProjectId })
            setExistingSpaces(scenarios)
            console.log("Existing spaces (scenarios):", scenarios)
          } catch (spacesErr) {
            console.warn("Failed to load existing spaces:", spacesErr)
            // Don't set error for spaces loading failure, just log it
          } finally {
            setIsLoadingSpaces(false)
          }
        }
      } catch (err) {
        setError("Failed to load project folders. Please try again.")
        console.error("Error fetching project folders:", err)
      } finally {
        setIsLoadingFolders(false)
      }
    },
    [selectedProjects, selectedHub],
  )

  const handleCreateSpace = useCallback(async () => {
    if (!selectedHub || !selectedProject || !projectFolderData?.projectFilesFolder) {
      console.error("Missing required data for space creation")
      return
    }

    // Extract the required IDs
    const accProjectId = selectedProject.id.startsWith("b.") ? selectedProject.id.slice(2) : selectedProject.id
    const accFolderId = projectFolderData.projectFilesFolder.id

    setIsCreatingSpace(true)
    setError(null)

    try {
      // Step 1: Create a File+ document
      const filePlusResponse = await createFilePlus({
        projectId: accProjectId,
        folderId: accFolderId,
        name: spaceName.trim() || "Site Design Scenario",
        contentType: "application/vnd.autodesk.space+aecdm",
      })

      const { fileUrn } = filePlusResponse

      // Step 2: Create a scenario in the File+
      const scenarioResponse = await createScenario({
        projectId: accProjectId,
        fileUrn,
        name: spaceName.trim() || "Site Design Scenario",
        models: [], // Start with no models
      })

      const { id: scenarioId } = scenarioResponse
      window.location.href = `/designmode/?scenarios&scenarioId=${encodeURIComponent(scenarioId)}&accProjectId=${encodeURIComponent(accProjectId)}&fileUrn=${encodeURIComponent(fileUrn)}`
    } catch (error) {
      console.error("Failed to create space:", error)
      setError("Failed to create space. Please try again.")
    } finally {
      setIsCreatingSpace(false)
    }
  }, [selectedHub, selectedProject, projectFolderData, spaceName])

  const handleExistingSpaceSelect = useCallback(
    (spaceId: string) => {
      const space = existingSpaces.find((s) => s.id === spaceId)
      if (!space || !selectedHub || !selectedProject || !projectFolderData?.projectFilesFolder) {
        console.error("Missing required data for existing space selection")
        return
      }

      setSelectedSpace(space)

      try {
        const accHubId = selectedHub.attributes.sourceId
        const accProjectId = selectedProject.id.startsWith("b.") ? selectedProject.id.slice(2) : selectedProject.id
        const accFolderId = projectFolderData.projectFilesFolder.id
        const authContext = `doc_${accProjectId}_${space.fileId}`

        const path = `/designmode/${authContext}`
        const queryParams = new URLSearchParams()
        queryParams.set("scenarioId", space.id) // Use scenario id directly
        queryParams.set("fileUrn", space.fileUrn)
        queryParams.set("accHubId", accHubId)
        queryParams.set("accProjectId", accProjectId)
        queryParams.set("accFolderId", accFolderId)
        const redirectUrl = `${path}?${queryParams.toString()}`
        window.location.href = redirectUrl
      } catch (error) {
        console.error("Failed to navigate to existing space:", error)
        setError("Failed to open existing space. Please try again.")
      }
    },
    [existingSpaces, selectedHub, selectedProject, projectFolderData],
  )

  const handleDeleteScenario = useCallback(() => {
    if (scenarioData) {
      const existingSiteDesign = scenarioData.models.find((m) => m.authoringEngine === SITE_DESIGN_AUTHORING_ENGINE)

      const existingSiteDesignReference = scenarioData.scenario.models?.find((m) => m.id === existingSiteDesign?.id)
      if (existingSiteDesignReference && existingSiteDesignReference.referenceId) {
        setIsDeletingSiteDesign(true)
        deleteScenarioModel({
          scenarioId: scenarioData.scenario.id,
          fileUrn: scenarioData.scenario.fileUrn,
          projectId: scenarioData.scenario.accProjectId,
          referenceId: existingSiteDesignReference.referenceId,
        })
          .catch((err) => {
            console.error("Failed to delete scenario:", err)
          })
          .finally(() => {
            // After a delete refresh the scenarios
            listScenariosInProject({ projectId: scenarioData.scenario.accProjectId })
              .then((scenarios) => setExistingSpaces(scenarios))
              .catch((err) => {
                console.error("Failed to update scenario list:", err)
              })
              .finally(() => setIsDeletingSiteDesign(false))
          })
      }
    }
  }, [scenarioData])

  return (
    <>
      {isInternalUser ? (
        <div className={styles.HubPickerContainer}>
          <div className={styles.HubPickerTitle}>Select a Hub</div>

          <div className={styles.HubPickerContent}>
            {isLoading && <div className={styles.LoadingMessage}>Loading hubs...</div>}

            {error && <div className={styles.ErrorMessage}>{error}</div>}

            {!isLoading && !error && hubs.length === 0 && (
              <div className={styles.LoadingMessage}>No hubs available</div>
            )}

            {!isLoading && !error && hubs.length > 0 && (
              <div className={styles.DropdownContainer}>
                <div className={styles.DropdownGroup}>
                  <label htmlFor="hub-select" className={styles.DropdownLabel}>
                    Select Hub:
                  </label>
                  <select
                    id="hub-select"
                    className={styles.DropdownSelect}
                    value={selectedHub?.id || ""}
                    onChange={(e) => {
                      const target = e.target as HTMLSelectElement
                      if (target.value) {
                        void handleHubSelect(target.value)
                      }
                    }}
                  >
                    <option value="">-- Choose a hub --</option>
                    {hubs.map((hub) => (
                      <option key={hub.id} value={hub.id}>
                        {hub.attributes.hubName || hub.attributes.teamName}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedHub && (
                  <div className={styles.DropdownGroup}>
                    <label htmlFor="project-select" className={styles.DropdownLabel}>
                      Select Project:
                    </label>
                    {isLoadingProjects ? (
                      <div className={styles.LoadingMessage}>Loading projects...</div>
                    ) : (
                      <select
                        id="project-select"
                        className={styles.DropdownSelect}
                        value={selectedProject?.id || ""}
                        onChange={(e) => {
                          const target = e.target as HTMLSelectElement
                          if (target.value) {
                            void handleProjectSelect(target.value)
                          }
                        }}
                        disabled={selectedProjects.length === 0}
                      >
                        <option value="">-- Choose a project --</option>
                        {selectedProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.attributes.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {selectedProject && (
                  <div className={styles.DropdownGroup}>
                    <div className={styles.DropdownLabel}>Project Folders:</div>
                    {isLoadingFolders ? <div className={styles.LoadingMessage}>Loading folders...</div> : null}
                    {projectFolderData?.projectFilesFolder ? (
                      <div>{t(($) => $.resources.defaultFolderDescription)}</div>
                    ) : null}
                  </div>
                )}

                {selectedProject && projectFolderData?.projectFilesFolder && (
                  <div className={styles.DropdownGroup}>
                    <div className={styles.DropdownLabel}>Existing Spaces:</div>
                    {isLoadingSpaces ? (
                      <div className={styles.LoadingMessage}>Loading existing spaces...</div>
                    ) : existingSpaces.length > 0 ? (
                      <>
                        <div>
                          <select
                            className={styles.DropdownSelect}
                            value={selectedSpace?.id || ""}
                            onChange={(e) => {
                              const target = e.target as HTMLSelectElement
                              if (target.value) {
                                const space = existingSpaces.find((s) => s.id === target.value)
                                setSelectedSpace(space || null)
                              } else {
                                setSelectedSpace(null)
                              }
                            }}
                          >
                            <option value="">-- Choose an existing space --</option>
                            {[...existingSpaces]
                              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                              .map((space) => (
                                <option key={space.id} value={space.id}>
                                  {space.name} (Models: {space.modelCount ?? 0}, Updated:{" "}
                                  {new Date(space.updatedAt).toLocaleDateString()})
                                </option>
                              ))}
                          </select>
                          <div style={{ marginTop: "8px", fontSize: "14px", color: "#666" }}>
                            Found {existingSpaces.length} existing space{existingSpaces.length !== 1 ? "s" : ""}
                          </div>
                          {selectedSpace && (
                            <button
                              className={styles.CreateSpaceButton}
                              onClick={() => handleExistingSpaceSelect(selectedSpace.id)}
                              style={{ marginTop: "12px" }}
                            >
                              Go to Space: {selectedSpace.name}
                            </button>
                          )}
                          {isLoadingScenario && <div className={styles.LoadingMessage}>Loading scenario data...</div>}
                          {scenarioData && hasExistingSiteDesign && (
                            <>
                              <div style={{ fontSize: "14px", color: "#666" }}>Found existing site design</div>
                              <button
                                disabled={isDeletingSiteDesign}
                                className={styles.CreateSpaceButton}
                                onClick={() => handleDeleteScenario()}
                                style={{ marginTop: "12px" }}
                              >
                                Delete Site Design in scenario: {scenarioData.scenario.name}
                              </button>
                            </>
                          )}
                          {isDeletingSiteDesign && <div className={styles.LoadingMessage}>Deleting Site Design...</div>}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: "14px", color: "#666" }}>No existing spaces found</div>
                    )}
                  </div>
                )}

                {selectedProject && projectFolderData?.projectFilesFolder && (
                  <div className={styles.DropdownGroup}>
                    <div className={styles.DropdownLabel}>Or create a new space:</div>
                    <div style={{ marginBottom: "12px" }}>
                      <label htmlFor="space-name-input" className={styles.DropdownLabel}>
                        Space Name (optional):
                      </label>
                      <input
                        id="space-name-input"
                        type="text"
                        className={styles.DropdownSelect}
                        placeholder={t(($) => $.spaces.nameInputPlaceholder)}
                        value={spaceName}
                        onChange={(e) => setSpaceName((e.target as HTMLInputElement).value)}
                        disabled={isCreatingSpace}
                        style={{ marginTop: "4px" }}
                      />
                    </div>
                    <button
                      className={styles.CreateSpaceButton}
                      onClick={() => void handleCreateSpace()}
                      disabled={isLoadingFolders || isLoadingSpaces || isCreatingSpace}
                    >
                      {isCreatingSpace ? `Creating space... ${creationCounter}s` : "Create New Space"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
