/**
 * Floorplate Generator - Algorithm Types
 * Types for the unit layout algorithm
 */

// Legacy enum - kept for backwards compatibility, will be removed
export enum UnitType {
  Studio = 'Studio',
  OneBed = '1BR',
  TwoBed = '2BR',
  ThreeBed = '3BR'
}

// Legacy configuration format - kept for backwards compatibility
export interface UnitConfiguration {
  [UnitType.Studio]: { percentage: number; area: number; cornerEligible?: boolean };
  [UnitType.OneBed]: { percentage: number; area: number; cornerEligible?: boolean };
  [UnitType.TwoBed]: { percentage: number; area: number; cornerEligible?: boolean };
  [UnitType.ThreeBed]: { percentage: number; area: number; cornerEligible?: boolean };
}

// ============================================================================
// DYNAMIC UNIT TYPE SYSTEM
// Supports arbitrary unit typologies with per-unit behavioral configuration
// ============================================================================

/**
 * Complete definition of a unit type with all behavioral parameters
 */
export interface DynamicUnitType {
  // Identity
  id: string;                    // Unique identifier (e.g., "studio", "penthouse")
  name: string;                  // Display name (e.g., "Studios", "Penthouses")
  color: string;                 // Hex color string (e.g., "#3b82f6")

  // Size configuration
  area: number;                  // Target area in square meters
  percentage: number;            // Target percentage of total units (0-100)

  // Flexibility - how much the unit can stretch/shrink
  sizeTolerance: number;         // Max deviation from target (0.0-0.5, e.g., 0.15 = ±15%)

  // Placement rules
  lShapeEligible: boolean;       // Can this unit wrap around cores to form L-shapes?
  cornerEligible: boolean;       // Can this unit be placed at corridor ends / outer corners?
  placementPriority: number;     // Higher = placed first at premium positions (1-100)

  // Width constraints (in meters)
  minWidth: number;              // Minimum unit width
  maxWidth: number;              // Maximum unit width

  // Advanced: Flexibility weights for gap/compression distribution
  expansionWeight: number;       // Capacity to absorb extra space (1-50)
  compressionWeight: number;     // Capacity to absorb compression (0.01-20)
}

/**
 * Configuration for smart defaults interpolation
 */
export interface SmartDefaultsConfig {
  // Area thresholds for interpolation (in square meters)
  smallUnitMaxArea: number;      // Below this = rigid, no corners (default ~55 sq m)
  largeUnitMinArea: number;      // Above this = flexible, corners allowed (default ~110 sq m)

  // Interpolation ranges
  sizeToleranceRange: [number, number];    // [min, max] for small to large
  expansionWeightRange: [number, number];
  compressionWeightRange: [number, number];
  placementPriorityRange: [number, number];
}

/**
 * New dynamic unit configuration format
 */
export interface DynamicUnitConfiguration {
  unitTypes: DynamicUnitType[];
  smartDefaults: SmartDefaultsConfig;
}

export interface EgressConfig {
  sprinklered: boolean;
  deadEndLimit: number;       // Max dead-end corridor length (ft)
  travelDistanceLimit: number; // Max travel distance to exit (ft)
  commonPathLimit: number;    // Max common path of egress (ft)
}

export interface UnitBlock {
  id: string;
  // New dynamic type system
  typeId: string;                // Unique type identifier (e.g., "studio", "penthouse")
  typeName: string;              // Display name for rendering (e.g., "Studio", "PH")
  // Legacy type field - kept for backwards compatibility
  type?: UnitType;
  x: number;
  y: number;
  width: number;
  depth: number;
  area: number;
  color: string;
  side: 'North' | 'South';
  // For L-shaped units: array of corner points defining the polygon
  // If undefined, unit is a simple rectangle
  polyPoints?: { x: number; y: number }[];
  isLShaped?: boolean;
}

export interface CoreBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  type: 'End' | 'Mid';
  side: 'North' | 'South';
}

export interface CorridorBlock {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface FloorPlanData {
  units: UnitBlock[];
  cores: CoreBlock[];
  corridor: CorridorBlock;
  buildingLength: number;
  buildingDepth: number;
  floorElevation: number;
  // Transformation from local to world coordinates
  transform: {
    centerX: number;  // World X of building center
    centerY: number;  // World Y of building center
    rotation: number; // Rotation angle in radians
  };
  stats: {
    gsf: number;           // Gross Square Feet (total building area)
    nrsf: number;          // Net Rentable Square Feet (unit areas)
    efficiency: number;    // NRSF / GSF ratio
    unitCounts: Record<string, number>;  // Keyed by typeId for dynamic types
    totalUnits: number;
  };
  egress: {
    maxDeadEnd: number;
    maxTravelDistance: number;
    deadEndStatus: 'Pass' | 'Fail';
    travelDistanceStatus: 'Pass' | 'Fail';
  };
}

export interface BuildingFootprint {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;   // Length along building's long axis (corridor direction)
  depth: number;   // Width perpendicular to corridor
  height: number;  // Building height (maxZ - minZ)
  centerX: number;
  centerY: number;
  floorZ: number;  // Ground level elevation
  rotation: number; // Rotation angle in radians (from global X axis to building's long axis)
}

// ============================================================================
// 3-OPTION GENERATION TYPES
// ============================================================================

// Strategy types per feature spec Section 8.8:
// - Option 1: Balanced - Equal priority to mix accuracy, size accuracy, and efficiency
// - Option 2: Mix Optimized - Prioritizes hitting exact unit mix percentages
// - Option 3: Efficiency Optimized - Prioritizes building efficiency (NRSF/GSF)
export type OptimizationStrategy = 'balanced' | 'mixOptimized' | 'efficiencyOptimized';

export interface LayoutOption {
  id: string;
  strategy: OptimizationStrategy;
  floorplan: FloorPlanData;
  label: string;
  description: string;
}

export interface GenerationResult {
  options: LayoutOption[];
  selectedIndex: number;
}

// ============================================================================
// ENHANCED SEGMENT TYPES (with bonus area tracking)
// ============================================================================

/**
 * Placement zones per feature spec Section 8.5
 * Determines which unit types are eligible for each position
 */
export enum PlacementZone {
  CORRIDOR_END = 'CORRIDOR_END',       // Last 2 positions before building edge (3BR, 2BR L-shaped)
  OUTER_CORNER = 'OUTER_CORNER',       // At outer wing intersections (3BR, 2BR L-shaped)
  CORE_ADJACENT = 'CORE_ADJACENT',     // Directly next to a core (2BR, 1BR, may be L-shaped)
  INNER_CORNER = 'INNER_CORNER',       // At inner wing intersections (Cores, Utilities ONLY)
  STANDARD = 'STANDARD'                // Mid-corridor positions (all types, rectangular only)
}

/**
 * Enhanced segment with bonus area tracking
 */
export interface Segment {
  id: number;
  startX: number;
  length: number;
  isCorner: boolean;
  side: 'North' | 'South';
  /** Bonus area from core wrapping (sq meters) */
  bonusArea: number;
  /** Which end of segment receives the bonus (for L-shaped units) */
  bonusEnd: 'left' | 'right' | 'none';
  /** Placement zone classification */
  zone: PlacementZone;
}

/**
 * Segment allocation with unit counts
 */
export interface SegmentAllocation {
  segment: Segment;
  counts: Record<string, number>;  // Keyed by typeId for dynamic types
}

// ============================================================================
// WING DETECTION TYPES (for multi-wing buildings)
// ============================================================================

/**
 * Corner classification based on interior angle
 */
export enum CornerType {
  CONVEX = 'CONVEX',     // Interior angle < 180° (outer corner, premium)
  CONCAVE = 'CONCAVE',   // Interior angle > 180° (inner corner, dark)
  STRAIGHT = 'STRAIGHT'  // Interior angle ≈ 180° (not a real corner)
}

/**
 * A vertex in the building footprint polygon
 */
export interface FootprintVertex {
  x: number;
  y: number;
  interiorAngle: number;
  cornerType: CornerType;
  index: number;
}

/**
 * A wing is a distinct rectangular section of the building
 */
export interface Wing {
  id: number;
  /** Vertices that define this wing's boundary */
  vertices: FootprintVertex[];
  /** Primary direction (angle from horizontal) */
  direction: number;
  /** Wing length along primary axis */
  length: number;
  /** Wing width perpendicular to primary axis */
  width: number;
  /** Centerline for corridor routing */
  centerline: { start: { x: number; y: number }; end: { x: number; y: number } };
  /** Bounding box */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Where two wings meet
 */
export interface WingIntersection {
  /** The vertex at the intersection point */
  point: FootprintVertex;
  /** Type of intersection */
  type: 'inner' | 'outer';
  /** IDs of the two wings that meet here */
  wingIds: [number, number];
  /** Angle between the two wings */
  angle: number;
  /** Inner corner zone (for core/utility placement) */
  innerZone?: {
    polygon: { x: number; y: number }[];
    area: number;
  };
  /** Outer corner zone (for premium unit placement) */
  outerZone?: {
    polygon: { x: number; y: number }[];
    area: number;
  };
}

/**
 * Result of wing detection algorithm
 */
export interface WingDetectionResult {
  /** Detected wings */
  wings: Wing[];
  /** Wing intersections */
  intersections: WingIntersection[];
  /** Is this a simple bar building (1 wing)? */
  isSimpleBar: boolean;
  /** Building shape classification */
  shape: 'bar' | 'L' | 'U' | 'V' | 'H' | 'snake' | 'courtyard' | 'complex';
}

// ============================================================================
// WALL ALIGNMENT TYPES
// ============================================================================

/**
 * Wall alignment configuration
 */
export interface AlignmentConfig {
  /** Alignment strength (0-1): 0=loose (no alignment), 1=strict (max alignment) */
  strength: number;
  /** Maximum distance to pull a wall for alignment (in meters) */
  maxPullDistance: number;
  /** Whether to enable alignment */
  enabled: boolean;
}

/**
 * A wall position that can be used as a snap target
 */
export interface WallSnapTarget {
  /** X position of the wall */
  x: number;
  /** Which unit this wall belongs to */
  unitId: string;
  /** Side of corridor */
  side: 'North' | 'South';
  /** Whether this is a left edge or right edge of a unit */
  edge: 'left' | 'right';
}

// ============================================================================
// OPTIMIZATION TYPES
// ============================================================================

/**
 * Result of geometry optimization search
 */
export interface GeometrySearchResult {
  /** Optimal corner length */
  cornerLength: number;
  /** Optimal mid-core offset (if applicable) */
  midCoreOffset: number;
  /** Optimization score (lower is better) */
  score: number;
  /** Breakdown of score components */
  scoreBreakdown: {
    mixError: number;
    sizeDistortion: number;
    compressionPenalty: number;
    expansionPenalty: number;
  };
}

/**
 * Optimization parameters for the search algorithm
 */
export interface OptimizationParams {
  /** Minimum corner length to search (in meters) */
  minCornerLength: number;
  /** Maximum corner length to search (in meters) */
  maxCornerLength: number;
  /** Step size for corner length search (in meters) */
  cornerStep: number;
  /** Maximum mid-core offset deviation (in meters) */
  maxMidCoreOffset: number;
  /** Step size for mid-core offset search (in meters) */
  offsetStep: number;
  /** Penalty multiplier for compression (default 5x expansion) */
  compressionPenaltyMultiplier: number;
  /** Safety factor for length calculation (0-1, default 0.99) */
  safetyFactor: number;
}

/**
 * Enhanced core block with wing intersection support
 */
export interface EnhancedCoreBlock extends Omit<CoreBlock, 'type'> {
  type: 'End' | 'Mid' | 'WingIntersection';
  /** If this is a wing intersection core, which intersection it belongs to */
  intersectionId?: number;
}

// ============================================================================
// GENERATOR INPUT/OUTPUT TYPES
// ============================================================================

/**
 * Complete generator configuration
 */
export interface GeneratorConfig {
  /** Unit mix and sizes */
  unitConfig: UnitConfiguration;
  /** Egress requirements */
  egress: EgressConfig;
  /** Corridor width (meters) */
  corridorWidth: number;
  /** Core dimensions */
  coreWidth: number;
  coreDepth: number;
  /** Which side cores are placed on */
  coreSide: 'North' | 'South';
  /** Wall alignment settings */
  alignment: AlignmentConfig;
  /** Optimization parameters */
  optimization: OptimizationParams;
}

/**
 * Statistics about the optimization process
 */
export interface OptimizationStats {
  /** Number of configurations searched */
  configurationsSearched: number;
  /** Best score found */
  bestScore: number;
  /** Time taken (ms) */
  timeMs: number;
  /** Optimal geometry found */
  optimalGeometry: GeometrySearchResult;
}

// ============================================================================
// SAVED FLOORPLATE TYPES
// ============================================================================

/**
 * Advanced settings for a unit type
 */
export interface UnitTypeAdvancedSettings {
  lShapeEligible: boolean;
  cornerEligible: boolean;
  sizeTolerance: number;        // 0-50 (percentage)
  minWidth: number;             // in feet
  maxWidth: number;             // in feet
  placementPriority: number;    // 1-100
  expansionWeight: number;      // 1-50
  compressionWeight: number;    // 0.01-20
}

/**
 * Configuration for a single unit type (for serialization)
 */
export interface UnitTypeConfig {
  id: string;
  name: string;
  color: string;
  percentage: number;
  area: number; // in sq ft
  // Advanced settings (optional for backwards compatibility)
  advanced?: UnitTypeAdvancedSettings;
  useSmartDefaults?: boolean;   // If true, calculate advanced from area
}

/**
 * Serializable UI state snapshot for saving/restoring
 */
export interface SerializableUIState {
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
}

/**
 * A saved floorplate with all data needed to restore it
 */
export interface SavedFloorplate {
  /** Unique identifier (UUID) */
  id: string;
  /** User-visible name */
  name: string;
  /** Timestamp when saved (ISO string) */
  createdAt: string;
  /** Timestamp of last modification (ISO string) */
  updatedAt: string;
  /** The layout option (strategy + floorplan data) */
  layoutOption: LayoutOption;
  /** Snapshot of UI state at time of generation */
  uiState: SerializableUIState;
  /** Building identifier for grouping saves */
  buildingId: string;
  /** Quick-reference stats for list display */
  previewStats: {
    totalUnits: number;
    efficiency: number;
    strategy: OptimizationStrategy;
    buildingDimensions: string;
  };
}

/**
 * Lightweight summary for list display (without full floorplan data)
 */
export interface SavedFloorplateSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  buildingId: string;
  previewStats: SavedFloorplate['previewStats'];
}
