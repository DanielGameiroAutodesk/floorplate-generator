# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - `forma-embedded-view-sdk` ^0.87.0 (only production dependency)

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

---

## Future Releases

Planned features for future versions:

- Ground floor variations (retail, lobby, amenities)
- Townhouse/duplex units spanning multiple floors
- Live/work units with commercial component
- ADA-compliant unit requirements
- International building code support
- Curved building support
- Machine learning optimization
