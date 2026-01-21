/**
 * Flexibility Model Module
 *
 * Controls how units can expand/contract and which units can be placed
 * at corners or in L-shapes. The core philosophy:
 *
 * TARGET SIZE = ABSOLUTE MINIMUM: Units can only expand, never shrink.
 * Larger units absorb more expansion to fill space.
 *
 * WHY EXPANSION ONLY, NEVER SHRINKING?
 * Units have market-driven minimum sizes. A studio below 500sf or 1BR below
 * 750sf becomes difficult to lease and may violate local housing codes. The
 * target area is the FLOOR, not a midpoint. Buyers and renters comparison-shop
 * by square footage - undersized units are immediately disqualified.
 *
 * WHY THESE SPECIFIC WEIGHTS (0.1, 3, 15, 50)?
 * Weights represent proportional capacity to absorb leftover corridor space:
 * - Studios (0.1): Market expects consistent sizes; a "large studio" creates
 *   pricing confusion and comp problems. Only absorb ~2% of available gap.
 * - 1BR (3): Moderate flexibility; 800-950sf is an acceptable range.
 * - 2BR (15): Good flexibility; 1100-1400sf has wide market appeal.
 * - 3BR (50): Maximum flexibility; premium units benefit from extra space
 *   and buyers expect size variation in the luxury segment.
 *
 * The 1:30:150:500 ratio ensures gap distribution matches unit value - premium
 * units absorb premium space, commodity units stay standardized.
 */

import { UnitType, UnitConfiguration, OptimizationStrategy } from './types';
import {
  UNIT_SIZING,
  STRATEGY_SAFETY_FACTORS,
  SQ_FEET_TO_SQ_METERS
} from './constants';
import { Logger } from './utils/logger';

// ============================================================================
// Unit Size Helpers
// ============================================================================

/**
 * Calculate unit width from area and rentable depth.
 */
export const getUnitWidth = (
  type: UnitType,
  config: UnitConfiguration,
  rentableDepth: number
): number => {
  return config[type].area / rentableDepth;
};

/**
 * Find the smallest unit type that's active in the current mix.
 * Used for conservative caps and feasibility checks.
 */
export const getSmallestActiveUnitType = (config: UnitConfiguration): UnitType => {
  const allTypes = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed];
  const active = allTypes.filter(t => config[t].percentage > 0);
  if (active.length === 0) return UnitType.Studio;
  return active.sort((a, b) => config[a].area - config[b].area)[0];
};

// ============================================================================
// Flexibility Model
// ============================================================================

/**
 * Flexibility Factor: Max percentage SHRINKAGE allowed.
 * TARGET SIZE IS THE MINIMUM - all types return 0 (no shrinking allowed).
 */
export const getFlexibilityFactor = (_type: UnitType): number => {
  // All unit types are rigid on the minimum side - they cannot shrink below target
  return 0.0;
};

/**
 * Flexibility Weight: Relative capacity to absorb EXPANSION (filling gaps).
 * Larger units absorb more expansion - this is the only direction units can flex.
 * Studios are VERY RIGID - they should barely expand at all.
 */
export const getFlexibilityWeight = (type: UnitType): number => {
  switch (type) {
    case UnitType.Studio: return 0.1;   // Almost no expansion - Studios stay at target size
    case UnitType.OneBed: return 3;     // Minimal expansion
    case UnitType.TwoBed: return 15;    // Moderate expansion
    case UnitType.ThreeBed: return 50;  // Most expansion - absorbs most gaps
    default: return 10;
  }
};

/**
 * Maximum Width: Prevents units from growing beyond reasonable bounds.
 * - Studios: VERY RIGID - max 15% expansion (they should stay close to target size)
 * - Other types: Can expand up to next larger type's target, but NEVER exceed it
 * DYNAMIC: Works with any unit configuration, finding the largest type automatically.
 */
export const getMaxUnitWidth = (
  type: UnitType,
  config: UnitConfiguration,
  rentableDepth: number
): number => {
  const targetWidth = getUnitWidth(type, config, rentableDepth);
  const thisArea = config[type].area;

  // STUDIOS ARE SPECIAL: Very rigid, max 15% expansion
  // Studios should be exactly target size or just slightly bigger
  if (type === UnitType.Studio) {
    return targetWidth * UNIT_SIZING.STUDIO_MAX_EXPANSION_FACTOR;
  }

  // Find all unit types sorted by area (largest first)
  const allTypes = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed];
  const sortedByArea = allTypes
    .filter(t => config[t].percentage > 0) // Only consider types in the mix
    .sort((a, b) => config[b].area - config[a].area);

  // Find the largest type in the current mix
  const largestType = sortedByArea[0];
  const largestArea = largestType ? config[largestType].area : thisArea;

  // If this IS the largest type, cap it to avoid "huge units".
  // Mental model: if the largest unit exceeds (target + smallest unit), you likely can pack more units.
  // So we cap largest to target + smallest-type target width (typically studio).
  if (thisArea >= largestArea) {
    const smallestType = getSmallestActiveUnitType(config);
    const smallestWidth = getUnitWidth(smallestType, config, rentableDepth);
    return targetWidth + smallestWidth;
  }

  // Find the next larger type
  const nextLargerType = sortedByArea.find(t => config[t].area > thisArea);

  if (nextLargerType) {
    // Max = next larger type's target width (NEVER exceed the next typology)
    return getUnitWidth(nextLargerType, config, rentableDepth);
  }

  // Fallback: allow 25% expansion
  return targetWidth * UNIT_SIZING.FALLBACK_EXPANSION_FACTOR;
};

// ============================================================================
// Placement Eligibility
// ============================================================================

/**
 * Corner Eligibility: Which unit types can be placed at building corners.
 * Respects the cornerEligible setting from the UI configuration.
 * Falls back to area-based logic if setting is not provided.
 */
export const isCornerEligible = (type: UnitType, config: UnitConfiguration): boolean => {
  // First, check if cornerEligible is explicitly set in config
  const unitConfig = config[type];
  if (unitConfig.cornerEligible !== undefined) {
    Logger.debug(`isCornerEligible(${type}): using config value = ${unitConfig.cornerEligible}`);
    return unitConfig.cornerEligible;
  }

  // Fallback: Only the top 2 largest types by area are corner-eligible
  const allTypes = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed];
  const sortedByArea = allTypes
    .filter(t => config[t].percentage > 0)
    .sort((a, b) => config[b].area - config[a].area);

  const cornerEligibleTypes = sortedByArea.slice(0, 2);
  const result = cornerEligibleTypes.includes(type);
  Logger.debug(`isCornerEligible(${type}): using fallback = ${result}`);
  return result;
};

/**
 * L-Shape Eligibility: Which unit types can wrap around cores to form L-shapes.
 * Studios and small units should NOT be L-shaped - they're too small to benefit.
 */
export const isLShapeEligible = (type: UnitType, config: UnitConfiguration): boolean => {
  // Studios are NEVER L-shape eligible - they should be simple rectangles
  if (type === UnitType.Studio) {
    return false;
  }

  // 1BR: Only if larger than 850 sq ft (they're borderline)
  if (type === UnitType.OneBed) {
    const area = config[type].area;
    return area > UNIT_SIZING.ONE_BR_LSHAPE_MIN_AREA_SQFT * SQ_FEET_TO_SQ_METERS;
  }

  // 2BR and 3BR are always L-shape eligible
  return true;
};

// ============================================================================
// Strategy Configuration
// ============================================================================

/**
 * Strategy-specific safety factors that control how much of available space to use.
 * - balanced: 0.99 (conservative, prevents compression issues)
 * - mixOptimized: 0.97 (pack tighter to hit mix percentages exactly)
 * - efficiencyOptimized: 1.0 (use all available space for max efficiency)
 */
export const getStrategySafetyFactor = (strategy: OptimizationStrategy): number => {
  return STRATEGY_SAFETY_FACTORS[strategy] ?? STRATEGY_SAFETY_FACTORS.balanced;
};
