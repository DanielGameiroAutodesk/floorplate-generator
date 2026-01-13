# Building Autodesk Forma Extensions: A Complete Guide

This guide is for **vibecoders** - people who may not have a traditional engineering background but want to build functional software using AI-assisted coding.

## Why Build Forma Extensions?

Building Forma extensions is a powerful way to:

- **Solve your own problems**: AEC professionals can build tools for their specific, local challenges
- **Conduct product discovery interviews**: Designers, engineers, and PMs can test ideas with working prototypes instead of slides
- **Validate ideas quickly**: Put functional tools in front of real users and learn fast
- **Learn by doing**: The best way to understand what's possible is to build something

This Floorplate Generator was built by an Autodesk employee without an engineering background, using vibecoding (AI-assisted development). If they can do it, so can you.

---

## Table of Contents

1. [What is a Forma Extension?](#what-is-a-forma-extension)
2. [Project Setup](#project-setup)
3. [The Forma SDK](#the-forma-sdk)
4. [Common Patterns](#common-patterns)
5. [Working with Geometry](#working-with-geometry)
6. [Rendering Custom 3D Content](#rendering-custom-3d-content)
7. [Storage and Persistence](#storage-and-persistence)
8. [Multi-Panel Extensions](#multi-panel-extensions)
9. [Debugging Tips](#debugging-tips)
10. [Best Practices](#best-practices)

## What is a Forma Extension?

Forma extensions are web applications that run inside Autodesk Forma's extension host. They can:

- Read and modify project data
- React to user selections
- Render custom 3D geometry
- Store data in the cloud
- Provide custom UI panels

Extensions are loaded as iframes within Forma, communicating via the Forma SDK.

```
┌─────────────────────────────────────────────────────┐
│                 Autodesk Forma                       │
│  ┌───────────────────────────────────────────────┐ │
│  │          Your Extension (iframe)              │ │
│  │  ┌─────────────────────────────────────────┐  │ │
│  │  │        Your Web App                     │  │ │
│  │  │        (HTML/CSS/JS)                    │  │ │
│  │  │              │                          │  │ │
│  │  │              ▼                          │  │ │
│  │  │     forma-embedded-view-sdk             │  │ │
│  │  └─────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────┘ │
│                       │                             │
│                       ▼                             │
│              Forma Host APIs                        │
└─────────────────────────────────────────────────────┘
```

## Project Setup

### 1. Create a New Project

```bash
mkdir my-forma-extension
cd my-forma-extension
npm init -y
```

### 2. Install Dependencies

```bash
# Required: Forma SDK
npm install forma-embedded-view-sdk

# Recommended: TypeScript + Vite
npm install -D typescript vite
```

### 3. Project Structure

```
my-forma-extension/
├── src/
│   ├── main.ts          # Entry point
│   └── index.html       # Main HTML
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 4. Minimal `vite.config.ts`

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    cors: true,  // Required for Forma iframe loading
  },
  build: {
    outDir: 'dist',
  },
});
```

### 5. Minimal `index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Forma Extension</title>
</head>
<body>
  <div id="app">
    <h1>My Extension</h1>
    <button id="get-selection">Get Selection</button>
    <div id="output"></div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### 6. Minimal `main.ts`

```typescript
import { Forma } from "forma-embedded-view-sdk";

async function init() {
  // Get current project info
  const project = await Forma.project.get();
  console.log("Project:", project);

  // Set up selection button
  document.getElementById("get-selection")?.addEventListener("click", async () => {
    const selection = await Forma.selection.getSelection();
    document.getElementById("output")!.textContent =
      selection.length > 0 ? `Selected: ${selection.join(", ")}` : "Nothing selected";
  });
}

init();
```

### 7. Run Development Server

```bash
npm run dev
```

### 8. Add to Forma

1. Open Forma
2. Go to **Extensions** > **Developer Tools**
3. Add extension URL: `http://localhost:5173`
4. Your extension appears in the sidebar!

## The Forma SDK

### Core Modules

```typescript
import { Forma } from "forma-embedded-view-sdk";

// Project information
Forma.project.get()          // Get project metadata

// Selection handling
Forma.selection.getSelection()      // Get selected element paths
Forma.selection.setSelection(paths) // Set selection

// Geometry operations
Forma.geometry.getTriangles({ path })  // Get mesh triangles
Forma.geometry.getFootprint({ path })  // Get 2D footprint

// 3D rendering
Forma.render.addMesh({ geometryData })    // Add custom 3D
Forma.render.removeMesh({ id })           // Remove custom 3D
Forma.render.updateMesh({ id, ... })      // Update custom 3D

// Storage
Forma.extensions.storage.getTextItem({ key })  // Read
Forma.extensions.storage.setTextItem({ key, data })  // Write

// UI
Forma.openFloatingPanel({ url, title })   // Open floating panel
Forma.createMessagePort()                 // Cross-panel communication
```

### TypeScript Types

The SDK provides full TypeScript support:

```typescript
import { Forma } from "forma-embedded-view-sdk";
import type {
  Selection,
  TriangleData,
  MeshData,
} from "forma-embedded-view-sdk";
```

## Common Patterns

### Pattern 1: React to Selection Changes

```typescript
import { Forma } from "forma-embedded-view-sdk";

// Poll for selection changes (SDK doesn't have events yet)
let lastSelection: string[] = [];

async function checkSelection() {
  const selection = await Forma.selection.getSelection();

  // Check if selection changed
  if (JSON.stringify(selection) !== JSON.stringify(lastSelection)) {
    lastSelection = selection;
    onSelectionChanged(selection);
  }
}

function onSelectionChanged(selection: string[]) {
  console.log("Selection changed:", selection);
  // Your logic here
}

// Check every 500ms
setInterval(checkSelection, 500);
```

### Pattern 2: Get Building Geometry

```typescript
async function getBuildingFootprint(path: string) {
  // Get triangle mesh
  const triangles = await Forma.geometry.getTriangles({ path });

  if (!triangles || triangles.length === 0) {
    console.log("No geometry found");
    return null;
  }

  // triangles is Float32Array: [x1,y1,z1, x2,y2,z2, x3,y3,z3, ...]
  const vertices: { x: number; y: number; z: number }[] = [];

  for (let i = 0; i < triangles.length; i += 3) {
    vertices.push({
      x: triangles[i],
      y: triangles[i + 1],
      z: triangles[i + 2],
    });
  }

  return vertices;
}
```

### Pattern 3: Render Custom 3D Geometry

```typescript
async function renderCustomMesh() {
  // Create a simple triangle
  const positions = new Float32Array([
    0, 0, 0,    // Vertex 1
    10, 0, 0,   // Vertex 2
    5, 10, 0,   // Vertex 3
  ]);

  // Add to scene
  const result = await Forma.render.addMesh({
    geometryData: positions,
  });

  console.log("Mesh added with ID:", result.id);
  return result.id;
}

// Later: remove the mesh
async function removeCustomMesh(meshId: string) {
  await Forma.render.removeMesh({ id: meshId });
}
```

### Pattern 4: Save and Load Data

```typescript
const STORAGE_KEY = "my-extension-data";

interface MyData {
  settings: {
    option1: boolean;
    option2: number;
  };
  savedItems: string[];
}

async function saveData(data: MyData) {
  await Forma.extensions.storage.setTextItem({
    key: STORAGE_KEY,
    data: JSON.stringify(data),
  });
}

async function loadData(): Promise<MyData | null> {
  try {
    const result = await Forma.extensions.storage.getTextItem({
      key: STORAGE_KEY,
    });

    if (result?.data) {
      return JSON.parse(result.data);
    }
  } catch (e) {
    console.error("Failed to load data:", e);
  }
  return null;
}
```

## Working with Geometry

### Understanding Forma's Coordinate System

- Forma uses **meters** as the base unit
- Y-axis is typically "up" in 3D views
- Buildings have paths like `/root/buildings/building_123`

### Converting Coordinates

```typescript
// Feet to meters
const FEET_TO_METERS = 0.3048;
function feetToMeters(feet: number): number {
  return feet * FEET_TO_METERS;
}

// Square feet to square meters
function sqftToSqm(sqft: number): number {
  return sqft * 0.092903;
}
```

### Extracting 2D Footprint from 3D Mesh

```typescript
function extractFootprint(triangles: Float32Array): Point[] {
  const points: Point[] = [];

  // Get all vertices, project to 2D (ignore Z)
  for (let i = 0; i < triangles.length; i += 3) {
    points.push({
      x: triangles[i],
      y: triangles[i + 1],
      // Ignore z (triangles[i + 2])
    });
  }

  // Remove duplicates
  const unique = removeDuplicatePoints(points);

  // Compute convex hull for outline
  return computeConvexHull(unique);
}
```

### Calculating Area

```typescript
// Shoelace formula for polygon area
function calculatePolygonArea(points: Point[]): number {
  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}
```

## Rendering Custom 3D Content

### Creating Mesh Data

Forma expects triangle vertices as Float32Array:

```typescript
function createRectangleMesh(
  x: number,
  y: number,
  width: number,
  height: number,
  z: number = 0
): Float32Array {
  // Two triangles make a rectangle
  return new Float32Array([
    // Triangle 1
    x, y, z,
    x + width, y, z,
    x + width, y + height, z,

    // Triangle 2
    x, y, z,
    x + width, y + height, z,
    x, y + height, z,
  ]);
}
```

### Adding Color

```typescript
async function addColoredMesh(
  positions: Float32Array,
  color: { r: number; g: number; b: number; a: number }
) {
  // Create color array (RGBA for each vertex)
  const vertexCount = positions.length / 3;
  const colors = new Uint8Array(vertexCount * 4);

  for (let i = 0; i < vertexCount; i++) {
    colors[i * 4] = color.r;
    colors[i * 4 + 1] = color.g;
    colors[i * 4 + 2] = color.b;
    colors[i * 4 + 3] = color.a;
  }

  return await Forma.render.addMesh({
    geometryData: positions,
    // Color support depends on SDK version
  });
}
```

### Transforming Geometry

```typescript
function rotatePoints(
  positions: Float32Array,
  angle: number,
  centerX: number,
  centerY: number
): Float32Array {
  const result = new Float32Array(positions.length);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] - centerX;
    const y = positions[i + 1] - centerY;

    result[i] = x * cos - y * sin + centerX;
    result[i + 1] = x * sin + y * cos + centerY;
    result[i + 2] = positions[i + 2]; // Z unchanged
  }

  return result;
}
```

## Storage and Persistence

### Storage API Overview

Forma provides cloud storage for extensions:

```typescript
// Text storage
Forma.extensions.storage.getTextItem({ key })
Forma.extensions.storage.setTextItem({ key, data })
Forma.extensions.storage.deleteTextItem({ key })
Forma.extensions.storage.listTextItems({ prefix })

// Binary storage (for larger data)
Forma.extensions.storage.getBlobItem({ key })
Forma.extensions.storage.setBlobItem({ key, data })
```

### Organizing Storage Keys

```typescript
// Use prefixes to organize data
const KEYS = {
  SETTINGS: "settings",
  SAVED_ITEMS: "saved/",  // Prefix for list
  HISTORY: "history/",
};

// List all saved items
async function listSavedItems() {
  const items = await Forma.extensions.storage.listTextItems({
    prefix: KEYS.SAVED_ITEMS,
  });
  return items;
}
```

### Handling Storage Errors

```typescript
async function safeLoad<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const result = await Forma.extensions.storage.getTextItem({ key });
    if (result?.data) {
      return JSON.parse(result.data) as T;
    }
  } catch (error) {
    console.warn(`Failed to load ${key}:`, error);
  }
  return defaultValue;
}
```

## Multi-Panel Extensions

### Opening a Floating Panel

```typescript
async function openPreviewPanel() {
  await Forma.openFloatingPanel({
    url: "/preview-panel.html",  // Must be part of your extension
    title: "Preview",
    width: 400,
    height: 300,
  });
}
```

### Cross-Panel Communication

Use MessagePort for communication between panels:

**Main Panel (main.ts):**

```typescript
let panelPort: MessagePort | null = null;

async function openPanelWithComms() {
  // Create message port
  const port = await Forma.createMessagePort();
  panelPort = port;

  // Listen for messages from panel
  port.onmessage = (event) => {
    console.log("Message from panel:", event.data);
  };

  // Open panel (it will receive the port)
  await Forma.openFloatingPanel({
    url: "/preview-panel.html",
    title: "Preview",
  });
}

// Send data to panel
function sendToPanel(data: any) {
  panelPort?.postMessage(data);
}
```

**Floating Panel (preview-panel.ts):**

```typescript
import { Forma } from "forma-embedded-view-sdk";

// Receive the port
Forma.onMessage((port) => {
  // Listen for messages from main panel
  port.onmessage = (event) => {
    console.log("Received:", event.data);
    updateUI(event.data);
  };

  // Send messages back
  port.postMessage({ type: "ready" });
});
```

## Debugging Tips

### 1. Use Browser DevTools

Extensions run in iframes, so you can use standard browser DevTools:

```typescript
// Add debug logging
console.log("Debug:", { variable });

// Use debugger statements
debugger;
```

### 2. Check Network Tab

Monitor SDK calls in the Network tab to see:
- Request/response payloads
- Timing issues
- Error responses

### 3. Common Issues

**Issue**: Extension doesn't load
- Check CORS settings in vite.config.ts
- Ensure `https` or `localhost`

**Issue**: Selection returns empty
- User needs to actually select something in Forma
- Check if correct element type is selected

**Issue**: Geometry is rotated wrong
- Forma uses specific coordinate conventions
- Apply rotation transforms relative to building center

### 4. SDK Error Handling

```typescript
try {
  const result = await Forma.selection.getSelection();
} catch (error) {
  if (error instanceof Error) {
    console.error("SDK Error:", error.message);
  }
}
```

## Best Practices

### 1. Debounce Frequent Operations

```typescript
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Use for auto-generation
const debouncedGenerate = debounce(generate, 300);
```

### 2. Handle Loading States

```typescript
function setLoading(loading: boolean) {
  const button = document.getElementById("generate");
  if (button) {
    button.disabled = loading;
    button.textContent = loading ? "Generating..." : "Generate";
  }
}
```

### 3. Clean Up Resources

```typescript
let meshIds: string[] = [];

async function addMesh(data: Float32Array) {
  const result = await Forma.render.addMesh({ geometryData: data });
  meshIds.push(result.id);
  return result.id;
}

async function clearAllMeshes() {
  await Promise.all(
    meshIds.map(id => Forma.render.removeMesh({ id }))
  );
  meshIds = [];
}
```

### 4. Validate User Input

```typescript
function validateConfig(config: UserConfig): string[] {
  const errors: string[] = [];

  if (config.width <= 0) {
    errors.push("Width must be positive");
  }

  if (config.percentage < 0 || config.percentage > 100) {
    errors.push("Percentage must be 0-100");
  }

  return errors;
}
```

### 5. Provide User Feedback

```typescript
function showStatus(message: string, type: "info" | "error" | "success") {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
    status.className = `status ${type}`;
  }
}
```

## Resources

- [Forma Developer Documentation](https://aps.autodesk.com/en/docs/forma/v1/overview/)
- [Forma SDK on npm](https://www.npmjs.com/package/forma-embedded-view-sdk)
- [This Repository](https://github.com/DanielGameiroAutodesk/floorplate-generator) - Full reference implementation

## Example Extensions

Use this Floorplate Generator as a starting point for:

- **Analysis tools**: Daylight analysis, view studies
- **Generators**: Unit layouts, parking, landscaping
- **Validators**: Code compliance, accessibility checks
- **Exporters**: Custom report generation

## Tips for Product Discovery

When building extensions for product discovery interviews:

1. **Start simple**: Get something working quickly, then iterate based on feedback
2. **Focus on the core interaction**: What's the one thing you want to learn?
3. **Don't over-engineer**: This is a prototype, not production software
4. **Record sessions**: Watch how users interact with your extension
5. **Iterate fast**: Use vibecoding to make changes between interviews

Remember: A working prototype that validates (or invalidates) your hypothesis is infinitely more valuable than a polished presentation that never gets tested.

---

Happy vibecoding! Build something, show it to users, learn, and repeat.
