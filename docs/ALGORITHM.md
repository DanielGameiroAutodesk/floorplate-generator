# Floorplate Generation Algorithm

This document provides a deep dive into the floorplate generation algorithm used by this extension, covering both single-wing (bar) and multi-wing (L, U, V, H, snake, courtyard) buildings.

## Overview

The algorithm generates optimized apartment layouts for multi-family residential buildings. It takes a building footprint and configuration parameters, then produces three layout options using different optimization strategies.

For **simple bar buildings** (single wing), the 7-phase pipeline runs directly. For **multi-wing buildings**, the system first detects wings from the footprint polygon, builds a connectivity graph, generates each wing independently, and stitches them together with intersection geometry (corner units, corridor wedges, inner cores).

## Single-Wing Pipeline (7 Phases)

```
+------------------------------------------------------------------------+
|                        Generation Pipeline                              |
|                                                                         |
|  +-----------+   +-----------+   +-----------+   +-----------+         |
|  |  Phase 1  |   |  Phase 2  |   |  Phase 3  |   |  Phase 4  |        |
|  | Footprint |-->| Corridor  |-->|   Core    |-->|  Egress   |        |
|  | Analysis  |   | Placement |   | Placement |   |Validation |        |
|  +-----------+   +-----------+   +-----------+   +-----------+         |
|       |                                               |                 |
|       |           +-----------+   +-----------+   +-----------+        |
|       |           |  Phase 7  |   |  Phase 6  |   |  Phase 5  |       |
|       +---------->|  Metrics  |<--|   Wall    |<--|   Unit    |       |
|                   |Calculation|   | Alignment |   | Placement |       |
|                   +-----------+   +-----------+   +-----------+       |
+------------------------------------------------------------------------+
```

## Phase 1: Footprint Analysis

**Input**: Triangle mesh data from Forma
**Output**: BuildingFootprint with dimensions, rotation, center point

### Process

1. Extract all vertices from triangle data
2. Project to 2D (ignore Z coordinate for footprint)
3. Calculate convex hull or bounding box (simple bar), or extract polygon (multi-wing)
4. Detect building rotation angle from longest edge
5. Calculate building dimensions (width, depth)

```typescript
interface BuildingFootprint {
  width: number;        // Building length along long axis (meters)
  depth: number;        // Building depth perpendicular to corridor (meters)
  height: number;       // Building height (meters)
  rotation: number;     // Rotation angle in radians
  centerX: number;
  centerY: number;
  floorZ: number;       // Ground elevation
  polygon?: {x: number; y: number}[];  // Actual footprint polygon (multi-wing)
}
```

### Building Shape Detection

The algorithm detects complex shapes via wing detection (see [Wing Detection](#wing-detection)):

```
Rectangular (bar):    L-Shape:             U-Shape:           V-Shape:
+----------------+   +---------+          +---------------+
|                |   |         |          |               |      \     /
|                |   |         +------+   |   +-------+   |       \   /
|                |   |                |   |   |       |   |        \ /
|                |   |                |   |   |       |   |         +
+----------------+   +----------------+   +---+       +---+
```

## Phase 2: Corridor Placement

**Input**: Building footprint, corridor width
**Output**: Corridor centerline and bounds

### Double-Loaded Corridor Design

The algorithm uses a central double-loaded corridor:

```
                    Building Depth
    <------------------------------------------->

    +--------------------------------------------+  ^
    |           North Side Units                 |  |
    |   [Unit]   [Unit]   [Unit]   [Unit]       |  |
    |--------------------------------------------+  |
    |              C O R R I D O R               |  | Building
    |--------------------------------------------+  | Width
    |           South Side Units                 |  |
    |   [Unit]   [Unit]   [Unit]   [Unit]       |  |
    +--------------------------------------------+  v
```

### Corridor Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| Width | 1.83m (6ft) | Standard corridor width |
| Depth | Building depth | Runs full length |

## Phase 3: Core Placement

**Input**: Building footprint, core dimensions, egress requirements
**Output**: Array of CoreBlock positions

### Core Types

1. **End Cores**: Placed at building extremities
2. **Mid Cores**: Added every ~76m (250ft) if needed for egress
3. **Intersection Cores**: At multi-wing intersections (inner core zones)

```
Simple Building:                With Mid-Core:
+-------+----------------+-------+   +-------+--------+--------+-------+
| CORE  |                | CORE  |   | CORE  |        | CORE   | CORE  |
+-------+----------------+-------+   +-------+--------+--------+-------+
```

### Core Dimensions

| Dimension | Default | Description |
|-----------|---------|-------------|
| Width | 3.66m (12ft) | Perpendicular to corridor |
| Depth | 8.99m (29.5ft) | Along corridor direction |

## Phase 4: Egress Validation

**Input**: Cores, corridor, egress configuration
**Output**: Compliance status, additional cores if needed

### Egress Metrics

1. **Travel Distance**: Max distance from any point to nearest core
2. **Common Path**: Distance before having two exit options
3. **Dead-End Distance**: Length of corridor with single exit

### Default Limits (Sprinklered Building)

| Metric | Limit |
|--------|-------|
| Travel Distance | 76.2m (250ft) |
| Common Path | 38.1m (125ft) |
| Dead-End | 15.24m (50ft) |

### Auto-Core Addition

If egress requirements aren't met, additional cores are automatically added:

```typescript
while (!egressValid && midCoreCount < maxMidCores) {
  addMidCore();
  recalculateEgress();
}
```

## Phase 5: Unit Placement

This is the most complex phase, implementing three distinct strategies.

### Rentable Area Calculation

```
Total Building Depth = 30m
Corridor Width = 1.83m (6ft)
Core Depth = 8.99m (29.5ft)

Rentable Depth (per side) = (30 - 1.83) / 2 = 14.09m
```

### Unit Count Calculation (Largest Remainder Method)

```typescript
// Calculate ideal count per type
const idealCounts = unitTypes.map(type => ({
  type,
  ideal: (totalRentableWidth / avgUnitWidth) * (type.percentage / 100),
  floor: Math.floor(ideal),
  remainder: ideal - Math.floor(ideal)
}));

// Allocate floors first
let allocated = idealCounts.reduce((sum, t) => sum + t.floor, 0);

// Distribute remaining slots to highest remainders
while (allocated < totalSlots) {
  const highest = idealCounts.sort((a, b) => b.remainder - a.remainder)[0];
  highest.floor++;
  highest.remainder = 0;
  allocated++;
}
```

### Flexibility Model

**Critical Rule**: Units can NEVER be smaller than their target size.

Two systems coexist (see `flexibility-model.ts` and `type-compat.ts`):

**Legacy system** (fixed 4-type enum, used by the core algorithm):

```typescript
// Expansion weights (how much each type absorbs extra space)
EXPANSION_WEIGHTS = { Studio: 1, 1BR: 5, 2BR: 15, 3BR: 40 }

// Flexibility factors (% tolerance for sizing)
FLEXIBILITY_FACTORS = { Studio: 0%, 1BR: +/-2%, 2BR: +/-5%, 3BR: +/-10% }
```

**Dynamic system** (extensible, used by the UI via smart defaults):

```typescript
// Per-type behavioral parameters (calculated from unit area)
interface UnitTypeAdvancedSettings {
  sizeTolerance: number;      // 0-25% based on area
  expansionWeight: number;    // 1-40, interpolated from area
  compressionWeight: number;  // 0.5-10, interpolated from area
  cornerEligible: boolean;    // true for units > ~1003 sq ft
  lShapeEligible: boolean;    // true for units >= ~885 sq ft
  placementPriority: number;  // 10-100
}
```

Smart defaults interpolate these values from unit area: small units (~590sf studios) get rigid/no-corner settings, while large units (~1180sf+ 2BR) get flexible/corner-eligible settings.

### Width Bounds

```typescript
// Minimum width: target size (cannot shrink)
minWidth = targetArea / rentableDepth;

// Maximum width: next larger type's width (prevents size inversion)
maxWidth = nextLargerType.targetArea / rentableDepth;
// Exception: largest type gets 25% expansion allowance
```

### Optimization Strategies

#### Strategy 1: Balanced

Balances efficiency with unit mix accuracy.

```typescript
const safetyFactor = 0.99;  // Slight under-packing
// Priority: Reasonable mix AND good efficiency
```

#### Strategy 2: Mix Optimized

Prioritizes hitting exact target percentages.

```typescript
const safetyFactor = 0.97;  // Tighter packing allowed
// Priority: Exact percentages > efficiency
```

#### Strategy 3: Efficiency Optimized

Maximizes rentable square footage ratio.

```typescript
const safetyFactor = 1.0;   // Use all available space
// Priority: Maximum NRSF/GSF ratio
```

### Unit Placement Order

```
1. Sort types by target size (descending)
2. Place largest units at premium positions (corners, ends)
3. Fill remaining space with smaller units
4. Apply flexibility distribution to fill gaps
```

### L-Shaped Unit Handling

For corner positions, units can be L-shaped:

```
Standard Unit:       L-Shaped Unit:
+-----------+        +------+---------+
|           |        |      |         |
|           |        |      |         |
|           |        |      +---------+
|           |        |                |
+-----------+        +----------------+
```

### Gap Detection and Filler Creation

After ALL unit modifications (alignment, core wrapping, corridor void absorption), the algorithm scans for leftover gaps that couldn't be absorbed by adjacent units through the flexibility model.

**Gap Detection Process:**
1. Scan North and South sides for gaps between units
2. Exclude areas occupied by cores (on core side) to prevent overlapping geometry
3. Identify gaps larger than `MIN_FILLER_WIDTH` (0.001m)
4. Create `FillerBlock` entries for these gaps

**Filler Characteristics:**
- **Minimum width**: 0.001m (effectively captures all gaps for FloorStack API coverage)
- **Depth**: Same as rentable depth
- **Baked as**: `program: 'CORE'` in FloorStack/BasicBuilding APIs

**IMPORTANT**: Filler detection must happen AFTER all unit position adjustments (alignment, L-shape wrapping, corridor void absorption) to ensure fillers cover actual gaps in final unit positions. The FloorStack API requires 100% footprint coverage with no gaps or overlaps.

## Phase 6: Wall Alignment

**Input**: Units on both sides of corridor
**Output**: Adjusted unit widths with aligned demising walls

### Alignment Algorithm

```
Before Alignment:
North: [  Unit A  ][  Unit B  ][    Unit C    ]
       ============================================
South: [Unit D][ Unit E ][   Unit F   ][Unit G]

After Alignment:
North: [  Unit A  ][   Unit B   ][   Unit C   ]
       ============================================
South: [ Unit D  ][   Unit E   ][   Unit F   ]
                    ^            ^
                 Walls aligned where possible
```

### Alignment Tolerance

User configurable: 0% (no alignment) to 100% (strict alignment)

```typescript
// Only align if within tolerance
if (Math.abs(northWallX - southWallX) <= tolerance * avgUnitWidth) {
  const meetPoint = (northWallX + southWallX) / 2;
  adjustUnits(meetPoint);
}
```

## Phase 7: Metrics Calculation

**Input**: All placed units, cores, corridor
**Output**: FloorPlanData with calculated metrics

### Metrics Computed

```typescript
interface FloorplanMetrics {
  grossArea: number;           // Total building area
  netRentableArea: number;     // Sum of unit areas
  efficiency: number;          // NRSF / GSF
  unitCounts: Record<UnitType, number>;
  unitPercentages: Record<UnitType, number>;
  egressCompliance: {
    maxTravelDistance: number;
    maxDeadEnd: number;
    isCompliant: boolean;
  };
}
```

### Efficiency Calculation

```
Efficiency = Net Rentable SF / Gross SF x 100

Example:
- Gross Area: 10,000 SF
- Core Area: 1,500 SF
- Corridor Area: 500 SF
- Net Rentable: 8,000 SF
- Efficiency: 80%
```

## Internal Pipeline (14 Steps)

The 7 phases above are the conceptual model. Internally, `generator-core.ts` implements these as 14 numbered steps:

| Step | Phase | What It Does |
|------|-------|-------------|
| 1 | Phase 1 | **Core Count Determination** -- 2 or 3 cores based on travel distance |
| 2 | Phase 1 | **Building-Wide Unit Counts** -- Largest Remainder Method for global distribution |
| 3 | Phase 1 | **Core Side Geometry Optimization** -- find optimal corner lengths and core offset |
| 4 | Phase 2-3 | **Clear Side Optimization + Geometry Construction** -- corridor/core positions |
| 5 | Phase 3 | **Generate Cores** -- create CoreBlock objects at computed positions |
| 6 | Phase 5 | **Define Unit Segments** -- partition each side into corner/mid segments |
| 7 | Phase 5 | **Distribution** -- allocate unit counts to segments; 7B mirrors 3BR at corners |
| 8 | Phase 5 | **Generate Units** -- create unit blocks within each segment |
| 9 | Phase 6 | **Alignment / Mirroring** -- align walls across corridor or mirror core side |
| 10 | Phase 5 | **Core Wrapping** -- create L-shaped units that wrap around cores |
| 11 | Phase 5 | **Corridor Void Absorption** -- end units wrap into corridor overhang |
| 11b | Phase 5 | **Filler Detection** -- create FillerBlocks for remaining gaps |
| 12 | Phase 7 | **Calculate Stats** -- GSF, NRSF, efficiency, unit counts |
| 13 | Phase 4 | **Egress Validation** -- verify travel distance and dead-end compliance |
| 14 | Phase 7 | **Convert to Output Format** -- produce final FloorPlanData |

---

## Footprint Polygon Extraction

**Module**: `src/algorithm/footprint-polygon.ts`

### Why Not Convex Hull?

The legacy `extractFootprintFromTriangles()` uses a convex hull, which works for rectangular buildings but **destroys concave corners**. An L-shaped building's inner corner becomes a straight line in a convex hull, making it impossible to detect wings.

```
Actual L-Shape:          Convex Hull:
+---------+              +-------------------+
|         |              |                   |
|         +------+       |                   |
|                |  -->  |                   |
|                |       |                   |
+----------------+       +-------------------+
                         (inner corner lost!)
```

### Extraction Pipeline

The new `extractFootprintPolygon()` preserves the true building shape:

```
Float32Array triangles from Forma
        |
        v
  1. Vertex Welding (spatial hash, epsilon = 1mm)
     WHY: Float32 meshes have micro-differences (0.000001) at coincident
     vertices. Without welding, boundary detection silently fails.
        |
        v
  2. Ground Triangle Extraction (z <= floorZ + tolerance)
     Filters to only floor-level triangles.
        |
        v
  3. Boundary Edge Detection (edges appearing exactly once)
     Interior edges appear in 2 triangles; boundary edges appear in 1.
     Edge keys are sorted vertex indices for direction-independent matching.
        |
        v
  4. Edge Chaining into Polygon(s)
     Adjacency-based traversal chains unordered edges into closed loops.
     Largest loop by area = outer boundary; smaller loops = holes.
        |
        v
  5. Douglas-Peucker Simplification (epsilon = 5cm)
     Removes mesh noise while preserving significant corners.
     Also removes nearly-collinear vertices (within 2 degrees of 180).
        |
        v
  6. Winding Normalization
     Outer boundary: counter-clockwise (CCW)
     Holes: clockwise (CW)
        |
        v
  Output: { polygon, topology: { outer, holes }, floorZ, height }
```

### Topology

The extraction returns a `FootprintTopology` with separate outer and hole boundaries:

```typescript
// Used inline (not a named export in types.ts)
{ outer: {x: number, y: number}[], holes: {x: number, y: number}[][] }
```

This supports courtyard buildings where the outer loop has an interior hole.

### Legacy Conversion

`polygonToLegacyFootprint()` converts the polygon back to a `BuildingFootprint` for compatibility with the single-wing pipeline. It finds the longest edge as the primary axis (rotation), rotates all points to a local frame, and computes the axis-aligned bounding box.

---

## Wing Detection

**Module**: `src/algorithm/wing-detection.ts`

The wing detection algorithm analyzes a footprint polygon to identify rectangular wings, their intersections, and classify the building shape.

### Pipeline

```
Footprint Polygon
        |
        v
  Step 1: Classify Vertices
     Cross-product at each vertex determines corner type:
     - CONVEX (cross > 0): outer corner (e.g., building corner)
     - CONCAVE (cross < 0): inner corner (e.g., L-shape inner corner)
     - STRAIGHT (cross ~ 0): collinear, not a real corner
        |
        v
  Step 2: Detect Dominant Directions
     Group edges by angle (tolerance +/- 5 degrees).
     Angles normalized to [0, pi) since direction and reverse are equivalent.
     Groups sorted by total edge length (dominant first).
        |
        v
  Step 3: Build Wings
     Identify rectangular wing sections by pairing parallel edges.
     Each wing has: id, direction, length, width, centerline, bounds, center.
        |
        v
  Step 4: Identify Intersections
     Where two wings meet at a polygon vertex.
     Classification:
     - 'inner' (CONCAVE vertex): where cores and corridor wedges go
     - 'outer' (CONVEX vertex): where premium corner units go
     Records wingIds, angle between wings, inner/outer zone polygons.
        |
        v
  Step 5: Determine Wing Roles
     At each intersection, one wing is 'host' (provides the core),
     the other is 'guest' (its end core is replaced by intersection core).
     Determines coreSide and intersectionEnd for each role.
        |
        v
  Step 6: Compute Net Lengths
     netLength = wingLength - overlap zone consumed by intersections.
     Excludes the geometric offset (geoOffset) at each intersection end.
        |
        v
  Output: MultiWingAnalysis
```

### Shape Classification

```typescript
type Shape = 'bar' | 'L' | 'U' | 'V' | 'H' | 'snake' | 'courtyard' | 'complex';
```

| Shape | Wings | Description |
|-------|-------|-------------|
| bar | 1 | Simple rectangular building |
| L | 2 | Two wings at ~90 degrees |
| U | 3 | Three wings forming U shape |
| V | 2 | Two wings at non-90 degree angle |
| H | 4+ | Wings with crossbar |
| snake | 3+ | Elongated multi-segment chain |
| courtyard | 3+ | Enclosed ring (closed polygon) |
| complex | varies | Anything that doesn't match above |

### Example: L-Shape Detection

```
Input polygon:
+---------+ v0
|         |
|    W0   | v1
|         +------+ v2
|                |
|       W1       |
|                |
+----------------+ v3

Vertices:
  v0: CONVEX  (outer corner)
  v1: CONCAVE (inner corner - the L's inner vertex)
  v2: CONVEX  (outer corner)
  v3: CONVEX  (outer corner)

Wings detected:
  W0: vertical wing (v0-v1 edge direction)
  W1: horizontal wing (v2-v3 edge direction)

Intersection at v1:
  type: 'inner'
  wingIds: [W0, W1]
  angle: ~90 degrees
```

### Key Types

```typescript
enum CornerType {
  CONVEX = 'CONVEX',     // Interior angle < 180 (outer corner)
  CONCAVE = 'CONCAVE',   // Interior angle > 180 (inner corner)
  STRAIGHT = 'STRAIGHT'  // Interior angle ~ 180
}

interface FootprintVertex {
  x: number; y: number;
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
  centerline: { start: {x,y}; end: {x,y} };
  bounds: { minX, maxX, minY, maxY: number };
  center?: { x: number; y: number };
}

interface WingIntersection {
  point: FootprintVertex;
  type: 'inner' | 'outer';
  wingIds: [number, number];
  angle: number;
  innerZone?: { polygon: {x,y}[]; area: number };
  outerZone?: { polygon: {x,y}[]; area: number };
}

interface WingDetectionResult {
  wings: Wing[];
  intersections: WingIntersection[];
  isSimpleBar: boolean;
  shape: Shape;
}

// Extended with role assignments and net lengths
interface MultiWingAnalysis extends WingDetectionResult {
  wingRoles: WingRole[];
  netWingLengths: Map<number, number>;
}
```

---

## Multi-Wing Pipeline

**Module**: `src/algorithm/multi-wing-generator.ts`

The multi-wing generator treats each wing as an independent bar building, generates floorplates per-wing using the single-wing pipeline, then stitches them together with explicit intersection geometry.

### Architecture Overview

```
Input: polygon, MultiWingAnalysis, config, egressConfig
        |
        v
  1. Build Wing Connectivity Graph
     WingNode per wing, IntersectionEdge per inner intersection.
        |
        v
  2. BFS Traversal -> Ordered WingTask List
     Root = first isolated wing or largest wing.
     Each task carries: effectiveLength, geoOffsets, WingGenerationOptions.
        |
        v
  3. Global Unit Mix Allocation
     PASS 1: Allocate corner-eligible units to exposed corners
     PASS 2: Distribute remaining counts proportionally by wing length
        |
        v
  4. Per-Wing Bar Generation (for each WingTask)
     a. Create synthetic BuildingFootprint (effectiveLength x depth)
     b. Call generateFloorplate() with WingGenerationOptions
     c. Transform result from wing-local to world coordinates
        |
        v
  5. Intersection Geometry (for each inner intersection)
     a. Compute 20 landmark points (IntersectionJoinGeometry)
     b. Create corner unit (8-point L-polygon at outer vertex)
     c. Create corridor wedge (4 miter-joined segments)
     d. Create inner core (6-point hexagon at inner vertex)
        |
        v
  6. Assembly & Overlap Filtering
     Merge all wing results + intersection geometry.
     Remove units/cores whose centroids fall inside reserve polygons.
        |
        v
  7. Global Egress Validation
     Build corridor graph, validate travel distances across all wings.
        |
        v
  Output: Single FloorPlanData with all wings stitched together
```

### Wing Connectivity Graph

The generator builds a graph where:
- **Nodes** (`WingNode`): One per wing, containing the `Wing` data and a map of edges
- **Edges** (`IntersectionEdge`): One per inner intersection, connecting two wings

```typescript
interface WingNode {
  wingId: number;
  wing: Wing;
  edges: Map<number, IntersectionEdge>;  // neighborWingId -> edge
}

interface IntersectionEdge {
  index: number;                  // Index in intersections array
  intersection: WingIntersection;
  wingIdA: number;
  wingIdB: number;
  endOfA: 'left' | 'right';      // Which end of wing A faces intersection
  endOfB: 'left' | 'right';      // Which end of wing B faces intersection
  geoOffsetA: number;            // Trim from wing A at this end
  geoOffsetB: number;            // Trim from wing B at this end
  theta: number;                  // Angle between wings
}
```

### GeoOffset Calculation

The geometric offset determines how much to trim from each wing at an intersection to make room for corner geometry:

```
geoOffset = buildingDepth * tan((pi - theta) / 2)

where theta = angle between the two wings at the intersection
```

**Clamping**: `geoOffset` is capped at 40% of the wing length to prevent degenerate wings.

```
Example: 90-degree L-shape, depth = 20m
  theta = pi/2
  geoOffset = 20 * tan((pi - pi/2) / 2) = 20 * tan(pi/4) = 20m
  If wing length = 40m, clamped to 40 * 0.4 = 16m
```

### Per-Wing Generation

For each `WingTask`, the generator:

1. Creates a **synthetic `BuildingFootprint`** with `width = effectiveLength` (wing length minus geoOffsets at both ends) and `depth = wing width`
2. Sets `WingGenerationOptions`:

```typescript
interface WingGenerationOptions {
  skipLeftEndCore?: boolean;       // Intersection provides left end core
  skipRightEndCore?: boolean;      // Intersection provides right end core
  intersectionEnds?: ('left'|'right')[]; // Suppress corner segments at these ends
  unitInventory?: Record<UnitType, number>; // Pre-allocated unit counts
  skipEgress?: boolean;            // Skip per-wing validation (global check later)
}
```

3. Calls `generateFloorplate()` which runs the full 14-step single-wing pipeline
4. Transforms the result from wing-local coordinates to world coordinates:

```
Wing-local: centered at (0, 0), x = -effectiveLength/2 .. +effectiveLength/2
Transform: rotate by wing.direction, translate by shifted wing center
Center shift = (geoOffsetLeft - geoOffsetRight) / 2 along wing direction
```

### Intersection Geometry

At each inner intersection, three geometric pieces are created:

```
  Wing A (horizontal)
  +==================+==========+
  |  units  | corr   | CORRIDOR |
  |         | wedge  |  WEDGE   |
  |         +---+====+===+------+
  |             |  INNER  |
  |             |  CORE   |
  |    CORNER   |         |
  |    UNIT     +---------+
  |             |  units  |
  +-------------+---------+
                  Wing B (vertical)
```

#### 1. Corner Unit (Outer Vertex)

- **Shape**: 8-point L-polygon with chamfered corners (1.5m offset for door opening)
- **Location**: At the outer building corner (`sOuter`)
- **Sizing**: Iterative search for symmetric leg lengths (d) targeting a specific unit area
- **Type**: Determined by best area fit to configured unit types

#### 2. Corridor Wedge (Miter Join)

- **Shape**: 4 corridor segments forming the miter junction
- **Segments**: Two quads per intersection (Segment A from wing A's bar end to miter point, Segment B from wing B's bar end to miter point)
- **Purpose**: Connects the corridors of adjacent wings smoothly

#### 3. Inner Core (Concave Zone)

- **Shape**: 6-point hexagonal polygon on the concave (inner) side
- **Points**: Bounded by the corridor inner edges of both wings and the inner facade line
- **Purpose**: Provides the core/utility zone at the intersection, replacing the end cores of guest wings

### Inner Side Detection

To determine which side of each wing faces inward (toward the other wing), the algorithm uses a **cross-product method** (not distance-based):

1. Compute `perpCCW(wingDir)` -- the perpendicular direction (counter-clockwise 90 degrees)
2. Check the dot product of this perpendicular with the vector from the wing center toward the intersection
3. If positive, the "North" side faces inward; if negative, "South" faces inward

This method is **rotation-invariant** and works for any wing orientation.

### Global Unit Mix Allocation

The multi-wing generator distributes units across wings in two passes:

1. **PASS 1 -- Corner Allocation**: Count exposed corners (wing ends not consumed by intersections). Allocate corner-eligible unit types (typically larger units) to these positions first.
2. **PASS 2 -- Proportional Distribution**: Distribute remaining unit counts proportionally by wing rentable area. Each wing receives a `unitInventory` mapping type to count.

This uses `calculateGlobalUnitCounts()` which applies the Largest Remainder Method across the entire building, then partitions the result per wing.

### Overlap Filtering

After all wing floorplates and intersection geometry are generated, the assembler:

1. Creates **reserve polygons** from inner core zones and corner unit footprints
2. Tests each unit and core from individual wings: if a unit's centroid falls inside a reserve polygon, it is removed
3. Converts inner core blocks into filler units (rendered with TwoBed coloring)

This ensures no visual overlap between wing-generated units and intersection-generated geometry.

---

## Design Mode: Line-to-Wing Conversion

**Module**: `src/extension/managers/design-manager.ts`

When a user draws a polyline in Design Mode, the system bypasses polygon footprint analysis entirely. Instead, `createAnalysisFromLine()` constructs a deterministic `MultiWingAnalysis` directly from the drawn segments:

- Each line segment becomes a wing (direction, length, width from user input)
- Each junction between consecutive segments becomes an intersection
- Intersection angle computed from the vectors of adjacent segments

**Why bypass polygon analysis?** The line-to-polygon buffering (miter-joint offset) can produce polygons whose Douglas-Peucker simplification or wing detection introduces artifacts. Direct line-to-wing mapping guarantees perfect detection for V-shapes, snake buildings, and courtyards.

- **2-point line** = simple bar -> `generateFloorplateVariants()`
- **3+ point line** = multi-wing -> `generateMultiWingFloorplateVariants()` with precomputed analysis
- **Closed line** (endpoints within 10cm) = courtyard shape

---

## Output Structure

```typescript
interface FloorPlanData {
  units: UnitBlock[];           // All apartment units
  cores: CoreBlock[];           // Elevator/stair cores
  fillers: FillerBlock[];       // Leftover space fillers (baked as CORE)
  corridor: CorridorBlock;      // Primary corridor
  buildingLength: number;
  buildingDepth: number;
  floorElevation: number;
  transform: {
    centerX: number;
    centerY: number;
    rotation: number;
  };
  stats: {
    gsf: number;                // Gross Square Feet
    nrsf: number;               // Net Rentable Square Feet
    efficiency: number;         // NRSF / GSF ratio
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
  corridorSegments?: CorridorBlock[];        // All corridor segments (replaces single corridor)
  corridorGraph?: { nodes: any[]; edges: any[] }; // For egress graph validation
  wingInfo?: {
    shape: string;
    wingCount: number;
    wings?: Array<{ id: number; length: number; width: number; center: {x,y}; direction: number }>;
  };
}

interface LayoutOption {
  id: string;
  strategy: OptimizationStrategy;
  floorplan: FloorPlanData;
  label: string;
  description: string;
}
```

## Performance Characteristics

| Metric | Typical Value |
|--------|---------------|
| Generation Time | < 100ms for 3 options (single wing) |
| Generation Time | < 300ms for 3 options (multi-wing) |
| Memory Usage | < 10MB |
| Unit Calculations | O(n) where n = unit count |
| Wall Alignment | O(n x m) for n x m units |

## Known Limitations

1. **All floors identical**: Multi-floor stacks the same layout; no per-floor variation
2. **No interior rooms**: Only demising walls, not bathroom/kitchen layouts
3. **US codes only**: Egress defaults are US-centric (IBC)
4. **Acute angles**: Wing intersections below ~50 degrees can produce large geometric offsets
5. **Courtyard egress**: Global egress validation for courtyard shapes is approximate

## Future Improvements

- Per-floor unit variation (different layouts on different floors)
- Interior room layouts (bathroom/kitchen placement)
- International building codes
- Curved wing support
- Parking level generation
