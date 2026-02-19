# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Removed building-inspector.ts** -- building inspection functionality consolidated into other modules
- **Manager refactors** -- generation-manager, floating-panel-manager, saved-manager updates for improved modularity
- **Generator core updates** -- ongoing algorithm improvements in generator-core.ts
- **DOM refs centralization** -- dom-refs.ts updated with additional cached references

### Added
- **Multi-wing problem specification** -- `MULTI-WING-PROBLEM-SPEC.md` added as planning document for multi-wing building support

---

## [0.2.0] - 2025-01-23

### Changed

- **Upgraded Forma SDK** from 0.87.0 to 0.90.0
- **FloorStack API with Unit Subdivisions** - Buildings now bake with proper unit subdivisions (CORE, CORRIDOR, LIVING_UNIT programs)
- **No Authentication Dialog** - SDK handles authentication automatically, no OAuth flow required

### Fixed

- **Building Position** - Fixed coordinate centering and transform offset compensation for correct building placement
- **Debug Logging** - Reduced verbose console output to essential logs only

### Technical Details

- FloorStack API `createFromFloors()` now uses plan-based floors with unit definitions
- Coordinates are centered at origin with offset compensation in transform
- Transform uses column-major 4x4 matrix with rotation around Z-axis

---

## [0.1.0] - 2025-01-16

### Added

- **Initial Release** - First public version of the Floorplate Generator for Autodesk Forma
- **Core Generation Algorithm** (`generator-core.ts`)
  - 3 optimization strategies: Balanced, Mix Optimized, Efficiency Optimized
  - Dynamic unit type system with configurable properties per type
  - Flexibility model where units can expand but never shrink below target
  - L-shaped unit support for corner positions
  - Automatic wall alignment across corridors
- **Building Code Compliance**
  - IBC egress validation (travel distance, dead-ends, common paths)
  - Automatic core placement for egress compliance
  - Sprinklered and unsprinklered building support
- **Forma Integration**
  - Building selection and footprint extraction
  - Real-time 3D mesh rendering
  - Floating preview panel for 2D visualization
  - Cloud storage for saved floorplates
  - "Bake to Building" - convert layouts to native Forma buildings
- **Dynamic Unit Types**
  - Add/remove custom unit types
  - Configure area, percentage, and colors per type
  - Smart defaults based on unit area
  - Advanced settings: L-shape eligibility, corner eligibility, flexibility weights
- **UI Features**
  - Tabbed interface (MIX, DIM, EGRESS)
  - Auto-generate mode
  - Save/restore designs with cloud persistence
  - Building inspection tools
- **Documentation**
  - Algorithm deep-dive (`ALGORITHM.md`)
  - Architecture overview (`ARCHITECTURE.md`)
  - Baking workflow guide (`BAKING_WORKFLOW.md`)
  - Forma extension development guide (`FORMA_EXTENSION_GUIDE.md`)
  - API reference (`API.md`)

### Technical Details

- **Language**: TypeScript 5.3
- **Build Tool**: Vite 5.0
- **Test Framework**: Jest 29.7
- **Dependencies**:
  - `forma-embedded-view-sdk` ^0.90.0 (only production dependency)

### Architecture

The project is organized into three main layers:

1. **Algorithm Layer** (`src/algorithm/`) - Core generation logic, independent of Forma
2. **Extension Layer** (`src/extension/`) - Forma UI integration and controls
3. **Geometry Layer** (`src/geometry/`) - Reusable geometric utilities

### Key Design Decisions

- **Units cannot shrink below target size** - Only expansion is allowed, preventing undersized apartments
- **Three simultaneous strategies** - Users see meaningful choices without manual parameter tuning
- **US building codes** - Egress defaults follow IBC requirements (International Building Code)
- **Meters internally** - All calculations use SI units; feet displayed in UI for US market

