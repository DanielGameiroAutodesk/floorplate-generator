/**
 * Floorplate Generator - Forma Extension Entry Point
 *
 * Bar Generator - Multifamily Floorplate Tool
 * Generates apartment layouts from building footprints in Autodesk Forma
 */

// Import the Forma SDK
import { Forma } from 'forma-embedded-view-sdk/auto';

// Import the floorplate algorithm
import {
  generateFloorplateVariants,
  extractFootprintFromTriangles,
  renderFloorplate,
  UnitType,
  UnitColorMap
} from '../algorithm';

import { UnitConfiguration, EgressConfig, LayoutOption, SavedFloorplateSummary, SerializableUIState } from '../algorithm/types';
import { FEET_TO_METERS, SQ_FEET_TO_SQ_METERS, EGRESS_SPRINKLERED, EGRESS_UNSPRINKLERED } from '../algorithm/constants';
import * as storage from './storage-service';
import { initInspectTab } from './building-inspector';
import { bakeBuilding } from './bake-building';

// Note: FloorplateWindow replaced with Forma.openFloatingPanel()

// ============================================================================
// UI State - Dynamic Unit Types
// ============================================================================

interface UnitTypeAdvancedSettings {
  lShapeEligible: boolean;
  cornerEligible: boolean;
  sizeTolerance: number;        // 0-50 (percentage)
  minWidth: number;             // in feet
  maxWidth: number;             // in feet
  placementPriority: number;    // 1-100
  expansionWeight: number;      // 1-50
  compressionWeight: number;    // 0.01-20
}

interface UnitTypeConfig {
  id: string;
  name: string;
  color: string;
  percentage: number;
  area: number; // in sq ft
  // Advanced settings
  advanced: UnitTypeAdvancedSettings;
  useSmartDefaults: boolean;    // If true, calculate advanced from area
  advancedExpanded: boolean;    // UI state: is advanced panel visible?
}

interface UIState {
  // MIX tab
  alignment: number;
  unitTypes: UnitTypeConfig[];
  // DIM tab
  length: number;
  stories: number;
  buildingDepth: number;
  corridorWidth: number;
  corePlacement: 'North' | 'South';
  coreWidth: number;
  coreDepth: number;
  // EGRESS tab
  sprinklered: boolean;
  commonPath: number;
  travelDistance: number;
  deadEnd: number;
  // Auto-generate
  autoGenerate: boolean;
}

// Button states for the new workflow
type ButtonState = 'select' | 'generate' | 'stop';
let buttonState: ButtonState = 'select';

/**
 * Calculate smart defaults for advanced settings based on unit area
 * Small units (<590sf) get rigid, no-corner defaults
 * Large units (>1180sf) get flexible, corner-eligible defaults
 */
function calculateSmartDefaultsFromArea(areaSqFt: number): UnitTypeAdvancedSettings {
  const smallMax = 590;   // Studios
  const largeMin = 1180;  // 2BR+

  // Interpolation factor: 0 = small, 1 = large
  const t = Math.max(0, Math.min(1, (areaSqFt - smallMax) / (largeMin - smallMax)));

  return {
    sizeTolerance: Math.round(t * 25),           // 0-25%
    lShapeEligible: t >= 0.5,                    // Large units can be L-shaped
    cornerEligible: t > 0.5,                     // Only 2BR+ (>1003sf) can go at corners by default
    placementPriority: Math.round(10 + t * 90),  // 10-100
    minWidth: 12,                                // Standard minimum
    maxWidth: Math.round(areaSqFt / 12 * 1.5),   // Based on reasonable depth
    expansionWeight: Math.round(1 + t * 39),     // 1-40
    compressionWeight: parseFloat((0.5 + t * 9.5).toFixed(2))  // 0.5-10
  };
}

/**
 * Create a unit type config with smart defaults
 */
function createUnitTypeWithDefaults(
  id: string,
  name: string,
  color: string,
  percentage: number,
  area: number
): UnitTypeConfig {
  return {
    id,
    name,
    color,
    percentage,
    area,
    advanced: calculateSmartDefaultsFromArea(area),
    useSmartDefaults: true,
    advancedExpanded: false
  };
}

// Default unit types with smart defaults applied
const DEFAULT_UNIT_TYPES: UnitTypeConfig[] = [
  createUnitTypeWithDefaults('studio', 'Studios', '#3b82f6', 20, 590),
  createUnitTypeWithDefaults('onebed', '1-Bedroom', '#22c55e', 40, 885),
  createUnitTypeWithDefaults('twobed', '2-Bedroom', '#f97316', 30, 1180),
  createUnitTypeWithDefaults('threebed', '3-Bedroom', '#a855f7', 10, 1475)
];

const state: UIState = {
  alignment: 100,
  unitTypes: [...DEFAULT_UNIT_TYPES],
  length: 300,
  stories: 1,
  buildingDepth: 65,
  corridorWidth: 6,
  corePlacement: 'North',
  coreWidth: 12,
  coreDepth: 29.5,
  sprinklered: true,
  commonPath: 125,
  travelDistance: 250,
  deadEnd: 50,
  autoGenerate: false
};

// ============================================================================
// DOM Elements
// ============================================================================

// Status
const statusBar = document.getElementById('status-bar')!;
const statusText = document.getElementById('status-text')!;

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// MIX tab
const alignmentSlider = document.getElementById('alignment-slider') as HTMLInputElement;
const alignmentValue = document.getElementById('alignment-value')!;
const unitRowsContainer = document.getElementById('unit-rows-container')!;
const addUnitBtn = document.getElementById('add-unit-btn')!;
const totalMix = document.getElementById('total-mix')!;

// DIM tab
const buildingLengthInput = document.getElementById('building-length') as HTMLInputElement;
const buildingDepthInput = document.getElementById('building-depth') as HTMLInputElement;
const storiesSlider = document.getElementById('stories-slider') as HTMLInputElement;
const storiesValue = document.getElementById('stories-value')!;
const corridorWidthInput = document.getElementById('corridor-width') as HTMLInputElement;
const coreNorthBtn = document.getElementById('core-north')!;
const coreSouthBtn = document.getElementById('core-south')!;
const coreWidthInput = document.getElementById('core-width') as HTMLInputElement;
const coreDepthInput = document.getElementById('core-depth') as HTMLInputElement;

// EGRESS tab
const sprinklerToggle = document.getElementById('sprinkler-toggle') as HTMLInputElement;
const commonPathInput = document.getElementById('common-path') as HTMLInputElement;
const travelDistanceInput = document.getElementById('travel-distance') as HTMLInputElement;
const deadEndInput = document.getElementById('dead-end') as HTMLInputElement;

// Generate button
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;

// Debug
const debugToggle = document.getElementById('debug-toggle')!;
const debugSection = document.getElementById('debug-section')!;
const debugOutput = document.getElementById('debug-output')!;

// ============================================================================
// Forma State
// ============================================================================

let currentSelection: string[] = [];
let buildingTriangles: Float32Array | null = null;

// 3-Option Generation State
let selectedOptionIndex = 0; // 0 = Balanced, 1 = Mix Optimized, 2 = Efficiency
let generatedOptions: LayoutOption[] = [];
// Store current floorplan for reference
let currentFloorplan: import('../algorithm/types').FloorPlanData | null = null;

// Saved Floorplates State
let savedFloorplates: SavedFloorplateSummary[] = [];
let currentBuildingId: string | null = null;

// ============================================================================
// Floating Panel State
// ============================================================================

let floatingPanelPort: MessagePort | null = null;
let isPanelOpen: boolean = false;

/**
 * Get the base URL for the extension (works in both dev and production)
 */
function getExtensionBaseUrl(): string {
  // In development, the extension runs from localhost:5173
  // In production, it would be the deployed URL
  const currentScript = document.currentScript as HTMLScriptElement;
  if (currentScript && currentScript.src) {
    const url = new URL(currentScript.src);
    return `${url.origin}`;
  }
  // Fallback: use window.location.origin (works for Vite dev server)
  return window.location.origin;
}

/**
 * Open the floorplate floating panel using Forma's native panel API
 */
async function openFloorplatePanel(): Promise<void> {
  if (isPanelOpen) return;

  const baseUrl = getExtensionBaseUrl();
  const panelUrl = `${baseUrl}/floorplate-panel.html`;

  console.log('Opening floating panel with URL:', panelUrl);

  try {
    await Forma.openFloatingPanel({
      embeddedViewId: 'floorplate-preview',
      url: panelUrl,
      title: 'Floorplate Preview',
      preferredSize: { width: 700, height: 450 },
      placement: { type: 'right', offsetTop: 50 },
      minimumWidth: 400,
      minimumHeight: 300
    });

    isPanelOpen = true;

    // Set up message port for communication
    floatingPanelPort = await Forma.createMessagePort({
      embeddedViewId: 'floorplate-preview'
    });

    // Listen for messages from floating panel
    floatingPanelPort.onmessage = async (event: MessageEvent) => {
      const { type, data } = event.data;
      switch (type) {
        case 'PANEL_READY':
          console.log('Floating panel ready');
          // Send options if we have them
          if (generatedOptions.length > 0) {
            sendOptionsToPanel(generatedOptions, selectedOptionIndex);
          }
          break;

        case 'OPTION_SELECTED':
          // User selected a different option in the floating panel
          handleOptionSelected(data.index);
          break;

        case 'SAVE_FLOORPLATE':
          // Save the current floorplate option
          await handleSaveFloorplate(data.layoutOption);
          break;

        case 'BAKE_FLOORPLATE':
          // Bake the current floorplate to a native Forma building
          await handleBakeFloorplate(data.layoutOption);
          break;
      }
    };

  } catch (error) {
    console.error('Failed to open floating panel:', error);
    isPanelOpen = false;
  }
}

/**
 * Send all options to the floating panel
 */
function sendOptionsToPanel(options: LayoutOption[], selectedIndex: number): void {
  if (floatingPanelPort) {
    floatingPanelPort.postMessage({
      type: 'UPDATE_OPTIONS',
      data: { options, selectedIndex }
    });
  }
}

/**
 * Handle option selection from floating panel
 */
async function handleOptionSelected(index: number): Promise<void> {
  if (index < 0 || index >= generatedOptions.length) return;
  if (index === selectedOptionIndex) return;

  selectedOptionIndex = index;
  const selectedOption = generatedOptions[index];
  currentFloorplan = selectedOption.floorplan;

  // Render to Forma
  try {
    const meshData = renderFloorplate(selectedOption.floorplan);
    await Forma.render.addMesh({
      geometryData: {
        position: meshData.positions,
        color: meshData.colors
      }
    });
    console.log('Rendered option:', selectedOption.strategy);
  } catch (error) {
    console.error('Failed to render option:', error);
  }
}

// ============================================================================
// Saved Floorplates
// ============================================================================

/**
 * Get current UI state as a serializable object
 */
function getSerializableUIState(): SerializableUIState {
  return {
    alignment: state.alignment,
    unitTypes: state.unitTypes.map(ut => ({ ...ut })),
    length: state.length,
    stories: state.stories,
    buildingDepth: state.buildingDepth,
    corridorWidth: state.corridorWidth,
    corePlacement: state.corePlacement,
    coreWidth: state.coreWidth,
    coreDepth: state.coreDepth,
    sprinklered: state.sprinklered,
    commonPath: state.commonPath,
    travelDistance: state.travelDistance,
    deadEnd: state.deadEnd
  };
}

/**
 * Handle save request from floating panel
 */
async function handleSaveFloorplate(layoutOption: LayoutOption): Promise<void> {
  try {
    const buildingId = currentBuildingId || storage.generateBuildingId(state.length, state.buildingDepth);
    const uiState = getSerializableUIState();

    const saved = storage.createSavedFloorplate(layoutOption, uiState, buildingId);
    await storage.saveFloorplate(saved);

    // Refresh the saved list
    await loadSavedFloorplates();

    // Notify floating panel of success
    if (floatingPanelPort) {
      floatingPanelPort.postMessage({
        type: 'SAVE_SUCCESS',
        data: { id: saved.id, name: saved.name }
      });
    }

    console.log('Saved floorplate:', saved.name);
  } catch (error) {
    console.error('Failed to save floorplate:', error);
    if (floatingPanelPort) {
      floatingPanelPort.postMessage({
        type: 'SAVE_ERROR',
        data: { error: String(error) }
      });
    }
  }
}

/**
 * Handle bake request from floating panel
 * Creates a native Forma building from the generated floorplate
 */
async function handleBakeFloorplate(layoutOption: LayoutOption): Promise<void> {
  try {
    console.log('Starting bake process...');

    // Bake the floorplate
    const result = await bakeBuilding(layoutOption.floorplan, {
      numFloors: state.stories,
      originalBuildingPath: currentSelection[0], // Remove the original building
      name: `Generated Building - ${layoutOption.strategy}`
    });

    if (result.success) {
      // Notify floating panel of success
      if (floatingPanelPort) {
        floatingPanelPort.postMessage({
          type: 'BAKE_SUCCESS',
          data: { urn: result.urn }
        });
      }
      console.log('Bake successful! URN:', result.urn);

      // Reset state since original building is gone
      buildingTriangles = null;
      currentSelection = [];
      updateButtonState('select');
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Failed to bake floorplate:', error);
    if (floatingPanelPort) {
      floatingPanelPort.postMessage({
        type: 'BAKE_ERROR',
        data: { error: String(error) }
      });
    }
  }
}

/**
 * Load saved floorplates from storage
 */
async function loadSavedFloorplates(): Promise<void> {
  try {
    savedFloorplates = await storage.listFloorplates();
    renderSavedList();
  } catch (error) {
    console.error('Failed to load saved floorplates:', error);
    savedFloorplates = [];
    renderSavedList();
  }
}

/**
 * Render the saved floorplates list in the left panel
 */
function renderSavedList(): void {
  const listEl = document.getElementById('saved-list');
  const countEl = document.getElementById('saved-count');
  const emptyEl = document.getElementById('saved-empty');

  if (!listEl) return;

  // Filter by current building if one is selected
  const filtered = currentBuildingId
    ? savedFloorplates.filter(s => s.buildingId === currentBuildingId)
    : savedFloorplates;

  if (countEl) {
    countEl.textContent = `(${filtered.length})`;
  }

  if (emptyEl) {
    emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
  }

  // Clear existing items (but keep empty state element)
  Array.from(listEl.querySelectorAll('.saved-item')).forEach(el => el.remove());

  // Add saved items
  filtered.forEach(item => {
    listEl.appendChild(createSavedItemElement(item));
  });
}

/**
 * Create a DOM element for a saved floorplate item
 */
function createSavedItemElement(item: SavedFloorplateSummary): HTMLElement {
  const el = document.createElement('div');
  el.className = 'saved-item';
  el.dataset.id = item.id;

  const strategyLabels: Record<string, string> = {
    balanced: 'Balanced',
    mixOptimized: 'Mix Opt',
    efficiencyOptimized: 'Efficiency'
  };

  el.innerHTML = `
    <div class="saved-item-header">
      <span class="saved-item-name" title="${item.name}">${item.name}</span>
      <div class="saved-item-actions">
        <button class="saved-action-btn rename-btn" title="Rename">&#9998;</button>
        <button class="saved-action-btn duplicate-btn" title="Duplicate">&#128203;</button>
        <button class="saved-action-btn delete-btn" title="Delete">&#128465;</button>
      </div>
    </div>
    <div class="saved-item-stats">
      <span class="saved-stat">${item.previewStats.totalUnits} units</span>
      <span class="saved-stat">${(item.previewStats.efficiency * 100).toFixed(0)}% eff</span>
      <span class="saved-stat">${strategyLabels[item.previewStats.strategy] || item.previewStats.strategy}</span>
    </div>
    <div class="saved-item-meta">
      ${item.previewStats.buildingDimensions}
    </div>
  `;

  // Click to load
  el.addEventListener('click', (e) => {
    // Don't load if clicking on action buttons
    if ((e.target as HTMLElement).closest('.saved-item-actions')) return;
    handleLoadSaved(item.id);
  });

  // Action buttons
  const renameBtn = el.querySelector('.rename-btn');
  const duplicateBtn = el.querySelector('.duplicate-btn');
  const deleteBtn = el.querySelector('.delete-btn');

  renameBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleRenameSaved(item.id, item.name);
  });

  duplicateBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDuplicateSaved(item.id);
  });

  deleteBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteSaved(item.id);
  });

  return el;
}

/**
 * Load a saved floorplate
 */
async function handleLoadSaved(id: string): Promise<void> {
  try {
    const saved = await storage.loadFloorplate(id);
    if (!saved) {
      console.error('Saved floorplate not found:', id);
      return;
    }

    // Restore UI state
    restoreUIState(saved.uiState);

    // Update building ID
    currentBuildingId = saved.buildingId;

    // Set the loaded option as the only option (or restore as a single option)
    generatedOptions = [saved.layoutOption];
    selectedOptionIndex = 0;
    currentFloorplan = saved.layoutOption.floorplan;

    // Open panel if not open
    if (!isPanelOpen) {
      await openFloorplatePanel();
    }

    // Send to floating panel
    sendOptionsToPanel(generatedOptions, 0);

    // Render to Forma
    const meshData = renderFloorplate(currentFloorplan);
    await Forma.render.addMesh({
      geometryData: {
        position: meshData.positions,
        color: meshData.colors
      }
    });

    console.log('Loaded saved floorplate:', saved.name);
  } catch (error) {
    console.error('Failed to load saved floorplate:', error);
  }
}

/**
 * Restore UI state from a saved snapshot
 * Handles migration from old saves that don't have advanced settings
 */
function restoreUIState(savedState: SerializableUIState): void {
  // Update state object
  state.alignment = savedState.alignment;
  // Migrate unit types: add advanced settings if missing
  state.unitTypes = savedState.unitTypes.map(ut => ({
    ...ut,
    advanced: ut.advanced || calculateSmartDefaultsFromArea(ut.area),
    useSmartDefaults: ut.useSmartDefaults ?? true,
    advancedExpanded: false
  }));
  state.length = savedState.length;
  state.stories = savedState.stories;
  state.buildingDepth = savedState.buildingDepth;
  state.corridorWidth = savedState.corridorWidth;
  state.corePlacement = savedState.corePlacement;
  state.coreWidth = savedState.coreWidth;
  state.coreDepth = savedState.coreDepth;
  state.sprinklered = savedState.sprinklered;
  state.commonPath = savedState.commonPath;
  state.travelDistance = savedState.travelDistance;
  state.deadEnd = savedState.deadEnd;

  // Update all form controls
  // MIX tab
  if (alignmentSlider) {
    alignmentSlider.value = String(state.alignment);
    if (alignmentValue) alignmentValue.textContent = `${state.alignment}%`;
  }
  renderUnitRows();
  updateTotalMix();

  // DIM tab
  if (buildingLengthInput) buildingLengthInput.value = String(state.length);
  if (buildingDepthInput) buildingDepthInput.value = String(state.buildingDepth);
  if (storiesSlider) {
    storiesSlider.value = String(state.stories);
    if (storiesValue) storiesValue.textContent = String(state.stories);
  }
  if (corridorWidthInput) corridorWidthInput.value = String(state.corridorWidth);
  if (coreWidthInput) coreWidthInput.value = String(state.coreWidth);
  if (coreDepthInput) coreDepthInput.value = String(state.coreDepth);

  // Core placement toggle
  if (coreNorthBtn && coreSouthBtn) {
    if (state.corePlacement === 'North') {
      coreNorthBtn.classList.add('active');
      coreSouthBtn.classList.remove('active');
    } else {
      coreNorthBtn.classList.remove('active');
      coreSouthBtn.classList.add('active');
    }
  }

  // EGRESS tab
  if (sprinklerToggle) sprinklerToggle.checked = state.sprinklered;
  if (commonPathInput) commonPathInput.value = String(state.commonPath);
  if (travelDistanceInput) travelDistanceInput.value = String(state.travelDistance);
  if (deadEndInput) deadEndInput.value = String(state.deadEnd);
}

/**
 * Handle rename saved floorplate
 */
async function handleRenameSaved(id: string, currentName: string): Promise<void> {
  const newName = prompt('Enter new name:', currentName);
  if (!newName || newName === currentName) return;

  try {
    await storage.updateFloorplateName(id, newName);
    await loadSavedFloorplates();
  } catch (error) {
    console.error('Failed to rename:', error);
  }
}

/**
 * Handle duplicate saved floorplate
 */
async function handleDuplicateSaved(id: string): Promise<void> {
  try {
    await storage.duplicateFloorplate(id);
    await loadSavedFloorplates();
  } catch (error) {
    console.error('Failed to duplicate:', error);
  }
}

/**
 * Handle delete saved floorplate
 */
async function handleDeleteSaved(id: string): Promise<void> {
  if (!confirm('Delete this saved floorplate?')) return;

  try {
    await storage.deleteFloorplate(id);
    await loadSavedFloorplates();
  } catch (error) {
    console.error('Failed to delete:', error);
  }
}

// ============================================================================
// Auto-Generate Logic
// ============================================================================

let generateTimeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_DELAY = 300; // ms

function debounceGenerate() {
  if (generateTimeout) {
    clearTimeout(generateTimeout);
  }

  if (state.autoGenerate && buildingTriangles) {
    generateTimeout = setTimeout(() => {
      handleGenerate();
    }, DEBOUNCE_DELAY);
  }
}

function markInputChanged() {
  if (state.autoGenerate && buildingTriangles) {
    debounceGenerate();
  }
}

// ============================================================================
// Button State Management
// ============================================================================

function updateButtonState(newState: ButtonState) {
  buttonState = newState;

  switch (newState) {
    case 'select':
      generateBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Select Building';
      break;
    case 'generate':
      generateBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Generate';
      break;
    case 'stop':
      generateBtn.innerHTML = '<span class="generate-btn-icon">&#9632;</span> Stop automatic generation';
      break;
  }
}

function handleStopAutoGeneration() {
  // Clear any pending debounce timeouts
  if (generateTimeout) {
    clearTimeout(generateTimeout);
    generateTimeout = null;
  }

  // Disable auto-generation
  state.autoGenerate = false;

  // Update button to "Generate" state
  updateButtonState('generate');
}

// ============================================================================
// Tab Switching
// ============================================================================

function initTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');

      // Update tab buttons
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${tabId}`) {
          content.classList.add('active');
        }
      });
    });
  });
}

// ============================================================================
// Dynamic Unit Rows Rendering
// ============================================================================

function generateUnitId(): string {
  return 'unit_' + Math.random().toString(36).substring(2, 9);
}

function renderUnitRows() {
  unitRowsContainer.innerHTML = '';

  state.unitTypes.forEach((unit) => {
    const row = document.createElement('div');
    row.className = `unit-row${unit.advancedExpanded ? ' expanded' : ''}`;
    row.dataset.unitId = unit.id;

    const adv = unit.useSmartDefaults ? calculateSmartDefaultsFromArea(unit.area) : unit.advanced;

    row.innerHTML = `
      <div class="unit-row-basic" data-unit-id="${unit.id}">
        <span class="expand-chevron" style="color: ${unit.color};">&#9658;</span>
        <div class="unit-label" data-unit-id="${unit.id}" contenteditable="false">${unit.name}</div>
        <div class="unit-inputs">
          <div class="unit-input pct">
            <input type="number" class="unit-pct-input" data-unit-id="${unit.id}" value="${unit.percentage}" min="0" max="100">
            <span class="suffix">%</span>
          </div>
          <div class="unit-input area">
            <input type="number" class="unit-area-input" data-unit-id="${unit.id}" value="${unit.area}" min="200" max="3000">
            <span class="suffix">sf</span>
          </div>
        </div>
        <button class="remove-btn" data-unit-id="${unit.id}" title="Remove unit type">&times;</button>
      </div>
      <div class="unit-advanced-panel${unit.useSmartDefaults ? ' smart-defaults' : ''}" style="display: ${unit.advancedExpanded ? 'block' : 'none'};">
        <div class="advanced-header">
          <span>Advanced Settings</span>
          <label class="smart-defaults-toggle">
            <input type="checkbox" class="smart-defaults-cb" data-unit-id="${unit.id}" ${unit.useSmartDefaults ? 'checked' : ''}>
            <span>Smart defaults</span>
          </label>
        </div>
        <div class="color-picker-row">
          <span>Color</span>
          <div class="color-picker-swatch" style="background: ${unit.color};">
            <input type="color" class="color-picker-input" value="${unit.color}" data-unit-id="${unit.id}">
          </div>
        </div>
        <div class="advanced-grid">
          <div class="advanced-section">
            <div class="section-label">Placement</div>
            <div class="checkbox-grid">
              <label class="checkbox-row">
                <input type="checkbox" class="corner-eligible-cb" data-unit-id="${unit.id}" ${adv.cornerEligible ? 'checked' : ''}>
                <span>Corner</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" class="lshape-eligible-cb" data-unit-id="${unit.id}" ${adv.lShapeEligible ? 'checked' : ''}>
                <span>L-shape</span>
              </label>
            </div>
            <div class="input-row">
              <span>Priority</span>
              <input type="number" class="priority-input" data-unit-id="${unit.id}" value="${adv.placementPriority}" min="1" max="100">
            </div>
          </div>
          <div class="advanced-section">
            <div class="section-label">Size Flexibility</div>
            <div class="input-row">
              <span>Tolerance</span>
              <input type="number" class="tolerance-input" data-unit-id="${unit.id}" value="${adv.sizeTolerance}" min="0" max="50">
              <span class="suffix">%</span>
            </div>
            <div class="input-row">
              <span>Min Width</span>
              <input type="number" class="min-width-input" data-unit-id="${unit.id}" value="${adv.minWidth}" min="10" max="30">
              <span class="suffix">ft</span>
            </div>
            <div class="input-row">
              <span>Max Width</span>
              <input type="number" class="max-width-input" data-unit-id="${unit.id}" value="${adv.maxWidth}" min="15" max="100">
              <span class="suffix">ft</span>
            </div>
          </div>
        </div>
      </div>
    `;

    unitRowsContainer.appendChild(row);
  });

  // Attach event listeners to the new elements
  attachUnitRowEventListeners();
  updateTotalMix();
}

function attachUnitRowEventListeners() {
  // Color picker change
  document.querySelectorAll('.color-picker-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.color = target.value;
        // Update the color swatch background
        const swatch = target.parentElement as HTMLElement;
        swatch.style.background = target.value;
        // Update the chevron color
        const row = target.closest('.unit-row') as HTMLElement;
        const chevron = row.querySelector('.expand-chevron') as HTMLElement;
        if (chevron) chevron.style.color = target.value;
        markInputChanged();
      }
    });
  });

  // Double-click to edit label
  document.querySelectorAll('.unit-label').forEach(label => {
    label.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      target.contentEditable = 'true';
      target.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });

    // Save on blur
    label.addEventListener('blur', (e) => {
      const target = e.target as HTMLElement;
      target.contentEditable = 'false';
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.name = target.textContent || 'Unit';
        markInputChanged();
      }
    });

    // Save on Enter key
    label.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter') {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
    });
  });

  // Percentage input change
  document.querySelectorAll('.unit-pct-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.percentage = parseFloat(target.value) || 0;
        updateTotalMix();
        markInputChanged();
      }
    });
  });

  // Area input change
  document.querySelectorAll('.unit-area-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.area = parseFloat(target.value) || 500;
        markInputChanged();
      }
    });
  });

  // Remove button click
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const unitId = target.dataset.unitId;

      // Don't allow removing if only 1 unit type left
      if (state.unitTypes.length <= 1) {
        alert('At least one unit type is required.');
        return;
      }

      state.unitTypes = state.unitTypes.filter(u => u.id !== unitId);
      renderUnitRows();
      markInputChanged();
    });
  });

  // Row click (toggle advanced panel) - ignore clicks on inputs/buttons
  document.querySelectorAll('.unit-row-basic').forEach(rowBasic => {
    rowBasic.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Ignore clicks on inputs, buttons, and color picker
      if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('.unit-inputs') || target.closest('.unit-color')) {
        return;
      }
      const unitId = (rowBasic as HTMLElement).dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.advancedExpanded = !unit.advancedExpanded;
        const row = rowBasic.closest('.unit-row') as HTMLElement;
        const panel = row.querySelector('.unit-advanced-panel') as HTMLElement;
        row.classList.toggle('expanded', unit.advancedExpanded);
        panel.style.display = unit.advancedExpanded ? 'block' : 'none';
      }
    });
  });

  // Smart defaults checkbox
  document.querySelectorAll('.smart-defaults-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.useSmartDefaults = target.checked;
        renderUnitRows();
        markInputChanged();
      }
    });
  });

  // Advanced settings inputs (only update if not using smart defaults)
  const advancedInputHandlers = [
    { selector: '.corner-eligible-cb', prop: 'cornerEligible', isCheckbox: true },
    { selector: '.lshape-eligible-cb', prop: 'lShapeEligible', isCheckbox: true },
    { selector: '.priority-input', prop: 'placementPriority', isCheckbox: false },
    { selector: '.tolerance-input', prop: 'sizeTolerance', isCheckbox: false },
    { selector: '.min-width-input', prop: 'minWidth', isCheckbox: false },
    { selector: '.max-width-input', prop: 'maxWidth', isCheckbox: false }
  ];

  advancedInputHandlers.forEach(({ selector, prop, isCheckbox }) => {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener(isCheckbox ? 'change' : 'input', (e) => {
        const target = e.target as HTMLInputElement;
        const unitId = target.dataset.unitId;
        const unit = state.unitTypes.find(u => u.id === unitId);
        if (unit) {
          // PLACEMENT settings (cornerEligible, lShapeEligible) can ALWAYS be manually overridden
          // even when smart defaults is on - these are important user choices
          const isPlacementSetting = prop === 'cornerEligible' || prop === 'lShapeEligible';

          if (!unit.useSmartDefaults || isPlacementSetting) {
            const newValue = isCheckbox ? target.checked : (parseInt(target.value) || 0);
            (unit.advanced as unknown as Record<string, unknown>)[prop] = newValue;
            console.log(`[DEBUG] Setting ${unit.name} ${prop} = ${newValue} (smartDefaults: ${unit.useSmartDefaults})`);
            markInputChanged();
          }
        }
      });
    });
  });
}

// ============================================================================
// MIX Tab Logic
// ============================================================================

function initMixTab() {
  // Alignment slider
  alignmentSlider.addEventListener('input', () => {
    const value = parseInt(alignmentSlider.value);
    state.alignment = value;
    if (value >= 80) {
      alignmentValue.textContent = 'Strict';
    } else if (value >= 40) {
      alignmentValue.textContent = 'Moderate';
    } else {
      alignmentValue.textContent = 'Flexible';
    }
    markInputChanged();
  });

  // Add unit button
  addUnitBtn.addEventListener('click', () => {
    // Generate a random color
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#6366f1'];
    const usedColors = state.unitTypes.map(u => u.color);
    const availableColors = colors.filter(c => !usedColors.includes(c));
    const newColor = availableColors.length > 0
      ? availableColors[0]
      : '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

    // Create new unit with smart defaults based on default area
    const defaultArea = 800;
    const newUnit = createUnitTypeWithDefaults(
      generateUnitId(),
      'New Unit',
      newColor,
      0,
      defaultArea
    );

    state.unitTypes.push(newUnit);
    renderUnitRows();
    markInputChanged();
  });

  // Initial render
  renderUnitRows();
}

function updateTotalMix() {
  const total = state.unitTypes.reduce((sum, unit) => sum + unit.percentage, 0);

  totalMix.textContent = `Total Mix: ${total}%`;

  if (total === 100) {
    totalMix.classList.remove('error');
  } else {
    totalMix.classList.add('error');
  }
}

// ============================================================================
// DIM Tab Logic
// ============================================================================

// Typical floor-to-floor height in meters (approximately 10-12 feet)
const TYPICAL_FLOOR_HEIGHT_METERS = 3.2; // ~10.5 feet

/**
 * Update the dimension inputs with building footprint values
 */
function updateDimensionsFromBuilding(widthMeters: number, depthMeters: number, heightMeters: number): void {
  // Convert meters to feet
  const lengthFeet = Math.round(widthMeters / FEET_TO_METERS);
  const depthFeet = Math.round(depthMeters / FEET_TO_METERS);

  // Calculate number of stories from building height
  const stories = Math.max(1, Math.round(heightMeters / TYPICAL_FLOOR_HEIGHT_METERS));

  // Update state
  state.length = lengthFeet;
  state.buildingDepth = depthFeet;
  state.stories = stories;

  // Update UI inputs
  buildingLengthInput.value = String(lengthFeet);
  buildingDepthInput.value = String(depthFeet);
  storiesSlider.value = String(stories);
  storiesValue.textContent = `${stories} Flr`;
}

function initDimTab() {
  // Length input
  buildingLengthInput.addEventListener('input', () => {
    state.length = parseFloat(buildingLengthInput.value) || 300;
    markInputChanged();
  });

  // Depth input
  buildingDepthInput.addEventListener('input', () => {
    state.buildingDepth = parseFloat(buildingDepthInput.value) || 65;
    markInputChanged();
  });

  // Stories slider
  storiesSlider.addEventListener('input', () => {
    const value = parseInt(storiesSlider.value);
    state.stories = value;
    storiesValue.textContent = `${value} Flr`;
    markInputChanged();
  });

  corridorWidthInput.addEventListener('input', () => {
    state.corridorWidth = parseFloat(corridorWidthInput.value) || 6;
    markInputChanged();
  });

  coreWidthInput.addEventListener('input', () => {
    state.coreWidth = parseFloat(coreWidthInput.value) || 12;
    markInputChanged();
  });

  coreDepthInput.addEventListener('input', () => {
    state.coreDepth = parseFloat(coreDepthInput.value) || 29.5;
    markInputChanged();
  });

  // Core placement toggle
  coreNorthBtn.addEventListener('click', () => {
    state.corePlacement = 'North';
    coreNorthBtn.classList.add('active');
    coreSouthBtn.classList.remove('active');
    markInputChanged();
  });

  coreSouthBtn.addEventListener('click', () => {
    state.corePlacement = 'South';
    coreSouthBtn.classList.add('active');
    coreNorthBtn.classList.remove('active');
    markInputChanged();
  });
}

// ============================================================================
// EGRESS Tab Logic
// ============================================================================

function initEgressTab() {
  // Sprinkler toggle
  sprinklerToggle.addEventListener('change', () => {
    state.sprinklered = sprinklerToggle.checked;
    updateEgressDefaults();
    markInputChanged();
  });

  // Input fields
  commonPathInput.addEventListener('input', () => {
    state.commonPath = parseFloat(commonPathInput.value) || 125;
    markInputChanged();
  });

  travelDistanceInput.addEventListener('input', () => {
    state.travelDistance = parseFloat(travelDistanceInput.value) || 250;
    markInputChanged();
  });

  deadEndInput.addEventListener('input', () => {
    state.deadEnd = parseFloat(deadEndInput.value) || 50;
    markInputChanged();
  });
}

function updateEgressDefaults() {
  if (state.sprinklered) {
    commonPathInput.value = '125';
    travelDistanceInput.value = '250';
    deadEndInput.value = '50';
    state.commonPath = 125;
    state.travelDistance = 250;
    state.deadEnd = 50;
  } else {
    commonPathInput.value = '75';
    travelDistanceInput.value = '200';
    deadEndInput.value = '20';
    state.commonPath = 75;
    state.travelDistance = 200;
    state.deadEnd = 20;
  }
}

// ============================================================================
// Debug Section
// ============================================================================

function initDebug() {
  debugToggle.addEventListener('click', () => {
    debugSection.classList.toggle('show');
    if (debugSection.classList.contains('show')) {
      debugToggle.innerHTML = '&#9650; Hide Debug Output';
    } else {
      debugToggle.innerHTML = '&#9660; Show Debug Output';
    }
  });
}

function showDebug(data: unknown) {
  debugOutput.textContent = typeof data === 'string'
    ? data
    : JSON.stringify(data, null, 2);
}

// ============================================================================
// Forma Connection
// ============================================================================

function setStatus(type: 'connected' | 'disconnected' | 'connecting', message: string) {
  statusBar.className = `status-bar ${type}`;
  statusText.textContent = message;
}

async function initForma() {
  try {
    // Test connection by getting project info
    const projectInfo = await Forma.project.get();
    setStatus('connected', `Connected to ${projectInfo.name || 'Forma'}`);

    // Enable generate button
    generateBtn.disabled = false;

    console.log('Forma connection established:', projectInfo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setStatus('disconnected', `Not connected: ${errorMessage}`);
    console.error('Forma connection failed:', error);

    // Still enable for testing
    generateBtn.disabled = false;
  }
}

// ============================================================================
// Get Unit Configuration from UI State
// ============================================================================

function getUnitConfiguration(): UnitConfiguration {
  // Map dynamic unit types to the algorithm's expected format
  // The algorithm expects specific unit types, so we map based on index/size
  const sortedUnits = [...state.unitTypes].sort((a, b) => a.area - b.area);

  // Default configuration
  const config: UnitConfiguration = {
    [UnitType.Studio]: { percentage: 0, area: 55 * SQ_FEET_TO_SQ_METERS, cornerEligible: false },
    [UnitType.OneBed]: { percentage: 0, area: 82 * SQ_FEET_TO_SQ_METERS, cornerEligible: false },
    [UnitType.TwoBed]: { percentage: 0, area: 110 * SQ_FEET_TO_SQ_METERS, cornerEligible: true },
    [UnitType.ThreeBed]: { percentage: 0, area: 137 * SQ_FEET_TO_SQ_METERS, cornerEligible: true }
  };

  // Map units to types by size (smallest = studio, largest = 3BR)
  const typeMap: UnitType[] = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed];

  sortedUnits.forEach((unit, index) => {
    const typeIndex = Math.min(index, typeMap.length - 1);
    const unitType = typeMap[typeIndex];
    // Get advanced settings - use smart defaults or manual settings
    const smartDefaults = calculateSmartDefaultsFromArea(unit.area);
    const adv = unit.useSmartDefaults ? smartDefaults : unit.advanced;

    // For PLACEMENT settings, always check for manual override first
    // This allows users to override cornerEligible even with smart defaults on
    const cornerEligible = unit.advanced.cornerEligible !== undefined
      ? unit.advanced.cornerEligible
      : adv.cornerEligible;

    console.log(`[DEBUG] getUnitConfiguration: ${unit.name} (${unitType}) cornerEligible:`, {
      'unit.advanced.cornerEligible': unit.advanced.cornerEligible,
      'smartDefaults.cornerEligible': smartDefaults.cornerEligible,
      'final': cornerEligible
    });

    config[unitType] = {
      percentage: unit.percentage,
      area: unit.area * SQ_FEET_TO_SQ_METERS,
      cornerEligible: cornerEligible
    };
  });

  return config;
}

function getUnitColors(): UnitColorMap {
  // Map UI colors to algorithm UnitTypes using the same size-based sorting
  const sortedUnits = [...state.unitTypes].sort((a, b) => a.area - b.area);
  const typeMap: UnitType[] = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed];

  const colors: UnitColorMap = {};
  sortedUnits.forEach((unit, index) => {
    const typeIndex = Math.min(index, typeMap.length - 1);
    const unitType = typeMap[typeIndex];
    colors[unitType] = unit.color;
  });

  return colors;
}

function getEgressConfig(): EgressConfig {
  if (state.sprinklered) {
    return {
      ...EGRESS_SPRINKLERED,
      deadEndLimit: state.deadEnd * FEET_TO_METERS,
      travelDistanceLimit: state.travelDistance * FEET_TO_METERS,
      commonPathLimit: state.commonPath * FEET_TO_METERS
    };
  } else {
    return {
      ...EGRESS_UNSPRINKLERED,
      deadEndLimit: state.deadEnd * FEET_TO_METERS,
      travelDistanceLimit: state.travelDistance * FEET_TO_METERS,
      commonPathLimit: state.commonPath * FEET_TO_METERS
    };
  }
}

// ============================================================================
// Generate Floorplate
// ============================================================================

async function handleGenerate() {
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Generating...';

  try {
    // Get current selection
    const selection = await Forma.selection.getSelection();

    if (!selection || selection.length === 0) {
      showDebug({
        status: 'Error',
        message: 'Please select a building in Forma first'
      });
      // Keep button in "select" state since no building was selected
      generateBtn.disabled = false;
      updateButtonState('select');
      return;
    }

    currentSelection = selection;

    // Get building geometry
    const triangles = await Forma.geometry.getTriangles({ path: currentSelection[0] });

    if (!triangles || triangles.length === 0) {
      showDebug({
        status: 'Error',
        message: 'Could not read building geometry. Try selecting a different building.'
      });
      return;
    }

    buildingTriangles = triangles;

    // Extract footprint from triangles
    const footprint = extractFootprintFromTriangles(buildingTriangles);

    console.log('=== FOOTPRINT ===');
    console.log('Width:', footprint.width.toFixed(2), 'm');
    console.log('Depth:', footprint.depth.toFixed(2), 'm');
    console.log('Center:', footprint.centerX.toFixed(2), footprint.centerY.toFixed(2));
    console.log('Rotation:', (footprint.rotation * 180 / Math.PI).toFixed(1), 'deg');

    // Populate dimension inputs with building's actual dimensions
    updateDimensionsFromBuilding(footprint.width, footprint.depth, footprint.height);

    // Get configurations from UI
    const unitConfig = getUnitConfiguration();
    const egressConfig = getEgressConfig();
    const unitColors = getUnitColors();
    const corridorWidth = state.corridorWidth * FEET_TO_METERS;
    const coreWidth = state.coreWidth * FEET_TO_METERS;
    const coreDepth = state.coreDepth * FEET_TO_METERS;

    console.log('=== UI CONFIG ===');
    console.log('Unit Types:', state.unitTypes);
    console.log('Unit Colors:', unitColors);
    console.log('Corridor Width:', state.corridorWidth, 'ft =>', corridorWidth.toFixed(2), 'm');
    console.log('Core Width:', state.coreWidth, 'ft =>', coreWidth.toFixed(2), 'm');
    console.log('Core Depth:', state.coreDepth, 'ft =>', coreDepth.toFixed(2), 'm');
    console.log('Core Placement:', state.corePlacement);
    console.log('Sprinklered:', state.sprinklered);

    // Generate all 3 variants with custom colors
    generatedOptions = generateFloorplateVariants(
      footprint,
      unitConfig,
      egressConfig,
      corridorWidth,
      coreWidth,
      coreDepth,
      state.corePlacement,
      unitColors
    );

    console.log('Generated options:', generatedOptions.map(o => ({
      strategy: o.strategy,
      units: o.floorplan.stats.totalUnits,
      efficiency: (o.floorplan.stats.efficiency * 100).toFixed(1) + '%'
    })));

    // Select the first option (Balanced) by default
    selectedOptionIndex = 0;
    const selectedOption = generatedOptions[selectedOptionIndex];
    if (!selectedOption) {
      throw new Error('Failed to generate options');
    }

    currentFloorplan = selectedOption.floorplan;

    // Open floating panel automatically on first successful generation
    if (!isPanelOpen) {
      await openFloorplatePanel();
    }

    // Send all options to floating panel
    sendOptionsToPanel(generatedOptions, selectedOptionIndex);

    // Enable auto-generation and update button state
    state.autoGenerate = true;
    updateButtonState('stop');

    // Render to mesh
    const meshData = renderFloorplate(selectedOption.floorplan);

    // Add to Forma
    await Forma.render.addMesh({
      geometryData: {
        position: meshData.positions,
        color: meshData.colors
      }
    });

    // Calculate stats using typeId (or legacy type as fallback)
    const unitCounts: Record<string, number> = {};
    selectedOption.floorplan.units.forEach(unit => {
      const typeKey = unit.typeId || unit.type || 'unknown';
      unitCounts[typeKey] = (unitCounts[typeKey] || 0) + 1;
    });

    // Show results with all options comparison
    const optionsSummary = generatedOptions.map(o => ({
      strategy: o.strategy,
      units: o.floorplan.stats.totalUnits,
      efficiency: `${(o.floorplan.stats.efficiency * 100).toFixed(1)}%`,
      nrsf: `${o.floorplan.stats.nrsf.toFixed(0)} sq m`
    }));

    showDebug({
      status: 'Success!',
      selectedOptionIndex,
      building: {
        width: `${footprint.width.toFixed(1)}m (${(footprint.width / FEET_TO_METERS).toFixed(0)} ft)`,
        depth: `${footprint.depth.toFixed(1)}m (${(footprint.depth / FEET_TO_METERS).toFixed(0)} ft)`,
        rotation: `${(footprint.rotation * 180 / Math.PI).toFixed(1)}deg`
      },
      options: optionsSummary,
      selected: {
        corridor: `${selectedOption.floorplan.corridor.width.toFixed(1)}m x ${selectedOption.floorplan.corridor.depth.toFixed(1)}m`,
        cores: selectedOption.floorplan.cores.length,
        totalUnits: selectedOption.floorplan.units.length
      },
      unitBreakdown: unitCounts,
      metrics: {
        gsf: `${selectedOption.floorplan.stats.gsf.toFixed(0)} sq m`,
        nrsf: `${selectedOption.floorplan.stats.nrsf.toFixed(0)} sq m`,
        efficiency: `${(selectedOption.floorplan.stats.efficiency * 100).toFixed(1)}%`
      },
      egress: selectedOption.floorplan.egress
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showDebug({
      status: 'Error',
      error: errorMessage
    });
    console.error('Generation failed:', error);
    // On error, reset to appropriate state
    generateBtn.disabled = false;
    if (buildingTriangles) {
      updateButtonState('generate');
    } else {
      updateButtonState('select');
    }
  } finally {
    generateBtn.disabled = false;
  }
}

// ============================================================================
// Initialize
// ============================================================================

function handleButtonClick() {
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

function init() {
  // Initialize UI components
  initTabs();
  initMixTab();
  initDimTab();
  initEgressTab();
  initInspectTab();
  initDebug();

  // Set up generate button with state-based click handler
  generateBtn.addEventListener('click', handleButtonClick);

  // Initialize Forma connection
  initForma();

  // Load saved floorplates
  loadSavedFloorplates();
}

// Start the extension
init();

// Export for testing
export { handleGenerate, state, getUnitConfiguration, getEgressConfig, currentFloorplan };
