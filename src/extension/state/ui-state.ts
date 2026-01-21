/**
 * UI State Management
 *
 * Central state object and types for the Floorplate Generator extension.
 * Manages user inputs across MIX, DIM, and EGRESS tabs.
 */

import {
  UnitTypeAdvancedSettings,
  UnitTypeConfig as BaseUnitTypeConfig
} from '../../algorithm/types';

// Re-export for consumers that import from this file
export type { UnitTypeAdvancedSettings };

// ============================================================================
// Types
// ============================================================================

/**
 * Extended unit type config with UI-specific fields.
 * Extends the base algorithm type with required fields and display state.
 *
 * Note: The base type has optional fields for backwards compatibility,
 * but the UI requires all fields to be present.
 */
export interface UnitTypeConfig extends Omit<BaseUnitTypeConfig, 'advanced' | 'useSmartDefaults'> {
  /** Advanced settings for placement and sizing behavior */
  advanced: UnitTypeAdvancedSettings;
  /** If true, calculate advanced settings from area automatically */
  useSmartDefaults: boolean;
  /**
   * UI state: is the advanced settings panel expanded?
   * This is purely for display purposes, not used by the algorithm.
   */
  advancedExpanded: boolean;
}

/**
 * Complete UI state for the extension.
 * Represents all user-configurable parameters across all tabs.
 */
export interface UIState {
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

/**
 * Button states for the generate workflow.
 * - select: No building selected, button prompts user to select
 * - generate: Building selected, button triggers generation
 * - stop: Auto-generation active, button stops it
 */
export type ButtonState = 'select' | 'generate' | 'stop';

// ============================================================================
// Smart Defaults
// ============================================================================

/**
 * Calculate smart defaults for advanced settings based on unit area.
 *
 * WHY: Different unit sizes have different placement characteristics.
 * Small units (studios) should be rigid and never at corners - they're
 * commodity units that fill space. Large units (2BR+) are premium and
 * benefit from corner positions with extra light/views.
 *
 * The interpolation creates a smooth gradient:
 * - <590sf (studios): Rigid, no corners, low priority
 * - 590-1180sf (1BR): Intermediate flexibility
 * - >1180sf (2BR+): Flexible, corner-eligible, high priority
 *
 * @param areaSqFt - Unit area in square feet
 * @returns Advanced settings appropriate for the unit size
 */
export function calculateSmartDefaultsFromArea(areaSqFt: number): UnitTypeAdvancedSettings {
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
 * Create a unit type config with smart defaults calculated from area.
 *
 * @param id - Unique identifier for the unit type
 * @param name - Display name (e.g., "Studios", "2-Bedroom")
 * @param color - Hex color for rendering
 * @param percentage - Target percentage in unit mix (0-100)
 * @param area - Target area in square feet
 * @returns Complete unit type configuration
 */
export function createUnitTypeWithDefaults(
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

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default unit types using Forma Data Labels color palette.
 * Represents a typical multifamily unit mix.
 */
export const DEFAULT_UNIT_TYPES: UnitTypeConfig[] = [
  createUnitTypeWithDefaults('studio', 'Studios', '#A0D4DC', 20, 590),       // data-blue
  createUnitTypeWithDefaults('onebed', '1-Bedroom', '#D0E1A4', 40, 885),     // data-green
  createUnitTypeWithDefaults('twobed', '2-Bedroom', '#F5C297', 30, 1180),    // data-orange
  createUnitTypeWithDefaults('threebed', '3-Bedroom', '#D9DDFC', 10, 1475)   // data-purple
];

/**
 * Initial UI state with sensible defaults for a typical bar building.
 */
export const INITIAL_STATE: UIState = {
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
// State Instance
// ============================================================================

/**
 * Global UI state object.
 *
 * WHY: We use a mutable global state rather than a more sophisticated
 * state management pattern (Redux, signals, etc.) for simplicity.
 * This is a reference implementation for vibecoders - keeping patterns
 * simple makes the code easier to understand and modify.
 *
 * Trade-off: Harder to test, no undo/redo, mutations scattered throughout.
 * For a production app, consider using a proper state management library.
 */
export const state: UIState = { ...INITIAL_STATE };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for a new unit type.
 */
export function generateUnitId(): string {
  return 'unit_' + Math.random().toString(36).substring(2, 9);
}
