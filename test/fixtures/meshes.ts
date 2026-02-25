/**
 * Test Fixtures - Synthetic Triangle Meshes
 *
 * Float32Array meshes for testing footprint polygon extraction.
 * Each mesh is a closed 3D solid extruded from a 2D polygon.
 * Format: [x1,y1,z1, x2,y2,z2, x3,y3,z3, ...] (9 floats per triangle)
 * Ground level: z=0, Top level: z=10
 */

/**
 * Helper: triangulate a 2D polygon (fan triangulation from vertex 0)
 * and produce both ground and top faces.
 */
function buildExtrudedMesh(vertices: { x: number; y: number }[], height: number = 10): Float32Array {
  const n = vertices.length;
  const tris: number[] = [];

  // Ground face (z=0): fan from vertex 0, clockwise for correct outward normals
  for (let i = 1; i < n - 1; i++) {
    tris.push(
      vertices[0].x, vertices[0].y, 0,
      vertices[i + 1].x, vertices[i + 1].y, 0,
      vertices[i].x, vertices[i].y, 0
    );
  }

  // Top face (z=height): fan from vertex 0, counter-clockwise
  for (let i = 1; i < n - 1; i++) {
    tris.push(
      vertices[0].x, vertices[0].y, height,
      vertices[i].x, vertices[i].y, height,
      vertices[i + 1].x, vertices[i + 1].y, height
    );
  }

  // Side faces: 2 triangles per edge
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = vertices[i].x, ay = vertices[i].y;
    const bx = vertices[j].x, by = vertices[j].y;

    // Triangle 1
    tris.push(ax, ay, 0, bx, by, 0, bx, by, height);
    // Triangle 2
    tris.push(ax, ay, 0, bx, by, height, ax, ay, height);
  }

  return new Float32Array(tris);
}

/**
 * Rectangular bar building: 60m × 20m
 */
export const RECTANGLE_TRIANGLES: Float32Array = buildExtrudedMesh([
  { x: 0, y: 0 },
  { x: 60, y: 0 },
  { x: 60, y: 20 },
  { x: 0, y: 20 }
]);

/**
 * L-shaped building mesh
 * Wing 1: 60m × 20m horizontal section
 * Wing 2: 20m × 30m additional vertical section
 *
 * Polygon vertices (CCW):
 *   (0,0) → (60,0) → (60,20) → (20,20) → (20,50) → (0,50)
 */
export const L_SHAPE_TRIANGLES: Float32Array = buildExtrudedMesh([
  { x: 0, y: 0 },
  { x: 60, y: 0 },
  { x: 60, y: 20 },
  { x: 20, y: 20 },
  { x: 20, y: 50 },
  { x: 0, y: 50 }
]);

/**
 * U-shaped building mesh
 * 8 vertices, 2 concave corners
 */
export const U_SHAPE_TRIANGLES: Float32Array = buildExtrudedMesh([
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 50, y: 40 },
  { x: 40, y: 40 },
  { x: 40, y: 20 },
  { x: 10, y: 20 },
  { x: 10, y: 40 },
  { x: 0, y: 40 }
]);

/**
 * Mesh with micro-jitter to test vertex welding robustness.
 * Same L-shape as above but with ±0.0001 noise on some vertices.
 */
export const NOISY_L_SHAPE_TRIANGLES: Float32Array = (() => {
  // Build the L-shape, then add tiny noise to some vertices
  const base = buildExtrudedMesh([
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    { x: 60, y: 20 },
    { x: 20, y: 20 },
    { x: 20, y: 50 },
    { x: 0, y: 50 }
  ]);

  // Add micro-jitter to every other vertex position
  const noisy = new Float32Array(base);
  for (let i = 0; i < noisy.length; i += 9) {
    // Add 0.00005 noise to first vertex of each triangle (within welding epsilon of 0.001)
    noisy[i] += 0.00005;
    noisy[i + 1] += 0.00005;
  }
  return noisy;
})();
