# Implementation Learnings: Fix Outer Fillers, Corners & Inner Cores

**Date:** 2026-03-04 to 2026-03-05
**Plan Reference:** `.cursor/plans/fix_outer_fillers,_corners_&_inner_cores_41c937ce.plan.md`
**Session ID:** `82f196`
**Files Modified:** `src/algorithm/multi-wing-generator.ts`, `src/algorithm/generator-core.ts`
**Test Buildings:** 5-wing snake building, 5-wing courtyard (O/donut) building

---

## Summary: What Worked vs What Did Not

| # | Plan Item | Status | Detail |
|---|-----------|--------|--------|
| 1 | Remove Chamfer/Foyer + Normalize Corner Polygons | PARTIALLY WORKED | Corner unit polygon was normalized to a clean 6-point L-shape using `sCorrOuter`. However, the chamfer fields (`sCorrOuterChamferA/B`) and the foyer triangle in `createCorridorWedge` were never actually deleted from the code. |
| 2 | Give Outer Space Back to Wing (Remove Fillers) | DID NOT WORK | `createCornerUnit` returns empty `fillers` and computes `gapA`/`gapB`, but the gaps were never propagated to `WingGenerationOptions`. No code in `generator-core.ts` reads or applies `outerGapLeft`/`outerGapRight`. |
| 3 | Prevent Double Cores | PARTIALLY WORKED | Mid-core logic confirmed correct (`needsMidCore = false` always). "Double cores" actually came from phantom-core gaps in `generateCoreSideSegments`. A fix was applied (extend segments through skipped-core gaps) but was never visually verified in isolation. |
| 4 | Recompute Mid-Core using Intersection-Aware Egress | NOT NEEDED / CORRECT | The deterministic egress calculation was implemented. Debug logs confirmed `needsMidCore = false` for all wings in both test buildings (all lengths under the 76.2m limit). The logic works correctly but was never exercised. |
| 5 | Fix Inner Core Pollution on Acute Angles | DID NOT WORK AS INTENDED | The half-plane test and self-intersection test were added to `createInnerCore`, but pre-geoOffset-fix they always failed (triggering compact fallback) because the geoOffset bug pushed `sInnerFacade` to the wrong side of the corridor axis. Post-geoOffset-fix they pass, but the resulting extended polygon is far too large (50-190 sqm). |
| 6 | Clamp Inner Core for Acute Angles | NOT TRIGGERED | The clamping logic exists but the underlying geoOffset bug prevented it from ever being exercised. After the geoOffset fix, all angles were wide enough that clamping was unnecessary. |

---

## Root Causes Identified

### Root Cause 1: `computeGeoOffset` Uses Full Width Instead of Half Width

**Location:** `computeGeoOffset` in `src/algorithm/multi-wing-generator.ts` (line ~184)

**The Bug:**

```typescript
// WRONG -- uses full building depth
const raw = buildingDepth * tanHalf;

// CORRECT -- uses half building depth
const raw = (buildingDepth / 2) * tanHalf;
```

**Why this matters:**

`buildingDepth` is the FULL width of the wing (~19.8m). The geoOffset determines how much each wing is trimmed at an intersection to make room for the corner geometry. Using the full width instead of half means the wing is trimmed by approximately 2x the correct amount.

**Cascading effects:**

1. **Inner core loses `sInnerFacade` vertex.** When geoOffset is too large, the wing corridor tips (`aCorrInnerWorld`, `bCorrInnerWorld`) are pulled far back from the intersection point. The `sInnerFacade` (intersection of the two wings' inner facade lines) ends up on the "wrong side" of the corridor axis relative to `sCorrInner`. The half-plane test (`crossesCorridor`) then rejects the extended polygon -- not because the angle is acute, but because the underlying geometry has been distorted by over-trimming.

2. **White space gets worse.** With 2x trimming, there is a massive gap between the wing bar ends and the actual building corner. The inner core falls back to the compact 3-point triangle (very small area: 0.03 to 1.3 sqm), leaving most of the concave zone empty.

3. **Corner units cannot fill the gap.** `createCornerUnit` sizes its legs based on `availA` and `availB` (distances from `sOuter` to the wing bar outer facade). With 2x trimming, these distances become enormous, making the corner unit try to cover way too much area with a distorted shape.

**Debug log evidence (pre-fix):**

All snake building intersections showed `signFacade` opposite to `signInner`, confirming `sInnerFacade` was on the wrong side:

```json
{"crossesCorridor": true, "signInner": 1, "signFacade": -1, "useExtended": false}
```

**Debug log evidence (post-fix):**

After correcting to `(buildingDepth / 2) * tanHalf`, all intersections pass:

```json
{"crossesCorridor": false, "signInner": 1, "signFacade": 1,
 "selfIntersects": false, "compactArea": 0.103, "extendedArea": 52.8, "useExtended": true}
```

**Fix status: CONFIRMED WORKING by debug log evidence. Must be preserved.**

---

### Root Cause 2: "Double Cores" Are Actually Fillers in Phantom-Core Gaps

**Location:** `generateCoreSideSegments` in `src/algorithm/generator-core.ts` (line ~1636)

**The Bug:**

When a wing connects to another at an intersection, `skipLeftEndCore` or `skipRightEndCore` is set to `true` to prevent generating a regular core at that end (the intersection provides its own inner core). However, `generateCoreSideSegments` still leaves a gap of exactly `coreWidth` (~3.3m) where the phantom core would have been:

```typescript
// LEFT segment: stops at leftCoreStart, leaving coreWidth gap
segs.push({ x: 0, len: leftCoreStart, ... });

// RIGHT segment: starts after rightCoreStart + coreWidth
segs.push({ x: rightCoreStart + coreWidth, len: length - (rightCoreStart + coreWidth), ... });
```

The gap detection system (`detectGapsAndCreateFillers`) sees this empty space and spawns a `FillerBlock`, which renders as a dark grey core-colored rectangle.

**Visual effect:**

Users saw what appeared to be "double cores" next to each inner corner: one from the intersection's inner core, and one from the filler block spawned to cover the phantom core gap.

**Fix applied:**

```typescript
const actualLeftLen = wingOptions?.skipLeftEndCore ? leftCoreEnd : leftCoreStart;
segs.push({ x: 0, len: actualLeftLen, ... });

const actualRightStart = wingOptions?.skipRightEndCore ? rightCoreStart : rightCoreStart + coreWidth;
segs.push({ x: actualRightStart, len: length - actualRightStart, ... });
```

When a core is skipped, the adjacent unit segment extends through the core's space, preventing the gap from forming and thus preventing the filler.

**Fix status: CODE APPLIED, NOT VISUALLY VERIFIED.** The user reported "same behaviour as before" after this fix + the geoOffset fix were applied together. It is unclear whether this fix had any visual effect because Root Cause 3 (inner core too large) may have been visually dominant.

---

### Root Cause 3: Extended Inner Core Polygon Is Too Large (NOT FIXED)

**Location:** `createInnerCore` in `src/algorithm/multi-wing-generator.ts`

**The issue:**

When `useExtended = true` (which is the correct behavior after the geoOffset fix), the inner core uses a 6-point polygon:

```
[aCorrInnerWorld, sCorrInner, bCorrInnerWorld, bTipInnerFacade, sInnerFacade, aTipInnerFacade]
```

This creates a large hexagonal region that fills the entire concave zone between the two wing inner facades. The areas range from 34 to 191 sqm depending on the intersection angle.

The `assembleFloorPlan` function adds these inner cores to `allCores` and then filters out any wing units or wing cores that overlap with the inner core polygon. This means the extended inner core "eats" apartment space -- units that would otherwise occupy the concave zone are removed.

**What it looks like:**

- Courtyard building: Large dark trapezoids/hexagons at every intersection, consuming space that should be apartments.
- Snake building: Enormous dark triangular shapes at intersections (especially at the rightmost corner where the extended area is 191 sqm), extending well beyond the building footprint.

**What should happen:**

The inner core should be minimal -- just enough to cover the corridor junction geometry. The rest of the concave zone should be populated with apartments from the wing generation process or corner units.

**Status: NOT FIXED, NOT ADDRESSED in this implementation cycle.**

---

### Root Cause 4: Outer Gaps Never Propagated to Wings (NOT FIXED)

**Location:** `createCornerUnit` in `src/algorithm/multi-wing-generator.ts` and orchestration in `assembleFloorPlan`

**The issue:**

`createCornerUnit` calculates `gapA` and `gapB` (the space between the corner unit legs and the wing bar outer facade), but these values are only used internally for logging. They are never:

1. Returned from `createCornerUnit` in a way the orchestrator can consume
2. Added to `WingGenerationOptions` as `outerGapLeft`/`outerGapRight`
3. Read by `generator-core.ts` to extend wing segments

This means:

- Wing bar segments remain at their original trimmed length
- The space between the corner unit legs and the wing bar ends is empty (white space)
- The unit mix does not extend to fill this space

**Status: NOT FIXED.**

---

## Detailed Debug Log Analysis

### Snake Building (5 wings, 4 intersections)

#### Wings detected

| Wing ID | Length (m) | Width (m) | Direction (rad) | Role |
|---------|-----------|-----------|-----------------|------|
| 0 | 95.35 | 19.81 | 0.00 | Horizontal base |
| 1 | 74.90 | 19.81 | -2.14 | Bottom-left diagonal |
| 2 | 69.65 | 19.81 | 0.91 | Right-upward diagonal |
| 3 | 58.65 | 19.81 | 3.11 | Near-horizontal, slightly tilted |
| 4 | 44.25 | 19.81 | -2.18 | Central connector |

#### Inner intersections

| Wing Pair | Point | Angle (rad) | Angle (deg) |
|-----------|-------|-------------|-------------|
| [4, 3] | (27.46, 2.74) | 5.29 | ~303 |
| [3, 2] | (36.38, 2.49) | 2.20 | ~126 |
| [4, 0] | (-1.98, -4.99) | 2.18 | ~125 |
| [0, 1] | (-50.79, -4.99) | 2.14 | ~123 |

#### Mid-core calculations (all `needsMidCore = false`)

| Wing | Effective Length (m) | Worst Case Travel (m) | Limit (m) | Skip Left | Skip Right | needsMidCore |
|------|---------------------|----------------------|-----------|-----------|------------|--------------|
| 0 | 72.08 | 26.29 | 76.2 | true | true | false |
| 4 | 33.68 | 7.08 | 76.2 | true | true | false |
| 1 | 56.82 | 18.66 | 76.2 | **false** | true | false |
| 3 | 33.79 | 7.14 | 76.2 | true | true | false |
| 2 | 50.17 | 15.33 | 76.2 | **false** | true | false |

Wings 1 and 2 have `skipLeft = false` because they are leaf wings (one free end) that generate a normal core at one end and rely on the intersection's inner core at the other.

#### Inner core checks (post-geoOffset-fix)

| Intersection | crossesCorridor | selfIntersects | Compact Area (sqm) | Extended Area (sqm) | useExtended |
|--------------|-----------------|----------------|--------------------|--------------------|-------------|
| Wings [4, 3] | false | false | 0.10 | 52.80 | true |
| Wings [3, 2] | false | false | 1.31 | **191.38** | true |
| Wings [4, 0] | false | false | 0.09 | 51.01 | true |
| Wings [0, 1] | false | false | 1.17 | **177.53** | true |

The extended areas of 191 sqm and 177 sqm are enormous. These correspond to the wide-angle intersections (~122-126 deg) where the concave zone fans out significantly. This is why the screenshots show massive dark core blocks at these intersections.

#### H_CROSS details (sample intersection Wings [3, 2])

```json
{
  "a": {"x": 11.56, "y": -129.30},
  "b": {"x": 12.44, "y": -130.67},
  "sCorrInner": {"x": 13.35, "y": -129.11},
  "sInnerFacade": {"x": 30.02, "y": -118.35},
  "signInner": 1,
  "signFacade": 1,
  "crossesCorridor": false
}
```

Both `signInner` and `signFacade` are `1` (same side), confirming `sInnerFacade` is correctly on the inner side of the corridor after the geoOffset fix. But `sInnerFacade` at (30.02, -118.35) is ~17m away from `sCorrInner` at (13.35, -129.11), which explains the 191 sqm extended polygon.

---

### Courtyard Building (5 wings, 5 intersections)

#### Wings detected

| Wing ID | Length (m) | Width (m) | Direction (rad) | Role |
|---------|-----------|-----------|-----------------|------|
| 0 | 89.37 | 19.81 | 0.00 | Horizontal base |
| 1 | 77.38 | 19.81 | -1.84 | Left rising diagonal |
| 2 | 64.55 | 19.81 | 1.29 | Right rising diagonal |
| 3 | 64.03 | 19.81 | 2.49 | Top-left descending |
| 4 | 44.48 | 19.81 | -2.51 | Top-right descending |

All 5 wings form a closed loop (the "donut"). Every inner intersection type is `"inner"` and every outer intersection type is `"outer"` -- the system correctly distinguishes inner (concave) corners from outer (convex) corners.

#### Mid-core calculations (all `needsMidCore = false`)

| Wing | Effective Length (m) | Worst Case Travel (m) | Skip Left | Skip Right | needsMidCore |
|------|---------------------|----------------------|-----------|------------|--------------|
| 0 | 68.93 | 24.71 | true | true | false |
| 1 | 60.96 | 20.73 | true | true | false |
| 2 | 50.32 | 15.41 | true | true | false |
| 3 | 33.60 | 7.05 | true | true | false |
| 4 | 49.87 | 15.18 | true | true | false |

All wings have both ends skipped (full courtyard loop -- every wing connects to another at both ends).

#### Inner core checks (post-geoOffset-fix)

| Intersection | crossesCorridor | selfIntersects | Compact Area (sqm) | Extended Area (sqm) | useExtended |
|--------------|-----------------|----------------|--------------------|--------------------|-------------|
| Wings [0, 1] | false | false | 0.69 | **127.28** | true |
| Wings [1, 4] | false | false | 0.03 | 34.02 | true |
| Wings [4, 3] | false | false | 0.22 | 72.83 | true |
| Wings [3, 2] | false | false | 0.18 | 66.24 | true |
| Wings [2, 0] | false | false | 0.23 | 73.46 | true |

All 5 intersections pass the half-plane test, but the extended areas (34-127 sqm) fill the courtyard corners with core blocks instead of apartments.

#### H_CROSS details (sample intersection Wings [0, 1])

```json
{
  "a": {"x": -328.01, "y": -268.47},
  "b": {"x": -327.35, "y": -269.76},
  "sCorrInner": {"x": -326.83, "y": -268.68},
  "sInnerFacade": {"x": -313.64, "y": -261.95},
  "signInner": 1,
  "signFacade": 1,
  "crossesCorridor": false
}
```

`sInnerFacade` is ~15m from `sCorrInner`, generating the 127 sqm extended polygon.

---

## Visual Issues Observed (Screenshots 2026-03-05)

### Courtyard Building (Screenshot 1)

1. **Large dark cores at every intersection.** The extended inner core polygons fill the entire concave zone. Each intersection has a dark block ranging from 34 to 127 sqm. These are rendered as CORE blocks but represent wasted apartment space.
2. **Some white space persists** at corners where the extended polygon does not fully tile with the wing bars.
3. **Dashed corridor lines look correct** -- the corridor path connects through all 5 wings in a loop.
4. **3BR units at wing ends are reasonably sized** (1238-1475sf), but some units near intersections have non-perpendicular walls ("funny angles").
5. **Unit mix follows the configuration** -- Studios, 1BR, 2BR, 3BR are all present. But the inner core blocks prevent apartments from filling the intersection zones.

### Snake Building (Screenshot 2)

1. **Enormous dark triangular CORE at far-right intersection** extends well beyond the building footprint. This is the 191 sqm extended inner core polygon for the Wings [3, 2] intersection.
2. **Dark triangular shapes outside the building** at both ends of the snake. The far-left has a 3BR 1588sf unit and a CORE that protrude beyond the footprint. The far-right has a CORE that is a massive triangle extending into empty space.
3. **Two dark cores adjacent to inner corners** -- the "double core" filler issue at several intersections (Root Cause 2).
4. **Corridor dashes are offset far from the building** in some areas, particularly near the rightmost intersections.
5. **Unit walls are not perpendicular to the corridor** near intersections -- "funny angles" visible on multiple units.

---

## Code Changes Applied (Exhaustive List)

### `src/algorithm/multi-wing-generator.ts`

#### 1. `computeGeoOffset` -- Fixed formula (KEEP THIS)

**Before:**
```typescript
const raw = buildingDepth * tanHalf;
```

**After:**
```typescript
const raw = (buildingDepth / 2) * tanHalf;
```

**Rationale:** `buildingDepth` is the full wing width (~19.8m). The offset should be computed from half the width (the corridor edge to the facade), not the full width.

#### 2. `createInnerCore` -- Added `H_CROSS` debug instrumentation

Added a `fetch()` call to log half-plane test details to the debug endpoint:

```typescript
fetch('http://127.0.0.1:7318/ingest/e8a87796-65b1-41f2-a655-6a4986609b6e', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '82f196' },
  body: JSON.stringify({
    sessionId: '82f196', runId: 'run2', hypothesisId: 'H_CROSS',
    location: 'multi-wing-generator.ts:createInnerCore',
    message: 'Cross details',
    data: {
      a, b,
      sCorrInner: joinGeom.sCorrInner,
      sInnerFacade: joinGeom.sInnerFacade,
      signInner, signFacade, crossesCorridor
    },
    timestamp: Date.now()
  })
}).catch(() => {});
```

**Fields logged:** `a`, `b` (corridor inner world endpoints), `sCorrInner`, `sInnerFacade`, `signInner`, `signFacade`, `crossesCorridor`.

#### 3. `createInnerCore` -- Pre-existing `1A-1B-1C` debug instrumentation

Already present; logs the final inner core decision: `crossesCorridor`, `selfIntersects`, compact/extended areas, `useExtended`.

#### 4. No structural changes to `createCornerUnit`, `createCorridorWedge`, `computeIntersectionJoinGeometry`, or `assembleFloorPlan`

Despite the plan calling for removal of chamfer/foyer and propagation of outer gaps, these were NOT actually modified.

---

### `src/algorithm/generator-core.ts`

#### 1. `generateCoreSideSegments` -- Extended segments through phantom-core gaps (KEEP THIS)

**Before:**
```typescript
const generateCoreSideSegments = (isSouth: boolean): SegmentDef[] => {
  const segs: SegmentDef[] = [];
  segs.push({ x: 0, len: leftCoreStart, isSouth, pattern: leftCornerPattern,
              isCorner: !suppressLeftCorner, extraWidth: 0,
              bonusArea: singleCoreBonusArea });

  if (!hasMidCore) {
    segs.push({ x: leftCoreEnd, len: midSpan1, isSouth, pattern: midPattern,
                isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
  } else {
    segs.push({ x: leftCoreEnd, len: midSpan1, isSouth, pattern: midPattern,
                isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
    segs.push({ x: midCoreEnd, len: midSpan2, isSouth, pattern: midPattern,
                isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
  }

  segs.push({ x: rightCoreStart + coreWidth,
              len: length - (rightCoreStart + coreWidth), isSouth,
              pattern: rightCornerPattern, isCorner: !suppressRightCorner,
              extraWidth: 0, bonusArea: singleCoreBonusArea });
  return segs;
};
```

**After:**
```typescript
const generateCoreSideSegments = (isSouth: boolean): SegmentDef[] => {
  const segs: SegmentDef[] = [];
  const actualLeftLen = wingOptions?.skipLeftEndCore
    ? leftCoreEnd : leftCoreStart;
  segs.push({ x: 0, len: actualLeftLen, isSouth, pattern: leftCornerPattern,
              isCorner: !suppressLeftCorner, extraWidth: 0,
              bonusArea: singleCoreBonusArea });

  if (!hasMidCore) {
    segs.push({ x: leftCoreEnd, len: midSpan1, isSouth, pattern: midPattern,
                isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
  } else {
    segs.push({ x: leftCoreEnd, len: midSpan1, isSouth, pattern: midPattern,
                isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
    segs.push({ x: midCoreEnd, len: midSpan2, isSouth, pattern: midPattern,
                isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
  }

  const actualRightStart = wingOptions?.skipRightEndCore
    ? rightCoreStart
    : rightCoreStart + coreWidth;
  segs.push({ x: actualRightStart, len: length - actualRightStart, isSouth,
              pattern: rightCornerPattern, isCorner: !suppressRightCorner,
              extraWidth: 0, bonusArea: singleCoreBonusArea });
  return segs;
};
```

**Rationale:** When a core is skipped (intersection provides egress), the unit segment extends through the phantom core's space to prevent `detectGapsAndCreateFillers` from spawning a dark filler block.

#### 2. `needsMidCore` -- Added `3A` debug instrumentation

Logs mid-core necessity calculation: `length`, `limit`, `worstCaseTravel2Cores`, `needsMidCore`, `skipLeft`, `skipRight`.

#### 3. `detectGapsAndCreateFillers` -- Added `H_FILLER` debug instrumentation

Logs each filler generated: `gapWidth`, `currentX`, `y`, `side`, `segmentStartX`, `segmentEndX`.

---

## Instrumentation Summary

All instrumentation uses `fetch()` calls to a local debug endpoint at `http://127.0.0.1:7318/ingest/e8a87796-65b1-41f2-a655-6a4986609b6e`. Logs are NDJSON format, stored in `.cursor/debug-82f196.log`.

| Hypothesis ID | Location | What It Logs |
|---------------|----------|--------------|
| `H_CROSS` | `createInnerCore` (multi-wing-generator.ts) | Corridor inner/facade points, half-plane signs, `crossesCorridor` |
| `1A-1B-1C` | `createInnerCore` (multi-wing-generator.ts) | Final decision: `crossesCorridor`, `selfIntersects`, areas, `useExtended` |
| `3A` | `needsMidCore` (generator-core.ts) | Wing length, travel limit, worst-case travel, `needsMidCore`, skip flags |
| `H_FILLER` | `detectGapsAndCreateFillers` (generator-core.ts) | Gap width, position, side, segment boundaries for each filler |
| `H_EDGES` | `buildWings` (wing-detection.ts) | All polygon edges before pairing (pre-existing) |
| `H_WINGS_EXTENT` | `buildWings` (wing-detection.ts) | Final wing definitions (pre-existing) |
| `H_INTERSECTIONS` | `findWingIntersections` (wing-detection.ts) | All inner/outer intersection points, wing pairs, angles (pre-existing) |

---

## Recommendations for Re-Implementation

### 1. KEEP the geoOffset fix

The `(buildingDepth / 2) * tanHalf` correction is confirmed working by debug logs. Both the snake and courtyard buildings show correct `crossesCorridor: false` for all intersections after this fix. This must be preserved in any checkpoint restore.

### 2. KEEP the `generateCoreSideSegments` phantom-gap fix

The logic of extending unit segments through skipped-core gaps is sound and prevents `detectGapsAndCreateFillers` from spawning dark filler blocks. It should be preserved, though it needs visual verification.

### 3. Make inner cores minimal (HIGHEST PRIORITY)

The extended 6-point polygon is too large. The inner core should be limited to just the corridor junction area. Options:

- **Option A:** Use only the compact 3-point triangle `[aCorrInnerWorld, sCorrInner, bCorrInnerWorld]`. Minimal but may leave uncovered area near the corridor junction.
- **Option B:** Use a 4-point quad that extends to `sInnerFacade` only when the distance from `sCorrInner` to `sInnerFacade` is less than a threshold (e.g., 1x building depth). For larger distances, clamp the polygon.
- **Option C (recommended):** Compute the inner core as just the corridor wedge/junction area (the quad between the two corridor edges), and let the remaining concave zone be filled by wing segments and corner units.

### 4. Complete the outer gaps pipeline

- Calculate `gapA`/`gapB` from `createCornerUnit` (already done)
- Return them from the function in a usable form
- In the orchestrator, inject the gap values into `taskA` and `taskB`'s `wingOptions` as `outerGapLeft`/`outerGapRight`
- In `generator-core.ts`, extend the first/last outer-side segment by the gap amount and shift its starting `x`

### 5. Clip all geometry to building footprint

Add a post-processing step in `assembleFloorPlan` that clips unit and core polygons to the building footprint polygon. This prevents the protrusion artifacts visible in the snake building screenshots.

### 6. Actually remove the chamfer/foyer code

- Delete `sCorrOuterChamferA`/`sCorrOuterChamferB` calculation from `computeIntersectionJoinGeometry`
- Remove the 3-point foyer triangle segment from `createCorridorWedge`
- Make corridor junction quads go directly to `sCorrOuter`

### 7. Remove debug instrumentation before production

All `fetch()` calls to `127.0.0.1:7318` should be removed before merging to production. They are useful for development but add latency and are no-ops in environments without the debug server.
