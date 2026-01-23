# Baking Workflow Documentation

This document describes the "bake" feature that converts generated floorplates into native Forma building elements, including the technical challenges encountered and solutions attempted.

> **For Vibecoding Reference**: This extension serves as a working example of Forma extension development with AI assistance. Key learnings are documented in the [Issues Solved](#issues-solved) and [Key Learnings](#key-learnings) sections.

## Quick Reference (TL;DR)

### FloorStack SDK API - Recommended (SDK v0.90.0)

The FloorStack SDK API is the recommended approach for creating buildings with unit subdivisions. It handles authentication automatically and supports plan-based floors with programs.

```typescript
import { bakeWithFloorStack } from './extension/bake-building';

// Single building
const result = await bakeWithFloorStack(floorplan, {
  numFloors: 5,
  originalBuildingPath: selectedPath,
  name: 'Generated Building'
});

// The function internally:
// 1. Converts FloorPlanData to FloorStack Plan format
// 2. Creates floors referencing the plan
// 3. Calls Forma.elements.floorStack.createFromFloors({ floors, plans })
// 4. Adds element to proposal with transform
```

**What happens under the hood:**

```typescript
// FloorPlanData is converted to FloorStack Plan format
const plan: FloorStackPlan = {
  id: 'plan1',
  vertices: [
    { id: 'v0', x: -10, y: -5 },
    { id: 'v1', x: 10, y: -5 },
    // ... deduplicated vertices
  ],
  units: [
    { polygon: ['v0', 'v1', 'v2', 'v3'], holes: [], program: 'LIVING_UNIT' },
    { polygon: ['v4', 'v5', 'v6', 'v7'], holes: [], program: 'CORE' },
    { polygon: ['v8', 'v9', 'v10', 'v11'], holes: [], program: 'CORRIDOR' },
  ]
};

// Create building with SDK
const { urn } = await Forma.elements.floorStack.createFromFloors({
  floors: Array(numFloors).fill({ planId: 'plan1', height: 3.2 }),
  plans: [plan]
});

// Add to proposal
await Forma.proposal.addElement({ urn, transform });
```

**Advantages over BasicBuilding API:**
- No manual authentication (SDK handles it)
- Simpler API surface
- Works in both localhost and production
- Proper unit program tagging (CORE, CORRIDOR, LIVING_UNIT)

**Critical: Position Compensation Required**

Even with centered coordinates, the FloorStack API places the southwest corner at the transform origin instead of the building center. Apply this offset compensation:

```typescript
const cos = Math.cos(floorplan.transform.rotation);
const sin = Math.sin(floorplan.transform.rotation);

// Vertex at (-halfWidth, -halfDepth) ends up at target center
// After rotation, this offset becomes:
const offsetX = (-halfWidth) * cos - (-halfDepth) * sin;
const offsetY = (-halfWidth) * sin + (-halfDepth) * cos;

// Subtract offset from translation to compensate
const adjustedCenterX = floorplan.transform.centerX - offsetX;
const adjustedCenterY = floorplan.transform.centerY - offsetY;

const transform = [
  cos, sin, 0, 0,
  -sin, cos, 0, 0,
  0, 0, 1, 0,
  adjustedCenterX, adjustedCenterY, floorplan.floorElevation, 1
];
```

---

### BasicBuilding API - Alternative Solution

```typescript
// 1. Convert floorplan to BasicBuilding format (vertices + units)
const buildingData = convertFloorPlanToBasicBuilding(floorplan, numFloors);

// 2. Call BasicBuilding API
const url = `https://app.autodeskforma.eu/api/forma/basicbuilding/v1alpha/basicbuilding/batch-create?authcontext=${projectId}`;
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Ads-Region': 'EMEA' },
  credentials: 'include',  // Uses session cookies
  body: JSON.stringify([buildingData])  // MUST be array!
});
const results = await response.json();

// 3. Add to proposal with transform
// IMPORTANT: If your coordinates are CENTERED (origin at building center),
// just rotate and translate directly:
const { centerX, centerY, rotation } = floorplan.transform;
const cos = Math.cos(rotation);
const sin = Math.sin(rotation);
const elevation = await Forma.terrain.getElevationAt({ x: centerX, y: centerY });

const transform = [
  cos, sin, 0, 0,
  -sin, cos, 0, 0,
  0, 0, 1, 0,
  centerX, centerY, elevation, 1  // Direct translation - no offset compensation!
];

await Forma.proposal.addElement({ urn: results[0].urn, transform });
```

### Common Pitfalls

| Problem | Cause | Solution |
|---------|-------|----------|
| Building offset | Assumed raw coords (0 to length) but they're centered | Check if coords have negative values; if so, they're centered |
| 401 Unauthorized | Missing auth on direct API | Use Forma proxy with `credentials: 'include'` |
| CORS from localhost | Forma proxy blocks localhost | Use direct API + Bearer token for localhost |
| "units intersects" error | Overlapping polygons | Check vertex deduplication and polygon winding |
| Request body format | Sent single object | Wrap in array: `[buildingData]` |

## Why Direct API Calls Are Required

### SDK Limitations for Graph Buildings

The Forma SDK (`forma-embedded-view-sdk`) provides high-level wrappers for common operations like reading geometry, managing proposals, and rendering meshes. However, **`graphBuilding` representations and the BasicBuilding API are NOT exposed** through the SDK.

To create native Forma buildings with unit subdivisions (rooms, cores, corridors), you must make direct HTTP calls to the BasicBuilding API:

```
POST /forma/basicbuilding/v1alpha/basicbuilding/batch-create
```

This is an architectural constraint—graph buildings require server-side processing that isn't wrapped by the embedded view SDK.

### Authentication Architecture

| Environment | API Endpoint | Auth Method |
|-------------|--------------|-------------|
| **Production** (hosted extension) | `app.autodeskforma.eu/api/` | Session cookies (`credentials: 'include'`) |
| **Localhost** (development) | `developer.api.autodesk.com/` | Bearer token (OAuth) |

**Production**: When your extension is deployed and hosted, requests can go through Forma's proxy at `app.autodeskforma.eu/api/`. This proxy automatically forwards session cookies, so no explicit token is needed.

**Localhost**: The Forma proxy blocks requests from localhost origins (CORS policy). To call APIs during local development, you must:
1. Use the direct Autodesk API endpoint
2. Obtain a Bearer token via OAuth

### Localhost Authentication Setup

When developing locally, follow these steps to authenticate API calls:

1. **Run your local server on port 5173**:
   - The local development server **must** be deployed on port `5173`
   - This is required for the OAuth callback to work correctly
   - Example: `vite --port 5173` or configure your bundler accordingly

2. **Install the Auth Helper Extension** in your Forma project:
   - Extension ID: `86e838c8-3b4d-452e-8496-67565e86cfa9`
   - This is an unpublished Forma extension available to any user
   - Install by navigating to the extension in Forma using its ID
   - This extension enables the OAuth flow for localhost development

3. **Use OAuth flow** to acquire a Bearer token:
   ```typescript
   Forma.auth.configure({
     clientId: "YOUR_APS_CLIENT_ID",
     callbackUrl: `${window.location.origin}/callback.html`,
     scopes: ["data:read", "data:write"],
   });
   const { accessToken } = await Forma.auth.acquireTokenOverlay();
   ```

4. **Call API directly** with the Bearer token:
   ```typescript
   const response = await fetch(
     'https://developer.api.autodesk.com/forma/basicbuilding/v1alpha/basicbuilding/batch-create?authcontext=' + projectId,
     {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${accessToken}`,
         'Content-Type': 'application/json',
         'X-Ads-Region': 'EMEA'  // or 'US' depending on project region
       },
       body: JSON.stringify([buildingData])
     }
   );
   ```

> **Note**: The `callback.html` file must exist at your callback URL path. It can be minimal—just a page that closes the authentication overlay window after the OAuth exchange completes.

## Overview

The bake feature takes a generated floorplate (with units, cores, corridors) and converts it into a native Forma building element with:
- **volumeMesh**: 3D geometry as a GLB file
- **graphBuilding**: Building metadata (units, spaces, levels, functions)
- **grossFloorAreaPolygons**: Area type polygons for GFA calculations

## Architecture

### Key Files

- **`src/extension/bake-building.ts`**: Main bake logic
  - Mesh generation functions
  - GLB file generation
  - Forma API integration
  - Representation builders

### Data Flow

```
FloorPlanData (units, cores, corridor)
    ↓
generateBuildingMeshLocal() → MeshData (verts, faces)
    ↓
generateGLB() → ArrayBuffer (GLB binary)
    ↓
Forma.integrateElements.uploadFile() → blobId
    ↓
Forma.integrateElements.createElementV2() → URN
    ↓
Forma.proposal.addElement() → Added to scene with transform
```

## Coordinate Systems

This was the primary challenge. Three coordinate systems are involved:

### 1. Forma's Native System (Z-up)
- X: Horizontal (width/length)
- Y: Horizontal (depth)
- Z: Vertical (height/up)

### 2. glTF Standard (Y-up)
- X: Horizontal
- Y: Vertical (up)
- Z: Horizontal (depth, towards viewer)

### 3. Element Transform
- Applied by Forma when placing elements
- Coordinate system depends on context (see issues below)

## Bugs and Issues Encountered

### Issue 1: 400 Bad Request with createElementV2

**Symptom**: Initial API calls failed with 400 errors.

**Cause**: Incorrect API usage - trying to create element with all representations at once.

**Solution**: Two-step process:
1. Create element with just `volumeMesh`
2. Update element with `graphBuilding` and `grossFloorAreaPolygons` via `batchIngestElementsV2`

**Note**: The batch update still returns 400 for `graphBuilding` and `grossFloorAreaPolygons` representations - these may not be supported by the integrate API.

### Issue 2: Element Not Watertight

**Symptom**: Building element reports as non-watertight; `graphBuilding` and `grossFloorAreaPolygons` return null.

**Cause**: Multiple overlapping boxes create non-manifold geometry where unit meshes share faces with corridor mesh.

**Status**: Partially addressed. The volumeMesh displays correctly, but internal representations fail to generate.

### Issue 3: Building Lying on Its Side

**Symptom**: Baked building appeared horizontal instead of vertical.

**Cause**: GLB uses Y-up coordinate system, but mesh was generated in Z-up (Forma's system).

**Approaches Tried**:

#### Approach A: No Conversion
```typescript
// Keep vertices as-is (Z-up)
const vertices = new Float32Array(mesh.verts);
```
**Result**: Building on its side. Forma imports GLB as Y-up, so our Z (height) becomes depth.

#### Approach B: glTF Node Rotation
```typescript
// Add rotation quaternion to glTF node
const rotationQuaternion = [-0.7071067811865475, 0, 0, 0.7071067811865476];
nodes: [{
  mesh: 0,
  rotation: rotationQuaternion  // -90° around X
}]
```
**Result**: Building standing, but position wrong.

#### Approach C: Vertex Conversion (Y↔Z swap)
```typescript
// Convert vertices from Z-up to Y-up
vertices[i * 3] = srcX;      // glTF X = Local X
vertices[i * 3 + 1] = srcZ;  // glTF Y = Local Z (height)
vertices[i * 3 + 2] = srcY;  // glTF Z = Local Y (depth)
```
**Result**: Building standing, but position wrong.

#### Approach D: Forma's Coordinate Formula (WORKING)
```typescript
// Convert to glTF Y-up using Forma's formula: (x, y, z) → (x, -z, y)
vertices[i * 3] = srcX;       // glTF X = Local X (width)
vertices[i * 3 + 1] = -srcZ;  // glTF Y = -Local Z (negated height!)
vertices[i * 3 + 2] = srcY;   // glTF Z = Local Y (depth)
```
**Result**: Building standing correctly when combined with Z-up transform and position offset compensation.

### Issue 4: Building Position Incorrect

**Symptom**: Building standing upright but offset from original position. "Bottom right corner at center of original building."

**Cause**: Mismatch between mesh coordinate system and transform coordinate system.

**Analysis**:
- When mesh is converted to Y-up, the transform must also operate in Y-up space
- Original transform assumed Z-up: rotated around Z axis, translated (centerX, centerY, 0)
- In Y-up space: should rotate around Y axis, translate (centerX, 0, centerY)

**Approaches Tried**:

#### Transform Approach A: Original Z-up Transform
```typescript
const transform = [
  cos, sin, 0, 0,    // Rotate in XY plane (around Z)
  -sin, cos, 0, 0,
  0, 0, 1, 0,
  centerX, centerY, 0, 1  // Translate in X, Y
];
```
**Result**: Position wrong - centerY was moving the building vertically instead of in depth direction.

#### Transform Approach B: Combined Conversion Matrix
```typescript
// Tried to combine Y↔Z swap with rotation
const transform = [
  cos, -sin, 0, 0,
  0, 0, 1, 0,
  sin, cos, 0, 0,
  centerX, centerY, 0, 1
];
```
**Result**: Building on its side again.

#### Transform Approach C: Y-up Transform
```typescript
// Rotate around Y axis (up in Y-up space)
// Translate in X and Z (horizontal plane in Y-up space)
const transform = [
  cos, 0, -sin, 0,    // Column 0: X basis (rotated around Y)
  0, 1, 0, 0,         // Column 1: Y basis (up - unchanged)
  sin, 0, cos, 0,     // Column 2: Z basis (rotated around Y)
  centerX, 0, centerY, 1  // Column 3: translate X and Z
];
```
**Result**: No 3D building visible - only floorplan rendered flat on the ground. The building geometry is either being flattened or positioned incorrectly (possibly underground or at wrong scale).

### Issue 5: Building Position Offset After Transform (SOLVED)

**Symptom**: After applying the Z-up transform with correct rotation, the building appeared at the correct elevation and rotation but was offset horizontally - the NW corner ended up at the intended center position.

**Cause**: The mesh was generated centered at origin (from -halfLength to +halfLength in X, from -halfDepth to +halfDepth in Y). When rotated around the center point, the corner positions shifted, causing the offset.

**Solution**: Calculate the rotated offset from the center to the NW corner and subtract it from the translation:

```typescript
const halfLength = floorplan.buildingLength / 2;
const halfDepth = floorplan.buildingDepth / 2;

// The NW corner at (-halfLength, +halfDepth) was ending up at center
// Calculate where this corner goes after rotation
const offsetX = (-halfLength) * cos - halfDepth * sin;
const offsetY = (-halfLength) * sin + halfDepth * cos;

// Subtract this offset from translation to compensate
const adjustedCenterX = floorplan.transform.centerX - offsetX;
const adjustedCenterY = floorplan.transform.centerY - offsetY;
```

**Result**: Building now appears at the correct position, elevation, and rotation.

### Issue 6: Non-Watertight L-Shaped Unit Meshes (SOLVED)

**Symptom**: L-shaped and corner units displayed strange diagonal triangles cutting across the notch/concave section. The mesh appeared visually broken with triangles spanning incorrectly.

**Cause**: Fan triangulation was used for all polygon caps (top and bottom faces), but fan triangulation only works correctly for **convex** polygons. L-shaped units have **concave** polygon footprints.

**Original Code (Broken)**:
```typescript
// Fan triangulation from vertex 0 to all other vertices
for (let i = 1; i < n - 1; i++) {
  faces.push(0, i + 1, i);  // Triangle: 0, i+1, i
}
```

This creates triangles like: (0,1,2), (0,2,3), (0,3,4), etc. For a convex polygon like a rectangle, all triangles stay inside the polygon. For a concave L-shape, some triangles cut through the empty notch.

**Solution**: Implemented the **ear clipping algorithm**, which works correctly for both convex and concave polygons.

**Key Functions Added**:

```typescript
// 2D cross product for orientation testing
function cross2D(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

// Point-in-triangle test using barycentric coordinates
function pointInTriangle(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number
): boolean {
  const v0x = cx - ax, v0y = cy - ay;
  const v1x = bx - ax, v1y = by - ay;
  const v2x = px - ax, v2y = py - ay;
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;
  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  const eps = 1e-10;
  return (u >= -eps) && (v >= -eps) && (u + v <= 1 + eps);
}

// Check if vertex i is a valid ear (convex and no vertices inside)
function isEar(
  points: { x: number; y: number }[],
  i: number,
  activeIndices: number[]
): boolean {
  const n = activeIndices.length;
  const prevIdx = activeIndices[(i - 1 + n) % n];
  const currIdx = activeIndices[i];
  const nextIdx = activeIndices[(i + 1) % n];

  const prev = points[prevIdx];
  const curr = points[currIdx];
  const next = points[nextIdx];

  // Check if vertex is convex (left turn in CCW polygon)
  const cross = cross2D(
    curr.x - prev.x, curr.y - prev.y,
    next.x - curr.x, next.y - curr.y
  );
  if (cross <= 0) return false;  // Reflex vertex, not an ear

  // Check no other vertices inside this triangle
  for (let j = 0; j < n; j++) {
    if (j === (i - 1 + n) % n || j === i || j === (i + 1) % n) continue;
    const testIdx = activeIndices[j];
    const p = points[testIdx];
    if (pointInTriangle(p.x, p.y, prev.x, prev.y, curr.x, curr.y, next.x, next.y)) {
      return false;  // Another vertex inside, not a valid ear
    }
  }
  return true;
}

// Ear clipping triangulation - works for concave polygons
function triangulatePolygon(points: { x: number; y: number }[]): number[] {
  const indices: number[] = [];
  const activeIndices = points.map((_, i) => i);

  while (activeIndices.length > 3) {
    let earFound = false;
    for (let i = 0; i < activeIndices.length; i++) {
      if (isEar(points, i, activeIndices)) {
        // Clip the ear
        const n = activeIndices.length;
        const prevIdx = activeIndices[(i - 1 + n) % n];
        const currIdx = activeIndices[i];
        const nextIdx = activeIndices[(i + 1) % n];
        indices.push(prevIdx, currIdx, nextIdx);
        activeIndices.splice(i, 1);
        earFound = true;
        break;
      }
    }
    if (!earFound) break;  // Degenerate polygon
  }

  // Final triangle
  if (activeIndices.length === 3) {
    indices.push(activeIndices[0], activeIndices[1], activeIndices[2]);
  }
  return indices;
}
```

**How Ear Clipping Works**:
1. Start with all polygon vertices as "active"
2. Find an "ear" - a vertex where:
   - The vertex is convex (interior angle < 180°)
   - No other vertices lie inside the triangle formed with its neighbors
3. "Clip" the ear by adding that triangle and removing the vertex
4. Repeat until only 3 vertices remain (the final triangle)

**Result**: L-shaped units now render with correct triangulation - triangles stay within the polygon boundary and don't cut across concave regions.

### Issue 7: BasicBuilding API Position Offset (SOLVED)

**Symptom**: When using the BasicBuilding API (instead of GLB mesh upload), the baked building appeared at the wrong horizontal position - offset from the original building footprint.

**Root Cause**: The code incorrectly assumed that floorplan coordinates were in "raw" local space (0 to length, 0 to depth), but they were actually **already centered** around the origin.

**Where Coordinates Get Centered** (in `generator.ts:2170-2171`):
```typescript
const offsetX = -length / 2;
const offsetY = -buildingDepth / 2;

// All units, cores, corridors have this offset applied:
const outputUnits: UnitBlock[] = units.map(u => ({
  ...u,
  x: u.x + offsetX,  // Results in range: -halfLength to +halfLength
  y: u.y + offsetY,  // Results in range: -halfDepth to +halfDepth
}));
```

**Broken Code** (assumed raw 0-based coordinates):
```typescript
// WRONG: Assumed coordinates ranged from 0 to length
const halfLength = floorplan.buildingLength / 2;
const halfDepth = floorplan.buildingDepth / 2;

// After rotation around origin, where does (halfLength, halfDepth) end up?
const rotatedCenterX = cos * halfLength - sin * halfDepth;
const rotatedCenterY = sin * halfLength + cos * halfDepth;

// Translation to compensate for non-centered origin
const tx = centerX - rotatedCenterX;  // WRONG!
const ty = centerY - rotatedCenterY;  // WRONG!
```

**Fixed Code** (recognizes centered coordinates):
```typescript
// CORRECT: Coordinates are already centered at (0, 0)
// The building center is at the origin in local space
// Just rotate around origin and translate to world center

const { centerX, centerY, rotation } = floorplan.transform;
const cos = Math.cos(rotation);
const sin = Math.sin(rotation);

// 4x4 column-major transform matrix
const transform = [
  cos, sin, 0, 0,           // Column 0: X axis after rotation
  -sin, cos, 0, 0,          // Column 1: Y axis after rotation
  0, 0, 1, 0,               // Column 2: Z axis (unchanged)
  centerX, centerY, elevation, 1  // Column 3: Direct translation to world center
];

await Forma.proposal.addElement({ urn, transform });
```

**Key Insight**: When local coordinates are centered (origin = building center), the transform is simple:
1. Rotate around origin (which is already the center)
2. Translate directly to world center

No need to compensate for center position because the center is already at (0, 0).

**Debugging Tip**: Always verify the coordinate system of your input data by logging sample coordinates:
```typescript
console.log('Sample unit coordinates:');
floorplan.units.slice(0, 3).forEach(u => {
  console.log(`  ${u.id}: (${u.x.toFixed(2)}, ${u.y.toFixed(2)})`);
});
// If you see negative values, coordinates are centered!
```

**Result**: Building now appears at the correct position, aligned with the original footprint.

## Key Learnings

### 1. Forma's Coordinate Conversion Formula (CRITICAL)
Forma converts coordinates from local/GLB space to world space using the formula:
```
(x, y, z) → (x, -z, y)
```
This means:
- GLB X → World X
- GLB Y → World Z (elevation)
- GLB Z → World -Y (negated!)

When generating GLB vertices from local Z-up mesh:
```typescript
vertices[i * 3] = srcX;       // glTF X = Local X (width)
vertices[i * 3 + 1] = -srcZ;  // glTF Y = -Local Z (negated height!)
vertices[i * 3 + 2] = srcY;   // glTF Z = Local Y (depth)
```

### 2. Transform Applied in Z-up World Space
Despite the GLB being in Y-up format, the element transform is applied in Forma's Z-up world space:
- Rotation should be around Z (up) axis
- Translation X, Y for horizontal position
- Translation Z for elevation

```typescript
const transform = [
  cos, sin, 0, 0,     // Column 0: X basis (rotated around Z)
  -sin, cos, 0, 0,    // Column 1: Y basis (rotated around Z)
  0, 0, 1, 0,         // Column 2: Z basis (up direction - unchanged)
  centerX, centerY, elevation, 1  // Column 3: translation in world space
];
```

### 3. Elevation Calculation
The Z translation in the transform represents the elevation of the mesh origin in world space:
```typescript
const zTranslation = floorplan.floorElevation + totalHeight;
```
Where `totalHeight = numFloors * FLOOR_HEIGHT`.

### 4. Position Compensation for Centered Meshes
When mesh is generated centered at origin, rotation causes corner offset. Compensate by subtracting the rotated offset from the translation.

### 5. API Limitations
- `batchIngestElementsV2` returns 400 for `graphBuilding` and `grossFloorAreaPolygons` representations
- graphBuilding requires the `POST /public-api/v1alpha/basicbuilding/batch-create` API instead
- The building works as a solid volume, but requires the basicbuilding API for room subdivisions

### 6. Understand Your Coordinate System BEFORE Writing Transforms (CRITICAL)

The most common source of position bugs is misunderstanding the coordinate system of your input data. Before writing any transform code:

**Step 1: Verify coordinate origin**
```typescript
// Log sample coordinates to understand the system
console.log('Coordinate check:');
console.log(`  Building dimensions: ${length} x ${depth}`);
console.log(`  Sample unit at: (${units[0].x}, ${units[0].y})`);
// If x is negative → centered coordinates
// If x starts at 0 → raw coordinates
```

**Step 2: Trace coordinate transformations**
Follow the data flow from source to output:
1. Where is the original data created?
2. Are any offsets applied? (Search for `offsetX`, `offset`, `center`)
3. What coordinate system does the API expect?

**Step 3: Match transform to coordinate system**

| Coordinate System | Origin | Transform Strategy |
|-------------------|--------|-------------------|
| Raw (0 to length) | Corner | Translate center to world, then rotate |
| Centered (-half to +half) | Center | Rotate around origin, then translate to world |
| World coordinates | World origin | Identity or direct use |

**Common Mistakes**:
- Assuming coordinates start at 0 when they're actually centered
- Applying center compensation when coordinates are already centered (causes double offset)
- Forgetting that rotation happens around the origin (wherever that is in your coordinate system)

### 7. BasicBuilding API vs GLB Mesh Upload

Two approaches for creating buildings in Forma, each with different coordinate handling:

| Aspect | GLB Mesh Upload | BasicBuilding API |
|--------|-----------------|-------------------|
| Coordinates in file | Y-up (GLB standard) | Z-up (world coords) |
| Transform applied | After Forma's (x,y,z)→(x,-z,y) conversion | Directly in world space |
| Unit subdivisions | No (volumeMesh only) | Yes (graphBuilding) |
| Authentication | Via SDK file upload | Bearer token or session cookies |

**GLB Mesh Workflow**:
1. Generate mesh in local Z-up space (centered at origin)
2. Convert to GLB: `(x, y, z) → (x, -z, y)` with negated Z
3. Upload via `Forma.elements.createFromGlb()`
4. Add to proposal with transform (rotation + translation + elevation)

**BasicBuilding API Workflow**:
1. Define vertices in local 2D space (X, Y only)
2. Send to BasicBuilding API (creates URN)
3. Add to proposal with full 4x4 transform matrix
4. Transform converts local coords to world position

## Mesh Generation Details

### generateBuildingMeshLocal()
Generates mesh in local coordinates, centered at origin:
- Units positioned at `(unit.x - halfLength, unit.y - halfDepth, floorZ)`
- Supports both rectangular units and L-shaped units (extruded polygons)
- Multiple floors stacked vertically

### generateBoxMeshLocal()
Creates a box with 8 vertices and 12 triangles (2 per face):
- Vertices defined for all 8 corners
- Faces wound counter-clockwise for outward normals

### generateExtrudedPolygonMesh()
Extrudes a 2D polygon to create L-shaped units:
- **Bottom face**: Vertices at z=0, triangulated using ear-clipping algorithm
- **Top face**: Vertices at z=height, same triangulation with reversed winding
- **Side faces**: Each edge becomes a quad (2 triangles) connecting bottom to top
- Uses ear-clipping for triangulation to correctly handle concave polygons (see Issue 6)

**Why Ear Clipping is Necessary**:
Simple fan triangulation (connecting all vertices to vertex 0) only works for convex polygons. L-shaped units have concave footprints where fan triangulation creates triangles that span outside the polygon boundary. Ear clipping handles any simple polygon (convex or concave) by progressively removing "ear" triangles from the perimeter.

### generateGLB()
Converts mesh to GLB format:
1. Convert vertices from Z-up to Y-up
2. Calculate bounding box for accessor min/max
3. Build glTF JSON structure
4. Pack binary buffer (vertices + indices)
5. Create GLB with header + JSON chunk + binary chunk

## Current Status

### Working (SOLVED)
- Mesh generation for all unit types
- GLB file generation and upload
- Element creation with volumeMesh
- **Coordinate system conversion**: Using `(x, y, z) → (x, -z, y)` formula
- **Building orientation**: Correct rotation around Z axis in world space
- **Building position**: Correct position with offset compensation
- **Building elevation**: Correct Z translation = floorElevation + totalHeight
- **L-shaped unit triangulation**: Ear clipping algorithm for concave polygons
- **BasicBuilding API integration**: Creates native Forma buildings with unit subdivisions (graphBuilding)
- **BasicBuilding position**: Correct position using centered coordinates + world transform

### Not Working (Pending)
- grossFloorAreaPolygons representation (API returns 400)
- Non-watertight mesh warning (cosmetic - doesn't affect volumeMesh)

### Summary of Transform/Coordinate Issues (RESOLVED)

| Approach | Mesh Conversion | Transform | Result |
|----------|-----------------|-----------|--------|
| None | Z-up (raw) | Z-up standard | Building on side |
| Node rotation | Z-up + quaternion | Z-up standard | Standing, wrong position |
| Vertex swap | Y-up (Y↔Z) | Z-up standard | Standing, wrong position |
| Vertex swap | Y-up (Y↔Z) | Combined swap matrix | Building on side |
| Vertex swap | Y-up (Y↔Z) | Y-up (rotate around Y) | Flat on ground (no 3D) |
| **Forma formula** | **(x,-z,y)** | **Z-up with position offset** | **✓ CORRECT** |

**Answer to the fundamental questions:**
- Transform is applied in **Forma's Z-up world space**
- Forma does **automatic coordinate conversion** when importing GLB using formula: `(x, y, z) → (x, -z, y)`
- The GLB should be generated with negated Y coordinates to account for this conversion

### Summary of Triangulation Issues (RESOLVED)

| Polygon Type | Fan Triangulation | Ear Clipping |
|--------------|-------------------|--------------|
| Rectangle (convex) | ✓ Works | ✓ Works |
| L-shape (concave) | ✗ Triangles cross notch | ✓ Works |
| U-shape (concave) | ✗ Triangles cross notches | ✓ Works |
| Any simple polygon | Only convex | ✓ All simple polygons |

**Key insight**: Fan triangulation connects all vertices to vertex 0, which fails when the line from vertex 0 to another vertex passes outside the polygon (concave case). Ear clipping removes triangles from the polygon perimeter, ensuring all triangles stay within bounds.

## BasicBuilding API (DOCUMENTED)

The basicbuilding API creates native Forma buildings with unit subdivisions. Unlike `integrateElements.createElementV2`, this API automatically generates both `volumeMesh` and `graphBuilding` representations.

### API Endpoint

**Via Forma Proxy (Recommended for Extensions):**
```
POST https://app.autodeskforma.eu/api/basicbuilding/v1alpha/basicbuilding/batch-create
```

This routes through Forma's internal proxy which uses session cookies for authentication - no Bearer token needed when running inside a Forma extension.

**Direct API (Requires Bearer Token):**
```
POST https://developer.api.autodesk.com/forma/basicbuilding/v1alpha/basicbuilding/batch-create
```

**Query Parameters:**
- `authcontext`: Project ID (from `Forma.getProjectId()`)

**Headers (Proxy):**
- `Content-Type: application/json`
- `X-Ads-Region`: `EMEA` or `US` (based on project region)
- `credentials: 'include'` (fetch option to send session cookies)

**Headers (Direct API):**
- `Authorization: Bearer {accessToken}`
- `Content-Type: application/json`
- `X-Ads-Region`: `EMEA` or `US` (based on project region)

### Request Body Schema

**IMPORTANT**: The request body must be an **array** of building objects (even for a single building).

```typescript
// Top-level: array of buildings
[
  {
    floors: BasicBuildingFloor[];  // required
    plans?: BasicBuildingFloorPlan[];  // optional, for unit subdivisions
  }
]
```

### Data Types

```typescript
// Vertex definition - vertices are defined once and referenced by ID
interface BasicBuildingVertex {
  id: string;  // pattern: [a-zA-Z0-9-]{2,20}
  x: number;   // world X coordinate
  y: number;   // world Y coordinate
}

// Unit programs - defines the space type for area calculations
type UnitProgram = "CORE" | "CORRIDOR" | "LIVING_UNIT" | "PARKING";

// Unit definition - references vertices by ID
interface BasicBuildingUnit {
  polygon: string[];    // required - array of vertex IDs (e.g., ["v1", "v2", "v3"])
  holes: string[][];    // required - array of arrays of vertex IDs (empty [] if no holes)
  program?: UnitProgram;  // optional - space type for area breakdown
  functionId?: string;    // optional - building function (e.g., "residential", "office")
}

// NOTE: functionId determines the building function shown in Forma's analysis.
// All units (LIVING_UNIT, CORE, CORRIDOR) should have the same functionId
// for consistent building function reporting. Example: functionId: "residential"

// Floor plan with unit subdivisions
interface BasicBuildingFloorPlan {
  id: string;                      // required - plan identifier
  vertices: BasicBuildingVertex[]; // required - all vertices for this plan
  units: BasicBuildingUnit[];      // required - unit definitions
}

// Floor by polygon (simple, no units)
interface BasicBuildingFloorByPolygon {
  polygon: number[][];  // required - array of [x, y] coordinate pairs
  height: number;       // required - floor height in meters
  functionId?: string;  // optional
}

// Floor by plan reference (with units)
interface BasicBuildingFloorByPlan {
  planId: string;   // required - references a plan ID
  height: number;   // required - floor height in meters
}
```

### Example: Building with 2 Units

```typescript
const building = {
  floors: [
    { planId: "plan1", height: 3 }  // Reference the plan
  ],
  plans: [
    {
      id: "plan1",
      vertices: [
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 20, y: 0 },
        { id: "v3", x: 20, y: 10 },
        { id: "v4", x: 0, y: 10 },
        { id: "v5", x: 10, y: 0 },   // Middle vertices for split
        { id: "v6", x: 10, y: 10 },
      ],
      units: [
        { polygon: ["v1", "v5", "v6", "v4"], holes: [], program: "LIVING_UNIT", functionId: "residential" },
        { polygon: ["v5", "v2", "v3", "v6"], holes: [], program: "LIVING_UNIT", functionId: "residential" },
      ]
    }
  ]
};

// Send as array!
const response = await fetch(url, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify([building])  // <-- Array wrapper!
});
```

### Response

```typescript
// Array of created element URNs
[
  { urn: "urn:adsk-forma-elements:basicbuilding:..." }
]
```

### Placing the Building

After creation, add to proposal with terrain elevation:

```typescript
const elevation = await Forma.terrain.getElevationAt({ x: centerX, y: centerY });

await Forma.proposal.addElement({
  urn: results[0].urn,
  transform: [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    centerX, centerY, elevation, 1  // Position with terrain elevation
  ]
});
```

### Authentication

**Recommended: Forma Proxy (No Token Needed)**

When routing through `app.autodeskforma.eu/api/`, the request uses session cookies automatically. No explicit authentication setup required:

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Ads-Region': 'EMEA'
  },
  credentials: 'include',  // Include session cookies
  body: JSON.stringify([building])
});
```

**Alternative: Direct API with Bearer Token**

If calling `developer.api.autodesk.com` directly, you need a token:

1. **SDK Token** (requires APS app configuration):
   ```typescript
   Forma.auth.configure({
     clientId: "YOUR_CLIENT_ID",
     callbackUrl: `${window.location.origin}/`,
     scopes: ["data:read", "data:write"],
   });
   const accessToken = await Forma.auth.acquireTokenOverlay();
   ```

2. **Manual Token** (for development/testing):
   - Copy token from browser dev tools (look for Bearer token in API requests)

## Implementation Status

### Completed ✓
1. **Add basicbuilding types** to `bake-building.ts` ✓
2. **Convert FloorPlanData to BasicBuilding format**: Map unit polygons to vertex references ✓
3. **Implement API call**: Uses Forma proxy with session cookies ✓
4. **Handle multi-floor buildings**: Create floor entries referencing same plan ✓
5. **Add terrain elevation lookup**: Use `Forma.terrain.getElevationAt()` for positioning ✓
6. **Fix position offset**: Recognize centered coordinates, apply simple rotate + translate ✓
7. **Dual auth support**: Localhost uses direct API + Bearer token, production uses Forma proxy + cookies ✓
8. **Corridor inclusion**: Re-enabled corridor in BasicBuilding output ✓
9. **Building function**: All units set `functionId: "residential"` for proper function reporting ✓

### Tested & Verified ✓
- `bakeWithBasicBuildingAPI()` creates buildings at correct position
- Session cookie authentication works through Forma proxy in production
- Bearer token authentication works via direct API from localhost
- Building aligns with original footprint after bake
- Building function shows as "Residential" in Forma analysis (via `functionId`)

### Two Baking Approaches Available

| Approach | Function | Output | Use Case |
|----------|----------|--------|----------|
| GLB Mesh | `bakeBuilding()` | volumeMesh only | Quick preview, simple buildings |
| BasicBuilding API | `bakeWithBasicBuildingAPI()` | graphBuilding + volumeMesh | Unit subdivisions, area reports |

## Future Improvements

1. **Unified mesh**: Generate a single watertight mesh instead of overlapping boxes
2. **Coordinate system abstraction**: Create utility functions for consistent conversions
3. **Region auto-detection**: Automatically detect EMEA vs US from project metadata

---

## API Documentation Sources

### Official Autodesk Forma Documentation

| Resource | URL | Description |
|----------|-----|-------------|
| Forma API (Beta) | https://aps.autodesk.com/en/docs/forma/v1 | Main API documentation |
| Element System | https://aps.autodesk.com/en/docs/forma/v1/working-with-forma/element-system | Element creation and management |
| FormaElement Specification | https://aps.autodesk.com/en/docs/forma/v1/working-with-forma/element-system/forma-element-specification | Element properties and representations |
| SDK Documentation | https://aps.autodesk.com/en/docs/forma/v1/embedded-views/sdk-documentation | Embedded view SDK guide |
| SDK Type Reference | https://app.autodeskforma.com/forma-embedded-view-sdk/docs/ | Full SDK API reference |
| CreateElementHierarchy Types | https://app.autodeskforma.com/forma-embedded-view-sdk/docs/types/integrate_elements.CreateElementHierarchy-1.html | Element hierarchy creation |

### NPM Package
- **forma-embedded-view-sdk**: https://www.npmjs.com/package/forma-embedded-view-sdk

### Key API Concepts (from documentation)

#### Element System
> "From a consumer side the Forma data model is built up of two pieces: Elements with their relationships and Properties, and Representations. Elements are anything in the scene or internal organization of the elements in the scene. Representations are the way a Forma element communicates its internal state like a Volume Mesh to the rest of Forma."

#### Transform Matrix
> "The Transform used is a standard 4x4 Matrix."

Translation values should be in positions [12], [13], [14] for x, y, z offsets (column-major format).

#### GLB Rendering
> "With `Forma.render.glb` you can render 3D geometry in a GLB file, which is the binary version of glTF."

#### Coordinate System
> "Forma always uses a UTM coordinate system (with a WGS 84 datum) in the correct UTM zone for the location the project is in."

---

## Forum Discussions & Related Issues

### Autodesk Forma Developer Forum
- **Forum URL**: https://forums.autodesk.com/t5/forma-developer-forum/bd-p/FormaDeveloperForum

### Relevant Forum Threads

| Thread | URL | Relevance |
|--------|-----|-----------|
| Coordinate System | https://forums.autodesk.com/t5/forma-developer-forum/coordinate-system/td-p/12435145 | Geographic coordinate systems in Forma |
| Returning other objects other than meshes | https://forums.autodesk.com/t5/forma-developer-forum/returning-other-objects-other-than-meshes/td-p/12311062 | Using `integrateElements.createElementHierarchy` with mesh geometry |
| Can I add rotation to a generated Forma GeoJson? | https://forums.autodesk.com/t5/forma-developer-forum/can-i-add-rotation-to-a-generated-forma-geojson/td-p/13004695 | Transform/rotation discussion, suggests using gl-matrix library |
| Terrain generator | https://forums.autodesk.com/t5/forma-developer-forum/terrain-generator/td-p/12326721 | Terrain API limitations |
| Forma API for Site and Building Area | https://forums.autodesk.com/t5/forma-developer-forum/forma-api-for-site-and-building-area/td-p/12274235 | Building element representations |

### General Forma Forum (Non-Developer)
| Thread | URL | Relevance |
|--------|-----|-----------|
| Coordinating & locating imports in Revit | https://forums.autodesk.com/t5/forma-forum/coordinating-amp-locating-imports-in-revit/td-p/11965722 | Import positioning issues |
| Geographic Coordinate System | https://forums.autodesk.com/t5/forma-forum/geographic-coordinate-system/td-p/12493467 | Coordinate system support |
| Coordinate Systems | https://forums.autodesk.com/t5/forma-forum/coordinate-systems/td-p/13882100 | General coordinate system discussion |

### Related Non-Forma Threads (GLB/Coordinate Issues)

| Thread | URL | Relevance |
|--------|-----|-----------|
| Export .glb File needs Rotated (Inventor) | https://forums.autodesk.com/t5/inventor-forum/export-glb-file-needs-rotated/td-p/12790899 | GLB exports default to XY plane; solved by rotating around Y axis |
| GLB Export Axis Coordinate System (McNeel) | https://discourse.mcneel.com/t/glb-export-axis-coordinate-system/117289 | GLB/glTF uses Y-up right-handed coordinate system |

---

## glTF/GLB Coordinate System Standard

From the [glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html):

> "glTF uses a right-handed coordinate system. glTF defines +Y as up, +Z as forward, and -X as right; the front of a glTF asset faces +Z."

This differs from many CAD applications (including Forma internally) which use Z-up:
- **glTF/GLB**: Y-up, right-handed
- **Forma**: Z-up, right-handed (UTM coordinates)

### Conversion Required
When creating GLB files for Forma:
1. Mesh vertices may need Y↔Z conversion
2. Element transform may need adjustment to match coordinate system
3. The exact behavior depends on how Forma imports and applies transforms (undocumented)

---

## Known Limitations & Undocumented Behavior

### Not Documented
1. **Transform coordinate system**: Whether Forma applies element transforms in GLB's Y-up space or its own Z-up space
2. **Automatic coordinate conversion**: Whether Forma auto-converts Y-up GLB to Z-up when importing
3. **createElementV2 vs createElementHierarchy**: The `createElementV2` method is used in code but not found in public documentation

### API Limitations Discovered

#### graphBuilding Representation
**Per Forma Product Team (confirmed):**
- `batchIngestElementsV2` does **NOT** support `graphBuilding` representation (returns 400)
- `graphBuilding` requires the `POST /public-api/v1alpha/basicbuilding/batch-create` API
- This API is not exposed in the SDK and requires:
  - Direct HTTP calls with OAuth authentication
  - Project ID from `Forma.getProjectId()`
  - Region from `Forma.getRegion()` for the correct API base URL
  - Access token from `Forma.auth` (requires APS app configuration)

#### grossFloorAreaPolygons Representation
- Also returns 400 when using `batchIngestElementsV2`
- May be automatically derived from `graphBuilding` when using the proper API

#### Current Workaround
The building works as a solid volume without room subdivisions. The generated `graphBuilding` and `grossFloorAreaPolygons` data is preserved in code for future use when the `basicbuilding` API documentation becomes available.

#### FloorStack API (SDK v0.90.0) - NOW SUPPORTS PLANS
The SDK provides `Forma.elements.floorStack.createFromFloors()` which:
- Creates 2.5D buildings from floor polygons OR plan references
- Generates `volumeMesh` automatically
- **NEW in v0.90.0:** Supports `plans` parameter for unit subdivisions
- Properly tags programs (CORE, CORRIDOR, LIVING_UNIT, PARKING)
- **This is now the recommended approach** - see `bakeWithFloorStack()` function

```typescript
// New SDK v0.90.0 usage with plans
const { urn } = await Forma.elements.floorStack.createFromFloors({
  floors: [{ planId: 'plan1', height: 3.2 }],
  plans: [{
    id: 'plan1',
    vertices: [...],
    units: [{ polygon: [...], holes: [], program: 'LIVING_UNIT' }]
  }]
});
```

### Documentation Gap
> "I realize we haven't documented the integrateElements in our SDK documentation, which we should add ASAP, but there is an in depth explanation in our http specification."
> — Autodesk staff on forum

---

## Additional Resources

### Presentations
- **AU 2024: Extending Autodesk Forma to Create Powerful Extensions** (SD2858)
  - PDF: https://static.rainfocus.com/autodesk/au2024/sess/1714403202332001pGmI/srchandout/AU-Handout-Extending-Forma_1727788328701001e5Nc.pdf

### Blog Posts
- **Use the open Forma API to add custom extensions and contextual data**
  - https://aps.autodesk.com/blog/use-open-forma-api-add-custom-extensions-and-contextual-data

### GitHub Examples
- **Forma Extension File Explorer**
  - https://github.com/autodesk-platform-services/aps-forma-extension-file-explorer
