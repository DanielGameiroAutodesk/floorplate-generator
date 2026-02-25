/**
 * Footprint Polygon Extraction Module
 *
 * Extracts the actual building footprint polygon (including concave corners)
 * from Forma's triangle mesh geometry.
 *
 * Unlike footprint.ts which uses a convex hull (losing concave corners),
 * this module uses boundary edge extraction to preserve the true building shape.
 *
 * Critical detail: Float32 meshes have micro-differences at coincident vertices
 * (e.g. 0.000001 apart). Without vertex welding, boundary edge detection silently
 * fails. Weld first, then count edge occurrences.
 */

import { BuildingFootprint } from './types';
import { distance } from '../geometry/point';
import { distanceToSegment } from '../geometry/line';
import { ensureCounterClockwise } from '../geometry/polygon';
import { FOOTPRINT_EXTRACTION } from './constants';

// ============================================================================
// Types
// ============================================================================

interface GroundTriangle {
  /** Welded vertex indices */
  a: number;
  b: number;
  c: number;
}

interface BoundaryEdge {
  start: number;
  end: number;
}

// ============================================================================
// Step 1: Vertex Welding
// ============================================================================

/**
 * Merge vertices within epsilon of each other using a spatial hash grid.
 * Returns a mapping from original point index to canonical (welded) index.
 *
 * WHY: Float32 mesh data has micro-differences (e.g., 0.000001) at vertices
 * that should be identical. Exact matching fails; spatial hash merging fixes it.
 */
export function weldVertices(
  points: { x: number; y: number }[],
  epsilon: number
): { uniquePoints: { x: number; y: number }[]; indexMap: number[] } {
  const uniquePoints: { x: number; y: number }[] = [];
  const indexMap: number[] = new Array(points.length);
  // Spatial hash: key = "cx,cy" where cx = floor(x/epsilon), cy = floor(y/epsilon)
  const grid = new Map<string, number[]>(); // cell key → unique point indices

  const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const cx = Math.floor(p.x / epsilon);
    const cy = Math.floor(p.y / epsilon);

    // Check this cell and 8 neighboring cells
    let foundIdx = -1;
    for (let dx = -1; dx <= 1 && foundIdx === -1; dx++) {
      for (let dy = -1; dy <= 1 && foundIdx === -1; dy++) {
        const key = cellKey(cx + dx, cy + dy);
        const candidates = grid.get(key);
        if (candidates) {
          for (const ui of candidates) {
            if (distance(p, uniquePoints[ui]) < epsilon) {
              foundIdx = ui;
              break;
            }
          }
        }
      }
    }

    if (foundIdx === -1) {
      // New unique point
      foundIdx = uniquePoints.length;
      uniquePoints.push({ x: p.x, y: p.y });
      const key = cellKey(cx, cy);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(foundIdx);
    }

    indexMap[i] = foundIdx;
  }

  return { uniquePoints, indexMap };
}

// ============================================================================
// Step 2: Extract Ground Triangles
// ============================================================================

/**
 * Find all triangles at ground level (z ≤ floorZ + tolerance).
 * Returns triangles as triplets of welded vertex indices.
 */
function extractGroundTriangles(
  triangles: Float32Array,
  floorZ: number,
  groundTolerance: number,
  indexMap: number[]
): GroundTriangle[] {
  const result: GroundTriangle[] = [];
  // Each triangle = 3 vertices × 3 coords (x,y,z) = 9 floats
  for (let i = 0; i < triangles.length; i += 9) {
    const z0 = triangles[i + 2];
    const z1 = triangles[i + 5];
    const z2 = triangles[i + 8];

    // All three vertices must be at ground level
    if (
      z0 <= floorZ + groundTolerance &&
      z1 <= floorZ + groundTolerance &&
      z2 <= floorZ + groundTolerance
    ) {
      // Original point index = (i/9)*3 + vertex_offset
      const baseOrig = (i / 9) * 3;
      const a = indexMap[baseOrig];
      const b = indexMap[baseOrig + 1];
      const c = indexMap[baseOrig + 2];

      // Skip degenerate triangles (two vertices are the same after welding)
      if (a !== b && b !== c && a !== c) {
        result.push({ a, b, c });
      }
    }
  }
  return result;
}

// ============================================================================
// Step 3: Extract Boundary Edges
// ============================================================================

/**
 * Find edges that belong to exactly one ground triangle = exterior boundary.
 * Edges are keyed by sorted vertex indices (not coordinates).
 *
 * WHY sorted indices: Edge (2,5) and edge (5,2) are the same physical edge.
 * Sorting ensures they hash identically regardless of traversal direction.
 */
function extractBoundaryEdges(triangles: GroundTriangle[]): BoundaryEdge[] {
  // Count occurrences of each edge
  const edgeCount = new Map<string, { start: number; end: number; count: number }>();

  const addEdge = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeCount.has(key)) {
      edgeCount.get(key)!.count++;
    } else {
      edgeCount.set(key, { start: a, end: b, count: 1 });
    }
  };

  for (const tri of triangles) {
    addEdge(tri.a, tri.b);
    addEdge(tri.b, tri.c);
    addEdge(tri.c, tri.a);
  }

  // Boundary edges appear exactly once
  const boundary: BoundaryEdge[] = [];
  for (const edge of edgeCount.values()) {
    if (edge.count === 1) {
      boundary.push({ start: edge.start, end: edge.end });
    }
  }
  return boundary;
}

// ============================================================================
// Step 4: Chain Edges into Polygon
// ============================================================================

/**
 * Chain unordered boundary edges into an ordered closed polygon.
 * Starts at the lowest-leftmost vertex for determinism.
 */
function chainEdgesToPolygon(
  edges: BoundaryEdge[],
  vertices: { x: number; y: number }[]
): { x: number; y: number }[] {
  if (edges.length < 3) return [];

  // Build adjacency map
  const adj = new Map<number, number[]>();
  for (const edge of edges) {
    if (!adj.has(edge.start)) adj.set(edge.start, []);
    if (!adj.has(edge.end)) adj.set(edge.end, []);
    adj.get(edge.start)!.push(edge.end);
    adj.get(edge.end)!.push(edge.start);
  }

  // Find deterministic start: lowest y, then lowest x
  let startIdx = edges[0].start;
  for (const [idx] of adj) {
    const v = vertices[idx];
    const s = vertices[startIdx];
    if (v.y < s.y || (v.y === s.y && v.x < s.x)) {
      startIdx = idx;
    }
  }

  const polygon: { x: number; y: number }[] = [];
  const visited = new Set<number>();
  let current = startIdx;

  while (true) {
    polygon.push(vertices[current]);
    visited.add(current);

    const neighbors = adj.get(current) || [];
    // Pick unvisited neighbor
    let next = -1;
    for (const n of neighbors) {
      if (!visited.has(n)) {
        next = n;
        break;
      }
    }

    if (next === -1) {
      break;
    }

    current = next;
  }

  return polygon;
}

// ============================================================================
// Step 5: Douglas-Peucker Simplification
// ============================================================================

/**
 * Simplify a polygon using Douglas-Peucker algorithm.
 * Removes vertices that add less than epsilon perpendicular deviation.
 * Also merges nearly-collinear edges (angle within 2° of 180°).
 */
function simplifyPolygon(
  polygon: { x: number; y: number }[],
  epsilon: number
): { x: number; y: number }[] {
  if (polygon.length <= 3) return polygon;

  // Douglas-Peucker on a closed polygon: process as open polyline, then close
  const simplified = douglasPeucker(polygon, epsilon);

  // Remove collinear points (cross product near zero)
  return removeCollinear(simplified, 2 * Math.PI / 180); // 2° tolerance
}

function douglasPeucker(
  points: { x: number; y: number }[],
  epsilon: number
): { x: number; y: number }[] {
  if (points.length <= 2) return [...points];

  // Find point with max perpendicular distance from line[0]→line[n-1]
  const start = points[0];
  const end = points[points.length - 1];
  const line = { start, end };

  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(line, points[i]);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [start, end];
  }
}

function removeCollinear(
  points: { x: number; y: number }[],
  angleTolerance: number
): { x: number; y: number }[] {
  if (points.length <= 3) return points;

  const result: { x: number; y: number }[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const v1x = curr.x - prev.x, v1y = curr.y - prev.y;
    const v2x = next.x - curr.x, v2y = next.y - curr.y;
    const cross = Math.abs(v1x * v2y - v1y * v2x);
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    const sinAngle = cross / (len1 * len2 + 1e-10);
    if (sinAngle > Math.sin(angleTolerance)) {
      result.push(curr);
    }
  }
  return result.length >= 3 ? result : points;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Extracts the actual building footprint polygon from Forma triangle mesh data.
 *
 * This preserves concave corners (inner corners of L/U/H shaped buildings),
 * unlike extractFootprintFromTriangles() which uses a convex hull.
 *
 * @param triangles - Float32Array from Forma.geometry.getTriangles()
 * @returns { polygon, floorZ, height }
 */
export function extractFootprintPolygon(triangles: Float32Array): {
  polygon: { x: number; y: number }[];
  floorZ: number;
  height: number;
} {
  // Find bounding Z for ground detection
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 2; i < triangles.length; i += 3) {
    const z = triangles[i];
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const floorZ = minZ;
  const height = maxZ - minZ;
  const groundTolerance = (maxZ - minZ) * FOOTPRINT_EXTRACTION.GROUND_TOLERANCE_RATIO;

  // Collect all vertex positions (one per triangle vertex)
  const allPoints: { x: number; y: number }[] = [];
  for (let i = 0; i < triangles.length; i += 3) {
    allPoints.push({ x: triangles[i], y: triangles[i + 1] });
  }

  // Weld vertices: epsilon = 1mm
  const WELD_EPSILON = 0.001;
  const { uniquePoints, indexMap } = weldVertices(allPoints, WELD_EPSILON);

  // Get ground-level triangles
  const groundTris = extractGroundTriangles(triangles, floorZ, groundTolerance, indexMap);

  if (groundTris.length === 0) {
    // Fallback: return convex hull bounding box
    const bb = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const p of uniquePoints) {
      if (p.x < bb.minX) bb.minX = p.x;
      if (p.x > bb.maxX) bb.maxX = p.x;
      if (p.y < bb.minY) bb.minY = p.y;
      if (p.y > bb.maxY) bb.maxY = p.y;
    }
    return {
      polygon: [
        { x: bb.minX, y: bb.minY }, { x: bb.maxX, y: bb.minY },
        { x: bb.maxX, y: bb.maxY }, { x: bb.minX, y: bb.maxY }
      ],
      floorZ,
      height
    };
  }

  // Get boundary edges
  const boundaryEdges = extractBoundaryEdges(groundTris);

  if (boundaryEdges.length < 3) {
    // Fallback
    return { polygon: uniquePoints.slice(0, 4), floorZ, height };
  }

  // Chain into polygon
  const rawPolygon = chainEdgesToPolygon(boundaryEdges, uniquePoints);

  if (rawPolygon.length < 3) {
    return { polygon: uniquePoints.slice(0, 4), floorZ, height };
  }

  // Simplify (Douglas-Peucker with 5cm epsilon to remove mesh noise)
  const simplified = simplifyPolygon(rawPolygon, 0.05);

  // Ensure counter-clockwise winding
  const ccw = ensureCounterClockwise({ vertices: simplified });
  const { vertices } = ccw;

  return { polygon: vertices, floorZ, height };
}

/**
 * Convert a footprint polygon to the legacy BuildingFootprint format.
 * Finds the longest edge as the primary axis (same as convex hull approach).
 * Populates the new optional `polygon` field for downstream use.
 */
export function polygonToLegacyFootprint(
  polygon: { x: number; y: number }[],
  floorZ: number,
  height: number
): BuildingFootprint {
  const n = polygon.length;

  // Find bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of polygon) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Find longest edge to determine rotation (primary axis)
  let maxLen = 0;
  let rotation = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = polygon[j].x - polygon[i].x;
    const dy = polygon[j].y - polygon[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > maxLen) {
      maxLen = len;
      rotation = Math.atan2(dy, dx);
    }
  }

  // Rotate all points to local frame
  const cosR = Math.cos(-rotation);
  const sinR = Math.sin(-rotation);
  let localMinX = Infinity, localMaxX = -Infinity;
  let localMinY = Infinity, localMaxY = -Infinity;
  for (const v of polygon) {
    const tx = v.x - centerX;
    const ty = v.y - centerY;
    const lx = tx * cosR - ty * sinR;
    const ly = tx * sinR + ty * cosR;
    if (lx < localMinX) localMinX = lx;
    if (lx > localMaxX) localMaxX = lx;
    if (ly < localMinY) localMinY = ly;
    if (ly > localMaxY) localMaxY = ly;
  }

  return {
    minX, maxX, minY, maxY,
    width: localMaxX - localMinX,
    depth: localMaxY - localMinY,
    height,
    centerX,
    centerY,
    floorZ,
    rotation,
    polygon  // new field
  };
}
