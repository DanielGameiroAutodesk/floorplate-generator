# Scalable N-Wing Generator: Implementation Plan

## Plan Comparison: This Plan vs. Compositional Plan

### Overview

Two plans were independently developed for multi-wing support:
- **This plan**: Graph-based BFS traversal + per-wing `generateFloorplate()` + explicit corner geometry
- **Compositional plan** (`multi-wing-compositional-plan`): Topology-driven zones + new placement engine + polygon clipping

Both plans share the same goal (scalable N-wing support without shape-specific code branches) but differ fundamentally in HOW units are placed.

### Side-by-Side Comparison

| Aspect | This Plan | Compositional Plan |
|--------|-----------|-------------------|
| **Unit placement** | Reuses `generateFloorplate()` per wing (2400 lines of proven code) | New "zone-driven placement engine" (unspecified algorithm) |
| **Files changed** | 1 file rewritten, 1 test file created | 6+ files modified (wing-detection, types, graph, renderer, bake, multi-wing-generator) |
| **Implementation detail** | Function signatures, data structures, pseudocode, line estimates | High-level bullet points, no algorithms |
| **Wing detection** | Reused as-is (862 lines, tested) | Refactored to "centerline/skeleton segments" |
| **Corner geometry** | Iterative wedge sizing (proven in reference repo) | Not specified |
| **Corridor junctions** | Explicit 6-point polygon + self-intersection guard | "Miter/bevel strategy" (not detailed) |
| **Core placement** | End cores + inner intersection cores + iterative mid-core insertion | "Iterative core insertion until egress passes" (similar intent) |
| **Polygon validation** | Clip against footprint + overlap checks | "Boolean-safe operations" (not detailed) |
| **Estimated scope** | ~650 lines new code | Unknown (no estimates) |
| **Risk profile** | Low — 1 file, leverages proven code | High — 6+ files, new placement engine |

### What the Compositional Plan Gets Right (Adopted)

1. **Polygon clipping against building boundary** — Added to Section 7 (`clipUnitsToFootprint`)
2. **Corridor self-intersection guards** — Added to Section 7 (`validateCorridorWedge`)
3. **Iterative core insertion for egress** — Added to Section 7 (`ensureEgressCompliance`)
4. **Acceptance gates** — Adopted as 6 explicit gates
5. **N≥5 wing testing** — Added snake polygon test case

### What the Compositional Plan Gets Wrong

1. **No implementation algorithm** — "Zone-driven unit placement engine" has no algorithm for how units are sized, distributed, and placed within zones. The flexibility model (Studios rigid, 3BRs elastic), wall alignment, core wrapping, corridor absorption, and optimal geometry search are all absent. These represent ~1500 lines of the bar generator that would need reimplementation.

2. **Refactors working code unnecessarily** — Phase 1 wants to refactor `wing-detection.ts` (862 lines, passing tests) to use "centerline/skeleton segments." The current detection already outputs wings, intersections, and adjacency — everything the graph needs. Refactoring introduces risk with no functional benefit.

3. **"Zone-driven placement" is what already failed** — The current broken `multi-wing-generator.ts` uses zones and `generateUnitSegment()` directly. The compositional plan proposes the same pattern ("allocate across graph edges, place in local frames, project to world, clip overlaps") without explaining what would be different. The root cause of failure was bypassing the bar generator's optimization pipeline, not the lack of zones.

4. **Doesn't leverage `generateFloorplate()`** — The bar generator handles: optimal corner length search (brute-force over hundreds of configs), weighted error distribution across flexible units, wall alignment snapping, core wrapping L-shapes, corridor void absorption, and egress validation. A new placement engine would need to replicate all of this or produce inferior results.

5. **Much larger blast radius** — Touching 6+ files (including renderer and bake) creates a large regression surface. The renderer and SVG component already handle `polyPoints` and `corridorSegments` — no changes needed.

### Why This Plan Is More Likely to Succeed

The key insight from the reference repository (`Floorplate-W-building`) is: **don't reinvent unit placement**. The bar generator already solves the hard optimization problem. The multi-wing generator's job is:
1. **Topology** — Build a connectivity graph, traverse it
2. **Geometry** — Compute geoOffset/steal per intersection, create corner units/corridor wedges/inner cores
3. **Orchestration** — Call bar generator per wing, transform to world, stitch results

This keeps the algorithmic complexity where it's already tested (the bar generator) and limits new code to geometric stitching (which is well-understood from the reference).

---

## Context

The current `multi-wing-generator.ts` (1094 lines) has failed repeatedly due to a complex bisector/penetration-depth approach with no unit clipping and coordinate confusion. A reference repository proves a simpler strategy works: **treat each wing as an independent bar, generate via the existing bar generator, then transform and stitch with explicit corner geometry**. However, the reference hardcodes separate L-shape and W-shape generators, which doesn't scale.

This plan combines the reference's proven geometric strategy with a **graph-based traversal** that handles any number of wings (L, U, H, snake, courtyard) with a single code path.

## Decisions Made

- **Rewrite `multi-wing-generator.ts` from scratch** (no refactoring)
- **Call `generateFloorplate()` per wing** (full 14-step pipeline, not low-level functions)
- **Generate in wing-local coordinates, then transform to world** (matches reference approach)

---

## File Changes

| File | Action |
|------|--------|
| `src/algorithm/multi-wing-generator.ts` | **Rewrite entirely** (~650 lines) |
| `src/algorithm/multi-wing-generator.test.ts` | **Create** new test file (~300 lines) |
| All other files | **No changes** |

The public API (`generateMultiWingFloorplate`, `generateMultiWingFloorplateVariants`, `MultiWingGeneratorOptions`) stays identical. No changes to `generation-manager.ts`, `renderer.ts`, `FloorplateSVG.ts`, `types.ts`, or `generator-core.ts`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              generateMultiWingFloorplate()           │
│                                                     │
│  1. Build wing connectivity graph                   │
│  2. BFS traversal → ordered task list               │
│  3. For each wing:                                  │
│     a. Compute effective length (minus geoOffset)   │
│     b. Create synthetic BuildingFootprint            │
│     c. Call generateFloorplate() with WingOptions    │
│     d. Transform result: local → world coords       │
│  4. For each intersection:                          │
│     a. Create corner unit (iterative wedge sizing)  │
│     b. Create corridor wedge (6-pt polygon)         │
│     c. Create inner core (concave fill)             │
│  5. Merge all results into single FloorPlanData     │
│  6. Compute GSF from polygon (Shoelace)             │
│  7. Validate egress globally (corridor graph)       │
└─────────────────────────────────────────────────────┘
```

---

## Module Structure (~650 lines total)

### Section 1: Types & Interfaces (~50 lines)

```typescript
// Reuse existing MultiWingGeneratorOptions interface

/** Wing adjacency graph node */
interface WingNode {
  wingId: number;
  wing: Wing;
  edges: Map<number, IntersectionEdge>;  // neighborWingId → edge
}

/** Wing adjacency graph edge (one per inner intersection) */
interface IntersectionEdge {
  index: number;                    // Index in intersections array
  intersection: WingIntersection;
  wingIdA: number;
  wingIdB: number;
  endOfA: 'left' | 'right';        // Which end of wing A faces this intersection
  endOfB: 'left' | 'right';        // Which end of wing B faces this intersection
}

/** Ordered task produced by BFS traversal */
interface WingTask {
  wingId: number;
  wing: Wing;
  parentWingId: number | null;
  parentEdge: IntersectionEdge | null;
  allEdges: IntersectionEdge[];     // All intersections this wing participates in
  effectiveLength: number;          // Wing length minus geoOffsets at intersection ends
  wingOptions: WingGenerationOptions;
}

/** Per-wing transform: local coords → world coords */
interface WingTransform {
  originX: number;    // World position of wing-local (0,0)
  originY: number;
  angle: number;      // Wing direction in radians
}
```

### Section 2: Geometry Helpers (~40 lines)

Small pure functions, mostly copied from existing codebase:

- `normalize(v)`, `addPt(a,b)`, `subPt(a,b)`, `scalePt(v,s)`, `dot(a,b)`, `perpCCW(v)` — vector math
- `polyAreaAbs(pts)` — Shoelace formula for polygon area
- `applyTransform(pt, transform)` — rotates then translates a point
- `transformPolyPoints(pts, transform)` — applies transform to array of points

### Section 3: Wing Graph Construction (~60 lines)

**`buildWingGraph(analysis: MultiWingAnalysis): { nodes, edges }`**

1. Create a `WingNode` for each wing
2. For each **inner** intersection (type === 'inner'), create an `IntersectionEdge`
3. Determine `endOfA`/`endOfB` using dot product: project intersection point onto wing direction from wing center. Positive = 'right' end, negative = 'left' end
4. Register edges in both connected wings' `edges` maps

**`determineWingEnd(wing, intersectionPoint): 'left' | 'right'`**
```
dir = (cos(wing.direction), sin(wing.direction))
toInter = intersectionPoint - wingCenter
dot(dir, toInter) >= 0 ? 'right' : 'left'
```

### Section 4: BFS Traversal & Task Planning (~80 lines)

**`chooseRootWing(nodes): wingId`**
- Pick the longest leaf node (degree 1 in the graph)
- Tiebreaker: lowest wing ID for deterministic output
- If no leaves (courtyard/ring), pick longest wing overall

**`buildTaskList(nodes, edges, rootWingId, analysis, config, options): WingTask[]`**

BFS from root:
1. For root wing: no parent, all edges are "child" edges
2. For each child wing discovered via BFS:
   - Record parent wing and connecting edge
   - Collect all edges this wing participates in
3. After BFS, compute per-wing properties:
   - **Effective length**: Start with `wing.length`. For each intersection edge at this wing, subtract `computeGeoOffset(wing.width, intersectionAngle)` from the appropriate end
   - **WingGenerationOptions**: `skipLeftEndCore` if left end has an intersection, `skipRightEndCore` if right end has an intersection, `intersectionEnd` for the first intersection end (or null), `skipEgress: true`

**`computeGeoOffset(buildingDepth, theta): number`**
```
return buildingDepth * Math.tan(theta / 2)
```

For a 90-degree intersection: `geoOffset = depth * tan(45°) = depth * 1.0`

### Section 5: Per-Wing Bar Generation (~50 lines)

**`generateWingBar(task: WingTask, config, egressConfig, options): FloorPlanData`**

1. Create synthetic `BuildingFootprint`:
   ```typescript
   const footprint: BuildingFootprint = {
     width: task.effectiveLength,    // corridor direction
     depth: task.wing.width,         // perpendicular to corridor
     height: 0,
     centerX: task.effectiveLength / 2,
     centerY: task.wing.width / 2,
     rotation: 0,                    // local coords, no rotation
     floorZ: 0,
     minX: 0, maxX: task.effectiveLength,
     minY: 0, maxY: task.wing.width
   };
   ```

2. Call `generateFloorplate(footprint, config, egressConfig, corridorWidth, coreWidth, coreDepth, coreSide, alignment, strategy, customColors, task.wingOptions)`

3. Return the `FloorPlanData` in wing-local coordinates

**`computeWingTransform(wing: Wing): WingTransform`**

Compute the world-space origin of the wing-local coordinate system:
```typescript
const dir = { x: cos(wing.direction), y: sin(wing.direction) };
const perp = perpCCW(dir);
const center = wingCenter(wing);
return {
  originX: center.x - dir.x * wing.length/2 - perp.x * wing.width/2,
  originY: center.y - dir.y * wing.length/2 - perp.y * wing.width/2,
  angle: wing.direction
};
```

**`transformFloorPlanToWorld(fpd: FloorPlanData, transform: WingTransform, geoOffsetAtLeft: number): FloorPlanData`**

Apply offset (shift X by geoOffset if the left end faces an intersection) then rotate+translate all units, cores, corridor, fillers from wing-local to world coordinates. For each element:
- Transform `x, y` via `applyTransform`
- Transform `polyPoints` array via `transformPolyPoints`
- Recompute bounding `width, depth` from transformed polygon

### Section 6: Corner Geometry at Intersections (~120 lines)

**`createCornerUnit(intersection, wingA, wingB, rentableDepthA, rentableDepthB, corridorWidth, targetArea, config): { unit: UnitBlock, fillers: UnitBlock[] }`**

Iterative wedge sizing (adapted from reference approach):

1. Compute outer vertex position (convex corner of the building polygon — the WingIntersection with type 'outer' for this pair of wings, or geometrically computed)
2. Compute wing directions `dirA`, `dirB` at the outer corner
3. Initial `cornerLeg = targetArea / avgRentableDepth`
4. For 10 iterations:
   - Build 6-point L-shaped polygon:
     - P0 = outer vertex (the convex corner)
     - P1 = P0 + dirA * cornerLeg (along wing A outer edge)
     - P2 = P1 + perpA * rentableDepthA (inward to corridor)
     - P3 = inner notch point (intersection of inner edges)
     - P4 = P0 + dirB * cornerLeg + perpB * rentableDepthB (inward to corridor along wing B)
     - P5 = P0 + dirB * cornerLeg (along wing B outer edge)
   - Compute area via Shoelace
   - If within 15% of target: accept
   - Otherwise: `cornerLeg *= targetArea / actualArea`
5. If edge length from bar end to outer vertex > cornerLeg + minFillerWidth, create rectangular filler units

**`createCorridorWedge(intersection, wingA, wingB, transformA, transformB, corridorWidth): CorridorBlock`**

6-point polygon connecting two bar corridors through the turn:
- Get end of Bar A's corridor (right edge) in world coords
- Get start of Bar B's corridor (left edge) in world coords
- Compute intersection points of corridor wall extensions (inner and outer walls)
- Vertices: `[aCorrOuter, sCorrOuter, bCorrOuter, bCorrInner, sCorrInner, aCorrInner]`
- Return `CorridorBlock` with `polyPoints`

**`createInnerCore(intersection, wingA, wingB, corridorWidth, rentableDepthA, rentableDepthB): CoreBlock`**

Fill the concave dark zone:
- The inner core polygon is bounded by the inner corridor walls of both wings extended to meet at the concave vertex
- Typically a triangle or trapezoid depending on the angle
- Return `CoreBlock` with `type: 'End'`, `polyPoints`

### Section 7: Validation & Clipping (~60 lines)

**`clipUnitsToFootprint(units: UnitBlock[], polygon: Pt[]): UnitBlock[]`**

After transforming wing results to world coordinates, clip any unit that extends beyond the building footprint polygon:
- For each unit, check if all vertices of its bounding rect (or polyPoints) lie inside the footprint polygon
- If not, use `clipPolygonByLine()` from `geometry/clip.ts` to trim the unit against the footprint boundary edges
- Recompute `area` from clipped polygon via Shoelace
- Skip units that clip to zero area

**`validateCorridorWedge(wedgePoly: Pt[], corridorWidth: number): Pt[]`**

Self-intersection guard for non-right-angle corridor turns:
- After computing the 6-point corridor wedge, check for self-intersection
- If the miter distance exceeds 2x corridor width (acute angle case), use a bevel join: replace the sharp apex vertex with two vertices that truncate the miter
- Return the cleaned polygon

**`ensureEgressCompliance(cores, wingTasks, corridorGraph, egressConfig): CoreBlock[]`**

Iterative core insertion:
1. Run `shortestPathToCore()` from all corridor endpoints
2. If max dead-end or travel distance exceeds limits, insert a mid-core on the longest corridor segment
3. Repeat until compliant or max iterations reached
4. This handles very long wings that need mid-cores beyond the initial end + intersection cores

### Section 8: Assembly (~60 lines)

**`assembleFloorPlan(wingResults, cornerUnits, corridorWedges, innerCores, polygon, analysis): FloorPlanData`**

1. Merge all units from wing results + corner units, re-ID sequentially
2. **Clip units against footprint polygon** (Section 7)
3. **Validate no unit-unit overlaps** — for each pair of adjacent units (same wing, same side), check bounding boxes don't overlap; log warning if they do
4. Merge all cores from wing results + inner cores
5. **Run iterative egress compliance** — insert mid-cores if needed
6. Corridor: first wing's corridor as primary `corridor` field, all corridors + wedges as `corridorSegments`
7. GSF = `polygonArea(polygon)` via Shoelace
8. NRSF = sum of all unit areas (post-clipping)
9. Efficiency = NRSF / GSF
10. Unit counts by type
11. Egress validation:
    - Build corridor centerlines from each wing's centerline (transformed to world)
    - Add intersection points as corridor graph vertices
    - Add core center positions
    - Call `buildCorridorGraph()` then `shortestPathToCore()` for all non-core nodes
    - `maxDeadEnd` = max distance from any corridor endpoint to nearest core
    - `maxTravelDistance` = max of all shortest paths

### Section 9: Entry Points (~70 lines)

**`generateMultiWingFloorplate(polygon, wingAnalysis, config, egressConfig, options): FloorPlanData`**

The main orchestrator:
```
1. graph = buildWingGraph(wingAnalysis)
2. rootId = chooseRootWing(graph.nodes)
3. tasks = buildTaskList(graph, rootId, wingAnalysis, config, options)
4. wingResults = tasks.map(t => {
     fpd = generateWingBar(t, config, egressConfig, options)
     transform = computeWingTransform(t.wing)
     return transformFloorPlanToWorld(fpd, transform, geoOffsetAtLeft)
   })
5. For each inner intersection:
     cornerUnit = createCornerUnit(...)
     corridorWedge = createCorridorWedge(...)
     innerCore = createInnerCore(...)
6. return assembleFloorPlan(wingResults, cornerUnits, corridorWedges,
   innerCores, polygon, wingAnalysis)
```

**`generateMultiWingFloorplateVariants(polygon, config, egressConfig, options): LayoutOption[]`**

Same 3-strategy loop as current code:
```
1. wingAnalysis = analyzeFootprint(polygon)
2. for strategy in ['balanced', 'mixOptimized', 'efficiencyOptimized']:
     fpd = generateMultiWingFloorplate(polygon, wingAnalysis, config,
       egressConfig, { ...options, strategy })
     layoutOptions.push({ strategy, label, description, floorplan: fpd })
3. return layoutOptions
```

---

## Why This Scales to Any Wing Count

The algorithm is **topology-agnostic**:

| Shape | Wings | Intersections | How it works |
|-------|-------|---------------|--------------|
| Bar | 1 | 0 | Detected as `isSimpleBar`, uses existing pipeline |
| L | 2 | 1 | BFS: root -> child. 1 corner unit, 1 corridor wedge, 1 inner core |
| U / W | 3 | 2 | BFS: root -> 2 children (or chain of 3). 2 corners |
| H | 3-5 | 2-4 | BFS: root (crossbar) -> branches. Each intersection handled identically |
| Snake | N | N-1 | BFS: linear chain. N-1 corners |
| Courtyard | N | N | BFS: spanning tree + 1 back-edge. Back-edge gets corner geometry only |

No new code is needed per shape. Adding a 10-wing snake building "just works" because the graph traversal processes each wing-intersection pair identically.

---

## What's Reused (No Changes)

- `generateFloorplate()` + `WingGenerationOptions` — `generator-core.ts:1392`
- `analyzeFootprint()` — `wing-detection.ts`
- `extractFootprintPolygon()` — `footprint-polygon.ts`
- `polygonArea()`, `ensureCounterClockwise()` — `geometry/polygon.ts`
- `lineIntersection()` — `geometry/line.ts`
- `buildCorridorGraph()`, `shortestPathToCore()` — `geometry/graph.ts`
- `distance()` — `geometry/point.ts`
- All types from `types.ts`, all constants from `constants.ts`
- Renderer (`renderer.ts`), SVG (`FloorplateSVG.ts`), generation manager (`generation-manager.ts`)
- Test fixtures (`test/fixtures/polygons.ts`, `test/fixtures/meshes.ts`)

---

## Tests (`src/algorithm/multi-wing-generator.test.ts`)

### Unit tests:
1. **`computeGeoOffset`** — 90 deg -> depth, 120 deg -> depth x 0.577, 60 deg -> depth x 1.732
2. **`buildWingGraph`** — L_POLYGON: 2 nodes, 1 edge; U_POLYGON: 3 nodes, 2 edges; H_POLYGON: 3 nodes, 2 edges
3. **`chooseRootWing`** — picks longest leaf for L/U; picks any leaf for H
4. **`buildTaskList`** — correct BFS order, correct `skipLeftEndCore`/`skipRightEndCore` per task
5. **`computeWingTransform`** — transform origin matches wing top-left corner in world coords
6. **Corner unit sizing** — converges within 10 iterations, area within 15% of target

### Integration tests:
7. **L-shape generation** — `L_POLYGON`: valid FloorPlanData, >=1 corner unit, >=2 cores, GSF ~ polygon area
8. **U-shape generation** — `U_POLYGON`: valid FloorPlanData, 2 corner units, >=2 cores
9. **H-shape generation** — `H_POLYGON`: valid FloorPlanData, 2 corner units, correct wing count
10. **Egress compliance** — L-shape with sprinklered config: dead-end < 50ft, travel distance < 250ft
11. **Corridor continuity** — corridorSegments includes per-wing corridors + wedges
12. **3-strategy variants** — returns 3 LayoutOptions
13. **No NaN/Infinity** — all unit coordinates are finite numbers after transform
14. **Footprint clipping** — no unit bounding box extends outside footprint polygon bounds
15. **Snake polygon (>=5 wings)** — synthetic zigzag polygon generates connected corridor, all wings populated (Gate G3)
16. **Corridor wedge validity** — all corridor wedge polygons have area > 0 and no self-intersections

---

## Acceptance Gates

| Gate | Criteria | How to Verify |
|------|----------|---------------|
| **G1: Bar parity** | Simple bar buildings produce identical output via existing pipeline | Run `generator-core.test.ts`, compare FloorPlanData |
| **G2: No shape branches** | L/U/H all go through the same code path (no `if shape === 'L'`) | Code review: grep for shape-specific branches |
| **G3: N>=5 wings** | A 5+ wing synthetic polygon generates connected corridors and valid units | Test with snake polygon fixture |
| **G4: Egress on graph** | Dead-end and travel distance measured on corridor graph, pass sprinklered limits | Integration test with L and U polygons |
| **G5: Valid geometry** | No unit extends outside footprint polygon, no NaN/Infinity, no self-intersecting corridor wedges | Clip validation + coordinate sanity checks |
| **G6: Polygon integrity** | Corridor wedge, corner unit, and inner core polygons are non-degenerate | Shoelace area > 0 for all polygons |

---

## Verification

1. `npx vitest run` — all existing bar building tests pass unchanged
2. `npx vitest run src/algorithm/multi-wing-generator.test.ts` — new tests pass
3. Manual in Forma: L-shaped building -> valid layout with corner unit and connected corridors
4. Manual in Forma: U-shaped building -> 3-wing layout with 2 corners
5. Manual in Forma: simple bar -> existing pipeline, no regression

---

## Implementation Order

1. Types and geometry helpers (Section 1-2)
2. Wing graph construction (Section 3)
3. BFS traversal and task planning (Section 4)
4. Per-wing bar generation + transform (Section 5)
5. Corner geometry: corner unit, corridor wedge, inner core (Section 6)
6. Validation and clipping (Section 7)
7. Assembly and egress (Section 8)
8. Entry points (Section 9)
9. Tests
10. Verify all existing tests still pass
