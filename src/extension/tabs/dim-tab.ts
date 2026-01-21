/**
 * DIM Tab Module
 *
 * Handles the dimensions configuration tab where users define:
 * - Building length and depth
 * - Number of stories
 * - Corridor width
 * - Core placement and dimensions
 */

import { state } from '../state/ui-state';
import * as dom from '../utils/dom-refs';
import { FEET_TO_METERS } from '../../algorithm/constants';

// ============================================================================
// Module State
// ============================================================================

let markInputChangedCallback: (() => void) | null = null;

/**
 * Set the callback for when inputs change (triggers auto-regeneration).
 */
export function setMarkInputChanged(callback: () => void): void {
  markInputChangedCallback = callback;
}

function markInputChanged(): void {
  if (markInputChangedCallback) {
    markInputChangedCallback();
  }
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Typical floor-to-floor height in meters (approximately 10-12 feet).
 * Used to calculate number of stories from building height.
 */
const TYPICAL_FLOOR_HEIGHT_METERS = 3.2; // ~10.5 feet

// ============================================================================
// Building Dimension Updates
// ============================================================================

/**
 * Update the dimension inputs with values extracted from building footprint.
 *
 * WHY: When a user selects a building, we auto-populate dimensions from
 * the actual geometry. This saves time and ensures the algorithm works
 * with accurate values. Users can still override these values.
 *
 * @param widthMeters - Building width along corridor direction (meters)
 * @param depthMeters - Building depth perpendicular to corridor (meters)
 * @param heightMeters - Building height (meters)
 */
export function updateDimensionsFromBuilding(widthMeters: number, depthMeters: number, heightMeters: number): void {
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
  dom.buildingLengthInput.value = String(lengthFeet);
  dom.buildingDepthInput.value = String(depthFeet);
  dom.storiesSlider.value = String(stories);
  dom.storiesValue.textContent = `${stories} Flr`;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the DIM tab with event listeners.
 */
export function initDimTab(): void {
  // Length input
  dom.buildingLengthInput.addEventListener('input', () => {
    state.length = parseFloat(dom.buildingLengthInput.value) || 300;
    markInputChanged();
  });

  // Depth input
  dom.buildingDepthInput.addEventListener('input', () => {
    state.buildingDepth = parseFloat(dom.buildingDepthInput.value) || 65;
    markInputChanged();
  });

  // Stories slider
  dom.storiesSlider.addEventListener('input', () => {
    const value = parseInt(dom.storiesSlider.value);
    state.stories = value;
    dom.storiesValue.textContent = `${value} Flr`;
    markInputChanged();
  });

  // Corridor width
  dom.corridorWidthInput.addEventListener('input', () => {
    state.corridorWidth = parseFloat(dom.corridorWidthInput.value) || 6;
    markInputChanged();
  });

  // Core width
  dom.coreWidthInput.addEventListener('input', () => {
    state.coreWidth = parseFloat(dom.coreWidthInput.value) || 12;
    markInputChanged();
  });

  // Core depth
  dom.coreDepthInput.addEventListener('input', () => {
    state.coreDepth = parseFloat(dom.coreDepthInput.value) || 29.5;
    markInputChanged();
  });

  // Core placement toggle - North
  dom.coreNorthBtn.addEventListener('click', () => {
    state.corePlacement = 'North';
    dom.coreNorthBtn.classList.add('active');
    dom.coreSouthBtn.classList.remove('active');
    markInputChanged();
  });

  // Core placement toggle - South
  dom.coreSouthBtn.addEventListener('click', () => {
    state.corePlacement = 'South';
    dom.coreSouthBtn.classList.add('active');
    dom.coreNorthBtn.classList.remove('active');
    markInputChanged();
  });
}
