# Baking Workflow Example

This example demonstrates the complete workflow for converting generated floorplates into native Forma building elements using the FloorStack SDK API.

## What You'll Learn

- Selecting a building footprint from Forma
- Generating a simple floorplate layout
- Converting FloorPlanData to FloorStack Plan format
- Creating buildings with unit subdivisions (LIVING_UNIT, CORE, CORRIDOR)
- Applying transforms with position compensation
- Optionally replacing the original building

## Prerequisites

- Forma SDK v0.90.0 or later
- A Forma project with building elements

## How to Use

1. Load this example as a Forma extension (or use the hosted URL)
2. Select a building in Forma
3. Click "Get Selection" to analyze the footprint
4. Adjust the number of floors if needed
5. Click "Generate" to create a simple floorplate
6. Click "Bake Building" to create the native building

## Code Walkthrough

### Step 1: Get Building Footprint

```javascript
const selection = await Forma.selection.getSelection();
const triangles = await Forma.geometry.getTriangles({ path: selectedPath });
// Calculate bounding box from triangles...
```

### Step 2: Generate Floorplate

The example creates a simple double-loaded corridor layout:
- 8 units (4 per side)
- 2 cores (at ends)
- Central corridor

In production, use the full `generateFloorplate()` function for optimized layouts.

### Step 3: Convert to FloorStack Format

Key conversion steps:

```javascript
// Center coordinates at origin
const cx = x - halfWidth;
const cy = y - halfDepth;

// Create vertices with deduplication
function getOrAddVertex(x, y) {
  const key = `${cx.toFixed(4)},${cy.toFixed(4)}`;
  if (vertexMap.has(key)) return vertexMap.get(key);
  // Add new vertex...
}

// Convert units with program types
units.push({
  polygon: [v1, v2, v3, v4],
  holes: [],
  program: 'LIVING_UNIT'  // or 'CORE', 'CORRIDOR'
});
```

### Step 4: Apply Transform with Position Compensation

**Critical**: The FloorStack API places a corner at the transform origin, not the center. Compensate:

```javascript
const offsetX = (-halfWidth) * cos - (-halfDepth) * sin;
const offsetY = (-halfWidth) * sin + (-halfDepth) * cos;

const transform = [
  cos, sin, 0, 0,
  -sin, cos, 0, 0,
  0, 0, 1, 0,
  centerX - offsetX, centerY - offsetY, elevation, 1
];
```

## FloorStack API Reference

```typescript
// Create building with unit subdivisions
const { urn } = await Forma.elements.floorStack.createFromFloors({
  floors: [
    { planId: 'plan1', height: 3.2 },
    { planId: 'plan1', height: 3.2 },
    // ... more floors
  ],
  plans: [{
    id: 'plan1',
    vertices: [
      { id: 'v0', x: -10, y: -5 },
      { id: 'v1', x: 10, y: -5 },
      // ...
    ],
    units: [
      { polygon: ['v0', 'v1', 'v2', 'v3'], holes: [], program: 'LIVING_UNIT' },
      // ...
    ]
  }]
});

// Add to proposal
await Forma.proposal.addElement({ urn, transform });
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Building in wrong position | Check position compensation formula |
| No unit subdivisions | Verify plan-based floors, not polygon-based |
| "units intersects" error | Check for overlapping polygons |
| 401 Unauthorized | Ensure SDK v0.90.0+ for built-in auth |

## SDK Version

This example requires `forma-embedded-view-sdk@0.90.0` or later for:
- FloorStack API with `plans` parameter
- Built-in authentication (no OAuth flow needed)
