import type { BasicAction, BasicActionOptions, BasicCreateAction, BasicUpdateAction } from "./types"
import type { InternalPath } from "src/lib/element/path"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import { newChildKey } from "src/lib/element/urn"
import { getDependenciesFromState } from "./actionDependencies"
import { createActionsFromBasicActions } from "./create"
import type { BasicElementProperties } from "src/integrations/basic-elements/BasicElementProperties"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import type { Child, Transform } from "@spacemakerai/element-types"
import { featureFlagSignalFamily, LDFlag } from "src/lib/featureToggling"
import { getDuplicateBasicElementsActions } from "./duplicate"
import type { Proposal } from "src/core/elements/Proposal"
import { elementState } from "src/core/elements/ElementState"
import { terrainSignal, type NewTerrainState } from "src/core/terrain/new-terrain-state"

/**
 * Functions for creating and updating basic elements
 *
 * Basic api functions are split into two categories
 * 1. Defining the basic action
 *    A simple interface to create or update basic elements
 * 2. Transforming to core actions
 *    Hides the quirks of generators and batching
 *
 * One of the reasons these are split, is that step 2 requires us to update the whole batch, and this is best done when
 * we can look at all the actions we want to apply at the same time to avoid updating the batch of elements multiple
 * times.
 *
 * Example usage:
 * function MyComponent() {
 *   const actionsAPI = useActionsAPI()
 *
 *   const myCallback(() => {
 *     const createRoadAction = BasicElementAPI.create(path, feature1, basicElementPresets.road)
 *     const createTreeAction = BasicElementAPI.create(path, feature2, basicElementPresets.tree_area)
 *
 *     const actions = BasicElementAPI.basicActionsToCoreActions([createRoadAction, createTreeAction])
 *     actionAPI.apply("Create some stuff", actions)
 *   }, [actionsAPI])
 *
 * }
 *
 */
export const BasicElementAPI = {
  /**
   * Feature is locally placed
   * */
  create: (
    parentPath: InternalPath,
    feature: BasicFeature | undefined,
    properties: BasicElementProperties,
    transform?: Transform,
    options?: BasicActionOptions,
  ): BasicCreateAction => ({
    type: "basic-create",
    parentPath,
    child: { key: options?.key ?? newChildKey(), transform },
    feature: feature,
    properties,
    options,
  }),

  update: (
    path: InternalPath,
    properties?: Partial<BasicElementProperties>, // Will be spread on top of existing properties
    feature?: BasicFeature, // If not set, use the previous feature for this element
    options?: BasicActionOptions,
  ): BasicUpdateAction => ({
    type: "basic-update",
    path,
    properties,
    feature,
    options,
  }),

  updateProperties: (path: InternalPath, properties: Partial<BasicElementProperties>): BasicUpdateAction =>
    BasicElementAPI.update(path, properties),

  updateFeature: (path: InternalPath, feature: BasicFeature): BasicUpdateAction =>
    BasicElementAPI.update(path, undefined, feature),

  basicActionsToCoreActionsForProposal: (
    actions: BasicAction[],
    proposal: Proposal,
    terrain: NewTerrainState,
    skipBatching_temp?: boolean,
  ): Action[] =>
    createActionsFromBasicActions(
      actions,
      getDependenciesFromState(proposal, terrain),
      skipBatching_temp || featureFlagSignalFamily(LDFlag.BasicBatch).peek(),
    ),

  basicActionsToCoreActions: (actions: BasicAction[], skipBatching_temp?: boolean): Action[] =>
    BasicElementAPI.basicActionsToCoreActionsForProposal(
      actions,
      elementState.currentProposalSignal.peek(),
      terrainSignal.peek(),
      skipBatching_temp,
    ),

  duplicate: (elementsToDuplicate: Omit<Child, "key">[]): Promise<BasicAction[]> =>
    getDuplicateBasicElementsActions(elementsToDuplicate),
}

export {
  basicElementPresets,
  type BasicPresetMap,
  type BasicPreset,
  type BasicPresetKey,
} from "./../basicElementPresets"
