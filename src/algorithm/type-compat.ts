/**
 * Type Compatibility Layer
 *
 * Provides conversion functions between the legacy UnitType enum system
 * and the new DynamicUnitType system for gradual migration.
 *
 * The legacy system uses a fixed enum (Studio, 1BR, 2BR, 3BR) with
 * hardcoded behavior. The dynamic system supports arbitrary unit types
 * with configurable placement rules.
 *
 * This module allows both systems to coexist during the transition period.
 */

import {
  UnitType,
  UnitConfiguration,
  DynamicUnitType,
  DynamicUnitConfiguration,
  SmartDefaultsConfig
} from './types';
import { UNIT_COLORS } from './constants';

// ============================================================================
// Default Smart Defaults Configuration
// ============================================================================

/**
 * Default interpolation configuration for smart defaults.
 * Units below smallUnitMaxArea are rigid (no corners, low flexibility).
 * Units above largeUnitMinArea are flexible (corners allowed, high flexibility).
 */
export const DEFAULT_SMART_DEFAULTS: SmartDefaultsConfig = {
  smallUnitMaxArea: 55,    // ~590 sq ft - Studios
  largeUnitMinArea: 110,   // ~1180 sq ft - 2BR+
  sizeToleranceRange: [0, 0.25],           // 0-25%
  expansionWeightRange: [1, 40],
  compressionWeightRange: [0.5, 10],
  placementPriorityRange: [10, 100]
};

// ============================================================================
// Legacy to Dynamic Conversion
// ============================================================================

/**
 * Convert a legacy UnitType to its string identifier.
 */
export function legacyTypeToId(type: UnitType): string {
  switch (type) {
    case UnitType.Studio: return 'studio';
    case UnitType.OneBed: return 'onebed';
    case UnitType.TwoBed: return 'twobed';
    case UnitType.ThreeBed: return 'threebed';
    default: return 'unknown';
  }
}

/**
 * Convert a legacy UnitType to a display name.
 */
export function legacyTypeToName(type: UnitType): string {
  switch (type) {
    case UnitType.Studio: return 'Studios';
    case UnitType.OneBed: return '1-Bedroom';
    case UnitType.TwoBed: return '2-Bedroom';
    case UnitType.ThreeBed: return '3-Bedroom';
    default: return 'Unknown';
  }
}

/**
 * Get the default color for a legacy unit type as hex string.
 */
export function legacyTypeToColor(type: UnitType): string {
  const c = UNIT_COLORS[type];
  // Convert RGBA to hex (ignoring alpha for simplicity)
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

/**
 * Calculate flexibility parameters based on unit area using interpolation.
 *
 * @param areaSqM - Unit area in square meters
 * @param config - Smart defaults configuration
 */
export function calculateFlexibilityFromArea(
  areaSqM: number,
  config: SmartDefaultsConfig = DEFAULT_SMART_DEFAULTS
): Pick<DynamicUnitType, 'sizeTolerance' | 'lShapeEligible' | 'cornerEligible' | 'placementPriority' | 'expansionWeight' | 'compressionWeight'> {
  const { smallUnitMaxArea, largeUnitMinArea } = config;

  // Interpolation factor: 0 = small unit, 1 = large unit
  const t = Math.max(0, Math.min(1, (areaSqM - smallUnitMaxArea) / (largeUnitMinArea - smallUnitMaxArea)));

  const lerp = (range: [number, number]) => range[0] + t * (range[1] - range[0]);

  return {
    sizeTolerance: lerp(config.sizeToleranceRange),
    lShapeEligible: t >= 0.5,
    cornerEligible: t > 0.5,
    placementPriority: Math.round(lerp(config.placementPriorityRange)),
    expansionWeight: Math.round(lerp(config.expansionWeightRange)),
    compressionWeight: parseFloat(lerp(config.compressionWeightRange).toFixed(2))
  };
}

/**
 * Convert a legacy UnitConfiguration to a DynamicUnitConfiguration.
 *
 * This allows legacy code to work with the new dynamic system by
 * translating the fixed enum types to dynamic type definitions.
 *
 * @param legacy - Legacy unit configuration with fixed types
 * @param smartDefaults - Optional smart defaults configuration
 * @returns Dynamic unit configuration with full type definitions
 */
export function toDynamicConfig(
  legacy: UnitConfiguration,
  smartDefaults: SmartDefaultsConfig = DEFAULT_SMART_DEFAULTS
): DynamicUnitConfiguration {
  const types = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as const;

  const unitTypes: DynamicUnitType[] = types.map(type => {
    const legacyConfig = legacy[type];
    const areaSqM = legacyConfig.area;
    const flexibility = calculateFlexibilityFromArea(areaSqM, smartDefaults);

    // Use explicit cornerEligible from config if provided
    const cornerEligible = legacyConfig.cornerEligible !== undefined
      ? legacyConfig.cornerEligible
      : flexibility.cornerEligible;

    return {
      id: legacyTypeToId(type),
      name: legacyTypeToName(type),
      color: legacyTypeToColor(type),
      area: areaSqM,
      percentage: legacyConfig.percentage,
      sizeTolerance: flexibility.sizeTolerance,
      lShapeEligible: flexibility.lShapeEligible,
      cornerEligible,
      placementPriority: flexibility.placementPriority,
      minWidth: 3.66,  // ~12 ft minimum
      maxWidth: areaSqM / 3.66 * 1.5,  // Based on reasonable depth
      expansionWeight: flexibility.expansionWeight,
      compressionWeight: flexibility.compressionWeight
    };
  });

  return {
    unitTypes,
    smartDefaults
  };
}

// ============================================================================
// Dynamic to Legacy Conversion
// ============================================================================

/**
 * Convert a dynamic type ID back to a legacy UnitType enum.
 * Returns null if the ID doesn't match a legacy type.
 */
export function idToLegacyType(id: string): UnitType | null {
  switch (id.toLowerCase()) {
    case 'studio':
    case 'studios':
      return UnitType.Studio;
    case 'onebed':
    case '1br':
    case '1-bedroom':
    case '1bed':
      return UnitType.OneBed;
    case 'twobed':
    case '2br':
    case '2-bedroom':
    case '2bed':
      return UnitType.TwoBed;
    case 'threebed':
    case '3br':
    case '3-bedroom':
    case '3bed':
      return UnitType.ThreeBed;
    default:
      return null;
  }
}

/**
 * Convert a DynamicUnitConfiguration back to legacy UnitConfiguration.
 *
 * This is useful when you need to interface with code that still
 * uses the legacy enum-based system.
 *
 * Note: If the dynamic config has more than 4 types or types that
 * don't map to legacy types, they will be ignored with a warning.
 *
 * @param dynamic - Dynamic unit configuration
 * @returns Legacy unit configuration (may have zero percentages for unmapped types)
 */
export function toLegacyConfig(dynamic: DynamicUnitConfiguration): UnitConfiguration {
  // Initialize with zeros
  const legacy: UnitConfiguration = {
    [UnitType.Studio]: { percentage: 0, area: 55, cornerEligible: false },
    [UnitType.OneBed]: { percentage: 0, area: 82, cornerEligible: false },
    [UnitType.TwoBed]: { percentage: 0, area: 110, cornerEligible: true },
    [UnitType.ThreeBed]: { percentage: 0, area: 137, cornerEligible: true }
  };

  const unmappedTypes: string[] = [];

  for (const unitType of dynamic.unitTypes) {
    const legacyType = idToLegacyType(unitType.id);

    if (legacyType !== null) {
      legacy[legacyType] = {
        percentage: unitType.percentage,
        area: unitType.area,
        cornerEligible: unitType.cornerEligible
      };
    } else {
      unmappedTypes.push(unitType.id);
    }
  }

  if (unmappedTypes.length > 0) {
    console.warn(
      `[type-compat] toLegacyConfig: Could not map dynamic types to legacy: ${unmappedTypes.join(', ')}. ` +
      `These types will be ignored.`
    );
  }

  return legacy;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a configuration is a legacy UnitConfiguration.
 */
export function isLegacyConfig(config: unknown): config is UnitConfiguration {
  if (!config || typeof config !== 'object') return false;
  const obj = config as Record<string, unknown>;
  return (
    UnitType.Studio in obj &&
    UnitType.OneBed in obj &&
    UnitType.TwoBed in obj &&
    UnitType.ThreeBed in obj
  );
}

/**
 * Check if a configuration is a DynamicUnitConfiguration.
 */
export function isDynamicConfig(config: unknown): config is DynamicUnitConfiguration {
  if (!config || typeof config !== 'object') return false;
  const obj = config as Record<string, unknown>;
  return (
    'unitTypes' in obj &&
    Array.isArray(obj.unitTypes) &&
    'smartDefaults' in obj
  );
}

/**
 * Normalize any configuration to legacy format.
 * Useful for code that needs to work with both formats.
 */
export function normalizeToLegacy(config: UnitConfiguration | DynamicUnitConfiguration): UnitConfiguration {
  if (isLegacyConfig(config)) {
    return config;
  }
  if (isDynamicConfig(config)) {
    return toLegacyConfig(config);
  }
  throw new Error('Unknown configuration format');
}

/**
 * Normalize any configuration to dynamic format.
 * Useful for code that needs to work with both formats.
 */
export function normalizeToDynamic(config: UnitConfiguration | DynamicUnitConfiguration): DynamicUnitConfiguration {
  if (isDynamicConfig(config)) {
    return config;
  }
  if (isLegacyConfig(config)) {
    return toDynamicConfig(config);
  }
  throw new Error('Unknown configuration format');
}
