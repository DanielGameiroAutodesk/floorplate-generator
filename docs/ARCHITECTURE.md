# Architecture Overview

This document describes the architecture of the Floorplate Generator extension for Autodesk Forma.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Autodesk Forma                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                        Forma Extension Host                            │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────┐    ┌──────────────────────────────────┐  │  │
│  │  │     Main Panel           │    │     Floating Preview Panel        │  │  │
│  │  │     (index.html)         │◄──►│   (floorplate-panel.html)        │  │  │
│  │  │                          │    │                                   │  │  │
│  │  │  ┌────────────────────┐  │    │  ┌───────────────────────────┐   │  │  │
│  │  │  │     main.ts        │  │    │  │   floorplate-panel.ts     │   │  │  │
│  │  │  │   (Orchestrator)   │  │    │  │  (Preview Rendering)      │   │  │  │
│  │  │  └──────┬─────────────┘  │    │  └───────────────────────────┘   │  │  │
│  │  │         │                │    │                                   │  │  │
│  │  │  ┌──────┴─────────────────────────────────────────────────────┐  │  │  │
│  │  │  │                Extension Modules                            │  │  │  │
│  │  │  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐ │  │  │  │
│  │  │  │  │  managers/   │ │   tabs/      │ │   state/             │ │  │  │  │
│  │  │  │  │ generation   │ │ mix-tab      │ │ ui-state             │ │  │  │  │
│  │  │  │  │ float-panel  │ │ dim-tab      │ │ unit-config          │ │  │  │  │
│  │  │  │  │ saved        │ │ egress-tab   │ │                      │ │  │  │  │
│  │  │  │  └─────────────┘ └─────────────┘ └──────────────────────┘ │  │  │  │
│  │  │  │  ┌─────────────────────┐  ┌─────────────────────────────┐ │  │  │  │
│  │  │  │  │  bake-building.ts   │  │  storage-service.ts          │ │  │  │  │
│  │  │  │  │  (Forma Buildings)  │  │  (Cloud Persistence)         │ │  │  │  │
│  │  │  │  └─────────────────────┘  └─────────────────────────────┘ │  │  │  │
│  │  │  └─────────────────────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────┘    └──────────────────────────────────┘  │  │
│  │              │  MessagePort                                            │  │
│  │              ▼                                                         │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │                      Algorithm Layer                              │  │  │
│  │  │  ┌──────────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │  │
│  │  │  │generator-core.ts │ │  types.ts     │ │   constants.ts       │ │  │  │
│  │  │  │ (14-Step Pipeline)│ │ (Dual Types) │ │   (Defaults)         │ │  │  │
│  │  │  └──────────────────┘ └──────────────┘ └──────────────────────┘ │  │  │
│  │  │  ┌──────────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │  │
│  │  │  │  footprint.ts    │ │ renderer.ts  │ │ flexibility-model.ts │ │  │  │
│  │  │  │ (Mesh→Footprint) │ │ (→Forma Mesh)│ │  (Unit Sizing)       │ │  │  │
│  │  │  └──────────────────┘ └──────────────┘ └──────────────────────┘ │  │  │
│  │  │  ┌──────────────────┐ ┌──────────────┐                         │  │  │
│  │  │  │  unit-counts.ts  │ │type-compat.ts│                         │  │  │
│  │  │  │ (Distribution)   │ │(Legacy↔Dyn)  │                         │  │  │
│  │  │  └──────────────────┘ └──────────────┘                         │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │              │                                                         │  │
│  │              ▼                                                         │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │                      Geometry Layer                                │  │  │
│  │  │  ┌──────────┐ ┌─────────┐ ┌───────────┐ ┌──────────────┐       │  │  │
│  │  │  │ point.ts │ │ line.ts │ │ polygon.ts│ │ rectangle.ts │       │  │  │
│  │  │  └──────────┘ └─────────┘ └───────────┘ └──────────────┘       │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │              │                                                         │  │
│  └──────────────┼─────────────────────────────────────────────────────────┘  │
│                 ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                  Forma SDK (forma-embedded-view-sdk)                   │    │
│  │  ┌─────────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────────┐   │    │
│  │  │   project    │ │  selection  │ │ geometry │ │     render      │   │    │
│  │  │   .get()     │ │.getSelection│ │.getTri.. │ │   .addMesh()   │   │    │
│  │  └─────────────┘ └────────────┘ └──────────┘ └─────────────────┘   │    │
│  │  ┌─────────────────────┐  ┌──────────────────────────────────────┐ │    │
│  │  │  elements.floorStack │  │  extensions.storage (Cloud Storage)  │ │    │
│  │  │  .createFromFloors() │  │  .getItem() / .setItem()            │ │    │
│  │  └─────────────────────┘  └──────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Layer Descriptions

### 1. Extension UI Layer (`src/extension/`)

The entry point and user interface layer:

- **main.ts**: Orchestrator -- initializes all modules, wires cross-module callbacks, manages the button state machine (select → generate → stop)
- **floorplate-panel.ts**: Floating panel for 2D SVG visualization of generated layouts
- **bake-building.ts**: Converts floorplates to native Forma building elements via FloorStack SDK and BasicBuilding API
- **storage-service.ts**: Cloud persistence via Forma `extensions.storage` API (save/load/delete)
- **managers/**: Core functionality extracted from main.ts for modularity
  - `generation-manager.ts`: Building selection, footprint extraction, generation orchestration, auto-generate with debouncing
  - `floating-panel-manager.ts`: MessagePort communication with the floating preview panel, panel lifecycle
  - `saved-manager.ts`: Save/load/rename/duplicate/delete saved floorplate designs, building ID grouping
- **tabs/**: Tab-specific UI initialization and event handlers
  - `mix-tab.ts`: Unit type configuration (add/remove types, percentages, areas, advanced settings)
  - `dim-tab.ts`: Building dimensions (corridor width, core placement, core dimensions)
  - `egress-tab.ts`: Egress configuration (sprinkler status, travel distances, dead-end limits)
- **state/**: Centralized state management
  - `ui-state.ts`: `UIState` interface, global mutable state object, smart defaults calculation from unit area
  - `unit-config.ts`: Converters from UI state to algorithm-compatible `UnitConfiguration` and `DynamicUnitConfiguration` formats
- **utils/**: Shared extension utilities
  - `dom-refs.ts`: Cached DOM element references for all UI controls (single source of truth for querySelector calls)
- **components/**: Reusable UI components
  - `FloorplateSVG.ts`: Renders floorplates as SVG for the floating panel
  - `MetricsPanel.ts`: Displays unit counts, efficiency, and egress compliance metrics

### 2. Algorithm Layer (`src/algorithm/`)

Core business logic, independent of Forma SDK:

- **generator-core.ts**: Main 14-step generation pipeline with 3 optimization strategies (balanced, mix-optimized, efficiency-optimized)
- **types.ts**: Dual type system -- legacy `UnitType` enum (Studio/1BR/2BR/3BR) + extensible `DynamicUnitType` system
- **constants.ts**: All default values, unit colors, flexibility factors, strategy configs, IBC egress limits
- **renderer.ts**: Transforms `FloorPlanData` into Forma-compatible mesh data (positions, normals, colors)
- **footprint.ts**: Extracts `BuildingFootprint` from Forma triangle mesh data (convex hull, orientation, dimensions)
- **flexibility-model.ts**: Unit sizing logic -- expansion/compression weights, smart defaults interpolation, corner/L-shape eligibility rules
- **unit-counts.ts**: Unit count distribution using Largest Remainder Method, per-side allocation, core-side mix bias
- **type-compat.ts**: Bidirectional conversion between legacy `UnitConfiguration` and dynamic `DynamicUnitConfiguration`
- **utils/logger.ts**: Configurable logging utility (levels: DEBUG, INFO, WARN, ERROR, NONE)

### 3. Geometry Layer (`src/geometry/`)

Pure geometric utilities with no dependencies:

- **point.ts**: 2D point operations -- distance, rotation, translation, interpolation, angle calculation
- **line.ts**: Line segment operations -- intersection, closest point, parallel offset, extension
- **polygon.ts**: Polygon operations -- area (signed), perimeter, point-in-polygon, centroid
- **rectangle.ts**: Rectangle operations -- overlap detection, subdivision (horizontal/vertical/by-widths), edge extraction, expansion

### 4. Forma SDK Layer

The `forma-embedded-view-sdk` (v0.90.0) provides all integration with Autodesk Forma:

- Project and scene access
- Building selection handling
- Geometry extraction (triangle meshes)
- 3D rendering (`Forma.render.addMesh()`)
- Building creation (`Forma.elements.floorStack.createFromFloors()`)
- Cloud storage for saved designs (`Forma.extensions.storage`)

## Data Flow

### Generation Flow

```
User Selection → Footprint Extraction → Generation → Visualization → Export
      │                 │                   │              │            │
      ▼                 ▼                   ▼              ▼            ▼
  Forma.selection   Forma.geometry    generator-      renderer.ts   bake-building.ts
  .getSelection()   .getTriangles()   core.ts         creates mesh   creates native
                    → footprint.ts    generates 3      data           Forma building
                                      FloorPlanData
```

### Communication Flow

```
┌─────────────────┐     MessagePort      ┌─────────────────┐
│   Main Panel    │◄────────────────────►│  Floating Panel │
│   (main.ts)     │                      │(floorplate-panel.ts)
│                 │                      │                 │
│  managers/      │   Options, save/     │  SVG rendering  │
│  tabs/          │   bake callbacks     │  Option select  │
│  state/         │                      │                 │
└────────┬────────┘                      └────────┬────────┘
         │                                        │
         │ Forma SDK                              │ Forma SDK
         ▼                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Forma Host                              │
└─────────────────────────────────────────────────────────────┘
```

## Design Philosophy

Guiding principles for this extension:

1. **Vibecoding-Friendly** - Clear naming, extensive comments, simple patterns over clever abstractions. Code should be understandable to non-engineers using AI assistance.

2. **Forma-Native Feel** - Follow Forma's design system and UX patterns so the extension feels like a natural part of the product.

3. **Algorithm First** - Core generation logic should be testable and reusable independent of any UI framework or Forma SDK.

4. **Progressive Disclosure** - Simple options first, advanced settings available but not overwhelming. Users shouldn't need to understand everything to get started.

## Key Design Decisions

### 1. Separation of Concerns

**What**: UI is completely separated from algorithm; geometry utilities are independent.

**Why**:
- Enables unit testing the generation algorithm without mocking Forma SDK
- Allows the algorithm to run outside Forma (Node.js scripts, other platforms)
- Reduces coupling so contributors can understand isolated parts
- Geometry utilities can be reused in other projects

**Trade-off**: Requires more explicit data passing between layers; slightly more boilerplate.

### 2. Multiple Entry Points

**What**: Two HTML entry points - main panel (`index.html`) and floating preview (`floorplate-panel.html`).

**Why**:
- Forma supports floating panels for large visualizations without crowding the sidebar
- MessagePort communication keeps panels synchronized
- Users can position the preview wherever convenient on their screen
- Follows Forma's established UX patterns for extension panels

**Trade-off**: Added complexity of cross-frame messaging; need to handle panel lifecycle.

### 3. Three Generation Strategies

**What**: Generate three layout options simultaneously instead of one "optimal" solution.

**Why**:
- Real-world design involves trade-offs - there's no single "best" layout
- Users have different priorities (efficiency vs. unit mix vs. balance)
- Giving choices empowers users without overwhelming them (3 is a sweet spot)
- Enables comparative analysis and informed decision-making

**Trade-off**: 3x computation cost; more complex UI to display options.

### 4. Dynamic Unit Type System

**What**: Support any number of custom unit types rather than hardcoding 4 types.

**Why**:
- Different markets have different unit type requirements
- Users may want unusual configurations (micro-units, large penthouses)
- Smart defaults reduce configuration burden while allowing customization
- Future-proofs against changing market needs

**Trade-off**: More complex state management; harder to optimize algorithm for fixed types.

### 5. Immutable Minimum Sizes

**What**: Units cannot shrink below their target size - they can only expand.

**Why**:
- Undersized apartments don't meet market expectations and won't rent well
- Expansion is acceptable (more space is good); shrinkage is not
- Weighted flexibility means larger units absorb proportionally more expansion
- Maintains realistic unit sizes that match what users specified

**Trade-off**: May result in unused corridor space when units can't fit; algorithm must handle this gracefully.

### 6. Modular Manager Pattern

**What**: Core functionality split from `main.ts` into `managers/`, `tabs/`, `state/`, and `utils/` subdirectories.

**Why**:
- `main.ts` acts as a thin orchestrator wiring modules together, not implementing logic itself
- Each manager handles a single responsibility (generation, panel communication, saved designs)
- Tab modules encapsulate all UI logic for their respective tabs
- State is centralized in `ui-state.ts` rather than scattered across files
- Easier to understand any single module in isolation

**Trade-off**: More files to navigate; requires explicit wiring in main.ts.

### 7. Dual Type System (Legacy + Dynamic)

**What**: Two coexisting unit type systems -- legacy `UnitType` enum and extensible `DynamicUnitType`.

**Why**:
- Legacy system (Studio/1BR/2BR/3BR) is deeply integrated into the algorithm and is the stable API
- Dynamic system supports arbitrary unit types for the UI and future extensibility
- `type-compat.ts` bridges the two with bidirectional conversion
- Avoids risky refactoring of a working algorithm while enabling new features

**Trade-off**: Two systems to maintain; conversion overhead; potential for confusion about which to use.

## Module Dependencies

```
main.ts (orchestrator)
  ├── state/
  │     ├── ui-state.ts (UIState, INITIAL_STATE, smart defaults)
  │     └── unit-config.ts → ui-state.ts, algorithm/types.ts
  ├── tabs/
  │     ├── mix-tab.ts → state/ui-state.ts
  │     ├── dim-tab.ts → state/ui-state.ts
  │     └── egress-tab.ts → state/ui-state.ts
  ├── managers/
  │     ├── generation-manager.ts → algorithm/generator-core.ts, algorithm/footprint.ts
  │     ├── floating-panel-manager.ts → (Forma SDK MessagePort)
  │     └── saved-manager.ts → storage-service.ts, state/ui-state.ts
  ├── utils/
  │     └── dom-refs.ts (cached DOM elements)
  ├── bake-building.ts → algorithm/types.ts, (Forma SDK floorStack)
  ├── storage-service.ts → algorithm/types.ts, (Forma SDK storage)
  └── components/
        ├── FloorplateSVG.ts
        └── MetricsPanel.ts

algorithm/
  ├── generator-core.ts → types.ts, constants.ts, flexibility-model.ts, unit-counts.ts
  ├── footprint.ts → types.ts, geometry/
  ├── renderer.ts → types.ts, constants.ts, geometry/
  ├── flexibility-model.ts → types.ts, constants.ts
  ├── unit-counts.ts → types.ts, flexibility-model.ts
  ├── type-compat.ts → types.ts
  ├── types.ts (no deps)
  ├── constants.ts → types.ts
  └── utils/logger.ts (no deps)

geometry/
  ├── point.ts (no deps)
  ├── line.ts → point.ts
  ├── polygon.ts → point.ts
  └── rectangle.ts → point.ts

types/
  ├── geometry.ts (no deps)
  └── index.ts (re-exports)
```

## State Management

State is managed centrally in `src/extension/state/ui-state.ts`:

```typescript
interface UIState {
  // MIX tab
  alignment: number;
  unitTypes: UnitTypeConfig[];
  // DIM tab
  length: number;
  stories: number;
  buildingDepth: number;
  corridorWidth: number;
  corePlacement: 'North' | 'South';
  coreWidth: number;
  coreDepth: number;
  // EGRESS tab
  sprinklered: boolean;
  commonPath: number;
  travelDistance: number;
  deadEnd: number;
  // Auto-generate
  autoGenerate: boolean;
}
```

The state pattern is deliberately simple: a mutable global `state` object exported from `ui-state.ts`. This is a design choice for vibecoding accessibility -- more sophisticated patterns (Redux, signals, etc.) add complexity that outweighs their benefits for this project.

Each tab module reads/writes directly to `state`, and calls `markInputChanged()` to trigger auto-regeneration when inputs change.

## File Organization Patterns

### Naming Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| `feature-name.ts` | `generator-core.ts` | Main feature implementation |
| `feature-panel.ts` | `floorplate-panel.ts` | Panel-specific code |
| `feature-service.ts` | `storage-service.ts` | Service/API wrappers |
| `feature-manager.ts` | `generation-manager.ts` | Feature managers |
| `feature-tab.ts` | `mix-tab.ts` | Tab UI modules |
| `Feature.ts` (PascalCase) | `FloorplateSVG.ts` | Component classes |

### Export Patterns

Each directory has an `index.ts` that re-exports public APIs:

```typescript
// src/algorithm/index.ts
export { generateFloorplate, generateFloorplateVariants, extractFootprintFromTriangles } from './generator-core';
export type { FloorPlanData, UnitBlock, CoreBlock, LayoutOption } from './types';
export { DEFAULT_UNIT_CONFIG, EGRESS_SPRINKLERED, STRATEGY_CONFIGS } from './constants';
```

## Testing Strategy

```
┌─────────────────────────────────────────────────────┐
│                    Test Pyramid                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│         ┌───────────────────┐                       │
│         │   E2E (Forma)     │  Manual in Forma      │
│         └───────────────────┘                       │
│                                                      │
│      ┌─────────────────────────┐                    │
│      │   Integration Tests      │  Algorithm +      │
│      │                          │  Geometry         │
│      └─────────────────────────┘                    │
│                                                      │
│   ┌────────────────────────────────┐                │
│   │         Unit Tests              │  170+ tests   │
│   │    (*.test.ts colocated)        │  across core  │
│   └────────────────────────────────┘                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

Test files are colocated with their source:
- `geometry/point.test.ts`, `line.test.ts`, `rectangle.test.ts`, `polygon.test.ts`
- `algorithm/generator-core.test.ts`, `renderer.test.ts`
- `extension/bake-building.test.ts`, `storage-service.test.ts`
- `extension/state/ui-state.test.ts`, `unit-config.test.ts`

## Performance Considerations

1. **Debounced Regeneration**: Auto-generation uses debouncing to avoid excessive recalculation
2. **Efficient Mesh Rendering**: Only update 3D mesh when selection changes
3. **Lazy Panel Loading**: Floating panel only loads when opened
4. **Minimal Dependencies**: Only one production dependency (Forma SDK)

## Security Considerations

1. **No External API Calls**: All processing is local
2. **Sandboxed Execution**: Runs within Forma's extension sandbox
3. **Cloud Storage**: Uses Forma's secure storage API
4. **No Sensitive Data**: Only stores geometric configurations
