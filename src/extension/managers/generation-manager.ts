/**
 * Generation Manager
 *
 * Orchestrates the floorplate generation process:
 * - Getting building selection from Forma
 * - Extracting footprint geometry
 * - Running the generation algorithm
 * - Rendering results to Forma
 * - Managing auto-generation with debouncing
 */

import { Forma } from 'forma-embedded-view-sdk/auto';
import {
  generateFloorplateVariants,
  renderFloorplate,
  extractFootprintPolygon,
  polygonToLegacyFootprint,
  generateMultiWingFloorplateVariants,
  analyzeFootprint
} from '../../algorithm';
import { LayoutOption, FloorPlanData } from '../../algorithm/types';
import { FEET_TO_METERS } from '../../algorithm/constants';
import { state, ButtonState } from '../state/ui-state';
import { getUnitConfiguration, getUnitColors, getEgressConfig } from '../state/unit-config';
import { updateDimensionsFromBuilding } from '../tabs/dim-tab';
import * as dom from '../utils/dom-refs';
import { Logger } from '../../algorithm/utils/logger';

// ============================================================================
// Module State
// ============================================================================

let currentSelection: string[] = [];
let buildingTriangles: Float32Array | null = null;
let generatedOptions: LayoutOption[] = [];
let selectedOptionIndex = 0;
let currentFloorplan: FloorPlanData | null = null;

// Debounce state
let generateTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * WHY 300ms debounce?
 * - Fast enough to feel responsive (user sees changes quickly)
 * - Slow enough to catch "I'm still dragging this slider" scenarios
 * - Prevents algorithm from running on every intermediate value
 * - Avoids 3D view flickering from rapid re-renders
 */
const DEBOUNCE_DELAY = 300;

// Callbacks
let onGenerationCompleteCallback: ((options: LayoutOption[], selectedIndex: number, floorplan: FloorPlanData) => void) | null = null;
let updateButtonStateCallback: ((state: ButtonState) => void) | null = null;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Set callback for when generation completes.
 */
export function setOnGenerationComplete(callback: (options: LayoutOption[], selectedIndex: number, floorplan: FloorPlanData) => void): void {
  onGenerationCompleteCallback = callback;
}

/**
 * Set callback for updating button state.
 */
export function setUpdateButtonState(callback: (state: ButtonState) => void): void {
  updateButtonStateCallback = callback;
}

// ============================================================================
// State Accessors
// ============================================================================

export function getCurrentSelection(): string[] {
  return currentSelection;
}

export function getBuildingTriangles(): Float32Array | null {
  return buildingTriangles;
}

export function getGeneratedOptions(): LayoutOption[] {
  return generatedOptions;
}

export function getSelectedOptionIndex(): number {
  return selectedOptionIndex;
}

export function getCurrentFloorplan(): FloorPlanData | null {
  return currentFloorplan;
}

export function setSelectedOptionIndex(index: number): void {
  selectedOptionIndex = index;
  if (generatedOptions[index]) {
    currentFloorplan = generatedOptions[index].floorplan;
  }
}

export function setGeneratedOptions(options: LayoutOption[], floorplan: FloorPlanData): void {
  generatedOptions = options;
  selectedOptionIndex = 0;
  currentFloorplan = floorplan;
}

/**
 * Reset state after baking (original building is removed).
 */
export function resetAfterBake(): void {
  buildingTriangles = null;
  currentSelection = [];
  generatedOptions = [];
  selectedOptionIndex = 0;
  currentFloorplan = null;
}

// ============================================================================
// Auto-Generation
// ============================================================================

/**
 * Debounce generation to prevent rapid re-runs during slider drags.
 *
 * WHY debounce instead of throttle?
 * - Debounce waits until input stops, then runs once
 * - Throttle runs at intervals, which would show intermediate (wrong) results
 * - Users expect to see the FINAL value, not intermediate states
 */
export function debounceGenerate(): void {
  if (generateTimeout) {
    clearTimeout(generateTimeout);
  }

  if (state.autoGenerate && buildingTriangles) {
    generateTimeout = setTimeout(() => {
      handleGenerate();
    }, DEBOUNCE_DELAY);
  }
}

/**
 * Mark that an input changed and trigger debounced regeneration.
 * Called by tab modules when inputs change.
 */
export function markInputChanged(): void {
  if (state.autoGenerate && buildingTriangles) {
    debounceGenerate();
  }
}

/**
 * Stop auto-generation mode.
 */
export function handleStopAutoGeneration(): void {
  // Clear any pending debounce timeouts
  if (generateTimeout) {
    clearTimeout(generateTimeout);
    generateTimeout = null;
  }

  // Disable auto-generation
  state.autoGenerate = false;

  // Clear cached building data so next Generate fetches fresh selection
  buildingTriangles = null;
  currentSelection = [];

  // Return to "Select Building" so user knows to pick a (new) building
  if (updateButtonStateCallback) {
    updateButtonStateCallback('select');
  }
}

// ============================================================================
// Main Generation
// ============================================================================

/**
 * Handle the generate button click / auto-generation trigger.
 *
 * This is the main orchestration function that:
 * 1. Gets building selection from Forma
 * 2. Extracts footprint geometry
 * 3. Runs the generation algorithm (3 strategies)
 * 4. Renders results to Forma
 * 5. Updates UI state
 */
export async function handleGenerate(): Promise<void> {
  dom.generateBtn.disabled = true;
  dom.generateBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Generating...';

  try {
    const selection = await Forma.selection.getSelection();

    if (!selection || selection.length === 0) {
      // Keep button in "select" state since no building was selected
      dom.generateBtn.disabled = false;
      if (updateButtonStateCallback) {
        updateButtonStateCallback('select');
      }
      return;
    }

    currentSelection = selection;

    // Get building geometry
    const triangles = await Forma.geometry.getTriangles({ path: currentSelection[0] });

    if (!triangles || triangles.length === 0) {
      return;
    }

    buildingTriangles = triangles;

    // Extract actual polygon (preserves concave corners for L/U/H shapes)
    const { polygon, floorZ, height } = extractFootprintPolygon(buildingTriangles);

    // Extract legacy footprint for dimension display and bar-building fallback
    const footprint = polygonToLegacyFootprint(polygon, floorZ, height);

    // On first selection, populate dimension inputs with geometry values.
    const isFirstRunForThisBuilding = !state.autoGenerate;
    if (isFirstRunForThisBuilding) {
      updateDimensionsFromBuilding(footprint.width, footprint.depth, footprint.height);
    }

    // Override footprint dimensions with user-adjusted UI state values
    footprint.width = state.length * FEET_TO_METERS;
    footprint.depth = state.buildingDepth * FEET_TO_METERS;

    // Get configurations from UI
    const unitConfig = getUnitConfiguration();
    const egressConfig = getEgressConfig();
    const unitColors = getUnitColors();
    const corridorWidth = state.corridorWidth * FEET_TO_METERS;
    const coreWidth = state.coreWidth * FEET_TO_METERS;
    const coreDepth = state.coreDepth * FEET_TO_METERS;

    const generatorOptions = {
      corridorWidth,
      coreWidth,
      coreDepth,
      coreSide: state.corePlacement,
      customColors: unitColors,
      alignment: state.alignment / 100
    };

    // Multi-wing gate: use topology check (not vertex count heuristic)
    // A simplified rectangle could have 5+ vertices from Douglas-Peucker artifacts
    const wingAnalysis = analyzeFootprint(polygon);
    const isMultiWing = !wingAnalysis.isSimpleBar && wingAnalysis.wings.length > 1;

    if (isMultiWing) {
      generatedOptions = generateMultiWingFloorplateVariants(
        polygon, unitConfig, egressConfig, generatorOptions
      );
    } else {
      // Existing pipeline — identical to original behavior
      generatedOptions = generateFloorplateVariants(footprint, unitConfig, egressConfig, generatorOptions);
    }

    // Select the first option (Balanced) by default
    selectedOptionIndex = 0;
    const selectedOption = generatedOptions[selectedOptionIndex];
    if (!selectedOption) {
      throw new Error('Failed to generate options');
    }

    currentFloorplan = selectedOption.floorplan;

    // Enable auto-generation and update button state
    state.autoGenerate = true;
    if (updateButtonStateCallback) {
      updateButtonStateCallback('stop');
    }

    // Render to mesh
    const meshData = renderFloorplate(selectedOption.floorplan);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/18ccda83-81b1-41c7-9078-5d60d07d2981',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42d54e'},body:JSON.stringify({sessionId:'42d54e',runId:'corridor-missing-pink-pre',hypothesisId:'H3',location:'generation-manager.ts:handleGenerate:renderedMesh',message:'Mesh produced before Forma render',data:{positions:meshData.positions.length,colors:meshData.colors.length,corridorSegments:selectedOption.floorplan.corridorSegments?.length??0,corridorHasPoly:!!(selectedOption.floorplan.corridor.polyPoints&&selectedOption.floorplan.corridor.polyPoints.length>=3)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // Add to Forma
    await Forma.render.addMesh({
      geometryData: {
        position: meshData.positions,
        color: meshData.colors
      }
    });

    // Notify callback
    if (onGenerationCompleteCallback && currentFloorplan) {
      onGenerationCompleteCallback(generatedOptions, selectedOptionIndex, currentFloorplan);
    }

  } catch (error) {
    Logger.error(`Generation failed: ${error}`);
    // On error, reset to appropriate state
    dom.generateBtn.disabled = false;
    if (updateButtonStateCallback) {
      if (buildingTriangles) {
        updateButtonStateCallback('generate');
      } else {
        updateButtonStateCallback('select');
      }
    }
  } finally {
    dom.generateBtn.disabled = false;
  }
}
