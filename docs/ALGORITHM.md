# Floorplate Generation Algorithm

This document provides a deep dive into the floorplate generation algorithm used by this extension.

## Overview

The algorithm generates optimized apartment layouts for multi-family residential buildings. It takes a building footprint and configuration parameters, then produces three layout options using different optimization strategies.

## Algorithm Phases

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Generation Pipeline                                │
│                                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │  Phase 1    │   │  Phase 2    │   │  Phase 3    │   │  Phase 4    │ │
│  │  Footprint  │──►│  Corridor   │──►│    Core     │──►│   Egress    │ │
│  │  Analysis   │   │  Placement  │   │  Placement  │   │ Validation  │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘ │
│         │                                                     │          │
│         │                                                     ▼          │
│         │         ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│         │         │  Phase 7    │   │  Phase 6    │   │  Phase 5    │ │
│         └────────►│  Metrics    │◄──│    Wall     │◄──│    Unit     │ │
│                   │ Calculation │   │  Alignment  │   │  Placement  │ │
│                   └─────────────┘   └─────────────┘   └─────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Phase 1: Footprint Analysis

**Input**: Triangle mesh data from Forma
**Output**: BuildingFootprint with dimensions, rotation, center point

### Process

1. Extract all vertices from triangle data
2. Project to 2D (ignore Z coordinate for footprint)
3. Calculate convex hull or bounding box
4. Detect building rotation angle
5. Calculate building dimensions (width, depth)

```typescript
interface BuildingFootprint {
  width: number;        // Building width in meters
  depth: number;        // Building depth in meters
  rotation: number;     // Rotation angle in radians
  center: Point;        // Center point
  outline: Point[];     // Footprint polygon vertices
}
```

### Building Shape Detection

The algorithm detects complex shapes:

```
Rectangular:          L-Shape:             U-Shape:
┌──────────────┐     ┌───────┐            ┌───────────────┐
│              │     │       │            │               │
│              │     │       └────┐       │   ┌───────┐   │
│              │     │            │       │   │       │   │
│              │     │            │       │   │       │   │
└──────────────┘     └────────────┘       └───┘       └───┘
```

## Phase 2: Corridor Placement

**Input**: Building footprint, corridor width
**Output**: Corridor centerline and bounds

### Double-Loaded Corridor Design

The algorithm uses a central double-loaded corridor:

```
                    Building Depth
    ◄─────────────────────────────────────────►

    ┌──────────────────────────────────────────┐  ▲
    │           North Side Units               │  │
    │   [Unit]   [Unit]   [Unit]   [Unit]     │  │
    ├──────────────────────────────────────────┤  │
    │              C O R R I D O R             │  │ Building
    ├──────────────────────────────────────────┤  │ Width
    │           South Side Units               │  │
    │   [Unit]   [Unit]   [Unit]   [Unit]     │  │
    └──────────────────────────────────────────┘  ▼
```

### Corridor Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| Width | 1.524m (5ft) | Standard corridor width |
| Depth | Building depth | Runs full length |

## Phase 3: Core Placement

**Input**: Building footprint, core dimensions, egress requirements
**Output**: Array of CoreBlock positions

### Core Types

1. **End Cores**: Placed at building extremities
2. **Mid Cores**: Added every ~76m (250ft) if needed for egress
3. **Wing Cores**: Placed at L/U/V building intersections

```
Simple Building:                With Mid-Core:
┌─────┬──────────────┬─────┐   ┌─────┬──────┬──────┬─────┐
│CORE │              │CORE │   │CORE │      │CORE  │CORE │
└─────┴──────────────┴─────┘   └─────┴──────┴──────┴─────┘
```

### Core Dimensions

| Dimension | Default | Description |
|-----------|---------|-------------|
| Width | 4.572m (15ft) | Perpendicular to corridor |
| Depth | 12.192m (40ft) | Along corridor direction |

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
Corridor Width = 1.5m
Core Depth = 4.5m (each side)

Rentable Depth (per side) = (30 - 1.5) / 2 - 4.5 = 9.75m
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

```typescript
// Flexibility weights (expansion capacity)
Studio:   1    // Minimal expansion
1BR:      5    // Some expansion
2BR:      15   // Moderate expansion
3BR:      40   // Most expansion

// Compression weights (virtually rigid)
All types: 0.0001  // Cannot shrink
```

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
┌──────────┐        ┌──────┬────────┐
│          │        │      │        │
│          │        │      │        │
│          │        │      └────────┤
│          │        │               │
└──────────┘        └───────────────┘
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
- **Side**: North or South (matching the segment)
- **Core exclusion**: On the core side, gaps occupied by cores are not filled (cores already cover that space)
- **Baked as**: `program: 'CORE'` in FloorStack/BasicBuilding APIs

```
Before Filler Detection:
┌────────┬────────┐   ┌─────────┐
│ Unit A │ Unit B │   │  Unit C │
└────────┴────────┘   └─────────┘
                  ▲
               0.8m gap (creates filler)

After Filler Creation:
┌────────┬────────┬──────┬─────────┐
│ Unit A │ Unit B │FILLER│  Unit C │
└────────┴────────┴──────┴─────────┘
```

**IMPORTANT**: Filler detection must happen AFTER all unit position adjustments (alignment, L-shape wrapping, corridor void absorption) to ensure fillers cover actual gaps in final unit positions. The FloorStack API requires 100% footprint coverage with no gaps or overlaps.

This ensures full building footprint coverage with no white space gaps in the baked building.

## Phase 6: Wall Alignment

**Input**: Units on both sides of corridor
**Output**: Adjusted unit widths with aligned demising walls

### Alignment Algorithm

```
Before Alignment:
North: [  Unit A  ][  Unit B  ][    Unit C    ]
       ────────────────────────────────────────
South: [Unit D][ Unit E ][   Unit F   ][Unit G]

After Alignment:
North: [  Unit A  ][   Unit B   ][   Unit C   ]
       ────────────────────────────────────────
South: [ Unit D  ][   Unit E   ][   Unit F   ]
                    ▲            ▲
                 Walls aligned where possible
```

### Alignment Tolerance

User configurable: 0% (no alignment) to 100% (strict alignment)

```typescript
// Only align if within tolerance
if (Math.abs(northWallX - southWallX) <= tolerance * avgUnitWidth) {
  // Adjust both units to meet in middle
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
Efficiency = Net Rentable SF / Gross SF × 100

Example:
- Gross Area: 10,000 SF
- Core Area: 1,500 SF
- Corridor Area: 500 SF
- Net Rentable: 8,000 SF
- Efficiency: 80%
```

## Output Structure

```typescript
interface FloorPlanData {
  units: UnitBlock[];           // All apartment units
  cores: CoreBlock[];           // Elevator/stair cores
  fillers: FillerBlock[];       // Leftover space fillers (baked as CORE)
  corridor: CorridorBlock;      // Central corridor
  metrics: FloorplanMetrics;    // Calculated statistics
  buildingOutline: Point[];     // Original footprint
}

interface LayoutOption {
  strategy: OptimizationStrategy;
  label: string;                // "Balanced", etc.
  description: string;          // Strategy explanation
  floorplan: FloorPlanData;
}
```

## Performance Characteristics

| Metric | Typical Value |
|--------|---------------|
| Generation Time | < 100ms for 3 options |
| Memory Usage | < 10MB |
| Unit Calculations | O(n) where n = unit count |
| Wall Alignment | O(n × m) for n × m units |

## Known Limitations

1. **Rectangular bias**: Algorithm optimized for rectangular buildings
2. **Single-level**: All floors assumed identical
3. **No interior rooms**: Only demising walls, not bathroom/kitchen layouts
4. **US codes only**: Egress defaults are US-centric

## Future Improvements

- Curved building support
- Multi-floor variations
- Interior room layouts
- International building codes
- Machine learning optimization
