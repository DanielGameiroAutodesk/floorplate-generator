# Baking Workflow Documentation

This document describes the "bake" feature that converts generated floorplates into native Forma building elements, including the technical challenges encountered and solutions attempted.

> **For Vibecoding Reference**: This extension serves as a working example of Forma extension development with AI assistance. For the detailed debugging journey and technical investigations, see [BAKING_LESSONS_LEARNED.md](BAKING_LESSONS_LEARNED.md).

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

**Transform: Direct Center Translation**

Since `convertFloorPlanToFloorStackPlan()` centers all vertices at origin (building center at (0,0) in local space), no offset compensation is needed. Simply translate directly to world center:

```typescript
const cos = Math.cos(floorplan.transform.rotation);
const sin = Math.sin(floorplan.transform.rotation);

// Vertices are already centered by convertFloorPlanToFloorStackPlan().
// Building center is at (0, 0) in local space, so translate directly.
const transform = [
  cos, sin, 0, 0,
  -sin, cos, 0, 0,
  0, 0, 1, 0,
  floorplan.transform.centerX, floorplan.transform.centerY, floorplan.floorElevation, 1
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

---

## Why Direct API Calls Are Required

### SDK Limitations for Graph Buildings

The Forma SDK (`forma-embedded-view-sdk`) provides high-level wrappers for common operations like reading geometry, managing proposals, and rendering meshes. However, **`graphBuilding` representations and the BasicBuilding API are NOT exposed** through the SDK.

To create native Forma buildings with unit subdivisions (rooms, cores, corridors), you must make direct HTTP calls to the BasicBuilding API:

```
POST /forma/basicbuilding/v1alpha/basicbuilding/batch-create
```

This is an architectural constraint--graph buildings require server-side processing that isn't wrapped by the embedded view SDK.

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

1. **Run your local server on port 5173** (required for the OAuth callback)

2. **Install the Auth Helper Extension** in your Forma project:
   - Extension ID: `86e838c8-3b4d-452e-8496-67565e86cfa9`
   - This is an unpublished Forma extension available to any user

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

---

## Overview

The bake feature takes a generated floorplate (with units, cores, corridors, fillers) and converts it into a native Forma building element with:
- **volumeMesh**: 3D geometry as a GLB file
- **graphBuilding**: Building metadata (units, spaces, levels, functions)
- **grossFloorAreaPolygons**: Area type polygons for GFA calculations

### Filler Units for Leftover Space

When the generator cannot place a complete unit in remaining space, it creates **filler blocks** to ensure full building coverage. These fillers:
- Are automatically detected after segment generation
- Minimum width threshold: 0.001m (captures all gaps for FloorStack API coverage)
- Baked as `program: 'CORE'` type units in the FloorStack/BasicBuilding APIs
- Ensures no white space gaps appear in the final baked building

### Key Files

- **`src/extension/bake-building.ts`**: Main bake logic (mesh generation, GLB, Forma API integration)

### Data Flow

```
FloorPlanData (units, cores, corridor)
    |
convertFloorPlanToFloorStackPlan() -> FloorStackPlan (vertices, units)
    |
Forma.elements.floorStack.createFromFloors() -> URN
    |
Forma.proposal.addElement() -> Added to scene with transform
```

---

## Key Learnings

These are the critical technical insights discovered during development:

- **Forma's coordinate conversion formula**: `(x, y, z) -> (x, -z, y)` when importing GLB. GLB X -> World X, GLB Y -> World Z (elevation), GLB Z -> World -Y (negated!)
- **Transform is applied in Z-up world space**: Despite GLB being Y-up, the element transform uses Forma's Z-up. Rotate around Z axis, translate X/Y for position, Z for elevation.
- **Elevation calculation**: Z translation = `floorElevation + totalHeight` where `totalHeight = numFloors * FLOOR_HEIGHT`
- **Centered coordinates simplify transforms**: When mesh is centered at origin, just rotate and translate directly. No offset compensation needed.
- **Ear clipping for concave polygons**: Fan triangulation fails for L-shaped units. Use ear clipping algorithm instead.
- **Understand your coordinate system BEFORE writing transforms**: Log sample coordinates to verify if they're raw (0 to length) or centered (-half to +half).

> For the complete debugging journey with all approaches tried, see [BAKING_LESSONS_LEARNED.md](BAKING_LESSONS_LEARNED.md).

---

## BasicBuilding API Reference

### API Endpoint

**Via Forma Proxy (Recommended for Extensions):**
```
POST https://app.autodeskforma.eu/api/basicbuilding/v1alpha/basicbuilding/batch-create
```

**Direct API (Requires Bearer Token):**
```
POST https://developer.api.autodesk.com/forma/basicbuilding/v1alpha/basicbuilding/batch-create
```

**Query Parameters:**
- `authcontext`: Project ID (from `Forma.getProjectId()`)

### Request Body Schema

**IMPORTANT**: The request body must be an **array** of building objects (even for a single building).

```typescript
[
  {
    floors: BasicBuildingFloor[];  // required
    plans?: BasicBuildingFloorPlan[];  // optional, for unit subdivisions
  }
]
```

### Data Types

```typescript
interface BasicBuildingVertex {
  id: string;  // pattern: [a-zA-Z0-9-]{2,20}
  x: number;   // world X coordinate
  y: number;   // world Y coordinate
}

type UnitProgram = "CORE" | "CORRIDOR" | "LIVING_UNIT" | "PARKING";

interface BasicBuildingUnit {
  polygon: string[];    // array of vertex IDs
  holes: string[][];    // array of arrays of vertex IDs (empty [] if no holes)
  program?: UnitProgram;
  functionId?: string;  // e.g., "residential", "office"
}

interface BasicBuildingFloorPlan {
  id: string;
  vertices: BasicBuildingVertex[];
  units: BasicBuildingUnit[];
}

interface BasicBuildingFloorByPlan {
  planId: string;
  height: number;  // floor height in meters
}
```

### Example: Building with 2 Units

```typescript
const building = {
  floors: [
    { planId: "plan1", height: 3 }
  ],
  plans: [
    {
      id: "plan1",
      vertices: [
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 20, y: 0 },
        { id: "v3", x: 20, y: 10 },
        { id: "v4", x: 0, y: 10 },
        { id: "v5", x: 10, y: 0 },
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
  body: JSON.stringify([building])
});
```

### Placing the Building

```typescript
const elevation = await Forma.terrain.getElevationAt({ x: centerX, y: centerY });

await Forma.proposal.addElement({
  urn: results[0].urn,
  transform: [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    centerX, centerY, elevation, 1
  ]
});
```

---

## Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| FloorStack SDK baking | Working | Recommended approach (SDK v0.90.0) |
| BasicBuilding API baking | Working | Fallback with unit subdivisions |
| GLB mesh upload | Working | Simple volumes only |
| Correct position/rotation | Working | Centered coords + direct translate |
| L-shaped unit triangulation | Working | Ear clipping algorithm |
| grossFloorAreaPolygons | Not working | API returns 400 |
| Non-watertight mesh warning | Cosmetic | Does not affect functionality |

### Two Baking Approaches Available

| Approach | Function | Output | Use Case |
|----------|----------|--------|----------|
| FloorStack SDK | `bakeWithFloorStack()` | graphBuilding + volumeMesh | Recommended: unit subdivisions, area reports |
| BasicBuilding API | `bakeWithBasicBuildingAPI()` | graphBuilding + volumeMesh | Fallback: when FloorStack unavailable |

---

## Future Improvements

1. **Unified mesh**: Generate a single watertight mesh instead of overlapping boxes
2. **Coordinate system abstraction**: Create utility functions for consistent conversions
3. **Region auto-detection**: Automatically detect EMEA vs US from project metadata
