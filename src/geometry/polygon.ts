/**
 * Polygon utility functions
 * Polygons are defined by an array of vertices in order (clockwise or counter-clockwise)
 * The polygon is implicitly closed (last vertex connects to first)
 */

import { Polygon, Point, BoundingBox, Line } from '../types/geometry';
import { distance } from './point';

/**
 * Creates a polygon from an array of points
 */
export function createPolygon(vertices: Point[]): Polygon {
  return { vertices: [...vertices] };
}

/**
 * Creates a polygon from coordinate pairs [x1,y1, x2,y2, ...]
 */
export function createPolygonFromCoords(coords: number[]): Polygon {
  const vertices: Point[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    vertices.push({ x: coords[i], y: coords[i + 1] });
  }
  return { vertices };
}

/**
 * Returns the number of vertices in a polygon
 */
export function vertexCount(polygon: Polygon): number {
  return polygon.vertices.length;
}

/**
 * Returns the edges of a polygon as an array of line segments
 */
export function getEdges(polygon: Polygon): Line[] {
  const edges: Line[] = [];
  const n = polygon.vertices.length;

  for (let i = 0; i < n; i++) {
    edges.push({
      start: polygon.vertices[i],
      end: polygon.vertices[(i + 1) % n]
    });
  }

  return edges;
}

/**
 * Calculates the perimeter of a polygon.
 *
 * @param polygon - Polygon
 * @returns Sum of edge lengths in feet
 */
export function polygonPerimeter(polygon: Polygon): number {
  let perimeter = 0;
  const n = polygon.vertices.length;

  for (let i = 0; i < n; i++) {
    perimeter += distance(polygon.vertices[i], polygon.vertices[(i + 1) % n]);
  }

  return perimeter;
}

/**
 * Calculates the signed area of a polygon using the Shoelace formula.
 *
 * **Winding**: Positive = CCW, negative = CW. Formula: ½Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ).
 *
 * @param polygon - Polygon
 * @returns Signed area (positive for CCW, negative for CW)
 *
 * @remarks
 * Self-intersecting polygons may yield misleading signed area. For simple
 * polygons, the sign reliably indicates winding order.
 */
export function signedArea(polygon: Polygon): number {
  let area = 0;
  const n = polygon.vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon.vertices[i].x * polygon.vertices[j].y;
    area -= polygon.vertices[j].x * polygon.vertices[i].y;
  }

  return area / 2;
}

/**
 * Calculates the absolute (unsigned) area of a polygon.
 *
 * @param polygon - Polygon
 * @returns Area in square feet
 */
export function polygonArea(polygon: Polygon): number {
  return Math.abs(signedArea(polygon));
}

/**
 * Determines if polygon vertices are in clockwise order
 */
export function isClockwise(polygon: Polygon): boolean {
  return signedArea(polygon) < 0;
}

/**
 * Determines if polygon vertices are in counter-clockwise order.
 *
 * @param polygon - Polygon
 * @returns True if winding is counter-clockwise
 */
export function isCounterClockwise(polygon: Polygon): boolean {
  return signedArea(polygon) > 0;
}

/**
 * Reverses the winding order of a polygon (CCW ↔ CW).
 *
 * @param polygon - Polygon
 * @returns New polygon with reversed vertex order
 */
export function reverseWinding(polygon: Polygon): Polygon {
  return { vertices: [...polygon.vertices].reverse() };
}

/**
 * Ensures polygon is in counter-clockwise order.
 *
 * If already CCW, returns input. Otherwise returns reversed copy.
 *
 * @param polygon - Polygon (may be CW or CCW)
 * @returns Polygon in CCW order
 */
export function ensureCounterClockwise(polygon: Polygon): Polygon {
  return isClockwise(polygon) ? reverseWinding(polygon) : polygon;
}

/**
 * Calculates the centroid (center of mass) of a polygon.
 *
 * Uses the formula for polygon centroid: C = (1/(6A)) Σ (xᵢ + xᵢ₊₁)(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ),
 * and similarly for y. For non-self-intersecting polygons, centroid lies inside.
 *
 * @param polygon - Polygon
 * @returns Centroid point
 *
 * @remarks
 * Factor 1/(6×area) comes from the integration of the shoelace formula.
 */
export function polygonCentroid(polygon: Polygon): Point {
  let cx = 0;
  let cy = 0;
  let area = 0;
  const n = polygon.vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = polygon.vertices[i].x * polygon.vertices[j].y - polygon.vertices[j].x * polygon.vertices[i].y;
    cx += (polygon.vertices[i].x + polygon.vertices[j].x) * cross;
    cy += (polygon.vertices[i].y + polygon.vertices[j].y) * cross;
    area += cross;
  }

  area /= 2;
  const factor = 1 / (6 * area); // Centroid formula divisor

  return {
    x: cx * factor,
    y: cy * factor
  };
}

/**
 * Calculates the axis-aligned bounding box of a polygon.
 *
 * @param polygon - Polygon
 * @returns BoundingBox; empty polygon yields zero-size box at origin
 */
export function polygonBoundingBox(polygon: Polygon): BoundingBox {
  if (polygon.vertices.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }; // Degenerate case
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const v of polygon.vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Returns the width of a polygon's axis-aligned bounding box.
 *
 * @param polygon - Polygon
 * @returns maxX - minX in feet
 */
export function polygonWidth(polygon: Polygon): number {
  const bb = polygonBoundingBox(polygon);
  return bb.maxX - bb.minX;
}

/**
 * Returns the height of a polygon's axis-aligned bounding box.
 *
 * @param polygon - Polygon
 * @returns maxY - minY in feet
 */
export function polygonHeight(polygon: Polygon): number {
  const bb = polygonBoundingBox(polygon);
  return bb.maxY - bb.minY;
}

/**
 * Checks if two line segments intersect.
 */
function doLineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (d === 0) return false;
  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
  return ua > 0.001 && ua < 0.999 && ub > 0.001 && ub < 0.999;
}

/**
 * Checks if two polygons overlap or intersect.
 */
export function polygonsOverlapInterior(polyA: Point[], polyB: Point[]): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false;

  const nA = polyA.length;
  const nB = polyB.length;

  // 1. Check for any edge intersection
  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % nA];

    for (let j = 0; j < nB; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % nB];

      if (doLineSegmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  // 2. Check full containment (using centroids is more robust than a single vertex)
  // Calculate centroid of polyA
  const centroidA = {
    x: polyA.reduce((sum, p) => sum + p.x, 0) / polyA.length,
    y: polyA.reduce((sum, p) => sum + p.y, 0) / polyA.length
  };

  // Calculate centroid of polyB
  const centroidB = {
    x: polyB.reduce((sum, p) => sum + p.x, 0) / polyB.length,
    y: polyB.reduce((sum, p) => sum + p.y, 0) / polyB.length
  };

  // If one centroid is inside the other polygon, they overlap
  if (pointInPolygon({ vertices: polyB }, centroidA)) return true;
  if (pointInPolygon({ vertices: polyA }, centroidB)) return true;

  return false;
}

/**
 * Tests if a point is inside a polygon using ray casting (even-odd rule).
 *
 * Casts a horizontal ray from the point to +∞; counts crossings. Odd = inside.
 * Boundary points may be classified as inside or outside depending on edge cases.
 *
 * @param polygon - Polygon (vertices in any winding order)
 * @param point - Query point
 * @returns True if point is inside the polygon
 *
 * @remarks
 * Robust for simple polygons. Does not handle points exactly on vertices/edges
 * with perfect consistency; floating-point tolerances apply.
 */
export function pointInPolygon(polygon: Polygon, point: Point): boolean {
  const n = polygon.vertices.length;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon.vertices[i].x, yi = polygon.vertices[i].y;
    const xj = polygon.vertices[j].x, yj = polygon.vertices[j].y;
    // Edge crosses horizontal line through point? Intersection X < point.x?
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Translates all vertices of a polygon by the given delta.
 *
 * @param polygon - Source polygon
 * @param dx - Horizontal offset
 * @param dy - Vertical offset
 * @returns New polygon
 */
export function translatePolygon(polygon: Polygon, dx: number, dy: number): Polygon {
  return {
    vertices: polygon.vertices.map(v => ({
      x: v.x + dx,
      y: v.y + dy
    }))
  };
}

/**
 * Scales a polygon from its centroid (uniform scale).
 *
 * @param polygon - Source polygon
 * @param factor - Scale factor (2 = double size)
 * @returns New polygon
 */
export function scalePolygon(polygon: Polygon, factor: number): Polygon {
  const center = polygonCentroid(polygon);
  return {
    vertices: polygon.vertices.map(v => ({
      x: center.x + (v.x - center.x) * factor,
      y: center.y + (v.y - center.y) * factor
    }))
  };
}

/**
 * Scales a polygon from an arbitrary center point.
 *
 * @param polygon - Source polygon
 * @param center - Center of scaling (remains fixed)
 * @param factor - Scale factor
 * @returns New polygon
 */
export function scalePolygonFromPoint(polygon: Polygon, center: Point, factor: number): Polygon {
  return {
    vertices: polygon.vertices.map(v => ({
      x: center.x + (v.x - center.x) * factor,
      y: center.y + (v.y - center.y) * factor
    }))
  };
}

/**
 * Offsets a polygon by moving each vertex along its angle bisector.
 *
 * **Direction**: Positive = expand outward (for CCW polygons), negative =
 * contract inward. Polygon is normalized to CCW first so direction is consistent.
 *
 * @param polygon - Source polygon
 * @param offset - Distance in feet; sign determines expand/contract
 * @returns New polygon; returns input unchanged if &lt; 3 vertices
 *
 * @remarks
 * Simple vertex-offset approach. Does not handle self-intersections from
 * sharp corners or large offsets. For robust production use (e.g., Minkowski
 * sum, complex shapes), consider Clipper.js or similar.
 */
export function offsetPolygon(polygon: Polygon, offset: number): Polygon {
  const n = polygon.vertices.length;
  if (n < 3) return polygon;

  const ccwPolygon = ensureCounterClockwise(polygon);
  const vertices = ccwPolygon.vertices;
  const newVertices: Point[] = [];

  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];

    // Calculate edge vectors
    const e1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const e2 = { x: next.x - curr.x, y: next.y - curr.y };

    const len1 = Math.sqrt(e1.x * e1.x + e1.y * e1.y);
    const len2 = Math.sqrt(e2.x * e2.x + e2.y * e2.y);

    if (len1 === 0 || len2 === 0) {
      newVertices.push(curr); // Skip degenerate edges
      continue;
    }

    const n1 = { x: e1.x / len1, y: e1.y / len1 };
    const n2 = { x: e2.x / len2, y: e2.y / len2 };

    // Perpendicular (outward for CCW): rotate 90° CCW → (-ny, nx)
    const perp1 = { x: -n1.y, y: n1.x };
    const perp2 = { x: -n2.y, y: n2.x };

    const bisector = {
      x: perp1.x + perp2.x,
      y: perp1.y + perp2.y
    };

    const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

    if (bisectorLen < 0.0001) {
      // Parallel edges: bisector degenerates; use single perpendicular
      newVertices.push({
        x: curr.x + perp1.x * offset,
        y: curr.y + perp1.y * offset
      });
    } else {
      const dot = perp1.x * (bisector.x / bisectorLen) + perp1.y * (bisector.y / bisectorLen);
      const scale = offset / Math.max(dot, 0.0001); // Avoid division by zero

      newVertices.push({
        x: curr.x + (bisector.x / bisectorLen) * scale,
        y: curr.y + (bisector.y / bisectorLen) * scale
      });
    }
  }

  return { vertices: newVertices };
}

/**
 * Checks if a polygon is convex.
 *
 * A polygon is convex iff all turns (cross products of consecutive edges) have
 * the same sign. Zero cross products (collinear vertices) are ignored.
 *
 * @param polygon - Polygon
 * @returns True if convex
 *
 * @remarks
 * Degenerate polygons (n &lt; 3) return false. Self-intersecting polygons
 * may incorrectly report convex if turns happen to align.
 */
export function isConvex(polygon: Polygon): boolean {
  const n = polygon.vertices.length;
  if (n < 3) return false;

  let sign = 0;

  for (let i = 0; i < n; i++) {
    const p1 = polygon.vertices[i];
    const p2 = polygon.vertices[(i + 1) % n];
    const p3 = polygon.vertices[(i + 2) % n];
    // Cross product: turn from p1→p2 to p2→p3
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);

    if (cross !== 0) {
      if (sign === 0) {
        sign = cross > 0 ? 1 : -1;
      } else if ((cross > 0 ? 1 : -1) !== sign) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks if a polygon is a valid axis-aligned or rotated rectangle.
 *
 * Requires exactly 4 vertices. Validates: (1) opposite edges equal length,
 * (2) all interior angles 90° (dot product of adjacent edges ≈ 0).
 *
 * @param polygon - Polygon
 * @param tolerance - Numeric tolerance for length/angle equality (default: 0.01)
 * @returns True if polygon is a rectangle within tolerance
 */
export function isRectangle(polygon: Polygon, tolerance: number = 0.01): boolean {
  if (polygon.vertices.length !== 4) return false;

  const edges = getEdges(polygon);
  const len0 = distance(edges[0].start, edges[0].end);
  const len1 = distance(edges[1].start, edges[1].end);
  const len2 = distance(edges[2].start, edges[2].end);
  const len3 = distance(edges[3].start, edges[3].end);

  const lengthsMatch = Math.abs(len0 - len2) < tolerance && Math.abs(len1 - len3) < tolerance;
  if (!lengthsMatch) return false;

  // Right angles: dot product of adjacent edge vectors ≈ 0
  for (let i = 0; i < 4; i++) {
    const e1 = edges[i];
    const e2 = edges[(i + 1) % 4];

    const v1 = { x: e1.end.x - e1.start.x, y: e1.end.y - e1.start.y };
    const v2 = { x: e2.end.x - e2.start.x, y: e2.end.y - e2.start.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    if (Math.abs(dot) > tolerance * Math.max(len0, len1)) {
      return false;
    }
  }

  return true;
}
