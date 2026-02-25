# Multi-Wing Generator: Execution Task List

> **For**: Junior engineers implementing the Scalable N-Wing Generator plan.
> **Reference**: `docs/planning/MULTI-WING-SCALABLE-PLAN.md` for full architecture.
> **Rule**: Complete tasks in order. Each task has a verification step — do not move on until it passes.

---

## Prerequisites

Before starting, read these files in order:
1. `docs/planning/MULTI-WING-SCALABLE-PLAN.md` — the full plan
2. `docs/planning/MULTI-WING-PROBLEM-SPEC.md` — problem context
3. `src/algorithm/types.ts` — all type definitions (focus on lines 289-367 for Wing types)
4. `src/algorithm/generator-core.ts` lines 1373-1430 — `WingGenerationOptions` and `generateFloorplate()` signature
5. `src/algorithm/wing-detection.ts` — `analyzeFootprint()` and what it returns
6. `test/fixtures/polygons.ts` — test polygon shapes (BAR, L, U, H)

Run `npx vitest run` to confirm all existing tests pass before you start.

---

## Phase 0: Surgical Fixes to Existing Files (3 tasks)

These are small, targeted changes to existing files that unblock the main rewrite.

### Task 0.1: Fix integration gate in generation-manager.ts

**File**: `src/extension/managers/generation-manager.ts`
**Lines**: 251-253

**Current code** (broken):
```typescript
const hasConcaveCorners = polygon.length > 4;
```

**What to do**:
1. Import `analyzeFootprint` from `../../algorithm/wing-detection` (or from `../../algorithm`)
2. Replace the gate logic:
```typescript
const wingAnalysis = analyzeFootprint(polygon);
const isMultiWing = !wingAnalysis.isSimpleBar && wingAnalysis.wings.length > 1;

if (isMultiWing) {
  generatedOptions = generateMultiWingFloorplateVariants(
    polygon, unitConfig, egressConfig, generatorOptions
  );
} else {
  generatedOptions = generateFloorplateVariants(footprint, unitConfig, egressConfig, generatorOptions);
}
```

**Why**: `polygon.length > 4` is a vertex-count heuristic that misroutes cases. A rectangle with simplification artifacts could have 5 vertices and get incorrectly sent to multi-wing. `analyzeFootprint()` does actual topology analysis.

**Verify**: Run `npx vitest run src/algorithm/generator-core.test.ts` — bar building tests must still pass (they go through the `else` branch).

---

### Task 0.2: Expand intersectionEnd to support both ends

**File**: `src/algorithm/generator-core.ts`

**Step 1** — Change the type definition (line 1385):
```typescript
// FROM:
intersectionEnd?: 'left' | 'right' | null;

// TO:
intersectionEnds?: ('left' | 'right')[];
```

**Step 2** — Update the consumption code (lines 1623-1624):
```typescript
// FROM:
const suppressLeftCorner = wingOptions?.intersectionEnd === 'left';
const suppressRightCorner = wingOptions?.intersectionEnd === 'right';

// TO:
const suppressLeftCorner = wingOptions?.intersectionEnds?.includes('left') ?? false;
const suppressRightCorner = wingOptions?.intersectionEnds?.includes('right') ?? false;
```

**Why**: An H-shape crossbar wing has intersections at BOTH ends. The old API could only suppress one end's corner behavior, leaking units into the inner corner zone on the other end.

**Verify**: Run `npx vitest run src/algorithm/generator-core.test.ts`. All existing tests must pass (they don't use `intersectionEnd` so the change is backward-compatible; the old field is simply removed).

---

### Task 0.3: Fix intersection connectivity in corridor graph

**File**: `src/geometry/graph.ts`
**Lines**: 49-57

**Current code** (broken):
```typescript
for (const ip of intersectionPoints) {
  findOrAddNode(ip, false);  // Adds node but NO edges
}
```

**What to do**: After adding all wing centerline edges, split edges at intersection points. Replace the intersection loop:

```typescript
// For each intersection point, find the closest wing centerline edge
// and split it (insert the intersection as a mid-edge node)
for (const ip of intersectionPoints) {
  const ipIdx = findOrAddNode(ip, false);

  // Find which edge this intersection point falls on
  // (closest edge where the point projects onto the segment)
  let bestEdge = -1;
  let bestDist = Infinity;
  for (let e = 0; e < edges.length; e++) {
    const [a, b] = edges[e];
    const pa = nodes[a].point;
    const pb = nodes[b].point;
    // Project ip onto segment pa-pb
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((ip.x - pa.x) * dx + (ip.y - pa.y) * dy) / len2));
    const projX = pa.x + t * dx;
    const projY = pa.y + t * dy;
    const d = Math.sqrt((ip.x - projX) ** 2 + (ip.y - projY) ** 2);
    if (d < bestDist) {
      bestDist = d;
      bestEdge = e;
    }
  }

  // If the intersection is close enough to an edge, split it
  if (bestEdge >= 0 && bestDist < 5.0) {  // 5m tolerance
    const [a, b, w] = edges[bestEdge];
    const dA = distance(nodes[a].point, ip);
    const dB = distance(nodes[b].point, ip);
    // Remove old edge, add two new sub-edges
    edges.splice(bestEdge, 1);
    edges.push([a, ipIdx, dA]);
    edges.push([ipIdx, b, dB]);
  }
}
```

**Why**: Without this, intersection points are isolated nodes in the graph. Dijkstra can't traverse through them, so egress distances are wrong (often `Infinity`) on branched/turned corridor networks.

**Verify**: Write a quick manual test: create a graph with 2 wing centerlines that meet at an intersection point. Verify `shortestPathToCore()` returns a finite distance traversing through the intersection.

---

## Phase 1: New Multi-Wing Generator — Types & Helpers (2 tasks)

From here on, you're building the new `src/algorithm/multi-wing-generator.ts` from scratch. **Delete the entire contents of the current file** and start fresh.

### Task 1.1: Write types and imports

**File**: `src/algorithm/multi-wing-generator.ts` (new contents)

Write the module header, imports, and internal type definitions:

```typescript
/**
 * Scalable N-Wing Floorplate Generator
 *
 * Generates multi-wing buildings by:
 * 1. Building a wing connectivity graph from wing detection
 * 2. BFS traversal to determine processing order
 * 3. Calling generateFloorplate() per wing as independent bars
 * 4. Creating corner geometry at each intersection
 * 5. Merging all results into a single FloorPlanData
 */

import {
  UnitType, UnitConfiguration, EgressConfig, FloorPlanData, LayoutOption,
  CoreBlock, UnitBlock, CorridorBlock, FillerBlock, OptimizationStrategy,
  BuildingFootprint
} from './types';
import type { Wing, WingIntersection } from './types';
import {
  DEFAULT_CORRIDOR_WIDTH, DEFAULT_CORE_WIDTH, DEFAULT_CORE_DEPTH,
  STRATEGY_LABELS, STRATEGY_DESCRIPTIONS, UNIT_COLORS
} from './constants';
import { generateFloorplate } from './generator-core';
import type { UnitColorMap, WingGenerationOptions } from './generator-core';
import { analyzeFootprint, MultiWingAnalysis } from './wing-detection';
import { polygonArea, ensureCounterClockwise } from '../geometry/polygon';
import { distance } from '../geometry/point';
import { lineIntersection } from '../geometry/line';
import { buildCorridorGraph, shortestPathToCore } from '../geometry/graph';
import { clipPolygonByLine } from '../geometry/clip';
import { Logger } from './utils/logger';
```

Then add the `MultiWingGeneratorOptions` interface (keep it identical to the old one for API compatibility):
```typescript
export interface MultiWingGeneratorOptions {
  corridorWidth?: number;
  coreWidth?: number;
  coreDepth?: number;
  coreSide?: 'North' | 'South';
  alignment?: number;
  strategy?: OptimizationStrategy;
  customColors?: Record<string, string>;
}
```

Then add internal types — copy from the plan's Section 1:
- `WingNode`
- `IntersectionEdge`
- `WingTask`
- `WingTransform`

**Verify**: File compiles with no TypeScript errors (`npx tsc --noEmit`).

---

### Task 1.2: Write geometry helpers

**File**: `src/algorithm/multi-wing-generator.ts` (append to file)

Add these pure functions:

```typescript
type Pt = { x: number; y: number };

function normalize(v: Pt): Pt { /* ... */ }
function addPt(a: Pt, b: Pt): Pt { /* ... */ }
function subPt(a: Pt, b: Pt): Pt { /* ... */ }
function scalePt(v: Pt, s: number): Pt { /* ... */ }
function dot(a: Pt, b: Pt): number { /* ... */ }
function perpCCW(v: Pt): Pt { return { x: -v.y, y: v.x }; }

function polyAreaAbs(pts: Pt[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

function applyTransform(pt: Pt, t: WingTransform): Pt {
  const cos = Math.cos(t.angle);
  const sin = Math.sin(t.angle);
  return {
    x: t.originX + pt.x * cos - pt.y * sin,
    y: t.originY + pt.x * sin + pt.y * cos
  };
}

function transformPolyPoints(pts: Pt[], t: WingTransform): Pt[] {
  return pts.map(p => applyTransform(p, t));
}
```

**Verify**: Write a quick unit test — `applyTransform({x:1, y:0}, {originX:0, originY:0, angle:Math.PI/2})` should return approximately `{x:0, y:1}`.

---

## Phase 2: Wing Graph & Traversal (3 tasks)

### Task 2.1: Implement buildWingGraph()

**File**: `src/algorithm/multi-wing-generator.ts` (append)

```typescript
function determineWingEnd(wing: Wing, point: Pt): 'left' | 'right' {
  const dir = { x: Math.cos(wing.direction), y: Math.sin(wing.direction) };
  const center = {
    x: (wing.bounds.minX + wing.bounds.maxX) / 2,
    y: (wing.bounds.minY + wing.bounds.maxY) / 2
  };
  const toPoint = subPt(point, center);
  return dot(dir, toPoint) >= 0 ? 'right' : 'left';
}

function buildWingGraph(analysis: MultiWingAnalysis): {
  nodes: Map<number, WingNode>;
  edges: IntersectionEdge[];
} {
  // 1. Create a WingNode for each wing
  // 2. For each INNER intersection, create an IntersectionEdge
  // 3. Determine endOfA/endOfB using determineWingEnd
  // 4. Register edges in both wings' edges maps
}
```

**Input**: `analysis` from `analyzeFootprint()`. Filter `analysis.intersections` to only `type === 'inner'`.

**Verify**: Test with `L_POLYGON` → should produce 2 nodes, 1 edge. Test with `U_POLYGON` → 3 nodes, 2 edges. Test with `H_POLYGON` → 3 nodes, 2 edges.

---

### Task 2.2: Implement chooseRootWing()

```typescript
function chooseRootWing(nodes: Map<number, WingNode>): number {
  // Pick longest leaf (degree 1). Tiebreaker: lowest wingId.
  // If no leaves (ring), pick longest overall.
}
```

**Verify**: For L-shape, should pick the longer wing. For U-shape, should pick a leaf wing (one of the side wings if they're longer, or the base).

---

### Task 2.3: Implement buildTaskList()

```typescript
function computeGeoOffset(buildingDepth: number, theta: number, wingLength: number): number {
  const raw = buildingDepth * Math.tan(theta / 2);
  return Math.min(raw, wingLength * 0.4);  // Clamp at 40%
}

function buildTaskList(
  nodes: Map<number, WingNode>,
  edges: IntersectionEdge[],
  rootWingId: number,
  analysis: MultiWingAnalysis
): WingTask[] {
  // BFS from root.
  // For each wing, compute:
  //   - effectiveLength = wing.length minus geoOffset for each intersection end
  //   - wingOptions: skipLeftEndCore, skipRightEndCore, intersectionEnds[], skipEgress
}
```

Key logic for `WingGenerationOptions`:
- For each edge connected to this wing, check which end it's on
- `skipLeftEndCore = true` if any edge is at the left end
- `skipRightEndCore = true` if any edge is at the right end
- `intersectionEnds` = array of all ends that have intersections (e.g. `['left', 'right']` for a crossbar)

**Verify**: For L-shape root wing: `skipRightEndCore=true, intersectionEnds=['right']`. For L-shape child wing: `skipLeftEndCore=true, intersectionEnds=['left']`. For an H-shape crossbar: `skipLeftEndCore=true, skipRightEndCore=true, intersectionEnds=['left','right']`.

---

## Phase 3: Per-Wing Bar Generation (2 tasks)

### Task 3.1: Implement generateWingBar()

```typescript
function generateWingBar(
  task: WingTask,
  config: UnitConfiguration,
  egressConfig: EgressConfig,
  corridorWidth: number,
  coreWidth: number,
  coreDepth: number,
  coreSide: 'North' | 'South',
  alignment: number,
  strategy: OptimizationStrategy,
  customColors?: UnitColorMap
): FloorPlanData {
  // 1. Create synthetic BuildingFootprint
  const footprint: BuildingFootprint = {
    width: task.effectiveLength,
    depth: task.wing.width,
    height: 0,
    centerX: task.effectiveLength / 2,
    centerY: task.wing.width / 2,
    rotation: 0,
    floorZ: 0,
    minX: 0,
    maxX: task.effectiveLength,
    minY: 0,
    maxY: task.wing.width
  };

  // 2. Call generateFloorplate
  return generateFloorplate(
    footprint, config, egressConfig,
    corridorWidth, coreWidth, coreDepth,
    coreSide, alignment, strategy,
    customColors, task.wingOptions
  );
}
```

**Verify**: Call with a simple task (effectiveLength=60m, width=20m, no intersections). Should return a valid `FloorPlanData` with units, cores, corridor. Compare with calling `generateFloorplate()` directly with the same footprint.

---

### Task 3.2: Implement computeWingTransform() and transformFloorPlanToWorld()

```typescript
function computeWingTransform(wing: Wing, geoOffsetAtLeft: number): WingTransform {
  const dir = { x: Math.cos(wing.direction), y: Math.sin(wing.direction) };
  const perp = perpCCW(dir);
  const center = {
    x: (wing.bounds.minX + wing.bounds.maxX) / 2,
    y: (wing.bounds.minY + wing.bounds.maxY) / 2
  };

  // Origin = wing center - half length along dir - half width along perp
  // Then shift by geoOffset along dir (to account for intersection trim at left end)
  return {
    originX: center.x - dir.x * wing.length / 2 - perp.x * wing.width / 2 + dir.x * geoOffsetAtLeft,
    originY: center.y - dir.y * wing.length / 2 - perp.y * wing.width / 2 + dir.y * geoOffsetAtLeft,
    angle: wing.direction
  };
}
```

`transformFloorPlanToWorld()` applies the transform to ALL geometry in a FloorPlanData:
- For each unit: transform `x,y` origin point, transform `polyPoints` if present, recompute bounding `width,depth`
- For each core: same
- For corridor: same
- For fillers: same
- Set `transform` on FloorPlanData to `{centerX:0, centerY:0, rotation:0}` (already in world coords)

**Verify**: Create a FloorPlanData with one unit at `{x:0, y:0, width:10, depth:5}`. Apply a 90-degree transform. Verify the unit's new coordinates are rotated correctly.

---

## Phase 4: Corner Geometry (3 tasks)

### Task 4.1: Implement createCornerUnit()

This is the most geometrically complex task. Follow the plan's Section 6 exactly.

**Inputs**: Inner intersection, the two wings, their rentable depths, corridor width, target 3BR area

**Algorithm**:
1. Find the outer vertex (convex corner). Either use the `outerZone` from the intersection data, or compute geometrically: reflect the inner (concave) vertex across the midline between the two wings' outer edges.
2. Get wing directions at the outer corner (outward from the vertex)
3. Initialize `cornerLeg = targetArea / avgRentableDepth`
4. Iterate 10 times:
   - Build 6-point polygon (P0 through P5 — see plan Section 6)
   - Compute area with `polyAreaAbs()`
   - If within 15% of target → accept
   - Else: `cornerLeg *= targetArea / area`
5. Create `UnitBlock` with `polyPoints`, `isLShaped: true`, `type: ThreeBed` (or TwoBed if area is smaller)
6. If bar edge extends beyond `cornerLeg + 15ft`, create rectangular filler `UnitBlock`s

**Verify**: Call with a 90-degree L-shape intersection where target area = 137 sq meters (approx 1475 sq ft). Verify:
- Returned polygon has 6 vertices
- Area is within 15% of target
- No NaN coordinates
- `polyAreaAbs(polygon) > 0`

---

### Task 4.2: Implement createCorridorWedge()

**Inputs**: Intersection, two wing transforms, corridor width

**Algorithm**:
1. Get Bar A's corridor end position in world coords (right edge of its corridor rectangle, transformed)
2. Get Bar B's corridor start position in world coords (left edge, transformed)
3. Compute the corridor wall extensions:
   - A's outer corridor wall extended past the intersection
   - B's outer corridor wall extended past the intersection
   - Their intersection point = `sCorrOuter`
   - Same for inner walls → `sCorrInner`
4. Build 6-point polygon: `[aCorrOuter, sCorrOuter, bCorrOuter, bCorrInner, sCorrInner, aCorrInner]`
5. **Self-intersection guard**: Check if miter distance (distance from corridor edge to apex) exceeds 2x corridor width. If so, replace apex with two bevel vertices.

**Verify**: For a 90-degree intersection with corridorWidth=1.83m, the wedge should have area > 0 and no self-intersecting edges.

---

### Task 4.3: Implement createInnerCore()

**Inputs**: Intersection (concave vertex), two wings, corridor width, rentable depths

**Algorithm**:
1. The inner core fills the concave "dark zone"
2. Polygon bounded by:
   - The concave vertex
   - The inner corridor walls of both wings, extended to meet
   - The inner facade lines (one per wing)
3. Typically 3-4 vertices (triangle or trapezoid)

**Verify**: For a 90-degree L-shape, the inner core should be roughly triangular with positive area.

---

## Phase 5: Validation & Assembly (2 tasks)

### Task 5.1: Implement validation functions

Three functions from plan Section 7:

**`validateUnitsInFootprint(units, wingRects)`**: Clip units against their parent wing's rectangle (convex), NOT the full footprint polygon. Use `clipPolygonByLine()` per edge of the wing rectangle (4 clips per unit = full convex clip).

**`validateCorridorWedge(wedgePoly, corridorWidth)`**: Check for self-intersections. If miter distance > 2x corridorWidth, bevel the apex.

**`ensureEgressCompliance(cores, wingTasks, corridorGraph, egressConfig)`**: Run Dijkstra from all corridor endpoints. If any distance exceeds limits, insert a mid-core on the longest segment. Repeat until compliant or 5 iterations.

**Verify**: Create a unit that extends 1m beyond its wing rectangle. Verify it gets clipped and its area is reduced.

---

### Task 5.2: Implement assembleFloorPlan()

Follow plan Section 8 exactly. This is mostly data merging:

1. Merge units, re-ID sequentially (`unit-0`, `unit-1`, ...)
2. Run `validateUnitsInFootprint()`
3. Check for overlaps (log warnings, don't crash)
4. Merge cores + inner cores
5. Run `ensureEgressCompliance()`
6. Build `corridorSegments` array
7. Compute stats: GSF (Shoelace on polygon), NRSF (sum unit areas), efficiency, unit counts
8. Build egress metrics using `buildCorridorGraph()` + `shortestPathToCore()`

**Verify**: Hand-assemble a mock FloorPlanData from 2 wing results + 1 corner unit + 1 corridor wedge + 1 inner core. Verify all units present, stats computed, egress metrics finite.

---

## Phase 6: Entry Points (1 task)

### Task 6.1: Implement main orchestrator and variant wrapper

**`generateMultiWingFloorplate()`** — the main function. Follow plan Section 9 pseudocode:
```
1. graph = buildWingGraph(wingAnalysis)
2. rootId = chooseRootWing(graph.nodes)
3. tasks = buildTaskList(...)
4. wingResults = tasks.map(t => {
     fpd = generateWingBar(t, ...)
     transform = computeWingTransform(t.wing, geoOffsetAtLeft)
     return transformFloorPlanToWorld(fpd, transform)
   })
5. For each inner intersection: create corner unit, corridor wedge, inner core
6. return assembleFloorPlan(...)
```

**`generateMultiWingFloorplateVariants()`** — the 3-strategy wrapper:
```
1. wingAnalysis = analyzeFootprint(polygon)
2. for strategy in ['balanced', 'mixOptimized', 'efficiencyOptimized']:
     result = generateMultiWingFloorplate(polygon, wingAnalysis, config, egressConfig, { ...options, strategy })
     options.push({ strategy, label, description, floorplan: result })
3. return options
```

**Make sure both functions are exported.** The index.ts already exports them.

**Verify**: Call `generateMultiWingFloorplateVariants()` with `L_POLYGON` from test fixtures. Should return 3 LayoutOptions, each with a non-null FloorPlanData.

---

## Phase 7: Tests (1 task, many test cases)

### Task 7.1: Write test file

**File**: `src/algorithm/multi-wing-generator.test.ts`

Import test polygons from `test/fixtures/polygons.ts` and configs from `test/fixtures/configs.ts`.

**Unit tests**:
1. `computeGeoOffset` — 90deg = depth, 120deg = depth*0.577, 60deg = depth*1.732, clamped at 40% of wing length
2. `buildWingGraph` — L: 2 nodes 1 edge, U: 3 nodes 2 edges, H: 3 nodes 2 edges
3. `chooseRootWing` — picks longest leaf
4. `buildTaskList` — BFS order, correct skipLeftEndCore/skipRightEndCore per task
5. `computeWingTransform` — origin at correct world position
6. Corner unit sizing — converges in ≤10 iterations, area within 15%

**Integration tests**:
7. L-shape: valid FloorPlanData, ≥1 corner unit, ≥2 cores, GSF ≈ polygon area (within 5%)
8. U-shape: valid FloorPlanData, 2 corner units, ≥2 cores
9. H-shape: valid FloorPlanData, 2 corner units
10. Egress: L-shape sprinklered, dead-end < 15.24m, travel distance < 76.2m
11. Corridor: corridorSegments.length ≥ 3 for L-shape
12. 3 variants: returns 3 LayoutOptions
13. No NaN/Infinity: all coordinates finite
14. Clipping: no unit outside footprint bounds
15. Snake (≥5 wings): create a synthetic zigzag polygon, verify connected corridors
16. Corridor wedge: all wedges have area > 0

**Verify**: `npx vitest run src/algorithm/multi-wing-generator.test.ts` — all tests pass.

---

## Phase 8: Final Verification (1 task)

### Task 8.1: Run full test suite and acceptance gates

1. `npx vitest run` — ALL tests pass (existing + new)
2. **G1 Bar parity**: `generator-core.test.ts` passes unchanged
3. **G2 No shape branches**: `grep -r "shape === " src/algorithm/multi-wing-generator.ts` returns 0 results
4. **G3 N≥5 wings**: Snake polygon test passes
5. **G4 Egress on graph**: L and U egress tests pass
6. **G5 Valid geometry**: Clipping and NaN tests pass
7. **G6 Polygon integrity**: Corridor wedge and corner unit area tests pass

If any gate fails, go back to the relevant task and fix it before proceeding.

---

## Summary: Task Count

| Phase | Tasks | Estimated Lines |
|-------|-------|----------------|
| Phase 0: Surgical fixes | 3 | ~40 lines across 3 files |
| Phase 1: Types & helpers | 2 | ~100 lines |
| Phase 2: Graph & traversal | 3 | ~140 lines |
| Phase 3: Per-wing generation | 2 | ~100 lines |
| Phase 4: Corner geometry | 3 | ~150 lines |
| Phase 5: Validation & assembly | 2 | ~120 lines |
| Phase 6: Entry points | 1 | ~80 lines |
| Phase 7: Tests | 1 | ~300 lines |
| Phase 8: Final verification | 1 | 0 (just running tests) |
| **Total** | **18 tasks** | **~1030 lines** |
