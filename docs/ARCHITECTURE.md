# Architecture Overview

This document describes the architecture of the Floorplate Generator extension for Autodesk Forma.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Autodesk Forma                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Forma Extension Host                        │   │
│  │                                                                  │   │
│  │  ┌────────────────────┐    ┌────────────────────────────────┐  │   │
│  │  │   Main Panel       │    │     Floating Preview Panel      │  │   │
│  │  │   (index.html)     │◄──►│   (floorplate-panel.html)      │  │   │
│  │  │                    │    │                                 │  │   │
│  │  │  ┌──────────────┐  │    │  ┌─────────────────────────┐   │  │   │
│  │  │  │   main.ts    │  │    │  │  floorplate-panel.ts    │   │  │   │
│  │  │  │  (UI Logic)  │  │    │  │  (Preview Rendering)    │   │  │   │
│  │  │  └──────┬───────┘  │    │  └───────────┬─────────────┘   │  │   │
│  │  └─────────┼──────────┘    └──────────────┼─────────────────┘  │   │
│  │            │ MessagePort                   │                    │   │
│  │            └───────────────────────────────┘                    │   │
│  │                           │                                      │   │
│  │                           ▼                                      │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │                   Algorithm Layer                        │   │   │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │   │   │
│  │  │  │ generator.ts│ │   types.ts  │ │   constants.ts  │   │   │   │
│  │  │  │  (Core)     │ │ (Interfaces)│ │   (Defaults)    │   │   │   │
│  │  │  └─────────────┘ └─────────────┘ └─────────────────┘   │   │   │
│  │  │  ┌─────────────────────────────────────────────────┐   │   │   │
│  │  │  │                  renderer.ts                     │   │   │   │
│  │  │  │          (FloorPlan → Forma Mesh)               │   │   │   │
│  │  │  └─────────────────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                           │                                      │   │
│  │                           ▼                                      │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │                   Geometry Layer                         │   │   │
│  │  │  ┌──────────┐ ┌─────────┐ ┌───────────┐ ┌────────────┐ │   │   │
│  │  │  │ point.ts │ │ line.ts │ │ polygon.ts│ │rectangle.ts│ │   │   │
│  │  │  └──────────┘ └─────────┘ └───────────┘ └────────────┘ │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                           │                                      │   │
│  └───────────────────────────┼──────────────────────────────────────┘   │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Forma SDK (forma-embedded-view-sdk)          │   │
│  │  ┌─────────────┐ ┌───────────┐ ┌─────────┐ ┌─────────────────┐ │   │
│  │  │   project   │ │ selection │ │geometry │ │     render      │ │   │
│  │  │  .get()     │ │.getSelection│.getTriangles│   .addMesh()  │ │   │
│  │  └─────────────┘ └───────────┘ └─────────┘ └─────────────────┘ │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │             extensions.storage (Cloud Persistence)        │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Layer Descriptions

### 1. Extension UI Layer (`src/extension/`)

The user interface layer responsible for:

- **main.ts**: Main controller handling UI state, user input, and orchestrating generation
- **floorplate-panel.ts**: Floating panel for 2D visualization of generated layouts
- **components/**: Reusable UI components
  - `FloorplateSVG.ts`: Renders floorplates as SVG
  - `MetricsPanel.ts`: Displays statistics and metrics

### 2. Algorithm Layer (`src/algorithm/`)

The core business logic:

- **generator-core.ts**: Main floorplate generation algorithm with 3 optimization strategies
- **types.ts**: TypeScript interfaces and type definitions
- **constants.ts**: Default values, colors, and configuration
- **renderer.ts**: Transforms FloorPlanData into Forma-compatible mesh data

### 3. Geometry Layer (`src/geometry/`)

Low-level geometric utilities:

- **point.ts**: Point class with distance, rotation, and transformation methods
- **line.ts**: Line segment operations (intersection, projection)
- **polygon.ts**: Polygon area calculation, point-in-polygon tests
- **rectangle.ts**: Rectangle collision detection and overlap calculation

### 4. Forma SDK Layer

The `forma-embedded-view-sdk` provides all integration with Autodesk Forma:

- Project and scene access
- Building selection handling
- Geometry extraction
- 3D rendering
- Cloud storage for saved designs

## Data Flow

### Generation Flow

```
User Selection → Footprint Extraction → Generation → Visualization → Export
      │                 │                   │              │            │
      ▼                 ▼                   ▼              ▼            ▼
  Forma.selection   Forma.geometry     generator.ts   renderer.ts   bake-building.ts
  .getSelection()   .getTriangles()    generates 3    creates mesh   creates native
                                       FloorPlanData  data           Forma building
```

### Communication Flow

```
┌─────────────────┐     MessagePort      ┌─────────────────┐
│   Main Panel    │◄────────────────────►│  Floating Panel │
│   (main.ts)     │                      │(floorplate-panel.ts)
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

## Module Dependencies

```
main.ts
  ├── algorithm/
  │     ├── index.ts (public API)
  │     ├── generator-core.ts
  │     │     ├── types.ts
  │     │     └── constants.ts
  │     └── renderer.ts
  │           └── types.ts
  ├── storage-service.ts
  │     └── (Forma SDK)
  ├── bake-building.ts
  │     └── (Forma SDK)
  ├── building-inspector.ts
  │     └── (Forma SDK)
  └── components/
        ├── FloorplateSVG.ts
        └── MetricsPanel.ts

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

State is managed at the UI layer in `main.ts`:

```typescript
// Core state categories:
interface ExtensionState {
  // UI State
  activeTab: 'MIX' | 'DIM' | 'EGRESS';
  autoGenerateEnabled: boolean;

  // Configuration State
  unitConfig: UnitConfiguration;
  egressConfig: EgressConfig;
  dimensions: BuildingDimensions;

  // Generation State
  layoutOptions: LayoutOption[];
  selectedOptionIndex: number;

  // Building State
  selectedBuildingPath: string | null;
  buildingFootprint: BuildingFootprint | null;
}
```

## File Organization Patterns

### Naming Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| `feature.ts` | `generator.ts` | Main feature implementation |
| `feature-panel.ts` | `floorplate-panel.ts` | Panel-specific code |
| `feature-service.ts` | `storage-service.ts` | Service/API wrappers |
| `Feature.ts` (PascalCase) | `FloorplateSVG.ts` | Component classes |

### Export Patterns

Each directory has an `index.ts` that re-exports public APIs:

```typescript
// src/algorithm/index.ts
export { generateFloorplates } from './generator';
export type { FloorPlanData, UnitBlock, CoreBlock } from './types';
export { DEFAULT_UNIT_CONFIG, DEFAULT_EGRESS_CONFIG } from './constants';
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
│   │         Unit Tests              │  Geometry,    │
│   │     (point.test.ts, etc.)       │  Pure funcs   │
│   └────────────────────────────────┘                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

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
