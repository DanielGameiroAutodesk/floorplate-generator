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

- **generator.ts**: Main floorplate generation algorithm with 3 optimization strategies
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

## Key Design Decisions

### 1. Separation of Concerns

- **UI** is completely separated from **algorithm**
- **Geometry** utilities are independent and reusable
- This allows testing the algorithm without Forma

### 2. Multiple Entry Points

- `index.html`: Main extension panel (always visible in sidebar)
- `floorplate-panel.html`: Optional floating panel for preview
- Both can run independently but communicate via MessagePort

### 3. Three Generation Strategies

Instead of one algorithm, we generate three layout options simultaneously:
1. **Balanced**: Best overall compromise
2. **Mix Optimized**: Prioritizes hitting target unit percentages
3. **Efficiency Optimized**: Maximizes rentable square footage

This gives users meaningful choices without overwhelming them.

### 4. Dynamic Unit Type System

Rather than hardcoding 4 unit types, the system supports:
- Any number of custom unit types
- Configurable properties per type
- Automatic smart defaults based on area

### 5. Immutable Minimum Sizes

A critical design decision: **units cannot shrink below their target size**.
- Units can only expand to fill available space
- Larger units absorb more expansion (weighted flexibility)
- This prevents undersized apartments that wouldn't meet market expectations

## Module Dependencies

```
main.ts
  ├── generator.ts
  │     ├── types.ts
  │     └── constants.ts
  ├── renderer.ts
  │     └── types.ts
  ├── storage-service.ts
  │     └── (Forma SDK)
  ├── bake-building.ts
  │     └── (Forma SDK)
  └── components/
        ├── FloorplateSVG.ts
        └── MetricsPanel.ts

geometry/
  ├── point.ts (no deps)
  ├── line.ts → point.ts
  ├── polygon.ts → point.ts
  └── rectangle.ts → point.ts
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
