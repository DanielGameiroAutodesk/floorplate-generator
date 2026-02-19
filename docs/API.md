# API Reference

This document provides a comprehensive reference for the Floorplate Generator's public API.

## Table of Contents

- [Core Functions](#core-functions)
- [Types](#types)
- [Constants](#constants)
- [Renderer Functions](#renderer-functions)
- [Baking Functions](#baking-functions)

---

## Core Functions

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
  strategy?: OptimizationStrategy,
  alignment?: number,
  customColors?: UnitColorMap
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
| `strategy` | `OptimizationStrategy` | `'balanced'` | Optimization strategy |
| `alignment` | `number` | `0.5` | Wall alignment strength (0-1) |
| `customColors` | `UnitColorMap` | `{}` | Custom colors for unit types |

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
  corridorWidth?: number;    // Corridor width in meters (default: ~1.83m / 6ft)
  coreWidth?: number;        // Core width in meters (default: ~3.66m / 12ft)
  coreDepth?: number;        // Core depth in meters (default: ~9m / 29.5ft)
  coreSide?: 'North' | 'South'; // Which side to place cores (default: 'North')
  alignment?: number;        // Wall alignment strength 0-1 (default: 1.0)
  customColors?: UnitColorMap; // Custom colors for unit types
}
```

**Returns:** `LayoutOption[]` - Array of 3 options:
1. **Balanced** - Equal priority to mix accuracy, size accuracy, and efficiency
2. **Mix Optimized** - Prioritizes hitting exact unit mix percentages
3. **Efficiency Optimized** - Prioritizes building efficiency (NRSF/GSF)

---

### `extractFootprintFromTriangles`

Extracts building footprint from Forma triangle mesh data.

```typescript
function extractFootprintFromTriangles(
  triangles: Float32Array
): BuildingFootprint
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `triangles` | `Float32Array` | Triangle vertex data from Forma SDK |

**Returns:** `BuildingFootprint` - Extracted building dimensions and transformation.

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

**Fields:**
- `percentage`: Target percentage of total units (0-100)
- `area`: Target unit area in square meters
- `cornerEligible`: Whether this type can be placed at corners (optional)

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
}
```

### `FloorPlanData`

```typescript
interface FloorPlanData {
  units: UnitBlock[];
  cores: CoreBlock[];
  fillers: FillerBlock[];   // Leftover space fillers (baked as CORE)
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
  polyPoints?: { x: number; y: number }[];  // For L-shaped units
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

Represents leftover space that couldn't be absorbed by adjacent units. These are baked as CORE-type units to ensure full building coverage.

```typescript
interface FillerBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  side: 'North' | 'South';
}
```

**Notes:**
- Created when gaps > 0.5m (MIN_FILLER_WIDTH) exist after unit placement
- Baked with `program: 'CORE'` in FloorStack/BasicBuilding APIs
- Rendered with the same visual style as cores

### `CorridorBlock`

```typescript
interface CorridorBlock {
  x: number;
  y: number;
  width: number;
  depth: number;
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

Custom hex color strings for unit types (e.g., `{ [UnitType.Studio]: '#3b82f6' }`).

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

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `floorplan` | `FloorPlanData` | The generated floor plan |
| `options` | `RenderOptions` | Optional rendering configuration |

**Returns:** `FormaMeshData` - Mesh data that can be passed to `Forma.render.addMesh()`.

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

## Usage Examples

### Basic Generation

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

### Custom Unit Configuration

```typescript
import { UnitType, generateFloorplate } from 'floorplate-generator';

const customConfig = {
  [UnitType.Studio]:   { percentage: 30, area: 50 },   // 30% studios at 50 sq m
  [UnitType.OneBed]:   { percentage: 40, area: 75 },   // 40% 1BR at 75 sq m
  [UnitType.TwoBed]:   { percentage: 20, area: 100 },  // 20% 2BR at 100 sq m
  [UnitType.ThreeBed]: { percentage: 10, area: 130 }   // 10% 3BR at 130 sq m
};

const floorplan = generateFloorplate(
  footprint,
  customConfig,
  EGRESS_SPRINKLERED,
  2.0,             // 2m corridor
  4.0,             // 4m core width
  10.0,            // 10m core depth
  'South',         // Cores on south side
  0.5,             // Wall alignment strength (0-1)
  'mixOptimized'   // Prioritize exact percentages
);
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

---

## Conversion Constants

All internal calculations use meters. Use these constants for conversion:

```typescript
export const FEET_TO_METERS = 0.3048;
export const SQ_FEET_TO_SQ_METERS = 0.0929;  // FEET_TO_METERS^2
```

---

## Utility Exports

### `canBake`

Checks whether the current user has edit permissions in the Forma project.

```typescript
async function canBake(): Promise<boolean>
```

**Returns:** `true` if the user can create building elements, `false` otherwise.

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

console.log(`${NAME} v${VERSION}`);  // "Floorplate Generator v0.2.0"
```

---

## Baking Functions

These functions convert generated floorplates into native Forma building elements.

### `bakeWithFloorStack` (Recommended)

Creates a native Forma building using the FloorStack SDK API (v0.90.0) with plan-based floors.
This is the recommended method as it:
- Creates buildings with unit subdivisions (CORE, CORRIDOR, LIVING_UNIT programs)
- Uses SDK authentication (no manual token management)
- Supports L-shaped units via polyPoints

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

**BakeOptions:**

```typescript
interface BakeOptions {
  numFloors: number;           // Number of floors to create
  originalBuildingPath?: string; // Path of building to remove after bake
  name?: string;               // Name for the new building element
}
```

**Returns:** `BakeResult` - Result of the baking operation.

```typescript
interface BakeResult {
  success: boolean;
  urn?: string;     // URN of created element (on success)
  error?: string;   // Error message (on failure)
}
```

**Example:**

```typescript
import { bakeWithFloorStack } from './extension/bake-building';

const result = await bakeWithFloorStack(layoutOption.floorplan, {
  numFloors: 5,
  originalBuildingPath: selectedBuildingPath,
  name: 'My Generated Building'
});

if (result.success) {
  console.log('Building created:', result.urn);
}
```

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

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `buildings` | `Array<{floorplan, options}>` | Array of floorplans with their options |

**Returns:** `Array<BakeResult>` - Results for each building in the batch.

---

### `bakeWithBasicBuildingAPI`

Creates a native Forma building using direct BasicBuilding API calls.
Use this as a fallback when FloorStack API is unavailable.

```typescript
async function bakeWithBasicBuildingAPI(
  floorplan: FloorPlanData,
  options: BakeOptions
): Promise<BakeResult>
```

**Note:** This method requires authentication setup:
- **Production:** Uses session cookies via Forma proxy
- **Localhost:** Requires Bearer token via OAuth flow

See [BAKING_WORKFLOW.md](./BAKING_WORKFLOW.md) for authentication details.

---

### FloorStack SDK Types

The FloorStack API (SDK v0.90.0) uses these types for plan-based building creation:

```typescript
// Plan with unit subdivisions
interface FloorStackPlan {
  id: string;
  vertices: FloorStackVertex[];
  units: FloorStackUnit[];
}

// Vertex definition
interface FloorStackVertex {
  id: string;   // Pattern: [a-zA-Z0-9-]{2,20}
  x: number;    // Local X coordinate
  y: number;    // Local Y coordinate
}

// Unit with program type
interface FloorStackUnit {
  polygon: string[];           // Vertex IDs (counterclockwise)
  holes: string[][];           // Interior holes (each hole is array of vertex IDs)
  program?: 'CORE' | 'CORRIDOR' | 'LIVING_UNIT' | 'PARKING';
  functionId?: string;
}

// Important: Coordinates must be CENTERED at origin (building center at 0,0)
// Transform handles rotation and translation to world position

// Floor referencing a plan
interface FloorByPlan {
  height: number;
  planId: string;
}
```

**SDK Method:**

```typescript
// Create building with unit subdivisions
const { urn } = await Forma.elements.floorStack.createFromFloors({
  floors: [
    { planId: 'plan1', height: 3.2 },
    { planId: 'plan1', height: 3.2 }
  ],
  plans: [plan]
});

// Batch creation
const { urns } = await Forma.elements.floorStack.createFromFloorsBatch([
  { floors: [...], plans: [...] },
  { floors: [...], plans: [...] }
]);
```
