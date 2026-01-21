# Minimal Forma Extension Example

A simple ~50 line example demonstrating the 5 core concepts for building Forma extensions.

## The 5 Core Concepts

1. **CONNECT** - Import the Forma SDK from a CDN
2. **SELECT** - Get the user's current building selection
3. **READ** - Fetch geometry data (triangles) for the selected element
4. **PROCESS** - Perform calculations (bounding box analysis)
5. **DISPLAY** - Show results to the user

## Running This Example

### Option 1: Direct File (Simplest)

1. Open `index.html` in a browser
2. Note: The SDK requires HTTPS, so some features may not work locally

### Option 2: Local Server (Recommended)

Using Python:
```bash
cd examples/minimal
python -m http.server 8080
# Open http://localhost:8080
```

Using Node.js:
```bash
npx serve examples/minimal
```

### Option 3: In Forma

1. Host these files on any HTTPS server (GitHub Pages, Vercel, etc.)
2. In Forma, add a new extension with the hosted URL
3. Select a building and click "Analyze"

## What It Does

When you select a building and click "Analyze Selected Building", the extension:

1. Gets the selected element's path from Forma
2. Fetches the triangle geometry for that element
3. Calculates the bounding box dimensions
4. Displays width, depth, height, footprint area, and volume

## Extending This Example

### Add More Analysis

```javascript
// Calculate floor area at specific height
function getFloorArea(triangles, floorZ) {
  // Filter triangles at floor level
  // Calculate 2D area from floor triangles
}
```

### Add Visualization

```javascript
// Add a simple mesh to visualize the bounding box
await Forma.render.addMesh({
  positions: boxVertices,
  colors: boxColors
});
```

### Save Results

```javascript
// Save analysis to Forma's extension storage
await Forma.extensions.storage.setObject({
  key: "analysis-results",
  data: JSON.stringify(results)
});
```

## File Structure

```
minimal/
├── index.html  # Simple HTML UI
├── main.js     # Core logic (~50 lines)
└── README.md   # This file
```

## No Build Step Required

This example uses ES modules directly from a CDN, so there's no build step needed. Just edit the files and refresh your browser.

For production extensions, you'll typically want a build system (like Vite) for:
- TypeScript support
- Bundling and minification
- Better development experience

See the main Floorplate project for a full production setup.
