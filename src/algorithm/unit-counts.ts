/**
 * Unit Count Calculation Module
 *
 * Calculates how many units of each type should be placed in the floorplate
 * based on the target unit mix, available length, and placement strategy.
 *
 * Uses the Largest Remainder Method for accurate mix distribution.
 */

import { UnitType, UnitConfiguration, OptimizationStrategy } from './types';
import { MIN_UNIT_WIDTH } from './constants';
import {
  getUnitWidth,
  isCornerEligible,
  getStrategySafetyFactor
} from './flexibility-model';
import { Logger } from './utils/logger';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sum all unit counts across types.
 */
export const getTotal = (counts: Record<UnitType, number>): number =>
  counts[UnitType.Studio] + counts[UnitType.OneBed] + counts[UnitType.TwoBed] + counts[UnitType.ThreeBed];

/**
 * Create an empty unit counts record.
 */
export const createEmptyCounts = (): Record<UnitType, number> => ({
  [UnitType.Studio]: 0,
  [UnitType.OneBed]: 0,
  [UnitType.TwoBed]: 0,
  [UnitType.ThreeBed]: 0
});

// ============================================================================
// Types
// ============================================================================

/**
 * Unit counts split between north and south sides of the building.
 */
export interface SideCounts {
  north: Record<UnitType, number>;
  south: Record<UnitType, number>;
}

// ============================================================================
// Global Unit Count Calculation
// ============================================================================

/**
 * Calculate unit counts for a single corridor side using Largest Remainder Method.
 *
 * @param totalLength - Total rentable length available (meters)
 * @param config - Unit configuration with percentages and areas
 * @param rentableDepth - Depth of units perpendicular to corridor (meters)
 * @param minSegmentsToFill - Minimum number of segments that need units
 * @param totalBonusArea - Extra area from L-shapes/corners (square meters)
 * @param strategy - Optimization strategy affecting safety factor
 */
export const calculateGlobalUnitCounts = (
  totalLength: number,
  config: UnitConfiguration,
  rentableDepth: number,
  minSegmentsToFill: number = 1,
  totalBonusArea: number = 0,
  strategy: OptimizationStrategy = 'balanced'
): Record<UnitType, number> => {
  const emptyCounts = createEmptyCounts();

  const totalMix = config[UnitType.Studio].percentage +
                   config[UnitType.OneBed].percentage +
                   config[UnitType.TwoBed].percentage +
                   config[UnitType.ThreeBed].percentage;

  if (totalMix === 0 || totalLength < MIN_UNIT_WIDTH) return emptyCounts;

  // Calculate weighted average width
  const weightedAvgWidth = (
    (config[UnitType.Studio].percentage * getUnitWidth(UnitType.Studio, config, rentableDepth)) +
    (config[UnitType.OneBed].percentage * getUnitWidth(UnitType.OneBed, config, rentableDepth)) +
    (config[UnitType.TwoBed].percentage * getUnitWidth(UnitType.TwoBed, config, rentableDepth)) +
    (config[UnitType.ThreeBed].percentage * getUnitWidth(UnitType.ThreeBed, config, rentableDepth))
  ) / totalMix;

  // Account for Bonus Area by converting it to effective length
  const effectiveLength = totalLength + (totalBonusArea / rentableDepth);

  // SAFETY FACTOR: Strategy-dependent to balance compression vs efficiency
  const safetyFactor = getStrategySafetyFactor(strategy);
  const usableLength = effectiveLength * safetyFactor;

  // Cap target to physical maximum
  const maxPhysUnits = Math.floor(totalLength / MIN_UNIT_WIDTH);
  const baseUnits = Math.floor(usableLength / weightedAvgWidth);
  const startUnits = Math.max(Math.min(baseUnits, maxPhysUnits), minSegmentsToFill);
  if (startUnits === 0) return emptyCounts;

  // Largest Remainder Method helper for a given N
  const countsForN = (targetTotalUnits: number): Record<UnitType, number> => {
    const counts = createEmptyCounts();
    const remainders: { type: UnitType; value: number }[] = [];
    let currentSum = 0;

    ([UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as const).forEach(type => {
      const rawCount = targetTotalUnits * (config[type].percentage / totalMix);
      const intCount = Math.floor(rawCount);
      counts[type] = intCount;
      currentSum += intCount;
      remainders.push({ type, value: rawCount - intCount });
    });

    const deficit = targetTotalUnits - currentSum;
    remainders.sort((a, b) => b.value - a.value);
    for (let i = 0; i < deficit; i++) {
      counts[remainders[i].type]++;
    }
    return counts;
  };

  // Feasibility check: can we fit at MIN target widths (no shrinking allowed)?
  const minWidthSum = (counts: Record<UnitType, number>): number => {
    return (
      counts[UnitType.Studio] * getUnitWidth(UnitType.Studio, config, rentableDepth) +
      counts[UnitType.OneBed] * getUnitWidth(UnitType.OneBed, config, rentableDepth) +
      counts[UnitType.TwoBed] * getUnitWidth(UnitType.TwoBed, config, rentableDepth) +
      counts[UnitType.ThreeBed] * getUnitWidth(UnitType.ThreeBed, config, rentableDepth)
    );
  };

  // "No huge units" policy: maximize unit count while still fitting at minimum widths
  let bestN = startUnits;
  let bestCounts = countsForN(bestN);

  for (let n = startUnits; n <= maxPhysUnits; n++) {
    const c = countsForN(n);
    const w = minWidthSum(c);
    if (w <= usableLength + 0.05) { // 5cm tolerance for rounding
      bestN = n;
      bestCounts = c;
    } else {
      break;
    }
  }

  const counts = bestCounts;

  // GUARANTEE MINIMUM: Ensure at least 1 unit of each type with >0% in mix
  const typesWithMix = ([UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as const)
    .filter(t => config[t].percentage > 0);

  for (const type of typesWithMix) {
    if (counts[type] === 0) {
      const mostAbundant = typesWithMix
        .filter(t => counts[t] > 1)
        .sort((a, b) => counts[b] - counts[a])[0];

      if (mostAbundant) {
        counts[mostAbundant]--;
        counts[type] = 1;
        Logger.debug(`Guaranteed min: Added 1 ${type} by taking from ${mostAbundant}`);
      }
    }
  }

  const cornerEligibleTypes = typesWithMix.filter(t => isCornerEligible(t, config));
  const totalCornerEligible = cornerEligibleTypes.reduce((sum, t) => sum + counts[t], 0);
  Logger.debug(`Corner-eligible units from mix: ${totalCornerEligible} (types: ${cornerEligibleTypes.join(',')})`);
  Logger.debug(`Available: 3BR=${counts[UnitType.ThreeBed]}, 2BR=${counts[UnitType.TwoBed]}`);
  Logger.debug(`Final counts for side: Studio=${counts[UnitType.Studio]}, 1BR=${counts[UnitType.OneBed]}, 2BR=${counts[UnitType.TwoBed]}, 3BR=${counts[UnitType.ThreeBed]}`);

  return counts;
};

// ============================================================================
// Core Side Mix Bias
// ============================================================================

/**
 * Bias mix between sides when one side has cores.
 * Core side tends to accept more small units (studios) and fewer mid units (1BR)
 * to compensate for core footprint & preserve alignment.
 */
export const applyCoreSideMixBias = (
  counts: SideCounts,
  coreSide: 'North' | 'South',
  numCores: number
): SideCounts => {
  const core = coreSide === 'North' ? counts.north : counts.south;
  const clear = coreSide === 'North' ? counts.south : counts.north;

  // Heuristic: up to 1 studio per core, swapped against 1BR to preserve totals
  const maxShifts = Math.max(0, Math.min(numCores, clear[UnitType.Studio], core[UnitType.OneBed]));
  for (let i = 0; i < maxShifts; i++) {
    clear[UnitType.Studio]--;
    core[UnitType.Studio]++;
    core[UnitType.OneBed]--;
    clear[UnitType.OneBed]++;
  }

  return counts;
};

// ============================================================================
// Building-Wide Unit Count Calculation
// ============================================================================

/**
 * Calculate units for ENTIRE building, then split between North and South.
 * This prevents rounding errors that double small percentages (e.g., 10% 3BR).
 *
 * @param northLength - Rentable length on north side (meters)
 * @param southLength - Rentable length on south side (meters)
 * @param northBonus - Bonus area on north side (square meters)
 * @param southBonus - Bonus area on south side (square meters)
 * @param northSegmentCount - Number of segments on north side
 * @param southSegmentCount - Number of segments on south side
 * @param config - Unit configuration
 * @param rentableDepth - Unit depth (meters)
 * @param strategy - Optimization strategy
 * @param isMirrored - If true, calculate for one side and mirror
 */
export const calculateBuildingUnitCounts = (
  northLength: number,
  southLength: number,
  northBonus: number,
  southBonus: number,
  northSegmentCount: number,
  southSegmentCount: number,
  config: UnitConfiguration,
  rentableDepth: number,
  strategy: OptimizationStrategy = 'balanced',
  isMirrored: boolean = false
): SideCounts => {
  // STRICT MIRRORING: Calculate for ONE side and mirror
  if (isMirrored) {
    Logger.debug('calculateBuildingUnitCounts: MIRRORED MODE - Calculating for Core Side only');
    const coreSideCounts = calculateGlobalUnitCounts(
      northLength,
      config,
      rentableDepth,
      northSegmentCount,
      northBonus,
      strategy
    );
    return { north: coreSideCounts, south: { ...coreSideCounts } };
  }

  // Calculate TOTAL building capacity
  const totalLength = northLength + southLength;
  const totalBonus = northBonus + southBonus;
  const totalSegments = northSegmentCount + southSegmentCount;

  // Get building-wide unit counts
  const totalCounts = calculateGlobalUnitCounts(
    totalLength,
    config,
    rentableDepth,
    totalSegments,
    totalBonus,
    strategy
  );

  Logger.debug(`BUILDING-WIDE counts: S=${totalCounts[UnitType.Studio]}, 1BR=${totalCounts[UnitType.OneBed]}, 2BR=${totalCounts[UnitType.TwoBed]}, 3BR=${totalCounts[UnitType.ThreeBed]}`);

  // Split between North and South
  const northRatio = totalLength > 0 ? northLength / totalLength : 0.5;

  const northCounts = createEmptyCounts();
  const southCounts = createEmptyCounts();

  // CORNER-AWARE SPLIT
  const allTypes = [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as const;
  const cornerEligibleTypes = allTypes.filter(t => totalCounts[t] > 0 && isCornerEligible(t, config));
  const totalCornerEligible = cornerEligibleTypes.reduce((sum, t) => sum + totalCounts[t], 0);

  Logger.debug(`Total corner-eligible units: ${totalCornerEligible} (types: ${cornerEligibleTypes.join(',')})`);

  let northCornerEligible = 0;
  let southCornerEligible = 0;

  // PHASE 1: Distribute corner-eligible types to ensure both sides have at least 2
  for (const type of cornerEligibleTypes) {
    const total = totalCounts[type];

    if (total >= 4) {
      northCounts[type] = Math.max(2, Math.floor(total / 2));
      southCounts[type] = total - northCounts[type];
    } else if (total >= 2) {
      if (northCornerEligible < 2 && southCornerEligible < 2) {
        northCounts[type] = Math.floor(total / 2);
        southCounts[type] = total - northCounts[type];
      } else if (northCornerEligible < 2) {
        northCounts[type] = Math.min(total, 2 - northCornerEligible);
        southCounts[type] = total - northCounts[type];
      } else if (southCornerEligible < 2) {
        southCounts[type] = Math.min(total, 2 - southCornerEligible);
        northCounts[type] = total - southCounts[type];
      } else {
        northCounts[type] = Math.floor(total / 2);
        southCounts[type] = total - northCounts[type];
      }
    } else if (total === 1) {
      if (northCornerEligible <= southCornerEligible) {
        northCounts[type] = 1;
        southCounts[type] = 0;
      } else {
        northCounts[type] = 0;
        southCounts[type] = 1;
      }
    }

    northCornerEligible += northCounts[type];
    southCornerEligible += southCounts[type];
    Logger.debug(`${type}: ${northCounts[type]} North, ${southCounts[type]} South (corner totals: N=${northCornerEligible}, S=${southCornerEligible})`);
  }

  // PHASE 2: Distribute non-corner-eligible types proportionally
  const nonCornerTypes = allTypes.filter(t => totalCounts[t] > 0 && !isCornerEligible(t, config));
  for (const type of nonCornerTypes) {
    const total = totalCounts[type];
    const northShare = Math.round(total * northRatio);
    northCounts[type] = Math.min(northShare, total);
    southCounts[type] = total - northCounts[type];
  }

  Logger.debug(`SPLIT - North: S=${northCounts[UnitType.Studio]}, 1BR=${northCounts[UnitType.OneBed]}, 2BR=${northCounts[UnitType.TwoBed]}, 3BR=${northCounts[UnitType.ThreeBed]}`);
  Logger.debug(`SPLIT - South: S=${southCounts[UnitType.Studio]}, 1BR=${southCounts[UnitType.OneBed]}, 2BR=${southCounts[UnitType.TwoBed]}, 3BR=${southCounts[UnitType.ThreeBed]}`);

  return { north: northCounts, south: southCounts };
};
