/**
 * Managers Index
 *
 * Re-exports all manager modules for convenient importing.
 */

export {
  openFloorplatePanel,
  sendOptionsToPanel,
  setPanelCallbacks,
  setGeneratedOptions as setPanelGeneratedOptions,
  isPanelCurrentlyOpen,
  resetPanelState,
  handleOptionSelected,
  notifySaveSuccess,
  notifySaveError,
  notifyBakeSuccess,
  notifyBakeError
} from './floating-panel-manager';

export {
  loadSavedFloorplates,
  saveFloorplate,
  handleLoadSaved,
  handleRenameSaved,
  handleDuplicateSaved,
  handleDeleteSaved,
  renderSavedList,
  setOnLoadCallback,
  setCurrentBuildingId,
  getCurrentBuildingId,
  getSerializableUIState
} from './saved-manager';

export {
  handleGenerate,
  handleStopAutoGeneration,
  markInputChanged,
  debounceGenerate,
  showDebug,
  setOnGenerationComplete,
  setUpdateButtonState,
  getCurrentSelection,
  getBuildingTriangles,
  getGeneratedOptions,
  getSelectedOptionIndex,
  getCurrentFloorplan,
  setSelectedOptionIndex,
  setGeneratedOptions,
  resetAfterBake
} from './generation-manager';
