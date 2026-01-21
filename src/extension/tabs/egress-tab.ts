/**
 * EGRESS Tab Module
 *
 * Handles the egress (fire safety) configuration tab where users define:
 * - Sprinkler status (affects default distances)
 * - Common path of travel limit
 * - Maximum travel distance to exit
 * - Dead-end corridor limit
 */

import { state } from '../state/ui-state';
import * as dom from '../utils/dom-refs';

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
// Egress Defaults
// ============================================================================

/**
 * Update egress distance inputs based on sprinkler status.
 *
 * WHY: Building codes allow longer travel distances in sprinklered buildings
 * because sprinklers provide additional time for evacuation. These defaults
 * are based on IBC (International Building Code) requirements, but users
 * can override for local jurisdictions with different requirements.
 *
 * Sprinklered: 125' common path, 250' travel, 50' dead-end
 * Unsprinklered: 75' common path, 200' travel, 20' dead-end
 */
function updateEgressDefaults(): void {
  if (state.sprinklered) {
    dom.commonPathInput.value = '125';
    dom.travelDistanceInput.value = '250';
    dom.deadEndInput.value = '50';
    state.commonPath = 125;
    state.travelDistance = 250;
    state.deadEnd = 50;
  } else {
    dom.commonPathInput.value = '75';
    dom.travelDistanceInput.value = '200';
    dom.deadEndInput.value = '20';
    state.commonPath = 75;
    state.travelDistance = 200;
    state.deadEnd = 20;
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the EGRESS tab with event listeners.
 */
export function initEgressTab(): void {
  // Sprinkler toggle
  dom.sprinklerToggle.addEventListener('change', () => {
    state.sprinklered = dom.sprinklerToggle.checked;
    updateEgressDefaults();
    markInputChanged();
  });

  // Common path input
  dom.commonPathInput.addEventListener('input', () => {
    state.commonPath = parseFloat(dom.commonPathInput.value) || 125;
    markInputChanged();
  });

  // Travel distance input
  dom.travelDistanceInput.addEventListener('input', () => {
    state.travelDistance = parseFloat(dom.travelDistanceInput.value) || 250;
    markInputChanged();
  });

  // Dead-end input
  dom.deadEndInput.addEventListener('input', () => {
    state.deadEnd = parseFloat(dom.deadEndInput.value) || 50;
    markInputChanged();
  });
}
