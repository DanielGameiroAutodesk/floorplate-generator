/**
 * DOM Element References
 *
 * Centralized access to all DOM elements used by the extension.
 * Cached on module load to avoid repeated querySelector calls.
 *
 * WHY: Centralizing DOM references makes it easier to:
 * 1. See all UI elements in one place
 * 2. Ensure elements exist before use (with !)
 * 3. Refactor HTML without hunting through code
 */

// ============================================================================
// Status Bar
// ============================================================================

export const statusBar = document.getElementById('status-bar')!;
export const statusText = document.getElementById('status-text')!;

// ============================================================================
// Tabs
// ============================================================================

export const tabs = document.querySelectorAll('.tab');
export const tabContents = document.querySelectorAll('.tab-content');

// ============================================================================
// MIX Tab
// ============================================================================

export const alignmentSlider = document.getElementById('alignment-slider') as HTMLInputElement;
export const alignmentValue = document.getElementById('alignment-value')!;
export const unitRowsContainer = document.getElementById('unit-rows-container')!;
export const addUnitBtn = document.getElementById('add-unit-btn')!;
export const totalMix = document.getElementById('total-mix')!;

// ============================================================================
// DIM Tab
// ============================================================================

export const buildingLengthInput = document.getElementById('building-length') as HTMLInputElement;
export const buildingDepthInput = document.getElementById('building-depth') as HTMLInputElement;
export const storiesSlider = document.getElementById('stories-slider') as HTMLInputElement;
export const storiesValue = document.getElementById('stories-value')!;
export const corridorWidthInput = document.getElementById('corridor-width') as HTMLInputElement;
export const coreNorthBtn = document.getElementById('core-north')!;
export const coreSouthBtn = document.getElementById('core-south')!;
export const coreWidthInput = document.getElementById('core-width') as HTMLInputElement;
export const coreDepthInput = document.getElementById('core-depth') as HTMLInputElement;

// ============================================================================
// EGRESS Tab
// ============================================================================

export const sprinklerToggle = document.getElementById('sprinkler-toggle') as HTMLInputElement;
export const commonPathInput = document.getElementById('common-path') as HTMLInputElement;
export const travelDistanceInput = document.getElementById('travel-distance') as HTMLInputElement;
export const deadEndInput = document.getElementById('dead-end') as HTMLInputElement;

// ============================================================================
// Actions
// ============================================================================

export const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
export const showResultsBtn = document.getElementById('show-results-btn') as HTMLButtonElement;

// ============================================================================
// Saved Floorplates
// ============================================================================

export const savedList = document.getElementById('saved-list');
export const savedCount = document.getElementById('saved-count');
export const savedEmpty = document.getElementById('saved-empty');
