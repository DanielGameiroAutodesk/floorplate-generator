# Multi-Wing Building Support: Problem Specification

> **Audience**: Junior developers joining the project.
> **Goal**: Understand the current system, what multi-wing buildings are, why the existing code cannot handle them, and what needs to change. This document does NOT prescribe solutions — it describes the problem in enough detail for you to propose a plan.

---

## Table of Contents

1. [What Does This App Do?](#1-what-does-this-app-do)
2. [Key Vocabulary](#2-key-vocabulary)
3. [How the Current Algorithm Works (Step by Step)](#3-how-the-current-algorithm-works-step-by-step)
4. [The Building Shape Assumption That Everything Relies On](#4-the-building-shape-assumption-that-everything-relies-on)
5. [What Are Multi-Wing Buildings?](#5-what-are-multi-wing-buildings)
6. [What Breaks When the Building Is Not a Rectangle](#6-what-breaks-when-the-building-is-not-a-rectangle)
7. [What Already Exists for Multi-Wing Support](#7-what-already-exists-for-multi-wing-support)
8. [The Sub-Problems You Need to Solve](#8-the-sub-problems-you-need-to-solve)
9. [Files You Must Read](#9-files-you-must-read)
10. [Constraints and Rules to Respect](#10-constraints-and-rules-to-respect)

---

## 1. What Does This App Do?

This is a **floorplate generator** — a tool that automatically fills the floor of a residential building with apartments, corridors, and elevator/stair cores.

Think of it like this: an architect draws a building outline (the "footprint") in a 3D design tool called [Forma](https://www.autodesk.com/products/forma). Our extension then takes that outline and fills it with:

- **Residential units** (Studios, 1-Bedrooms, 2-Bedrooms, 3-Bedrooms) on both sides of a central corridor
- **A corridor** — a hallway running down the middle of the building
- **Cores** — stairwell and elevator shafts so people can enter/exit the building

The user configures the desired unit mix (e.g. "20% Studio, 40% 1BR, 30% 2BR, 10% 3BR"), and the algorithm figures out how to pack everything in while meeting building code requirements for fire egress.

It generates **3 options** using different optimization strategies (Balanced, Mix-Optimized, Efficiency-Optimized) so the architect can choose.

### Visual: What a Generated Floor Looks Like

```
┌──────────┬──────────┬────────┬──────────┬──────────┬──────────┬──────────┐
│  3BR     │  1BR     │  CORE  │  Studio  │  1BR     │  1BR     │  2BR     │  ← North side
│ (L-shape)│          │        │          │          │          │ (L-shape)│
├──────────┴──────────┴────────┴──────────┴──────────┴──────────┴──────────┤
│                           C O R R I D O R                                │
├──────────┬──────────┬────────┬──────────┬──────────┬──────────┬──────────┤
│  3BR     │  2BR     │  CORE  │  1BR     │  Studio  │  1BR     │  2BR     │  ← South side
│ (L-shape)│          │        │          │          │          │ (L-shape)│
└──────────┴──────────┴────────┴──────────┴──────────┴──────────┴──────────┘
              ← building length (width in footprint) →
```

---

## 2. Key Vocabulary

Before we dive in, here are terms you'll see everywhere in the codebase:

| Term | What It Means |
|------|--------------|
| **Footprint** | The 2D outline (polygon) of a building's floor, extracted from the 3D model |
| **Wing** | A distinct rectangular section of a building that extends from a central point. An L-shaped building has 2 wings. |
| **Core** | A stairwell/elevator shaft. The building needs at least 2 for fire safety. |
| **Corridor** | The central hallway. Units are placed on both sides of it ("double-loaded corridor"). |
| **Segment** | A stretch of corridor between two cores (or between a core and the building end). Each segment gets a batch of units placed into it. |
| **Rentable depth** | `(buildingDepth - corridorWidth) / 2` — the depth available for units on each side of the corridor |
| **L-shaped unit** | A unit that wraps around a corner (either around a core, or at the building end into the corridor void). Has a polygon shape instead of a simple rectangle. |
| **GSF** | Gross Square Footage — total floor area including corridors and cores |
| **NRSF** | Net Rentable Square Footage — total area of actual apartments only |
| **Efficiency** | NRSF / GSF — how much of the building is usable living space (target: 75-85%) |
| **Egress** | The path a person takes to exit the building in an emergency. Governed by building code. |
| **Dead-end** | A section of corridor where you can only walk in one direction (no exit at the end). Max allowed: 50 ft (sprinklered). |
| **Travel distance** | Max walking distance from any point to the nearest exit. Max: 250 ft (sprinklered). |
| **Convex corner** | An outer corner of the building polygon (interior angle < 180°). Premium location for large units. |
| **Concave corner** | An inner corner (interior angle > 180°). This is where two wings meet. Dark zone — good for cores/utilities, bad for apartments. |
| **Filler** | A small leftover gap between units that gets "baked" as core space to ensure complete floor coverage |

---

## 3. How the Current Algorithm Works (Step by Step)

The entire algorithm lives in `src/algorithm/generator-core.ts` (~2300 lines). Here is the pipeline:

### Entry Point

```
generateFloorplate(footprint, config, egressConfig, corridorWidth, coreWidth, coreDepth, coreSide, alignment, strategy)
```

The function receives a `BuildingFootprint` (basically a width, depth, and rotation), a unit configuration (the percentages and areas for each type), and egress rules. It returns a `FloorPlanData` with all units, cores, the corridor, and statistics.

### The 14-Step Pipeline

```
Step 1:  CORE COUNT DETERMINATION
         How many cores do we need? 2 or 3?
         If the building is very long (travel distance between 2 end cores
         would exceed 250ft), add a middle core.

Step 2:  CALCULATE GLOBAL UNIT COUNTS
         From the target mix percentages (e.g. "20% Studio"), calculate
         the actual number of each type that will fit.
         Uses available corridor length ÷ average unit width.

Step 3:  GEOMETRY OPTIMIZATION (findOptimalGeometry)
         Search for the best "corner length" — how much space to
         reserve at each end of the building for the larger corner units.
         Tries hundreds of configurations, scoring each one.

Step 4:  CORE PLACEMENT
         Place left-end core, right-end core, and middle core (if needed).
         All cores are placed along the X axis (the corridor direction).

Step 5:  DEFINE SEGMENTS
         Divide the corridor into segments:
         [LEFT CORNER] [CORE] [MID SECTION] [CORE] [RIGHT CORNER]
         Each segment has a start X, a length, and whether it's a corner.

Step 6:  DISTRIBUTE UNITS TO SEGMENTS
         Assign the unit counts from Step 2 to specific segments.
         Corner-eligible units (2BR, 3BR) go to corner segments.
         A 4-pass algorithm handles: reserve corners → fill → overflow → guarantee-no-empty.

Step 7:  MIRRORED CORNER PLACEMENT
         If the north side has a 3BR at a corner, force the south side
         to also have a 3BR at the matching corner (visual stacking).

Step 8:  GENERATE UNITS
         For each segment, generate the actual unit rectangles with
         positions and dimensions. Handle width distribution, auto-splitting
         of oversized units, and minimum width enforcement.

Step 9:  WALL ALIGNMENT
         Align partition walls across the corridor so that the north-side
         and south-side walls line up. This makes the building look cleaner
         and is structurally better.

Step 10: CORE WRAPPING (L-shapes)
         If a core doesn't extend all the way to the facade, the unit
         next to it can wrap around and fill the gap, becoming L-shaped.

Step 11: CORRIDOR VOID ABSORPTION
         At both ends of the building, the corridor doesn't extend to the edge.
         The corner units on both sides absorb this void, becoming L-shaped
         and gaining extra area.

Step 12: FILLER DETECTION
         Find any tiny gaps not covered by units or cores, create filler blocks.

Step 13: STATISTICS
         Calculate GSF, NRSF, efficiency, unit counts, mix percentages.

Step 14: EGRESS VALIDATION + COORDINATE TRANSFORM
         Check dead-end distances and travel distances.
         Transform everything from local coordinates (origin at top-left of building)
         to world coordinates (centered and rotated).
```

### How the Code Models the Building Internally

The entire algorithm works in a **local coordinate system** where:

```
Y=0  → top edge (North facade)
     ┌──────────────────────────────────────── X=length ──┐
     │  North units: y=0, depth=rentableDepth              │
     │                                                     │
Y=RD ├─────────────── CORRIDOR ──────────────────────────┤ (RD = rentableDepth)
     │                                                     │
     │  South units: y=RD+corridorWidth, depth=rentableDepth│
     │                                                     │
     └─────────────────────────────────────────────────────┘
X=0                                                   X=length
```

Key code that reveals this model:

```typescript
const length = footprint.width;               // Building is one number: its length
const buildingDepth = footprint.depth;         // And its depth
const rentableDepth = (buildingDepth - corridorWidth) / 2;  // Uniform both sides
```

**This is the fundamental assumption: the building is a rectangle.** Everything in the pipeline depends on it.

---

## 4. The Building Shape Assumption That Everything Relies On

Here is a list of **every place in the code that assumes a rectangular bar building**. This is the core of what makes multi-wing support hard.

### 4.1 Footprint Extraction (`src/algorithm/footprint.ts`)

The footprint extraction function receives raw 3D mesh triangles from Forma and produces a `BuildingFootprint`. Here's what it does:

1. Finds all ground-level vertices
2. Computes a **convex hull** (the outer bounding polygon)
3. Finds the **longest edge** → uses it as the building's primary axis
4. Computes **width** (along axis) and **depth** (perpendicular to axis)

**What breaks**: A convex hull of an L-shaped building fills in the inner corner. An L-shaped building that is 100m × 60m with a 40m × 40m notch cut out will appear as a 100m × 60m rectangle. **All shape information is lost.**

```
Actual L-shape:              Convex hull result:
┌────────────────┐           ┌────────────────┐
│                │           │                │
│       ┌────────┘           │                │  ← Hull fills in the notch!
│       │                    │                │
│       │                    │                │
└───────┘                    └────────────────┘
```

The `BuildingFootprint` type only stores: `width`, `depth`, `height`, `centerX`, `centerY`, `rotation`, `floorZ`, and bounding box values. **There is no polygon data at all.**

### 4.2 Core Placement (`generator-core.ts`, lines ~1399-1534)

Cores are placed along a single X axis:

```typescript
const leftCoreStart = cornerLen;
const rightCoreStart = length - cornerLen - coreWidth;
// If mid core needed:
const midCoreStart = leftCoreEnd + midSpan1;
```

**What breaks**: In an L-shaped building, you need cores at the wing intersection (the inner corner), not just at the two ends of a single line. A U-shaped building might need cores at both inner corners plus the wing ends.

### 4.3 Segment Definition (`generator-core.ts`, lines ~1537-1614)

Segments are defined purely by X ranges along the corridor:

```
Segment 0: x=0 to x=cornerLen (left corner)
Segment 1: x=leftCoreEnd to x=rightCoreStart (middle)
Segment 2: x=rightCoreStart+coreWidth to x=length (right corner)
```

**What breaks**: In an L-shaped building, the corridor changes direction. Segments can't be defined by X ranges alone — they need to follow the corridor path through multiple wings.

### 4.4 The North/South Assumption (`generator-core.ts`, throughout)

Units are placed on exactly two sides: `'North'` (y=0) and `'South'` (y=rentableDepth+corridorWidth):

```typescript
const northUnits = units.filter(u => u.y === 0);
const southUnits = units.filter(u => u.y > 0);
```

**What breaks**: In an L-shaped building, Wing 1 has North/South sides, and Wing 2 has East/West sides. There is no concept of "the side changes direction."

### 4.5 Corridor Definition (`generator-core.ts`, lines ~2104-2120)

The corridor is a single rectangle:

```typescript
corridor: {
  x: leftCorridorVoid,
  y: rentableDepth,
  width: length - leftCorridorVoid - rightCorridorVoid,
  depth: corridorWidth
}
```

**What breaks**: A multi-wing corridor is not a rectangle. It's an L-shape, U-shape, or more complex path. It needs to be a polyline or polygon that follows the building's wing structure.

### 4.6 Rentable Depth (`generator-core.ts`, line 1393)

```typescript
const rentableDepth = (buildingDepth - corridorWidth) / 2;
```

This assumes the building has **uniform depth** everywhere and the corridor runs exactly down the middle.

**What breaks**: Different wings can have different widths, meaning different rentable depths:

```
Wing 1 (70ft wide): rentableDepth = (70 - 5) / 2 = 32.5 ft
Wing 2 (50ft wide): rentableDepth = (50 - 5) / 2 = 22.5 ft
```

Units in Wing 2 would be shallower than in Wing 1. The algorithm currently has no concept of per-wing depth.

### 4.7 Statistics Calculation (`generator-core.ts`, line 2045)

```typescript
const totalGSF = length * buildingDepth;
```

**What breaks**: An L-shaped building's area is NOT `length × depth`. It's the actual polygon area, which is smaller because of the notch.

### 4.8 Egress Validation (`generator-core.ts`, lines ~2057-2083)

Dead-end calculation:
```typescript
const leftDeadEnd = leftCoreStart - leftCorridorVoid;
const rightDeadEnd = (length - rightCoreStart - coreWidth) - rightCorridorVoid;
```

**What breaks**: Dead-end distances need to be measured along the actual corridor path, which bends through wings. A person at the end of Wing 2 in an L-shaped building doesn't walk in a straight line to a core — they walk along a corridor that turns a corner.

### 4.9 Wall Alignment (`generator-core.ts`, lines ~1746-1850)

The alignment system aligns walls on the North side with walls on the South side across a straight corridor.

**What breaks**: At a wing intersection, the corridor changes direction. "North" and "South" no longer mean the same thing. Units on opposite sides of the corridor at a corner intersection need a different alignment model.

### 4.10 Rendering (`src/algorithm/renderer.ts`)

The renderer handles two shapes: rectangles and 6-point L-shapes (for core wrapping and corridor void absorption). The L-shape triangulation assumes exactly 6 vertices decomposed into 2 quads.

**What breaks**: Wing intersection units may have more complex polygon shapes. The renderer needs to handle arbitrary polygons, not just rectangles and 6-point L-shapes.

### 4.11 Baking to Forma (`src/extension/bake-building.ts`)

The bake process converts our FloorPlanData into Forma's native building format. It creates polygon regions for each unit, the corridor, and cores.

**What breaks**: The corridor polygon is currently a rectangle. The unit polygons at wing intersections will be more complex. The GSF polygon (building outline) needs to be the actual footprint polygon, not a rectangle.

---

## 5. What Are Multi-Wing Buildings?

A "wing" is a distinct rectangular section of a building. Buildings with multiple wings are very common in real architecture because:

- They allow more units to have facade access (natural light)
- They create courtyards and outdoor spaces
- They fit irregularly shaped lots
- They look more interesting than a big box

### Common Multi-Wing Shapes

```
BAR (1 wing) — what we support today:
┌──────────────────────────────────────┐
│                                      │
└──────────────────────────────────────┘


L-SHAPE (2 wings):
┌──────────────────────────────────────┐
│          Wing 1                      │
│                    ┌─────────────────┘
│                    │
│                    │  Wing 2
│                    │
└────────────────────┘

    → 1 inner corner (concave) — dark zone, good for core
    → 1 outer corner (convex) — premium, good for 3BR units


U-SHAPE (3 wings):
┌────────────────┐    ┌────────────────┐
│    Wing 1      │    │    Wing 3      │
│                │    │                │
│                └────┘                │
│          Wing 2 (base)               │
│                                      │
└──────────────────────────────────────┘

    → 2 inner corners — 2 core locations
    → 2 outer corners — 2 premium unit locations


V-SHAPE (2 wings, angled):
         ╲           ╱
    Wing 1 ╲       ╱ Wing 2
             ╲   ╱
              ╲ ╱   ← angle ≠ 90°
               V


H-SHAPE (4 wings):
┌────────────┐         ┌────────────┐
│   Wing 1   │         │   Wing 3   │
│            ├─────────┤            │
│            │ Wing 5  │            │
│            ├─────────┤            │
│   Wing 2   │         │   Wing 4   │
└────────────┘         └────────────┘
```

### Corridor Routing Through Wings

In a bar building, the corridor is a straight line. In multi-wing buildings, **the corridor must follow the building shape**, turning corners at wing intersections:

```
L-shaped building corridor:

┌────────────────────────────────────────┐
│ Units   ║ corridor runs horizontally ║  │
│         ║ through Wing 1             ║  │
│         ║════════════════════════╗       │
│         ┌──────────────────────║───────┘
│         │                     ║
│ Units   │  corridor turns 90° ║  Units
│         │  and goes vertical  ║
│         │  through Wing 2     ║
│         │                     ║
└─────────┴─────────────────────┘
```

### Wing Intersections: The Hardest Part

Where two wings meet, you get two types of corners:

```
                    OUTER CORNER (convex)
                    Great for premium 3BR units
                    Has 2 facades (lots of light)
                    ↓
                ┌───●────────────┐
                │   │            │
                │   │            │
    ────────────┘   │            │
                    │            │
    INNER CORNER ───●            │
    (concave)       │            │
    Dark zone       │            │
    Good for core   │            │
                    └────────────┘
```

The **inner corner** is the "dark zone" — it's tucked away, gets no natural light, and is hard to access. It's the perfect place to put a core (elevator/stairwell).

The **outer corner** is the premium spot — two facades, lots of light, great views. This is where you want your biggest, most expensive apartments (3BR).

---

## 6. What Breaks When the Building Is Not a Rectangle

Here is a summary table of every major system that breaks:

| System | Why It Breaks | Severity |
|--------|--------------|----------|
| **Footprint extraction** | Convex hull destroys the actual shape. Returns width × depth rectangle. No polygon data. | **CRITICAL** — Without the actual polygon, nothing else can work |
| **Core placement** | Only places cores along one axis (left, middle, right). No concept of wing intersection cores. | **CRITICAL** |
| **Segment definition** | Segments are X-ranges on a single straight corridor. Can't handle corridors that turn. | **CRITICAL** |
| **North/South sides** | Only 2 sides exist. Multi-wing buildings have units facing different directions per wing. | **CRITICAL** |
| **Corridor geometry** | A single rectangle. Needs to be a polyline path through all wings. | **CRITICAL** |
| **Rentable depth** | Single global value. Different wings can have different widths → different depths. | **HIGH** |
| **Unit placement at intersections** | No zone types for wing corners. Inner corners need cores; outer corners need premium units. | **HIGH** |
| **Wall alignment** | Only aligns across a straight corridor. Breaks at direction changes. | **MEDIUM** |
| **Statistics (GSF)** | `length × depth` is wrong for non-rectangular footprints | **MEDIUM** |
| **Egress validation** | Dead-end and travel distance measured along a straight line, not the actual corridor path | **MEDIUM** |
| **Renderer** | Only handles rectangles and 6-point L-shapes. Wing corner units may need arbitrary polygons. | **MEDIUM** |
| **Bake to Forma** | Corridor baked as rectangle. GSF polygon baked as rectangle. | **LOW** — follows from fixing the above |

---

## 7. What Already Exists for Multi-Wing Support

We thought ahead and defined types and specs for multi-wing buildings. **These exist but are not connected to the algorithm.** Think of them as a blueprint that was drawn but never built.

### 7.1 Type Definitions (`src/algorithm/types.ts`, lines 289-367)

These TypeScript types are **defined but completely unused**:

```typescript
// Corner classification
enum CornerType {
  CONVEX = 'CONVEX',     // Outer corner (angle < 180°) → premium units
  CONCAVE = 'CONCAVE',   // Inner corner (angle > 180°) → cores/utilities
  STRAIGHT = 'STRAIGHT'  // Not a real corner (≈180°)
}

// A vertex in the building polygon with computed angle
interface FootprintVertex {
  x: number;
  y: number;
  angle: number;           // Interior angle at this vertex
  cornerType: CornerType;  // Classification
}

// A distinct rectangular section of the building
interface Wing {
  id: number;
  vertices: FootprintVertex[];
  direction: number;      // Primary direction angle (e.g. 0° = horizontal)
  length: number;         // Wing length along its axis
  width: number;          // Wing width perpendicular to its axis
  centerline: { start: {x, y}; end: {x, y} };  // For corridor routing
  bounds: { minX, maxX, minY, maxY };
}

// Where two wings meet
interface WingIntersection {
  point: FootprintVertex;
  type: 'inner' | 'outer';
  wingIds: [number, number];
  angle: number;
  innerZone?: { polygon: Point[]; area: number };  // Dark zone for core
  outerZone?: { polygon: Point[]; area: number };  // Premium zone for 3BR
}

// Complete detection result
interface WingDetectionResult {
  wings: Wing[];
  intersections: WingIntersection[];
  isSimpleBar: boolean;
  shape: 'bar' | 'L' | 'U' | 'V' | 'H' | 'snake' | 'courtyard' | 'complex';
}
```

### 7.2 Constants (`src/algorithm/constants.ts`, lines 397-402)

```typescript
WING_DETECTION: {
  angleToleranceDegrees: 5,       // Edges within 5° are same direction
  minWingLength: 30 * FEET_TO_METERS,  // ~9.1m minimum to count as a wing
  maxInnerZoneDepth: 30 * FEET_TO_METERS,
  straightAngleTolerance: 10      // ±10° from 180° counts as "straight"
}
```

### 7.3 Placement Zones (`src/algorithm/types.ts`, lines 255-261)

The `PlacementZone` enum already includes wing-aware zones:

```typescript
enum PlacementZone {
  CORRIDOR_END = 'CORRIDOR_END',     // Ends of corridor → 3BR, 2BR (L-shaped)
  OUTER_CORNER = 'OUTER_CORNER',     // Outer wing intersection → 3BR, 2BR
  CORE_ADJACENT = 'CORE_ADJACENT',   // Next to a core → 2BR, 1BR
  INNER_CORNER = 'INNER_CORNER',     // Inner wing intersection → cores ONLY
  STANDARD = 'STANDARD'              // Mid-corridor → all types (rectangular)
}
```

`OUTER_CORNER` and `INNER_CORNER` are defined but never created by the current code.

### 7.4 Enhanced Core Block (`src/algorithm/types.ts`, lines 443-449)

```typescript
interface EnhancedCoreBlock extends Omit<CoreBlock, 'type'> {
  type: 'End' | 'Mid' | 'WingIntersection';  // <-- 'WingIntersection' is new
  intersectionId?: number;
}
```

This exists but the algorithm only uses the regular `CoreBlock` with `'End'` and `'Mid'` types.

### 7.5 Feature Specification (Appendix C)

`docs/planning/feature-spec.md`, lines 1741-1864 contains a fully detailed wing detection algorithm (5 steps):

1. **Edge Analysis**: Group edges by direction, find dominant directions
2. **Corner Classification**: Label each vertex as CONVEX, CONCAVE, or STRAIGHT
3. **Wing Identification**: Walk the polygon, grouping edges by direction, splitting at inner corners
4. **Wing Properties**: Calculate bounding box, primary axis, width, centerline for each wing
5. **Intersection Properties**: Identify meeting points, angles, inner/outer zones

**Read this appendix carefully — it is the most detailed specification we have.**

### 7.6 Placement Zone Eligibility (`src/algorithm/constants.ts`, lines 367-390)

Which unit types can go where:

```
CORRIDOR_END:   3BR, 2BR only (L-shaped preferred)
OUTER_CORNER:   3BR, 2BR only (L-shaped preferred)
CORE_ADJACENT:  2BR, 1BR, 3BR
INNER_CORNER:   Cores and utilities ONLY — no residential units
STANDARD:       All types (rectangular only)
```

---

## 8. The Sub-Problems You Need to Solve

Here is a breakdown of the distinct problems, roughly in dependency order (earlier ones must be solved before later ones can work).

### Problem 1: Extracting the Actual Building Polygon

**Current state**: `footprint.ts` takes raw 3D mesh triangles and outputs a simple bounding box (width, depth, center, rotation). It uses a convex hull, which fills in concave regions and destroys the shape.

**What's needed**: Extract the **actual polygon** of the building footprint — including concave corners. The output needs to be an ordered array of vertices that describe the real building outline, not just a bounding box.

**Why it's hard**:
- The input is raw triangles from a 3D mesh, not a clean polygon
- Ground-level triangles need to be identified and their edges merged into a single polygon
- The polygon may have small imperfections (tiny edges, nearly-collinear vertices) that need cleaning
- The `BuildingFootprint` type needs to be extended to carry polygon data alongside the existing bounding box data (to avoid breaking existing bar-building code)

**Relevant files**: `src/algorithm/footprint.ts`, `src/algorithm/types.ts` (BuildingFootprint interface)

---

### Problem 2: Detecting Wings from the Polygon

**Current state**: No wing detection code exists. Types are defined but unused.

**What's needed**: A function that takes the building polygon and returns a `WingDetectionResult`:
- Which vertices are convex vs concave vs straight
- Which groups of edges form distinct wings
- Where wings intersect (and whether each intersection is inner or outer)
- The overall building shape classification (bar, L, U, V, H, etc.)

**Why it's hard**:
- Real-world polygons are messy — edges might not be perfectly horizontal/vertical
- You need to handle angle tolerance (edges within 5° of each other = same direction)
- Minimum wing length threshold (30 ft) — short jogs shouldn't count as separate wings
- V-shaped buildings have non-90° angles between wings
- The algorithm spec in Appendix C is detailed but untested — there will be edge cases

**Relevant files**: `src/algorithm/types.ts` (Wing, WingIntersection, WingDetectionResult types), `src/algorithm/constants.ts` (WING_DETECTION config), `docs/planning/feature-spec.md` Appendix C

---

### Problem 3: Processing Each Wing as a Mini-Bar-Building

**Current state**: The generator treats the entire building as one corridor with segments.

**What's needed**: A way to run the existing bar-building algorithm **per wing**. Each wing is essentially a small rectangular building with:
- Its own length (wing length)
- Its own depth (wing width)
- Its own rentable depth: `(wingWidth - corridorWidth) / 2`
- Its own centerline (for corridor routing)

The challenge is coordinating across wings: unit counts need to be distributed proportionally, and the total must match the building-wide targets.

**Why it's hard**:
- Different wings may have different widths → different unit depths → different ideal unit widths
- The unit count algorithm currently calculates one global set of counts. It needs to distribute counts across wings proportionally to their corridor length.
- Wings share a unit mix target — 3BR units placed at wing intersections count toward the global 3BR percentage
- If you just run the bar algorithm independently per wing, the unit mixes won't add up correctly

**Relevant files**: `src/algorithm/generator-core.ts` (the entire pipeline), `src/algorithm/unit-counts.ts`

---

### Problem 4: Core Placement at Wing Intersections

**Current state**: Cores are only placed at positions along a single X axis: left end, right end, and optionally middle.

**What's needed**:
- Place "wing intersection cores" at inner corners (concave vertices)
- These cores serve as egress points for both wings that meet at that intersection
- Each wing also needs its own end cores (at the end furthest from the intersection)
- Long wings may still need mid-cores (if travel distance would exceed the limit)

**Why it's hard**:
- An inner corner zone is not a simple rectangle — it's shaped by the angle between the wings
- The inner corner core position affects how much of each wing's corridor it serves
- Egress rules must be checked per-wing: every point on every wing must be within travel distance of a core
- The `CoreBlock` type uses `'End' | 'Mid'` — you need to extend this to include `'WingIntersection'` (the `EnhancedCoreBlock` type already exists for this)

**Relevant files**: `src/algorithm/types.ts` (EnhancedCoreBlock), `src/algorithm/constants.ts` (egress rules)

---

### Problem 5: Corridor Path Through Multiple Wings

**Current state**: Corridor is a single rectangle: `{ x, y, width: corridorLength, depth: corridorWidth }`.

**What's needed**: The corridor needs to be a **polyline** (or polygon) that follows the centerline of each wing and connects them at intersections. For an L-shaped building:

```
Wing 1 corridor: horizontal line from left end to intersection
Intersection: 90° turn
Wing 2 corridor: vertical line from intersection to bottom end
```

**Why it's hard**:
- The corridor polygon at a turn is not a simple rectangle — it's an L-shape or more complex
- The corridor width must be maintained around corners (the inner and outer edges of the corridor at a turn form different arcs)
- Unit placement on either side of the corridor needs to know which direction the corridor is going at that point
- The corridor polygon needs to be correct for both rendering and for the baking step that exports to Forma

**Relevant files**: `src/algorithm/types.ts` (CorridorBlock), `src/algorithm/renderer.ts`, `src/extension/bake-building.ts`

---

### Problem 6: Unit Placement at Wing Corners

**Current state**: Units at the building ends are special — they become L-shaped to absorb corridor void space. This only handles the two ends of a bar.

**What's needed**: At wing intersections:
- **Outer corner**: Place a premium unit (3BR or 2BR) that wraps around the corner with an L-shape. This unit has two facades and extra area.
- **Inner corner**: Do NOT place residential units. This zone is reserved for the wing intersection core.

**Why it's hard**:
- The L-shaped unit at an outer corner spans two wings. Its two "legs" may have different depths if the wings have different widths.
- How do you calculate the area of a unit that wraps around a corner at a non-90° angle? (V-shaped buildings)
- The current L-shape code handles exactly 6-point polygons with a specific structure. Wing corner units may need different polygon constructions.
- Corridor void absorption at wing intersections is more complex than at bar ends

**Relevant files**: `src/algorithm/generator-core.ts` (lines ~1916-1983 for current corridor void absorption), `src/algorithm/renderer.ts` (triangulateLShape function)

---

### Problem 7: Egress Validation Along a Non-Straight Path

**Current state**: Dead-end and travel distance are calculated as simple X-axis distances.

**What's needed**: Egress distances need to be measured along the actual corridor path. A person at the end of Wing 2 in an L-shaped building walks:

```
[end of Wing 2] → along Wing 2 corridor → turn at intersection → along Wing 1 corridor → [core]
```

This is a path distance, not a straight-line distance.

**Why it's hard**:
- You need a "distance along corridor" function that works on a polyline
- Dead-end distance is from the wing end to the nearest core, measured along the corridor
- Travel distance is from any point to the nearest core, measured along the corridor
- With multiple wings and multiple cores, you need to find the shortest path from each point to any core
- The corridor path might not be the shortest — in some configurations, walking through units to a closer core in an adjacent wing could be shorter (but the code doesn't model this)

**Relevant files**: `src/algorithm/generator-core.ts` (lines ~2057-2083)

---

### Problem 8: Statistics for Non-Rectangular Footprints

**Current state**: `GSF = length * buildingDepth` (a simple rectangle area).

**What's needed**: GSF should be the actual area of the building polygon. This is a straightforward polygon area calculation (Shoelace formula) but requires having the actual polygon from Problem 1.

**Relevant files**: `src/algorithm/generator-core.ts` (line 2045)

---

### Problem 9: Rendering Arbitrary Unit Polygons

**Current state**: The renderer handles rectangles (4-vertex, 2 triangles) and L-shapes (6-vertex, 4 triangles). The L-shape decomposition is hardcoded to split into exactly 2 quads.

**What's needed**: A general polygon triangulation function that can handle any convex or concave polygon. There is already a `triangulateConvex` helper, but it only works for convex shapes. Wing corner units are concave (L-shaped or more complex).

**Why it's hard**:
- Concave polygon triangulation is a well-known computer graphics problem
- Fan triangulation (which `triangulateConvex` uses) creates overlapping triangles for concave shapes
- You could use ear-clipping triangulation or decompose into convex sub-polygons
- Performance matters — this runs for every unit on every floor during rendering

**Relevant files**: `src/algorithm/renderer.ts` (lines 106-194)

---

## 9. Files You Must Read

Before you start designing a solution, read these files **in this order**:

### Understand the domain
1. **`docs/planning/feature-spec.md`** — The complete feature specification. Sections 5-8 explain the algorithm in detail. **Appendix C** (line 1741) has the wing detection algorithm. **Appendix D** has the unit placement algorithm.

2. **`docs/planning/PRD.md`** — Product requirements. Understand what we're building and why.

3. **`docs/ALGORITHM.md`** — Shorter algorithm overview with diagrams.

### Understand the types
4. **`src/algorithm/types.ts`** — All TypeScript interfaces. Pay special attention to:
   - `BuildingFootprint` (line ~210) — what the footprint extraction produces today
   - `Wing`, `WingIntersection`, `WingDetectionResult` (lines 289-367) — pre-defined but unused types
   - `PlacementZone` (line ~255) — zone classification including wing-aware zones
   - `UnitBlock`, `CoreBlock`, `CorridorBlock` (lines ~131-175) — the output data structures

5. **`src/algorithm/constants.ts`** — All magic numbers and configuration. Look at:
   - `WING_DETECTION` (line ~397) — pre-defined constants for wing detection
   - Unit dimensions, egress limits, placement zone eligibility

### Understand the current implementation
6. **`src/algorithm/footprint.ts`** — Current footprint extraction (convex hull approach). This is what you'll need to replace/extend.

7. **`src/algorithm/generator-core.ts`** — The main algorithm pipeline (~2300 lines). Read the full `generateFloorplate()` function starting at line 1373. Understand each of the 14 steps.

8. **`src/algorithm/renderer.ts`** — How units are turned into visual meshes. Understand `triangulateLShape` and `createRectangleMesh`.

9. **`src/algorithm/unit-counts.ts`** — How global unit counts are calculated from the mix percentages.

10. **`src/extension/bake-building.ts`** — How generated layouts are exported to Forma's native format.

---

## 10. Constraints and Rules to Respect

### Architectural Constraints
- **Backward compatibility is mandatory**: Bar buildings (simple rectangles) must continue to work exactly as they do today. If a building has no concave corners, the system should detect `isSimpleBar: true` and use the existing pipeline unchanged.
- **The types in `types.ts` already exist**: Use `Wing`, `WingIntersection`, `WingDetectionResult`, `PlacementZone`, `EnhancedCoreBlock`, etc. Do not reinvent them unless you have a strong reason to change their shape.
- **The constants in `constants.ts` are deliberate**: Values like `minWingLength: 30ft`, `angleToleranceDegrees: 5`, and the placement zone eligibility rules come from architectural standards and the product spec. Do not change them without discussion.

### Unit Placement Rules
- **3BR and 2BR** are the only types that can be L-shaped
- **Studios can NEVER be L-shaped** and have **0% flexibility** (rigid sizing)
- **Inner corners (concave) are for cores/utilities ONLY** — never place residential units there
- **Outer corners (convex) are premium** — place the largest eligible unit type (3BR preferred)
- Every corridor segment must have at least 1 unit (no empty segments)
- Units can never be smaller than their target size (expansion is OK, compression is not)

### Egress Rules
- Minimum 2 cores per building
- Max dead-end corridor: 50 ft (sprinklered) / 20 ft (unsprinklered)
- Max travel distance to nearest core: 250 ft (sprinklered) / 200 ft (unsprinklered)
- Exit separation: cores must be at least 1/3 of building diagonal apart (sprinklered)

### Code Quality
- Write tests for any new functions you add
- Keep the existing test suite passing (`src/algorithm/generator-core.test.ts`, `src/algorithm/renderer.test.ts`)
- Prefer extending existing interfaces over replacing them
- The module structure should stay clean: one file per responsibility
