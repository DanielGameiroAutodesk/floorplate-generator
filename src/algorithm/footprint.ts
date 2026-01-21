/**
 * Footprint Extraction Module
 *
 * Extracts building footprint data from Forma triangle mesh geometry.
 * Used to determine building dimensions, orientation, and position.
 */

import { BuildingFootprint } from './types';
import { distance } from '../geometry/point';
import { FOOTPRINT_EXTRACTION } from './constants';

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Cross product of vectors OA and OB where O is the origin point.
 * Used for determining point orientation in convex hull algorithm.
 */
function cross(
  o: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Computes the convex hull of a set of 2D points using Andrew's monotone chain algorithm.
 *
 * @param points - Array of 2D points
 * @returns Array of points forming the convex hull in counter-clockwise order
 */
function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

  const hull: { x: number; y: number }[] = [];

  // Lower hull
  for (const p of sorted) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }

  // Upper hull
  const lowerLen = hull.length;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const p = sorted[i];
    while (hull.length > lowerLen && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }

  hull.pop();
  return hull;
}

/**
 * Finds the longest edge in a convex hull.
 * The longest edge typically represents the primary axis of a building.
 *
 * @param hull - Array of points forming a convex hull
 * @returns Object containing the two endpoints and length of the longest edge
 */
function findLongestEdge(hull: { x: number; y: number }[]): {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  length: number;
} {
  let maxLen = 0;
  let p1 = hull[0];
  let p2 = hull[0];

  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const len = distance(hull[i], hull[j]);
    if (len > maxLen) {
      maxLen = len;
      p1 = hull[i];
      p2 = hull[j];
    }
  }

  return { p1, p2, length: maxLen };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Error thrown when footprint extraction fails due to invalid input.
 */
export class FootprintExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootprintExtractionError';
  }
}

/**
 * Extracts a building footprint from Forma triangle mesh data.
 *
 * Analyzes the 3D mesh to determine:
 * - **Dimensions**: Width (along corridor direction) and depth (perpendicular)
 * - **World position**: Center coordinates for rendering transforms
 * - **Rotation**: Orientation angle based on longest edge
 * - **Floor elevation**: Ground level Z coordinate
 *
 * **Algorithm overview:**
 * 1. Finds the ground plane by detecting the lowest Z values
 * 2. Collects all ground-level vertices
 * 3. Computes a convex hull of these points
 * 4. Identifies the longest edge as the building's primary axis
 * 5. Calculates dimensions in the building's local coordinate system
 *
 * The extracted footprint provides the transform data needed to render
 * generated floorplates in the correct position and orientation in Forma.
 *
 * @param triangles - Float32Array of vertex positions from Forma's geometry API.
 *                    Format: [x1, y1, z1, x2, y2, z2, ...] where each triplet
 *                    is a vertex and every 3 triplets form a triangle.
 *                    Obtained via `Forma.geometry.getTriangles({ path })`.
 * @returns BuildingFootprint containing:
 *          - `width`: Building length along primary axis (meters)
 *          - `depth`: Building depth perpendicular to axis (meters)
 *          - `height`: Building height (meters)
 *          - `centerX`, `centerY`: World coordinates of building center
 *          - `rotation`: Angle in radians for alignment
 *          - `floorZ`: Ground elevation (meters)
 *          - `minX`, `maxX`, `minY`, `maxY`: World-space bounding box
 * @throws {FootprintExtractionError} If the input array is invalid
 *
 * @example
 * ```typescript
 * // Get triangles from Forma
 * const triangles = await Forma.geometry.getTriangles({
 *   path: selectedBuildingPath
 * });
 *
 * // Extract footprint for generation
 * const footprint = extractFootprintFromTriangles(triangles);
 * console.log(`Building is ${footprint.width.toFixed(1)}m x ${footprint.depth.toFixed(1)}m`);
 * console.log(`Rotated ${(footprint.rotation * 180 / Math.PI).toFixed(1)} degrees`);
 *
 * // Use footprint to generate layouts
 * const floorplan = generateFloorplate(footprint, config, egressConfig);
 * ```
 */
export function extractFootprintFromTriangles(triangles: Float32Array): BuildingFootprint {
  // ========================================================================
  // Input Validation
  // ========================================================================

  if (!triangles) {
    throw new FootprintExtractionError('triangles array is null or undefined');
  }

  if (triangles.length === 0) {
    throw new FootprintExtractionError('triangles array is empty');
  }

  if (triangles.length % 3 !== 0) {
    throw new FootprintExtractionError(
      `triangles array length (${triangles.length}) is not divisible by 3. ` +
      `Expected format: [x1, y1, z1, x2, y2, z2, ...]`
    );
  }

  // Check for NaN/Infinity values (only check a sample for performance)
  const sampleSize = Math.min(triangles.length, 300); // Check first 100 vertices
  for (let i = 0; i < sampleSize; i++) {
    if (!Number.isFinite(triangles[i])) {
      throw new FootprintExtractionError(
        `Invalid value at index ${i}: ${triangles[i]}. Values must be finite numbers.`
      );
    }
  }

  // ========================================================================
  // Find Bounding Box
  // ========================================================================

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < triangles.length; i += 3) {
    minX = Math.min(minX, triangles[i]);
    maxX = Math.max(maxX, triangles[i]);
    minY = Math.min(minY, triangles[i + 1]);
    maxY = Math.max(maxY, triangles[i + 1]);
    minZ = Math.min(minZ, triangles[i + 2]);
    maxZ = Math.max(maxZ, triangles[i + 2]);
  }

  // Validate bounding box
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) ||
      !Number.isFinite(minY) || !Number.isFinite(maxY) ||
      !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
    throw new FootprintExtractionError(
      'Unable to compute bounding box. Check that input contains valid coordinate data.'
    );
  }

  // ========================================================================
  // Extract Ground Points
  // ========================================================================

  const floorZ = minZ;
  const groundTolerance = (maxZ - minZ) * FOOTPRINT_EXTRACTION.GROUND_TOLERANCE_RATIO;

  const groundPoints: { x: number; y: number }[] = [];
  const seenPoints = new Set<string>();
  const precision = FOOTPRINT_EXTRACTION.GROUND_POINT_PRECISION;

  for (let i = 0; i < triangles.length; i += 3) {
    const z = triangles[i + 2];
    if (z <= floorZ + groundTolerance) {
      const key = `${triangles[i].toFixed(precision)},${triangles[i + 1].toFixed(precision)}`;
      if (!seenPoints.has(key)) {
        seenPoints.add(key);
        groundPoints.push({ x: triangles[i], y: triangles[i + 1] });
      }
    }
  }

  // Fallback: if not enough ground points, use all points
  if (groundPoints.length < 2) {
    for (let i = 0; i < triangles.length; i += 3) {
      const key = `${triangles[i].toFixed(precision)},${triangles[i + 1].toFixed(precision)}`;
      if (!seenPoints.has(key)) {
        seenPoints.add(key);
        groundPoints.push({ x: triangles[i], y: triangles[i + 1] });
      }
    }
  }

  // Final validation
  if (groundPoints.length < 2) {
    throw new FootprintExtractionError(
      `Insufficient ground points found (${groundPoints.length}). ` +
      `Need at least 2 points to determine building orientation.`
    );
  }

  // ========================================================================
  // Compute Convex Hull and Orientation
  // ========================================================================

  const hull = convexHull(groundPoints);

  if (hull.length < 2) {
    throw new FootprintExtractionError(
      'Convex hull has fewer than 2 points. Building footprint may be degenerate.'
    );
  }

  const { p1, p2 } = findLongestEdge(hull);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const rotation = Math.atan2(dy, dx);

  // ========================================================================
  // Compute Local Dimensions
  // ========================================================================

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const cosR = Math.cos(-rotation);
  const sinR = Math.sin(-rotation);

  let localMinX = Infinity, localMaxX = -Infinity;
  let localMinY = Infinity, localMaxY = -Infinity;

  groundPoints.forEach(p => {
    const tx = p.x - centerX;
    const ty = p.y - centerY;
    const localX = tx * cosR - ty * sinR;
    const localY = tx * sinR + ty * cosR;
    localMinX = Math.min(localMinX, localX);
    localMaxX = Math.max(localMaxX, localX);
    localMinY = Math.min(localMinY, localY);
    localMaxY = Math.max(localMaxY, localY);
  });

  const width = localMaxX - localMinX;
  const depth = localMaxY - localMinY;
  const height = maxZ - minZ;

  return {
    minX, maxX, minY, maxY,
    width, depth, height,
    centerX, centerY,
    floorZ, rotation
  };
}
