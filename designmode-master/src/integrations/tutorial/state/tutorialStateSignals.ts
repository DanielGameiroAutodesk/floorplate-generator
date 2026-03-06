import { signal } from "@preact/signals"

/**
 * State signals for the Add Buildings Tutorial
 */
export const addBuildingsTutorialState = {
  importModalWasOpenedSignal: signal(false),
  lineBuildingWasActivatedSignal: signal(false),
}

/**
 * State signals for the Import Model Tutorial
 */
export const importModelTutorialState = {
  importModalWasOpenedSignal: signal(false),
  initialElementCountSignal: signal<number | null>(null),
}

/**
 * State signals for the Order Data Tutorial
 */
export const orderDataTutorialState = {
  resourcesModalWasOpenedSignal: signal(false),
  siteLimitToolWasActivatedSignal: signal(false),
  initialBuildingCountForAddStepSignal: signal<number | null>(null),
  initialBuildingCountForDeleteStepSignal: signal<number | null>(null),
}
