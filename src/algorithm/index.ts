/**
 * Floorplate Generator - Algorithm Module
 *
 * Exports all public APIs for floorplate generation
 */

// Types - use 'export type' for type-only exports
export { UnitType } from './types';
export type {
  UnitBlock,
  CoreBlock,
  CorridorBlock,
  FloorPlanData,
  UnitConfiguration,
  EgressConfig,
  BuildingFootprint,
  LayoutOption,
  OptimizationStrategy,
  GenerationResult
} from './types';

// Constants
export {
  UNIT_COLORS,
  DEFAULT_UNIT_CONFIG,
  DEFAULT_CORRIDOR_WIDTH,
  DEFAULT_CORE_WIDTH,
  DEFAULT_CORE_DEPTH,
  EGRESS_SPRINKLERED,
  EGRESS_UNSPRINKLERED,
  FLEXIBILITY_FACTORS,
  STRATEGY_CONFIGS,
  STRATEGY_LABELS,
  STRATEGY_DESCRIPTIONS
} from './constants';

export type { StrategyConfig } from './constants';

// Generator
export {
  generateFloorplate,
  generateFloorplateVariants,
  extractFootprintFromTriangles
} from './generator';

export type { UnitColorMap } from './generator';

// Renderer
export {
  renderFloorplate,
  renderFloorplateLayers,
  getUnitColor
} from './renderer';

export type { FormaMeshData } from './renderer';
