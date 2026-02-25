/**
 * Test Fixtures - Multi-Wing Building Polygons
 *
 * Pre-defined polygon vertices for testing wing detection and multi-wing generation.
 * All polygons are in counter-clockwise winding order.
 * All dimensions are in meters.
 */

export interface TestPolygon {
  vertices: { x: number; y: number }[];
  description: string;
  expectedArea: number;
  expectedWingCount: number;
  expectedConcaveCount: number;
}

/**
 * Simple rectangular bar building — 60m × 20m (≈197ft × 66ft)
 * 4 vertices, all convex, 1 wing, isSimpleBar = true
 */
export const BAR_POLYGON: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 60, y: 0 },
  { x: 60, y: 20 },
  { x: 0, y: 20 }
];

/**
 * L-shaped building — 2 wings meeting at 1 inner corner
 * Wing 1 (horizontal): 60m long × 20m wide
 * Wing 2 (vertical): 20m wide × 50m total — starts at x=0, but the
 * overlap zone (20m × 20m) is shared with Wing 1.
 * Net Wing 2 length = 50 - 20 = 30m
 *
 * Vertices in CCW order:
 *   (0,0) → (60,0) → (60,20) → (20,20) → (20,50) → (0,50)
 *
 * Concave corner: (20,20) — interior angle > 180°
 * Convex corners: the other 5 vertices
 */
export const L_POLYGON: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 60, y: 0 },
  { x: 60, y: 20 },
  { x: 20, y: 20 },
  { x: 20, y: 50 },
  { x: 0, y: 50 }
];
// Area = 60×20 + 20×30 = 1200 + 600 = 1800 m²

/**
 * U-shaped building — 3 wings, 2 inner corners
 * Base wing (horizontal): 50m × 20m wide
 * Left wing (vertical): 10m wide × 20m tall (net, above base)
 * Right wing (vertical): 10m wide × 20m tall (net, above base)
 *
 * Vertices in CCW order (8 vertices):
 *   (0,0) → (50,0) → (50,40) → (40,40) → (40,20) → (10,20) → (10,40) → (0,40)
 *
 * Concave corners: (40,40) and (10,40) — wait, let me recalculate.
 * Actually concave corners are at (40,20) and (10,20).
 */
export const U_POLYGON: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 50, y: 40 },
  { x: 40, y: 40 },
  { x: 40, y: 20 },
  { x: 10, y: 20 },
  { x: 10, y: 40 },
  { x: 0, y: 40 }
];
// Area = 50×20 + 10×20 + 10×20 = 1000 + 200 + 200 = 1400 m²

/**
 * H-shaped building — simplified as 3 rectangles
 * Left bar: 15m × 40m
 * Right bar: 15m × 40m
 * Connector: 20m × 10m (at middle height)
 *
 * 12 vertices, 4 concave corners
 */
export const H_POLYGON: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 15, y: 0 },
  { x: 15, y: 15 },
  { x: 35, y: 15 },
  { x: 35, y: 0 },
  { x: 50, y: 0 },
  { x: 50, y: 40 },
  { x: 35, y: 40 },
  { x: 35, y: 25 },
  { x: 15, y: 25 },
  { x: 15, y: 40 },
  { x: 0, y: 40 }
];
// Concave corners: (15,15), (35,15), (35,25), (15,25)

/**
 * C-shaped building — 3 wings, 2 inner corners (like U rotated 90°)
 * Wing 1 (horizontal top): 60m × 20m
 * Wing 2 (vertical left): 20m × 40m (net after overlap)
 * Wing 3 (horizontal bottom): 60m × 20m
 *
 * The middle wing (vertical left) participates in two intersections.
 *
 * Vertices in CCW order (8 vertices):
 *   (0,0) → (60,0) → (60,20) → (20,20) → (20,60) → (60,60) → (60,80) → (0,80)
 *
 * Concave corners: (20,20) and (20,60)
 */
export const C_POLYGON: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 60, y: 0 },
  { x: 60, y: 20 },
  { x: 20, y: 20 },
  { x: 20, y: 60 },
  { x: 60, y: 60 },
  { x: 60, y: 80 },
  { x: 0, y: 80 }
];
// Area = 60×20 + 20×40 + 60×20 = 1200 + 800 + 1200 = 3200 m²
