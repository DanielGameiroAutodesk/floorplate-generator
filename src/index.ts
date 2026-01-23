/**
 * Floorplate Generator for Autodesk Forma
 *
 * Main entry point for the library/extension
 */

// Export all geometry types
export * from './types';

// Export geometry utilities
export * from './geometry';

// Export algorithm types
export type {
  UnitType,
  UnitConfiguration,
  UnitBlock,
  CoreBlock,
  CorridorBlock,
  FloorPlanData,
  BuildingFootprint,
  LayoutOption,
  EgressConfig,
  OptimizationStrategy,
  GeneratorOptions,
  SegmentDefinition
} from './algorithm/types';

// Export algorithm functions
export {
  generateFloorplate,
  generateFloorplateVariants
} from './algorithm/generator-core';

// Export bake functions (for Forma extension use)
export {
  bakeWithFloorStack,
  bakeWithFloorStackBatch,
  canBake
} from './extension/bake-building';

export type {
  BakeOptions,
  BakeResult
} from './extension/bake-building';

// Export constants
export {
  UNIT_COLORS,
  DEFAULT_CORRIDOR_WIDTH,
  FEET_TO_METERS,
  SQ_FEET_TO_SQ_METERS
} from './algorithm/constants';

// Export logger utility
export { Logger, LogLevel } from './algorithm/utils/logger';

// Version info
export const VERSION = '0.2.0';
export const NAME = 'Floorplate Generator';
