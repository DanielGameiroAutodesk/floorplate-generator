import {
  getModel,
  createModel,
  type ModelReference,
  type ModelResponse,
  type Representation,
  updateModel,
  updateScenario,
  uploadToBinaryStore,
} from "src/integrations/spaces/spaceClient/spaceClientv4"
import { generateTerrainGlb, getSiteDesignModelGlb } from "src/integrations/spaces/getSiteDesignModelGlb"
import { elementState } from "src/core/elements/ElementState"
import { newId, parseUrn } from "src/lib/element/urn"
import { getGeolocationForSiteDesignSpaceModel } from "src/integrations/spaces/geolocation"
import { projectSignal } from "src/core/project/project"
import {
  INTERNAL_MODEL_REFERENCE_SITE_DESIGN,
  INTERNAL_MODEL_REFERENCE_SITE_DESIGN_TERRAIN,
  scenarioStateSignal,
  SITE_DESIGN_AUTHORING_ENGINE,
  SITE_DESIGN_SCENARIO_BASE_MODEL_NAME,
  SITE_DESIGN_SCENARIO_TERRAIN_MODEL_NAME,
} from "./scenario"

import type { InternalPath } from "src/lib/element/path"

// Inventory IDs cannot contain "/" as GLB tools and other systems may strip or reject this character.
// We use "|" as a delimiter instead, which is safe for inventory IDs across all representations.
const INVENTORY_PATH_DELIMITER = "|"

/**
 * Encodes an InternalPath for use as an inventory ID by replacing "/" with "|"
 */
function encodePathForInventory(path: InternalPath): string {
  return path.replaceAll("/", INVENTORY_PATH_DELIMITER)
}

const regions: Record<string, { baseUrl: string; host: string }> = {
  eu: { baseUrl: "https://app.autodeskforma.eu", host: "local.autodeskforma.eu" },
  us: { baseUrl: "https://app.autodeskforma.com", host: "local.autodeskforma.com" },
  chaos: { baseUrl: "https://app.spacemakerai.eu", host: "local.spacemakerai.eu" },
  stg: { baseUrl: "https://forma.stg.usa.autodesk.com", host: "local.forma.stg.usa.autodesk.com" },
}

const resolveBaseUrl = () => {
  for (const [, region] of Object.entries(regions)) {
    if (window.location.host.startsWith(region.host)) {
      return region.baseUrl
    }
  }
}

/**
 * Returns an absolute URL for use in GLB locations.
 * Assumes that relativeUrl starts with a '/'
 * @param relativeUrl
 */
function resolveAbsoluteUrl(relativeUrl: string) {
  if (import.meta.env.DEV) {
    return `${resolveBaseUrl()}${relativeUrl}`
  }

  return `${window.location.origin}${relativeUrl}`
}

/**
 * Get inventory paths from the current snapshot - paths of nodes that have volumeMesh representations
 */
function getInventoryFromSnapshot(): InternalPath[] {
  const currentSnapshot = elementState.currentSnapshot.peek()
  const inventory: InternalPath[] = []

  for (const [path, node] of currentSnapshot.nodes.entries()) {
    const volumeMesh = node.elementContainer.representations.volumeMesh
    const { system } = parseUrn(node.element.urn)
    if (volumeMesh && system !== "building-design") {
      inventory.push(path)
    }
  }

  return inventory
}

/**
 * Update the Forma Cloud model for the current proposal (FAST version).
 * Uses the existing terrain GLB URL instead of uploading a new one.
 * This is a pure update operation - assumes the scenario and model already exist.
 */
export async function updateFormaCloudModelFAST(
  accProjectId: string,
  fileUrn: string,
  scenarioId: string,
): Promise<void> {
  const proposal = elementState.currentProposalSignal.peek()

  // Get inventory paths from current snapshot (nodes with volumeMesh representations)
  const inventory = getInventoryFromSnapshot()
  if (inventory.length === 0) {
    return
  }

  // Encode inventory paths (using "|" instead of "/") to match GLB node names
  const encodedInventory = inventory.map(encodePathForInventory)

  // Get the current scenario from state to find the existing site design model
  const currentScenario = scenarioStateSignal.peek()?.scenario
  if (!currentScenario) {
    throw new Error("Scenario state not loaded")
  }

  const { authcontext, id, revision, system } = parseUrn(proposal.urn)
  const buildingQueryParams = new URLSearchParams({
    authcontext: authcontext,
    system: system,
    id: id,
    revision: revision,
    excludeSystem: "terrain,building-design",
    bakeTransforms: "true",
  })
  // Convert relative URL to absolute URL
  const buildingLocation = `/api/fdm?${buildingQueryParams.toString()}`

  const terrainQueryParams = new URLSearchParams({
    authcontext: authcontext,
    system: system,
    id: id,
    revision: revision,
    includeSystem: "terrain",
    bakeTransforms: "true",
  })
  // Convert relative URL to absolute URL
  const terrainLocation = `/api/fdm?${terrainQueryParams.toString()}`

  const siteDesignUpdates = (
    await Promise.all([
      updateSiteDesignModel(accProjectId, fileUrn, buildingLocation, encodedInventory),
      updateTerrainModel(accProjectId, fileUrn, terrainLocation),
    ])
  ).filter((item) => item !== undefined)

  const updatedModels = siteDesignUpdates.map((model) => {
    const existingModel = currentScenario.scenario.models?.find((m) => m.id === model.id)
    if (existingModel) {
      return { ...existingModel, revision: model.revision }
    }
    return modelResponseToReference(model)
  })

  // Update the scenario with the updated models
  await updateScenario({
    projectId: accProjectId,
    fileUrn,
    scenarioId,
    id: currentScenario.scenario.id,
    revision: currentScenario.scenario.revision,
    name: currentScenario.scenario.name,
    models: updatedModels,
  })
}

async function updateSiteDesignModel(accProjectId: string, fileUrn: string, endpoint: string, inventoryIds: string[]) {
  const proposal = elementState.currentProposalSignal.peek()

  // Get the current scenario from state to find the existing site design model
  const currentScenario = scenarioStateSignal.peek()?.scenario
  if (!currentScenario) {
    throw new Error("Scenario state not loaded")
  }

  const projectGeoLocation = projectSignal.peek()?.geoLocation
  if (projectGeoLocation === undefined) {
    console.warn("Project geolocation not found, skipping update")
    return
  }

  // Find the existing site design model
  const existingSiteDesignModel = currentScenario.models.find(
    (m) =>
      m.authoringEngine === SITE_DESIGN_AUTHORING_ENGINE &&
      m.custom?.siteDesign.internalModelReference === INTERNAL_MODEL_REFERENCE_SITE_DESIGN,
  )

  let updatedModel
  // If we do not have a model we will need to create one
  if (!existingSiteDesignModel) {
    const geolocation = await getGeolocationForSiteDesignSpaceModel({
      latitude: projectGeoLocation[0],
      longitude: projectGeoLocation[1],
      ellipsoidHeight: 0,
    })

    updatedModel = await createModel({
      projectId: accProjectId,
      fileUrn: fileUrn,
      name: SITE_DESIGN_SCENARIO_BASE_MODEL_NAME,
      authoringEngine: SITE_DESIGN_AUTHORING_ENGINE,
      geolocation: geolocation,
      inventory: inventoryIds,
      sourceReference: proposal.urn,
      custom: {
        siteDesign: { internalModelReference: INTERNAL_MODEL_REFERENCE_SITE_DESIGN },
      },
      representations: [
        {
          typeid: "autodesk.aec.forma:representation-viewable-3d-1.0.0" as const,
          name: "buildingRepresentation",
          location: resolveAbsoluteUrl(endpoint),
          inventoryIds: inventoryIds,
        },
      ],
    })
  } else {
    // Update representations based on existing state, only changing location and inventory
    const existingRepresentations = existingSiteDesignModel.representations || []

    const freshModel = await getModel({
      projectId: accProjectId,
      fileUrn: fileUrn,
      modelId: existingSiteDesignModel.id,
    })

    // Find and update the building representation
    const existingBuildingRep = existingRepresentations.find(
      (r) => r.typeid === "autodesk.aec.forma:representation-viewable-3d-1.0.0",
    )

    const representation: Representation = existingBuildingRep
      ? {
          ...existingBuildingRep,
          location: resolveAbsoluteUrl(endpoint),
          inventoryIds: inventoryIds,
        }
      : {
          typeid: "autodesk.aec.forma:representation-viewable-3d-1.0.0" as const,
          name: "buildingRepresentation",
          location: resolveAbsoluteUrl(endpoint),
          inventoryIds: inventoryIds,
        }

    const geolocation = existingSiteDesignModel.geolocation
      ? existingSiteDesignModel.geolocation
      : await getGeolocationForSiteDesignSpaceModel({
          latitude: projectGeoLocation[0],
          longitude: projectGeoLocation[1],
          ellipsoidHeight: 0,
        })
    // Update the existing model
    updatedModel = await updateModel({
      projectId: accProjectId,
      fileUrn,
      modelId: existingSiteDesignModel.id,
      revision: freshModel.revision,
      name: existingSiteDesignModel.name,
      authoringEngine: SITE_DESIGN_AUTHORING_ENGINE,
      custom: existingSiteDesignModel.custom,
      sourceReference: proposal.urn,
      inventory: inventoryIds,
      geolocation: geolocation,
      representations: [representation],
    })
  }

  return updatedModel
}

async function updateTerrainModel(accProjectId: string, fileUrn: string, endpoint: string) {
  const proposal = elementState.currentProposalSignal.peek()

  // Get the current scenario from state to find the existing site design model
  const currentScenario = scenarioStateSignal.peek()?.scenario
  if (!currentScenario) {
    throw new Error("Scenario state not loaded")
  }

  // Find the existing site design model
  const existingSiteDesignTerrainModel = currentScenario.models.find(
    (m) =>
      m.authoringEngine === SITE_DESIGN_AUTHORING_ENGINE &&
      m.custom?.siteDesign.internalModelReference === INTERNAL_MODEL_REFERENCE_SITE_DESIGN_TERRAIN,
  )

  const projectGeoLocation = projectSignal.peek()?.geoLocation
  if (projectGeoLocation === undefined) {
    console.warn("Project geolocation not found, skipping update")
    return
  }

  let updatedModel: ModelResponse
  // If we do not have a model we will need to create one
  if (!existingSiteDesignTerrainModel) {
    const geolocation = await getGeolocationForSiteDesignSpaceModel({
      latitude: projectGeoLocation[0],
      longitude: projectGeoLocation[1],
      ellipsoidHeight: 0,
    })

    updatedModel = await createModel({
      projectId: accProjectId,
      fileUrn: fileUrn,
      name: SITE_DESIGN_SCENARIO_TERRAIN_MODEL_NAME,
      authoringEngine: SITE_DESIGN_AUTHORING_ENGINE,
      geolocation: geolocation,
      inventory: [],
      sourceReference: proposal.urn,
      custom: {
        siteDesign: { internalModelReference: INTERNAL_MODEL_REFERENCE_SITE_DESIGN_TERRAIN },
      },
      representations: [
        {
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
              location: resolveAbsoluteUrl(endpoint),
            },
          ],
        },
      ],
    })
  } else {
    // Update representations based on existing state, only changing location and inventory
    const existingRepresentations = existingSiteDesignTerrainModel.representations || []

    const freshModel = await getModel({
      projectId: accProjectId,
      fileUrn: fileUrn,
      modelId: existingSiteDesignTerrainModel.id,
    })

    // Find existing terrain representation and update only location
    const existingTerrainRep = existingRepresentations.find(
      (r) => r.typeid === "autodesk.aec:component.terrainSurface-1.0.0",
    )

    const geolocation = existingSiteDesignTerrainModel.geolocation
      ? existingSiteDesignTerrainModel.geolocation
      : await getGeolocationForSiteDesignSpaceModel({
          latitude: projectGeoLocation[0],
          longitude: projectGeoLocation[1],
          ellipsoidHeight: 0,
        })

    // Update the existing model
    updatedModel = await updateModel({
      projectId: accProjectId,
      fileUrn,
      modelId: existingSiteDesignTerrainModel.id,
      revision: freshModel.revision,
      name: existingSiteDesignTerrainModel.name,
      authoringEngine: SITE_DESIGN_AUTHORING_ENGINE,
      sourceReference: proposal.urn,
      inventory: [],
      geolocation: geolocation,
      custom: existingSiteDesignTerrainModel.custom,
      representations: [
        existingTerrainRep
          ? {
              ...existingTerrainRep,
              tiles: existingTerrainRep.tiles.map((tile, index) =>
                index === 0 ? { ...tile, location: resolveAbsoluteUrl(endpoint) } : tile,
              ),
            }
          : {
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
                  location: resolveAbsoluteUrl(endpoint),
                },
              ],
            },
      ],
    })
  }

  return updatedModel
}

const modelResponseToReference = (m: ModelResponse): ModelReference => {
  return {
    fileUrn: m.fileUrn,
    id: m.id,
    revision: m.revision,
    authoringEngine: m.authoringEngine,
  }
}

async function fetchAndSaveSiteDesignModel(accProjectId: string, fileUrn: string) {
  // Get GLB and inventory from current proposal
  const glbResult = await getSiteDesignModelGlb()
  if (!glbResult) {
    return
  }
  const { glb, inventory } = glbResult

  // Upload the GLB to the binary store
  const serviceEndpoint = await uploadToBinaryStore(glb, accProjectId, fileUrn)

  // Encode inventory paths (using "|" instead of "/") to match GLB node names
  const encodedInventory = inventory.map(encodePathForInventory)

  return await updateSiteDesignModel(accProjectId, fileUrn, serviceEndpoint, encodedInventory)
}

async function fetchAndSaveSiteDesignTerrainModel(accProjectId: string, fileUrn: string) {
  // Add terrain representation if terrain exists
  const terrainElement = elementState.currentTerrainSignal.peek()
  if (!terrainElement) {
    console.info("No terrain element found, not updating terrain model")
    return undefined
  }
  const geometry = terrainElement.mesh.geometry

  const terrainGlbBuffer = await generateTerrainGlb(geometry)
  const terrainGlb = new Uint8Array(terrainGlbBuffer)
  const terrainEndpoint = await uploadToBinaryStore(terrainGlb, accProjectId, fileUrn)

  return await updateTerrainModel(accProjectId, fileUrn, terrainEndpoint)
}

/**
 * Update the Forma Cloud model for the current proposal.
 * This is a pure update operation - assumes the scenario and model already exist.
 */
export async function updateFormaCloudModel(accProjectId: string, fileUrn: string, scenarioId: string): Promise<void> {
  const currentScenario = scenarioStateSignal.peek()?.scenario
  if (!currentScenario) {
    throw new Error("Scenario state not loaded")
  }

  const siteDesignUpdates = (
    await Promise.all([
      fetchAndSaveSiteDesignModel(accProjectId, fileUrn),
      fetchAndSaveSiteDesignTerrainModel(accProjectId, fileUrn),
    ])
  ).filter((item) => item !== undefined)

  const updatedModels = siteDesignUpdates.map((model) => {
    const existingModel = currentScenario.scenario.models?.find((m) => m.id === model.id)
    if (existingModel) {
      return { ...existingModel, revision: model.revision }
    }
    return modelResponseToReference(model)
  })

  // Update the scenario with the updated models
  await updateScenario({
    projectId: accProjectId,
    fileUrn,
    scenarioId,
    id: currentScenario.scenario.id,
    revision: currentScenario.scenario.revision,
    name: currentScenario.scenario.name,
    models: updatedModels,
  })
}
