# Baking Workflow Documentation

This document describes the "bake" feature that converts generated floorplates into native Forma building elements, including the technical challenges encountered and solutions attempted.

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

### Not Working (Pending)
- graphBuilding representation (requires basicbuilding/batch-create API)
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

## Next Steps

### For graphBuilding Support (requires API documentation)
1. **Obtain basicbuilding API documentation**: Request schema for `POST /public-api/v1alpha/basicbuilding/batch-create`
2. **Implement OAuth flow**: Configure `Forma.auth` with APS app credentials
3. **Make authenticated HTTP calls**: Use `fetch()` with access token to call the basicbuilding API
4. **Map FloorPlanData to BasicBuilding format**: The generated `graphBuilding` data structure is already correct

### Alternative Approach (simpler, works now)
1. **Use floorStack API**: `Forma.elements.floorStack.createFromFloors()` for simple buildings
2. **Add bakeWithFloorStack option**: Create buildings without unit subdivisions but with proper floor representation
3. **Test GFA generation**: Check if floorStack automatically generates `grossFloorAreaPolygons`

## Future Improvements

1. **Unified mesh**: Generate a single watertight mesh instead of overlapping boxes
2. **Alternative representation API**: Investigate other APIs for building metadata
3. **Position verification**: Add logging to verify mesh bounds and transform application
4. **Coordinate system abstraction**: Create utility functions for consistent conversions
5. **Bake world coordinates**: Consider baking world position directly into mesh vertices to avoid transform complexity

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

#### Alternative: floorStack API
The SDK provides `Forma.elements.floorStack.createFromFloors()` which:
- Creates 2.5D buildings from floor polygons
- Generates `volumeMesh` automatically
- Simpler but lacks unit/space subdivisions
- May auto-generate `grossFloorAreaPolygons` (unconfirmed)

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
