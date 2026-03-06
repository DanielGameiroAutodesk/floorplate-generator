// @ts-nocheck
/**
 * Generation Manager
 *
 * Orchestrates the floorplate generation pipeline for the Floorplate Generator extension.
 * This module is the central coordinator between Forma's 3D environment and the
 * floorplate algorithm, handling the full lifecycle from building selection to mesh rendering.
 *
 * ## Primary Responsibilities
 * - **Selection**: Fetches building selection via Forma SDK (`Forma.selection.getSelection`)
 * - **Geometry extraction**: Converts triangle meshes to footprint polygons via `extractFootprintPolygon`
 * - **Algorithm dispatch**: Routes to single-wing or multi-wing pipelines based on topology analysis
 * - **Rendering**: Produces mesh data and submits to Forma via `Forma.render.addMesh`
 * - **Auto-generation**: Debounces input changes to regenerate on parameter updates
 *
 * ## State Lifecycle
 * 1. **Idle**: No selection, button shows "Select Building"
 * 2. **Selected**: Building chosen, `buildingTriangles` cached, ready to generate
 * 3. **Generated**: Options produced, first option rendered, auto-generate enabled
 * 4. **Post-bake**: `resetAfterBake()` clears cached data; user must re-select
 *
 * ## Forma SDK Integration
 * - Uses `Forma.selection.getSelection()` for building paths
 * - Uses `Forma.geometry.getTriangles()` for mesh extraction
 * - Uses `Forma.render.addMesh()` for result visualization
 * - No subscription to Forma events; generation is user-triggered or debounced from UI changes
 *
 * ## Side Effects
 * - Mutates DOM (button disabled state, innerHTML) during generation
 * - Invokes callbacks: `onGenerationCompleteCallback`, `updateButtonStateCallback`
 * - Adds geometry to Forma's scene via `Forma.render.addMesh`
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
 * Register a callback to update the generate button's visual state.
 *
 * @param callback - Function called when button state should change (e.g. 'select' | 'generate' | 'stop').
 */
export function setUpdateButtonState(callback: (state: ButtonState) => void): void {
  updateButtonStateCallback = callback;
}

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Get the Forma path(s) of the currently selected building.
 *
 * @returns Array of Forma object paths; empty if no building selected.
 */
export function getCurrentSelection(): string[] {
  return currentSelection;
}

/**
 * Get cached building triangle mesh from the last successful selection.
 *
 * @returns Float32Array of vertex data, or null if none cached (e.g. after bake or before first generate).
 */
export function getBuildingTriangles(): Float32Array | null {
  return buildingTriangles;
}

/**
 * Get the layout options produced by the last generation run.
 *
 * @returns Array of layout options (typically 3: balanced, mix, efficiency).
 */
export function getGeneratedOptions(): LayoutOption[] {
  return generatedOptions;
}

/**
 * Get the index of the currently selected layout option (0-based).
 *
 * @returns Index into `getGeneratedOptions()`.
 */
export function getSelectedOptionIndex(): number {
  return selectedOptionIndex;
}

/**
 * Get the floorplan data for the currently selected option.
 *
 * @returns Current floorplan, or null if no options exist.
 */
export function getCurrentFloorplan(): FloorPlanData | null {
  return currentFloorplan;
}

/**
 * Set the selected option index and update the current floorplan reference.
 *
 * @param index - 0-based index into the generated options array.
 */
export function setSelectedOptionIndex(index: number): void {
  selectedOptionIndex = index;
  if (generatedOptions[index]) {
    currentFloorplan = generatedOptions[index].floorplan;
  }
}

/**
 * Replace generated options with a new set (e.g. after loading a saved floorplate).
 *
 * @param options - New layout options.
 * @param floorplan - Floorplan for the first option (index 0).
 */
export function setGeneratedOptions(options: LayoutOption[], floorplan: FloorPlanData): void {
  generatedOptions = options;
  selectedOptionIndex = 0;
  currentFloorplan = floorplan;
}

/**
 * Reset generation state after baking. The original building is removed by Forma,
 * so cached triangles and selection are no longer valid.
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
 * Mark that a user input changed and trigger debounced regeneration if auto-generate is on.
 *
 * Called by mix-tab, dim-tab, and egress-tab when sliders, dropdowns, or inputs change.
 * No-op if auto-generate is off or no building is cached.
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
  dom.selectBtn.disabled = true;
  dom.selectBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Generating...';

  try {
    // We need to get the selection BEFORE checking currentSelection, 
    // as currentSelection might not be initialized if this is the very first click.
    const selection = await Forma.selection.getSelection();
    
    // Only update currentSelection if something was actually selected,
    // otherwise keep the cached selection. This handles the case where the
    // user deselects the building but we still want to auto-generate.
    if (selection && selection.length > 0) {
      currentSelection = selection;
    }

    // Fetch geometry if using a selection
    const isUsingSelection = currentSelection && currentSelection.length > 0;
    if (isUsingSelection) {
      // If not first run, reuse the cached `buildingTriangles` array from previous handleGenerate call
      // This assumes autoGenerate relies on the same building context.
      const isFirstRun = !state.autoGenerate;
      if (isFirstRun) {
        const triangles = await Forma.geometry.getTriangles({ path: currentSelection[0] });
        if (!triangles || triangles.length === 0) {
          throw new Error('Failed to retrieve building geometry. Triangles array is empty or undefined.');
        }
        buildingTriangles = triangles;
      }
    } else if (!buildingTriangles) {
      throw new Error('No valid building geometry selected.');
    }

    if (!currentSelection || currentSelection.length === 0) {
      // Keep button in "select" state since no building was selected
      dom.selectBtn.disabled = false;
      if (updateButtonStateCallback) {
        updateButtonStateCallback('select');
      }
      return;
    }

    if (!buildingTriangles) {
      throw new Error('buildingTriangles is null after fetch attempt');
    }
    // Extract actual polygon (preserves concave corners for L/U/H shapes)
    const { polygon, topology, floorZ, height } = extractFootprintPolygon(buildingTriangles!);

    // Extract legacy footprint for dimension display and bar-building fallback
    const footprint = polygonToLegacyFootprint(polygon, floorZ, height, topology);

    // On first run (user clicked Generate, not auto-regenerated), sync dimension inputs from geometry.
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
      alignment: state.alignment / 100,
      includeIntersectionCustomUnits: true
    };
    
    // Multi-wing gate: use topology analysis (not vertex-count heuristic).
    // A simplified bar can have 5+ vertices from Douglas-Peucker artifacts; wing count is authoritative.
    const wingAnalysis = analyzeFootprint(polygon, topology);
    const isMultiWing = !wingAnalysis.isSimpleBar && wingAnalysis.wings.length > 1;

    try {
      if (isMultiWing) {
      // DEEP CLONE geometry to prevent mutations across layout option generations
      const freshPoints = polygon.map(p => ({ x: p.x, y: p.y }));
      let freshTopology = undefined;
      if (topology) {
        freshTopology = {
          outer: topology.outer.map(p => ({ x: p.x, y: p.y })),
          holes: topology.holes.map(h => h.map(p => ({ x: p.x, y: p.y })))
        };
      }
      
      try {
        generatedOptions = generateMultiWingFloorplateVariants(
          freshPoints, unitConfig, egressConfig, generatorOptions, freshTopology
        );
      } catch (innerE: any) {
         throw innerE;
      }
    } else {
      // Existing pipeline — identical to original behavior
      try {
        generatedOptions = generateFloorplateVariants(footprint, unitConfig, egressConfig, generatorOptions);
      } catch (innerE: any) {
         throw innerE;
      }
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
      let meshData;
      try {
        meshData = renderFloorplate(selectedOption.floorplan);
      } catch (e: any) {
        // We will re-throw later to fail the generation cleanly but capture the stack
        throw e;
      }

      // Add to Forma
      await Forma.render.addMesh({
        geometryData: {
          position: meshData.positions,
          color: meshData.colors
        }
      });

      // Notify callback
      if (onGenerationCompleteCallback && currentFloorplan) {
        try {
          onGenerationCompleteCallback(generatedOptions, selectedOptionIndex, currentFloorplan);
        } catch (cbErr: any) {
           // Don't re-throw here, let the generation technically succeed but log the error
        }
      }

    } catch (pipelineError: any) {
      throw pipelineError; // Rethrow to let the main catch block handle it
    }

  } catch (error: any) {
    const msg = String(error?.message || error);
    const stck = String(error?.stack || '');
    console.error(`[CRITICAL CRASH] Generation failed entirely!`, msg, stck);
    const errorDetails = error instanceof Error ? stck || msg : String(error);
    Logger.error(`Generation failed: ${errorDetails}`);
    // On error, reset to appropriate state
    dom.selectBtn.disabled = false;
    dom.selectBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Generate Layout';
    if (updateButtonStateCallback) {
      if (buildingTriangles) {
        updateButtonStateCallback('generate');
      } else {
        updateButtonStateCallback('select');
      }
    }
  } finally {
    dom.selectBtn.disabled = false;
  }
}
