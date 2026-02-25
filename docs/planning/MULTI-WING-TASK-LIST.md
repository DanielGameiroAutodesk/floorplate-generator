# Multi-Wing Intersection: Verified Learnings & Remaining Bugs

> **Date**: 2026-02-25 (updated)
> **Status**: Multiple debugging sessions complete. Core architecture works (wing detection, BFS, per-wing bar generation, transforms). The remaining bugs are all in the **intersection zone geometry** — specifically the **core polygon shape** and **corridor segment topology**.

---

## Architecture Overview (Working)

The multi-wing generator uses this pipeline:

```
analyzeFootprint(polygon)
  → wings[], intersections[]
    → buildWingGraph() → BFS → WingTask[]
      → per wing: generateFloorplate() → transformFloorPlanToWorld()
      → per intersection: createCornerUnit() + createCorridorWedge() + createInnerCore()
        → assembleFloorPlan() → FloorPlanData
```

**What works:**
- Wing detection correctly identifies wings, directions, widths, lengths
- BFS traversal produces correct task ordering with geoOffsets
- Per-wing bar generation produces valid apartments, cores, corridors
- Wing transforms correctly place bars in world coordinates
- The overall FloorPlanData structure is consumed by renderer.ts and FloorplateSVG.ts

**What's broken:** The intersection zone — the ~20m × ~20m area where two wings meet. This includes the corridor turn, corner unit, inner core, and how they're all stitched together. See **Bug 8** for the latest user-validated specification.

---

## Bug 8: Core Polygon Shape & Corridor Segment Topology (LATEST — user-annotated)

### Context

The user annotated a screenshot of the non-orthogonal (angled) wing intersection showing the CORE polygon and surrounding corridor. This is the definitive specification for how the intersection geometry should work.

### Reference Screenshot Analysis

The annotated screenshot labels:
- **Point 1**: Where the corridor centerline meets the **facade** (outer building edge) at the intersection
- **Point 2**: Where the corridor centerline meets the **corridor** on the inner side at the intersection
- **Segments A, B, C, D**: Four corridor segments around the core polygon

### Correct Core Polygon Construction

The core polygon is defined by **two key points** and **four corridor segments**:

1. **Point 1** (facade-corridor intersection): The point where the corridor boundary lines intersect the facade/outer building edge at the intersection. This is at the *outer* side of the building where it bends.

2. **Point 2** (corridor-corridor intersection): The point where the corridor boundary lines intersect each other on the *inner/concave* side of the building bend. This is where the corridor turns the corner.

3. The core polygon vertices connect these two points through the corridor inner edges of both wings, forming the dark core shape.

### Correct Corridor Segment Topology

There are exactly **four corridor segments** at an intersection, NOT a single 6-point miter polygon:

- **Segment C** (along the corridor, Wing B side): Runs along the corridor on Wing B's side, connecting to **Point 2**
- **Segment D**: Connects from the Wing B side to **Point 2** (along the corridor on the concave/inner side)
- **Segment A** (along the corridor, Wing A side): Runs from **Point 2** to **Point 1** along the outer/facade side of the bend
- **Segment B** (along the corridor, Wing A side): Runs from **Point 2** to **Point 1** along the inner side of the bend

The key insight: **Point 2 connects to Point 1** via segments A and B (which run along the corridor). Segments C and D connect to Point 2 on the Wing B side.

### What This Means for Implementation

The current `createCorridorWedge()` produces a single 6-point mitered polygon plus two rectangular extensions. This is wrong. Instead:

1. **The corridor through the intersection should be split into discrete segments** that connect at the two key points (facade intersection and corridor intersection).
2. **The core polygon is NOT a free-form shape** — it's bounded by the corridor inner edges on both sides and the two key points.
3. **The segments should follow the corridor edges**, not cut across them with miter diagonals.

### Geometric Construction

For a non-orthogonal intersection at angle θ between two wings:

```
Point 1 = intersection of corridor outer edges with facade lines
        = where the building "bends" on the outer/convex side
        
Point 2 = intersection of corridor inner edges from both wings
        = the "inner miter" point (sCorrInner in current code)
        = where the corridor turns on the concave side

Core polygon = [
  Point 1,                    // facade-corridor intersection
  Wing A corridor inner edge  // along wing A to...
  Point 2,                    // corridor-corridor intersection
  Wing B corridor inner edge  // along wing B back to...
  ... closing back to facade  // completes the core shape
]

Corridor segments:
  C,D: Wing B corridor edges → Point 2
  A,B: Point 2 → Point 1 (through the bend)
```

### Current State vs Correct State

**Current (wrong):**
- Core polygon has 5-6 vertices derived from facade miter + corridor miter + inner facade intersection
- Core shape is an irregular pentagon/hexagon that doesn't align with corridor edges
- Single 6-point corridor wedge polygon through the bend

**Correct (per user annotation):**
- Core polygon bounded by corridor inner edges on both wing sides
- Core vertices pass through exactly two key points (facade intersection + corridor intersection)
- Four discrete corridor segments connecting at the two key points
- Segments follow corridor width consistently through the bend

---

## Bug 1: Corridor Self-Intersection (CRITICAL — blocks visual continuity)

### Symptom
The corridor from Wing A stops at the wing bar end (x=20 for L_POLYGON). The corridor from Wing B starts at its bar end (y=32). There's a ~23m gap in between with no visible corridor. The miter polygon that was supposed to fill this gap self-intersects and gets beveled into garbage.

### Root Cause Analysis (Verified with Coordinate Traces)

For L_POLYGON `[(0,0), (60,0), (60,20), (20,20), (20,50), (0,50)]`:

**Wing detection output:**
- Wing 0: direction=0°, center=(30,10), width=20, length=60
- Wing 1: direction=-90°, center=(10,35), width=20, length=30
- Intersection: point=(20,20), angle=90°, type='inner'

**geoOffset computation:**
- θ = 90° (angle between away-from-intersection directions)
- geoOffsetA = 20 × tan(45°) = 20m (capped at min(20, 60×0.4=24) = 20)
- geoOffsetB = 20 × tan(45°) = 20m (capped at min(20, 30×0.4=12) = **12**)

**Wing transforms (after trimming):**
- Wing 0: effectiveLength=40, origin=(40,10), angle=0
- Wing 1: effectiveLength=18, origin=(10,41), angle=-π/2

**Inner side detection:**
- innerSideA = +1 (Wing A's inner side faces toward +Y, i.e., toward the concave vertex at y=20)
- innerSideB = -1 (Wing B's inner side faces toward -Y in local coords)

**Corridor boundary points at bar ends (world coords):**
```
aCorrOuterWorld = (20, 9.086)    — Wing A bar end, outer corridor edge
aCorrInnerWorld = (20, 10.914)   — Wing A bar end, inner corridor edge
bCorrOuterWorld = (10.914, 32)   — Wing B bar end, outer corridor edge
bCorrInnerWorld = (9.086, 32)    — Wing B bar end, inner corridor edge
```

**Miter points (line-line intersections of corridor boundary lines):**
```
sCorrOuter = (10.91, 9.09)   — where Wing A outer (y=9.086) meets Wing B outer (x=10.914)
sCorrInner = (9.09, 10.91)   — where Wing A inner (y=10.914) meets Wing B inner (x=9.086)
```

### Why the Original Miter Polygon Self-Intersects

The original 6-point miter polygon was:
```
p0=(20, 9.086)    — aCorrOuterWorld
p1=(10.91, 9.09)  — sCorrOuter (miter point)
p2=(10.914, 32)   — bCorrOuterWorld
p3=(9.086, 32)    — bCorrInnerWorld
p4=(9.09, 10.91)  — sCorrInner (miter point)
p5=(20, 10.914)   — aCorrInnerWorld
```

**Edge p1→p2** `(10.91, 9.09)→(10.914, 32)` is nearly vertical at x≈10.914, spanning y=9 to y=32.
**Edge p4→p5** `(9.09, 10.91)→(20, 10.914)` is nearly horizontal at y≈10.914, spanning x=9 to x=20.

These two edges **cross at approximately (10.91, 10.91)** because:
- Edge p1→p2 at y=10.91 has x≈10.912 (within segment)
- Edge p4→p5 at x=10.912 has y≈10.912 (within segment)
- Both t-parameters are in (0, 1) → genuine intersection

The `validateCorridorWedge()` function detects this and "bevels" it, but the bevel formula just averages midpoints and produces garbage:
```
Actual output after bevel:
p0: (20, 9.086), p1: (15.457, 9.086), p2: (10.914, 9.086),
p3: (10.914, 32), p4: (10, 32), p5: (9.086, 32)
```
This is a degenerate thin shape — the corridor vanishes.

### Why the "Bevel Point" Fix Also Fails

An attempt was made to replace miter points with perpendicular projections ("bevel points"):
```
outerBevel = project aCorrOuter onto Wing B outer line → (10.914, 9.086)
innerBevel = project bCorrInner onto Wing A inner line → (9.086, 10.914)
```

The resulting polygon:
```
(20, 9.086) → (10.914, 9.086) → (10.914, 32) → (9.086, 32) → (9.086, 10.914) → (20, 10.914)
```

This ALSO self-intersects! **Edge (10.914, 9.086)→(10.914, 32)** crosses **Edge (9.086, 10.914)→(20, 10.914)** at point **(10.914, 10.914)**. The fundamental problem: the vertical arm of the L goes through the horizontal arm.

### The Correct Fix: Cross-Corner Polygon

A valid non-self-intersecting L-shaped corridor requires using **cross-corner points** instead of miter or bevel points:

```typescript
// Cross-corner: where Wing A OUTER meets Wing B INNER line
const crossCorner = llIntersect(aCorrOuterWorld, dirA, bCorrInnerWorld, dirB);
// = (9.086, 9.086) for L_POLYGON

// Inner notch: where Wing B OUTER meets Wing A INNER line
const innerNotch = llIntersect(bCorrOuterWorld, dirB, aCorrInnerWorld, dirA);
// = (10.914, 10.914) for L_POLYGON

const corridorPoly = [
  aCorrOuterWorld,   // (20, 9.086)
  crossCorner,       // (9.086, 9.086)  ← outer corner of the turn
  bCorrInnerWorld,   // (9.086, 32)     ← Wing B inner at bar end
  bCorrOuterWorld,   // (10.914, 32)    ← Wing B outer at bar end
  innerNotch,        // (10.914, 10.914) ← inner notch of the L
  aCorrInnerWorld    // (20, 10.914)    ← Wing A inner at bar end
];
```

**Verified: no self-intersection.** All edges are axis-aligned for 90° angles:
- Edge 0: y=9.086, x=[9.086→20] (horizontal)
- Edge 1: x=9.086, y=[9.086→32] (vertical)
- Edge 2: y=32, x=[9.086→10.914] (horizontal)
- Edge 3: x=10.914, y=[32→10.914] (vertical)
- Edge 4: y=10.914, x=[10.914→20] (horizontal)
- Edge 5: x=20, y=[10.914→9.086] (vertical)

No non-adjacent edges can cross because they're on different axis values.

**Area = 58.5 sqm** (correct L-shape covering both corridor arms + overlap square).

**General formula for any angle:**
```typescript
crossCorner = llIntersect(aCorrOuterWorld, dirA, bCorrInnerWorld, dirB);
innerNotch  = llIntersect(bCorrOuterWorld, dirB, aCorrInnerWorld, dirA);
```

### Superseded by Bug 8
The cross-corner approach solves self-intersection but still models the corridor as a single polygon. Bug 8 (user annotation) reveals the correct approach is **four discrete corridor segments** connecting at two key points, NOT a single L-shaped polygon. The cross-corner math is still useful for computing the key points.

---

## Bug 2: Unit Colors Render Gray in 3D (Forma Renderer)

### Symptom
All wing-bar units (from `generateFloorplate()`) render as gray in the 3D Forma mesh. Only corner units with hex colors render correctly.

### Root Cause
`generator-core.ts` produces unit colors in `rgba()` format:
```
color: "rgba(249, 115, 22, 0.7843137254901961)"
```

But `renderer.ts:parseHexColor()` (line 47) only accepts `#RRGGBB` format:
```typescript
const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
// Returns { r:128, g:128, b:128, a:200 } (gray fallback) for rgba() strings
```

### Fix Options
**Option A (renderer.ts):** Extend `parseHexColor` to also parse `rgba(r, g, b, a)` strings.
**Option B (generator-core.ts):** Change the color assignment to output hex format.
**Option C (multi-wing-generator.ts):** Convert colors when assembling the floorplan.

Option A is safest — add a second regex for rgba:
```typescript
function parseHexColor(color: string): { r, g, b, a } {
  // Try hex first
  const hex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (hex) return { r: parseInt(hex[1],16), g: parseInt(hex[2],16), b: parseInt(hex[3],16), a: 200 };

  // Try rgba()
  const rgba = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: 200 };

  return { r: 128, g: 128, b: 128, a: 200 }; // gray fallback
}
```

### Evidence
Diagnostic output for L_POLYGON shows mixed color formats:
```
unit-1 3BR color=rgba(168, 85, 247, 0.784...)   ← from generateFloorplate() — renders GRAY
unit-13 3BR color=#a855f7                         ← corner unit hex fix — renders PURPLE
inner-fill-14 2BR color=#f97316                   ← inner core conversion — renders ORANGE
```

---

## Bug 3: Corner Unit Has Zero Available Length (availA=0)

### Symptom
Debug log: `Corner unit availA=0.00, availB=32.00, cornerLeg=2.00`. The corner unit is tiny (46 sqm instead of target ~137 sqm for 3BR) because it can only extend along Wing B, not Wing A.

### Root Cause
`createCornerUnit()` computes `availA = distance(sOuter, aOuterFacadeWorld)`:
- `sOuter = (20, 0)` — outer facade miter point
- `aOuterFacadeWorld = (20, 0)` — Wing A outer facade at bar end (after geoOffset trimming)
- These are the SAME POINT → `availA = 0`

The geoOffset trims 20m from Wing A, so the bar starts at x=20. The outer facade miter also lands at x=20. The corner unit has no room to extend along Wing A's outer edge.

### Fix
Use the **far reference points** (at the original untrimmed wing boundary) instead of the bar-end points:
```typescript
// Instead of:
const availA = distance(sOuter, aOuterFacadeWorld);  // = 0!

// Use:
const availA = distance(sOuter, aFarOuterFacade);    // = distance((20,0), (0,0)) = 20m ✓
```

The far points already exist in `IntersectionJoinGeometry`:
```
aFarOuterFacade = (0, 0)     — Wing A outer facade at original boundary
bFarOuterFacade = (20, 20)   — Wing B outer facade at original boundary
```

---

## Bug 4: Massive "1BR" Corner Filler (272 sqm)

### Symptom
`corner-fill-15` is a 1BR unit with area=272.6 sqm at coordinates (10.91, 2) to (20, 32). This is the "massive 1bdr unit in the inner side of the corner" the user reported.

### Root Cause
In `assembleFloorPlan()` (line ~1209), corner fillers are converted to OneBed apartment-colored UnitBlocks. But the corner filler was created by `createCornerUnit()` as a rectangular fill covering the entire area between the tiny corner unit and the wing edge. Because `availA=0` (Bug 3), the corner unit is tiny and the filler covers almost the entire intersection zone.

### Fix
- Fix Bug 3 first (corner unit uses far points → larger corner unit → smaller filler)
- Corner fillers should NOT be converted to apartment units. They are gap-fill areas that should either:
  - Remain as dark core blocks (current `fillersToCoreBlocks()` behavior in renderer)
  - Be subdivided into properly-sized apartment units
  - Or simply not be emitted if they overlap with the corridor/corner-unit

---

## Bug 5: Inner Core Converted to Apartment (Wrong)

### Symptom
`inner-fill-14` is a 2BR unit with area=9.9 sqm. It's the inner core (concave dark zone) being converted to a TwoBed apartment in `assembleFloorPlan()`.

### Root Cause
In a previous debugging session, inner cores and corner fillers were reclassified from dark CoreBlocks to colored apartment UnitBlocks to make the intersection visible. The intent was correct (the concave zone IS apartment space, not a massive elevator core) but the implementation is wrong:
- 9.9 sqm is far too small for any real apartment
- The inner core's 6-point polygon shape isn't suitable as a single apartment
- It should either be merged with adjacent units or left as unfilled

### Fix
Revert the inner core → apartment conversion. Instead:
- Keep inner cores as CoreBlocks for rendering (they'll be dark gray)
- OR clip them properly and merge into adjacent unit segments

---

## Bug 6: GSF / NRSF / Efficiency Are NaN/Undefined

### Symptom
```
GSF: undefined | NRSF: undefined
Efficiency: NaN%
```

### Root Cause
The `assembleFloorPlan()` function computes stats but the field names may not match what the diagnostic script expects, or the Shoelace area computation on the polygon returns the wrong value.

### Fix
Check `assembleFloorPlan()` return value field names. The FloorPlanData type has `grossSquareFootage`, `netRentableSquareFootage`, `efficiency` — verify these are set correctly.

---

## Bug 7: Debug fetch() to localhost:7244

### Status: FIXED
Removed the stale `fetch('http://127.0.0.1:7244/...')` call from `multi-wing-generator.ts` line ~1466 that was spamming `ERR_CONNECTION_REFUSED` in the browser console.

---

## Verified Coordinate Reference (L_POLYGON)

These coordinates are verified by running diagnostics with the actual code:

```
L_POLYGON: [(0,0), (60,0), (60,20), (20,20), (20,50), (0,50)]
Area: 1800 sqm

Wing 0 (horizontal): dir=0°, center=(30,10), w=20, len=60
Wing 1 (vertical):   dir=-90°, center=(10,35), w=20, len=30

geoOffset: A=20m, B=12m
effectiveLength: A=40m, B=18m
Transform A: origin=(40,10), angle=0
Transform B: origin=(10,41), angle=-π/2

innerSideA=+1, innerSideB=-1

Corridor points at bar ends:
  aCorrOuter = (20, 9.086)     aCorrInner = (20, 10.914)
  bCorrOuter = (10.914, 32)    bCorrInner = (9.086, 32)

Miter points (NOT usable for polygon — cause self-intersection):
  sCorrOuter = (10.91, 9.09)
  sCorrInner = (9.09, 10.91)

Cross-corner points (USE THESE for corridor polygon):
  crossCorner = (9.086, 9.086)     — llIntersect(aCorrOuter,dirA, bCorrInner,dirB)
  innerNotch  = (10.914, 10.914)   — llIntersect(bCorrOuter,dirB, aCorrInner,dirA)

Facade points:
  sOuter = (20, 0)                 — outer facade miter (building corner)
  sInnerFacade = (0, 20)           — inner facade miter (concave vertex)

Far reference points (at original wing boundary):
  aFarOuterFacade = (0, 0)         — Wing A outer at untrimmed boundary
  bFarOuterFacade = (20, 20)       — Wing B outer at untrimmed boundary

Wing A bar corridor: (20, 9.086) to (50.389, 10.914)
Wing B bar corridor: (9.086, 48.089) to (10.914, 32)
```

---

## Key Geometry Lessons Learned

### 1. Miter Points ≠ Polygon Vertices
Line-line intersection of two corridor edge lines produces miter points that are geometrically correct for infinite lines but create self-intersecting polygons when used as vertices connecting bar-end points. The edges from the miter to the far bar ends cross because the miter point is at the "elbow" of the L-shape, and the connecting edges pass through the interior.

### 2. Bevel Points Also Fail for 90° Turns
Perpendicular projections (bevel points) produce vertices at the same position as the actual right-angle corners. But the polygon still self-intersects because `edge(outerBevel → bCorrOuter)` is vertical and `edge(innerBevel → aCorrInner)` is horizontal, and they cross at the corner point.

### 3. The Correct Approach: Cross-Corner + Inner-Notch
Use `llIntersect(aCorrOuter, dirA, bCorrInner, dirB)` (cross one wing's outer with the other's inner) to get the outer corner of the turn. Use `llIntersect(bCorrOuter, dirB, aCorrInner, dirA)` for the inner notch. The resulting 6-point polygon traces the L-shape boundary without any edge crossing interior space.

### 4. Wing Direction Can Be Negative
Wing 1 in L_POLYGON has `direction = -π/2` (not `+π/2`). This means `dirB = (0, -1)`. Many coordinate computations depend on this sign. The `awayB` computation correctly handles this by checking dot product with center-to-intersection vector.

### 5. parseHexColor Only Handles #RRGGBB
The renderer's color parser doesn't handle rgba() strings from generator-core.ts. All wing-bar units render as gray. This is independent of the intersection geometry bugs.

### 6. geoOffset Is Capped at 40% of Wing Length
Wing B (30m) gets geoOffset capped at 12m (not 20m). This asymmetry means the intersection geometry is not symmetric — Wing A and Wing B have different trim amounts, different bar start positions, and different far reference points.

### 7. polyAreaAbs Uses Standard Shoelace — Self-Intersecting Polygons Give Wrong Areas
The Shoelace formula only gives correct results for simple (non-self-intersecting) polygons. The self-intersecting miter polygon's reported area (~83 sqm) is geometrically meaningless. A valid cross-corner polygon covering the same region has area ~58.5 sqm.

### 8. fillersToCoreBlocks Converts ALL Fillers to Dark Blocks
In `renderer.ts`, ALL fillers become dark gray CoreBlocks. This is correct for wing-bar fillers (small gap fills) but wrong for the massive corner filler (272 sqm "1BR"). The fix is to not create massive corner fillers in the first place (see Bug 3/4).

### 9. Core Polygon Is Defined by Two Key Points, Not Arbitrary Miter Geometry (NEW)
The core polygon at an intersection is bounded by exactly **two key points**:
- **Point 1**: Intersection of corridor boundary with the facade (outer/convex side of the bend)
- **Point 2**: Intersection of corridor inner edges from both wings (inner/concave side of the bend)

The core shape is traced by following the corridor inner edges from Point 1 through Wing A's corridor inner boundary to Point 2, then through Wing B's corridor inner boundary back to Point 1. This is fundamentally different from the current approach of using miter/facade intersections to construct a free-form polygon.

### 10. Corridor Segments Are Discrete, Not a Single Polygon (NEW)
The corridor through an intersection consists of **four discrete segments** (A, B, C, D), not a single 6-point polygon. These segments connect at the two key points:
- Segments C & D connect to Point 2 on the Wing B side (along the corridor)
- Segments A & B connect Point 2 to Point 1 (through the bend, along the corridor)

This means `createCorridorWedge()` should emit individual corridor segments that follow the corridor width consistently, not a single mitered/cross-cornered polygon.

### 11. Reference Repo Uses Pivot-Based Construction (from prior investigation)
The reference repo (`Floorplate-W-building/services/layoutGenerator.ts`) constructs all three intersection pieces (corridor wedge, inner core, corner unit) in a shared coordinate frame using:
- A pivot point at the building inner corner
- Line-line intersections along known directions
- Iterative area sizing for the corner unit
This ensures corridor/core/unit edges are perfectly flush — zero gaps, zero overlaps.

### 12. Intersection Geometry Must Be Constructed in a Shared Coordinate Frame
The root cause of most intersection bugs is that corridor endpoints, core wedge vertices, and corner unit boundaries were computed independently using different coordinate reference points. The reference approach computes all landmarks from the same set of boundary lines, guaranteeing edge alignment.

---

## Reference Repo Intersection Approach (from Floorplate-W-building)

The reference constructs intersection geometry as **three coordinated pieces** derived from the same set of landmark points:

1. **6-point corridor miter polygon**: Connects Wing A's corridor end to Wing B's corridor start through the miter intersection of the corridor top/bottom lines.

2. **5-point inner core wedge polygon**: Fills from Wing A's inner facade to the corridor inner miter to Wing B's inner facade. This is the pentagonal dark zone on the concave side.

3. **Outer corner unit + fillers**: Fills the outer wedge from the building outer edges down to the corridor outer miter. Iteratively sized to target a 3BR area.

**Key architectural principle**: All geometry is constructed in world coordinates derived from the same pivot + rotation, so corridor/core/unit edges are perfectly flush.

### User-Corrected Specification (Bug 8)

The user's annotated screenshot refines this further:
- The core polygon passes through exactly **two key points** (facade-corridor and corridor-corridor intersections)
- The corridor is split into **four segments** connecting at these points
- Segments are ordered: C,D connect to Point 2 on Wing B side; A,B connect Point 2 to Point 1 through the bend

---

## Priority Fix Order (Updated)

1. **Bug 8 (Core shape & corridor segments)** — Rewrite intersection geometry per user annotation: two key points, four corridor segments, core polygon bounded by corridor inner edges
2. **Bug 1 (Corridor self-intersection)** — Subsumed by Bug 8 rewrite; cross-corner math useful for computing key points
3. **Bug 3 (Corner unit availA=0)** — Use far reference points for available length
4. **Bug 2 (Unit colors gray)** — Extend parseHexColor to handle rgba()
5. **Bug 4 (Massive filler)** — Will mostly resolve when Bug 3 is fixed
6. **Bug 5 (Inner core as apartment)** — Revert conversion, keep as CoreBlock
7. **Bug 6 (Stats NaN)** — Check field name mapping in assembleFloorPlan

---

## Current Reverted L Corridor Implementation

### Overview

This section documents how the **current (reverted) code** actually builds L-shaped corridors at intersections, and where it diverges from the Bug 8 specification.

### Data Flow

1. **`computeIntersectionJoinGeometry()`** (lines ~897-1043) computes 32 landmark points in world space for each intersection:
   - Corridor boundary points at wing bar ends: `aCorrInnerWorld`, `aCorrOuterWorld`, `bCorrInnerWorld`, `bCorrOuterWorld`
   - 4 miter points from line-line intersection: `sCorrInner` (corridor inner edges meet), `sCorrOuter` (corridor outer edges meet), `sOuter` (outer facades meet), `sInnerFacade` (inner facades meet)
   - Wing-tip points at actual bar ends (no steal, since geoOffset already trimmed)
   - Far reference points at original untrimmed wing boundary (geoOffset beyond bar end)
   - Inner side detection via cross-product (rotation-invariant)

2. **`createCorridorWedge()`** (lines ~749-846) builds corridor segments from the join geometry:
   - **Main wedge**: A single 6-point polygon: `aCorrOuterWorld → sCorrOuter → sCorrInner → bCorrInnerWorld → bCorrOuterWorld → aCorrInnerWorld`
   - **Extension A**: Rectangle `aFarCorrOuter → aCorrOuterWorld → aCorrInnerWorld → aFarCorrInner` (fills Wing A geoOffset zone)
   - **Extension B**: Rectangle `bFarCorrOuter → bCorrOuterWorld → bCorrInnerWorld → bFarCorrInner` (fills Wing B geoOffset zone)
   - Total: 1 hexagonal wedge + 0-2 rectangular extensions = 1-3 `CorridorBlock` items

3. **`createInnerCore()`** (lines ~1045-1082) builds the dark core:
   - 6-point polygon: `aTipInnerFacade → aCorrInnerWorld → sCorrInner → bCorrInnerWorld → bTipInnerFacade → sInnerFacade`
   - This is an L-shaped region bounded by inner facades and corridor inner edges

4. **`assembleFloorPlan()`** (lines ~1182-1631) reconstructs corridors from centerline graph:
   - Collects wing corridor centerlines + intersection join points
   - Projects join points onto wing centerline segments
   - Builds a deduped centerline graph (`corridorGraphNodes`, `corridorGraphEdges`)
   - Extracts linear paths via `extractCenterlinePaths()`
   - Rebuilds corridor polygons via `buildCorridorPolyFromCenterline()` (miter-join offset curves)
   - **Replaces** all wedge+wing corridor segments with rebuilt segments if any are produced

### Where It Diverges from Bug 8 Spec

| Aspect | Current Code | Bug 8 Spec |
|--------|-------------|------------|
| **Corridor topology** | Single 6-point miter polygon + 2 rect extensions → then rebuilt from centerline graph | Four discrete segments (A,B,C,D) connecting at Point 1 and Point 2 |
| **Key points** | `sCorrInner` and `sCorrOuter` are computed but only used as polygon vertices | Point 1 (facade-corridor) and Point 2 (`sCorrInner`) should be explicit join nodes |
| **Core polygon** | 6-point L from facade ends + `sCorrInner` + `sInnerFacade` | Bounded by corridor inner edges connecting Point 1 → Point 2 |
| **Centerline rebuild** | Overwrites all corridor segments from centerline graph | Should not be necessary if four segments are built correctly from landmarks |
| **C/snake support** | Centerline graph handles multiple intersections but wedge model is single-intersection | Four-segment model naturally composes: each intersection produces 4 segments independently |

### Key Limitation for C/Snake Shapes

The current code works for L-shapes because:
- Each wing participates in exactly **one** intersection
- The centerline graph rebuild handles the single join point correctly

For C/snake shapes, a **middle wing** participates in **two** intersections. The current wedge model:
- Produces independent wedges at each intersection end
- Has no mechanism to merge or deduplicate corridor segments on the shared middle wing
- The centerline graph tries to handle this but may produce disconnected or overlapping segments

The four-segment model from Bug 8 solves this because each intersection's segments are bounded by their join points, and segments from different intersections on the same wing naturally tile without overlap.

---

## Current File State

### multi-wing-generator.ts (~1998 lines)
- **Working:** Wing graph, BFS, task list, per-wing generation, transforms, inner side detection, `computeIntersectionJoinGeometry` (landmark computation)
- **Broken:** `createCorridorWedge` (single polygon instead of four segments), `createInnerCore` (wrong polygon shape — not bounded by the two key points), `createCornerUnit` (availA=0), `assembleFloorPlan` (inner core / filler conversion)
- **Debug fetch calls:** Still present in several functions (should be cleaned up)

### renderer.ts (~774 lines)
- **Working:** Mesh generation, triangulation (ear-clipping), L-shape quad decomposition
- **Broken:** parseHexColor doesn't handle rgba() strings

### FloorplateSVG.ts (~710 lines)
- **Working:** SVG rendering of corridorSegments, polygon units
- **No known bugs** in SVG rendering itself

### wing-detection.ts (~900 lines)
- **Working:** Vertex classification, wing detection, intersection detection, shape classification, host/guest roles, net wing lengths
- **No known bugs**

### Test suite: 271 tests passing (all shapes compile and produce output; tests don't verify visual correctness)
