# API Reference

This document provides a comprehensive reference for the Floorplate Generator's public API.

## Table of Contents

- [Single-Wing Functions](#single-wing-functions)
- [Multi-Wing Functions](#multi-wing-functions)
- [Footprint Extraction Functions](#footprint-extraction-functions)
- [Wing Detection Functions](#wing-detection-functions)
- [Design Mode Functions](#design-mode-functions)
- [Renderer Functions](#renderer-functions)
- [Baking Functions](#baking-functions)
- [Types](#types)
- [Constants](#constants)
- [Usage Examples](#usage-examples)

---

## Single-Wing Functions

### `generateFloorplate`

Generates a single floorplate layout for a given building footprint.

```typescript
function generateFloorplate(
  footprint: BuildingFootprint,
  unitConfig: UnitConfiguration,
  egress: EgressConfig,
  corridorWidth?: number,
  coreWidth?: number,
  coreDepth?: number,
  coreSide?: 'North' | 'South',
  alignment?: number,
  strategy?: OptimizationStrategy,
  customColors?: UnitColorMap,
  wingOptions?: WingGenerationOptions
): FloorPlanData
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `footprint` | `BuildingFootprint` | required | Building dimensions and position |
| `unitConfig` | `UnitConfiguration` | required | Unit type sizes and percentages |
| `egress` | `EgressConfig` | required | Egress requirements |
| `corridorWidth` | `number` | `1.83m` | Corridor width in meters |
| `coreWidth` | `number` | `3.66m` | Core width in meters |
| `coreDepth` | `number` | `9.0m` | Core depth in meters |
| `coreSide` | `'North' \| 'South'` | `'North'` | Which side cores are placed |
| `alignment` | `number` | `0.5` | Wall alignment strength (0-1) |
| `strategy` | `OptimizationStrategy` | `'balanced'` | Optimization strategy |
| `customColors` | `UnitColorMap` | `{}` | Custom colors for unit types |
| `wingOptions` | `WingGenerationOptions` | `undefined` | Multi-wing integration options |

**Returns:** `FloorPlanData` - Complete floor plan with units, cores, corridor, and statistics.

---

### `generateFloorplateVariants`

Generates three layout options using different optimization strategies.

```typescript
function generateFloorplateVariants(
  footprint: BuildingFootprint,
  config: UnitConfiguration,
  egressConfig: EgressConfig,
  options?: GeneratorOptions
): LayoutOption[]
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `footprint` | `BuildingFootprint` | required | Building dimensions and position |
| `config` | `UnitConfiguration` | required | Unit type sizes and percentages |
| `egressConfig` | `EgressConfig` | required | Egress requirements |
| `options` | `GeneratorOptions` | `{}` | Optional generation parameters |

**GeneratorOptions:**

```typescript
interface GeneratorOptions {
  corridorWidth?: number;
  coreWidth?: number;
  coreDepth?: number;
  coreSide?: 'North' | 'South';
  alignment?: number;
  customColors?: UnitColorMap;
}
```

**Returns:** `LayoutOption[]` - Array of 3 options:
1. **Balanced** - Equal priority to mix accuracy, size accuracy, and efficiency
2. **Mix Optimized** - Prioritizes hitting exact unit mix percentages
3. **Efficiency Optimized** - Prioritizes building efficiency (NRSF/GSF)

---

## Multi-Wing Functions

### `generateMultiWingFloorplate`

Generates a single floorplate for a multi-wing building (L, U, V, H, snake, courtyard).

```typescript
function generateMultiWingFloorplate(
  polygon: {x: number, y: number}[],
  wingAnalysis: MultiWingAnalysis,
  config: UnitConfiguration,
  egressConfig: EgressConfig,
  options?: MultiWingGeneratorOptions
): FloorPlanData
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `polygon` | `{x,y}[]` | Building footprint polygon (CCW winding) |
| `wingAnalysis` | `MultiWingAnalysis` | Wing detection result (from `analyzeFootprint` or `createAnalysisFromLine`) |
| `config` | `UnitConfiguration` | Unit type sizes and percentages |
| `egressConfig` | `EgressConfig` | Egress requirements |
| `options` | `MultiWingGeneratorOptions` | Optional generation parameters |

**Returns:** `FloorPlanData` - Complete multi-wing floor plan with all wings stitched together.

---

### `generateMultiWingFloorplateVariants`

Generates three layout options for a multi-wing building.

```typescript
function generateMultiWingFloorplateVariants(
  polygon: {x: number, y: number}[],
  config: UnitConfiguration,
  egressConfig: EgressConfig,
  options?: MultiWingGeneratorOptions,
  topology?: { outer: {x,y}[], holes: {x,y}[][] },
  precomputedAnalysis?: MultiWingAnalysis
): LayoutOption[]
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `polygon` | `{x,y}[]` | Building footprint polygon |
| `config` | `UnitConfiguration` | Unit type sizes and percentages |
| `egressConfig` | `EgressConfig` | Egress requirements |
| `options` | `MultiWingGeneratorOptions` | Optional generation parameters |
| `topology` | `{outer, holes}` | Footprint topology (outer boundary + holes) |
| `precomputedAnalysis` | `MultiWingAnalysis` | Pre-computed wing analysis (skips re-detection) |

**Note:** Deep-clone the polygon before each call if generating multiple variants, as the algorithm may mutate geometry.

**Returns:** `LayoutOption[]` - Array of 3 options (Balanced, Mix Optimized, Efficiency Optimized).

---

### `MultiWingGeneratorOptions`

```typescript
interface MultiWingGeneratorOptions {
  corridorWidth?: number;              // Corridor width in meters (default: ~1.83m)
  coreWidth?: number;                  // Core width in meters (default: ~3.66m)
  coreDepth?: number;                  // Core depth in meters (default: ~9m)
  coreSide?: 'North' | 'South';       // Core placement side (default: 'North')
  alignment?: number;                  // Wall alignment strength 0-1 (default: 0.5)
  strategy?: OptimizationStrategy;     // Optimization strategy
  customColors?: Record<string, string>; // Custom colors for unit types
  includeIntersectionCustomUnits?: boolean; // Include corner units at intersections
}
```

### `WingGenerationOptions`

Per-wing options passed by the multi-wing orchestrator to `generateFloorplate()`:

```typescript
interface WingGenerationOptions {
  skipLeftEndCore?: boolean;       // Intersection provides left end core
  skipRightEndCore?: boolean;      // Intersection provides right end core
  intersectionEnds?: ('left' | 'right')[]; // Suppress corner segments at these ends
  unitInventory?: Record<UnitType, number>; // Pre-allocated unit counts for this wing
  skipEgress?: boolean;            // Skip per-wing egress (validated globally)
}
```

---

## Footprint Extraction Functions

### `extractFootprintPolygon`

Extracts the actual building footprint polygon from Forma triangle mesh data, preserving concave corners (L/U/H shapes). This is the recommended extraction method for multi-wing buildings.

```typescript
function extractFootprintPolygon(triangles: Float32Array): {
  polygon: {x: number, y: number}[];
  topology: { outer: {x,y}[], holes: {x,y}[][] };
  floorZ: number;
  height: number;
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `triangles` | `Float32Array` | Triangle vertex data from `Forma.geometry.getTriangles()` |

**Returns:**
- `polygon` -- Simplified outer boundary polygon (CCW winding)
- `topology` -- Full topology with outer boundary and holes (for courtyard shapes)
- `floorZ` -- Ground floor elevation
- `height` -- Building height (max Z - min Z)

**Pipeline:** Vertex welding (1mm epsilon) -> ground triangle extraction -> boundary edge detection -> edge chaining -> Douglas-Peucker simplification (5cm epsilon) -> winding normalization.

---

### `extractFootprintFromTriangles`

Legacy footprint extraction using convex hull approach. Works for rectangular buildings but loses concave corners.

```typescript
function extractFootprintFromTriangles(triangles: Float32Array): BuildingFootprint
```

---

### `polygonToLegacyFootprint`

Converts a footprint polygon to the legacy `BuildingFootprint` format. Uses the longest edge as the primary axis to determine rotation.

```typescript
function polygonToLegacyFootprint(
  polygon: {x: number, y: number}[],
  floorZ: number,
  height: number,
  topology?: { outer: {x,y}[], holes: {x,y}[][] }
): BuildingFootprint
```

**Returns:** `BuildingFootprint` with the `polygon` and `topology` fields populated.

---

### `weldVertices`

Merges vertices within epsilon of each other using a spatial hash grid. Exported utility for handling Float32 mesh precision issues.

```typescript
function weldVertices(
  points: {x: number, y: number}[],
  epsilon: number
): {
  uniquePoints: {x: number, y: number}[];
  indexMap: number[];
}
```

---

## Wing Detection Functions

### `analyzeFootprint`

Analyzes a footprint polygon to detect wings, intersections, roles, and net lengths. This is the main entry point for wing detection.

```typescript
function analyzeFootprint(
  polygon: {x: number, y: number}[],
  topology?: { outer: {x,y}[], holes: {x,y}[][] }
): MultiWingAnalysis
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `polygon` | `{x,y}[]` | Building footprint polygon (CCW winding) |
| `topology` | `{outer, holes}` | Optional full topology for complex shapes |

**Returns:** `MultiWingAnalysis` -- Contains wings, intersections, shape classification, wing roles, and net wing lengths.

---

### `classifyVertices`

Classifies each polygon vertex as CONVEX, CONCAVE, or STRAIGHT based on cross-product.

```typescript
function classifyVertices(
  polygon: {x: number, y: number}[]
): FootprintVertex[]
```

**Returns:** Array of `FootprintVertex` with corner type and interior angle for each vertex.

---

## Design Mode Functions

These functions are in the extension layer (`src/extension/`), not the algorithm layer.

### `startDesignMode`

Launches Forma's design tool for the user to draw a polyline, then auto-generates and bakes a building.

```typescript
// src/extension/managers/design-manager.ts
async function startDesignMode(): Promise<void>
```

**Workflow:**
1. Opens Forma's `designTool.getLine()` for user to draw
2. Converts drawn line + width to polygon via `lineToFootprintTopology()`
3. Routes to single-wing or multi-wing generator
4. Auto-bakes the Balanced option via `bakeWithFloorStack()`

---

### `lineToFootprintTopology`

Converts a polyline into a closed footprint polygon by buffering it with miter joints.

```typescript
// src/extension/utils/line-to-polygon.ts
function lineToFootprintTopology(
  coordinates: Vec3[],
  width: number
): { outer: {x: number, y: number}[], holes: {x: number, y: number}[][] }
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `coordinates` | `Vec3[]` | Points from Forma's design tool |
| `width` | `number` | Total building width in meters |

**Behavior:**
- **Open line**: Offsets left/right by `width/2`, combines into a single closed polygon. No holes.
- **Closed line** (endpoints within 10cm): Creates outer loop (larger area) and inner loop (hole) for courtyard shapes.

---

### `lineToFootprintPolygon`

Simplified version that returns only the outer polygon (no holes).

```typescript
function lineToFootprintPolygon(
  coordinates: Vec3[],
  width: number
): {x: number, y: number}[]
```

---

## Renderer Functions

### `renderFloorplate`

Converts a FloorPlanData object into Forma-compatible mesh data.

```typescript
function renderFloorplate(
  floorplan: FloorPlanData,
  options?: RenderOptions
): FormaMeshData
```

**Returns:** `FormaMeshData` - Mesh data that can be passed to `Forma.render.addMesh()`.

**Note:** For multi-wing buildings, renders `corridorSegments` (all segments) rather than the single `corridor` field. Uses ear-clipping triangulation for concave polygons (corridor wedges, L-shaped units).

### `renderFloorplateLayers`

Renders the floorplate as separate layers (units, cores, corridor).

```typescript
function renderFloorplateLayers(
  floorplan: FloorPlanData
): { units: FormaMeshData; cores: FormaMeshData; corridor: FormaMeshData }
```

### `getUnitColor`

Gets the display color for a unit type.

```typescript
function getUnitColor(type: UnitType): string
```

**Returns:** CSS color string (e.g., `'rgba(59, 130, 246, 0.78)'`).

---

## Baking Functions

These functions convert generated floorplates into native Forma building elements.

### `bakeWithFloorStack` (Recommended)

Creates a native Forma building using the FloorStack SDK API with plan-based floors. Supports multi-floor stacking and L-shaped units.

```typescript
async function bakeWithFloorStack(
  floorplan: FloorPlanData,
  options: BakeOptions
): Promise<BakeResult>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `floorplan` | `FloorPlanData` | The generated floor plan to bake |
| `options` | `BakeOptions` | Baking configuration options |

**Features:**
- Creates buildings with unit subdivisions (CORE, CORRIDOR, LIVING_UNIT programs)
- Stacks `numFloors` identical floors with configurable height (default 3.2m)
- Handles L-shaped units via `polyPoints` and ear-clipping triangulation
- Falls back to polygon mode (no unit subdivisions) if plan conversion fails

---

### `bakeWithFloorStackBatch`

Creates multiple buildings in a single API call for better performance.

```typescript
async function bakeWithFloorStackBatch(
  buildings: Array<{
    floorplan: FloorPlanData;
    options: BakeOptions;
  }>
): Promise<Array<BakeResult>>
```

---

### `bakeWithBasicBuildingAPI`

Creates a native Forma building using direct BasicBuilding API calls. Use as a fallback when FloorStack API is unavailable.

```typescript
async function bakeWithBasicBuildingAPI(
  floorplan: FloorPlanData,
  options: BakeOptions
): Promise<BakeResult>
```

**Note:** Requires authentication setup. See [BAKING_WORKFLOW.md](./BAKING_WORKFLOW.md).

---

### `canBake`

Checks whether the current user has edit permissions in the Forma project.

```typescript
async function canBake(): Promise<boolean>
```

---

## Types

### `UnitType` (enum)

```typescript
enum UnitType {
  Studio = 'Studio',
  OneBed = '1BR',
  TwoBed = '2BR',
  ThreeBed = '3BR'
}
```

### `UnitConfiguration`

```typescript
interface UnitConfiguration {
  [UnitType.Studio]: { percentage: number; area: number; cornerEligible?: boolean };
  [UnitType.OneBed]: { percentage: number; area: number; cornerEligible?: boolean };
  [UnitType.TwoBed]: { percentage: number; area: number; cornerEligible?: boolean };
  [UnitType.ThreeBed]: { percentage: number; area: number; cornerEligible?: boolean };
}
```

### `EgressConfig`

```typescript
interface EgressConfig {
  sprinklered: boolean;
  deadEndLimit: number;       // Max dead-end corridor length (meters)
  travelDistanceLimit: number; // Max travel distance to exit (meters)
  commonPathLimit: number;    // Max common path of egress (meters)
}
```

### `BuildingFootprint`

```typescript
interface BuildingFootprint {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;   // Length along building's long axis
  depth: number;   // Width perpendicular to corridor
  height: number;  // Building height
  centerX: number;
  centerY: number;
  floorZ: number;  // Ground level elevation
  rotation: number; // Rotation angle in radians
  polygon?: {x: number, y: number}[];  // Actual footprint polygon (multi-wing)
  topology?: { outer: {x,y}[], holes: {x,y}[][] }; // Full topology
}
```

### `FloorPlanData`

```typescript
interface FloorPlanData {
  units: UnitBlock[];
  cores: CoreBlock[];
  fillers: FillerBlock[];
  corridor: CorridorBlock;
  buildingLength: number;
  buildingDepth: number;
  floorElevation: number;
  transform: {
    centerX: number;
    centerY: number;
    rotation: number;
  };
  stats: {
    gsf: number;           // Gross Square Feet
    nrsf: number;          // Net Rentable Square Feet
    efficiency: number;    // NRSF / GSF ratio
    unitCounts: Record<string, number>;
    totalUnits: number;
  };
  egress: {
    maxDeadEnd: number;
    maxTravelDistance: number;
    deadEndStatus: 'Pass' | 'Fail';
    travelDistanceStatus: 'Pass' | 'Fail';
  };

  // Multi-wing fields (present when building has multiple wings)
  corridorSegments?: CorridorBlock[];        // All corridor segments
  corridorGraph?: { nodes: any[]; edges: any[] }; // Egress graph
  wingInfo?: {
    shape: string;
    wingCount: number;
    wings?: Array<{ id: number; length: number; width: number;
                    center: {x: number, y: number}; direction: number }>;
  };
}
```

### `UnitBlock`

```typescript
interface UnitBlock {
  id: string;
  typeId: string;              // Unique type identifier
  typeName: string;            // Display name
  type?: UnitType;             // Legacy type field
  x: number;
  y: number;
  width: number;
  depth: number;
  area: number;
  color: string;
  side: 'North' | 'South';
  polyPoints?: {x: number, y: number}[];  // For L-shaped units
  isLShaped?: boolean;
}
```

### `CoreBlock`

```typescript
interface CoreBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  type: 'End' | 'Mid';
  side: 'North' | 'South';
}
```

### `FillerBlock`

Represents leftover space that couldn't be absorbed by adjacent units. Baked as CORE-type units to ensure full building coverage.

```typescript
interface FillerBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  side: 'North' | 'South';
  polyPoints?: {x: number, y: number}[];  // For non-rectangular fillers
}
```

### `CorridorBlock`

```typescript
interface CorridorBlock {
  x: number;
  y: number;
  width: number;
  depth: number;
  polyPoints?: {x: number, y: number}[];  // For non-rectangular corridor segments
}
```

### `LayoutOption`

```typescript
interface LayoutOption {
  id: string;
  strategy: OptimizationStrategy;
  floorplan: FloorPlanData;
  label: string;
  description: string;
}
```

### `OptimizationStrategy`

```typescript
type OptimizationStrategy = 'balanced' | 'mixOptimized' | 'efficiencyOptimized';
```

### `UnitColorMap`

```typescript
type UnitColorMap = Partial<Record<UnitType, string>>;
```

### `BakeOptions`

```typescript
interface BakeOptions {
  numFloors: number;           // Number of floors to stack (identical layouts)
  originalBuildingPath?: string; // Path of building to remove after bake
  name?: string;               // Name for the new building element
}
```

### `BakeResult`

```typescript
interface BakeResult {
  success: boolean;
  urn?: string;     // URN of created element (on success)
  error?: string;   // Error message (on failure)
}
```

### Wing Detection Types

```typescript
enum CornerType {
  CONVEX = 'CONVEX',     // Interior angle < 180 (outer corner)
  CONCAVE = 'CONCAVE',   // Interior angle > 180 (inner corner, reflex)
  STRAIGHT = 'STRAIGHT'  // Interior angle ~ 180
}

interface FootprintVertex {
  x: number;
  y: number;
  interiorAngle: number;
  cornerType: CornerType;
  index: number;
}

interface Wing {
  id: number;
  vertices: FootprintVertex[];
  direction: number;          // Primary axis angle (radians)
  length: number;             // Along primary axis
  width: number;              // Perpendicular to primary axis
  centerline: { start: {x: number, y: number}; end: {x: number, y: number} };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  center?: { x: number; y: number };
}

interface WingIntersection {
  point: FootprintVertex;
  type: 'inner' | 'outer';
  wingIds: [number, number];
  angle: number;
  innerZone?: { polygon: {x: number, y: number}[]; area: number };
  outerZone?: { polygon: {x: number, y: number}[]; area: number };
}

interface WingDetectionResult {
  wings: Wing[];
  intersections: WingIntersection[];
  isSimpleBar: boolean;
  shape: 'bar' | 'L' | 'U' | 'V' | 'H' | 'snake' | 'courtyard' | 'complex';
}

// Extended with role assignments and net lengths
interface MultiWingAnalysis extends WingDetectionResult {
  wingRoles: WingRole[];
  netWingLengths: Map<number, number>;
}

interface WingRole {
  wingId: number;
  intersectionIndex: number;
  role: 'host' | 'guest';
  coreSide: 'North' | 'South';
  intersectionEnd: 'left' | 'right';
  explicitPlacement: boolean;
}
```

### Design Mode Types

```typescript
// src/extension/utils/line-to-polygon.ts
type Vec3 = { x: number; y: number; z: number };
```

---

## Constants

### Unit Configuration Defaults

```typescript
import {
  DEFAULT_UNIT_CONFIG,
  DEFAULT_CORRIDOR_WIDTH,
  DEFAULT_CORE_WIDTH,
  DEFAULT_CORE_DEPTH
} from './algorithm';

// DEFAULT_UNIT_CONFIG
{
  [UnitType.Studio]:   { percentage: 20, area: 54.8 },   // ~590 sq ft
  [UnitType.OneBed]:   { percentage: 40, area: 82.2 },   // ~885 sq ft
  [UnitType.TwoBed]:   { percentage: 30, area: 109.6 },  // ~1180 sq ft
  [UnitType.ThreeBed]: { percentage: 10, area: 137.0 }   // ~1475 sq ft
}

DEFAULT_CORRIDOR_WIDTH = 1.83m  // 6 ft
DEFAULT_CORE_WIDTH = 3.66m      // 12 ft
DEFAULT_CORE_DEPTH = 8.99m      // 29.5 ft
```

### Egress Defaults

```typescript
import { EGRESS_SPRINKLERED, EGRESS_UNSPRINKLERED } from './algorithm';

// EGRESS_SPRINKLERED
{
  sprinklered: true,
  deadEndLimit: 15.24,        // 50 ft
  travelDistanceLimit: 76.2,  // 250 ft
  commonPathLimit: 38.1       // 125 ft
}

// EGRESS_UNSPRINKLERED
{
  sprinklered: false,
  deadEndLimit: 6.1,          // 20 ft
  travelDistanceLimit: 61.0,  // 200 ft
  commonPathLimit: 22.9       // 75 ft
}
```

### Unit Colors

```typescript
import { UNIT_COLORS } from './algorithm';

UNIT_COLORS = {
  [UnitType.Studio]:   { r: 59,  g: 130, b: 246, a: 200 },  // Blue
  [UnitType.OneBed]:   { r: 34,  g: 197, b: 94,  a: 200 },  // Green
  [UnitType.TwoBed]:   { r: 249, g: 115, b: 22,  a: 200 },  // Orange
  [UnitType.ThreeBed]: { r: 168, g: 85,  b: 247, a: 200 },  // Purple
  Core:                { r: 55,  g: 65,  b: 81,  a: 230 },  // Dark Gray
  Corridor:            { r: 147, g: 51,  b: 234, a: 200 }   // Purple
}
```

### Conversion Constants

```typescript
export const FEET_TO_METERS = 0.3048;
export const SQ_FEET_TO_SQ_METERS = 0.0929;  // FEET_TO_METERS^2
```

---

## Usage Examples

### Basic Generation (Single-Wing)

```typescript
import {
  generateFloorplateVariants,
  extractFootprintFromTriangles,
  DEFAULT_UNIT_CONFIG,
  EGRESS_SPRINKLERED
} from 'floorplate-generator';

// Get building triangles from Forma
const triangles = await Forma.geometry.getTriangles({ path: buildingPath });

// Extract footprint
const footprint = extractFootprintFromTriangles(triangles);

// Generate 3 layout options
const options = generateFloorplateVariants(
  footprint,
  DEFAULT_UNIT_CONFIG,
  EGRESS_SPRINKLERED
);

// Use the balanced option
const balancedLayout = options[0];
console.log(`Efficiency: ${balancedLayout.floorplan.stats.efficiency}%`);
console.log(`Total Units: ${balancedLayout.floorplan.stats.totalUnits}`);
```

### Multi-Wing Building

```typescript
import {
  extractFootprintPolygon,
  analyzeFootprint,
  generateMultiWingFloorplateVariants,
  generateFloorplateVariants,
  polygonToLegacyFootprint,
  DEFAULT_UNIT_CONFIG,
  EGRESS_SPRINKLERED
} from 'floorplate-generator';

const triangles = await Forma.geometry.getTriangles({ path: buildingPath });

// Extract polygon (preserves concave corners)
const { polygon, topology, floorZ, height } = extractFootprintPolygon(triangles);

// Analyze footprint for wings
const analysis = analyzeFootprint(polygon, topology);

let options;
if (analysis.isSimpleBar) {
  // Simple bar -- use single-wing pipeline
  const footprint = polygonToLegacyFootprint(polygon, floorZ, height, topology);
  options = generateFloorplateVariants(footprint, DEFAULT_UNIT_CONFIG, EGRESS_SPRINKLERED);
} else {
  // Multi-wing -- use multi-wing pipeline
  options = generateMultiWingFloorplateVariants(
    polygon, DEFAULT_UNIT_CONFIG, EGRESS_SPRINKLERED,
    { corridorWidth: 1.83, coreWidth: 3.66, coreDepth: 9.0 },
    topology
  );
}

console.log(`Shape: ${analysis.shape}`);
console.log(`Wings: ${analysis.wings.length}`);
console.log(`Intersections: ${analysis.intersections.length}`);
```

### Design Mode (Line-to-Building)

```typescript
import { lineToFootprintTopology } from './extension/utils/line-to-polygon';

// User draws a 3-point polyline (V-shape)
const line = [
  { x: 0, y: 0, z: 0 },
  { x: 50, y: 0, z: 0 },
  { x: 75, y: 40, z: 0 }
];

// Buffer to building width (20m total)
const { outer, holes } = lineToFootprintTopology(line, 20);
// outer: closed polygon with miter-joined corners
// holes: empty (open line)
```

### Rendering to Forma

```typescript
import { renderFloorplate } from 'floorplate-generator';

const meshData = renderFloorplate(floorplan);

await Forma.render.addMesh({
  geometryData: meshData.positions,
  // Additional Forma render options...
});
```

### Baking with Multi-Floor

```typescript
import { bakeWithFloorStack } from './extension/bake-building';

const result = await bakeWithFloorStack(layoutOption.floorplan, {
  numFloors: 8,                           // 8 identical floors
  originalBuildingPath: selectedPath,      // Remove original building
  name: 'Generated Building - Balanced'
});

if (result.success) {
  console.log('Building created:', result.urn);
}
```

---

## Utility Exports

### `Logger`

Configurable logging utility for debug output.

```typescript
import { Logger, LogLevel } from 'floorplate-generator';

Logger.setLevel(LogLevel.DEBUG);   // Show all logs
Logger.setLevel(LogLevel.NONE);    // Silence all logs
Logger.info('Generation complete');
Logger.warn('Building too narrow');
```

### `VERSION` / `NAME`

Package metadata constants.

```typescript
import { VERSION, NAME } from 'floorplate-generator';

console.log(`${NAME} v${VERSION}`);  // "Floorplate Generator v0.3.0"
```

---

## FloorStack SDK Types

The FloorStack API (SDK v0.90.0) uses these types for plan-based building creation:

```typescript
interface FloorStackPlan {
  id: string;
  vertices: FloorStackVertex[];
  units: FloorStackUnit[];
}

interface FloorStackVertex {
  id: string;   // Pattern: [a-zA-Z0-9-]{2,20}
  x: number;    // Local X coordinate (centered at origin)
  y: number;    // Local Y coordinate (centered at origin)
}

interface FloorStackUnit {
  polygon: string[];           // Vertex IDs (counterclockwise)
  holes: string[][];           // Interior holes
  program?: 'CORE' | 'CORRIDOR' | 'LIVING_UNIT' | 'PARKING';
  functionId?: string;
}

interface FloorByPlan {
  height: number;     // Floor height (default: 3.2m)
  planId: string;     // References a FloorStackPlan
}
```

**SDK Method:**

```typescript
const { urn } = await Forma.elements.floorStack.createFromFloors({
  floors: Array(numFloors).fill({ planId: 'plan1', height: 3.2 }),
  plans: [plan]
});
```
