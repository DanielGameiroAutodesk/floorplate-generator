/**
 * Floorplate Generator - Forma Extension Entry Point
 *
 * Bar Generator - Multifamily Floorplate Tool
 * Generates apartment layouts from building footprints in Autodesk Forma
 *
 * This file is the main orchestrator that:
 * 1. Initializes all modules
 * 2. Wires up cross-module communication
 * 3. Manages the button state machine
 * 4. Connects to Forma SDK
 *
 * The actual logic is split into focused modules:
 * - state/ui-state.ts - UI state management
 * - state/unit-config.ts - Configuration converters
 * - tabs/*.ts - Tab-specific handlers
 * - managers/*.ts - Core functionality managers
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
  isPanelCurrentlyOpen,
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
  getCurrentSelection
} from './managers';

// Building inspector (separate module)
import { initInspectTab } from './building-inspector';

// Baking
import { bakeWithBasicBuildingAPI } from './bake-building';

// Logging
import { Logger } from '../algorithm/utils/logger';

// ============================================================================
// Button State Management
// ============================================================================

let buttonState: ButtonState = 'select';

/**
 * Update the generate button's visual state and label.
 *
 * WHY state machine?
 * - Clear visual feedback about what clicking will do
 * - Prevents confusion about "what happens if I click?"
 * - Maps directly to user's mental model: select → generate → stop
 */
function updateButtonState(newState: ButtonState): void {
  buttonState = newState;

  switch (newState) {
    case 'select':
      dom.generateBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Select Building';
      break;
    case 'generate':
      dom.generateBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Generate';
      break;
    case 'stop':
      dom.generateBtn.innerHTML = '<span class="generate-btn-icon">&#9632;</span> Stop automatic generation';
      break;
  }
}

/**
 * Handle button click based on current state.
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
 * Handle save request from floating panel.
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
 * Handle bake request from floating panel.
 * Creates a native Forma building from the generated floorplate.
 */
async function handleBakeFloorplate(layoutOption: LayoutOption): Promise<void> {
  Logger.debug('handleBakeFloorplate called');
  try {
    Logger.info('Starting bake process...');

    const selection = getCurrentSelection();
    const result = await bakeWithBasicBuildingAPI(layoutOption.floorplan, {
      numFloors: state.stories,
      originalBuildingPath: selection[0],
      name: `Generated Building - ${layoutOption.strategy}`
    });

    if (result.success) {
      notifyBakeSuccess(result.urn || '');
      Logger.info(`Bake successful! URN: ${result.urn}`);

      // Reset state since original building is gone
      resetAfterBake();
      updateButtonState('select');
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    Logger.error(`Failed to bake floorplate: ${error}`);
    notifyBakeError(String(error));
  }
}

/**
 * Handle option selection from floating panel.
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
 * Handle generation complete - open panel and send options.
 */
async function onGenerationComplete(options: LayoutOption[], selectedIndex: number, _floorplan: FloorPlanData): Promise<void> {
  // Update building ID for saved floorplates filtering
  const buildingId = storage.generateBuildingId(state.length, state.buildingDepth);
  setCurrentBuildingId(buildingId);

  // Open panel if not open
  if (!isPanelCurrentlyOpen()) {
    await openFloorplatePanel();
  }

  // Update panel with options
  setPanelGeneratedOptions(options, selectedIndex);
  sendOptionsToPanel(options, selectedIndex);
}

/**
 * Handle loading a saved floorplate.
 */
async function onSavedFloorplateLoaded(options: LayoutOption[], floorplan: FloorPlanData): Promise<void> {
  // Set the loaded options
  setGeneratedOptions(options, floorplan);

  // Open panel if not open
  if (!isPanelCurrentlyOpen()) {
    await openFloorplatePanel();
  }

  // Send to floating panel
  sendOptionsToPanel(options, 0);

  // Render to Forma
  const meshData = renderFloorplate(floorplan);
  await Forma.render.addMesh({
    geometryData: {
      position: meshData.positions,
      color: meshData.colors
    }
  });
}

// ============================================================================
// Debug Section
// ============================================================================

function initDebug(): void {
  dom.debugToggle.addEventListener('click', () => {
    dom.debugSection.classList.toggle('show');
    if (dom.debugSection.classList.contains('show')) {
      dom.debugToggle.innerHTML = '&#9650; Hide Debug Output';
    } else {
      dom.debugToggle.innerHTML = '&#9660; Show Debug Output';
    }
  });
}

// ============================================================================
// Forma Connection
// ============================================================================

function setStatus(type: 'connected' | 'disconnected' | 'connecting', message: string): void {
  dom.statusBar.className = `status-bar ${type}`;
  dom.statusText.textContent = message;
}

async function initForma(): Promise<void> {
  try {
    const projectInfo = await Forma.project.get();
    setStatus('connected', `Connected to ${projectInfo.name || 'Forma'}`);
    dom.generateBtn.disabled = false;
    Logger.info(`Forma connection established: ${projectInfo.name || 'Forma'}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setStatus('disconnected', `Not connected: ${errorMessage}`);
    Logger.error(`Forma connection failed: ${error}`);
    dom.generateBtn.disabled = false; // Still enable for testing
  }
}

// ============================================================================
// Initialize
// ============================================================================

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
  initInspectTab();
  initDebug();

  // Set up generate button
  dom.generateBtn.addEventListener('click', handleButtonClick);

  // Initialize Forma connection
  initForma();

  // Load saved floorplates
  loadSavedFloorplates();
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
