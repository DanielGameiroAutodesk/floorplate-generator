import type { BufferGeometry, Material, Object3D } from "three"
import { Mesh } from "three"
import type { RaycastData } from "src/core/selection/raycasting"
import type { CustomSelectionPath } from "src/core/selection/selectionTypes"
import { customSelectionTargetToSelectionPath } from "src/core/selection/selectionTypes"
import { setupAndComputeBoundsTree } from "src/lib/three/boundsTree"

export const SCENARIO_SELECTION_INTEGRATION = "scenario_renderables"

/**
 * Converts a scenario renderable index to a SelectionPath
 * @param index The index of the scenario renderable in the array
 * @returns A SelectionPath like "custom:scenario_renderables:0"
 */
export function scenarioIndexToSelectionPath(index: number): CustomSelectionPath {
  return customSelectionTargetToSelectionPath({
    integration: SCENARIO_SELECTION_INTEGRATION,
    id: String(index),
  })
}

/**
 * Creates a raycast target (mesh with BVH acceleration) for a scenario renderable
 * @param geometry The BufferGeometry for the scenario renderable
 * @param material The material to use for the mesh
 * @param index The index of this scenario renderable in the array
 * @returns A tuple of [Object3D, RaycastData] for the raycast targets map
 */
export function createScenarioRaycastTarget(
  geometry: BufferGeometry,
  material: Material,
  index: number,
): [Object3D, RaycastData] {
  const mesh = new Mesh(geometry, material)

  // Add BVH acceleration for fast raycasting
  setupAndComputeBoundsTree(geometry)

  const raycastData: RaycastData = {
    raycastType: "3d",
    selection: scenarioIndexToSelectionPath(index),
  }

  return [mesh, raycastData]
}

/**
 * Converts an array of scenario renderable geometries into raycast target entries
 * @param geometries Array of BufferGeometry from spaceRenderablesSignal
 * @param material The material to use for the meshes
 * @returns Array of [Object3D, RaycastData] tuples to add to raycastTargetsSignal
 */
export function createScenarioRaycastTargetsEntries(
  geometries: BufferGeometry[],
  material: Material,
): [Object3D, RaycastData][] {
  return geometries.map((geometry, index) => createScenarioRaycastTarget(geometry, material, index))
}
