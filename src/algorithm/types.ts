/**
 * Floorplate Generator - Algorithm Types
 * Types for the unit layout algorithm
 *
 * ## Type System Architecture
 *
 * This module contains two unit type systems that coexist:
 *
 * ### 1. Legacy System (`UnitType` enum + `UnitConfiguration`)
 * - Fixed 4-type system: Studio, 1BR, 2BR, 3BR
 * - Used throughout the core algorithm (generator-core.ts)
 * - Stable, well-tested, production-ready
 * - Simple to use for standard multifamily projects
 *
 * ### 2. Dynamic System (`DynamicUnitType` + `DynamicUnitConfiguration`)
 * - Supports arbitrary unit types (penthouses, ADUs, micro-units, etc.)
 * - Per-unit behavioral configuration (flexibility, placement rules)
 * - Designed for future extensibility
 * - Not yet fully integrated into the core algorithm
 *
 * ### Migration Strategy
 * Both systems will coexist for the foreseeable future:
 * - Legacy system is the "stable API" for existing integrations
 * - Dynamic system is for new features requiring custom unit types
 * - Use `type-compat.ts` for conversions between systems:
 *   - `toDynamicConfig()` - convert legacy → dynamic
 *   - `toLegacyConfig()` - convert dynamic → legacy
 *
 * ### When to Use Which
 * - **Standard 4-type projects**: Use legacy `UnitConfiguration`
 * - **Custom unit types**: Use `DynamicUnitConfiguration` + conversion
 * - **Algorithm internals**: Legacy system (no changes planned)
 */

// ============================================================================
// LEGACY UNIT TYPE SYSTEM
// Stable, production API for standard multifamily unit types
// ============================================================================

/**
 * Legacy unit type enum - fixed 4-type system.
 *
 * This enum is deeply integrated into the core algorithm and provides
 * a simple, stable API for standard multifamily projects.
 */
export enum UnitType {
  Studio = 'Studio',
  OneBed = '1BR',
  TwoBed = '2BR',
  ThreeBed = '3BR'
}

/**
 * Legacy unit configuration format.
 *
 * Maps each unit type to its target percentage and area.
 * Areas are in square meters for internal calculations.
 */
export interface UnitConfiguration {
  [UnitType.Studio]: { percentage: number; area: number; cornerEligible?: boolean };
  [UnitType.OneBed]: { percentage: number; area: number; cornerEligible?: boolean };
  [UnitType.TwoBed]: { percentage: number; area: number; cornerEligible?: boolean };
  [UnitType.ThreeBed]: { percentage: number; area: number; cornerEligible?: boolean };
}

// ============================================================================
// DYNAMIC UNIT TYPE SYSTEM
// Extensible system for arbitrary unit typologies
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

/**
 * Filler block for leftover space that cannot be absorbed by units.
 * These are rendered and baked as CORE-type units to ensure full building coverage.
 */
export interface FillerBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
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
  fillers: FillerBlock[];
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
 * Optional generation parameters with sensible defaults.
 * Used by generateFloorplate and generateFloorplateVariants to reduce parameter count.
 */
export interface GeneratorOptions {
  /** Corridor width in meters (default: ~1.83m / 6ft) */
  corridorWidth?: number;
  /** Core width in meters (default: ~3.66m / 12ft) */
  coreWidth?: number;
  /** Core depth in meters (default: ~9m / 29.5ft) */
  coreDepth?: number;
  /** Which side of corridor to place cores (default: 'North') */
  coreSide?: 'North' | 'South';
  /** Wall alignment strength 0-1 (default: 0.5 for single, 1.0 for variants) */
  alignment?: number;
  /** Custom colors for unit types (hex strings) */
  customColors?: Partial<Record<UnitType, string>>;
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
// FUNCTION CONTEXT TYPES
// Context objects for functions with many parameters (reduces parameter count)
// ============================================================================

/**
 * Geometry context for a segment being generated
 */
export interface SegmentGeometry {
  /** X coordinate of segment start */
  startX: number;
  /** Y coordinate (0 for North side, positive for South) */
  y: number;
  /** Length of the segment (horizontal) */
  length: number;
  /** Extra width from core wrapping (default 0) */
  extraWidth?: number;
}

/**
 * Classification of segment position relative to building corners
 */
export interface SegmentClassification {
  /** Is this a corner segment? */
  isCorner: boolean;
  /** Is this the left building corner (x=0)? */
  isLeftCorner: boolean;
  /** Is this the right building corner (x+len ≈ buildingLength)? */
  isRightCorner: boolean;
}

/**
 * Context for generating units within a segment
 * Used by generateUnitSegment() to reduce parameter count from 13 to 3
 */
export interface SegmentGenerationContext {
  /** Position and size */
  geometry: SegmentGeometry;
  /** Corner classification */
  classification: SegmentClassification;
  /** Unit counts to place in this segment */
  unitCounts: Record<UnitType, number>;
  /** Pattern for unit ordering */
  pattern: 'desc' | 'asc' | 'valley' | 'valley-inverted' | 'random';
  /** Bonus area for L-shaped wrapping (default 0) */
  endBonusArea?: number;
  /** Custom colors for unit types */
  customColors?: Partial<Record<UnitType, string>>;
}

/**
 * Building geometry input for optimization search
 */
export interface BuildingGeometryInput {
  /** Available rentable corridor length (meters) */
  availableRentableLength: number;
  /** Number of mid-corridor core spans */
  numMidSpans: number;
  /** Bonus area per core from L-shaped wrapping (sq meters) */
  singleCoreBonusArea: number;
  /** Is this a continuous side with no core breaks? */
  isContinuousSide?: boolean;
}

/**
 * Context for the geometry optimization search
 * Used by findOptimalGeometry() to reduce parameter count from 9 to 3
 */
export interface OptimizationSearchContext {
  /** Building geometry inputs */
  buildingGeometry: BuildingGeometryInput;
  /** Unit types available for placement */
  unitInventory: Record<UnitType, number>;
  /** Reserve large units for corners? */
  prioritizeCorners: boolean;
  /** Max dead-end corridor length (reserved for egress constraints) */
  deadEndLimit?: number;
}

/**
 * Segment definition for distribution algorithm
 * Extracted from inline type definition for clarity
 */
export interface SegmentDefinition {
  /** Segment length (meters) */
  len: number;
  /** Is this a corner segment? */
  isCorner: boolean;
  /** Bonus area from L-shaped wrapping (sq meters) */
  bonusArea: number;
}

/**
 * Input for wall alignment algorithm
 * Used by applyWallAlignment() to reduce parameter count from 5 to 3
 */
export interface WallAlignmentInput {
  /** Units to align (will be modified) */
  targetUnits: InternalUnitBlock[];
  /** Reference units to snap to */
  refUnits: InternalUnitBlock[];
  /** Alignment strength 0-1 (0=loose, 1=strict) */
  alignmentStrength: number;
}

/**
 * Internal unit block representation during generation
 * (Exported for use in WallAlignmentInput)
 */
export interface InternalUnitBlock {
  id: string;
  type: UnitType;
  typeId: string;
  typeName: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  area: number;
  color: string;
  rects?: { x: number; y: number; width: number; depth: number }[];
  polyPoints?: string;
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
