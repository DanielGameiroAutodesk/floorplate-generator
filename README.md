# Floorplate Generator for Autodesk Forma

An automated apartment layout generation tool for **US multifamily residential buildings**. Built as an extension for [Autodesk Forma](https://www.autodesk.com/products/forma).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![Forma SDK](https://img.shields.io/badge/Forma%20SDK-0.87.0-orange.svg)

> **About This Project**
>
> This extension was developed by an Autodesk employee **without an engineering background**, learning how to vibecode (AI-assisted coding). It's shared openly to benefit:
>
> - **AEC professionals** who want to build Forma extensions to solve their own specific, local problems
> - **Designers, engineers, and PMs** looking for inspiration to conduct **product discovery interviews** with quick, working prototypes
>
> This is not production-grade software. It's a learning project and a reference implementation that demonstrates what's possible when combining domain knowledge with AI-assisted development.

## What is This?

This extension automatically generates optimized apartment layouts for **US multifamily residential buildings** in Autodesk Forma. It applies **US building codes** (egress requirements, travel distances) and uses **US unit standards** (square feet, typical apartment sizes). It's designed to help architects, real estate developers, and urban planners quickly explore different unit mix configurations.

### Key Features

- **3 Layout Options**: Generates Balanced, Mix-Optimized, and Efficiency-Optimized layouts simultaneously
- **Building Code Compliance**: Validates egress requirements (travel distance, dead-ends, common paths)
- **Dynamic Unit Types**: Configure any number of unit types with custom sizes and properties
- **Smart Defaults**: Automatically calculates optimal unit properties based on area
- **Complex Building Support**: Handles L, U, V-shaped buildings with wing detection
- **Cloud Storage**: Save and restore floorplate designs
- **Bake to Building**: Convert generated layouts to native Forma building elements

## Screenshots

_TODO: Add screenshots of the extension in action_

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher
- An Autodesk Forma account with extension development access

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/DanielGameiroAutodesk/floorplate-generator.git
   cd floorplate-generator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The extension will be available at `http://localhost:5173`

### Running in Forma

1. Open Autodesk Forma
2. Go to **Extensions** > **Developer Tools**
3. Add a new extension with the URL: `http://localhost:5173`
4. Select a building in your project to start generating floorplates

## Usage

### Basic Workflow

1. **Select a Building**: Click on a building in your Forma project
2. **Configure Unit Mix** (MIX tab):
   - Add/remove unit types
   - Set target percentages and areas for each type
   - Customize colors for visualization
3. **Set Dimensions** (DIM tab):
   - Adjust corridor width
   - Configure core placement (North/South)
   - Set core dimensions
4. **Configure Egress** (EGRESS tab):
   - Choose sprinklered/unsprinklered
   - Set travel distance, dead-end, and common path limits
5. **Generate**: Click "Generate" to create 3 layout options
6. **Review & Select**: Compare metrics and select your preferred option
7. **Save or Bake**: Save the design or convert it to a native Forma building

### Auto-Generation Mode

After your first generation, toggle "Auto-Generate" to automatically regenerate layouts when you change any parameter.

## Project Structure

```
floorplate-generator/
├── src/
│   ├── algorithm/           # Core generation algorithm
│   │   ├── generator.ts     # Main floorplate generation logic
│   │   ├── types.ts         # Type definitions
│   │   ├── constants.ts     # Default values and configurations
│   │   └── renderer.ts      # Converts layouts to Forma mesh data
│   │
│   ├── extension/           # Forma extension UI & integration
│   │   ├── main.ts          # Main UI controller
│   │   ├── floorplate-panel.ts    # Floating preview panel
│   │   ├── storage-service.ts     # Cloud storage API wrapper
│   │   ├── bake-building.ts       # Native Forma building conversion
│   │   └── components/      # UI components (SVG renderer, metrics)
│   │
│   ├── geometry/            # Geometric utilities
│   │   ├── point.ts         # Point operations
│   │   ├── line.ts          # Line segment utilities
│   │   ├── polygon.ts       # Polygon analysis
│   │   └── rectangle.ts     # Rectangle operations
│   │
│   └── index.ts             # Main library entry point
│
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md      # System architecture
│   ├── ALGORITHM.md         # Algorithm deep-dive
│   └── FORMA_EXTENSION_GUIDE.md  # Guide for building Forma extensions
│
├── dist/                    # Compiled TypeScript (library)
└── dist-extension/          # Built extension for deployment
```

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:extension` | Build production extension bundle |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run clean` | Remove build artifacts |

### Building for Production

```bash
npm run build:extension
```

The production build will be in `dist-extension/`.

### Running Tests

```bash
npm test
```

## Algorithm Overview

The floorplate generator uses a multi-phase approach:

1. **Footprint Analysis**: Extracts building geometry and detects shape (rectangular, L, U, V)
2. **Corridor Placement**: Creates a central double-loaded corridor
3. **Core Placement**: Positions elevator/stair cores at ends and wing intersections
4. **Egress Validation**: Ensures all points meet travel distance requirements
5. **Unit Placement**: Distributes units using one of three optimization strategies:
   - **Balanced**: Balances efficiency and unit mix matching
   - **Mix Optimized**: Prioritizes matching target unit percentages
   - **Efficiency Optimized**: Maximizes rentable square footage ratio

For detailed algorithm documentation, see [docs/ALGORITHM.md](docs/ALGORITHM.md).

## For Vibecoders: Building Forma Extensions

**Why this exists**: Whether you're an AEC professional solving a specific problem, or a designer/PM conducting product discovery - having a working prototype is infinitely more valuable than slides or mockups. This project demonstrates how someone without an engineering background can build functional Forma extensions using AI-assisted coding (vibecoding).

This project serves as a reference implementation for building Autodesk Forma extensions. Whether you're solving your own workflow problems or validating product ideas with users - here's what you need to know:

### Key Concepts

1. **Forma Embedded View SDK**: The only production dependency. Provides access to:
   - Project/scene data
   - Geometry operations
   - Selection handling
   - 3D rendering
   - Cloud storage

2. **Extension Structure**: Two entry points:
   - `index.html`: Main extension panel
   - `floorplate-panel.html`: Floating preview panel (optional)

3. **Communication**: Use `Forma.createMessagePort()` for cross-frame communication between panels

4. **Rendering**: Use `Forma.render.addMesh()` to display custom geometry in the 3D view

### Example: Getting Selected Building Geometry

```typescript
import { Forma } from "forma-embedded-view-sdk";

async function getSelectedBuildingFootprint() {
  // Get current selection
  const selection = await Forma.selection.getSelection();
  if (selection.length === 0) return null;

  // Get triangle data for the selected element
  const path = selection[0];
  const triangles = await Forma.geometry.getTriangles({ path });

  // Process triangles to extract footprint...
  return processFootprint(triangles);
}
```

### Example: Adding Custom 3D Geometry

```typescript
import { Forma } from "forma-embedded-view-sdk";

async function renderFloorplate(meshData: Float32Array) {
  await Forma.render.addMesh({
    geometryData: meshData,
    // Optional: transform, color, etc.
  });
}
```

For a complete guide on building Forma extensions, see [docs/FORMA_EXTENSION_GUIDE.md](docs/FORMA_EXTENSION_GUIDE.md).

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute

- Report bugs and suggest features via [GitHub Issues](https://github.com/DanielGameiroAutodesk/floorplate-generator/issues)
- Submit pull requests for bug fixes or new features
- Improve documentation
- Share your use cases and feedback

## Future Enhancements

These features were documented for future development but are not currently implemented:

### Ground Floor Variation
- Different layout for ground floor (retail, lobby, amenities)
- Different unit mix per floor
- Podium + tower configurations

### Advanced Unit Types
- Townhouse/duplex units spanning multiple floors
- Live/work units with commercial component
- ADA-compliant unit requirements

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built on [Autodesk Forma](https://www.autodesk.com/products/forma)
- Developed using AI-assisted coding (vibecoding) with Claude
- Inspired by the need to accelerate early-stage multifamily residential design
- Created to support the vibecoding community in building functional prototypes for product discovery

## Resources

- [Autodesk Forma Documentation](https://help.autodesk.com/view/FORMA/ENU/)
- [Forma Extensions SDK](https://aps.autodesk.com/en/docs/forma/v1/overview/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Questions or feedback?** Open an issue or start a discussion!
