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
  extractFootprintFromTriangles,
  renderFloorplate
} from '../../algorithm';
import { LayoutOption, FloorPlanData } from '../../algorithm/types';
import { FEET_TO_METERS } from '../../algorithm/constants';
import { state, ButtonState } from '../state/ui-state';
import { getUnitConfiguration, getUnitColors, getEgressConfig } from '../state/unit-config';
import { updateDimensionsFromBuilding } from '../tabs/dim-tab';
import * as dom from '../utils/dom-refs';

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

  // Update button to "Generate" state
  if (updateButtonStateCallback) {
    updateButtonStateCallback('generate');
  }
}

// ============================================================================
// Debug Output
// ============================================================================

/**
 * Display debug information in the debug panel.
 */
export function showDebug(data: unknown): void {
  dom.debugOutput.textContent = typeof data === 'string'
    ? data
    : JSON.stringify(data, null, 2);
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
    // Get current selection
    const selection = await Forma.selection.getSelection();

    if (!selection || selection.length === 0) {
      showDebug({
        status: 'Error',
        message: 'Please select a building in Forma first'
      });
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
      {
        corridorWidth,
        coreWidth,
        coreDepth,
        coreSide: state.corePlacement,
        customColors: unitColors,
        alignment: state.alignment / 100  // Convert 0-100 to 0.0-1.0
      }
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

    // Enable auto-generation and update button state
    state.autoGenerate = true;
    if (updateButtonStateCallback) {
      updateButtonStateCallback('stop');
    }

    // Render to mesh
    const meshData = renderFloorplate(selectedOption.floorplan);

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
