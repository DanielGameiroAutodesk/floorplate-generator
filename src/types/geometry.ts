/**
 * Core geometry and floorplate types for the Floorplate Generator
 *
 * @module types/geometry
 *
 * ## Overview
 *
 * This module defines the **conceptual/UI-layer** geometry and floorplate types. It serves
 * as a domain model for floorplate structure (units, cores, corridors) and is used by
 * higher-level UI, visualization, and integration code.
 *
 * ## Primary Responsibilities
 *
 * - **Primitive geometry**: Point, Line, Rectangle, Polygon, BoundingBox
 * - **Floorplate structure**: Unit, Core, Corridor with semantic properties
 * - **Configuration**: UnitConfiguration, ConstraintConfig, EgressConfig
 * - **Defaults**: IBC-based egress presets, market-rate unit mix
 *
 * ## Units: Imperial (Feet)
 *
 * All measurements in this module use **feet** (imperial). The algorithm layer
 * (`algorithm/types.ts`, `algorithm/constants.ts`) uses **meters** for Forma integration.
 * Conversion happens at the boundary via `FEET_TO_METERS` from `algorithm/constants`.
 *
 * ## Relationship to algorithm/types.ts
 *
 * | This module (geometry) | algorithm/types.ts |
 * |------------------------|-------------------|
 * | Conceptual/UI layer | Algorithm I/O layer |
 * | Feet | Meters |
 * | BuildingFootprint.outline (Polygon) | BuildingFootprint.polygon (Point[]) |
 * | Unit.geometry (Polygon) | UnitBlock (x, y, width, depth, polyPoints) |
 */

/**
 * A 2D point representing a location in the floor plan.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A line segment defined by two endpoints
 */
export interface Line {
  start: Point;
  end: Point;
}

/**
 * A rectangle defined by position and dimensions.
 *
 * @remarks Position (x, y) is the bottom-left corner; width/height extend right and up.
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A polygon defined by an ordered array of vertices.
 *
 * @remarks Vertices should be ordered (clockwise or counter-clockwise). The polygon
 * is implicitly closed (last vertex connects to first).
 */
export interface Polygon {
  vertices: Point[];
}

/**
 * Axis-aligned bounding box (AABB) for a shape. All values in feet.
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Unit types available in the floorplate (fixed 4-type system).
 *
 * @remarks Mirrors algorithm/types.UnitType; this module uses imperial units.
 */
export enum UnitType {
  Studio = 'Studio',
  OneBed = '1BR',
  TwoBed = '2BR',
  ThreeBed = '3BR'
}

/**
 * Configuration for a single unit type in the UI layer.
 */
export interface UnitTypeConfig {
  /** Target percentage of total units (0-100) */
  percentage: number;
  /** Target area in square feet */
  area: number;
  /** Display color (hex string, e.g. "#4A90D9") */
  color: string;
}

/**
 * Complete unit mix configuration
 */
export interface UnitConfiguration {
  [UnitType.Studio]: UnitTypeConfig;
  [UnitType.OneBed]: UnitTypeConfig;
  [UnitType.TwoBed]: UnitTypeConfig;
  [UnitType.ThreeBed]: UnitTypeConfig;
}

/**
 * A single apartment unit in the generated floorplate
 */
export interface Unit {
  /** Unique identifier */
  id: string;
  /** Type of unit (Studio, 1BR, etc.) */
  type: UnitType;
  /** Geometric boundary of the unit */
  geometry: Polygon;
  /** Calculated area in square feet */
  area: number;
  /** Whether the unit has access to the building facade (exterior wall) */
  hasFacadeAccess: boolean;
  /** Whether the unit has access to the corridor */
  hasCorridorAccess: boolean;
  /** Position index along the corridor (for ordering) */
  position: number;
  /** Which side of corridor: 'north' or 'south' (or 'left'/'right' depending on orientation) */
  side: 'north' | 'south';
}

/**
 * Types of cores (vertical circulation) in the building
 */
export enum CoreType {
  /** Core at the end of a corridor */
  End = 'end',
  /** Core in the middle of a long corridor */
  Middle = 'middle',
  /** Core at wing intersection (for multi-wing buildings - future) */
  Intersection = 'intersection'
}

/**
 * A core (stairwell/elevator shaft) in the floorplate
 */
export interface Core {
  /** Unique identifier */
  id: string;
  /** Type of core */
  type: CoreType;
  /** Geometric boundary of the core */
  geometry: Rectangle;
  /** Position along the corridor centerline */
  corridorPosition: number;
  /** Which side of corridor the core is on */
  side: 'north' | 'south';
}

/**
 * The corridor running through the building
 */
export interface Corridor {
  /** Centerline of the corridor as a polyline */
  centerline: Point[];
  /** Width of the corridor in feet */
  width: number;
  /** Total length of the corridor */
  length: number;
  /** Polygon boundary of the corridor */
  geometry: Polygon;
}

/**
 * Egress configuration based on building codes
 */
export interface EgressConfig {
  /** Whether the building has fire sprinklers */
  isSprinklered: boolean;
  /** Maximum travel distance to nearest exit (feet) */
  maxTravelDistance: number;
  /** Maximum common path of egress travel (feet) */
  maxCommonPath: number;
  /** Maximum dead-end corridor length (feet) */
  maxDeadEnd: number;
}

/**
 * Constraint configuration for floorplate generation. All dimensions in feet.
 */
export interface ConstraintConfig {
  /** Corridor width in feet */
  corridorWidth: number;
  /** End core dimensions (width × depth in feet) */
  endCoreDimensions: { width: number; depth: number };
  /** Middle core dimensions (width × depth in feet) */
  middleCoreDimensions: { width: number; depth: number };
  /** Which side of corridor cores are placed on; 'auto' lets algorithm choose */
  coreSide: 'north' | 'south' | 'auto';
  /** Wall alignment strictness (0 = loose, 1 = maximum alignment) */
  wallAlignmentStrictness: number;
}

/**
 * Metrics calculated for a generated floorplate
 */
export interface FloorplateMetrics {
  /** Gross Square Footage - total floor area */
  gsf: number;
  /** Net Rentable Square Footage - apartment area only */
  nrsf: number;
  /** Efficiency ratio (nrsf / gsf) */
  efficiency: number;
  /** Total number of units */
  totalUnits: number;
  /** Count of each unit type */
  unitCounts: Record<UnitType, number>;
  /** Actual percentage of each unit type */
  actualMix: Record<UnitType, number>;
  /** Difference from target mix */
  mixDeviation: Record<UnitType, number>;
}

/**
 * A complete generated floorplate option
 */
export interface FloorplateOption {
  /** Unique identifier for this option */
  id: string;
  /** Display name (e.g., "Efficiency Optimized") */
  name: string;
  /** Algorithm strategy used to generate this option */
  strategy: 'efficiency' | 'mix' | 'balanced';
  /** The corridor */
  corridor: Corridor;
  /** All cores in the floorplate */
  cores: Core[];
  /** All apartment units */
  units: Unit[];
  /** Calculated metrics */
  metrics: FloorplateMetrics;
  /** Whether the layout passes egress validation */
  isEgressCompliant: boolean;
  /** Any validation warnings */
  warnings: string[];
}

/**
 * Building footprint input from Forma. All dimensions in feet.
 *
 * @remarks This is the conceptual/UI representation. The algorithm uses
 * algorithm/types.BuildingFootprint with meters and different structure.
 */
export interface BuildingFootprint {
  /** The polygon outline of the building */
  outline: Polygon;
  /** Total building height in feet */
  height: number;
  /** Floor-to-floor height in feet */
  floorHeight: number;
  /** Number of floors (height / floorHeight) */
  floorCount: number;
  /** Total footprint area in square feet */
  area: number;
  /** Width of the building — shortest dimension in feet */
  width: number;
  /** Length of the building — longest dimension in feet */
  length: number;
}

/**
 * Default egress values for sprinklered buildings
 */
export const SPRINKLERED_EGRESS_DEFAULTS: EgressConfig = {
  isSprinklered: true,
  maxTravelDistance: 250,
  maxCommonPath: 125,
  maxDeadEnd: 50
};

/**
 * Default egress values for unsprinklered buildings
 */
export const UNSPRINKLERED_EGRESS_DEFAULTS: EgressConfig = {
  isSprinklered: false,
  maxTravelDistance: 200,
  maxCommonPath: 75,
  maxDeadEnd: 20
};

/**
 * Default unit configuration (Market Rate preset)
 */
export const DEFAULT_UNIT_CONFIG: UnitConfiguration = {
  [UnitType.Studio]: { percentage: 20, area: 590, color: '#4A90D9' },
  [UnitType.OneBed]: { percentage: 40, area: 885, color: '#7CB342' },
  [UnitType.TwoBed]: { percentage: 30, area: 1180, color: '#FFB300' },
  [UnitType.ThreeBed]: { percentage: 10, area: 1475, color: '#E65100' }
};

/**
 * Default constraint configuration
 */
export const DEFAULT_CONSTRAINTS: ConstraintConfig = {
  corridorWidth: 5,
  endCoreDimensions: { width: 20, depth: 25 },
  middleCoreDimensions: { width: 18, depth: 22 },
  coreSide: 'auto',
  wallAlignmentStrictness: 0.5
};
