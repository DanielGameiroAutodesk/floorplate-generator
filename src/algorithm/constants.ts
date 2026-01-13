/**
 * Floorplate Generator - Constants
 * Default values and configuration
 *
 * ALL VALUES ARE IN METERS to match Forma's coordinate system
 */

import {
  UnitType,
  UnitConfiguration,
  EgressConfig,
  AlignmentConfig,
  OptimizationParams,
  PlacementZone,
  SmartDefaultsConfig,
  DynamicUnitType
} from './types';

// Conversion factor
export const FEET_TO_METERS = 0.3048;
export const SQ_FEET_TO_SQ_METERS = FEET_TO_METERS * FEET_TO_METERS; // ~0.0929

// ============================================================================
// DYNAMIC UNIT TYPE DEFAULTS
// Smart defaults for interpolating unit properties from area
// ============================================================================

/**
 * Default configuration for smart defaults interpolation
 * Small units (<590 sf) get rigid, no-corner defaults
 * Large units (>1180 sf) get flexible, corner-eligible defaults
 */
export const DEFAULT_SMART_DEFAULTS: SmartDefaultsConfig = {
  smallUnitMaxArea: 590 * SQ_FEET_TO_SQ_METERS,   // ~55 sq m
  largeUnitMinArea: 1180 * SQ_FEET_TO_SQ_METERS,  // ~110 sq m
  sizeToleranceRange: [0.0, 0.25],                // 0% to 25%
  expansionWeightRange: [1, 40],
  compressionWeightRange: [0.5, 10],
  placementPriorityRange: [10, 100]
};

/**
 * Default unit type templates matching current hardcoded behavior
 * These provide smart defaults for first-time users
 */
export const DEFAULT_UNIT_TYPES: DynamicUnitType[] = [
  {
    id: 'studio',
    name: 'Studios',
    color: '#3b82f6',
    area: 590 * SQ_FEET_TO_SQ_METERS,
    percentage: 20,
    sizeTolerance: 0.0,
    lShapeEligible: false,
    cornerEligible: false,
    placementPriority: 10,
    minWidth: 12 * FEET_TO_METERS,
    maxWidth: 25 * FEET_TO_METERS,
    expansionWeight: 1,
    compressionWeight: 0.5
  },
  {
    id: 'onebed',
    name: '1-Bedroom',
    color: '#22c55e',
    area: 885 * SQ_FEET_TO_SQ_METERS,
    percentage: 40,
    sizeTolerance: 0.05,
    lShapeEligible: false,
    cornerEligible: false,
    placementPriority: 40,
    minWidth: 12 * FEET_TO_METERS,
    maxWidth: 30 * FEET_TO_METERS,
    expansionWeight: 5,
    compressionWeight: 2
  },
  {
    id: 'twobed',
    name: '2-Bedroom',
    color: '#f97316',
    area: 1180 * SQ_FEET_TO_SQ_METERS,
    percentage: 30,
    sizeTolerance: 0.15,
    lShapeEligible: true,
    cornerEligible: true,
    placementPriority: 70,
    minWidth: 12 * FEET_TO_METERS,
    maxWidth: 40 * FEET_TO_METERS,
    expansionWeight: 15,
    compressionWeight: 5
  },
  {
    id: 'threebed',
    name: '3-Bedroom',
    color: '#a855f7',
    area: 1475 * SQ_FEET_TO_SQ_METERS,
    percentage: 10,
    sizeTolerance: 0.25,
    lShapeEligible: true,
    cornerEligible: true,
    placementPriority: 100,
    minWidth: 12 * FEET_TO_METERS,
    maxWidth: 50 * FEET_TO_METERS,
    expansionWeight: 40,
    compressionWeight: 10
  }
];

/**
 * Calculate smart defaults for a unit type based on its area
 * Interpolates between small-unit and large-unit defaults
 */
export function calculateSmartDefaults(
  areaSqMeters: number,
  config: SmartDefaultsConfig = DEFAULT_SMART_DEFAULTS
): Partial<DynamicUnitType> {
  const { smallUnitMaxArea, largeUnitMinArea } = config;

  // Interpolation factor: 0 = small, 1 = large
  const t = Math.max(0, Math.min(1,
    (areaSqMeters - smallUnitMaxArea) / (largeUnitMinArea - smallUnitMaxArea)
  ));

  const lerp = (range: [number, number]) => range[0] + t * (range[1] - range[0]);

  return {
    sizeTolerance: lerp(config.sizeToleranceRange),
    expansionWeight: Math.round(lerp(config.expansionWeightRange)),
    compressionWeight: parseFloat(lerp(config.compressionWeightRange).toFixed(2)),
    placementPriority: Math.round(lerp(config.placementPriorityRange)),
    lShapeEligible: t >= 0.5,     // Large units can be L-shaped
    cornerEligible: t > 0.5,      // Only 2BR+ (>1003sf) can go at corners by default
    minWidth: 12 * FEET_TO_METERS,
    maxWidth: (areaSqMeters / (12 * FEET_TO_METERS)) * 1.5  // Based on reasonable depth
  };
}

// ============================================================================
// LEGACY CONSTANTS (kept for backwards compatibility)
// ============================================================================

// Unit colors (RGBA - values 0-255)
export const UNIT_COLORS: Record<UnitType | 'Core' | 'Corridor', { r: number; g: number; b: number; a: number }> = {
  [UnitType.Studio]: { r: 59, g: 130, b: 246, a: 200 },   // Blue (#3b82f6)
  [UnitType.OneBed]: { r: 34, g: 197, b: 94, a: 200 },    // Green (#22c55e)
  [UnitType.TwoBed]: { r: 249, g: 115, b: 22, a: 200 },   // Orange (#f97316)
  [UnitType.ThreeBed]: { r: 168, g: 85, b: 247, a: 200 }, // Purple (#a855f7)
  Core: { r: 55, g: 65, b: 81, a: 230 },                  // Dark Gray
  Corridor: { r: 147, g: 51, b: 234, a: 200 }             // Purple (visible)
};

// Default dimensions (in METERS)
export const MIN_UNIT_WIDTH = 12 * FEET_TO_METERS;           // ~3.66m minimum unit width
export const CORNER_BAY_LENGTH = 40 * FEET_TO_METERS;        // ~12.2m preferred corner unit length
export const DEFAULT_CORRIDOR_WIDTH = 6 * FEET_TO_METERS;    // ~1.83m standard corridor width
export const DEFAULT_CORE_WIDTH = 12 * FEET_TO_METERS;       // ~3.66m core width
export const DEFAULT_CORE_DEPTH = 29.5 * FEET_TO_METERS;     // ~9m core depth
export const DEFAULT_FLOOR_HEIGHT = 10 * FEET_TO_METERS;     // ~3m floor-to-floor height

// Core placement constants
export const CORE_SETBACK = 45 * FEET_TO_METERS;             // ~13.7m setback from building ends (large corner unit + buffer)
export const MID_CORE_THRESHOLD = 250 * FEET_TO_METERS;      // ~76.2m - add mid core if building exceeds this

// Default unit configuration (areas in SQUARE METERS)
export const DEFAULT_UNIT_CONFIG: UnitConfiguration = {
  [UnitType.Studio]: { percentage: 20, area: 590 * SQ_FEET_TO_SQ_METERS },   // ~55 sq m
  [UnitType.OneBed]: { percentage: 40, area: 885 * SQ_FEET_TO_SQ_METERS },   // ~82 sq m
  [UnitType.TwoBed]: { percentage: 30, area: 1180 * SQ_FEET_TO_SQ_METERS },  // ~110 sq m
  [UnitType.ThreeBed]: { percentage: 10, area: 1475 * SQ_FEET_TO_SQ_METERS } // ~137 sq m
};

// Egress configurations (IBC compliant - converted to METERS)
export const EGRESS_SPRINKLERED: EgressConfig = {
  sprinklered: true,
  deadEndLimit: 50 * FEET_TO_METERS,           // ~15.24m max dead-end corridor
  travelDistanceLimit: 250 * FEET_TO_METERS,   // ~76.2m max travel distance
  commonPathLimit: 125 * FEET_TO_METERS        // ~38.1m max common path
};

export const EGRESS_UNSPRINKLERED: EgressConfig = {
  sprinklered: false,
  deadEndLimit: 20 * FEET_TO_METERS,           // ~6.1m max dead-end corridor
  travelDistanceLimit: 200 * FEET_TO_METERS,   // ~61m max travel distance
  commonPathLimit: 75 * FEET_TO_METERS         // ~22.9m max common path
};

// Flexibility model - how much each unit type can stretch/shrink
// Per feature spec Section 8.5: Studio ±0%, 1BR ±2%, 2BR ±5%, 3BR ±10%
export const FLEXIBILITY_FACTORS: Record<UnitType, number> = {
  [UnitType.Studio]: 0.0,    // Rigid - Studios can't stretch/shrink
  [UnitType.OneBed]: 0.02,   // ±2%
  [UnitType.TwoBed]: 0.05,   // ±5%
  [UnitType.ThreeBed]: 0.10  // ±10%
};

// Weights for expansion (filling gaps)
export const EXPANSION_WEIGHTS: Record<UnitType, number> = {
  [UnitType.Studio]: 1,
  [UnitType.OneBed]: 5,
  [UnitType.TwoBed]: 15,
  [UnitType.ThreeBed]: 40
};

// Weights for compression (squeezing into tight spaces)
// More balanced than before to prevent wild size variance
export const COMPRESSION_WEIGHTS: Record<UnitType, number> = {
  [UnitType.Studio]: 0.5,   // Still rigid but not extreme (was 0.0001)
  [UnitType.OneBed]: 2,
  [UnitType.TwoBed]: 5,
  [UnitType.ThreeBed]: 10   // Reduced from 20 to limit size variance
};

// Maximum adjustment percentage allowed per unit (prevents wild size swings)
export const MAX_WIDTH_ADJUSTMENT = 0.15; // ±15% max adjustment

// ============================================================================
// OPTIMIZATION STRATEGIES
// Per feature spec Section 8.8:
// - Option 1: Balanced - Equal priority to mix accuracy, size accuracy, and efficiency
// - Option 2: Mix Optimized - Prioritizes hitting exact unit mix percentages
// - Option 3: Efficiency Optimized - Prioritizes building efficiency (NRSF/GSF)
// ============================================================================

export type OptimizationStrategy = 'balanced' | 'mixOptimized' | 'efficiencyOptimized';

export interface StrategyConfig {
  expansionWeights: Record<UnitType, number>;
  compressionWeights: Record<UnitType, number>;
  flexibilityFactors: Record<UnitType, number>;
  // Priority for unit placement (affects which units go at ends vs middle)
  placementPriority: UnitType[];
}

export const STRATEGY_CONFIGS: Record<OptimizationStrategy, StrategyConfig> = {
  // Balanced: Equal priority to mix accuracy, size accuracy, and efficiency
  balanced: {
    expansionWeights: {
      [UnitType.Studio]: 1,
      [UnitType.OneBed]: 3,
      [UnitType.TwoBed]: 8,
      [UnitType.ThreeBed]: 15
    },
    compressionWeights: {
      [UnitType.Studio]: 0.5,
      [UnitType.OneBed]: 2,
      [UnitType.TwoBed]: 5,
      [UnitType.ThreeBed]: 10
    },
    // Use spec flexibility: Studio 0%, 1BR 2%, 2BR 5%, 3BR 10%
    flexibilityFactors: {
      [UnitType.Studio]: 0.0,
      [UnitType.OneBed]: 0.02,
      [UnitType.TwoBed]: 0.05,
      [UnitType.ThreeBed]: 0.10
    },
    // Default placement: 3BR at ends, then 2BR, 1BR, Studios last
    placementPriority: [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio]
  },

  // Mix Optimized: Prioritizes hitting exact unit mix percentages
  mixOptimized: {
    expansionWeights: {
      [UnitType.Studio]: 5,
      [UnitType.OneBed]: 5,
      [UnitType.TwoBed]: 5,
      [UnitType.ThreeBed]: 5
    },
    compressionWeights: {
      [UnitType.Studio]: 1,
      [UnitType.OneBed]: 1,
      [UnitType.TwoBed]: 1,
      [UnitType.ThreeBed]: 1
    },
    // Tighter flexibility to maintain exact sizes per mix
    flexibilityFactors: {
      [UnitType.Studio]: 0.0,
      [UnitType.OneBed]: 0.02,
      [UnitType.TwoBed]: 0.03,
      [UnitType.ThreeBed]: 0.05
    },
    // Same placement priority
    placementPriority: [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio]
  },

  // Efficiency Optimized: Prioritizes building efficiency (NRSF/GSF)
  efficiencyOptimized: {
    expansionWeights: {
      [UnitType.Studio]: 8,
      [UnitType.OneBed]: 8,
      [UnitType.TwoBed]: 5,
      [UnitType.ThreeBed]: 2
    },
    compressionWeights: {
      [UnitType.Studio]: 2,
      [UnitType.OneBed]: 3,
      [UnitType.TwoBed]: 3,
      [UnitType.ThreeBed]: 1
    },
    // More flexibility to pack units efficiently
    flexibilityFactors: {
      [UnitType.Studio]: 0.05,
      [UnitType.OneBed]: 0.08,
      [UnitType.TwoBed]: 0.10,
      [UnitType.ThreeBed]: 0.12
    },
    // Still place 3BR at ends for L-shapes, but allow more flexibility
    placementPriority: [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio]
  }
};

// Strategy labels and descriptions
export const STRATEGY_LABELS: Record<OptimizationStrategy, string> = {
  balanced: 'Balanced',
  mixOptimized: 'Mix Optimized',
  efficiencyOptimized: 'Efficiency'
};

export const STRATEGY_DESCRIPTIONS: Record<OptimizationStrategy, string> = {
  balanced: 'Equal priority to mix accuracy, size accuracy, and efficiency',
  mixOptimized: 'Prioritizes hitting exact unit mix percentages',
  efficiencyOptimized: 'Prioritizes building efficiency (NRSF/GSF)'
};

// ============================================================================
// OPTIMIZATION PARAMETERS
// Per feature spec - geometry search for optimal corner length and core positions
// ============================================================================

export const DEFAULT_OPTIMIZATION_PARAMS: OptimizationParams = {
  minCornerLength: 20 * FEET_TO_METERS,      // ~6.1m minimum corner length
  maxCornerLength: 90 * FEET_TO_METERS,      // ~27.4m maximum corner length
  cornerStep: 2 * FEET_TO_METERS,            // ~0.61m step size for search
  maxMidCoreOffset: 30 * FEET_TO_METERS,     // ~9.1m maximum mid-core offset deviation
  offsetStep: 4 * FEET_TO_METERS,            // ~1.2m step size for offset search
  compressionPenaltyMultiplier: 5,           // Compression is 5x worse than expansion
  safetyFactor: 0.99                         // Use 99% of available length to avoid tight fits
};

// Penalty weights for optimization scoring
export const OPTIMIZATION_WEIGHTS = {
  compression: 500,   // Heavy penalty for compression (squeezing units)
  expansion: 100,     // Lighter penalty for expansion (stretching units)
  mixError: 200,      // Penalty for deviation from target mix
  alignment: 50       // Penalty for poor wall alignment potential
};

// ============================================================================
// WALL ALIGNMENT CONFIGURATION
// Per feature spec Section 10 - demising wall alignment across corridor
// ============================================================================

export const DEFAULT_ALIGNMENT_CONFIG: AlignmentConfig = {
  strength: 0.5,                             // 50% alignment strength (slider default)
  maxPullDistance: 8 * FEET_TO_METERS,       // ~2.4m maximum wall pull distance
  enabled: true                              // Enable alignment by default
};

// Maximum wall pull distance range based on alignment strength
export const ALIGNMENT_BASE_PULL = 4 * FEET_TO_METERS;   // ~1.2m at 0% strength
export const ALIGNMENT_MAX_PULL = 8 * FEET_TO_METERS;    // ~2.4m at 100% strength

// ============================================================================
// PLACEMENT ZONE ELIGIBILITY
// Per feature spec Section 8.5 - which unit types can go in which zones
// ============================================================================

export const ZONE_ELIGIBLE_UNITS: Record<PlacementZone, UnitType[]> = {
  [PlacementZone.CORRIDOR_END]: [UnitType.ThreeBed, UnitType.TwoBed],
  [PlacementZone.OUTER_CORNER]: [UnitType.ThreeBed, UnitType.TwoBed],
  [PlacementZone.CORE_ADJACENT]: [UnitType.TwoBed, UnitType.OneBed, UnitType.ThreeBed],
  [PlacementZone.INNER_CORNER]: [], // Only cores/utilities
  [PlacementZone.STANDARD]: [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed]
};

// Priority order for unit placement (largest first for premium positions)
export const PLACEMENT_PRIORITY: UnitType[] = [
  UnitType.ThreeBed,
  UnitType.TwoBed,
  UnitType.OneBed,
  UnitType.Studio
];

// L-shape eligibility - which unit types can become L-shaped
// Per feature spec: Studios NEVER, 1BR only exceptional, 2BR and 3BR yes
export const L_SHAPE_ELIGIBLE: Record<UnitType, boolean> = {
  [UnitType.Studio]: false,
  [UnitType.OneBed]: false,  // Only in exceptional situations (handled specially)
  [UnitType.TwoBed]: true,
  [UnitType.ThreeBed]: true
};

// ============================================================================
// WING DETECTION PARAMETERS
// Per feature spec Appendix C - multi-wing building detection
// ============================================================================

export const WING_DETECTION = {
  angleToleranceDegrees: 5,           // ±5° tolerance for grouping edges by direction
  minWingLength: 30 * FEET_TO_METERS, // ~9.1m minimum wing length to be considered a wing
  maxInnerZoneDepth: 30 * FEET_TO_METERS, // ~9.1m maximum inner corner zone depth
  straightAngleTolerance: 10          // ±10° to consider an angle "straight" (≈180°)
};

// ============================================================================
// ENHANCED EGRESS PARAMETERS
// For egress-driven core placement optimization
// ============================================================================

export const EGRESS_OPTIMIZATION = {
  minCores: 2,                                    // Minimum 2 cores per IBC
  exitSeparationSprinklered: 1/3,                 // ≥1/3 of floor diagonal
  exitSeparationUnsprinklered: 1/2,               // ≥1/2 of floor diagonal
  bufferMargin: 5 * FEET_TO_METERS,               // ~1.5m buffer from egress limits
  // Single exit exception: max 4 stories, max 4 units/floor, sprinklered
  singleExitMaxStories: 4,
  singleExitMaxUnitsPerFloor: 4
};

// ============================================================================
// ROUNDING ERROR DISTRIBUTION
// ============================================================================

export const ROUNDING_ERROR = {
  // If total rounding error exceeds this, distribute across multiple units
  distributionThreshold: 1 * FEET_TO_METERS,  // ~0.3m
  // Maximum error a single unit can absorb (as fraction of width)
  maxSingleUnitAbsorption: 0.05  // 5% of unit width
};

// ============================================================================
// CORRIDOR VOID / L-SHAPE PARAMETERS
// ============================================================================

export const CORRIDOR_VOID = {
  // Standard extension past last demising wall
  endOverlap: 6 * FEET_TO_METERS,           // ~1.83m (from feature spec)
  // Minimum void to create an L-shape (below this, don't bother)
  minVoidForLShape: 2 * FEET_TO_METERS,     // ~0.61m
  // Maximum void a unit can absorb
  maxVoidAbsorption: 15 * FEET_TO_METERS    // ~4.6m
};
