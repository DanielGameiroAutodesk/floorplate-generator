# Product Requirements: Automated Garage Parking Layout Tool

---

## 1. Overview

### 1.1 Product Vision

A parametric design tool that automatically generates optimized parking garage layouts within any given building footprint. The tool handles both above-grade and below-grade (underground) parking structures and produces code-compliant, structurally coherent layouts with minimal manual intervention.

The core value proposition is speed: an architect or planner should be able to go from a site boundary to a fully laid-out parking garage — with stalls, drive aisles, ramps, cores, ADA spaces, and technical rooms — in seconds, with the ability to fine-tune through parameters.

### 1.2 Target Users

- Architects in early-stage design (feasibility and schematic design)
- Parking consultants
- Developers evaluating site potential
- Urban planners assessing parking capacity

### 1.3 Scope

The tool operates per floor. A project may have multiple floors (levels), each with its own layout. Floors share the same footprint but may differ in ramp configuration, stall layout, and use of space.

---

## 2. Building Footprint

### 2.1 Footprint Input

The user must be able to define the building footprint as any closed polygon. Input methods:

- **Draw mode**: Click to place vertices directly on the canvas; close the polygon to confirm.
- **Import**: Accept a DXF, SVG, or GeoJSON outline. The tool extracts the outer boundary and any inner voids (courtyards, structural cores).
- **Parametric primitives**: Rectangle, L-shape, T-shape, U-shape, and irregular hexagon as quick-start options, with dimension fields.
- **Edit mode**: After creation, individual vertices and edges can be moved, added, or deleted. The layout regenerates on every change.

### 2.2 Footprint Constraints

- Minimum footprint area: 2,000 sq ft (practical lower bound for a viable parking structure).
- Holes/voids inside the footprint are supported (e.g., a building with a light well or structural atrium). Each void is treated as an obstacle that stalls and aisles must route around.
- The footprint may be non-convex. The algorithm must handle re-entrant corners without crashing.

### 2.3 Setbacks and Clear Zones

The user can define a global **structural wall offset** (inset from the footprint edge) that represents the column/wall thickness. This offset shrinks the usable layout area. Default: 1'-0" (can be set to 0 for thin-shell or tilt-up structures).

An additional **clearance buffer** can be applied to specific edges, e.g., the perimeter adjacent to a property line requiring fire separation.

### 2.4 Multi-Wing / Irregular Buildings

When the footprint is an L, T, U, or other multi-wing shape, the algorithm should detect distinct rectangular zones ("wings") and lay out parking independently per wing, connecting drive aisles across the junction. The user can override which zone acts as the primary spine.

---

## 3. Coordinate System and Orientation

### 3.1 Primary Axis

The **Primary axis for orientation** parameter (in degrees, default 0°) defines the angle at which parking bays are laid out relative to the building footprint. 0° means stalls are aligned to the world X-axis (or the longest edge of the footprint, depending on user preference).

The user can:
- Type an angle in degrees.
- Drag a compass rose widget.
- Click "Auto" to let the algorithm choose the axis that maximizes stall count.

### 3.2 Grid System

A structural grid underlies the layout. This is critical because parking garages are typically post-tensioned concrete structures where column spacing directly governs stall widths.

**Grid parameters:**

| Parameter | Description | Typical Value |
|---|---|---|
| **Column grid X** | Spacing along drive aisle direction | 54'–60' for double-loaded aisles |
| **Column grid Y** | Spacing along stall depth direction | 17'–20', matching stall depth |
| **Grid origin X / Y** | Position of the grid within the footprint | — |
| **Grid rotation** | Typically matches primary orientation axis | — |

The tool offers a **Grid Snap** toggle. When on, stall bays snap to the structural grid and columns are shown as dots. When off, stalls pack freely without regard to structure.

Columns are rendered as squares (default 24"×24") at each grid intersection. The tool warns when a stall or drive aisle would conflict with a column location.

---

## 4. Parking Stall Parameters

All dimensions are editable in feet-inches or metric (toggle).

### 4.1 Standard Stall

| Parameter | Description | Typical Range |
|---|---|---|
| **Stall width** | Clear width of one parking space | 8'-6" – 9'-6" |
| **Stall depth** | Distance from aisle edge to wall (perpendicular to aisle) | 17'-0" – 20'-0" |
| **Drive aisle width** | Clear width of the two-way drive lane between opposing stall rows | 24'-0" – 26'-0" |
| **Stall angle** | Angle of stall relative to drive aisle | 45°, 60°, 90° |

For angled stalls (non-90°), the effective bay depth and aisle width update automatically per ITE/AASHTO standards.

### 4.2 Turn Radius

The **Turn radius** defines the swept path of a design vehicle making turns at drive aisle intersections and ramp entrances. This affects:

- Minimum corner clearance at aisle intersections.
- Ramp entry geometry.
- End-of-bay dead-end transitions.

The tool draws the turning envelope as a ghost overlay when hovering over an intersection.

### 4.3 Run Limits

**Max run** (boolean toggle): When enabled, a single continuous row of stalls is capped at **Max run stall count** before a gap is inserted.

**Max run gap width**: The width of the gap inserted to break a long run. This gap serves as a pedestrian cross-aisle or fire egress path.

The gap is rendered as a dashed yellow line and is excluded from the stall count. The user can optionally designate a gap as a **pedestrian walkway** with a different visual treatment.

### 4.4 Single-Loaded vs. Double-Loaded Bays

The tool automatically chooses double-loaded bays (stalls on both sides of a drive aisle) wherever the footprint allows. Single-loaded bays (stalls on one side only, against a wall) are used at perimeter edges. The user can force single-loaded on any edge via context menu.

---

## 5. Entrance Configuration

### 5.1 Entrance Placement

The user defines one or more **entrances** — points or segments on the footprint boundary through which vehicles enter and exit.

- Click on any footprint edge to place an entrance.
- Drag the entrance node along the edge to reposition.
- Multiple entrances supported (e.g., separate in/out lanes).

### 5.2 Entrance Properties

| Property | Options |
|---|---|
| **Type** | Entry only / Exit only / Two-way |
| **Lane count** | 1, 2, or 3 lanes |
| **Gate/Barrier** | None / Arm barrier / Full-height barrier |
| **Queuing length** | Minimum stacking distance inside the garage before the first stall or aisle |
| **Label** | Custom text (e.g., "Main Entry", "Exit Only") |

### 5.3 Entry Drive Lane

From each entrance, the tool generates a **drive lane** that connects the entrance to the main circulation aisle grid inside the garage. This drive lane respects the turn radius and must not conflict with stalls until the queuing length is satisfied.

### 5.4 Connection to Ramps

If the entrance is at grade and parking is on a different level, the tool automatically connects the entrance to the nearest ramp (see Section 7).

---

## 6. Vertical Circulation Cores

Cores represent the fixed vertical elements in the building: elevators, stairwells, and any combined elevator/stair shafts.

### 6.1 Core Placement

- User clicks inside the footprint to place a core.
- The core snaps to the structural grid.
- Cores can also be imported as part of a DXF file.
- Cores are rendered as hatched rectangles.

### 6.2 Core Properties

| Property | Description |
|---|---|
| **Type** | Elevator only / Stair only / Combined |
| **Width** | Clear shaft width |
| **Depth** | Clear shaft depth |
| **Number of elevators** | 1–4 cars per core |
| **Label** | Custom text |

### 6.3 Core Lobby / Waiting Area

Each core automatically generates a **lobby clearance zone** — a minimum clear area in front of the elevator doors or stair entry door. Default: 8'-0" deep × full core width. This zone is excluded from stall placement.

The lobby zone can be widened by the user to accommodate wheelchair turning radius, as required by code.

### 6.4 ADA Proximity Constraint

The tool respects a **max walking distance from ADA stall to nearest core** parameter (default: 200 ft). ADA stalls are automatically placed within this radius of a core whenever possible. A warning is issued if no suitable location exists within the constraint.

---

## 7. Technical Rooms

Technical rooms are non-parking areas reserved for building services.

### 7.1 Room Types

| Room Type | Typical Size | Notes |
|---|---|---|
| **Electrical room** | 200–400 sq ft | Must be accessible from drive aisle or service corridor |
| **Mechanical room** | 300–600 sq ft | May require double-door clearance |
| **Fire pump room** | 150–300 sq ft | Must have exterior or fire-rated access |
| **Sprinkler riser room** | 80–150 sq ft | Adjacent to fire pump or stair core |
| **Storage / janitor** | 50–100 sq ft | — |
| **Sump pit / drainage** | Varies | Floor element; reserves area but is not a room |
| **EV charging cabinet** | 20–50 sq ft | Adjacent to EV stall clusters |
| **Ventilation shaft** | Varies | Floor penetration |

### 7.2 Room Placement

- User selects a room type from a palette and clicks to place it.
- The room snaps to the nearest wall or column grid.
- Rooms are placed at the perimeter of the footprint by default (they should not consume interior stall space unless necessary).
- Rooms can be dragged and resized.
- On placement, the algorithm removes any stalls that conflict and reflows the adjacent bay.

### 7.3 Room Aggregation

The user can **group** multiple small rooms into a technical zone. The zone is treated as a single obstacle for layout purposes.

### 7.4 Automatic Suggestion

Based on total garage area and level count, the tool can suggest a minimum technical room program:

- 1 electrical room per level
- 1 sprinkler riser per level
- 1 mechanical room per building (typically ground level)

The user accepts or modifies the suggestion.

---

## 8. ADA / Disabled Parking

### 8.1 ADA Stall Types

| Type | Stall Width | Access Aisle | Total Width |
|---|---|---|---|
| **Standard ADA car** | 8'-2" (configurable) | 5'-0" | ~13'-2" |
| **ADA van** | 11'-5" (configurable) | 5'-0" | ~16'-5" (or shared) |

Configurable parameters:
- **ADA buffer width**: The access aisle alongside the ADA stall. Default: 4'-11".
- **ADA car width**: The stall itself. Default: 8'-2".
- **ADA van width**: Van-accessible stall width. Default: 11'-5".

### 8.2 Quantity Calculation

The tool automatically calculates the required number of ADA stalls based on total stall count, per IBC/ADA Standards:

| Total Stalls | Required ADA | Of which Van-Accessible |
|---|---|---|
| 1–25 | 1 | 1 |
| 26–50 | 2 | 1 |
| 51–75 | 3 | 1 |
| 76–100 | 4 | 1 |
| 101–150 | 5 | 1 |
| 151–200 | 6 | 1 |
| 201–300 | 7 | 2 |
| 301–400 | 8 | 2 |
| 401–500 | 9 | 2 |
| 501–1000 | 2% of total | 1 per 6 ADA |
| 1001+ | 20 + 1 per 100 over 1000 | 1 per 6 ADA |

The user can override the calculated count upward (never below code minimum). The tool shows the current count, required minimum, and a warning if under minimum.

### 8.3 ADA Stall Placement Rules

ADA stalls must be placed according to the following priority order:

1. Within the **core lobby clearance zone** or immediately adjacent to it (shortest path to elevator).
2. Within **max ADA walking distance** of a core (user-configurable, default 200 ft — measured along the pedestrian path, not Euclidean).
3. On the **same level** as the accessible entrance (no ramp traversal required for ADA access).
4. In a **flat area** — ADA stalls cannot be placed on a sloped floor section that exceeds 2% grade in any direction.

The tool draws the pedestrian path from each ADA stall to its nearest core and labels the distance.

### 8.4 ADA Stall Rendering

ADA stalls are visually distinct:

- Blue fill with the ISA (wheelchair) symbol centered.
- Access aisle shown as a hatched blue zone beside the stall.
- Van stalls labeled "VAN".

---

## 9. Ramps

### 9.1 Ramp Types

| Type | Description |
|---|---|
| **Straight ramp** | A single straight slope connecting two levels |
| **Switchback ramp** | Two straight sections with a 180° turn platform at mid-level |
| **Helical/spiral ramp** | Continuous circular ramp; takes less plan area but higher structural complexity |
| **Split-level ramp** | Half-level offset between wings; traffic circulates via ½-level slopes |
| **Express ramp** | Dedicated ramp serving only entry/exit to the garage (no stalls adjacent) |

### 9.2 Ramp Parameters

| Parameter | Description | Typical Value |
|---|---|---|
| **Ramp width** | Clear driving width (one or two lanes) | 12'-0" (1 lane), 22'-0" (2 lane) |
| **Ramp slope** | Rise over run | 10–15% max straight; 12% max curved |
| **Transition length** | Flat sections at top and bottom of ramp to prevent scraping | 6'-0" min |
| **Ramp direction** | Clockwise or counterclockwise (for helical) | — |
| **Ramp lane config** | Up only / Down only / Two-way | — |

### 9.3 Ramp Placement

- User clicks to place a ramp within the footprint (or at the footprint edge for an external ramp).
- The tool shows a ghost preview of the ramp footprint and grade arrows before confirming.
- Ramps snap to the structural grid.
- External ramps can extend beyond the footprint boundary.

### 9.4 Ramp Conflict Detection

The tool checks:

- Ramp footprint does not overlap stalls or cores.
- Ramp slope does not exceed the configured maximum.
- Transition zones (flat sections top and bottom) are clear of obstacles.
- Turn radius at the bottom/top of a switchback platform is respected.

If any check fails, a red warning overlay appears on the conflict zone with a tooltip explaining the issue.

### 9.5 Multi-Level Coordination

When the project has multiple levels, the ramp connects them in a stack. The tool shows a **section diagram** (side view) of the ramp configuration to verify headroom clearance. Minimum overhead clearance at each level: 7'-2" (IBC), configurable.

### 9.6 Entrance-to-Ramp Connection

If the vehicle entrance is at grade (Level 0) but parking is below grade (Level -1, -2, etc.), the tool automatically routes the entry drive lane to the top of the ramp. The queuing length (Section 5.2) is enforced between the entry gate and the ramp headwall.

---

## 10. Multi-Level Project Structure

### 10.1 Level Management

The project has a **level stack** panel:

- Add / remove levels.
- Each level labeled (e.g., "P1", "P2", "B1", "B2" or custom).
- Each level has an **elevation** (height above or below grade datum).
- Levels can be above-grade, at-grade, or below-grade.

### 10.2 Per-Level Settings

Each level independently configures:

- Stall layout (may differ due to ramp location or footprint variation at that level).
- Technical rooms (can differ per level).
- Ramp position and direction.
- Ceiling height.

### 10.3 Shared Settings

Shared across all levels:

- Stall dimensions (global default; can be overridden per level).
- Core positions (cores are continuous vertical elements).
- Structural grid.

---

## 11. Constraints and Validation

### 11.1 Real-Time Validation

The tool continuously validates the layout and displays a **status panel** with categorized issues:

**Errors** (must fix before export):
- Drive aisle width below minimum.
- ADA stall count below code minimum.
- Ramp slope above maximum.
- Stall conflicts with columns.
- No circulation path from entrance to all stalls.

**Warnings** (should review):
- ADA stall farther than max walking distance from core.
- Max run stall count exceeded.
- Single-loaded bay where double-loaded is possible.
- Technical room lacking direct aisle access.

**Info:**
- Total stall count.
- Stall efficiency (stalls per sq ft of gross area).
- ADA stall count and breakdown.

### 11.2 Code Presets

The user selects a jurisdiction/code preset:

- **IBC (US)**
- **AASHTO Parking Guidelines**
- **Custom** (manual override of all limits)

Selecting a preset auto-populates minimum dimensions for stall width, drive aisle, turn radius, ADA requirements, and ramp slope.

---

## 12. Layout Algorithm

### 12.1 Generation Strategy

The algorithm executes in this order:

1. **Parse footprint** — compute usable area after wall offset and setbacks.
2. **Detect wing zones** — decompose non-convex footprints into rectangular sub-zones.
3. **Place fixed elements** — ramps, cores, technical rooms, and entrances consume space first.
4. **Generate drive aisle grid** — lay out primary and secondary drive aisles on the structural grid aligned to the primary axis.
5. **Fill stalls** — pack stalls double-loaded into every bay between aisles.
6. **Resolve ADA** — replace the required number of standard stalls nearest to cores with ADA stalls.
7. **Insert run gaps** — split any run exceeding max run stall count.
8. **Validate** — run constraint checks and surface errors/warnings.

### 12.2 Manual Override

Any auto-generated stall can be:

- Deleted individually.
- Converted to ADA.
- Converted to EV charging.
- Marked as reserved.

Overrides persist through re-generation (the algorithm re-applies them after regenerating).

### 12.3 Optimization Mode

An optional **Maximize Stalls** mode runs a search over a range of orientation angles (in configurable increments, e.g., 1°) and returns the angle that yields the highest stall count. The result is shown as a bar chart. The user can accept the optimal angle or choose a different one.

---

## 13. Output and Export

### 13.1 Visual Output

The canvas renders in real time:

- Stalls (standard, ADA, van, EV) with distinct fills.
- Drive aisles with direction arrows.
- Cores with lobby zones.
- Technical rooms with labels.
- Ramps with slope arrows and grade labels.
- Structural grid (toggleable).
- Column dots.
- Dimensions of critical clearances (toggleable).

### 13.2 Statistics Panel

| Metric | Unit |
|---|---|
| Total stalls | count |
| Standard stalls | count |
| ADA stalls (car) | count |
| ADA stalls (van) | count |
| EV stalls | count |
| Gross floor area | sq ft / sq m |
| Net parking area | sq ft / sq m |
| Stall efficiency | stalls / 1,000 sq ft |
| Drive aisle area | sq ft |
| Ramp area | sq ft |
| Core area | sq ft |
| Technical room area | sq ft |

### 13.3 Export Formats

| Format | Contents |
|---|---|
| **DXF** | Full geometry: stalls, aisles, cores, rooms, ramps, dimensions |
| **SVG** | Vector graphic for presentation |
| **PDF** | Dimensioned drawing sheet |
| **JSON** | Full parametric model for API integration |
| **CSV** | Stall schedule with type, coordinates, and attributes |

---

## 14. User Interface

### 14.1 Panel Layout

- **Left panel**: Project settings (footprint, levels, grid, orientation).
- **Right panel**: Parameter sliders/fields organized in collapsible groups: Stall, Aisle, ADA, Ramp, Core, Technical.
- **Canvas**: Main layout view, occupies center.
- **Bottom bar**: Stall count, validation status, zoom/pan controls.
- **Top toolbar**: Mode selector (Draw, Edit, Place Core, Place Room, Place Ramp, Place Entrance).

### 14.2 Dimensions

All dimensions display in the user's preferred unit system:

- Feet and fractional inches (e.g., 9'-10 7/64") — default.
- Decimal feet.
- Meters.

Toggle in global settings; all displayed values update simultaneously.

### 14.3 Undo / Redo

Full undo/redo stack for all operations: footprint edits, parameter changes, element placement, manual stall overrides.

---

## 15. Implementation Phases

Implementation should proceed in the following order:

1. **Phase 1**: Footprint definition + stall generation (single level, rectangular footprint).
2. **Phase 2**: Core placement, ADA stall placement, and proximity validation.
3. **Phase 3**: Ramp placement and multi-level support.
4. **Phase 4**: Technical rooms, entrance configuration, and run gap logic.
5. **Phase 5**: Export (DXF, SVG, PDF, JSON, CSV) and code preset validation.
6. **Phase 6**: Optimization mode (maximize stall count search) and multi-wing footprint support.
