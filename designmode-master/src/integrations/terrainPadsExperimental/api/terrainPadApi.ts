import type { Selectable } from "src/core/elements/element-container-derived-data/selectables"
import { ElementContainer } from "src/core/elements/ElementContainer"
import type { Terrain } from "src/core/elements/Terrain"
import { createTerrainCustomData, TerrainData } from "src/core/elements/terrain-data"
import type { TerrainElement, TerrainOperation } from "src/core/terrain/terrain-types"
import { replaceRevision } from "src/lib/element/urn"
import { calculateEdgesGeometry } from "src/lib/three/geometryUtils"
import type { Mesh, BufferGeometry } from "three"
import { terrainOpsLib } from "./terrain-ops-lib"
import { elementState } from "src/core/elements/ElementState"
import { trackTerrain } from "src/integrations/terrainPadsExperimental/utils/trackTerrain"

const SELECTION_INTEGRATION_NAME = "terrain_pads"

function applyTerrainPads(
  terrainOperations: TerrainOperation[],
  initTerrainGeometry: BufferGeometry,
  mesh: Mesh,
  terrainElementProps: TerrainElement["properties"],
) {
  // TODO: For now we just pass through to the terrainOpsLib, but eventually we want to shift some
  // concerns out of the lib and into this API
  return terrainOpsLib.applyTerrainPads(terrainOperations, initTerrainGeometry, mesh, terrainElementProps)
}

const updateTerrainElement = (
  currentTerrain: Terrain,
  updatedTerrainOperations: TerrainOperation[],
  updatedTerrainMesh: Mesh,
) => {
  const currentTerrainElement = currentTerrain.element
  const updatedElement: TerrainElement = {
    ...currentTerrainElement,
    urn: replaceRevision(currentTerrainElement.urn),
    properties: {
      ...currentTerrainElement.properties,
      terrain_mode_operations: updatedTerrainOperations,
    },
  }
  if (currentTerrain.texture?.terrainTexture === undefined) {
    return null
  }
  const customData = createTerrainCustomData(
    new TerrainData(
      updatedTerrainMesh.clone(),
      {
        terrainTexture: currentTerrain.texture?.terrainTexture,
        attributionTag: currentTerrain.textureAttributionTag,
      },
      currentTerrain.data.baseTerrain,
    ),
  )
  return ElementContainer.fromDraftElement(updatedElement, undefined, undefined, customData)
}

function applyTerrainOperations(
  currentTerrain: Terrain,
  updatedTerrainOperations: TerrainOperation[],
): ElementContainer {
  if (!currentTerrain.data.baseTerrain) {
    throw new Error("Base terrain data is not available")
  }
  const initTerrainGeometry = currentTerrain.data.baseTerrain.baseTerrainGeometry
  /** @deprecated Shouldn't need the Mesh to apply pads */
  const mesh = currentTerrain.mesh
  const terrainElementProps = currentTerrain.element.properties
  const terrainWithAppliedOps = terrainOpsLib.applyTerrainPads(
    updatedTerrainOperations,
    initTerrainGeometry,
    mesh,
    terrainElementProps,
  )
  const updatedTerrainElement = updateTerrainElement(
    currentTerrain,
    updatedTerrainOperations,
    terrainWithAppliedOps.mesh,
  )
  if (!updatedTerrainElement) {
    throw new Error("Failed to update terrain element")
  }
  return updatedTerrainElement
}

function getCurrentTerrain(): Terrain {
  const currentTerrain = elementState.currentTerrainSignal.peek()
  if (!currentTerrain) {
    throw new Error("No terrain element in proposal")
  }
  return currentTerrain
}

function applyTerrainOperationsWithoutTracking(
  operations: TerrainOperation[],
): [before: TerrainOperation[], after: TerrainOperation[]] {
  const currentTerrain = getCurrentTerrain()

  const updatedTerrainContainer = applyTerrainOperations(currentTerrain, operations)
  elementState.edit(({ updateElement }) => {
    updateElement(
      "proposal",
      { ...currentTerrain.node.child, urn: updatedTerrainContainer.element.urn },
      updatedTerrainContainer,
    )
  })

  const currentTerrainOperations = currentTerrain.element.properties.terrain_mode_operations ?? []
  return [currentTerrainOperations, operations]
}

function appendTerrainOperationsWithoutTracking(newTerrainOperations: TerrainOperation[]) {
  const currentTerrain = getCurrentTerrain()

  const currentTerrainOperations = currentTerrain.element.properties.terrain_mode_operations ?? []
  // Merge existing operations with new ones - filterDuplicates will handle any duplicates
  const mergedOperations = [...currentTerrainOperations, ...newTerrainOperations]

  return applyTerrainOperationsWithoutTracking(mergedOperations)
}

function applyTerrainOperationsToElementState(updatedTerrainOperations: TerrainOperation[]) {
  const [before, after] = applyTerrainOperationsWithoutTracking(updatedTerrainOperations)
  trackTerrain(before, after)
}

function appendTerrainOperationsToElementState(newTerrainOperations: TerrainOperation[]) {
  const [before, after] = appendTerrainOperationsWithoutTracking(newTerrainOperations)
  trackTerrain(before, after)
}

const getMeshedPads = (terrainOperations: TerrainOperation[], initTerrainGeo: BufferGeometry) => {
  return terrainOpsLib.operationsToMeshedPads(terrainOperations, initTerrainGeo)
}

const getTerrainOperations = (terrainElement: TerrainElement) => {
  return terrainElement.properties.terrain_mode_operations ?? []
}

const getCurrentTerrainOperations = () => {
  const currentTerrain = getCurrentTerrain()
  return getTerrainOperations(currentTerrain.element)
}

const getTerrainOperation = (terrainElement: TerrainElement, operationId: string) => {
  return getTerrainOperations(terrainElement).find((op) => op.id === operationId)
}

const getTerrainOperationIndex = (terrainElement: TerrainElement, operationId: string) => {
  return getTerrainOperations(terrainElement).findIndex((op) => op.id === operationId)
}

const getTerrainPadSelectables = (terrainElement: TerrainElement, initTerrainGeo: BufferGeometry): Selectable[] => {
  const terrainOperations = getTerrainOperations(terrainElement)
  const terrainOperationsReversed = [...terrainOperations].reverse()
  const meshPads = terrainOpsLib.operationsToMeshedPads(terrainOperationsReversed, initTerrainGeo)

  return meshPads.map((pad) => {
    const outlines = calculateEdgesGeometry(pad.mesh.geometry) as Float32Array
    return {
      target: { type: "custom", customSelection: { integration: SELECTION_INTEGRATION_NAME, id: pad.id } },
      selectable3d: { hitbox: pad.mesh.geometry, outlines },
    }
  })
}

function deleteTerrainPads(currentTerrain: Terrain, terrainPadIds: string[]) {
  const ids = new Set(terrainPadIds)
  const updatedOperations = getTerrainOperations(currentTerrain.element).filter((op) => !ids.has(op.id))
  applyTerrainOperationsToElementState(updatedOperations)
}

interface terrainPadApiInterface {
  applyTerrainOperationsWithoutTracking: typeof applyTerrainOperationsWithoutTracking
  appendTerrainOperationsWithoutTracking: typeof appendTerrainOperationsWithoutTracking
  getCurrentTerrainOperations: typeof getCurrentTerrainOperations
  applyTerrainOperationsToElementState: typeof applyTerrainOperationsToElementState
  appendTerrainOperationsToElementState: typeof appendTerrainOperationsToElementState
  applyTerrainPads: typeof applyTerrainPads
  getTerrainOperations: typeof getTerrainOperations
  getTerrainPadSelectables: typeof getTerrainPadSelectables
  getTerrainOperation: typeof getTerrainOperation
  getTerrainOperationIndex: typeof getTerrainOperationIndex
  getMeshedPads: typeof getMeshedPads
  deleteTerrainPads: typeof deleteTerrainPads
  SELECTION_INTEGRATION_NAME: typeof SELECTION_INTEGRATION_NAME
}

export const terrainApi: terrainPadApiInterface = {
  applyTerrainOperationsWithoutTracking,
  appendTerrainOperationsWithoutTracking,
  getCurrentTerrainOperations,
  applyTerrainOperationsToElementState,
  appendTerrainOperationsToElementState,
  applyTerrainPads,
  getTerrainOperations,
  getTerrainPadSelectables,
  getTerrainOperation,
  getTerrainOperationIndex,
  getMeshedPads,
  deleteTerrainPads,
  SELECTION_INTEGRATION_NAME,
}
