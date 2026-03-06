# Floorplate Generator for Autodesk Forma

An automated apartment layout generation tool for **US multifamily residential buildings**. Built as an extension for [Autodesk Forma](https://www.autodesk.com/products/forma).

![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![Forma SDK](https://img.shields.io/badge/Forma%20SDK-0.90.0-orange.svg)
![Tests](https://img.shields.io/badge/tests-170+-brightgreen.svg)

![Floorplate Generator in Autodesk Forma](docs/images/forma-ui_baking-output-forma-native-graph-building.png)
*Automatically generated apartment layouts baked as native Forma buildings with unit subdivisions*

> **About This Project**
>
> This extension was developed by an Autodesk employee **without an engineering background**, learning how to vibecode (AI-assisted coding). It's shared openly to benefit:
>
> - **AEC professionals** who want to build Forma extensions to solve their own specific, local problems
> - **Designers, engineers, and PMs** looking for inspiration to conduct **product discovery interviews** with quick, working prototypes
>
> This is not production-grade software. It's a learning project and a reference implementation that demonstrates what's possible when combining domain knowledge with AI-assisted development.

## What It Does

Select a building in Forma, configure your unit mix, and instantly generate three optimized apartment layouts applying US building codes (IBC egress, travel distances) and US unit standards (square feet, typical apartment sizes). Or draw a line directly to create a new building from scratch.

- **3 Layout Options** -- Balanced, Mix-Optimized, and Efficiency-Optimized strategies generated simultaneously
- **Design Mode** -- Draw a polyline in Forma's 3D view to create buildings without pre-existing geometry
- **Multi-Wing Buildings** -- Fully supports L, U, V, H, snake, and courtyard shapes with graph-based generation
- **Multi-Floor Stacking** -- Stack identical floors with configurable floor count and height
- **Building Code Compliance** -- Validates egress requirements (travel distance, dead-ends, common paths)
- **Dynamic Unit Types** -- Configure any number of unit types with custom sizes and properties
- **Smart Defaults** -- Automatically calculates optimal unit properties based on area
- **Cloud Storage** -- Save and restore floorplate designs
- **Bake to Building** -- Convert layouts to native Forma building elements with unit subdivisions

| Unit Mix Configuration | Generated Floorplate |
|:---:|:---:|
| ![Config](docs/images/left-sidepanel_input-unit-mix_partition-alignment.png) | ![Output](docs/images/floating-menu_output-generation.png) |
| Configure unit types, percentages, and areas | Compare three strategies with real-time metrics |

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org/) v18+ and an [Autodesk Forma](https://www.autodesk.com/products/forma) account with extension development access.

```bash
git clone https://github.com/DanielGameiroAutodesk/floorplate-generator.git
cd floorplate-generator
npm install
npm run dev
```

Then in Forma: **Extensions** > **Developer Tools** > add `http://localhost:5173` > select a building.

## Usage

### Select Mode (Existing Buildings)

1. **Select a Building** in your Forma project
2. **Configure Unit Mix** (MIX tab) -- set unit types, target percentages, and areas
3. **Set Dimensions** (DIM tab) -- adjust corridor width and core placement
4. **Configure Egress** (EGRESS tab) -- set sprinkler status and distance limits
5. **Generate** -- click "Select Building" to create 3 layout options
6. **Review & Select** -- compare metrics and pick your preferred option
7. **Save or Bake** -- save the design or convert to a native Forma building

Toggle **Auto-Generate** after your first generation to regenerate layouts automatically when parameters change.

### Design Mode (Draw New Buildings)

1. Click **Design** in the extension panel
2. Set the **Building Width** (default: 65 ft)
3. Draw a polyline in the 3D view (2 points = bar, 3+ points = multi-wing)
4. Building auto-generates using the Balanced strategy and bakes immediately

## Project Structure

```
src/
  algorithm/                    # Core generation logic (independent of Forma SDK)
    generator-core.ts           #   Single-wing 14-step pipeline
    multi-wing-generator.ts     #   Graph-based BFS multi-wing pipeline
    wing-detection.ts           #   Polygon -> wings + intersections
    footprint-polygon.ts        #   Concave-aware footprint extraction
    renderer.ts                 #   FloorPlanData -> Forma mesh
    types.ts, constants.ts      #   Shared types and defaults
  extension/                    # Forma UI, panels, managers, state, baking
    managers/
      generation-manager.ts     #   Select mode orchestration
      design-manager.ts         #   Design mode (draw line buildings)
    utils/
      line-to-polygon.ts        #   Line buffering geometry
    bake-building.ts            #   Multi-floor baking pipeline
  geometry/                     # Reusable geometric utilities
  types/                        # Shared TypeScript type definitions
docs/                           # Architecture, algorithm, API reference, guides
examples/                       # Minimal (~100 lines), custom-units, baking examples
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed module structure and design decisions.

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:extension` | Build production extension bundle |
| `npm test` | Run all 170+ tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run clean` | Remove build artifacts |

## Algorithm Overview

The floorplate generator uses a 7-phase pipeline per wing:

1. **Footprint Analysis** -- extract building geometry, detect shape (bar, L, U, V, H, snake, courtyard)
2. **Corridor Placement** -- create central double-loaded corridor
3. **Core Placement** -- position elevator/stair cores at ends and wing intersections
4. **Egress Validation** -- ensure all points meet travel distance requirements
5. **Unit Placement** -- distribute units using one of three optimization strategies
6. **Wall Alignment** -- align demising walls across corridor sides
7. **Metrics Calculation** -- compute efficiency, unit counts, and egress compliance

For multi-wing buildings (L, U, V, H shapes), the algorithm first detects wings from the footprint polygon, builds a connectivity graph, then generates each wing independently and stitches them with corner geometry at intersections (corner units, corridor wedges, inner cores).

For the full algorithm documentation, see [docs/ALGORITHM.md](docs/ALGORITHM.md).

## For Vibecoders: Building Forma Extensions

This project demonstrates how someone without an engineering background can build functional Forma extensions using AI-assisted coding. Whether you're solving workflow problems or validating product ideas with users, here's what you need to know:

**Key Concepts:**
1. **Forma Embedded View SDK** -- the only production dependency. Provides project data, geometry, selection, 3D rendering, and cloud storage.
2. **Extension Structure** -- two entry points: `index.html` (main panel) and `floorplate-panel.html` (floating preview).
3. **Communication** -- use `Forma.createMessagePort()` for cross-frame messaging between panels.
4. **Rendering** -- use `Forma.render.addMesh()` to display custom geometry in the 3D view.

```typescript
import { Forma } from "forma-embedded-view-sdk";

async function getSelectedBuildingFootprint() {
  const selection = await Forma.selection.getSelection();
  if (selection.length === 0) return null;

  const path = selection[0];
  const triangles = await Forma.geometry.getTriangles({ path });
  return processFootprint(triangles);
}
```

For a quick-start ~100 line example, see [examples/minimal/](examples/minimal/). For the complete guide, see [docs/FORMA_EXTENSION_GUIDE.md](docs/FORMA_EXTENSION_GUIDE.md).

## Documentation

Full documentation is available in the [docs/](docs/) directory:

- [Architecture Overview](docs/ARCHITECTURE.md) -- system design and module structure
- [Algorithm Deep Dive](docs/ALGORITHM.md) -- how the generation algorithm works
- [API Reference](docs/API.md) -- types, functions, and constants
- [Baking Workflow](docs/BAKING_WORKFLOW.md) -- converting layouts to native Forma buildings
- [Forma Extension Guide](docs/FORMA_EXTENSION_GUIDE.md) -- building Forma extensions
- [Troubleshooting](docs/TROUBLESHOOTING.md) -- common issues and solutions

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on getting started, code style, and the pull request process.

## License

This project is licensed under the MIT License -- see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Built on [Autodesk Forma](https://www.autodesk.com/products/forma). Developed using AI-assisted coding (vibecoding) with Claude. Created to support the vibecoding community in building functional prototypes for product discovery.

## Resources

- [Autodesk Forma Documentation](https://help.autodesk.com/view/FORMA/ENU/)
- [Forma Extensions SDK](https://aps.autodesk.com/en/docs/forma/v1/overview/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Questions or feedback?** Open an [issue](https://github.com/DanielGameiroAutodesk/floorplate-generator/issues) or start a [discussion](https://github.com/DanielGameiroAutodesk/floorplate-generator/discussions)!
