/**
 * Bake Building - Converts generated floorplates to native Forma buildings
 *
 * This module takes FloorPlanData from the generator and creates a native
 * Forma building element with full metadata including:
 * - GraphBuilding representation (units, spaces, levels with functions)
 * - GrossFloorAreaPolygons representation (area types)
 * - Footprint representation
 * - Volume mesh geometry (as GLB)
 */

import { Forma } from 'forma-embedded-view-sdk/auto';
import type { FloorPlanData, UnitBlock } from '../algorithm/types';

// Floor height in meters (typical residential)
const FLOOR_HEIGHT = 3.2;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MeshData {
  verts: number[];
  faces: number[];
}

interface GraphBuildingSurface {
  id: string;
  pointA: string;
  pointB: string;
}

interface GraphBuildingCoSurface {
  id: string;
  partnerId: string | null;
  surfaceId: string;
  directionAToB: boolean;
}

interface GraphBuildingSpace {
  id: string;
  outerLoop: GraphBuildingCoSurface[];
  innerLoops?: GraphBuildingCoSurface[][];
}

interface GraphBuildingLevel {
  height: number;
  points: Record<string, [number, number]>;
  spaces: GraphBuildingSpace[];
  surfaces: GraphBuildingSurface[];
}

interface GraphBuildingUnit {
  id: string;
  properties: {
    function?: string;
    program?: string;
  };
  spaceIds: string[];
}

interface GraphBuilding {
  units: GraphBuildingUnit[];
  levels: GraphBuildingLevel[];
}

interface GrossFloorAreaPolygon {
  grossFloorPolygon: [number, number][][];  // MultiRingPolygon
  elevation: number;
  areaType?: 'CORE' | 'CORRIDOR' | 'LIVING_UNIT' | 'UNASSIGNED';
}

// ============================================================================
// BASIC BUILDING API TYPES (for graphBuilding with units)
// ============================================================================

interface BasicBuildingVertex {
  id: string;  // pattern: [a-zA-Z0-9-]{2,20}
  x: number;   // world X coordinate
  y: number;   // world Y coordinate
}

type BasicBuildingProgram = 'CORE' | 'CORRIDOR' | 'LIVING_UNIT' | 'PARKING';

interface BasicBuildingUnit {
  polygon: string[];      // required - array of vertex IDs
  holes: string[][];      // required - array of arrays of vertex IDs (empty [] if no holes)
  program?: BasicBuildingProgram;
  functionId?: string;
}

interface BasicBuildingFloorPlan {
  id: string;
  vertices: BasicBuildingVertex[];
  units: BasicBuildingUnit[];
}

interface BasicBuildingFloorByPlan {
  planId: string;
  height: number;
}

interface CreateBasicBuildingRequest {
  floors: BasicBuildingFloorByPlan[];
  plans: BasicBuildingFloorPlan[];
}

interface BasicBuildingCreateResponse {
  urn: string;
}

// ============================================================================
// FLOORSTACK API TYPES (SDK v0.90.0 - plan-based floors with units)
// ============================================================================

interface FloorStackVertex {
  id: string;   // Pattern: [a-zA-Z0-9-]{2,20}
  x: number;    // Local X coordinate
  y: number;    // Local Y coordinate
}

type FloorStackProgram = 'CORE' | 'CORRIDOR' | 'LIVING_UNIT' | 'PARKING';

interface FloorStackUnit {
  polygon: string[];           // Vertex IDs (counterclockwise winding)
  holes: string[][];           // Interior hole vertex IDs (nested array, each inner array is one hole)
  program?: FloorStackProgram;
  functionId?: string;
}

interface FloorStackPlan {
  id: string;
  vertices: FloorStackVertex[];
  units: FloorStackUnit[];
}

// Floor type variants for FloorStack API (SDK v0.90.0)
// FloorByPlan is for plan-based floors with unit subdivisions
type FloorByPlan = {
  height: number;
  planId: string;
};

// ============================================================================
// MESH GENERATION
// ============================================================================

/**
 * Generate a box mesh (6 faces) for a rectangular element
 * Coordinates are kept in local space (transform applied when adding to proposal)
 * Uses consistent CCW winding for outward-facing normals
 */
function generateBoxMeshLocal(
  x: number, y: number, z: number,
  width: number, depth: number, height: number
): MeshData {
  const verts: number[] = [];
  const faces: number[] = [];

  // 8 corners of the box (local coords relative to building center)
  // Using right-hand coordinate system: +X right, +Y forward, +Z up
  const corners = [
    [x, y, z],                          // 0: bottom-front-left
    [x + width, y, z],                  // 1: bottom-front-right
    [x + width, y + depth, z],          // 2: bottom-back-right
    [x, y + depth, z],                  // 3: bottom-back-left
    [x, y, z + height],                 // 4: top-front-left
    [x + width, y, z + height],         // 5: top-front-right
    [x + width, y + depth, z + height], // 6: top-back-right
    [x, y + depth, z + height],         // 7: top-back-left
  ];

  // Add all corners as vertices
  for (const [cx, cy, cz] of corners) {
    verts.push(cx, cy, cz);
  }

  // 12 triangles (2 per face) with correct winding for outward normals
  // Using cross product rule: (v1-v0) × (v2-v0) gives normal direction
  // Bottom face (normal -Z): need clockwise when viewed from above
  faces.push(0, 2, 1);
  faces.push(0, 3, 2);
  // Top face (normal +Z): need counterclockwise when viewed from above
  faces.push(4, 5, 6);
  faces.push(4, 6, 7);
  // Front face (normal -Y):
  faces.push(0, 1, 5);
  faces.push(0, 5, 4);
  // Back face (normal +Y):
  faces.push(2, 7, 6);
  faces.push(2, 3, 7);
  // Left face (normal -X):
  faces.push(0, 4, 7);
  faces.push(0, 7, 3);
  // Right face (normal +X):
  faces.push(1, 2, 6);
  faces.push(1, 6, 5);

  return { verts, faces };
}

/**
 * Generate a box mesh (6 faces) for a rectangular element - DEPRECATED
 * Uses world transform (kept for backwards compatibility)
 */
function generateBoxMesh(
  x: number, y: number, z: number,
  width: number, depth: number, height: number,
  transform: FloorPlanData['transform']
): MeshData {
  const verts: number[] = [];
  const faces: number[] = [];

  // Apply rotation transform to convert local coords to world coords
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);

  const transformPoint = (lx: number, ly: number, lz: number): [number, number, number] => {
    // Rotate around center then translate to world position
    const rx = lx * cos - ly * sin + transform.centerX;
    const ry = lx * sin + ly * cos + transform.centerY;
    return [rx, ry, lz];
  };

  // 8 corners of the box (local coords relative to building center)
  const localCorners = [
    [x, y, z],                          // 0: bottom-front-left
    [x + width, y, z],                  // 1: bottom-front-right
    [x + width, y + depth, z],          // 2: bottom-back-right
    [x, y + depth, z],                  // 3: bottom-back-left
    [x, y, z + height],                 // 4: top-front-left
    [x + width, y, z + height],         // 5: top-front-right
    [x + width, y + depth, z + height], // 6: top-back-right
    [x, y + depth, z + height],         // 7: top-back-left
  ];

  // Transform all corners to world space
  for (const [lx, ly, lz] of localCorners) {
    const [wx, wy, wz] = transformPoint(lx, ly, lz);
    verts.push(wx, wy, wz);
  }

  const baseIndex = 0;

  // 12 triangles (2 per face)
  // Bottom face (0,1,2,3)
  faces.push(baseIndex + 0, baseIndex + 2, baseIndex + 1);
  faces.push(baseIndex + 0, baseIndex + 3, baseIndex + 2);
  // Top face (4,5,6,7)
  faces.push(baseIndex + 4, baseIndex + 5, baseIndex + 6);
  faces.push(baseIndex + 4, baseIndex + 6, baseIndex + 7);
  // Front face (0,1,5,4)
  faces.push(baseIndex + 0, baseIndex + 1, baseIndex + 5);
  faces.push(baseIndex + 0, baseIndex + 5, baseIndex + 4);
  // Back face (2,3,7,6)
  faces.push(baseIndex + 2, baseIndex + 6, baseIndex + 7);
  faces.push(baseIndex + 2, baseIndex + 7, baseIndex + 3);
  // Left face (0,3,7,4)
  faces.push(baseIndex + 0, baseIndex + 4, baseIndex + 7);
  faces.push(baseIndex + 0, baseIndex + 7, baseIndex + 3);
  // Right face (1,2,6,5)
  faces.push(baseIndex + 1, baseIndex + 2, baseIndex + 6);
  faces.push(baseIndex + 1, baseIndex + 6, baseIndex + 5);

  return { verts, faces };
}

/**
 * Merge multiple meshes into one
 */
function mergeMeshes(meshes: MeshData[]): MeshData {
  const verts: number[] = [];
  const faces: number[] = [];
  let vertexOffset = 0;

  for (const mesh of meshes) {
    // Add vertices
    verts.push(...mesh.verts);

    // Add faces with adjusted indices
    for (const faceIndex of mesh.faces) {
      faces.push(faceIndex + vertexOffset);
    }

    // Update offset for next mesh
    vertexOffset += mesh.verts.length / 3;
  }

  return { verts, faces };
}

/**
 * Ensure polygon points are in counterclockwise order
 * Uses the shoelace formula to check orientation
 */
function ensureCounterClockwise(points: { x: number; y: number }[]): { x: number; y: number }[] {
  // Calculate signed area using shoelace formula
  let signedArea = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    signedArea += points[i].x * points[j].y;
    signedArea -= points[j].x * points[i].y;
  }
  signedArea /= 2;

  // If clockwise (negative area), reverse the points
  if (signedArea < 0) {
    return [...points].reverse();
  }
  return points;
}

/**
 * Cross product of 2D vectors (returns z component)
 */
function cross2D(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * Check if point P is inside triangle ABC using barycentric coordinates
 */
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

  // Point is in triangle if u >= 0, v >= 0, and u + v <= 1
  // Use small epsilon to avoid edge cases
  const eps = 1e-10;
  return (u >= -eps) && (v >= -eps) && (u + v <= 1 + eps);
}

/**
 * Check if the triangle formed by vertices at indices (prev, i, next) is an ear
 * An ear is a triangle that:
 * 1. Has a convex vertex at i
 * 2. Contains no other polygon vertices inside it
 */
function isEar(points: { x: number; y: number }[], i: number, activeIndices: number[]): boolean {
  const n = activeIndices.length;
  if (n < 3) return false;

  const posInActive = activeIndices.indexOf(i);
  if (posInActive === -1) return false;

  const prevIdx = activeIndices[(posInActive - 1 + n) % n];
  const nextIdx = activeIndices[(posInActive + 1) % n];

  const prev = points[prevIdx];
  const curr = points[i];
  const next = points[nextIdx];

  // Check if vertex is convex
  const ax = curr.x - prev.x;
  const ay = curr.y - prev.y;
  const bx = next.x - curr.x;
  const by = next.y - curr.y;

  if (cross2D(ax, ay, bx, by) <= 0) {
    return false; // Reflex vertex, not an ear
  }

  // Check that no other vertex is inside this triangle
  for (const idx of activeIndices) {
    if (idx === prevIdx || idx === i || idx === nextIdx) continue;

    const p = points[idx];
    if (pointInTriangle(p.x, p.y, prev.x, prev.y, curr.x, curr.y, next.x, next.y)) {
      return false; // Another vertex is inside, not an ear
    }
  }

  return true;
}

/**
 * Ear clipping triangulation for simple polygons (convex or concave)
 * Returns array of triangle indices [i0, i1, i2, i3, i4, i5, ...]
 * Each group of 3 indices forms a triangle
 */
function triangulatePolygon(points: { x: number; y: number }[]): number[] {
  const n = points.length;
  if (n < 3) return [];
  if (n === 3) return [0, 1, 2];

  const triangles: number[] = [];
  const activeIndices = Array.from({ length: n }, (_, i) => i);

  let safety = n * n; // Prevent infinite loops
  while (activeIndices.length > 3 && safety > 0) {
    safety--;
    let earFound = false;

    for (let i = 0; i < activeIndices.length; i++) {
      const idx = activeIndices[i];
      if (isEar(points, idx, activeIndices)) {
        // Found an ear, add the triangle
        const prevIdx = activeIndices[(i - 1 + activeIndices.length) % activeIndices.length];
        const nextIdx = activeIndices[(i + 1) % activeIndices.length];

        triangles.push(prevIdx, idx, nextIdx);

        // Remove the ear tip vertex
        activeIndices.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) {
      console.warn('Ear clipping: No ear found, polygon may be invalid');
      break;
    }
  }

  // Add the last triangle
  if (activeIndices.length === 3) {
    triangles.push(activeIndices[0], activeIndices[1], activeIndices[2]);
  }

  return triangles;
}

/**
 * Generate an extruded polygon mesh (for L-shaped units)
 * polyPoints should be in local building coordinates (already offset from center)
 * Produces a watertight mesh with correct winding order for outward-facing normals
 */
function generateExtrudedPolygonMesh(
  polyPoints: { x: number; y: number }[],
  z: number,
  height: number
): MeshData {
  const verts: number[] = [];
  const faces: number[] = [];

  // Ensure counterclockwise winding for consistent normals
  const ccwPoints = ensureCounterClockwise(polyPoints);
  const n = ccwPoints.length;

  if (n < 3) {
    // Not enough points for a polygon, return empty mesh
    return { verts: [], faces: [] };
  }

  // Add bottom vertices (index 0 to n-1)
  for (const pt of ccwPoints) {
    verts.push(pt.x, pt.y, z);
  }

  // Add top vertices (index n to 2n-1)
  for (const pt of ccwPoints) {
    verts.push(pt.x, pt.y, z + height);
  }

  // Triangulate the polygon using ear clipping (works for concave polygons like L-shapes)
  const triangleIndices = triangulatePolygon(ccwPoints);

  // Bottom face - use ear clipping triangulation
  // For outward normal pointing DOWN (-Z), use reverse winding (clockwise from above)
  for (let i = 0; i < triangleIndices.length; i += 3) {
    const a = triangleIndices[i];
    const b = triangleIndices[i + 1];
    const c = triangleIndices[i + 2];
    // Reverse winding for bottom face (normal pointing down)
    faces.push(a, c, b);
  }

  // Top face - use same triangulation but with top vertex offset
  // For outward normal pointing UP (+Z), use CCW winding when viewed from above
  for (let i = 0; i < triangleIndices.length; i += 3) {
    const a = triangleIndices[i] + n;
    const b = triangleIndices[i + 1] + n;
    const c = triangleIndices[i + 2] + n;
    // CCW winding for top face (normal pointing up)
    faces.push(a, b, c);
  }

  // Side faces - quads split into two triangles each
  // For CCW polygon, going around the edge creates outward normals
  for (let i = 0; i < n; i++) {
    const nextI = (i + 1) % n;
    const bottomCurrent = i;
    const bottomNext = nextI;
    const topCurrent = n + i;
    const topNext = n + nextI;

    // Two triangles for the quad
    faces.push(bottomCurrent, bottomNext, topNext);
    faces.push(bottomCurrent, topNext, topCurrent);
  }

  return { verts, faces };
}

/**
 * Generate complete building mesh from floorplan data in LOCAL coordinates
 * Transform will be applied when adding to proposal
 */
function generateBuildingMeshLocal(floorplan: FloorPlanData, numFloors: number): MeshData {
  const meshes: MeshData[] = [];
  const halfLength = floorplan.buildingLength / 2;
  const halfDepth = floorplan.buildingDepth / 2;

  console.log('[DEBUG MESH] Building dimensions:', {
    buildingLength: floorplan.buildingLength,
    buildingDepth: floorplan.buildingDepth,
    halfLength,
    halfDepth,
    numFloors,
    floorHeight: FLOOR_HEIGHT,
    totalHeight: numFloors * FLOOR_HEIGHT
  });

  for (let floor = 0; floor < numFloors; floor++) {
    const floorZ = floor * FLOOR_HEIGHT;  // Start at 0, elevation handled by transform

    // Generate unit meshes
    for (const unit of floorplan.units) {
      if (unit.isLShaped && unit.polyPoints && unit.polyPoints.length >= 3) {
        // L-shaped unit: extrude the polygon
        // polyPoints are in building local coords, need to offset from center
        const offsetPoints = unit.polyPoints.map(pt => ({
          x: pt.x - halfLength,
          y: pt.y - halfDepth
        }));
        const mesh = generateExtrudedPolygonMesh(offsetPoints, floorZ, FLOOR_HEIGHT);
        meshes.push(mesh);
      } else {
        // Regular rectangular unit
        const mesh = generateBoxMeshLocal(
          unit.x - halfLength,
          unit.y - halfDepth,
          floorZ,
          unit.width,
          unit.depth,
          FLOOR_HEIGHT
        );
        meshes.push(mesh);
      }
    }

    // Generate core meshes
    for (const core of floorplan.cores) {
      const mesh = generateBoxMeshLocal(
        core.x - halfLength,
        core.y - halfDepth,
        floorZ,
        core.width,
        core.depth,
        FLOOR_HEIGHT
      );
      meshes.push(mesh);
    }

    // Generate corridor mesh
    const corridor = floorplan.corridor;
    const corridorMesh = generateBoxMeshLocal(
      corridor.x - halfLength,
      corridor.y - halfDepth,
      floorZ,
      corridor.width,
      corridor.depth,
      FLOOR_HEIGHT
    );
    meshes.push(corridorMesh);

    // Generate filler meshes (rendered same as cores)
    for (const filler of floorplan.fillers || []) {
      const fillerMesh = generateBoxMeshLocal(
        filler.x - halfLength,
        filler.y - halfDepth,
        floorZ,
        filler.width,
        filler.depth,
        FLOOR_HEIGHT
      );
      meshes.push(fillerMesh);
    }
  }

  const merged = mergeMeshes(meshes);

  // Calculate and log Z-up bounds (before GLB conversion)
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < merged.verts.length; i += 3) {
    minX = Math.min(minX, merged.verts[i]);
    maxX = Math.max(maxX, merged.verts[i]);
    minY = Math.min(minY, merged.verts[i + 1]);
    maxY = Math.max(maxY, merged.verts[i + 1]);
    minZ = Math.min(minZ, merged.verts[i + 2]);
    maxZ = Math.max(maxZ, merged.verts[i + 2]);
  }
  console.log('[DEBUG MESH] Local mesh bounds (Z-up, before GLB):', {
    x: { min: minX, max: maxX, range: maxX - minX },
    y: { min: minY, max: maxY, range: maxY - minY },
    z: { min: minZ, max: maxZ, range: maxZ - minZ },
    note: 'Z is height in local coords'
  });

  return merged;
}

/**
 * Generate complete building mesh from floorplan data
 * NOTE: Reserved for future use - uses world transform
 */
function _generateBuildingMesh(floorplan: FloorPlanData, numFloors: number): MeshData {
  const meshes: MeshData[] = [];

  for (let floor = 0; floor < numFloors; floor++) {
    const floorZ = floorplan.floorElevation + floor * FLOOR_HEIGHT;

    // Generate unit meshes
    for (const unit of floorplan.units) {
      if (unit.isLShaped && unit.polyPoints) {
        // For L-shaped units, generate two boxes
        // This is a simplification - could be made more accurate
        const mesh = generateBoxMesh(
          unit.x - floorplan.buildingLength / 2,
          unit.y - floorplan.buildingDepth / 2,
          floorZ,
          unit.width,
          unit.depth,
          FLOOR_HEIGHT,
          floorplan.transform
        );
        meshes.push(mesh);
      } else {
        const mesh = generateBoxMesh(
          unit.x - floorplan.buildingLength / 2,
          unit.y - floorplan.buildingDepth / 2,
          floorZ,
          unit.width,
          unit.depth,
          FLOOR_HEIGHT,
          floorplan.transform
        );
        meshes.push(mesh);
      }
    }

    // Generate core meshes
    for (const core of floorplan.cores) {
      const mesh = generateBoxMesh(
        core.x - floorplan.buildingLength / 2,
        core.y - floorplan.buildingDepth / 2,
        floorZ,
        core.width,
        core.depth,
        FLOOR_HEIGHT,
        floorplan.transform
      );
      meshes.push(mesh);
    }

    // Generate corridor mesh
    const corridor = floorplan.corridor;
    const corridorMesh = generateBoxMesh(
      corridor.x - floorplan.buildingLength / 2,
      corridor.y - floorplan.buildingDepth / 2,
      floorZ,
      corridor.width,
      corridor.depth,
      FLOOR_HEIGHT,
      floorplan.transform
    );
    meshes.push(corridorMesh);
  }

  return mergeMeshes(meshes);
}

// ============================================================================
// GLB (Binary glTF) GENERATION
// ============================================================================

/**
 * Generate a GLB file from mesh data
 * GLB format: 12-byte header + JSON chunk + binary chunk
 *
 * The mesh is generated in Z-up coordinate system (Forma's system).
 * We convert vertices to Y-up for glTF compliance:
 *   glTF X = Forma X (width)
 *   glTF Y = Forma Z (height - up direction)
 *   glTF Z = Forma Y (depth)
 *
 * The element transform will be applied in this Y-up space, so it needs to:
 *   - Rotate around Y (not Z) for building orientation
 *   - Translate X and Z (not X and Y) for horizontal positioning
 */
function generateGLB(mesh: MeshData): ArrayBuffer {
  // Convert vertices from Z-up (Forma local) to Y-up (glTF)
  // Per Forma team: (x, y, z) → (x, -z, y)
  // This means: glTF_X = Forma_X, glTF_Y = -Forma_Z, glTF_Z = Forma_Y
  const vertexCount = mesh.verts.length / 3;
  const vertices = new Float32Array(mesh.verts.length);

  console.log('[DEBUG GLB] Converting vertices using Forma formula: (x, y, z) → (x, -z, y)');

  for (let i = 0; i < vertexCount; i++) {
    const srcX = mesh.verts[i * 3];      // Local X (width)
    const srcY = mesh.verts[i * 3 + 1];  // Local Y (depth)
    const srcZ = mesh.verts[i * 3 + 2];  // Local Z (height)

    // Convert to glTF Y-up using Forma's formula: (x, y, z) → (x, -z, y)
    vertices[i * 3] = srcX;       // glTF X = Local X (width)
    vertices[i * 3 + 1] = -srcZ;  // glTF Y = -Local Z (negated height)
    vertices[i * 3 + 2] = srcY;   // glTF Z = Local Y (depth)
  }

  const indices = new Uint32Array(mesh.faces);

  // Calculate bounding box in converted Y-up space
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i]);
    maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    maxY = Math.max(maxY, vertices[i + 1]);
    minZ = Math.min(minZ, vertices[i + 2]);
    maxZ = Math.max(maxZ, vertices[i + 2]);
  }

  console.log('[DEBUG GLB] Mesh bounds AFTER Y-up conversion:', {
    x: { min: minX, max: maxX, range: maxX - minX },
    y: { min: minY, max: maxY, range: maxY - minY },
    z: { min: minZ, max: maxZ, range: maxZ - minZ },
    note: 'Y is now height (up) in glTF coords'
  });

  // Binary buffer: vertices followed by indices
  const vertexByteLength = vertices.byteLength;
  const indexByteLength = indices.byteLength;
  const binBufferLength = vertexByteLength + indexByteLength;

  // Create the glTF JSON structure - no node rotation needed, vertices are already converted
  const gltfJson = {
    asset: { version: "2.0", generator: "Floorplate-Bake" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{
      mesh: 0
      // No rotation - vertices are already in Y-up space
    }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 1,
        mode: 4 // TRIANGLES
      }]
    }],
    accessors: [
      {
        // Vertex positions
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: vertices.length / 3,
        type: "VEC3",
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ]
      },
      {
        // Indices
        bufferView: 1,
        componentType: 5125, // UNSIGNED_INT
        count: indices.length,
        type: "SCALAR"
      }
    ],
    bufferViews: [
      {
        // Vertices
        buffer: 0,
        byteOffset: 0,
        byteLength: vertexByteLength,
        target: 34962 // ARRAY_BUFFER
      },
      {
        // Indices
        buffer: 0,
        byteOffset: vertexByteLength,
        byteLength: indexByteLength,
        target: 34963 // ELEMENT_ARRAY_BUFFER
      }
    ],
    buffers: [{
      byteLength: binBufferLength
    }]
  };

  // Encode JSON to bytes
  const jsonString = JSON.stringify(gltfJson);
  const jsonEncoder = new TextEncoder();
  const jsonBytes = jsonEncoder.encode(jsonString);

  // Pad JSON to 4-byte alignment
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunkLength = jsonBytes.length + jsonPadding;

  // Pad binary to 4-byte alignment
  const binPadding = (4 - (binBufferLength % 4)) % 4;
  const binChunkLength = binBufferLength + binPadding;

  // Calculate total GLB size
  // Header (12) + JSON chunk header (8) + JSON data + BIN chunk header (8) + BIN data
  const totalLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;

  // Create the GLB buffer
  const glb = new ArrayBuffer(totalLength);
  const view = new DataView(glb);
  let offset = 0;

  // GLB Header
  view.setUint32(offset, 0x46546C67, true); // magic "glTF"
  offset += 4;
  view.setUint32(offset, 2, true); // version
  offset += 4;
  view.setUint32(offset, totalLength, true); // length
  offset += 4;

  // JSON Chunk Header
  view.setUint32(offset, jsonChunkLength, true); // chunk length
  offset += 4;
  view.setUint32(offset, 0x4E4F534A, true); // chunk type "JSON"
  offset += 4;

  // JSON Chunk Data
  const uint8View = new Uint8Array(glb);
  uint8View.set(jsonBytes, offset);
  offset += jsonBytes.length;

  // JSON padding (spaces)
  for (let i = 0; i < jsonPadding; i++) {
    uint8View[offset++] = 0x20; // space
  }

  // BIN Chunk Header
  view.setUint32(offset, binChunkLength, true); // chunk length
  offset += 4;
  view.setUint32(offset, 0x004E4942, true); // chunk type "BIN\0"
  offset += 4;

  // BIN Chunk Data - vertices
  uint8View.set(new Uint8Array(vertices.buffer), offset);
  offset += vertexByteLength;

  // BIN Chunk Data - indices
  uint8View.set(new Uint8Array(indices.buffer), offset);
  offset += indexByteLength;

  // BIN padding (zeros)
  for (let i = 0; i < binPadding; i++) {
    uint8View[offset++] = 0x00;
  }

  return glb;
}

// ============================================================================
// GRAPH BUILDING GENERATION
// ============================================================================

/**
 * Generate a rectangular space with its surfaces
 */
function generateRectangularSpace(
  id: string,
  x: number, y: number,
  width: number, depth: number,
  _points: Record<string, [number, number]>,
  _surfaces: GraphBuildingSurface[],
  existingPointCount: number,
  existingSurfaceCount: number
): { space: GraphBuildingSpace; newPoints: Record<string, [number, number]>; newSurfaces: GraphBuildingSurface[] } {

  // Create 4 corner points
  const pointIds = [
    `p${existingPointCount}`,
    `p${existingPointCount + 1}`,
    `p${existingPointCount + 2}`,
    `p${existingPointCount + 3}`
  ];

  const newPoints: Record<string, [number, number]> = {
    [pointIds[0]]: [x, y],
    [pointIds[1]]: [x + width, y],
    [pointIds[2]]: [x + width, y + depth],
    [pointIds[3]]: [x, y + depth]
  };

  // Create 4 surfaces (walls)
  const surfaceIds = [
    `s${existingSurfaceCount}`,
    `s${existingSurfaceCount + 1}`,
    `s${existingSurfaceCount + 2}`,
    `s${existingSurfaceCount + 3}`
  ];

  const newSurfaces: GraphBuildingSurface[] = [
    { id: surfaceIds[0], pointA: pointIds[0], pointB: pointIds[1] },
    { id: surfaceIds[1], pointA: pointIds[1], pointB: pointIds[2] },
    { id: surfaceIds[2], pointA: pointIds[2], pointB: pointIds[3] },
    { id: surfaceIds[3], pointA: pointIds[3], pointB: pointIds[0] }
  ];

  // Create outer loop (counterclockwise)
  const outerLoop: GraphBuildingCoSurface[] = surfaceIds.map((surfaceId, i) => ({
    id: `cs${existingSurfaceCount + i}`,
    partnerId: null, // External boundary
    surfaceId,
    directionAToB: true
  }));

  const space: GraphBuildingSpace = {
    id,
    outerLoop
  };

  return { space, newPoints, newSurfaces };
}

/**
 * Generate GraphBuilding representation from floorplan
 */
function generateGraphBuilding(floorplan: FloorPlanData, numFloors: number): GraphBuilding {
  const units: GraphBuildingUnit[] = [];
  const levels: GraphBuildingLevel[] = [];

  // Generate levels
  for (let floor = 0; floor < numFloors; floor++) {
    let pointCount = 0;
    let surfaceCount = 0;
    const points: Record<string, [number, number]> = {};
    const spaces: GraphBuildingSpace[] = [];
    const surfaces: GraphBuildingSurface[] = [];

    // Process units
    for (const unit of floorplan.units) {
      const spaceId = `${unit.id}_floor${floor}`;
      const { space, newPoints, newSurfaces } = generateRectangularSpace(
        spaceId,
        unit.x - floorplan.buildingLength / 2,
        unit.y - floorplan.buildingDepth / 2,
        unit.width,
        unit.depth,
        points,
        surfaces,
        pointCount,
        surfaceCount
      );

      Object.assign(points, newPoints);
      surfaces.push(...newSurfaces);
      spaces.push(space);
      pointCount += 4;
      surfaceCount += 4;

      // Create unit entry (only on first floor to avoid duplicates)
      if (floor === 0) {
        // Map unit type to function
        const functionName = mapUnitTypeToFunction(unit);

        units.push({
          id: unit.id,
          properties: {
            function: functionName,
            program: unit.typeName
          },
          spaceIds: Array.from({ length: numFloors }, (_, f) => `${unit.id}_floor${f}`)
        });
      }
    }

    // Process cores
    for (const core of floorplan.cores) {
      const spaceId = `${core.id}_floor${floor}`;
      const { space, newPoints, newSurfaces } = generateRectangularSpace(
        spaceId,
        core.x - floorplan.buildingLength / 2,
        core.y - floorplan.buildingDepth / 2,
        core.width,
        core.depth,
        points,
        surfaces,
        pointCount,
        surfaceCount
      );

      Object.assign(points, newPoints);
      surfaces.push(...newSurfaces);
      spaces.push(space);
      pointCount += 4;
      surfaceCount += 4;
    }

    // Process corridor
    const corridorId = `corridor_floor${floor}`;
    const { space: corridorSpace, newPoints: corridorPoints, newSurfaces: corridorSurfaces } = generateRectangularSpace(
      corridorId,
      floorplan.corridor.x - floorplan.buildingLength / 2,
      floorplan.corridor.y - floorplan.buildingDepth / 2,
      floorplan.corridor.width,
      floorplan.corridor.depth,
      points,
      surfaces,
      pointCount,
      surfaceCount
    );

    Object.assign(points, corridorPoints);
    surfaces.push(...corridorSurfaces);
    spaces.push(corridorSpace);

    levels.push({
      height: FLOOR_HEIGHT,
      points,
      spaces,
      surfaces
    });
  }

  return { units, levels };
}

/**
 * Map unit type to Forma function category
 */
function mapUnitTypeToFunction(_unit: UnitBlock): string {
  // All residential units map to 'residential'
  // Could be extended to support other categories
  return 'residential';
}

// ============================================================================
// GROSS FLOOR AREA POLYGONS
// ============================================================================

/**
 * Generate GrossFloorAreaPolygons from floorplan
 * Used by createElementV2 to define area types (LIVING_UNIT, CORE, CORRIDOR)
 */
function generateGFAPolygons(floorplan: FloorPlanData, numFloors: number): GrossFloorAreaPolygon[] {
  const polygons: GrossFloorAreaPolygon[] = [];

  const halfLength = floorplan.buildingLength / 2;
  const halfDepth = floorplan.buildingDepth / 2;

  for (let floor = 0; floor < numFloors; floor++) {
    const elevation = floor * FLOOR_HEIGHT;

    // Units -> LIVING_UNIT
    for (const unit of floorplan.units) {
      let polygon: [number, number][];

      if (unit.isLShaped && unit.polyPoints && unit.polyPoints.length >= 3) {
        // L-shaped unit: use the polyPoints
        polygon = unit.polyPoints.map(pt => [
          pt.x - halfLength,
          pt.y - halfDepth
        ] as [number, number]);
        // Close the ring if not already closed
        const first = polygon[0];
        const last = polygon[polygon.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          polygon.push([first[0], first[1]]);
        }
      } else {
        // Regular rectangular unit
        const x = unit.x - halfLength;
        const y = unit.y - halfDepth;
        polygon = [
          [x, y],
          [x + unit.width, y],
          [x + unit.width, y + unit.depth],
          [x, y + unit.depth],
          [x, y]  // Close the ring
        ];
      }

      polygons.push({
        grossFloorPolygon: [polygon],
        elevation,
        areaType: 'LIVING_UNIT'
      });
    }

    // Cores -> CORE
    for (const core of floorplan.cores) {
      const x = core.x - halfLength;
      const y = core.y - halfDepth;

      const polygon: [number, number][] = [
        [x, y],
        [x + core.width, y],
        [x + core.width, y + core.depth],
        [x, y + core.depth],
        [x, y]
      ];

      polygons.push({
        grossFloorPolygon: [polygon],
        elevation,
        areaType: 'CORE'
      });
    }

    // Corridor -> CORRIDOR
    const cx = floorplan.corridor.x - halfLength;
    const cy = floorplan.corridor.y - halfDepth;

    const corridorPolygon: [number, number][] = [
      [cx, cy],
      [cx + floorplan.corridor.width, cy],
      [cx + floorplan.corridor.width, cy + floorplan.corridor.depth],
      [cx, cy + floorplan.corridor.depth],
      [cx, cy]
    ];

    polygons.push({
      grossFloorPolygon: [corridorPolygon],
      elevation,
      areaType: 'CORRIDOR'
    });

    // Fillers -> CORE (same as cores)
    for (const filler of floorplan.fillers || []) {
      const fx = filler.x - halfLength;
      const fy = filler.y - halfDepth;

      const fillerPolygon: [number, number][] = [
        [fx, fy],
        [fx + filler.width, fy],
        [fx + filler.width, fy + filler.depth],
        [fx, fy + filler.depth],
        [fx, fy]
      ];

      polygons.push({
        grossFloorPolygon: [fillerPolygon],
        elevation,
        areaType: 'CORE'
      });
    }
  }

  return polygons;
}

// ============================================================================
// FOOTPRINT GENERATION
// ============================================================================

/**
 * Generate footprint GeoJSON from floorplan
 * NOTE: Reserved for future use when IntegrateAPI supports adding representations
 */
function _generateFootprint(floorplan: FloorPlanData): GeoJSON.FeatureCollection {
  const halfLength = floorplan.buildingLength / 2;
  const halfDepth = floorplan.buildingDepth / 2;

  // Simple rectangular footprint for bar buildings
  // Coordinates need to be in world space
  const cos = Math.cos(floorplan.transform.rotation);
  const sin = Math.sin(floorplan.transform.rotation);
  const cx = floorplan.transform.centerX;
  const cy = floorplan.transform.centerY;

  const transformPoint = (lx: number, ly: number): [number, number] => {
    return [
      lx * cos - ly * sin + cx,
      lx * sin + ly * cos + cy
    ];
  };

  const corners = [
    transformPoint(-halfLength, -halfDepth),
    transformPoint(halfLength, -halfDepth),
    transformPoint(halfLength, halfDepth),
    transformPoint(-halfLength, halfDepth),
    transformPoint(-halfLength, -halfDepth)  // Close the ring
  ];

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [corners]
      }
    }]
  };
}

// ============================================================================
// FLOOR GENERATION FOR FLOORSTACK API
// ============================================================================

interface Floor {
  polygon: [number, number][];
  height: number;
}

/**
 * Generate floors from floorplan for FloorStack API
 * Creates a simple rectangular floor per level
 * NOTE: Reserved - we now use createElementV2 instead
 */
function _generateFloorsFromFloorplan(floorplan: FloorPlanData, numFloors: number): Floor[] {
  const floors: Floor[] = [];

  const halfLength = floorplan.buildingLength / 2;
  const halfDepth = floorplan.buildingDepth / 2;

  // Create counterclockwise polygon for building footprint
  // Note: FloorStack expects coordinates relative to the element's local origin
  const polygon: [number, number][] = [
    [-halfLength, -halfDepth],
    [halfLength, -halfDepth],
    [halfLength, halfDepth],
    [-halfLength, halfDepth],
    [-halfLength, -halfDepth]  // Close the polygon
  ];

  // Create one floor entry per level
  for (let i = 0; i < numFloors; i++) {
    floors.push({
      polygon: polygon,
      height: FLOOR_HEIGHT
    });
  }

  return floors;
}

// ============================================================================
// MAIN BAKE FUNCTION
// ============================================================================

export interface BakeOptions {
  /** Number of floors to bake (from UI state) */
  numFloors: number;
  /** Original building path to remove after baking */
  originalBuildingPath?: string;
  /** Building name */
  name?: string;
}

export interface BakeResult {
  success: boolean;
  urn?: string;
  error?: string;
}

/**
 * Bake a generated floorplate into a native Forma building
 * Uses createElementV2 with full representations (volumeMesh, graphBuilding, grossFloorAreaPolygons)
 */
export async function bakeBuilding(
  floorplan: FloorPlanData,
  options: BakeOptions
): Promise<BakeResult> {
  try {
    console.log('='.repeat(60));
    console.log('BAKE PROCESS STARTING');
    console.log('='.repeat(60));
    console.log('[DEBUG] Current approach:');
    console.log('  - Mesh generation: Z-up (Forma local coords)');
    console.log('  - GLB conversion: (x,y,z) → (x,-z,y) per Forma team');
    console.log('  - Transform: Z-up rotation (around Z axis)');
    console.log('  - Position compensation: subtract rotated half-dimensions');
    console.log('  - This approach gave correct elevation+rotation, fixing position offset');
    console.log('-'.repeat(60));
    console.log('[DEBUG] Floorplan input:', JSON.stringify({
      buildingLength: floorplan.buildingLength,
      buildingDepth: floorplan.buildingDepth,
      floorElevation: floorplan.floorElevation,
      transform: floorplan.transform,
      unitCount: floorplan.units.length,
      coreCount: floorplan.cores.length
    }, null, 2));
    console.log('[DEBUG] Options:', options);

    const { numFloors, originalBuildingPath } = options;

    // 1. Generate building mesh (in local coordinates)
    console.log('Generating building mesh...');
    const mesh = generateBuildingMeshLocal(floorplan, numFloors);
    console.log(`Mesh: ${mesh.verts.length / 3} vertices, ${mesh.faces.length / 3} triangles`);

    // 2. Convert mesh to GLB format
    console.log('Converting to GLB...');
    const glbData = generateGLB(mesh);
    console.log(`GLB size: ${glbData.byteLength} bytes`);

    // 3. Upload GLB to integrate storage
    console.log('Uploading GLB...');
    const uploadResult = await Forma.integrateElements.uploadFile({
      data: glbData
    });
    console.log('Upload complete, blobId:', uploadResult.blobId);

    // 4. Generate representations
    console.log('Generating representations...');
    const graphBuilding = generateGraphBuilding(floorplan, numFloors);
    console.log(`GraphBuilding: ${graphBuilding.units.length} units, ${graphBuilding.levels.length} levels`);

    const gfaPolygons = generateGFAPolygons(floorplan, numFloors);
    console.log(`GFA Polygons: ${gfaPolygons.length} polygons`);

    // 5. Create element with createElementV2 (volumeMesh only first)
    // The API doesn't accept all representations in one call, so we do it in two steps
    console.log('Creating element with createElementV2...');
    console.log('Using blobId:', uploadResult.blobId);

    let urn: string;
    try {
      // Step 1: Create element with just volumeMesh
      const result = await Forma.integrateElements.createElementV2({
        properties: {
          category: 'building',
          name: options.name || 'Generated Floorplate'
        },
        representations: {
          volumeMesh: {
            type: 'linked',
            blobId: uploadResult.blobId
          }
        }
      });
      urn = result.urn;
      console.log('Element created with URN:', urn);

      // NOTE: graphBuilding and grossFloorAreaPolygons representations are NOT supported
      // by batchIngestElementsV2 (returns 400 error). Per Forma product team:
      // - graphBuilding requires POST /public-api/v1alpha/basicbuilding/batch-create API
      // - This API is not exposed in the SDK and requires direct HTTP calls with authentication
      // - For now, the building works as a solid volume without unit subdivisions
      //
      // TODO: Implement basicbuilding/batch-create API call when documentation is available
      // See: BAKING_WORKFLOW.md for details on API limitations
      console.log('NOTE: graphBuilding and grossFloorAreaPolygons representations skipped');
      console.log('  - batchIngestElementsV2 does not support these representation types');
      console.log('  - Building will work as solid volume without unit subdivisions');
      console.log('  - Generated graphBuilding data preserved for future use:',
        `${graphBuilding.units.length} units, ${graphBuilding.levels.length} levels`);
      console.log('  - Generated GFA polygons preserved:', gfaPolygons.length, 'polygons');
    } catch (createError) {
      console.error('createElementV2 failed:', createError);
      // Try with createElementHierarchy as fallback
      console.log('Trying createElementHierarchy as fallback...');

      const result = await Forma.integrateElements.createElementHierarchy({
        data: {
          rootElement: 'root',
          elements: {
            root: {
              id: 'root',
              properties: {
                geometry: {
                  type: 'File',
                  format: 'glb',
                  s3Id: uploadResult.fileId
                },
                category: 'building',
                name: options.name || 'Generated Floorplate'
              }
            }
          }
        }
      });
      urn = result.urn as string;
      console.log('Element created via hierarchy with URN:', urn);
    }

    // 6. Add to proposal with correct transform
    // The mesh is in Y-up space (glTF standard) after our vertex conversion:
    //   glTF X = width, glTF Y = height (up), glTF Z = depth
    // The transform is applied in this Y-up space, so we need to:
    //   - Rotate around Y axis (up) for building orientation
    //   - Translate in X and Z (horizontal plane) for positioning
    console.log('[DEBUG TRANSFORM] Input values:');
    console.log('  - centerX (Forma world X):', floorplan.transform.centerX);
    console.log('  - centerY (Forma world Y):', floorplan.transform.centerY);
    console.log('  - floorElevation:', floorplan.floorElevation);
    console.log('  - rotation (radians):', floorplan.transform.rotation);
    console.log('  - rotation (degrees):', (floorplan.transform.rotation * 180 / Math.PI).toFixed(2));

    const cos = Math.cos(floorplan.transform.rotation);
    const sin = Math.sin(floorplan.transform.rotation);

    console.log('[DEBUG TRANSFORM] Rotation values:');
    console.log('  - cos:', cos.toFixed(6));
    console.log('  - sin:', sin.toFixed(6));

    // Z-up transform - empirically gives correct elevation and rotation
    // Issue: mesh corner ends up at center instead of mesh center
    // Fix: compensate by adding rotated half-dimensions to translation
    //
    // Rotation around Z axis (column-major, Z-up):
    // [cos, -sin, 0, 0]
    // [sin,  cos, 0, 0]
    // [0,    0,   1, 0]
    // [tx,  ty,  tz, 1]

    const totalHeight = numFloors * FLOOR_HEIGHT;
    const zTranslation = floorplan.floorElevation + totalHeight;

    // The mesh NW corner was ending up at center. We need to offset by the
    // rotated half-dimensions to put the CENTER at the target position.
    const halfLength = floorplan.buildingLength / 2;
    const halfDepth = floorplan.buildingDepth / 2;

    // Calculate offset: we want center at (centerX, centerY), but currently
    // a corner offset by (-halfLength, +halfDepth) in local coords ends up there.
    // After rotation, this offset becomes:
    const offsetX = (-halfLength) * cos - halfDepth * sin;
    const offsetY = (-halfLength) * sin + halfDepth * cos;

    // Subtract this offset from translation to compensate
    const adjustedCenterX = floorplan.transform.centerX - offsetX;
    const adjustedCenterY = floorplan.transform.centerY - offsetY;

    console.log('[DEBUG TRANSFORM] Position adjustment:');
    console.log(`  - halfLength: ${halfLength.toFixed(2)}m`);
    console.log(`  - halfDepth: ${halfDepth.toFixed(2)}m`);
    console.log(`  - Rotated offset: (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`);
    console.log(`  - Original center: (${floorplan.transform.centerX.toFixed(2)}, ${floorplan.transform.centerY.toFixed(2)})`);
    console.log(`  - Adjusted center: (${adjustedCenterX.toFixed(2)}, ${adjustedCenterY.toFixed(2)})`);
    console.log(`  - zTranslation: ${zTranslation.toFixed(2)}m`);

    const transform: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] = [
      cos, sin, 0, 0,     // Column 0: X basis (rotated around Z)
      -sin, cos, 0, 0,    // Column 1: Y basis (rotated around Z)
      0, 0, 1, 0,         // Column 2: Z basis (up direction - unchanged)
      adjustedCenterX, adjustedCenterY, zTranslation, 1  // Column 3: adjusted translation
    ];

    console.log('[DEBUG TRANSFORM] Final 4x4 matrix (column-major):');
    console.log('  Column 0 (X basis):', transform.slice(0, 4));
    console.log('  Column 1 (Y basis):', transform.slice(4, 8));
    console.log('  Column 2 (Z basis):', transform.slice(8, 12));
    console.log('  Column 3 (Translation):', transform.slice(12, 16));
    console.log('[DEBUG TRANSFORM] As row-major (easier to read):');
    console.log(`  | ${transform[0].toFixed(3)}  ${transform[4].toFixed(3)}  ${transform[8].toFixed(3)}  ${transform[12].toFixed(3)} |`);
    console.log(`  | ${transform[1].toFixed(3)}  ${transform[5].toFixed(3)}  ${transform[9].toFixed(3)}  ${transform[13].toFixed(3)} |`);
    console.log(`  | ${transform[2].toFixed(3)}  ${transform[6].toFixed(3)}  ${transform[10].toFixed(3)} ${transform[14].toFixed(3)} |`);
    console.log(`  | ${transform[3].toFixed(3)}  ${transform[7].toFixed(3)}  ${transform[11].toFixed(3)} ${transform[15].toFixed(3)} |`);

    // Calculate where the mesh SHOULD appear after transform
    console.log('[DEBUG TRANSFORM] Expected final position (Forma world):');
    console.log('  - Building center should be at:');
    console.log(`    X: ${floorplan.transform.centerX.toFixed(2)}`);
    console.log(`    Y: ${floorplan.transform.centerY.toFixed(2)}`);
    console.log(`    Z (floor): ${floorplan.floorElevation.toFixed(2)}m`);
    console.log(`    Z (roof): ${(floorplan.floorElevation + totalHeight).toFixed(2)}m`);

    await Forma.proposal.addElement({ urn, transform });
    console.log('[DEBUG] Element added to proposal successfully');

    // 7. Remove original building if specified
    if (originalBuildingPath) {
      console.log('Removing original building:', originalBuildingPath);
      try {
        await Forma.proposal.removeElement({ path: originalBuildingPath });
        console.log('Original building removed');
      } catch (removeError) {
        console.warn('Could not remove original building:', removeError);
        // Don't fail the whole operation
      }
    }

    console.log('='.repeat(60));
    console.log('BAKE COMPLETE');
    console.log('='.repeat(60));
    console.log('[DEBUG] Summary:');
    console.log(`  - URN: ${urn}`);
    console.log(`  - Floors: ${numFloors}`);
    console.log(`  - Total height: ${(numFloors * FLOOR_HEIGHT).toFixed(2)}m`);
    console.log('[DEBUG] If building appears FLAT:');
    console.log('  → Transform may be zeroing height, or Forma auto-converts Y-up GLB');
    console.log('[DEBUG] If building appears in WRONG POSITION:');
    console.log('  → Transform coordinate system mismatch (Y-up vs Z-up)');
    console.log('[DEBUG] If building appears ON ITS SIDE:');
    console.log('  → GLB coordinate conversion issue');
    console.log('='.repeat(60));
    return { success: true, urn };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Bake failed:', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if baking is supported (requires edit access)
 */
export async function canBake(): Promise<boolean> {
  try {
    const canEdit = await Forma.getCanEdit();
    return canEdit;
  } catch {
    return false;
  }
}

/**
 * Bake using the FloorStack API with plan-based floors (SDK v0.90.0)
 * Creates a native Forma building with unit subdivisions (CORE, CORRIDOR, LIVING_UNIT)
 *
 * This method:
 * - Converts FloorPlanData to a Plan with units
 * - Creates floors that reference the plan
 * - Properly tags programs (CORE, CORRIDOR, LIVING_UNIT)
 * - Handles L-shaped units via polyPoints
 */
export async function bakeWithFloorStack(
  floorplan: FloorPlanData,
  options: BakeOptions
): Promise<BakeResult> {
  // PROMINENT LOG - This MUST appear if function is called
  console.log('%c>>> BAKE WITH FLOORSTACK STARTED <<<', 'background: blue; color: white; font-size: 16px; padding: 4px;');
  console.log('Floorplan:', floorplan.buildingLength, 'x', floorplan.buildingDepth);

  try {
    const { numFloors, originalBuildingPath } = options;

    // Create building footprint polygon from floorplan dimensions
    // Coordinates in local space (centered at origin)
    const halfWidth = floorplan.buildingLength / 2;
    const halfDepth = floorplan.buildingDepth / 2;

    // Building footprint as counterclockwise polygon
    const polygon: [number, number][] = [
      [-halfWidth, -halfDepth],
      [halfWidth, -halfDepth],
      [halfWidth, halfDepth],
      [-halfWidth, halfDepth]
    ];

    console.log(`Baking ${numFloors}-floor building (${floorplan.buildingLength.toFixed(1)}m x ${floorplan.buildingDepth.toFixed(1)}m)...`);

    let urn: string;

    // First try: plan-based FloorStack with unit subdivisions
    // Declare plan outside try block so it's accessible in catch for debugging
    let plan: FloorStackPlan | null = null;
    try {
      plan = convertFloorPlanToFloorStackPlan(floorplan);

      // Debug: Log plan details
      console.log(`[FloorStack] Plan has ${plan.vertices.length} vertices and ${plan.units.length} units`);
      console.log(`[FloorStack] Fillers in floorplan: ${floorplan.fillers?.length || 0}`);
      const programCounts = plan.units.reduce((acc, u) => {
        acc[u.program || 'unknown'] = (acc[u.program || 'unknown'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[FloorStack] Unit programs:`, programCounts);

      // Debug: Validate footprint coverage
      const buildingArea = floorplan.buildingLength * floorplan.buildingDepth;
      const unitsArea = floorplan.units.reduce((sum, u) => sum + u.width * u.depth, 0);
      const coresArea = floorplan.cores.reduce((sum, c) => sum + c.width * c.depth, 0);
      const corridorArea = floorplan.corridor.width * floorplan.corridor.depth;
      const fillersArea = (floorplan.fillers || []).reduce((sum, f) => sum + f.width * f.depth, 0);
      const coveredArea = unitsArea + coresArea + corridorArea + fillersArea;
      const gap = buildingArea - coveredArea;
      console.log(`[FloorStack] Building area: ${buildingArea.toFixed(2)} sq m`);
      console.log(`[FloorStack] Coverage: units=${unitsArea.toFixed(2)}, cores=${coresArea.toFixed(2)}, corridor=${corridorArea.toFixed(2)}, fillers=${fillersArea.toFixed(2)}`);
      console.log(`[FloorStack] Total covered: ${coveredArea.toFixed(2)} sq m (gap: ${gap.toFixed(2)} sq m)`);
      if (Math.abs(gap) > 0.01) {
        console.warn(`[FloorStack] WARNING: Footprint coverage gap of ${gap.toFixed(2)} sq m detected!`);
      }

      // TypeScript null check (plan was just assigned above)
      if (!plan) throw new Error('Plan conversion failed unexpectedly');
      const validPlan = plan; // Capture for closures

      // Debug: Dump plan data for inspection
      console.log('[FloorStack] === PLAN DATA ===');
      console.log('[FloorStack] Vertices:', JSON.stringify(validPlan.vertices.slice(0, 10), null, 2));
      if (validPlan.vertices.length > 10) {
        console.log(`[FloorStack] ... and ${validPlan.vertices.length - 10} more vertices`);
      }
      console.log('[FloorStack] Units (first 5):', JSON.stringify(validPlan.units.slice(0, 5), null, 2));
      if (validPlan.units.length > 5) {
        console.log(`[FloorStack] ... and ${validPlan.units.length - 5} more units`);
      }

      // Pre-validation: Check for common issues
      console.log('[FloorStack] === PRE-VALIDATION ===');

      // Check for units with invalid polygon references
      const vertexIds = new Set(validPlan.vertices.map(v => v.id));
      let invalidRefs = 0;
      for (const unit of validPlan.units) {
        for (const vid of unit.polygon) {
          if (!vertexIds.has(vid)) {
            console.error(`[FloorStack] Unit has invalid vertex reference: ${vid}`);
            invalidRefs++;
          }
        }
      }
      if (invalidRefs > 0) {
        console.error(`[FloorStack] Found ${invalidRefs} invalid vertex references!`);
      } else {
        console.log('[FloorStack] All vertex references valid ✓');
      }

      // Check for units with < 3 vertices (invalid polygons)
      const smallPolygons = validPlan.units.filter(u => u.polygon.length < 3);
      if (smallPolygons.length > 0) {
        console.error(`[FloorStack] Found ${smallPolygons.length} units with < 3 vertices!`);
      } else {
        console.log('[FloorStack] All polygons have >= 3 vertices ✓');
      }

      // Check for duplicate vertex IDs in same polygon
      let duplicateVerts = 0;
      for (const unit of validPlan.units) {
        const uniqueVerts = new Set(unit.polygon);
        if (uniqueVerts.size !== unit.polygon.length) {
          console.error(`[FloorStack] Unit has duplicate vertices in polygon`);
          duplicateVerts++;
        }
      }
      if (duplicateVerts > 0) {
        console.error(`[FloorStack] Found ${duplicateVerts} units with duplicate vertices!`);
      } else {
        console.log('[FloorStack] No duplicate vertices in polygons ✓');
      }

      console.log('[FloorStack] === END PRE-VALIDATION ===');

      const planFloors: FloorByPlan[] = Array.from({ length: numFloors }, () => ({
        planId: validPlan.id,
        height: FLOOR_HEIGHT
      }));

      console.log('[FloorStack] Calling createFromFloors...');
      const result = await Forma.elements.floorStack.createFromFloors({
        floors: planFloors,
        plans: [validPlan]
      });
      urn = result.urn;
      console.log('%c>>> FLOORSTACK SUCCESS! <<<', 'background: green; color: white; font-size: 16px; padding: 4px;');
      console.log(`Building created WITH ${validPlan.units.length} units (URN: ${urn})`);

    } catch (planError) {
      // Plan-based failed, fall back to polygon mode
      // VERY PROMINENT ERROR - Must be visible
      console.log('%c!!! FLOORSTACK PLAN FAILED !!!', 'background: red; color: white; font-size: 20px; padding: 8px; font-weight: bold;');
      console.log('%cFalling back to polygon mode (NO UNITS)', 'background: orange; color: black; font-size: 14px; padding: 4px;');
      console.error('='.repeat(60));
      console.error('[FloorStack] PLAN-BASED CREATION FAILED');
      console.error('='.repeat(60));
      console.error('[FloorStack] Error object:', planError);
      console.error('[FloorStack] Error type:', typeof planError);
      console.error('[FloorStack] Error message:', planError instanceof Error ? planError.message : String(planError));
      if (planError instanceof Error && planError.stack) {
        console.error('[FloorStack] Stack:', planError.stack);
      }
      // Try to extract more details from error object
      if (planError && typeof planError === 'object') {
        const errObj = planError as Record<string, unknown>;
        if (errObj.response) console.error('[FloorStack] Response:', errObj.response);
        if (errObj.data) console.error('[FloorStack] Data:', errObj.data);
        if (errObj.status) console.error('[FloorStack] Status:', errObj.status);
        if (errObj.code) console.error('[FloorStack] Code:', errObj.code);
      }
      if (plan) {
        console.error('[FloorStack] Plan had', plan.vertices.length, 'vertices,', plan.units.length, 'units');
        // Dump full plan for debugging
        console.error('[FloorStack] FULL PLAN DATA:');
        console.error(JSON.stringify(plan, null, 2));

        const invalidVertexCount = plan.vertices.filter(v => !Number.isFinite(v.x) || !Number.isFinite(v.y)).length;
        if (invalidVertexCount > 0) {
          console.error(`[FloorStack] ${invalidVertexCount} invalid vertices found in plan`);
        }
      }
      console.error('[FloorStack] Falling back to polygon mode (no unit subdivisions)');
      console.error('='.repeat(60));

      const polygonFloors = Array.from({ length: numFloors }, () => ({
        polygon,
        height: FLOOR_HEIGHT
      }));

      const result = await Forma.elements.floorStack.createFromFloors({
        floors: polygonFloors
      });
      urn = result.urn;
      console.log('%c>>> POLYGON FALLBACK USED <<<', 'background: orange; color: black; font-size: 16px; padding: 4px;');
      console.log(`Building created WITHOUT units (URN: ${urn})`);
    }

    // 4. Add to proposal with transform
    // Vertices are already centered at origin by convertFloorPlanToFloorStackPlan().
    // The building center is at (0, 0) in local space, so we translate directly
    // to world center without any offset adjustment. This matches the behavior
    // of bakeWithFloorStackBatch() and bakeWithBasicBuildingAPI().
    const cos = Math.cos(floorplan.transform.rotation);
    const sin = Math.sin(floorplan.transform.rotation);

    const transform: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] = [
      cos, sin, 0, 0,
      -sin, cos, 0, 0,
      0, 0, 1, 0,
      floorplan.transform.centerX, floorplan.transform.centerY, floorplan.floorElevation, 1
    ];

    await Forma.proposal.addElement({ urn, transform });

    // Remove original building if specified
    if (originalBuildingPath) {
      try {
        await Forma.proposal.removeElement({ path: originalBuildingPath });
      } catch (removeError) {
        console.warn('Could not remove original building:', removeError);
      }
    }

    console.log('Bake complete');
    return { success: true, urn };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('FloorStack bake failed:', errorMessage);

    // Fallback to BasicBuilding API
    try {
      console.log('Falling back to BasicBuilding API...');
      return await bakeWithBasicBuildingAPI(floorplan, options);
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error('BasicBuilding fallback also failed:', fallbackMessage);
      return { success: false, error: `FloorStack failed: ${errorMessage}. Fallback also failed: ${fallbackMessage}` };
    }
  }
}

/**
 * Batch bake multiple floorplans using FloorStack API
 * Creates multiple buildings in a single API call for better performance
 */
export async function bakeWithFloorStackBatch(
  buildings: Array<{
    floorplan: FloorPlanData;
    options: BakeOptions;
  }>
): Promise<Array<BakeResult>> {
  try {
    console.log('='.repeat(60));
    console.log('BAKE WITH FLOORSTACK BATCH STARTING');
    console.log('='.repeat(60));
    console.log(`Creating ${buildings.length} buildings...`);

    // Convert all floorplans to FloorStack format
    const batchRequest = buildings.map(({ floorplan, options }, index) => {
      const plan = convertFloorPlanToFloorStackPlan(floorplan);
      // Make plan IDs unique across batch
      plan.id = `plan_${index}`;

      const floors: FloorByPlan[] = Array.from({ length: options.numFloors }, () => ({
        planId: plan.id,
        height: FLOOR_HEIGHT
      }));

      return { floors, plans: [plan] };
    });

    // Call batch API (SDK v0.90.0)
    const { urns } = await Forma.elements.floorStack.createFromFloorsBatch(batchRequest);
    console.log(`Batch creation complete: ${urns.length} buildings created`);

    // Add each building to proposal with transform
    const bakeResults: BakeResult[] = [];

    for (let i = 0; i < urns.length; i++) {
      const urn = urns[i];
      const { floorplan, options } = buildings[i];

      const cos = Math.cos(floorplan.transform.rotation);
      const sin = Math.sin(floorplan.transform.rotation);

      const transform: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] = [
        cos, sin, 0, 0,
        -sin, cos, 0, 0,
        0, 0, 1, 0,
        floorplan.transform.centerX, floorplan.transform.centerY, floorplan.floorElevation, 1
      ];

      await Forma.proposal.addElement({ urn, transform });

      // Remove original building if specified
      if (options.originalBuildingPath) {
        try {
          await Forma.proposal.removeElement({ path: options.originalBuildingPath });
        } catch (removeError) {
          console.warn(`Could not remove original building ${i}:`, removeError);
        }
      }

      bakeResults.push({ success: true, urn });
    }

    console.log('='.repeat(60));
    console.log('BAKE WITH FLOORSTACK BATCH COMPLETE');
    console.log('='.repeat(60));

    return bakeResults;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Batch bake failed:', error);
    // Return failure for all buildings
    return buildings.map(() => ({ success: false, error: errorMessage }));
  }
}

// ============================================================================
// BASIC BUILDING API FUNCTIONS
// ============================================================================

// API endpoints:
// - Direct API: requires Bearer token, but works from any origin including localhost
// - Forma Proxy: uses session cookies, but gets blocked by CORS from localhost
const FORMA_API_DIRECT = 'https://developer.api.autodesk.com';
const FORMA_API_PROXY = 'https://app.autodeskforma.eu/api';

// Detect if running from localhost (development mode)
const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Token storage for localhost development
const TOKEN_STORAGE_KEY = 'floorplate_access_token';

/**
 * Get access token for localhost development using Forma SDK OAuth flow.
 *
 * ## Authentication Flow
 *
 * 1. **Check cache**: First checks sessionStorage for a previously acquired token
 *
 * 2. **Configure OAuth**: If no cached token, configures the Forma SDK with:
 *    - `clientId`: APS (Autodesk Platform Services) application client ID
 *    - `callbackUrl`: OAuth redirect URI pointing to /callback.html
 *    - `scopes`: Permissions needed (data:read, data:write for BasicBuilding API)
 *
 * 3. **Acquire token**: `Forma.auth.acquireTokenOverlay()` opens an iframe overlay
 *    within the Forma UI that:
 *    - Redirects to Autodesk login if not already authenticated
 *    - Requests user consent for the specified scopes
 *    - Redirects to callbackUrl with authorization code
 *    - SDK exchanges code for access token automatically
 *
 * 4. **Cache token**: Stores token in sessionStorage for reuse during session
 *
 * ## Requirements
 *
 * - APS app must have callback URL registered (e.g., http://localhost:8081/callback.html)
 * - callback.html must exist at the callbackUrl path (can be minimal, just closes the window)
 * - Extension must be loaded in Forma (SDK auth only works in Forma context)
 *
 * @returns Access token string for Bearer authentication
 */
async function getAccessToken(): Promise<string> {
  const cachedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);

  if (cachedToken) {
    return cachedToken;
  }

  // Configure OAuth with APS app credentials
  // Callback URL must match what's registered in the APS app settings
  Forma.auth.configure({
    clientId: "Pc8oPvsUEhKrRPKkx6sKcFdctXQhDeErjmIfKE5clqF6tt7N",
    callbackUrl: `${window.location.origin}/callback.html`,
    scopes: ["data:read", "data:write"],
  });

  // Opens an overlay for user to authenticate via Autodesk login
  // Returns { accessToken } after successful OAuth flow
  const { accessToken } = await Forma.auth.acquireTokenOverlay();

  sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);

  return accessToken;
}

/**
 * Check if two axis-aligned rectangles overlap (excluding edge-touching)
 */
function rectanglesOverlap(
  r1: { x: number; y: number; width: number; depth: number },
  r2: { x: number; y: number; width: number; depth: number }
): boolean {
  const epsilon = 0.001; // Small tolerance for floating point
  // No overlap if one is completely to the left, right, above, or below the other
  return !(
    r1.x + r1.width <= r2.x + epsilon ||  // r1 is left of r2
    r2.x + r2.width <= r1.x + epsilon ||  // r2 is left of r1
    r1.y + r1.depth <= r2.y + epsilon ||  // r1 is below r2
    r2.y + r2.depth <= r1.y + epsilon     // r2 is below r1
  );
}

/**
 * Log any overlapping geometry in the floorplan before sending to API
 */
function logOverlaps(floorplan: FloorPlanData): void {
  const allRects: Array<{ name: string; x: number; y: number; width: number; depth: number }> = [];

  // Add units
  for (const unit of floorplan.units) {
    allRects.push({
      name: `Unit ${unit.id} (${unit.typeName}, ${unit.side})`,
      x: unit.x,
      y: unit.y,
      width: unit.width,
      depth: unit.depth
    });
  }

  // Add cores
  for (const core of floorplan.cores) {
    allRects.push({
      name: `Core ${core.id}`,
      x: core.x,
      y: core.y,
      width: core.width,
      depth: core.depth
    });
  }

  // Add corridor
  allRects.push({
    name: 'Corridor',
    x: floorplan.corridor.x,
    y: floorplan.corridor.y,
    width: floorplan.corridor.width,
    depth: floorplan.corridor.depth
  });

  // Check all pairs
  const overlaps: string[] = [];
  for (let i = 0; i < allRects.length; i++) {
    for (let j = i + 1; j < allRects.length; j++) {
      if (rectanglesOverlap(allRects[i], allRects[j])) {
        overlaps.push(`${allRects[i].name} <-> ${allRects[j].name}`);
      }
    }
  }

  if (overlaps.length > 0) {
    console.warn('[BasicBuilding] WARNING: Detected overlapping geometry:');
    for (const overlap of overlaps) {
      console.warn(`  - ${overlap}`);
    }
    console.warn('[BasicBuilding] This may cause API validation errors.');
  } else {
    console.log('[BasicBuilding] No overlapping geometry detected.');
  }
}

/**
 * Round coordinate to avoid floating point precision issues
 * Uses 4 decimal places (0.1mm precision)
 */
function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Create a coordinate key for vertex deduplication
 */
function coordKey(x: number, y: number): string {
  return `${roundCoord(x)},${roundCoord(y)}`;
}

// NOTE: localToWorld function removed - was unused. Can be restored from git if needed.
// Transforms local (building) coordinates to world coordinates using rotation + translation.

/**
 * Convert FloorPlanData to FloorStack Plan format (SDK v0.90.0)
 * Creates a Plan with units for use with Forma.elements.floorStack.createFromFloors()
 *
 * This function:
 * - Deduplicates vertices using coordKey() helper
 * - Converts units, cores, corridor to SDK Unit format
 * - Maps program types (LIVING_UNIT, CORE, CORRIDOR)
 * - Handles L-shaped units via polyPoints
 * - Uses counterclockwise polygon winding
 * - CENTERS coordinates at origin (transform handles world positioning)
 *
 * Coordinates are in LOCAL building space (centered at origin).
 * Transform is applied separately when adding element to proposal.
 */
function convertFloorPlanToFloorStackPlan(floorplan: FloorPlanData): FloorStackPlan {
  const vertices: FloorStackVertex[] = [];
  const units: FloorStackUnit[] = [];

  // NOTE: FloorPlanData coordinates are ALREADY CENTERED by the generator
  // (generator applies offsetX = -length/2, offsetY = -buildingDepth/2)
  // So we use coordinates directly - no additional centering needed.

  // Map from coordinate key to vertex ID for deduplication
  const coordToVertexId = new Map<string, string>();
  let vertexIndex = 0;

  // Helper to add a vertex (or return existing ID if coordinates match)
  const getOrAddVertex = (x: number, y: number): string => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      console.warn(`[FloorStack] Non-finite vertex coordinates: x=${x}, y=${y}`);
    }

    const key = coordKey(x, y);
    const existingId = coordToVertexId.get(key);
    if (existingId !== undefined) {
      return existingId;
    }

    const id = `v${vertexIndex++}`;
    vertices.push({ id, x, y });
    coordToVertexId.set(key, id);
    return id;
  };

  // Process units (residential)
  for (const unit of floorplan.units) {
    if (unit.isLShaped && unit.polyPoints && unit.polyPoints.length >= 3) {
      const invalidPolyPoints = unit.polyPoints.filter(pt => !Number.isFinite(pt.x) || !Number.isFinite(pt.y));
      if (invalidPolyPoints.length > 0) {
        console.warn(`[FloorStack] Unit ${unit.id} has ${invalidPolyPoints.length} non-finite polyPoints`);
      }
      // L-shaped unit: use the polyPoints directly
      const vertexIds = unit.polyPoints.map(pt => getOrAddVertex(pt.x, pt.y));
      units.push({
        polygon: vertexIds,
        holes: [],  // FloorStack SDK uses nested array for holes
        program: 'LIVING_UNIT',
        functionId: 'residential'
      });
    } else {
      if (!Number.isFinite(unit.x) || !Number.isFinite(unit.y) || !Number.isFinite(unit.width) || !Number.isFinite(unit.depth)) {
        console.warn(`[FloorStack] Unit ${unit.id} has non-finite rect geometry`);
      }
      // Rectangular unit: create 4 corners (clockwise winding for Forma)
      const v1 = getOrAddVertex(unit.x, unit.y);
      const v2 = getOrAddVertex(unit.x + unit.width, unit.y);
      const v3 = getOrAddVertex(unit.x + unit.width, unit.y + unit.depth);
      const v4 = getOrAddVertex(unit.x, unit.y + unit.depth);
      units.push({
        polygon: [v1, v2, v3, v4],
        holes: [],
        program: 'LIVING_UNIT',
        functionId: 'residential'
      });
    }
  }

  // Process cores (clockwise winding for Forma)
  for (const core of floorplan.cores) {
    if (!Number.isFinite(core.x) || !Number.isFinite(core.y) || !Number.isFinite(core.width) || !Number.isFinite(core.depth)) {
      console.warn(`[FloorStack] Core ${core.id} has non-finite geometry`);
    }
    const v1 = getOrAddVertex(core.x, core.y);
    const v2 = getOrAddVertex(core.x + core.width, core.y);
    const v3 = getOrAddVertex(core.x + core.width, core.y + core.depth);
    const v4 = getOrAddVertex(core.x, core.y + core.depth);
    units.push({
      polygon: [v1, v2, v3, v4],
      holes: [],
      program: 'CORE',
      functionId: 'residential'
    });
  }

  // Process corridor (clockwise winding for Forma)
  const corridor = floorplan.corridor;
  if (!Number.isFinite(corridor.x) || !Number.isFinite(corridor.y) || !Number.isFinite(corridor.width) || !Number.isFinite(corridor.depth)) {
    console.warn('[FloorStack] Corridor has non-finite geometry');
  }
  const cv1 = getOrAddVertex(corridor.x, corridor.y);
  const cv2 = getOrAddVertex(corridor.x + corridor.width, corridor.y);
  const cv3 = getOrAddVertex(corridor.x + corridor.width, corridor.y + corridor.depth);
  const cv4 = getOrAddVertex(corridor.x, corridor.y + corridor.depth);
  units.push({
    polygon: [cv1, cv2, cv3, cv4],
    holes: [],
    program: 'CORRIDOR',
    functionId: 'residential'
  });

  // Process fillers (clockwise winding for Forma)
  for (const filler of floorplan.fillers || []) {
    if (!Number.isFinite(filler.x) || !Number.isFinite(filler.y) || !Number.isFinite(filler.width) || !Number.isFinite(filler.depth)) {
      console.warn(`[FloorStack] Filler ${filler.id} has non-finite geometry`);
    }
    const fv1 = getOrAddVertex(filler.x, filler.y);
    const fv2 = getOrAddVertex(filler.x + filler.width, filler.y);
    const fv3 = getOrAddVertex(filler.x + filler.width, filler.y + filler.depth);
    const fv4 = getOrAddVertex(filler.x, filler.y + filler.depth);
    units.push({
      polygon: [fv1, fv2, fv3, fv4],
      holes: [],
      program: 'CORE',  // Filler space is categorized as CORE
      functionId: 'residential'
    });
  }

  return {
    id: 'plan1',
    vertices,
    units
  };
}

/**
 * Convert FloorPlanData to BasicBuilding API format
 * Delegates to shared convertFloorPlanToFloorStackPlan() since both APIs use same format.
 *
 * Both FloorStack SDK v0.90.0 and BasicBuilding API use:
 * - holes: string[][] (nested array where each inner array is one hole polygon)
 */
function convertFloorPlanToBasicBuilding(
  floorplan: FloorPlanData,
  numFloors: number
): CreateBasicBuildingRequest {
  // Use shared conversion function - format is now identical
  const floorStackPlan = convertFloorPlanToFloorStackPlan(floorplan);

  // FloorStack and BasicBuilding formats are now the same (SDK v0.90.0)
  const basicBuildingPlan: BasicBuildingFloorPlan = {
    id: floorStackPlan.id,
    vertices: floorStackPlan.vertices,
    units: floorStackPlan.units.map(unit => ({
      polygon: unit.polygon,
      holes: unit.holes,  // Same format: string[][]
      program: unit.program,
      functionId: unit.functionId
    }))
  };

  // Create floor entries (one per level, all referencing the same plan)
  const floors: BasicBuildingFloorByPlan[] = Array.from({ length: numFloors }, () => ({
    planId: basicBuildingPlan.id,
    height: FLOOR_HEIGHT
  }));

  console.log('[BasicBuilding] Converted from FloorStack plan format');
  console.log(`  - ${basicBuildingPlan.vertices.length} vertices, ${basicBuildingPlan.units.length} units`);

  return {
    floors,
    plans: [basicBuildingPlan]
  };
}

/**
 * Call the BasicBuilding API to create a building with unit subdivisions
 * - Localhost: Uses direct API with Bearer token (prompts user)
 * - Production: Uses Forma proxy with session cookies
 */
async function createBasicBuildingAPI(
  building: CreateBasicBuildingRequest
): Promise<BasicBuildingCreateResponse[]> {
  const projectId = await Forma.getProjectId();
  const authContext = projectId;

  // Determine region - default to EMEA, could be made configurable
  const region = 'EMEA';

  // Choose API endpoint based on environment
  const apiBase = isLocalhost ? FORMA_API_DIRECT : FORMA_API_PROXY;
  const url = `${apiBase}/forma/basicbuilding/v1alpha/basicbuilding/batch-create?authcontext=${encodeURIComponent(authContext)}`;

  console.log('[BasicBuilding API] Environment:', isLocalhost ? 'localhost (using direct API)' : 'production (using proxy)');
  console.log('[BasicBuilding API] Calling:', url);
  console.log('[BasicBuilding API] Building data:', JSON.stringify(building, null, 2));

  // Build fetch options based on environment
  let response: Response;

  if (isLocalhost) {
    // Localhost: Use direct API with Bearer token
    const accessToken = await getAccessToken();
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Ads-Region': region
      },
      body: JSON.stringify([building])  // Array wrapper!
    });
  } else {
    // Production: Use Forma proxy with session cookies
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ads-Region': region
      },
      credentials: 'include',  // Include session cookies for auth
      body: JSON.stringify([building])  // Array wrapper!
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BasicBuilding API failed: ${response.status} ${errorText}`);
  }

  const results: BasicBuildingCreateResponse[] = await response.json();
  console.log('[BasicBuilding API] Response:', results);
  return results;
}

/**
 * Bake a floorplan using the BasicBuilding API
 * Creates a native Forma building with unit subdivisions (graphBuilding representation)
 * Uses Forma proxy which authenticates via session cookies (no token needed)
 */
export async function bakeWithBasicBuildingAPI(
  floorplan: FloorPlanData,
  options: BakeOptions
): Promise<BakeResult> {
  try {
    console.log('='.repeat(60));
    console.log('BAKE WITH BASIC BUILDING API STARTING');
    console.log('='.repeat(60));

    const { numFloors, originalBuildingPath } = options;

    // 0. Check for overlapping geometry (pre-validation)
    logOverlaps(floorplan);

    // 1. Convert FloorPlanData to BasicBuilding format
    console.log('Converting floorplan to BasicBuilding format...');
    const buildingData = convertFloorPlanToBasicBuilding(floorplan, numFloors);
    console.log(`Converted: ${buildingData.plans[0].vertices.length} vertices, ${buildingData.plans[0].units.length} units, ${buildingData.floors.length} floors`);

    // 2. Call BasicBuilding API (uses session cookies via Forma proxy)
    console.log('Calling BasicBuilding API...');
    const results = await createBasicBuildingAPI(buildingData);

    if (!results || results.length === 0) {
      throw new Error('BasicBuilding API returned empty response');
    }

    const urn = results[0].urn;
    console.log('Building created with URN:', urn);

    // 3. Get terrain elevation for positioning
    const elevation = await Forma.terrain.getElevationAt({
      x: floorplan.transform.centerX,
      y: floorplan.transform.centerY
    });
    console.log('Terrain elevation at center:', elevation);

    // 4. Calculate transform
    // IMPORTANT: Vertices are in CENTERED local coordinates (origin at building center)
    // The generator already applies offsetX = -length/2 and offsetY = -depth/2
    // So we just rotate around origin and translate to world center
    const { centerX, centerY, rotation } = floorplan.transform;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    console.log('[DEBUG TRANSFORM BasicBuilding] Applying transform:');
    console.log(`  - Rotation: ${(rotation * 180 / Math.PI).toFixed(2)} degrees`);
    console.log(`  - Local coords are centered at (0, 0) - building center is at origin`);
    console.log(`  - World center target: (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`);
    console.log(`  - Translation: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${elevation.toFixed(2)})`);

    // 4x4 column-major transform matrix:
    // [ cos  -sin  0   centerX ]
    // [ sin   cos  0   centerY ]
    // [  0     0   1   elevation ]
    // [  0     0   0    1 ]
    // Column-major: [col0, col1, col2, col3]
    const transform: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] = [
      cos, sin, 0, 0,           // Column 0: X axis after rotation
      -sin, cos, 0, 0,          // Column 1: Y axis after rotation
      0, 0, 1, 0,               // Column 2: Z axis (unchanged)
      centerX, centerY, elevation, 1  // Column 3: Direct translation to world center
    ];

    console.log('[DEBUG TRANSFORM] Adding to proposal with rotation + translation to world center');

    // 5. Add to proposal
    await Forma.proposal.addElement({ urn, transform });
    console.log('Element added to proposal');

    // 6. Remove original building if specified
    if (originalBuildingPath) {
      console.log('Removing original building:', originalBuildingPath);
      try {
        await Forma.proposal.removeElement({ path: originalBuildingPath });
        console.log('Original building removed');
      } catch (removeError) {
        console.warn('Could not remove original building:', removeError);
      }
    }

    console.log('='.repeat(60));
    console.log('BAKE WITH BASIC BUILDING API COMPLETE');
    console.log('='.repeat(60));

    return { success: true, urn };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Bake with BasicBuilding API failed:', error);
    return { success: false, error: errorMessage };
  }
}

// Export reserved functions for future use
export const _reserved = {
  generateBuildingMesh: _generateBuildingMesh,
  generateFootprint: _generateFootprint,
  generateFloorsFromFloorplan: _generateFloorsFromFloorplan,
  convertFloorPlanToBasicBuilding,
  createBasicBuildingAPI
};

// Export internal utilities for testing
export const _testUtils = {
  coordKey,
  roundCoord,
  ensureCounterClockwise,
  convertFloorPlanToFloorStackPlan
};
