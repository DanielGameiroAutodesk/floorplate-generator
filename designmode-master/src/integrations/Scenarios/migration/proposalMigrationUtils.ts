import type { FormaElement, Urn } from "forma-elements"
import { Mesh } from "three"
import type { BufferGeometry } from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { BufferGeometryUtils } from "three/examples/jsm/Addons.js"
import { projectSignal } from "src/core/project/project"
import { downloadAllElementData } from "src/core/elements-loading/downloadAllElementData"
import { newId, parseUrn } from "src/lib/element/urn"
import {
  createFilePlus,
  createModel,
  createScenario,
  uploadToBinaryStore,
  type ModelResponse,
} from "src/integrations/spaces/spaceClient/spaceClientv4"
import {
  INTERNAL_MODEL_REFERENCE_SITE_DESIGN,
  INTERNAL_MODEL_REFERENCE_SITE_DESIGN_TERRAIN,
  SITE_DESIGN_AUTHORING_ENGINE,
  SITE_DESIGN_SCENARIO_BASE_MODEL_NAME,
  SITE_DESIGN_SCENARIO_TERRAIN_MODEL_NAME,
} from "src/integrations/Scenarios/scenario"
import { getScenarioProjectInfo } from "src/integrations/Scenarios/scenariosClient"
import { getGeolocationForSiteDesignSpaceModel } from "src/integrations/spaces/geolocation"
import type { RepresentationTerrainSurface } from "src/integrations/Scenarios/terrainSchema"

/**
 * Update a proposal's properties to include the scenarioId, accProjectId, and fileUrn
 */
async function updateProposalWithScenarioId(
  proposalUrn: Urn,
  scenarioId: string,
  accProjectId: string,
  fileUrn: string,
  nextRevision: string,
): Promise<void> {
  const { authcontext, id: proposalId, revision: currentRevision } = parseUrn(proposalUrn)

  // Fetch the current proposal element
  const getResponse = await fetch(`/api/proposal/elements/${proposalId}?authcontext=${authcontext}&version=2`)
  if (!getResponse.ok) {
    throw new Error(`Failed to fetch proposal: ${getResponse.status} ${getResponse.statusText}`)
  }
  const proposalElement = await getResponse.json()

  // Update properties with scenarioId and accProjectId
  const element = proposalElement[proposalUrn]
  const updatedProposal: FormaElement = {
    ...element,
    properties: {
      ...element.properties,
      scenario: {
        scenarioId,
        accProjectId,
        fileUrn,
      },
    },
  }
  // PUT the updated proposal
  try {
    await fetch(
      `/api/proposal/elements/${proposalId}/revisions/${currentRevision}?version=2&authcontext=${authcontext}&nextRevision=${nextRevision}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProposal),
      },
    ).then((res) => res.json())
  } catch (error) {
    throw new Error(`Failed to update proposal with scenario: ${getErrorMessage(error)}`)
  }
}

/**
 * Check if an element has category "group"
 */
function isGroupCategory(element: FormaElement): boolean {
  return element.properties?.category?.toLowerCase() === "group"
}

/**
 * Recursively collect all element URNs from a proposal, excluding groups
 */
function collectElementUrns(
  element: FormaElement,
  elementsMap: Map<Urn, { element: FormaElement }>,
  collectedUrns: Set<Urn>,
): void {
  // Skip group elements
  if (isGroupCategory(element)) {
    // Still traverse children of groups, but don't collect the group itself
    for (const child of element.children ?? []) {
      const childElement = elementsMap.get(child.urn)?.element
      if (childElement) {
        collectElementUrns(childElement, elementsMap, collectedUrns)
      }
    }
    return
  }

  collectedUrns.add(element.urn)

  // Recurse into children
  for (const child of element.children ?? []) {
    const childElement = elementsMap.get(child.urn)?.element
    if (childElement) {
      collectElementUrns(childElement, elementsMap, collectedUrns)
    }
  }
}

/**
 * Convert a BufferGeometry to a GLB ArrayBuffer
 */
async function geometryToGlb(geometry: BufferGeometry): Promise<Uint8Array> {
  const exportMesh = new Mesh(geometry.clone())
  // Convert Z-up to Y-up for GLB format
  exportMesh.geometry.rotateX(-Math.PI / 2)

  const glbArrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
    new GLTFExporter().parse(exportMesh, (result) => resolve(result as ArrayBuffer), reject, { binary: true })
  })

  return new Uint8Array(glbArrayBuffer)
}

export function generateShortId() {
  return Math.random().toString(36).substring(2, 8)
}

/**
 * Get GLBs for a single proposal by URN
 */
export async function getProposalGLbsByUrn(proposalUrn: Urn): Promise<Map<string, Uint8Array>> {
  // Download all element data for this proposal
  const { elements, representations } = await downloadAllElementData(new Set([proposalUrn]))

  // Collect all non-group element URNs
  const proposalElement = elements.get(proposalUrn)?.element
  if (!proposalElement) {
    throw new Error(`Could not find proposal element for URN: ${proposalUrn}`)
  }

  const elementUrns = new Set<Urn>()
  collectElementUrns(proposalElement, elements, elementUrns)

  // Group elements with geometry by system
  const geometriesBySystem = new Map<string, BufferGeometry[]>()

  for (const urn of elementUrns) {
    const element = elements.get(urn)?.element
    if (!element) continue

    // Skip group elements (double-check)
    if (isGroupCategory(element)) continue

    // Get the element system from URN
    const { system } = parseUrn(urn)

    // Get the volumeMesh representation
    const volumeMesh = representations.volumeMesh.get(urn)
    if (!volumeMesh) continue

    // Clone the geometry
    const geometry = volumeMesh.clone()

    // Add to system group
    if (!geometriesBySystem.has(system)) {
      geometriesBySystem.set(system, [])
    }
    geometriesBySystem.get(system)!.push(geometry)
  }

  // Merge geometries per system and convert to GLB
  const glbsBySystem = new Map<string, Uint8Array>()

  for (const [system, geometries] of geometriesBySystem) {
    if (geometries.length === 0) continue

    // Merge all geometries for this system
    const mergedGeometry = geometries.length === 1 ? geometries[0] : BufferGeometryUtils.mergeGeometries(geometries)

    if (!mergedGeometry) {
      console.warn(`Failed to merge geometries for system: ${system}`)
      continue
    }

    // Convert to GLB
    const glb = await geometryToGlb(mergedGeometry)
    glbsBySystem.set(system, glb)
  }

  return glbsBySystem
}

export type MigrationItemStatus = "pending" | "migrating" | "success" | "error" | "skipped"

export type MigrationItemResult = {
  urn: Urn
  name: string
  status: MigrationItemStatus
  error?: string
  // Populated on success - scenario info for redirect
  scenarioId?: string
  fileUrn?: string
  accProjectId?: string
}

export type MigrationProgress = {
  current: number
  total: number
  currentProposalName: string
  status: "pending" | "migrating" | "completed"
  successCount: number
  errorCount: number
  skippedCount: number
  results: MigrationItemResult[]
}

export type MigrationResult = {
  total: number
  successCount: number
  errorCount: number
  skippedCount: number
  results: MigrationItemResult[]
  accProjectId?: string
}

export type ProposalInfo = {
  urn: Urn
  name: string
}

/**
 * Get the folder ID and ACC project ID for the current project
 */
async function getProjectFolderInfo() {
  const unifiedProjectId = projectSignal.peek()?.unifiedProjectId
  if (!unifiedProjectId) {
    throw new Error("No unified project ID available")
  }
  return getScenarioProjectInfo(unifiedProjectId)
}

/**
 * Extract a user-friendly error message from an error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for common error types and provide better messages
    if (error.message.includes("fetch")) {
      return "Network error - please check your connection"
    }
    if (error.message.includes("401") || error.message.includes("403")) {
      return "Authorization error - you may not have permission"
    }
    if (error.message.includes("404")) {
      return "Resource not found"
    }
    if (error.message.includes("500")) {
      return "Server error - please try again later"
    }
    return error.message
  }
  return "An unknown error occurred"
}

/**
 * Migrate selected proposals to scenarios
 * @param proposalUrns - Array of proposal URNs to migrate
 * @param proposalNames - Optional map of URN to proposal name for better error reporting
 * @param onProgress - Callback for progress updates
 * @returns Migration result with success/failure details
 */
export async function migrateProposalsToScenarios(
  proposalUrns: Urn[],
  proposalNames?: Map<Urn, string>,
  onProgress?: (progress: MigrationProgress) => void,
): Promise<MigrationResult> {
  const total = proposalUrns.length
  const results: MigrationItemResult[] = []
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  // Get folder info for the current project - fail early if this doesn't work
  let accProjectId: string
  let folderId: string
  try {
    const folderInfo = await getProjectFolderInfo()
    accProjectId = folderInfo.accProjectId
    folderId = folderInfo.folderId
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    // If we can't get project info, mark all as failed
    for (const urn of proposalUrns) {
      const name = proposalNames?.get(urn) ?? "Unknown Proposal"
      results.push({
        urn,
        name,
        status: "error",
        error: `Failed to get project info: ${errorMessage}`,
      })
      errorCount++
    }
    onProgress?.({
      current: total,
      total,
      currentProposalName: "",
      status: "completed",
      successCount,
      errorCount,
      skippedCount,
      results,
    })
    return { total, successCount, errorCount, skippedCount, results }
  }

  // Get geolocation from project for the models
  const projectGeoLocation = projectSignal.peek()?.geoLocation
  const geolocation = projectGeoLocation
    ? await getGeolocationForSiteDesignSpaceModel({
        latitude: projectGeoLocation[0],
        longitude: projectGeoLocation[1],
        ellipsoidHeight: 0,
      })
    : undefined

  const loader = new GLTFLoader()
  for (let i = 0; i < proposalUrns.length; i++) {
    const proposalUrn = proposalUrns[i]
    const proposalName = proposalNames?.get(proposalUrn) ?? `Proposal ${i + 1}`
    const nextRevision = String(Date.now())
    // Report current progress
    onProgress?.({
      current: i,
      total,
      currentProposalName: proposalName,
      status: "migrating",
      successCount,
      errorCount,
      skippedCount,
      results: [...results],
    })

    try {
      // Get GLBs for this proposal
      let glbsBySystem: Map<string, Uint8Array>
      try {
        glbsBySystem = await getProposalGLbsByUrn(proposalUrn)
      } catch (error) {
        throw new Error(`Failed to load proposal data: ${getErrorMessage(error)}`)
      }

      // Create a new filePlus for this proposal
      let fileUrn: string
      const shortId = generateShortId()
      try {
        const filePlus = await createFilePlus({
          projectId: accProjectId,
          folderId,
          name: proposalName + shortId,
          contentType: "application/vnd.autodesk.space+aecdm",
        })
        fileUrn = filePlus.fileUrn
      } catch (error) {
        throw new Error(`Failed to create scenario file: ${getErrorMessage(error)}`)
      }

      // Collect geometries, separating terrain from other systems
      const buildingGeometries: BufferGeometry[] = []
      const terrainGeometries: BufferGeometry[] = []

      for (const [system, glbData] of glbsBySystem) {
        try {
          // Parse GLB and extract geometries (convert Uint8Array to ArrayBuffer)
          const arrayBuffer = new Uint8Array(glbData).buffer
          const gltf = await loader.parseAsync(arrayBuffer, "")

          const targetGeometries = system.toLowerCase() === "terrain" ? terrainGeometries : buildingGeometries

          gltf.scene.traverse((child) => {
            if (child instanceof Mesh && child.geometry) {
              // Clone and apply world matrix to preserve transforms
              const geometry = child.geometry.clone()
              child.updateMatrixWorld()
              geometry.applyMatrix4(child.matrixWorld)
              targetGeometries.push(geometry)
            }
          })
        } catch (error) {
          console.warn(`Failed to parse GLB for system ${system}:`, error)
          // Continue with other systems
        }
      }

      // Skip if no geometries found at all
      if (buildingGeometries.length === 0 && terrainGeometries.length === 0) {
        console.warn(`No geometries found for proposal: ${proposalName}`)
        results.push({
          urn: proposalUrn,
          name: proposalName,
          status: "skipped",
          error: "No geometry data found in proposal",
        })
        skippedCount++
        continue
      }

      const models: ModelResponse[] = []
      // Process building geometries
      // Note: Geometries are already Y-up from getProposalGLbsByUrn (converted in geometryToGlb)
      if (buildingGeometries.length > 0) {
        try {
          const mergedBuildingGeometry =
            buildingGeometries.length === 1
              ? buildingGeometries[0]
              : BufferGeometryUtils.mergeGeometries(buildingGeometries)

          if (mergedBuildingGeometry) {
            const buildingGlbBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
              const exportMesh = new Mesh(mergedBuildingGeometry.clone())
              // Geometries are already Y-up from GLB loading, no rotation needed
              new GLTFExporter().parse(exportMesh, (res) => resolve(res as ArrayBuffer), reject, { binary: true })
            })
            const buildingGlb = new Uint8Array(buildingGlbBuffer)
            const buildingEndpoint = await uploadToBinaryStore(buildingGlb, accProjectId, fileUrn)
            const absoluteBuildingEndpoint = `${window.location.origin}${buildingEndpoint}`

            // Create model
            try {
              const model = await createModel({
                projectId: accProjectId,
                fileUrn,
                name: SITE_DESIGN_SCENARIO_BASE_MODEL_NAME,
                authoringEngine: SITE_DESIGN_AUTHORING_ENGINE,
                sourceReference: proposalUrn,
                inventory: [],
                custom: { siteDesign: { internalModelReference: INTERNAL_MODEL_REFERENCE_SITE_DESIGN } },
                representations: [
                  {
                    typeid: "autodesk.aec.forma:representation-viewable-3d-1.0.0",
                    name: "buildingRepresentation",
                    location: absoluteBuildingEndpoint,
                    inventoryIds: [],
                  },
                ],
                geolocation,
              })
              models.push(model)
            } catch (error) {
              throw new Error(`Failed to create building model: ${getErrorMessage(error)}`)
            }
          }
        } catch (error) {
          console.warn(`Failed to process building geometries:`, error)
          // Continue with terrain
        }
      }

      // Process terrain geometries
      // Note: Geometries are already Y-up from getProposalGLbsByUrn (converted in geometryToGlb)
      if (terrainGeometries.length > 0) {
        try {
          const mergedTerrainGeometry =
            terrainGeometries.length === 1
              ? terrainGeometries[0]
              : BufferGeometryUtils.mergeGeometries(terrainGeometries)

          if (mergedTerrainGeometry) {
            const terrainGlbBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
              const exportMesh = new Mesh(mergedTerrainGeometry.clone())
              // Geometries are already Y-up from GLB loading, no rotation needed
              new GLTFExporter().parse(exportMesh, (res) => resolve(res as ArrayBuffer), reject, { binary: true })
            })
            const terrainGlb = new Uint8Array(terrainGlbBuffer)
            const terrainEndpoint = await uploadToBinaryStore(terrainGlb, accProjectId, fileUrn)
            const absoluteTerrainEndpoint = `${window.location.origin}${terrainEndpoint}`
            //TODO Verify this is parameters are correct
            const terrainRepresentation: RepresentationTerrainSurface = {
              typeid: "autodesk.aec:component.terrainSurface-1.0.0",
              id: newId(),
              name: "terrainRepresentation",
              inventoryIds: [],
              gridOffset: { x: 0, y: 0, z: 0 },
              gridDimensions: { x: 0, y: 0 },
              tiles: [
                {
                  typeid: "autodesk.aec:component.terrainTile-1.0.0",
                  gridIndexX: 0,
                  gridIndexY: 0,
                  elevationOffset: 0,
                  location: absoluteTerrainEndpoint,
                },
              ],
            }
            // Create model
            try {
              const model = await createModel({
                projectId: accProjectId,
                fileUrn,
                name: SITE_DESIGN_SCENARIO_TERRAIN_MODEL_NAME,
                authoringEngine: SITE_DESIGN_AUTHORING_ENGINE,
                sourceReference: proposalUrn,
                inventory: [],
                representations: [terrainRepresentation],
                geolocation,
                custom: { siteDesign: { internalModelReference: INTERNAL_MODEL_REFERENCE_SITE_DESIGN_TERRAIN } },
              })
              models.push(model)
            } catch (error) {
              throw new Error(`Failed to create terrain model: ${getErrorMessage(error)}`)
            }
          }
        } catch (error) {
          console.warn(`Failed to process terrain geometries:`, error)
          // Continue without terrain
        }
      }

      // Skip if no representations created
      if (models.length === 0) {
        results.push({
          urn: proposalUrn,
          name: proposalName,
          status: "skipped",
          error: "Could not create any geometry representations",
        })
        skippedCount++
        continue
      }

      // Create model reference for the scenario
      const modelReferences = models.map((model) => {
        return {
          fileUrn: model.fileUrn,
          id: model.id,
          revision: model.revision,
          authoringEngine: SITE_DESIGN_AUTHORING_ENGINE,
        }
      })

      // Create a scenario with the proposal name and add the model
      let scenario
      try {
        scenario = await createScenario({
          projectId: accProjectId,
          fileUrn,
          name: proposalName,
          models: modelReferences,
        })
        console.log(`Created scenario for proposal ${proposalName}:`, scenario)
      } catch (error) {
        throw new Error(`Failed to create scenario: ${getErrorMessage(error)}`)
      }

      // Update the proposal with the scenarioId and accProjectId
      try {
        await updateProposalWithScenarioId(proposalUrn, scenario.id, accProjectId, fileUrn, nextRevision)
        console.log(
          `Updated proposal ${proposalName} with scenarioId: ${scenario.id}, accProjectId: ${accProjectId}, fileUrn: ${fileUrn}`,
        )
      } catch (error) {
        // Log but don't fail the migration if updating the proposal fails
        console.warn(`Failed to update proposal with scenarioId: ${getErrorMessage(error)}`)
      }

      // Success!
      results.push({
        urn: proposalUrn,
        name: proposalName,
        status: "success",
        scenarioId: scenario.id,
        fileUrn,
        accProjectId,
      })
      successCount++
    } catch (error) {
      console.error(`Error migrating proposal ${proposalUrn}:`, error)
      results.push({
        urn: proposalUrn,
        name: proposalName,
        status: "error",
        error: getErrorMessage(error),
      })
      errorCount++
    }
  }

  // Final progress update
  onProgress?.({
    current: total,
    total,
    currentProposalName: "",
    status: "completed",
    successCount,
    errorCount,
    skippedCount,
    results,
  })

  return { total, successCount, errorCount, skippedCount, results, accProjectId }
}
