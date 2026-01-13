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
 * Calculates the perimeter of a polygon
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
 * Calculates the signed area of a polygon using the Shoelace formula
 * Positive = counter-clockwise, Negative = clockwise
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
 * Calculates the absolute area of a polygon
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
 * Determines if polygon vertices are in counter-clockwise order
 */
export function isCounterClockwise(polygon: Polygon): boolean {
  return signedArea(polygon) > 0;
}

/**
 * Reverses the winding order of a polygon
 */
export function reverseWinding(polygon: Polygon): Polygon {
  return { vertices: [...polygon.vertices].reverse() };
}

/**
 * Ensures polygon is in counter-clockwise order
 */
export function ensureCounterClockwise(polygon: Polygon): Polygon {
  return isClockwise(polygon) ? reverseWinding(polygon) : polygon;
}

/**
 * Calculates the centroid (center of mass) of a polygon
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
  const factor = 1 / (6 * area);

  return {
    x: cx * factor,
    y: cy * factor
  };
}

/**
 * Calculates the bounding box of a polygon
 */
export function polygonBoundingBox(polygon: Polygon): BoundingBox {
  if (polygon.vertices.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
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
 * Returns the width of a polygon's bounding box
 */
export function polygonWidth(polygon: Polygon): number {
  const bb = polygonBoundingBox(polygon);
  return bb.maxX - bb.minX;
}

/**
 * Returns the height of a polygon's bounding box
 */
export function polygonHeight(polygon: Polygon): number {
  const bb = polygonBoundingBox(polygon);
  return bb.maxY - bb.minY;
}

/**
 * Tests if a point is inside a polygon using ray casting
 */
export function pointInPolygon(polygon: Polygon, point: Point): boolean {
  const n = polygon.vertices.length;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon.vertices[i].x, yi = polygon.vertices[i].y;
    const xj = polygon.vertices[j].x, yj = polygon.vertices[j].y;

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Translates all vertices of a polygon by dx, dy
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
 * Scales a polygon from its centroid
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
 * Scales a polygon from a given center point
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
 * Simple polygon offset (expand/contract)
 * Positive offset = expand outward, Negative = contract inward
 * Note: This is a simple implementation that may not handle all edge cases
 * For production use, consider using a library like Clipper.js
 */
export function offsetPolygon(polygon: Polygon, offset: number): Polygon {
  const n = polygon.vertices.length;
  if (n < 3) return polygon;

  // Ensure counter-clockwise for consistent offset direction
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

    // Normalize
    const len1 = Math.sqrt(e1.x * e1.x + e1.y * e1.y);
    const len2 = Math.sqrt(e2.x * e2.x + e2.y * e2.y);

    if (len1 === 0 || len2 === 0) {
      newVertices.push(curr);
      continue;
    }

    const n1 = { x: e1.x / len1, y: e1.y / len1 };
    const n2 = { x: e2.x / len2, y: e2.y / len2 };

    // Calculate perpendicular (outward) normals
    const perp1 = { x: -n1.y, y: n1.x };
    const perp2 = { x: -n2.y, y: n2.x };

    // Bisector direction
    const bisector = {
      x: perp1.x + perp2.x,
      y: perp1.y + perp2.y
    };

    const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);

    if (bisectorLen < 0.0001) {
      // Edges are parallel, just offset perpendicular
      newVertices.push({
        x: curr.x + perp1.x * offset,
        y: curr.y + perp1.y * offset
      });
    } else {
      // Calculate how much to move along bisector
      const dot = perp1.x * (bisector.x / bisectorLen) + perp1.y * (bisector.y / bisectorLen);
      const scale = offset / Math.max(dot, 0.0001);

      newVertices.push({
        x: curr.x + (bisector.x / bisectorLen) * scale,
        y: curr.y + (bisector.y / bisectorLen) * scale
      });
    }
  }

  return { vertices: newVertices };
}

/**
 * Checks if a polygon is convex
 */
export function isConvex(polygon: Polygon): boolean {
  const n = polygon.vertices.length;
  if (n < 3) return false;

  let sign = 0;

  for (let i = 0; i < n; i++) {
    const p1 = polygon.vertices[i];
    const p2 = polygon.vertices[(i + 1) % n];
    const p3 = polygon.vertices[(i + 2) % n];

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
 * Checks if a polygon is a valid rectangle (4 vertices, all right angles)
 */
export function isRectangle(polygon: Polygon, tolerance: number = 0.01): boolean {
  if (polygon.vertices.length !== 4) return false;

  const edges = getEdges(polygon);

  // Check that opposite edges are parallel and equal length
  const len0 = distance(edges[0].start, edges[0].end);
  const len1 = distance(edges[1].start, edges[1].end);
  const len2 = distance(edges[2].start, edges[2].end);
  const len3 = distance(edges[3].start, edges[3].end);

  const lengthsMatch = Math.abs(len0 - len2) < tolerance && Math.abs(len1 - len3) < tolerance;
  if (!lengthsMatch) return false;

  // Check for right angles (dot product of adjacent edges should be ~0)
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
