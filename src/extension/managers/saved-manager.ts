/**
 * Saved Floorplates Manager
 *
 * Handles persistence and UI for saved floorplate designs.
 * Uses Forma's cloud storage API via the storage-service module.
 */

import { LayoutOption, SavedFloorplateSummary, SerializableUIState, FloorPlanData } from '../../algorithm/types';
import * as storage from '../storage-service';
import { state, calculateSmartDefaultsFromArea } from '../state/ui-state';
import { renderUnitRows, updateTotalMix } from '../tabs/mix-tab';
import * as dom from '../utils/dom-refs';

// ============================================================================
// Module State
// ============================================================================

let savedFloorplates: SavedFloorplateSummary[] = [];
let currentBuildingId: string | null = null;

// Callbacks
let onLoadCallback: ((options: LayoutOption[], floorplan: FloorPlanData) => Promise<void>) | null = null;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Set callback for when a saved floorplate is loaded.
 */
export function setOnLoadCallback(callback: (options: LayoutOption[], floorplan: FloorPlanData) => Promise<void>): void {
  onLoadCallback = callback;
}

/**
 * Set the current building ID for filtering saves.
 */
export function setCurrentBuildingId(id: string | null): void {
  currentBuildingId = id;
  renderSavedList();
}

/**
 * Get current building ID.
 */
export function getCurrentBuildingId(): string | null {
  return currentBuildingId;
}

// ============================================================================
// State Serialization
// ============================================================================

/**
 * Get current UI state as a serializable object.
 * Used when saving a floorplate to include the configuration.
 */
export function getSerializableUIState(): SerializableUIState {
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
 * Restore UI state from a saved snapshot.
 * Handles migration from old saves that don't have advanced settings.
 */
export function restoreUIState(savedState: SerializableUIState): void {
  // Update state object
  state.alignment = savedState.alignment;
  // Migrate unit types: add advanced settings if missing (for old saves)
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
  if (dom.alignmentSlider) {
    dom.alignmentSlider.value = String(state.alignment);
    if (dom.alignmentValue) dom.alignmentValue.textContent = `${state.alignment}%`;
  }
  renderUnitRows();
  updateTotalMix();

  // DIM tab
  if (dom.buildingLengthInput) dom.buildingLengthInput.value = String(state.length);
  if (dom.buildingDepthInput) dom.buildingDepthInput.value = String(state.buildingDepth);
  if (dom.storiesSlider) {
    dom.storiesSlider.value = String(state.stories);
    if (dom.storiesValue) dom.storiesValue.textContent = String(state.stories);
  }
  if (dom.corridorWidthInput) dom.corridorWidthInput.value = String(state.corridorWidth);
  if (dom.coreWidthInput) dom.coreWidthInput.value = String(state.coreWidth);
  if (dom.coreDepthInput) dom.coreDepthInput.value = String(state.coreDepth);

  // Core placement toggle
  if (dom.coreNorthBtn && dom.coreSouthBtn) {
    if (state.corePlacement === 'North') {
      dom.coreNorthBtn.classList.add('active');
      dom.coreSouthBtn.classList.remove('active');
    } else {
      dom.coreNorthBtn.classList.remove('active');
      dom.coreSouthBtn.classList.add('active');
    }
  }

  // EGRESS tab
  if (dom.sprinklerToggle) dom.sprinklerToggle.checked = state.sprinklered;
  if (dom.commonPathInput) dom.commonPathInput.value = String(state.commonPath);
  if (dom.travelDistanceInput) dom.travelDistanceInput.value = String(state.travelDistance);
  if (dom.deadEndInput) dom.deadEndInput.value = String(state.deadEnd);
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Load saved floorplates from storage.
 */
export async function loadSavedFloorplates(): Promise<void> {
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
 * Save a floorplate with its configuration.
 *
 * @param layoutOption - The layout option to save
 * @returns The saved floorplate summary
 */
export async function saveFloorplate(layoutOption: LayoutOption): Promise<{ id: string; name: string }> {
  const buildingId = currentBuildingId || storage.generateBuildingId(state.length, state.buildingDepth);
  const uiState = getSerializableUIState();

  const saved = storage.createSavedFloorplate(layoutOption, uiState, buildingId);
  await storage.saveFloorplate(saved);

  // Refresh the list
  await loadSavedFloorplates();

  return { id: saved.id, name: saved.name };
}

/**
 * Load a saved floorplate by ID.
 */
export async function handleLoadSaved(id: string): Promise<void> {
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

    // Notify callback with loaded data
    if (onLoadCallback) {
      await onLoadCallback([saved.layoutOption], saved.layoutOption.floorplan);
    }

    console.log('Loaded saved floorplate:', saved.name);
  } catch (error) {
    console.error('Failed to load saved floorplate:', error);
  }
}

/**
 * Rename a saved floorplate.
 */
export async function handleRenameSaved(id: string, currentName: string): Promise<void> {
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
 * Duplicate a saved floorplate.
 */
export async function handleDuplicateSaved(id: string): Promise<void> {
  try {
    await storage.duplicateFloorplate(id);
    await loadSavedFloorplates();
  } catch (error) {
    console.error('Failed to duplicate:', error);
  }
}

/**
 * Delete a saved floorplate.
 */
export async function handleDeleteSaved(id: string): Promise<void> {
  if (!confirm('Delete this saved floorplate?')) return;

  try {
    await storage.deleteFloorplate(id);
    await loadSavedFloorplates();
  } catch (error) {
    console.error('Failed to delete:', error);
  }
}

// ============================================================================
// UI Rendering
// ============================================================================

/**
 * Render the saved floorplates list in the left panel.
 */
export function renderSavedList(): void {
  const listEl = dom.savedList;
  const countEl = dom.savedCount;
  const emptyEl = dom.savedEmpty;

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
 * Create a DOM element for a saved floorplate item.
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
