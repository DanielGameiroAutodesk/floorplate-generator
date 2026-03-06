/**
 * Rectangle utility functions
 * Rectangles are axis-aligned (no rotation)
 * Position (x, y) represents the bottom-left corner
 */

import { Rectangle, Point, Polygon, BoundingBox } from '../types/geometry';

/**
 * Creates a new rectangle
 */
export function createRectangle(x: number, y: number, width: number, height: number): Rectangle {
  return { x, y, width, height };
}

/**
 * Creates a rectangle that bounds two arbitrary corner points.
 *
 * Handles any pair of points; result is the minimal AABB containing both.
 *
 * @param p1 - First corner
 * @param p2 - Second corner (can be opposite or same diagonal)
 * @returns Rectangle with (x,y) = (minX, minY), size from min to max
 */
export function rectangleFromCorners(p1: Point, p2: Point): Rectangle {
  const minX = Math.min(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxX = Math.max(p1.x, p2.x);
  const maxY = Math.max(p1.y, p2.y);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Creates a rectangle centered at a given point.
 *
 * @param center - Center point of the rectangle
 * @param width - Total width
 * @param height - Total height
 * @returns Rectangle with center at the given point
 */
export function rectangleCenteredAt(center: Point, width: number, height: number): Rectangle {
  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height
  };
}

/**
 * Calculates the area of a rectangle.
 *
 * @param rect - Rectangle
 * @returns Area in square feet (width × height)
 */
export function rectangleArea(rect: Rectangle): number {
  return rect.width * rect.height;
}

/**
 * Calculates the perimeter of a rectangle.
 *
 * @param rect - Rectangle
 * @returns Perimeter in feet (2 × (width + height))
 */
export function rectanglePerimeter(rect: Rectangle): number {
  return 2 * (rect.width + rect.height);
}

/**
 * Returns the geometric center (centroid) of a rectangle.
 *
 * @param rect - Rectangle
 * @returns Point at (x + width/2, y + height/2)
 */
export function rectangleCenter(rect: Rectangle): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

/**
 * Returns the four corner points of a rectangle (starting from bottom-left, counter-clockwise)
 */
export function rectangleCorners(rect: Rectangle): [Point, Point, Point, Point] {
  return [
    { x: rect.x, y: rect.y },                              // bottom-left
    { x: rect.x + rect.width, y: rect.y },                 // bottom-right
    { x: rect.x + rect.width, y: rect.y + rect.height },   // top-right
    { x: rect.x, y: rect.y + rect.height }                 // top-left
  ];
}

/**
 * Converts a rectangle to a polygon (4 vertices, CCW).
 *
 * @param rect - Rectangle
 * @returns Polygon with vertices from rectangleCorners
 */
export function rectangleToPolygon(rect: Rectangle): Polygon {
  return {
    vertices: rectangleCorners(rect)
  };
}

/**
 * Returns the bounding box of a rectangle.
 *
 * For axis-aligned rectangles this is equivalent to the rectangle extent.
 *
 * @param rect - Rectangle
 * @returns BoundingBox with minX, minY, maxX, maxY
 */
export function rectangleBoundingBox(rect: Rectangle): BoundingBox {
  return {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height
  };
}

/**
 * Checks if a point is inside or on the boundary of a rectangle.
 *
 * Uses closed interval [x, x+width] × [y, y+height].
 *
 * @param rect - Rectangle
 * @param point - Query point
 * @returns True if point lies inside or on the rectangle edges
 */
export function pointInRectangle(rect: Rectangle, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Checks if two rectangles overlap (including shared edges/vertices).
 *
 * Uses the separating-axis test: rects overlap iff they overlap on both X and Y.
 * Touching edges count as overlap.
 *
 * @param rect1 - First rectangle
 * @param rect2 - Second rectangle
 * @returns True if rectangles intersect
 */
export function rectanglesOverlap(rect1: Rectangle, rect2: Rectangle): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  );
}

/**
 * Returns the axis-aligned intersection of two rectangles.
 *
 * @param rect1 - First rectangle
 * @param rect2 - Second rectangle
 * @returns Overlap rectangle, or null if they do not intersect
 */
export function rectangleIntersection(rect1: Rectangle, rect2: Rectangle): Rectangle | null {
  const x = Math.max(rect1.x, rect2.x);
  const y = Math.max(rect1.y, rect2.y);
  const right = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const top = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

  if (right <= x || top <= y) {
    return null;
  }

  return {
    x,
    y,
    width: right - x,
    height: top - y
  };
}

/**
 * Returns the minimal rectangle that contains both rectangles.
 *
 * @param rect1 - First rectangle
 * @param rect2 - Second rectangle
 * @returns Bounding rectangle (union of extents)
 */
export function rectangleUnionBounds(rect1: Rectangle, rect2: Rectangle): Rectangle {
  const minX = Math.min(rect1.x, rect2.x);
  const minY = Math.min(rect1.y, rect2.y);
  const maxX = Math.max(rect1.x + rect1.width, rect2.x + rect2.width);
  const maxY = Math.max(rect1.y + rect1.height, rect2.y + rect2.height);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Expands a rectangle uniformly on all sides.
 *
 * @param rect - Source rectangle
 * @param amount - Expansion in feet (negative to shrink)
 * @returns New rectangle; width and height change by 2×amount
 */
export function expandRectangle(rect: Rectangle, amount: number): Rectangle {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + 2 * amount,
    height: rect.height + 2 * amount
  };
}

/**
 * Expands a rectangle by specified amounts on each side.
 *
 * @param rect - Source rectangle
 * @param left - Expansion left (negative X)
 * @param right - Expansion right (positive X)
 * @param bottom - Expansion downward (negative Y)
 * @param top - Expansion upward (positive Y)
 * @returns New rectangle
 */
export function expandRectangleSides(
  rect: Rectangle,
  left: number,
  right: number,
  bottom: number,
  top: number
): Rectangle {
  return {
    x: rect.x - left,
    y: rect.y - bottom,
    width: rect.width + left + right,
    height: rect.height + bottom + top
  };
}

/**
 * Subdivides a rectangle horizontally into n equal vertical strips.
 *
 * @param rect - Source rectangle
 * @param n - Number of parts (must be > 0)
 * @returns Array of rectangles from left to right
 */
export function subdivideHorizontally(rect: Rectangle, n: number): Rectangle[] {
  if (n <= 0) return [];
  const partWidth = rect.width / n;
  const result: Rectangle[] = [];
  for (let i = 0; i < n; i++) {
    result.push({
      x: rect.x + i * partWidth,
      y: rect.y,
      width: partWidth,
      height: rect.height
    });
  }
  return result;
}

/**
 * Subdivides a rectangle vertically into n equal horizontal bands.
 *
 * @param rect - Source rectangle
 * @param n - Number of parts (must be > 0)
 * @returns Array of rectangles from bottom to top
 */
export function subdivideVertically(rect: Rectangle, n: number): Rectangle[] {
  if (n <= 0) return [];
  const partHeight = rect.height / n;
  const result: Rectangle[] = [];
  for (let i = 0; i < n; i++) {
    result.push({
      x: rect.x,
      y: rect.y + i * partHeight,
      width: rect.width,
      height: partHeight
    });
  }
  return result;
}

/**
 * Subdivides a rectangle horizontally by an array of widths.
 *
 * Slices from left to right. If widths sum to less than rect.width, the last
 * rectangle extends to fill the remainder.
 *
 * @param rect - Source rectangle
 * @param widths - Width of each slice (feet)
 * @returns Array of rectangles
 */
export function subdivideByWidths(rect: Rectangle, widths: number[]): Rectangle[] {
  const result: Rectangle[] = [];
  let currentX = rect.x;

  for (let i = 0; i < widths.length; i++) {
    result.push({
      x: currentX,
      y: rect.y,
      width: widths[i],
      height: rect.height
    });
    currentX += widths[i];
  }

  return result;
}

/**
 * Splits a rectangle into two parts at a given X position.
 *
 * @param rect - Source rectangle
 * @param splitX - X coordinate of split (must be strictly between left and right edges)
 * @returns [left part, right part] or null if splitX is outside bounds
 */
export function splitHorizontallyAt(rect: Rectangle, splitX: number): [Rectangle, Rectangle] | null {
  if (splitX <= rect.x || splitX >= rect.x + rect.width) {
    return null;
  }

  return [
    { x: rect.x, y: rect.y, width: splitX - rect.x, height: rect.height },
    { x: splitX, y: rect.y, width: rect.x + rect.width - splitX, height: rect.height }
  ];
}

/**
 * Splits a rectangle into two parts at a given Y position.
 *
 * @param rect - Source rectangle
 * @param splitY - Y coordinate of split (must be strictly between bottom and top edges)
 * @returns [bottom part, top part] or null if splitY is outside bounds
 */
export function splitVerticallyAt(rect: Rectangle, splitY: number): [Rectangle, Rectangle] | null {
  if (splitY <= rect.y || splitY >= rect.y + rect.height) {
    return null;
  }

  return [
    { x: rect.x, y: rect.y, width: rect.width, height: splitY - rect.y },
    { x: rect.x, y: splitY, width: rect.width, height: rect.y + rect.height - splitY }
  ];
}

/**
 * Translates a rectangle by the given delta.
 *
 * @param rect - Source rectangle
 * @param dx - Horizontal offset
 * @param dy - Vertical offset
 * @returns New rectangle (same size, shifted position)
 */
export function translateRectangle(rect: Rectangle, dx: number, dy: number): Rectangle {
  return {
    x: rect.x + dx,
    y: rect.y + dy,
    width: rect.width,
    height: rect.height
  };
}

/**
 * Returns one edge of a rectangle as a line segment.
 *
 * Edges are oriented: bottom and top run left→right; left and right run bottom→top.
 *
 * @param rect - Rectangle
 * @param edge - Which edge: 'top' | 'bottom' | 'left' | 'right'
 * @returns Line segment { start, end }
 */
export function getRectangleEdge(rect: Rectangle, edge: 'top' | 'bottom' | 'left' | 'right'): { start: Point, end: Point } {
  switch (edge) {
    case 'bottom':
      return { start: { x: rect.x, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y } };
    case 'top':
      return { start: { x: rect.x, y: rect.y + rect.height }, end: { x: rect.x + rect.width, y: rect.y + rect.height } };
    case 'left':
      return { start: { x: rect.x, y: rect.y }, end: { x: rect.x, y: rect.y + rect.height } };
    case 'right':
      return { start: { x: rect.x + rect.width, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y + rect.height } };
  }
}
