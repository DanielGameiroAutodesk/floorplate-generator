# Floorplate Generator for Multifamily Residential Buildings
## Comprehensive Feature Description for Autodesk Forma Extension

**Document Version:** 1.0
**Target Audience:** Junior developers with no architecture domain expertise
**Product:** Autodesk Forma Extension
**Market:** United States Multifamily Residential Buildings

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Glossary of Terms](#2-glossary-of-terms)
3. [What Problem Does This Solve?](#3-what-problem-does-this-solve)
4. [How the Extension Works - User Workflow](#4-how-the-extension-works---user-workflow)
5. [Building Shape and Geometry](#5-building-shape-and-geometry)
6. [The Three Main Components](#6-the-three-main-components)
7. [User Interface Specification](#7-user-interface-specification)
8. [The Generation Algorithm](#8-the-generation-algorithm)
9. [Means of Egress Rules](#9-means-of-egress-rules)
10. [Demising Wall Alignment](#10-demising-wall-alignment)
11. [Output and Metrics](#11-output-and-metrics)
12. [Technical Implementation](#12-technical-implementation)
13. [Edge Cases and Error Handling](#13-edge-cases-and-error-handling)
14. [Future Enhancements](#14-future-enhancements)

**Appendices:**
- [Appendix A: Default Values](#appendix-a-default-values)
- [Appendix B: Glossary Quick Reference](#appendix-b-glossary-quick-reference)
- [Appendix C: Detailed Wing Detection Algorithm](#appendix-c-detailed-wing-detection-algorithm)
- [Appendix D: Detailed Unit Placement Algorithm](#appendix-d-detailed-unit-placement-algorithm)
- [Appendix E: Detailed Wall Alignment Formula](#appendix-e-detailed-wall-alignment-formula)
- [Appendix F: Additional Edge Cases and Error Handling](#appendix-f-additional-edge-cases-and-error-handling)

---

## 1. Executive Summary

### What is a Floorplate Generator?

Imagine you're an architect designing a large apartment building. You have a building outline (the "footprint") and you need to figure out how to divide the interior into:
- Individual apartments of different sizes (studios, 1-bedrooms, 2-bedrooms, 3-bedrooms)
- Hallways (corridors) so residents can walk to their apartments
- Stairwells and elevator shafts (cores) for emergency exits and vertical movement

Doing this manually takes hours. You need to ensure:
- The right mix of apartment sizes (e.g., 20% studios, 40% 1-bedrooms)
- Compliance with fire safety regulations (how far can someone walk to an exit?)
- Efficient use of space (maximize rentable area, minimize hallways)

**This extension automates all of that.** The user provides a building shape and their requirements, and the algorithm generates optimized floorplate layouts in seconds.

### Key Features
- Automatically generates apartment layouts based on user-defined unit mix
- Ensures compliance with US building code egress requirements
- Supports simple rectangular buildings AND complex multi-wing shapes (L, U, V, snake)
- Generates 3 alternative options using different algorithmic approaches
- Interactive corridor editing with node manipulation
- Releases final design as native Forma building elements

---

## 2. Glossary of Terms

Understanding these terms is essential before reading further:

### Building Components

| Term | Definition |
|------|------------|
| **Floorplate** | The 2D layout of one floor of a building, showing the arrangement of all spaces |
| **Footprint** | The 2D outline/boundary of a building when viewed from above |
| **Wing** | A distinct section of a building that extends from a central point. A V-shaped building has 2 wings. |
| **Bar Building** | A simple, elongated rectangular building shape |
| **Double-Loaded Corridor** | A hallway with apartments on BOTH sides (like a hotel hallway) |

### Apartment Units

| Term | Definition |
|------|------------|
| **Studio** | Smallest apartment type - one room that serves as living/sleeping area, plus bathroom and kitchen |
| **1BR / 1-Bedroom** | Apartment with a separate bedroom |
| **2BR / 2-Bedroom** | Apartment with two separate bedrooms |
| **3BR / 3-Bedroom** | Apartment with three separate bedrooms |
| **Unit Mix** | The percentage distribution of different apartment types (e.g., 20% studio, 40% 1BR, 30% 2BR, 10% 3BR) |
| **L-Shaped Unit** | An apartment whose floor plan forms an "L" shape instead of a rectangle |

### Building Infrastructure

| Term | Definition |
|------|------------|
| **Core** | A vertical shaft containing stairs, elevators, and sometimes mechanical equipment. Residents use cores to move between floors and exit the building. |
| **Corridor** | The horizontal hallway that provides access to apartments on a floor |
| **Demising Wall** | The wall that separates two adjacent apartments |
| **Facade** | The exterior wall of the building that faces outside |
| **Partition Wall** | Any interior wall that divides spaces |

### Measurements

| Term | Definition |
|------|------------|
| **Imperial System** | US measurement system using feet (ft) and inches (in). This extension uses feet. |
| **sf / sq ft** | Square feet - unit of area measurement |
| **GSF** | Gross Square Footage - total floor area including ALL spaces (apartments, corridors, cores, walls) |
| **NRSF** | Net Rentable Square Footage - only the area that can be rented (apartments only) |
| **Efficiency** | NRSF ÷ GSF × 100%. Higher is better. Typical range: 75-85%. |

### Fire Safety (Egress)

| Term | Definition |
|------|------------|
| **Egress** | The path a person takes to exit a building during an emergency |
| **Means of Egress** | The complete system of exits including doors, corridors, and stairs |
| **Travel Distance** | The walking distance from any point to the nearest exit |
| **Common Path of Egress** | The distance a person must travel BEFORE they have a choice of two different exit paths |
| **Dead-End Corridor** | A hallway section where you can only go one direction (no exit at the end) |
| **Sprinklered Building** | A building with automatic fire sprinklers. Almost all new US buildings have these. Allows more lenient egress rules. |

---

## 3. What Problem Does This Solve?

### The Manual Process Today

When an architect designs a multifamily building floorplate manually, they must:

1. **Draw the corridor** - Decide where the main hallway goes
2. **Place the cores** - Figure out where stairwells go to meet fire code
3. **Calculate egress** - Verify no one is too far from an exit
4. **Divide into units** - Partition the remaining space into apartments
5. **Match the program** - Ensure the unit mix matches what the developer wants
6. **Calculate areas** - Measure each apartment to verify sizes
7. **Iterate** - Repeat steps 2-6 many times as the design changes

This process can take **4-8 hours** per iteration.

### The Automated Process

With this extension:
1. User provides building shape and requirements
2. Algorithm generates 3 optimized options in **seconds**
3. User picks favorite and makes small adjustments
4. Final design is exported to Forma

**Time savings: 90%+**

### Who Uses This?

- **Architects** during early design phases
- **Developers** exploring building feasibility
- **Urban planners** evaluating site capacity

---

## 4. How the Extension Works - User Workflow

### Step-by-Step User Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER WORKFLOW                               │
└─────────────────────────────────────────────────────────────────────┘

STEP 1: Prerequisite
┌─────────────────────────────────────────────────────────────────────┐
│  User already has a building in Forma Site Design                   │
│  (created using native Forma tools)                                 │
│                                                                     │
│  The building has:                                                  │
│  • A footprint shape                                                │
│  • A height (from which we know floor count)                        │
│  • Floor-to-floor dimensions                                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 2: Install & Open Extension
┌─────────────────────────────────────────────────────────────────────┐
│  User clicks Extensions icon in left menu                           │
│  → Finds "Floorplate Generator"                                     │
│  → Adds to project                                                  │
│  → Extension appears in left panel                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 3: Configure Inputs (Side Panel)
┌─────────────────────────────────────────────────────────────────────┐
│  UNITS SECTION                                                      │
│  ├─ Studio:    [20]%  Size: [590] sf  Color: [■]                   │
│  ├─ 1-Bedroom: [40]%  Size: [885] sf  Color: [■]                   │
│  ├─ 2-Bedroom: [30]%  Size: [1180] sf Color: [■]                   │
│  └─ 3-Bedroom: [10]%  Size: [1475] sf Color: [■]                   │
│                                                                     │
│  UTILITIES                                                          │
│  └─ Minimum Size: [5] ft (for trash/mechanical rooms)              │
│                                                                     │
│  EGRESS SECTION                                                     │
│  ├─ Building Type:            [● Sprinklered  ○ Unsprinklered]     │
│  ├─ Travel Distance (Max):    [250] ft                             │
│  ├─ Common Path (Max):        [125] ft                             │
│  └─ Dead-End Corridor (Max):  [50] ft                              │
│                                                                     │
│  CONSTRAINTS SECTION                                                │
│  ├─ Corridor Width:           [5] ft                               │
│  ├─ End Core Dimensions:      [20] × [25] ft                       │
│  ├─ Middle Core Dimensions:   [18] × [22] ft                       │
│  ├─ Wing Intersection Core:   [22] × [28] ft                       │
│  ├─ Corridor End Extension:   [6] ft                               │
│  ├─ Number of Cores:          [Auto ▼] or [Fixed: 3]               │
│  ├─ Core Side:                [North ▼]                            │
│  └─ Wall Alignment Strictness: [■■■■■□□□□□] 50%                    │
│                                                                     │
│  PRESETS                                                            │
│  [Affordable Housing] [Market Rate] [Luxury] [+ Save Custom]       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 4: Select Building
┌─────────────────────────────────────────────────────────────────────┐
│  User clicks [Select Building] button                               │
│  → Clicks on one building in Forma canvas                           │
│  → Building becomes selected (highlighted)                          │
│  → Only ONE building can be selected                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 5: Generation View (Floating Panel)
┌─────────────────────────────────────────────────────────────────────┐
│  A floating panel opens showing:                                    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    2D FLOORPLATE VIEW                         │ │
│  │                                                                │ │
│  │    ┌──────┬──────┬────┬──────┬──────┬────┬──────┬──────┐     │ │
│  │    │Studio│ 1BR  │CORE│ 2BR  │ 1BR  │CORE│ 3BR  │ 2BR  │     │ │
│  │    │ 590  │ 885  │    │ 1180 │ 885  │    │ 1520 │ 1180 │     │ │
│  │    ├──────┴──────┴────┴──────┴──────┴────┴──────┴──────┤     │ │
│  │    │            C O R R I D O R                        │     │ │
│  │    ├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──┤     │ │
│  │    │ 1BR  │Studio│ 1BR  │ 2BR  │ 1BR  │ 2BR  │ 1BR  │3B│     │ │
│  │    │ 885  │ 590  │ 885  │ 1180 │ 885  │ 1180 │ 885  │  │     │ │
│  │    └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──┘     │ │
│  │                                                                │ │
│  │  [Zoom +] [Zoom -] [Fit]    Mouse: scroll=zoom, drag=pan      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  OPTIONS: [Option 1 ●] [Option 2 ○] [Option 3 ○]                   │
│                                                                     │
│  METRICS                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Total Units: 48            │ Efficiency: 82.3%              │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Mix Distribution:          │ Target    │ Actual   │ Status  │   │
│  │ Studios:                   │ 20%       │ 19.2%    │ ✓       │   │
│  │ 1-Bedroom:                 │ 40%       │ 41.7%    │ ✓       │   │
│  │ 2-Bedroom:                 │ 30%       │ 29.2%    │ ✓       │   │
│  │ 3-Bedroom:                 │ 10%       │ 10.4%    │ ✓       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ GSF: 58,240 sf  │  NRSF: 47,932 sf  │  Efficiency: 82.3%   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  CORRIDOR EDITING                                                   │
│  • Drag nodes to reposition corridor                                │
│  • Double-click to add new node                                     │
│  • Right-click node to delete                                       │
│                                                                     │
│  [Undo] [Redo]        [Save Option]       [Cancel] [Release]        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 6: Save Favorites
┌─────────────────────────────────────────────────────────────────────┐
│  User can SAVE any option they like:                                │
│  • Click [Save Option] to save current view to the side panel       │
│  • Saved options appear in a list in the left panel                 │
│  • User can explore many variations, save favorites                 │
│  • Later, user can select any saved option to release               │
│                                                                     │
│  SAVED OPTIONS (in Side Panel):                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📁 Saved Floorplates                                       │   │
│  │  ├─ Option A (82.3% eff, 48 units) [Preview] [Delete]       │   │
│  │  ├─ Option B (84.1% eff, 46 units) [Preview] [Delete]       │   │
│  │  └─ Option C (81.7% eff, 50 units) [Preview] [Delete]       │   │
│  │                                                              │   │
│  │  [Release Selected]                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 7: Iterate
┌─────────────────────────────────────────────────────────────────────┐
│  User can:                                                          │
│  • Switch between 3 generated options                               │
│  • Go back to side panel to adjust inputs                           │
│  • Manually edit corridor path by dragging nodes                    │
│  • Each change triggers re-generation                               │
│  • Save any option they like to the favorites list                  │
│  • Full undo/redo support                                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 8: Release
┌─────────────────────────────────────────────────────────────────────┐
│  User clicks [Release]                                              │
│  → Design is "baked" into Forma as a native building element        │
│  → Floating panel closes                                            │
│  → User can re-open extension to generate new variations            │
│                                                                     │
│  Released building contains:                                        │
│  • Floorplate geometry                                              │
│  • Unit regions with:                                               │
│    - function: "residential"                                        │
│    - unit_type: "corridor" | "core" | "living unit"                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Building Shape and Geometry

### Supported Building Shapes

The extension supports various building footprint shapes. All are variations of "bar" buildings (elongated rectangles) that may have multiple wings.

```
SIMPLE BAR (1 Wing)
┌──────────────────────────────────────┐
│                                      │
│                                      │
└──────────────────────────────────────┘

L-SHAPE (2 Wings)
┌──────────────────────────────────────┐
│                                      │
│                    ┌─────────────────┘
│                    │
│                    │
└────────────────────┘

V-SHAPE (2 Wings)
            ┌──────────────────┐
           /                    \
          /                      \
         /                        \
        /                          \
       /                            \
      └──────────────────────────────┘

U-SHAPE (3 Wings)
┌────────────────────┐    ┌────────────────────┐
│                    │    │                    │
│                    │    │                    │
│                    └────┘                    │
│                                              │
│                                              │
└──────────────────────────────────────────────┘

SNAKE (4+ Wings)
┌──────────────────┐
│                  │
│                  └──────────────────┐
│                                     │
│      ┌──────────────────────────────┘
│      │
│      │
└──────┘

ENCLOSED COURTYARD
┌──────────────────────────────────────┐
│                                      │
│      ┌────────────────────────┐      │
│      │                        │      │
│      │      COURTYARD         │      │
│      │                        │      │
│      └────────────────────────┘      │
│                                      │
└──────────────────────────────────────┘
```

### Wing Detection

The algorithm automatically analyzes the building footprint geometry to identify:

1. **Wings** - Distinct rectangular sections
2. **Wing Intersections** - Where two wings meet (corners)
3. **Inner Corners** - Dark areas at wing intersections (good for cores/utilities)
4. **Outer Corners** - Premium corner positions with dual facade access (good for large units)

```
Example: L-Shaped Building Wing Detection

                    WING 1
            ┌─────────────────────┐
            │                     │
            │                     │
            │         ●──────────►│  ← Outer corner
            │         │           │    (premium, 2 facades)
            └─────────┼───────────┘
                      │
            ┌─────────┼───────────┐
            │         │           │
            │◄────────●           │  ← Inner corner
            │                     │    (dark, for cores)
            │                     │
            │       WING 2        │
            └─────────────────────┘
```

### Building Input Data

When the user selects a building in Forma, the extension extracts:

| Property | Source | Example |
|----------|--------|---------|
| Footprint shape | Building geometry | Polygon coordinates |
| Building height | Building element | 120 ft |
| Floor-to-floor height | Building element | 10 ft |
| Number of floors | Calculated: height ÷ floor height | 12 floors |
| Building width | Measured from footprint | 70 ft |

---

## 6. The Three Main Components

Every generated floorplate consists of three types of components:

### 6.1 Corridors

**What they are:** The horizontal hallways that provide access to all apartments on a floor.

**Key characteristics:**
- Run along the CENTER of the building (double-loaded = apartments on both sides)
- Defined by a centerline that can be a polyline (multiple segments for complex shapes)
- User can adjust corridor path by manipulating nodes
- Do NOT extend all the way to the building facade (premium end space goes to units)
- Typically end 6 feet past the last demising wall (user-configurable)

```
Building Cross-Section (looking down the corridor):

        NORTH SIDE
    ┌────────────────────┐
    │                    │
    │     UNIT           │  ← Unit depth
    │                    │
    ├────────────────────┤
    │     CORRIDOR       │  ← Corridor width (default 5ft)
    ├────────────────────┤
    │                    │
    │     UNIT           │  ← Unit depth
    │                    │
    └────────────────────┘
        SOUTH SIDE

    ◄───────────────────►
        Building Width
```

**Corridor Extension Logic:**

```
                          Facade
                            │
    ┌──────┬──────┬──────┬──│
    │      │      │ END  │  │
    │ Unit │ Unit │ UNIT │◄─┼─ End unit absorbs corridor space
    │      │      │(L-sh)│  │   and becomes L-shaped
    ├──────┴──────┴──────┤  │
    │    CORRIDOR        │←─┼─ Corridor ends 6ft past last demising wall
    ├──────┬──────┬──────┤  │
    │      │      │ END  │  │
    │ Unit │ Unit │ UNIT │  │
    └──────┴──────┴──────┴──│
                            │
                          Facade
```

### 6.2 Cores

**What they are:** Vertical shafts containing stairs and elevators that allow people to:
- Move between floors
- Exit the building in emergencies

**Types of cores (with user-configurable dimensions):**

| Core Type | Typical Location | Purpose |
|-----------|-----------------|---------|
| End Core | Near ends of corridors (but not AT the end) | Primary egress, limits dead-end length |
| Middle Core | Spaced along corridor to meet travel distance | Additional egress for longer buildings |
| Wing Intersection Core | At inner corners where wings meet | Egress at complex junctions |

**Core Placement Rules:**

1. **End cores** are placed near (not at) corridor ends
   - Distance from corridor end limited by Dead-End Corridor maximum
   - Must allow end unit to have facade access

2. **Middle cores** are placed to ensure:
   - No point on the floor exceeds maximum Travel Distance to an exit
   - Cores are separated by at least 1/3 of floor diagonal (sprinklered buildings)

3. **Wing intersection cores** are placed at inner corners (dark areas)
   - These are dark spaces anyway, so cores make good use of them
   - Often placed at all inner corners of complex building shapes

```
Core Placement Example (U-Shaped Building):

    ┌─────────────────────────────┐  ┌─────────────────────────────┐
    │                             │  │                             │
    │  END                   ┌────┘  └────┐                   END  │
    │  CORE                  │            │                  CORE  │
    │  ■                     │            │                     ■  │
    │                        │   INNER    │                        │
    │                        │   CORE     │                        │
    │                        │     ■      │                        │
    │                        └────────────┘                        │
    │                                                              │
    │                                                              │
    └──────────────────────────────────────────────────────────────┘

    Legend:
    ■ = Core position
```

**Core Side Selection:**

By default, cores are placed on ONE side of the corridor (e.g., North side). User can flip this in constraints. Exception: Wing intersection cores always go at the inner corner regardless of side setting.

### 6.3 Units (Apartments)

**What they are:** The actual living spaces that residents rent/buy.

**Unit Types and Constraints:**

| Unit Type | Target Size (sf) | Shape Flexibility | L-Shape Allowed? |
|-----------|------------------|-------------------|------------------|
| Studio | ~590 | NONE (rigid) | NEVER |
| 1-Bedroom | ~885 | Very little | Only exceptional situations |
| 2-Bedroom | ~1,180 | Moderate | Yes, acceptable |
| 3-Bedroom | ~1,475 | High (flexible) | Yes, expected |

**Why shape flexibility matters:**

The algorithm needs to fit units together like puzzle pieces. Larger units can be "squeezed" or "stretched" slightly to make things fit. Smaller units (studios) cannot be adjusted without making them unlivable.

**Unit Sizing:**

```
Unit Area = Width × Depth

Where:
- Depth = (Building Width - Corridor Width) ÷ 2
- Width = Target Area ÷ Depth

Example:
- Building width: 70 ft
- Corridor width: 5 ft
- Unit depth: (70 - 5) ÷ 2 = 32.5 ft
- For a 1BR with 885 sf target:
  Width = 885 ÷ 32.5 = 27.2 ft
```

**Unit Placement Strategy:**

```
PLACEMENT PRIORITY MAP:

    ┌───────────────────────────────────────────┐
    │  OUTER CORNER                             │
    │  (2+ facades)          FACADE ACCESS      │
    │  Best for: 3BR     ┌──────────────────────┤
    │                    │                      │
    │                    │  MID-BUILDING        │
    │                    │  (1 facade)          │
    │                    │  Best for: Studios,  │
    │  INNER CORNER      │  1BR, 2BR            │
    │  (dark)            │                      │
    │  Best for: Cores,  │                      │
    │  Utilities         └──────────────────────┤
    │                                           │
    │  END OF CORRIDOR                          │
    │  (2 facades + premium)                    │
    │  Best for: 3BR, 2BR                       │
    └───────────────────────────────────────────┘
```

**L-Shaped Units:**

L-shaped units occur at:
1. **End of corridors** - Unit absorbs the space where corridor would have extended
2. **Next to cores** - If core doesn't extend to facade, adjacent unit fills the gap
3. **Wing intersections** - Outer corner units wrap around the corner

```
L-Shaped Unit at Corridor End:

    ┌─────────────────────────┬─────────────────┐
    │                         │                 │
    │         UNIT            │                 │
    │       (rectangular)     │                 │
    │                         │                 │
    ├─────────────────────────┤                 │
    │     CORRIDOR            │   END UNIT      │
    │                   ──────┤   (L-shaped)    │
    ├─────────────────────────┘                 │
    │                                           │
    │         UNIT (L-shaped)                   │
    │                                           │
    └───────────────────────────────────────────┘
```

### 6.4 Utilities

**What they are:** Support spaces in dark areas that cannot be apartments (no daylight access).

**Characteristics:**
- Minimum size: 5 ft (user-configurable)
- Placed in leftover spaces and inner corners
- In Forma: assigned `unit_type: "core"` (workaround due to Forma limitations)
- Examples: trash rooms, electrical rooms, storage

---

## 7. User Interface Specification

### 7.1 Side Panel (Left Menu)

The side panel appears when the user opens the extension. It contains all input configuration.

#### Units Section

```
┌─────────────────────────────────────────────────────────────────┐
│  UNITS                                                     [?]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Unit Type     Mix %      Target Size     Color                 │
│  ─────────────────────────────────────────────────────          │
│  Studio        [20   ]%   [590    ] sf    [■ Blue ▼]           │
│  1-Bedroom     [40   ]%   [885    ] sf    [■ Green▼]           │
│  2-Bedroom     [30   ]%   [1180   ] sf    [■ Yellow▼]          │
│  3-Bedroom     [10   ]%   [1475   ] sf    [■ Orange▼]          │
│                ────────                                         │
│  Total:         100 %                                           │
│                                                                 │
│  ⚠ Mix must equal 100%. Currently: 100% ✓                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  UTILITIES                                                      │
│  Minimum Size: [5     ] ft                                      │
│  Color:        [■ Gray ▼]                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Validation Rules:**
- Mix percentages must sum to exactly 100%
- All sizes must be positive numbers
- Colors must be distinct for visual clarity

#### Egress Section

```
┌─────────────────────────────────────────────────────────────────┐
│  EGRESS                                                    [?]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Building Type:        [● Sprinklered  ○ Unsprinklered]        │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Measurement              │ Unsprinklered │ Sprinklered     ││
│  ├──────────────────────────┼───────────────┼─────────────────┤│
│  │ Travel Distance (Max)    │ 200 ft        │ [250    ] ft    ││
│  │ Common Path (Max)        │ 75 ft         │ [125    ] ft    ││
│  │ Dead-End Corridor (Max)  │ 20 ft         │ [50     ] ft    ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Note: Grayed values show defaults. Select building type to    │
│  enable/disable editing.                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Egress Presets:**

| Building Type | Travel Distance | Common Path | Dead-End |
|--------------|-----------------|-------------|----------|
| Sprinklered | 250 ft | 125 ft | 50 ft |
| Unsprinklered | 200 ft | 75 ft | 20 ft |

#### Constraints Section

```
┌─────────────────────────────────────────────────────────────────┐
│  CONSTRAINTS                                               [?]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CORRIDOR                                                       │
│  Width:                     [5      ] ft                        │
│  End Extension:             [6      ] ft                        │
│                                                                 │
│  CORES                                                          │
│  End Core:                  [20     ] × [25     ] ft           │
│  Middle Core:               [18     ] × [22     ] ft           │
│  Wing Intersection Core:    [22     ] × [28     ] ft           │
│                                                                 │
│  Number of Cores:           [● Auto    ○ Fixed: [   ] ]        │
│  Core Side:                 [North ▼]                          │
│                                                                 │
│  WALL ALIGNMENT                                                 │
│  Strictness: [■■■■■□□□□□] 50%                                  │
│              Loose ◄────────────► Strict                        │
│                                                                 │
│  ℹ Loose: Optimize unit sizes                                  │
│    Strict: Align walls across corridor                          │
└─────────────────────────────────────────────────────────────────┘
```

#### Presets Section

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESETS                                                   [?]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Built-in:                                                      │
│  [Affordable Housing] [Market Rate] [Luxury]                   │
│                                                                 │
│  Custom:                                                        │
│  [My Project 1 ▼] [My Project 2 ▼]                             │
│                                                                 │
│  [+ Save Current as Preset]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Built-in Preset Values:**

| Preset | Studios | 1BR | 2BR | 3BR |
|--------|---------|-----|-----|-----|
| Affordable Housing | 30% @ 550sf | 40% @ 750sf | 25% @ 1000sf | 5% @ 1200sf |
| Market Rate | 20% @ 590sf | 40% @ 885sf | 30% @ 1180sf | 10% @ 1475sf |
| Luxury | 10% @ 650sf | 30% @ 950sf | 35% @ 1400sf | 25% @ 1800sf |

#### Building Selection

```
┌─────────────────────────────────────────────────────────────────┐
│  BUILDING                                                  [?]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Selected: [None]                                               │
│                                                                 │
│  [Select Building]                                              │
│                                                                 │
│  Instructions: Click on a building in Forma to select it.      │
│  Only one building can be selected at a time.                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

After selection:

```
┌─────────────────────────────────────────────────────────────────┐
│  BUILDING                                                  [?]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Selected: Building_042 ✓                                       │
│                                                                 │
│  Properties:                                                    │
│  • Footprint: 14,200 sf                                        │
│  • Height: 120 ft                                               │
│  • Floors: 12                                                   │
│  • Shape: L-shaped (2 wings)                                   │
│                                                                 │
│  [Change Building] [Generate ▶]                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Floating Panel (Generation View)

Opens when user clicks "Generate" after selecting a building.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Floorplate Generator                               [_] [□] [×]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                               │ │
│  │                    2D FLOORPLATE VIEW                         │ │
│  │                                                               │ │
│  │   ┌─────────────────────────────────────────────────────┐    │ │
│  │   │                                                     │    │ │
│  │   │  [Interactive 2D view with:                         │    │ │
│  │   │   - Colored units by type                           │    │ │
│  │   │   - Labels showing unit type + actual size          │    │ │
│  │   │   - Corridor highlighted                            │    │ │
│  │   │   - Cores in distinct color                         │    │ │
│  │   │   - Draggable corridor nodes                        │    │ │
│  │   │   - Zoom/pan controls]                              │    │ │
│  │   │                                                     │    │ │
│  │   └─────────────────────────────────────────────────────┘    │ │
│  │                                                               │ │
│  │   [+] [-] [Fit to View]       Scroll: zoom, Drag: pan        │ │
│  │                                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  OPTIONS                                                            │
│  [● Option 1] [○ Option 2] [○ Option 3]                           │
│                                                                     │
│  METRICS                                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ SUMMARY                          │ STATUS                    │  │
│  │ Total Units: 48                  │ ✓ All egress compliant    │  │
│  │ GSF: 58,240 sf                   │ ✓ Mix within tolerance    │  │
│  │ NRSF: 47,932 sf                  │                           │  │
│  │ Efficiency: 82.3%                │                           │  │
│  ├──────────────────────────────────┴───────────────────────────┤  │
│  │ MIX DISTRIBUTION                                             │  │
│  │                     Target      Actual      Diff    Status   │  │
│  │ Studios:            20%         19.2%       -0.8%   ✓        │  │
│  │ 1-Bedroom:          40%         41.7%       +1.7%   ✓        │  │
│  │ 2-Bedroom:          30%         29.2%       -0.8%   ✓        │  │
│  │ 3-Bedroom:          10%         10.4%       +0.4%   ✓        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  CORRIDOR EDITING                                                   │
│  • Drag nodes to reposition                                         │
│  • Double-click to add node                                         │
│  • Right-click to delete node                                       │
│                                                                     │
│  [Undo] [Redo]                                   [Cancel] [Release] │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Tooltip (Hover Information)

When user hovers over a unit in the 2D view:

```
┌────────────────────────────────────────┐
│  2-BEDROOM                             │
├────────────────────────────────────────┤
│  Area:        1,195 sf                 │
│  Dimensions:  36.8 ft × 32.5 ft        │
│  Shape:       Rectangular              │
│                                        │
│  EGRESS                                │
│  Distance to nearest exit: 87 ft ✓     │
│  Common path: 62 ft ✓                  │
│  Status: COMPLIANT                     │
└────────────────────────────────────────┘
```

---

## 8. The Generation Algorithm

### 8.1 Algorithm Overview

The generation algorithm produces **3 different options** using variant approaches, running in **parallel** for speed.

```
┌───────────────────────────────────────────────────────────────────┐
│                    GENERATION PIPELINE                            │
└───────────────────────────────────────────────────────────────────┘

    INPUT                    PROCESSING                    OUTPUT
    ─────                    ──────────                    ──────

┌─────────────┐         ┌─────────────────┐         ┌─────────────┐
│ Building    │         │ 1. Wing         │         │             │
│ Footprint   │────────▶│    Detection    │         │   Option    │
└─────────────┘         └────────┬────────┘         │     1       │
                                 │                   │             │
┌─────────────┐         ┌────────▼────────┐         ├─────────────┤
│ Unit Mix &  │         │ 2. Corridor     │         │             │
│ Sizes       │────────▶│    Generation   │────────▶│   Option    │
└─────────────┘         └────────┬────────┘    ┌───▶│     2       │
                                 │             │    │             │
┌─────────────┐         ┌────────▼────────┐    │    ├─────────────┤
│ Egress      │         │ 3. Core         │    │    │             │
│ Constraints │────────▶│    Placement    │────┘    │   Option    │
└─────────────┘         └────────┬────────┘    ┌───▶│     3       │
                                 │             │    │             │
┌─────────────┐         ┌────────▼────────┐    │    └─────────────┘
│ Other       │         │ 4. Unit         │────┘
│ Constraints │────────▶│    Placement    │
└─────────────┘         └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │ 5. Wall         │
                        │    Alignment    │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │ 6. Validation   │
                        │    & Metrics    │
                        └─────────────────┘
```

### 8.2 Step 1: Wing Detection

**Input:** Building footprint polygon
**Output:** List of wings with their boundaries and intersection points

**Algorithm:**
1. Analyze footprint geometry to identify rectangular segments
2. Detect direction changes in the building outline
3. Group segments into distinct wings
4. Identify intersection points (where wings meet)
5. Classify corners as "inner" (concave, dark) or "outer" (convex, premium)

```
Example L-Shape Analysis:

Input Polygon:
    A─────────────────────B
    │                     │
    │                     │
    │        F────────────C
    │        │
    │        │
    E────────D

Output:
    Wings: [
        {id: 1, vertices: [A,B,C,F], direction: "horizontal"},
        {id: 2, vertices: [F,C,D,E], direction: "vertical"}
    ]
    Intersections: [
        {point: F, type: "inner_corner", wings: [1,2]},
        {point: C, type: "outer_corner", wings: [1,2]}
    ]
```

### 8.3 Step 2: Corridor Generation

**Input:** Wings, building width, corridor width
**Output:** Corridor centerline polyline

**Algorithm:**
1. For each wing, calculate the centerline
2. Connect centerlines at wing intersections
3. Terminate corridors at configurable distance from facade
4. Ensure continuous path through all wings

**Unit Depth Calculation:**
```
For each side of corridor:
    Unit Depth = (Building Width - Corridor Width) / 2

Example:
    Building Width = 70 ft
    Corridor Width = 5 ft
    Unit Depth = (70 - 5) / 2 = 32.5 ft per side
```

### 8.4 Step 3: Core Placement

**Input:** Corridor path, egress constraints, core dimensions
**Output:** List of core positions and types

**Algorithm:**

```
1. PLACE END CORES (at both ends of each wing):
   - Position = corridor_end - dead_end_max
   - This ensures dead-end corridor length is within limits
   - Place on designated side of corridor

2. CHECK EXIT SEPARATION:
   - Calculate floor diagonal using actual floor polygon
   - Required separation = diagonal × (1/3 for sprinklered, 1/2 for unsprinklered)
   - Verify end cores meet separation requirement

3. PLACE WING INTERSECTION CORES:
   - For each inner corner identified in Step 1
   - Place core at inner corner (dark area)
   - These serve as middle cores for long buildings

4. CALCULATE IF MORE CORES NEEDED:
   - For each point on corridor, calculate distance to nearest core
   - If any point exceeds Travel Distance max, add middle core
   - Optimize core positions to minimize total cores while meeting constraints

5. IF USER SPECIFIED FIXED CORE COUNT:
   - Use specified count instead of calculated
   - Distribute cores evenly along corridor
   - Verify egress compliance (warn if non-compliant)
```

**Exit Separation Calculation:**
```
Floor Diagonal = longest straight line between any two points on floor perimeter
               (can pass outside the building for U/L shapes)

Example U-Shape:
    ┌────┐    ┌────┐
    │    │    │    │
    │    └────┘    │
    │              │
    │              │
    └──────────────┘

    Diagonal = line from top-left to top-right corner
             = passes through courtyard (outside building)

    Required Separation = Diagonal × 1/3 (sprinklered)
```

### 8.5 Step 4: Unit Placement

**Input:** Available space (corridor + cores defined), unit mix/sizes
**Output:** Unit positions and shapes

**Algorithm:**

```
1. CALCULATE TARGET UNIT COUNT:
   - Total floor area (minus corridor, cores)
   - Average unit size from mix
   - Approximate unit count = available area / avg unit size

2. CALCULATE UNITS PER TYPE:
   - For each type: count = total_count × percentage
   - Round to whole numbers ensuring total matches

3. IDENTIFY PLACEMENT ZONES:
   - End zones: corridor ends (2 facades - for 3BR/2BR)
   - Outer corners: wing intersections outer side (2 facades - for 3BR)
   - Inner corners: near cores (dark - avoid placing desirable units)
   - Standard zones: mid-corridor (1 facade - for Studios/1BR/2BR)

4. PLACE UNITS (priority order):

   a) Place 3-Bedroom units first:
      - At corridor ends (L-shaped to absorb corridor space)
      - At outer corners of wing intersections
      - These get dual facade access

   b) Place 2-Bedroom units:
      - Remaining end positions
      - Remaining corner positions
      - Standard positions as needed

   c) Place 1-Bedroom units:
      - Standard mid-corridor positions
      - Mostly rectangular

   d) Place Studios last:
      - Standard mid-corridor positions
      - ALWAYS rectangular (no flexibility)

5. SIZE EACH UNIT:
   - Width = Target Area / Unit Depth
   - For L-shaped units: calculate combined area of both segments
   - L-shaped units can exceed target to absorb leftover space
```

**Flexibility Model for Sizing:**

```
When units don't fit perfectly, the algorithm can adjust widths:

STUDIOS:
    Flexibility = ±0%
    Must hit exact target size
    If doesn't fit, try different arrangement

1-BEDROOM:
    Flexibility = ±2%
    Can squeeze/stretch slightly
    Only rectangular

2-BEDROOM:
    Flexibility = ±5%
    Moderate adjustment allowed
    Can be L-shaped

3-BEDROOM:
    Flexibility = ±10%
    High adjustment allowed
    Expected to be L-shaped at ends/corners
    Can exceed target to fill space
```

### 8.6 Step 5: Demising Wall Alignment

**Input:** Unit layout, alignment strictness (0-100%)
**Output:** Adjusted unit widths with aligned walls

**The Problem:**
Units on opposite sides of the corridor often have different sizes. A 600sf Studio across from a 900sf 1BR means their walls don't align, creating a "staggered" look.

```
Without Alignment (0%):

    ┌───────22ft────────┬─────────33ft────────┬──────22ft──────┐
    │     Studio        │      1-Bedroom      │    Studio      │
    │     600sf         │        900sf        │     600sf      │
    ├───────────────────┴─────────────────────┴────────────────┤
    │                        CORRIDOR                          │
    ├──────────28ft──────────┬──────────28ft──────────┬────────┤
    │      1-Bedroom         │      1-Bedroom         │  etc.  │
    │        900sf           │        900sf           │        │
    └────────────────────────┴────────────────────────┴────────┘
                              ▲
                              │
                    Walls don't align
```

**The Solution:**

```
With Alignment (100%):

    ┌─────────28ft──────────┬──────────28ft──────────┬─────────┐
    │     Studio            │      1-Bedroom         │ Studio  │
    │     640sf (+6.7%)     │        840sf (-6.7%)   │  640sf  │
    ├───────────────────────┴────────────────────────┴─────────┤
    │                        CORRIDOR                          │
    ├─────────28ft──────────┬──────────28ft──────────┬─────────┤
    │      1-Bedroom        │      1-Bedroom         │  etc.   │
    │        900sf          │        900sf           │         │
    └───────────────────────┴────────────────────────┴─────────┘
                              ▲
                              │
                    Walls align perfectly
```

**Algorithm:**

```
1. DESIGNATE MASTER/SLAVE SIDES:
   - Master side: where cores are located
   - Slave side: opposite side

2. GENERATE MASTER SIDE FIRST:
   - Units fit to cores and structural constraints
   - Create list of partition wall positions

3. FOR EACH WALL ON SLAVE SIDE:
   - Find nearest wall on master side
   - Calculate distance to snap

4. APPLY "MAGNETIC PULL" BASED ON SLIDER:
   - At 0%: No adjustment (walls staggered)
   - At 50%: Partial adjustment where flexibility allows
   - At 100%: Maximum adjustment within flexibility limits

5. RESPECT FLEXIBILITY LIMITS:
   - Studio: Cannot adjust (skip alignment)
   - 1BR: Max ±2% adjustment
   - 2BR: Max ±5% adjustment
   - 3BR: Max ±10% adjustment (use these as "accordions")

6. IF ALIGNMENT WOULD VIOLATE FLEXIBILITY:
   - Skip that specific wall
   - Keep unit at ideal size
   - Move to next wall
```

### 8.7 Step 6: Validation and Metrics

**Input:** Complete layout
**Output:** Validation status, metrics, warnings

**Egress Validation:**
```
For each unit:
    1. Calculate distance to nearest core (exit)
    2. Check: distance ≤ Travel Distance Max?
    3. Calculate common path (unit depth × 1.2 + corridor distance to choice)
    4. Check: common path ≤ Common Path Max?
    5. Check: dead-end corridor length ≤ Dead-End Max?

If all pass → "Compliant"
If any fail → "Non-compliant" + warning
```

**Mix Validation:**
```
For each unit type:
    actual_percentage = (count of type / total units) × 100
    difference = actual_percentage - target_percentage

    If |difference| ≤ 5% (tolerance):
        status = "Within tolerance" ✓
    Else:
        status = "Outside tolerance" ⚠
```

**Metrics Calculation:**
```
GSF = Total footprint area (including walls)
NRSF = Sum of (unit areas where unit_type = "living unit")
Efficiency = (NRSF / GSF) × 100%
```

### 8.8 The Three Algorithm Variants

The generator produces 3 options using different approaches:

| Option | Algorithm Focus | Behavior |
|--------|----------------|----------|
| **Option 1** | **Balanced** | Equal priority to mix accuracy, size accuracy, and efficiency |
| **Option 2** | **Mix Optimized** | Prioritizes hitting exact unit mix percentages, may sacrifice some size accuracy |
| **Option 3** | **Efficiency Optimized** | Prioritizes building efficiency (NRSF/GSF), may sacrifice some mix accuracy |

Each variant uses the same core algorithm but with different weighting in the optimization function.

---

## 9. Means of Egress Rules

### 9.1 Background

"Egress" means "exit" - specifically, the path a person takes to escape a building during an emergency (fire, earthquake, etc.).

In the US, these rules come from the **International Building Code (IBC)**, specifically for **Group R-2 Occupancy** (multi-family residential: apartments, condos, dorms).

### 9.2 Key Rules This Extension Enforces

#### Rule 1: Number of Exits

**Requirement:** Every floor needs at least 2 independent exits (cores with stairs)

**Exception:** Single exit allowed if ALL of these are true:
- Maximum 4 stories
- Maximum 4 dwelling units per floor
- Building is fully sprinklered

**How the extension handles this:**
- Default: Places minimum 2 cores
- User can force single core if building meets exception criteria

#### Rule 2: Travel Distance

**Definition:** Maximum walking distance from ANY point on the floor to the nearest exit.

| Building Type | Maximum Travel Distance |
|---------------|------------------------|
| Unsprinklered | 200 ft |
| Sprinklered | 250 ft |

**How the extension handles this:**
- Calculates distance from every point to nearest core
- Places additional cores if any point exceeds maximum
- Shows distance on unit tooltip

#### Rule 3: Common Path of Egress

**Definition:** The distance a person travels BEFORE they have a choice of two different directions to two different exits.

| Building Type | Maximum Common Path |
|---------------|---------------------|
| Unsprinklered | 75 ft |
| Sprinklered | 125 ft |

**How the extension calculates this:**
```
Common Path = (Unit Depth × 1.2) + (Corridor distance until choice point)

Where:
- Unit Depth × 1.2 = internal path within apartment (with 20% factor for turns)
- Corridor distance until choice point = distance walking in corridor before
  reaching a spot where two different exits are accessible in different directions
```

**Visual Example:**
```
                          Core A
                            │
    ┌────────────┬──────────┼──────────┬────────────┐
    │   UNIT     │          │          │   UNIT     │
    │            │          │          │            │
    ├────────────┴──────────┼──────────┴────────────┤
    │                       │                       │
    │      C O R R I D O R  │◄─ Choice point        │
    │                       │   (can go left or     │
    ├─────────────┬─────────┼───right from here)   ─┤
    │             │         │                       │
    │    UNIT     │         │                       │
    │    ●────────┼─────────►                       │
    │   Start     │   Common Path                   │
    └─────────────┴─────────┴───────────────────────┘
```

#### Rule 4: Dead-End Corridor

**Definition:** A corridor section where you can only go ONE direction (no exit at the end).

| Building Type | Maximum Dead-End Length |
|---------------|------------------------|
| Unsprinklered | 20 ft |
| Sprinklered | 50 ft |

**How the extension handles this:**
- Places end cores within dead-end maximum from corridor end
- Example: If dead-end max is 50ft, end core must be within 50ft of corridor end

```
    ┌──────────────────────────────────────────────────────┐
    │                                                      │
    │                                                      │
    ├──────────────────────────────────────────────────────┤
    │  ◄───── Dead-end corridor ────►│     Core    │      │
    │            (max 50ft)          │             │      │
    ├──────────────────────────────────────────────────────┤
    │                                                      │
    │                                                      │
    └──────────────────────────────────────────────────────┘
```

#### Rule 5: Exit Separation

**Definition:** If two exits are required, they cannot be right next to each other (defeating the purpose of two exits).

| Building Type | Required Separation |
|---------------|---------------------|
| Unsprinklered | ≥ 1/2 of floor diagonal |
| Sprinklered | ≥ 1/3 of floor diagonal |

**How to measure the diagonal:**
- Draw the longest possible straight line between any two points on the floor perimeter
- This line CAN pass outside the building (e.g., across a courtyard in a U-shaped building)

**Example:**
```
U-Shaped Building:

    ┌────────────┐        ┌────────────┐
    │    Core    │        │    Core    │
    │      ●─────┼────────┼─────●      │
    │            │        │            │
    │            └────────┘            │
    │                                  │
    │                                  │
    └──────────────────────────────────┘
          ◄───── separation ─────►

    Floor Diagonal = line from top-left to top-right
                   = ~80ft (passes through open courtyard)

    Required Separation = 80 × (1/3) = 26.7 ft
    Actual Separation = 60 ft ✓ (exceeds requirement)
```

### 9.3 Corridor Width

**Requirement:** Minimum corridor width is 44 inches (3.67 feet)

**How the extension handles this:**
- Default corridor width is 5 feet
- User cannot set width below 4 feet
- Warning if set below 5 feet (may feel cramped)

---

## 10. Demising Wall Alignment

### 10.1 What is Demising Wall Alignment?

In a double-loaded corridor building, apartments on opposite sides of the hallway have walls (demising walls) that separate them from their neighbors.

If you're standing in the corridor and looking at the walls on both sides:
- With NO alignment: walls appear randomly positioned, creating a visually chaotic pattern
- With FULL alignment: walls on both sides line up, creating a clean, structured appearance

### 10.2 Why Does Alignment Matter?

1. **Structural efficiency** - Aligned walls can share structural columns
2. **Construction cost** - Aligned walls simplify framing and MEP (mechanical/electrical/plumbing) coordination
3. **Visual aesthetics** - Aligned walls look more intentional in floor plans

### 10.3 The Trade-off

Alignment comes at a cost: to make walls line up, units must be slightly resized.

```
Perfect sizing (no alignment):
    Studio: exactly 590 sf as requested

Aligned (some adjustment):
    Studio: 605 sf (+2.5%) because it was stretched to align with the 1BR across the hall
```

### 10.4 How the Slider Works

```
0% (Loose)                              100% (Strict)
───────────────────●────────────────────────────────►
                  50%
                (default)

0%: Every unit is exactly its target size
    Result: Walls are staggered across corridor
    Best for: When exact unit sizes are critical

50%: Balanced approach
    Result: Larger units adjust to align where possible
    Best for: Most projects (default)

100%: Maximum alignment
    Result: All walls that CAN align, DO align
    Best for: When structural coordination is critical
```

### 10.5 Master/Slave Concept

The algorithm processes one side of the corridor first (the "Master" side), then adjusts the other side (the "Slave" side) to match.

**Master Side Selection:**
- The side where cores are located becomes the Master
- Reason: Cores have fixed dimensions and positions, so units must fit around them

**Process:**
```
1. Generate Master side units (fitting around cores)
2. Record all demising wall positions on Master side
3. Generate Slave side units at their ideal sizes
4. For each Slave wall, find nearest Master wall
5. If within alignment tolerance, snap Slave wall to Master position
6. Adjust affected unit sizes accordingly
```

---

## 11. Output and Metrics

### 11.1 Displayed Metrics

When viewing a generated option, the user sees:

| Metric | Description | Example |
|--------|-------------|---------|
| **Total Units** | Number of apartments on one floor | 48 |
| **GSF** | Gross Square Footage (total floor area) | 58,240 sf |
| **NRSF** | Net Rentable Square Footage (apartments only) | 47,932 sf |
| **Efficiency** | NRSF ÷ GSF × 100% | 82.3% |

### 11.2 Mix Comparison

| Unit Type | Target | Actual | Difference | Status |
|-----------|--------|--------|------------|--------|
| Studios | 20% | 19.2% | -0.8% | ✓ Within tolerance |
| 1-Bedroom | 40% | 41.7% | +1.7% | ✓ Within tolerance |
| 2-Bedroom | 30% | 29.2% | -0.8% | ✓ Within tolerance |
| 3-Bedroom | 10% | 10.4% | +0.4% | ✓ Within tolerance |

**Tolerance:** ±5% from target is acceptable.

### 11.3 Forma Output

When user clicks "Release", the extension creates a native Forma building element with:

```
Building Element
└── Floorplate (per floor)
    ├── Unit Regions
    │   ├── Living Unit (Studio) - function: residential, unit_type: living unit
    │   ├── Living Unit (1BR) - function: residential, unit_type: living unit
    │   ├── Living Unit (2BR) - function: residential, unit_type: living unit
    │   ├── Living Unit (3BR) - function: residential, unit_type: living unit
    │   ├── Corridor - function: residential, unit_type: corridor
    │   ├── Core - function: residential, unit_type: core
    │   └── Utility - function: residential, unit_type: core
    └── (repeats for each floor)
```

**Unit Type Mapping:**

| Space Type | Forma function | Forma unit_type |
|------------|---------------|-----------------|
| Apartment (any size) | residential | living unit |
| Corridor | residential | corridor |
| Core (stairs/elevator) | residential | core |
| Utility (trash, electrical) | residential | core |

Note: Utilities use `unit_type: core` as a workaround because Forma Site Design doesn't have a better option.

---

## 12. Technical Implementation

### 12.1 Extension Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FORMA PLATFORM                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    FORMA UI                                │  │
│  │                                                            │  │
│  │   ┌──────────────┐         ┌──────────────────────────┐   │  │
│  │   │  Left Panel  │         │    Floating Panel         │   │  │
│  │   │  (Extension  │         │    (Generation View)      │   │  │
│  │   │   Config)    │         │                           │   │  │
│  │   │              │         │    - 2D Canvas            │   │  │
│  │   │  - Units     │         │    - Metrics              │   │  │
│  │   │  - Egress    │◄────────┤    - Corridor Editor      │   │  │
│  │   │  - Constraints        │    - Options               │   │  │
│  │   │              │         │                           │   │  │
│  │   └──────────────┘         └──────────────────────────┘   │  │
│  │           │                            │                   │  │
│  └───────────┼────────────────────────────┼───────────────────┘  │
│              │                            │                      │
│              ▼                            ▼                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              FORMA EMBEDDED VIEW SDK                       │  │
│  │                                                            │  │
│  │  - Forma.proposal.*          - Get/set building geometry  │  │
│  │  - Forma.geometry.*          - Create/modify elements     │  │
│  │  - Forma.render.*            - Render 2D graphics         │  │
│  │  - Forma.designTool.*        - Drawing/selection tools    │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    YOUR HOSTED EXTENSION                         │
│                    (e.g., Vercel/Netlify)                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │   Frontend (React/Vue/Vanilla JS)                          │  │
│  │   ├── UI Components                                        │  │
│  │   ├── State Management                                     │  │
│  │   └── Forma SDK Integration                                │  │
│  │                                                            │  │
│  │   Generation Engine (JavaScript)                           │  │
│  │   ├── Wing Detection Algorithm                             │  │
│  │   ├── Corridor Generation                                  │  │
│  │   ├── Core Placement                                       │  │
│  │   ├── Unit Placement                                       │  │
│  │   ├── Wall Alignment                                       │  │
│  │   └── Validation                                           │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 12.2 Extension Configuration

**Extension ID:** `b364a24b-7943-42ae-abb9-6cbb1680e154`
**Name:** Floorplate Generator
**Entry Point:** Left Menu Panel
**Panel Type:** Floating panel for generation view

**Embedded View URL:** The URL of your hosted frontend (e.g., `https://your-app.vercel.app`)

### 12.3 Key SDK Methods Used

```javascript
// Get selected building geometry
const building = await Forma.proposal.getSelectedElements();
const geometry = await Forma.geometry.getTriangles(building);

// Get building properties
const properties = await Forma.element.getProperties(building.id);

// Create drawing tool for selection
await Forma.designTool.polygon.select();

// Render 2D graphics in floating panel
Forma.render.drawPolygon(coordinates, style);

// Create new element in Forma
await Forma.proposal.createElement({
    type: "building",
    geometry: generatedGeometry,
    properties: unitMetadata
});
```

### 12.4 Hosting

The extension frontend is hosted on a cloud platform (Vercel, Netlify, etc.) and loaded into Forma via iframe.

**Requirements:**
- HTTPS enabled
- CORS configured for Forma domains
- Fast loading (affects user experience)

---

## 13. Edge Cases and Error Handling

### 13.1 Building Validation

When user selects a building, validate:

| Check | Condition | Action if Fails |
|-------|-----------|-----------------|
| Shape complexity | Building has parseable polygonal footprint | Warning: "Complex shape - results may be suboptimal" |
| Minimum width | Building width ≥ (2 × min unit depth + corridor width) | Warning: "Building too narrow for double-loaded corridor" |
| Maximum floor count | User hasn't exceeded practical limits | Info: "Generating for typical floor only" |

### 13.2 Constraint Conflicts

When constraints conflict:

```
Example: User requests...
- 50% Studios (need small widths)
- 50% 3BR (need large widths)
- 100% wall alignment

Problem: This combination may be impossible

Action:
1. Generate best attempt
2. Show warning: "Unable to achieve 100% wall alignment while meeting unit mix"
3. Suggest: "Try reducing alignment to 70% or adjusting unit mix"
```

### 13.3 Egress Impossibilities

When egress rules cannot be met:

```
Example: Very long narrow building

Problem: Travel distance exceeds max even with max cores

Action:
1. Place maximum practical cores
2. Show warning: "Travel distance exceeds maximum (285ft vs 250ft limit)"
3. Highlight affected areas in red
4. Suggest: "Consider shortening building or adding wing"
```

### 13.4 Mix Impossibilities

When unit mix cannot be achieved:

```
Example: Building fits 10 units, user requests 10% 3BR

Problem: 10% of 10 = 1 unit, but building can only fit 3BR at corners/ends (0 available)

Action:
1. Generate without 3BR
2. Show warning: "Unable to place 3BR units (no dual-facade positions available)"
3. Show actual vs target in metrics
```

---

## 14. Future Enhancements

These features are NOT in the MVP but are documented for future development:

### 14.1 Ground Floor Variation
- Different layout for ground floor (retail, lobby, amenities)
- Different unit mix per floor
- Podium + tower configurations

### 14.2 Advanced Unit Types
- Townhouse/duplex units spanning multiple floors
- Live/work units with commercial component
- ADA-compliant unit requirements

### 14.3 Structural Grid Integration
- Snap unit widths to structural grid (e.g., 4ft modules)
- Column placement visualization
- Coordination with structural engineering

### 14.4 MEP Shaft Placement
- Vertical shaft locations for plumbing/HVAC
- Kitchen/bathroom stacking optimization
- Shaft sizing based on unit count

### 14.5 Parking Integration
- Automatic parking level generation
- Unit-to-parking ratio calculations
- Ramp and drive aisle placement

---

## Appendix A: Default Values

### Unit Mix Defaults (Market Rate Preset)

| Unit Type | Percentage | Target Size (sf) |
|-----------|------------|------------------|
| Studio | 20% | 590 |
| 1-Bedroom | 40% | 885 |
| 2-Bedroom | 30% | 1,180 |
| 3-Bedroom | 10% | 1,475 |

### Egress Defaults (Sprinklered)

| Constraint | Default Value |
|------------|---------------|
| Travel Distance Max | 250 ft |
| Common Path Max | 125 ft |
| Dead-End Corridor Max | 50 ft |
| Internal Path Factor | 1.2× |

### Dimensional Defaults

| Dimension | Default Value |
|-----------|---------------|
| Corridor Width | 5 ft |
| Corridor End Extension | 6 ft |
| End Core | 20 × 25 ft |
| Middle Core | 18 × 22 ft |
| Wing Intersection Core | 22 × 28 ft |
| Utility Minimum | 5 ft |
| Wall Alignment Strictness | 50% |

---

## Appendix B: Glossary Quick Reference

| Term | Quick Definition |
|------|-----------------|
| Bar Building | Simple rectangular building shape |
| Common Path | Distance before having exit choice |
| Core | Stair/elevator shaft |
| Dead-End | Corridor section with only one exit direction |
| Demising Wall | Wall between apartments |
| Double-Loaded | Corridor with units on both sides |
| Egress | Exit path |
| Efficiency | NRSF ÷ GSF |
| Floorplate | 2D layout of one floor |
| GSF | Total floor area |
| L-Shaped | Apartment with two rectangular sections at 90° |
| NRSF | Rentable apartment area only |
| Sprinklered | Building with fire sprinklers |
| Travel Distance | Walking distance to nearest exit |
| Unit Mix | Percentage distribution of apartment types |
| Wing | Distinct section of a multi-wing building |

---

## Appendix C: Detailed Wing Detection Algorithm

### C.1 Overview

The wing detection algorithm analyzes a building footprint polygon to identify distinct rectangular sections (wings) and their intersections. This is crucial for proper corridor routing and core placement.

### C.2 Algorithm Steps

```
WING DETECTION ALGORITHM

INPUT: Footprint polygon as array of vertices [(x1,y1), (x2,y2), ...]
OUTPUT: Wings[], Intersections[]

STEP 1: EDGE ANALYSIS
─────────────────────
For each edge in polygon:
    1. Calculate edge direction (angle from horizontal)
    2. Calculate edge length
    3. Group edges by direction (±5° tolerance)
    4. Identify dominant directions (typically 2: horizontal and vertical)

STEP 2: CORNER CLASSIFICATION
─────────────────────────────
For each vertex in polygon:
    1. Calculate interior angle
    2. If angle < 180°: CONVEX (outer corner)
    3. If angle > 180°: CONCAVE (inner corner)
    4. If angle ≈ 180°: STRAIGHT (not a corner)

    Interior Angle Calculation:
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │   angle = atan2(edge2.y, edge2.x) -                │
    │           atan2(edge1.y, edge1.x)                  │
    │                                                     │
    │   Normalize to 0-360° range                        │
    │                                                     │
    └─────────────────────────────────────────────────────┘

STEP 3: WING IDENTIFICATION
───────────────────────────
1. Start at any outer corner
2. Walk along edges, grouping consecutive edges with same dominant direction
3. When direction changes by 90° at an inner corner, start new wing
4. Continue until returning to start vertex

Example Walk for L-Shape:

    Start at A, walk clockwise:

    A─────────────────────B     Edge AB: horizontal → Wing 1
    │                     │     Edge BC: vertical   → Wing 1 continues
    │                     │                            (outer corner, same wing)
    │        F────────────C     Edge CF: horizontal → Wing 1 ends
    │        │                  Edge FD: vertical   → Wing 2 starts (inner corner!)
    │        │
    E────────D                  Edge DE: horizontal → Wing 2 continues
                                Edge EA: vertical   → Wing 2 continues

    Result: 2 wings meeting at inner corner F

STEP 4: WING PROPERTIES
───────────────────────
For each wing:
    1. Calculate bounding box
    2. Identify primary axis (longest dimension)
    3. Calculate wing width (perpendicular to primary axis)
    4. Identify facade edges (exterior)
    5. Calculate centerline for corridor routing

STEP 5: INTERSECTION PROPERTIES
───────────────────────────────
For each wing intersection:
    1. Identify meeting point (inner corner vertex)
    2. Identify the two wings that meet
    3. Calculate intersection angle (90°, 120°, etc.)
    4. Identify inner corner zone (for core/utility placement)
    5. Identify outer corner zone (for premium units)

    Inner Corner Zone Calculation:
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │   The "dark zone" at inner corners extends:         │
    │   - Along wing 1: depth = min(wing1_width/2, 30ft) │
    │   - Along wing 2: depth = min(wing2_width/2, 30ft) │
    │                                                     │
    │   This creates a rectangular zone suitable for      │
    │   cores or utilities                                │
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

### C.3 Special Cases

```
TRIANGULAR CORNERS (V-shaped buildings):
────────────────────────────────────────
When wing intersection angle ≠ 90°:
- Calculate actual angle
- Inner zone becomes wedge-shaped
- May need custom core sizing

        ╲        ╱
         ╲  60° ╱
          ╲   ╱     Wing angle = 60°
           ╲ ╱      Inner zone is triangular
            ▼
           Core

CURVED SECTIONS:
────────────────
When building has curved facades:
- Approximate curve with line segments (every 5ft or 5°)
- Treat as multi-wing building with many small wings
- May produce suboptimal results (show warning)

BUILDINGS WITH HOLES (Courtyard with passage):
──────────────────────────────────────────────
When footprint has interior hole:
- Detect hole as separate polygon
- Treat hole boundary as interior facade
- Units along hole get "inner" facade access (less valuable)
```

---

## Appendix D: Detailed Unit Placement Algorithm

### D.1 Overview

The unit placement algorithm fills available floor space with apartments while meeting mix requirements, maximizing efficiency, and respecting placement rules.

### D.2 Algorithm Steps

```
UNIT PLACEMENT ALGORITHM

INPUT:
- Available floor area (total minus corridor/cores)
- Unit mix requirements (percentages and sizes)
- Placement rules (which units can go where)

OUTPUT:
- Unit positions and dimensions
- Actual mix achieved

STEP 1: CALCULATE TARGET UNIT COUNTS
────────────────────────────────────
1. Calculate total available linear frontage (facade length along corridor)
2. For each unit type, calculate average width:

   avg_width[type] = target_area[type] / unit_depth

3. Calculate theoretical total units:

   total_units = floor(total_frontage / weighted_avg_width)

4. Distribute by percentage:

   count[studio] = round(total_units × studio_percentage)
   count[1br] = round(total_units × 1br_percentage)
   ... etc

5. Adjust counts to ensure sum equals total_units
   (prioritize adjusting 3BR as most flexible)

STEP 2: IDENTIFY PLACEMENT ZONES
────────────────────────────────
Classify each segment of the corridor into zones:

Zone Type        │ Description                    │ Eligible Units
─────────────────┼────────────────────────────────┼──────────────────
CORRIDOR_END     │ Last 2 positions before end    │ 3BR, 2BR (L-shaped)
OUTER_CORNER     │ At outer wing intersections    │ 3BR, 2BR (L-shaped)
CORE_ADJACENT    │ Directly next to a core        │ 2BR, 1BR (may be L)
INNER_CORNER     │ At inner wing intersections    │ Cores, Utilities only
STANDARD         │ All other mid-corridor spots   │ All types (rectangular)

STEP 3: GREEDY PLACEMENT (MASTER SIDE)
──────────────────────────────────────
Starting from one end of corridor, place units on master side:

while (space_remaining AND units_remaining):
    1. Identify current zone type

    2. If CORRIDOR_END or OUTER_CORNER:
        - Place largest eligible unit (3BR preferred)
        - Shape: L-shaped to absorb extra space
        - Size: target + up to 20% extra

    3. If CORE_ADJACENT:
        - Place flexible unit (2BR, 1BR)
        - Shape: L-shaped if core doesn't reach facade
        - Size: exact target (use as "accordion")

    4. If STANDARD:
        - Use optimization to match remaining mix
        - Place whatever type is most under-target
        - Shape: Rectangular only
        - Size: exact target

    5. Update remaining counts and space

STEP 4: GREEDY PLACEMENT (SLAVE SIDE)
─────────────────────────────────────
Repeat Step 3 for slave side, with additional constraint:
- Track master side wall positions
- Attempt to align walls (see Wall Alignment algorithm)

STEP 5: OPTIMIZATION PASS
─────────────────────────
If mix targets not met within tolerance:
    1. Identify most over-target and under-target types
    2. Find swappable positions (same zone, similar size)
    3. Swap unit types if both remain code-compliant
    4. Repeat until within tolerance or no swaps improve

STEP 6: SIZE ADJUSTMENT
───────────────────────
For each unit, calculate final dimensions:

    Standard Rectangle:
        width = target_area / depth
        height = depth

    L-Shaped:
        primary_width = 0.6 × total_width (arbitrary split)
        secondary_width = 0.4 × total_width
        Adjust split to hit target_area (or exceed for corner units)
```

### D.3 Example Placement

```
Example: Simple bar building, 200ft corridor, 32.5ft depth per side

Target Mix: 20% Studio (590sf), 40% 1BR (885sf), 30% 2BR (1180sf), 10% 3BR (1475sf)

Calculation:
- Studio width: 590 / 32.5 = 18.2 ft
- 1BR width: 885 / 32.5 = 27.2 ft
- 2BR width: 1180 / 32.5 = 36.3 ft
- 3BR width: 1475 / 32.5 = 45.4 ft

- Weighted avg width: 0.2×18.2 + 0.4×27.2 + 0.3×36.3 + 0.1×45.4 = 29.0 ft
- Total units per side: 200 / 29 ≈ 6.9 → 7 units per side → 14 total

Distribution:
- Studios: 14 × 0.2 = 2.8 → 3 units
- 1BR: 14 × 0.4 = 5.6 → 6 units
- 2BR: 14 × 0.3 = 4.2 → 4 units
- 3BR: 14 × 0.1 = 1.4 → 1 unit

Placement (one side):
Position 1 (end):     3BR (L-shaped, 45ft wide)
Position 2:           2BR (rectangular, 36ft wide)
Position 3:           1BR (rectangular, 27ft wide)
Position 4:           Studio (rectangular, 18ft wide)
Position 5:           1BR (rectangular, 27ft wide)
Position 6:           2BR (rectangular, 36ft wide)
Position 7 (end):     1BR (L-shaped if at end, 27ft wide)

Total used: 45+36+27+18+27+36+27 = 216ft > 200ft
→ Need to compress! Reduce 2BR widths slightly, or eliminate one unit
```

---

## Appendix E: Detailed Wall Alignment Formula

### E.1 Overview

Wall alignment adjusts unit widths on the "slave" side of the corridor to align with wall positions on the "master" side, improving structural coordination.

### E.2 Mathematical Model

```
WALL ALIGNMENT FORMULA

DEFINITIONS:
─────────────
M[] = Array of wall positions on master side (measured from corridor start)
S[] = Array of wall positions on slave side (initial, before alignment)
S'[] = Array of wall positions on slave side (after alignment)
α = Alignment strictness (0 to 1, where 0=loose, 1=strict)
F[i] = Flexibility of unit at position i (depends on unit type)

FLEXIBILITY VALUES:
───────────────────
F[studio] = 0.00 (0% - cannot adjust)
F[1br] = 0.02 (±2% width adjustment allowed)
F[2br] = 0.05 (±5% width adjustment allowed)
F[3br] = 0.10 (±10% width adjustment allowed)

ALIGNMENT ALGORITHM:
────────────────────
For each wall position S[i] on slave side:

    1. Find nearest master wall:
       M_nearest = M[j] where |M[j] - S[i]| is minimized

    2. Calculate distance to align:
       d = M_nearest - S[i]

    3. Calculate maximum allowed shift:
       width_i = S[i] - S[i-1]  (width of unit before this wall)
       width_i+1 = S[i+1] - S[i]  (width of unit after this wall)

       max_shift_left = width_i × F[unit_type_i]
       max_shift_right = width_i+1 × F[unit_type_i+1]

       max_shift = min(max_shift_left, max_shift_right, |d|)

    4. Apply alignment based on strictness:
       actual_shift = α × max_shift × sign(d)

       S'[i] = S[i] + actual_shift

    5. Propagate changes:
       If wall moved, adjacent walls may need adjustment
       Repeat alignment for affected walls

EDGE CASES:
───────────
- If unit is Studio: max_shift = 0, wall cannot move
- If wall move would make unit too small (< min code): skip alignment
- If wall move would make unit too large (> max reasonable): cap at max
```

### E.3 Visual Example

```
Before Alignment (α = 0):
─────────────────────────
Master (North):  │  Studio  │    1BR    │  Core  │    2BR    │    1BR    │
                 0         18          45         X        81         117

Slave (South):   │    1BR    │    1BR    │    2BR    │  Studio  │
                 0          27          54          90        108

Wall positions:
Master: [18, 45, X, 81, 117]
Slave:  [27, 54, 90, 108]

Notice: No walls align across corridor.

After Alignment (α = 1.0, where possible):
──────────────────────────────────────────
Slave:   │    1BR    │    1BR    │    2BR    │  Studio  │
         0          27          54          90        108
                    ↓           ↓           ↓          ↓
Nearest: [18]      [45]       [81]       [108]
Distance: -9        -9         -9          0

Adjustment:
- Wall at 27: 1BR can flex ±2% (±0.54ft). Cannot reach 18. SKIP.
- Wall at 54: 1BR can flex ±2% (±0.54ft). Cannot reach 45. SKIP.
- Wall at 90: 2BR can flex ±5% (±1.8ft). Cannot reach 81. SKIP.
- Wall at 108: Already aligned!

Result with α=1.0: Only 1 wall aligns (limited flexibility)

With α=0.5:
- No forced alignment (since none can reach)
- Walls stay in original positions

BETTER APPROACH: Re-sequence units on slave side to achieve alignment
This is done in unit placement phase, not wall alignment phase.
```

---

## Appendix F: Additional Edge Cases and Error Handling

### F.1 Unusual Building Shapes

```
TRIANGULAR BUILDINGS
────────────────────
Detection: Polygon has exactly 3 vertices (or 3 dominant corners)
Behavior:
- Show warning: "Triangular buildings are not optimal for double-loaded corridors"
- Attempt generation: Place corridor along longest edge
- Result: Wedge-shaped units (non-standard, efficiency warning)

CIRCULAR/CURVED BUILDINGS
─────────────────────────
Detection: Edges have varying angles with no clear dominant directions
Behavior:
- Show warning: "Curved buildings produce irregular unit shapes"
- Approximate curve with polyline (10 segments minimum)
- Generate as multi-wing building
- Result: Trapezoidal units (non-standard)

VERY THIN BUILDINGS
───────────────────
Detection: Building width < (2 × minimum unit depth + corridor width)
           Typical minimum: < 50ft for residential
Behavior:
- Show error: "Building too narrow for double-loaded corridor"
- Suggestion: "Minimum width is 50ft. Consider single-loaded design (not supported)."
- Block generation

BUILDINGS WITH HOLES
────────────────────
Detection: Footprint polygon has one or more interior polygons (holes)
Behavior:
- Show warning: "Building has interior courtyard/atrium"
- Treat hole as interior facade (darker, less valuable)
- Place corridor away from hole
- Units adjacent to hole marked as "interior-facing"

CONCAVE BUILDINGS (severe indentations)
───────────────────────────────────────
Detection: Polygon has interior angles > 270°
Behavior:
- Identify severe indentation
- If indentation depth > corridor width: treat as wing intersection
- If shallow: place core/utility in indentation
```

### F.2 User Input Validation Errors

```
INPUT VALIDATION RULES
──────────────────────

UNIT MIX VALIDATION:
Error: Mix percentages sum to less than 100%
Message: "Unit mix totals {X}%. Must equal exactly 100%."
Action: Highlight percentage fields, prevent generation

Error: Mix percentages sum to more than 100%
Message: "Unit mix totals {X}%. Must equal exactly 100%."
Action: Highlight percentage fields, prevent generation

Error: Negative percentage entered
Message: "Percentages cannot be negative."
Action: Reset to 0, show field error

UNIT SIZE VALIDATION:
Error: Unit size ≤ 0
Message: "Unit size must be a positive number."
Action: Reset to default, show field error

Error: Unit size unreasonably small (< 200 sf)
Warning: "Units smaller than 200 sf may not be code-compliant."
Action: Allow but show warning

Error: Unit size unreasonably large (> 3000 sf)
Warning: "Very large units may not fit in standard building widths."
Action: Allow but show warning

EGRESS VALIDATION:
Error: Travel distance < common path
Message: "Travel distance must be greater than common path."
Action: Show error, suggest correction

Error: Dead-end > travel distance
Message: "Dead-end corridor cannot exceed travel distance."
Action: Auto-correct to travel distance value

CONSTRAINT VALIDATION:
Error: Corridor width < 3.67 ft (44 inches)
Message: "Corridor must be at least 44 inches (3.67 ft) per code."
Action: Reset to minimum, show error

Error: Core dimensions < 10 ft in any direction
Warning: "Core dimensions seem too small for stairs/elevator."
Action: Allow but show warning

Error: Negative dimensions anywhere
Message: "Dimensions cannot be negative."
Action: Reset to default, show field error
```

### F.3 Network and API Errors

```
FORMA API ERRORS
────────────────

Error: Cannot fetch building geometry
Cause: Network issue, Forma API timeout, or invalid building selection
Message: "Unable to load building data. Please check your connection and try again."
Action: Show retry button, log error details

Error: Cannot save to Forma
Cause: Network issue, permission denied, or Forma session expired
Message: "Unable to save design. Your session may have expired. Please refresh and try again."
Action: Cache design locally, show retry button

Error: Building geometry invalid
Cause: Corrupted building data or unsupported building type
Message: "Selected building has invalid geometry. Please select a different building."
Action: Clear selection, prompt user to reselect

EXTENSION LOADING ERRORS
────────────────────────

Error: Extension fails to load
Cause: Hosting service down, CORS issue, or network error
Message: (shown by Forma) "Extension unavailable"
Action: User should retry or contact extension support

Error: SDK initialization fails
Cause: Version mismatch or Forma API changes
Message: "Extension is incompatible with current Forma version. Please update."
Action: Graceful degradation or disable extension

GENERATION ERRORS
─────────────────

Error: Algorithm timeout (>30 seconds)
Cause: Building too complex or algorithm inefficiency
Message: "Generation is taking too long. Try simplifying your requirements."
Action: Cancel current generation, suggest reducing constraints

Error: Out of memory (rare)
Cause: Extremely large building or too many iterations
Message: "Building is too large to process. Please try a smaller building."
Action: Cancel generation, suggest alternatives

Error: Invalid generation state
Cause: Bug in algorithm or unexpected input combination
Message: "An unexpected error occurred. Please report this issue."
Action: Log full state for debugging, show error details option
```

### F.4 Saved Options Management

```
SAVED OPTIONS FEATURES
──────────────────────

Save Option:
- Captures: All input parameters + generated geometry + metrics
- Storage: Browser localStorage (persists across sessions)
- Naming: Auto-generated (e.g., "Option A, B, C...") or user-editable
- Limit: Maximum 10 saved options per building

Preview:
- Quick-load: Shows 2D view without full regeneration
- Comparison: Highlights differences from currently viewed option

Delete:
- Confirmation: "Are you sure you want to delete 'Option B'?"
- Undo: 5-second "Undo delete" toast notification

Release:
- Selection: User selects one saved option to release
- Validation: Re-validates egress compliance before release
- Conflict: If building geometry changed since save, warn user

Storage Limits:
- If localStorage full: "Cannot save more options. Please delete old options."
- If browser clears data: "Saved options were cleared by your browser."
```

---

*End of Feature Description Document*
