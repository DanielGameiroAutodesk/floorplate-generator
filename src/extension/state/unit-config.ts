/**
 * Unit Configuration Converters
 *
 * Functions that transform UI state into algorithm-compatible formats.
 * These bridge the gap between user-friendly UI inputs and the
 * algorithm's internal data structures.
 */

import { UnitType, UnitConfiguration, EgressConfig } from '../../algorithm/types';
import { UnitColorMap } from '../../algorithm';
import { FEET_TO_METERS, SQ_FEET_TO_SQ_METERS, EGRESS_SPRINKLERED, EGRESS_UNSPRINKLERED } from '../../algorithm/constants';
import { state, calculateSmartDefaultsFromArea } from './ui-state';

/**
 * Convert UI unit types to algorithm UnitConfiguration format.
 *
 * WHY: The UI allows arbitrary unit types (users can add/remove/rename),
 * but the algorithm expects specific UnitType enum values (Studio, OneBed, etc.).
 * We map by size: smallest units become Studios, largest become ThreeBed.
 *
 * This mapping strategy ensures the algorithm's assumptions about unit
 * characteristics (corner eligibility, flexibility) align with typical
 * multifamily conventions where larger units go at premium positions.
 *
 * @returns Algorithm-compatible unit configuration
 */
export function getUnitConfiguration(): UnitConfiguration {
  // Sort by area so smallest = Studio, largest = ThreeBed
  const sortedUnits = [...state.unitTypes].sort((a, b) => a.area - b.area);

  // Default configuration (all zeros)
  const config: UnitConfiguration = {
    [UnitType.Studio]: { percentage: 0, area: 55 * SQ_FEET_TO_SQ_METERS, cornerEligible: false },
    [UnitType.OneBed]: { percentage: 0, area: 82 * SQ_FEET_TO_SQ_METERS, cornerEligible: false },
    [UnitType.TwoBed]: { percentage: 0, area: 110 * SQ_FEET_TO_SQ_METERS, cornerEligible: true },
    [UnitType.ThreeBed]: { percentage: 0, area: 137 * SQ_FEET_TO_SQ_METERS, cornerEligible: true }
  };

  // Map sorted units to types (index 0 = Studio, etc.)
  const typeMap: UnitType[] = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed];

  sortedUnits.forEach((unit, index) => {
    const typeIndex = Math.min(index, typeMap.length - 1);
    const unitType = typeMap[typeIndex];

    // Get advanced settings - use smart defaults or manual settings
    const smartDefaults = calculateSmartDefaultsFromArea(unit.area);
    const adv = unit.useSmartDefaults ? smartDefaults : unit.advanced;

    // For PLACEMENT settings, always check for manual override first
    // WHY: Users should be able to override cornerEligible even with smart defaults on
    // This is a common ask: "I want smart defaults BUT this unit shouldn't be at corners"
    const cornerEligible = unit.advanced.cornerEligible !== undefined
      ? unit.advanced.cornerEligible
      : adv.cornerEligible;

    config[unitType] = {
      percentage: unit.percentage,
      area: unit.area * SQ_FEET_TO_SQ_METERS,
      cornerEligible: cornerEligible
    };
  });

  return config;
}

/**
 * Convert UI colors to algorithm UnitColorMap format.
 *
 * Uses the same size-based sorting as getUnitConfiguration to ensure
 * colors align with their corresponding unit types.
 *
 * @returns Map of UnitType to hex color string
 */
export function getUnitColors(): UnitColorMap {
  const sortedUnits = [...state.unitTypes].sort((a, b) => a.area - b.area);
  const typeMap: UnitType[] = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed];

  const colors: UnitColorMap = {};
  sortedUnits.forEach((unit, index) => {
    const typeIndex = Math.min(index, typeMap.length - 1);
    const unitType = typeMap[typeIndex];
    colors[unitType] = unit.color;
  });

  return colors;
}

/**
 * Get egress configuration from UI state.
 *
 * Starts from the appropriate base config (sprinklered/unsprinklered)
 * and overrides with user-specified values.
 *
 * WHY: Fire codes differ significantly between sprinklered and unsprinklered
 * buildings. We use preset defaults but allow customization for jurisdictions
 * with different requirements.
 *
 * @returns Complete egress configuration in meters
 */
export function getEgressConfig(): EgressConfig {
  const baseConfig = state.sprinklered ? EGRESS_SPRINKLERED : EGRESS_UNSPRINKLERED;

  return {
    ...baseConfig,
    deadEndLimit: state.deadEnd * FEET_TO_METERS,
    travelDistanceLimit: state.travelDistance * FEET_TO_METERS,
    commonPathLimit: state.commonPath * FEET_TO_METERS
  };
}
