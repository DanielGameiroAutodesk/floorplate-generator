
# Implementation Plan: Core Algorithmic Modules (Updated)

**Project:** Floorplate Generator for Autodesk Forma
**Target Audience:** Junior Developers
**Goal:** Provide a detailed architectural and pseudo-code roadmap for the most complex components of the extension, incorporating the Flexibility Model.
**Language:** TypeScript (as specified in PRD Section 7)

---

## Module 1: Geometry Module (Footprint Analysis)

[Content from original Module 1 remains unchanged]

---

## Module 2: Generation Module (Corridor, Core, Unit Placement)

This module implements the core logic for creating the floorplate layout, addressing PRD Requirements 4.3.16 - 4.3.24. This module is the most complex and will be executed three times to generate the three required options.

### 2.1 Data Structures (Interfaces)

```typescript
// Represents a single apartment unit
interface Unit {
    type: 'Studio' | '1BR' | '2BR' | '3BR';
    geometry: Polygon; // The boundary of the unit
    area: number;
    hasFacadeAccess: boolean;
    hasCorridorAccess: boolean;
}

// Represents the final generated floorplate option
interface FloorplateOption {
    id: string;
    corridor: Polygon;
    cores: Polygon[];
    units: Unit[];
    metrics: {
        nrsf: number;
        gsf: number;
        efficiency: number;
        unitMix: { [key: string]: number }; // Actual percentage mix
    };
}

// NEW: Defines the configuration for a unit type, including the Flexibility Model parameters
interface UnitConfiguration {
    [key: string]: {
        percentage: number; // Target mix percentage
        area: number; // Target area in sq ft
        flexibilityFactor: number; // Max percentage deviation allowed (0.0 to 1.0)
        flexibilityWeight: number; // Relative capacity to absorb expansion error
        compressionWeight: number; // Relative capacity to absorb shrinking error
    };
}
```

### 2.2 Core Functions

#### A. `generateCorridor(wings: Wing[], corridorWidth: number): Polygon` (FR 4.3.18)

[Content from original Function A remains unchanged]

#### B. `placeCores(corridor: Polygon, constraints: CoreConstraints): Polygon[]` (FR 4.3.19)

[Content from original Function B remains unchanged]

#### C. `calculateGlobalUnitCounts(totalLength: number, config: UnitConfiguration, rentableDepth: number): Record<UnitType, number>` (NEW - Task 4.2.2)

**Purpose:** Calculates the total number of units for the entire available length using the **Largest Remainder Method** to strictly adhere to the target unit mix percentages.

**Pseudo-Code:**
```typescript
function calculateGlobalUnitCounts(totalLength: number, config: UnitConfiguration, rentableDepth: number): Record<UnitType, number> {
    // 1. Calculate the weighted average width based on target areas and mix percentages.
    // 2. Determine the target total number of units based on the effective length and weighted average width.
    // 3. Apply the Largest Remainder Method:
    //    - Calculate the raw count for each unit type (targetTotalUnits * mixPercentage).
    //    - Take the integer part for the initial count.
    //    - Distribute the remaining deficit (due to rounding) one by one to the unit types with the largest fractional remainders.
    // 4. Return the final, integer-based unit count for each type.
}
```

#### D. `distributeUnitsToSegments(globalCounts: Record<UnitType, number>, segments: Segment[], config: UnitConfiguration): Record<UnitType, number>[]` (NEW - Task 4.2.3)

**Purpose:** Distributes the calculated global unit inventory into the individual linear segments of the floorplate, respecting the physical capacity and the **Flexibility Model**.

**Pseudo-Code:**
```typescript
function distributeUnitsToSegments(globalCounts: Record<UnitType, number>, segments: Segment[], config: UnitConfiguration): Record<UnitType, number>[] {
    // 1. Initialize segment inventory and track remaining capacity (length).
    // 2. **PASS 1: Iterative Fill (Capacity-Aware):**
    //    - Iterate through segments (prioritizing corners or largest segments first).
    //    - For each segment, use `pickBestUnitForSegment` (which checks physical fit using the Flexibility Factor) to place a unit.
    //    - Stop when a segment is "full" or inventory is depleted.
    // 3. **PASS 2: Overflow (Flexibility-Aware):**
    //    - If inventory remains, force placement into the least dense segments.
    //    - Use a heuristic to penalize segments with a high ratio of rigid units (Studios) to avoid overstuffing them.
    // 4. Return the final unit count assigned to each segment.
}
```

#### E. `generateUnitSegment(segmentLength: number, counts: Record<UnitType, number>, pattern: PatternStrategy, config: UnitConfiguration): Unit[]` (NEW - Task 4.3)

**Purpose:** Generates the final geometric boundaries for the units within a single segment, using the **Weighted Geometry Generation** to distribute dimensional error.

**Pseudo-Code:**
```typescript
function generateUnitSegment(segmentLength: number, counts: Record<UnitType, number>, pattern: PatternStrategy, config: UnitConfiguration): Unit[] {
    // 1. Prepare the unit inventory list and apply the chosen 'pattern' (desc, asc, valley, random) to determine the placement order.
    // 2. Calculate the sum of the ideal widths for all units in the segment.
    // 3. Calculate the `totalDiff` (segmentLength - idealWidthSum). This is the total error (compression or expansion).
    // 4. **Weighted Geometry Generation:**
    //    - Determine if the error is compression or expansion.
    //    - Use the appropriate weight function (`compressionWeight` or `flexibilityWeight`) from the UnitConfiguration.
    //    - Distribute the `totalDiff` across all units based on their relative weight.
    // 5. Calculate the final width for each unit.
    // 6. Generate the final Unit geometry (Polygon) for each unit in the segment.
    // 7. Return the array of Unit objects.
}
```

#### F. `placeUnits(footprint: Polygon, corridor: Polygon, cores: Polygon[], unitMix: UnitMix, algorithm: 'Efficiency' | 'Mix' | 'Balanced'): Unit[]` (FR 4.3.21 - Updated Orchestration)

**Purpose:** Orchestrates the unit placement process using the new functions.

**Pseudo-Code:**
```typescript
function placeUnits(footprint: Polygon, corridor: Polygon, cores: Polygon[], unitMix: UnitMix, algorithm: string): Unit[] {
    // 1. Segment the available space (unchanged).
    // 2. Calculate the total length and rentable depth of all segments.
    // 3. **Calculate Global Counts (Task 4.2.2):**
    const globalCounts = calculateGlobalUnitCounts(totalLength, unitMix, rentableDepth);

    // 4. **Distribute to Segments (Task 4.2.3):**
    const segmentCounts = distributeUnitsToSegments(globalCounts, segments, unitMix);

    // 5. **Generate Unit Geometry (Task 4.3):**
    let units: Unit[] = [];
    for (const [i, segment] of segments.entries()) {
        const segmentUnits = generateUnitSegment(segment.length, segmentCounts[i], algorithm.toPattern(), unitMix);
        units.push(...segmentUnits);
    }

    // 6. Apply Wall Alignment (FR 4.3.23) and Utility Space (FR 4.3.24) logic.

    return units;
}
```

---

## Module 3: Validation Module (Egress Compliance)

[Content from original Module 3 remains unchanged]

---
