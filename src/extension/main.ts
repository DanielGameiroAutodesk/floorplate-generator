/**
 * Floorplate Generator - Forma Extension Entry Point
 *
 * Bar Generator - Multifamily Floorplate Tool. Generates apartment layouts from
 * building footprints in Autodesk Forma.
 *
 * ## Primary Responsibilities
 * - **Initialization**: Wires up tabs, managers, callbacks, and Forma connection
 * - **Button state machine**: Maps select → generate → stop; updates button label/behavior
 * - **Cross-module events**: Connects generation-manager, floating-panel-manager, storage, bake
 *
 * ## State Lifecycle
 * - `init()` runs on load: sets callbacks, tab handlers, generate button, Forma init, load saved floorplates
 * - Button state (`buttonState`) is local; `setUpdateButtonState` lets generation-manager drive it
 *
 * ## Forma SDK Integration
 * - `Forma.project.get()` for connection status and project name
 * - `Forma.render.addMesh()` for option rendering (via handleOptionSelected, onSavedFloorplateLoaded)
 * - No selection or geometry APIs; those are in generation-manager
 *
 * ## Storage Synchronization
 * - `loadSavedFloorplates()` on init; save/bake flow uses storage-service and notifies panel
 *
 * ## Side Effects
 * - DOM: button labels, status bar, tab switching, Show Results visibility
 * - Forma: mesh rendering, project info for status
 *
 * ## Module Layout
 * - state/ui-state.ts - UI state
 * - state/unit-config.ts - UI → algorithm converters
 * - tabs/*.ts - Tab handlers
 * - managers/*.ts - Generation, floating panel, saved floorplates
 */

import { Forma } from 'forma-embedded-view-sdk/auto';
import { renderFloorplate } from '../algorithm';
import { LayoutOption, FloorPlanData } from '../algorithm/types';
import * as storage from './storage-service';

// State
import { state, ButtonState } from './state/ui-state';

// DOM refs
import * as dom from './utils/dom-refs';

// Tabs
import {
  initTabSwitching,
  initMixTab,
  initDimTab,
  initEgressTab,
  setMixMarkInputChanged,
  setDimMarkInputChanged,
  setEgressMarkInputChanged
} from './tabs';

// Managers
import {
  // Floating panel
  openFloorplatePanel,
  sendOptionsToPanel,
  setPanelCallbacks,
  setPanelGeneratedOptions,
  resetPanelState,
  notifySaveSuccess,
  notifySaveError,
  notifyBakeSuccess,
  notifyBakeError,
  // Saved floorplates
  loadSavedFloorplates,
  saveFloorplate,
  setOnLoadCallback,
  setCurrentBuildingId,
  // Generation
  handleGenerate,
  handleStopAutoGeneration,
  markInputChanged,
  setOnGenerationComplete,
  setUpdateButtonState,
  getGeneratedOptions,
  getSelectedOptionIndex,
  getCurrentFloorplan,
  setSelectedOptionIndex,
  setGeneratedOptions,
  resetAfterBake,
  getCurrentSelection,
  startDesignMode
} from './managers';

// Baking
import { bakeWithFloorStack } from './bake-building';

// Logging
import { Logger } from '../algorithm/utils/logger';

// ============================================================================
// Button State Management
// ============================================================================

let buttonState: ButtonState = 'select';

/**
 * Update the generate button's visual state and label.
 *
 * @param newState - One of 'select' | 'generate' | 'stop'.
 *
 * @remarks
 * State machine provides clear feedback: select → generate → stop. User always
 * knows what the next click will do.
 */
function updateButtonState(newState: ButtonState): void {
  buttonState = newState;

  switch (newState) {
    case 'select':
      dom.selectBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Select Building';
      break;
    case 'generate':
      dom.selectBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Generate';
      break;
    case 'stop':
      dom.selectBtn.innerHTML = '<span class="generate-btn-icon">&#9632;</span> Stop automatic generation';
      break;
  }
}

/**
 * Handle generate/stop button click based on current state.
 *
 * Dispatches to handleGenerate (select/generate) or handleStopAutoGeneration (stop).
 */
function handleButtonClick(): void {
  switch (buttonState) {
    case 'select':
    case 'generate':
      handleGenerate();
      break;
    case 'stop':
      handleStopAutoGeneration();
      break;
  }
}

// ============================================================================
// Cross-Module Event Handlers
// ============================================================================

/**
 * Handle save request from the floating panel.
 *
 * @param layoutOption - The layout option to save.
 */
async function handleSaveFloorplate(layoutOption: LayoutOption): Promise<void> {
  try {
    const { id, name } = await saveFloorplate(layoutOption);
    notifySaveSuccess(id, name);
    Logger.info(`Saved floorplate: ${name}`);
  } catch (error) {
    Logger.error(`Failed to save floorplate: ${error}`);
    notifySaveError(String(error));
  }
}

/**
 * Handle bake request from the floating panel.
 *
 * Creates a native Forma building from the generated floorplate. On success,
 * resets generation state and updates button to "Select Building".
 *
 * @param layoutOption - The layout option to bake.
 */
async function handleBakeFloorplate(layoutOption: LayoutOption): Promise<void> {
  try {
    const selection = getCurrentSelection();
    const result = await bakeWithFloorStack(layoutOption.floorplan, {
      numFloors: state.stories,
      originalBuildingPath: selection[0],
      name: `Generated Building - ${layoutOption.strategy}`
    });

    if (result.success) {
      notifyBakeSuccess(result.urn || '');
      Logger.info(`Bake successful! URN: ${result.urn}`);
      resetAfterBake();
      updateButtonState('select');
      updateShowResultsButtonVisibility();
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    Logger.error(`Failed to bake floorplate: ${error}`);
    notifyBakeError(String(error));
  }
}

/**
 * Handle option selection from the floating panel.
 *
 * Renders the selected layout option to Forma via Forma.render.addMesh.
 *
 * @param index - Index of the selected option.
 */
async function handleOptionSelected(index: number): Promise<void> {
  const options = getGeneratedOptions();
  const currentIndex = getSelectedOptionIndex();

  if (index < 0 || index >= options.length) return;
  if (index === currentIndex) return;

  setSelectedOptionIndex(index);
  const selectedOption = options[index];

  // Render to Forma
  try {
    const meshData = renderFloorplate(selectedOption.floorplan);
    await Forma.render.addMesh({
      geometryData: {
        position: meshData.positions,
        color: meshData.colors
      }
    });
    Logger.info(`Rendered option: ${selectedOption.strategy}`);
  } catch (error) {
    Logger.error(`Failed to render option: ${error}`);
  }
}

/**
 * Update visibility of the "Show Results" button.
 *
 * Visible when there are generated options; hidden after bake or when empty.
 */
function updateShowResultsButtonVisibility(): void {
  const options = getGeneratedOptions();
  dom.showResultsBtn.style.display = options.length > 0 ? 'flex' : 'none';
}

/**
 * Handle generation complete: open floating panel and send options for display.
 *
 * @param options - Generated layout options.
 * @param selectedIndex - Index of the selected option.
 * @param _floorplan - Unused; kept for callback signature compatibility.
 */
async function onGenerationComplete(options: LayoutOption[], selectedIndex: number, _floorplan: FloorPlanData): Promise<void> {
  // Update building ID for saved floorplates filtering
  const buildingId = storage.generateBuildingId(state.length, state.buildingDepth);
  setCurrentBuildingId(buildingId);

  // Open/reconnect the panel if needed (port=null means panel closed or never opened)
  await openFloorplatePanel();

  // Update panel with options (include stories for total-building metrics)
  setPanelGeneratedOptions(options, selectedIndex, state.stories);
  sendOptionsToPanel(options, selectedIndex, state.stories);
  updateShowResultsButtonVisibility();
}

/**
 * Handle loading a saved floorplate from storage.
 *
 * Sets options in generation-manager, opens panel, sends options, and renders to Forma.
 *
 * @param options - Loaded layout options.
 * @param floorplan - Floorplan of the first option.
 */
async function onSavedFloorplateLoaded(options: LayoutOption[], floorplan: FloorPlanData): Promise<void> {
  // Set the loaded options
  setGeneratedOptions(options, floorplan);

  // Open/reconnect the panel if needed
  await openFloorplatePanel();

  // Send to floating panel
  sendOptionsToPanel(options, 0, state.stories);

  // Render to Forma
  const meshData = renderFloorplate(floorplan);
  await Forma.render.addMesh({
    geometryData: {
      position: meshData.positions,
      color: meshData.colors
    }
  });
  updateShowResultsButtonVisibility();
}

// ============================================================================
// Forma Connection
// ============================================================================

/**
 * Update the status bar with connection state.
 *
 * @param type - CSS class: 'connected' | 'disconnected' | 'connecting'.
 * @param message - Text to display in the status bar.
 */
function setStatus(type: 'connected' | 'disconnected' | 'connecting', message: string): void {
  dom.statusBar.className = `status-bar ${type}`;
  dom.statusText.textContent = message;
}

/**
 * Initialize Forma connection and update status bar.
 *
 * Fetches project info; on success sets "Connected to {name}", on failure sets "Not connected".
 * Button remains enabled even on failure for testing.
 */
async function initForma(): Promise<void> {
  try {
    const projectInfo = await Forma.project.get();
    setStatus('connected', `Connected to ${projectInfo.name || 'Forma'}`);
    dom.selectBtn.disabled = false;
    Logger.info(`Forma connection established: ${projectInfo.name || 'Forma'}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setStatus('disconnected', `Not connected: ${errorMessage}`);
    Logger.error(`Forma connection failed: ${error}`);
    dom.selectBtn.disabled = false; // Still enable for testing
  }
}

// ============================================================================
// Initialize
// ============================================================================

/**
 * Initialize the extension: wire callbacks, tabs, button, Forma, and saved floorplates.
 */
function init(): void {
  // Wire up cross-module callbacks
  setMixMarkInputChanged(markInputChanged);
  setDimMarkInputChanged(markInputChanged);
  setEgressMarkInputChanged(markInputChanged);
  setUpdateButtonState(updateButtonState);
  setOnGenerationComplete(onGenerationComplete);
  setOnLoadCallback(onSavedFloorplateLoaded);

  // Set up floating panel callbacks
  setPanelCallbacks({
    onOptionSelected: handleOptionSelected,
    onSaveRequest: handleSaveFloorplate,
    onBakeRequest: handleBakeFloorplate
  });

  // Initialize UI components
  initTabSwitching(dom.tabs, dom.tabContents);
  initMixTab();
  initDimTab();
  initEgressTab();

  // Set up generate button
  dom.selectBtn.addEventListener('click', handleButtonClick);

  // Set up design button
  dom.designBtn.addEventListener('click', async () => {
    dom.designWidthSection.style.display = 'block';
    await startDesignMode();
    dom.designWidthSection.style.display = 'none';
  });

  // Set up design width input
  dom.designWidthInput.addEventListener('input', (e) => {
    state.designWidth = parseInt((e.target as HTMLInputElement).value, 10) || 65;
  });

  // Set up Show Results button (reopen preview panel after user closed it)
  dom.showResultsBtn.addEventListener('click', async () => {
    const options = getGeneratedOptions();
    const idx = getSelectedOptionIndex();
    if (options.length === 0) return;
    // Reset port so openFloorplatePanel reconnects even if panel appears "open"
    resetPanelState();
    await openFloorplatePanel();
    setPanelGeneratedOptions(options, idx, state.stories);
    sendOptionsToPanel(options, idx, state.stories);
  });

  // Initialize Forma connection
  initForma();

  // Load saved floorplates
  loadSavedFloorplates();

  // Initial button visibility (hidden until we have results)
  updateShowResultsButtonVisibility();
}

// Start the extension
init();

// ============================================================================
// Exports for Testing
// ============================================================================

export {
  handleGenerate,
  state,
  getCurrentFloorplan as currentFloorplan
};

// Re-export unit config functions for backwards compatibility
export { getUnitConfiguration, getEgressConfig } from './state/unit-config';
