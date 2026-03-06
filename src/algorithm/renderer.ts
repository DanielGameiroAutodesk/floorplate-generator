/**
 * Floorplate Generator - Renderer
 * Converts FloorPlanData to Forma mesh data
 *
 * Handles transformation from local coordinates (building-aligned)
 * to world coordinates (Forma scene).
 */

import { FloorPlanData, UnitBlock, CoreBlock, CorridorBlock, FillerBlock, UnitType } from './types';
import { UNIT_COLORS } from './constants';

/**
 * Mesh data for Forma.render.addMesh
 */
export interface FormaMeshData {
  positions: Float32Array;
  colors: Uint8Array;
}

/**
 * Transform a point from local (building) coordinates to world coordinates
 */
function transformPoint(
  localX: number,
  localY: number,
  centerX: number,
  centerY: number,
  rotation: number
): { x: number; y: number } {
  // Rotate around origin
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  const rotatedX = localX * cosR - localY * sinR;
  const rotatedY = localX * sinR + localY * cosR;

  // Translate to world position
  return {
    x: rotatedX + centerX,
    y: rotatedY + centerY
  };
}

/**
 * Parse hex color string to RGBA object
 */
function parseHexColor(hex: string): { r: number; g: number; b: number; a: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: 200  // Default alpha
    };
  }
  return { r: 128, g: 128, b: 128, a: 200 };  // Fallback gray
}

/**
 * Create a rectangle mesh (2 triangles) with transformation
 */
function createRectangleMesh(
  x: number,
  y: number,
  width: number,
  depth: number,
  z: number,
  color: { r: number; g: number; b: number; a: number },
  transform: { centerX: number; centerY: number; rotation: number }
): { positions: number[]; colors: number[] } {
  // Define corners in local coordinates
  const corners = [
    { x, y },                         // bottom-left
    { x: x + width, y },              // bottom-right
    { x: x + width, y: y + depth },   // top-right
    { x, y: y + depth }               // top-left
  ];

  // Transform all corners to world coordinates
  const worldCorners = corners.map(c =>
    transformPoint(c.x, c.y, transform.centerX, transform.centerY, transform.rotation)
  );

  // 6 vertices (2 triangles)
  const positions = [
    // Triangle 1: bottom-left, bottom-right, top-right
    worldCorners[0].x, worldCorners[0].y, z,
    worldCorners[1].x, worldCorners[1].y, z,
    worldCorners[2].x, worldCorners[2].y, z,
    // Triangle 2: bottom-left, top-right, top-left
    worldCorners[0].x, worldCorners[0].y, z,
    worldCorners[2].x, worldCorners[2].y, z,
    worldCorners[3].x, worldCorners[3].y, z
  ];

  // 6 vertices * 4 color components
  const colors: number[] = [];
  for (let i = 0; i < 6; i++) {
    colors.push(color.r, color.g, color.b, color.a);
  }

  return { positions, colors };
}

/**
 * Decompose an L-shaped polygon into triangles.
 *
 * WHY NOT USE SIMPLE FAN TRIANGULATION?
 * L-shapes are concave polygons. Simple fan triangulation (connecting all vertices
 * to a center point) creates triangles that extend OUTSIDE the polygon boundary,
 * causing visual artifacts where neighboring units appear to overlap.
 *
 * Instead, we decompose the L into two convex quads (rectangles) which can each
 * be safely triangulated. This produces clean, non-overlapping geometry.
 */

function triangulate7PointLShape(
  points: { x: number; y: number }[],
  z: number,
  color: { r: number; g: number; b: number; a: number },
  transform: { centerX: number; centerY: number; rotation: number }
): { positions: number[]; colors: number[] } {
  const positions: number[] = [];
  const colors: number[] = [];

  const wp = points.map(p =>
    transformPoint(p.x, p.y, transform.centerX, transform.centerY, transform.rotation)
  );

  // 7 points: 0=outer, 1=legA-out, 2=legA-in, 3a=chamferA, 3b=chamferB, 4=legB-in, 5=legB-out
  // Decompose into:
  // Quad A: 0, 1, 2, 3
  // Triangle Foyer: 0, 3, 4
  // Quad B: 0, 4, 5, 6

  // Helper to push triangle
  const pushTri = (a: number, b: number, c: number) => {
    positions.push(
      wp[a].x, wp[a].y, z,
      wp[b].x, wp[b].y, z,
      wp[c].x, wp[c].y, z
    );
    colors.push(
      color.r, color.g, color.b, color.a,
      color.r, color.g, color.b, color.a,
      color.r, color.g, color.b, color.a
    );
  };

  pushTri(0, 1, 2);
  pushTri(0, 2, 3);
  pushTri(0, 3, 4);
  pushTri(0, 4, 5);
  pushTri(0, 5, 6);

  return { positions, colors };
}

function triangulateLShape(
  points: { x: number; y: number }[],
  z: number,
  color: { r: number; g: number; b: number; a: number },
  transform: { centerX: number; centerY: number; rotation: number }
): { positions: number[]; colors: number[] } {
  if (points.length !== 6) {
    // Fallback to simple fan for non-L shapes
    return triangulateConvex(points, z, color, transform);
  }

  const positions: number[] = [];
  const colors: number[] = [];

  // L-shape has 6 points. We decompose into two quads:
  // Quad 1: points 0, 1, 2, 3 (main body)
  // Quad 2: points 0, 3, 4, 5 (the leg extending through corridor)

  // Transform all points to world coordinates
  const wp = points.map(p =>
    transformPoint(p.x, p.y, transform.centerX, transform.centerY, transform.rotation)
  );

  // Quad 1: 0-1-2-3 (two triangles: 0-1-2 and 0-2-3)
  positions.push(
    wp[0].x, wp[0].y, z, wp[1].x, wp[1].y, z, wp[2].x, wp[2].y, z,
    wp[0].x, wp[0].y, z, wp[2].x, wp[2].y, z, wp[3].x, wp[3].y, z
  );

  // Quad 2: 0-3-4-5 (two triangles: 0-3-4 and 0-4-5)
  positions.push(
    wp[0].x, wp[0].y, z, wp[3].x, wp[3].y, z, wp[4].x, wp[4].y, z,
    wp[0].x, wp[0].y, z, wp[4].x, wp[4].y, z, wp[5].x, wp[5].y, z
  );

  // 12 vertices total (4 triangles)
  for (let i = 0; i < 12; i++) {
    colors.push(color.r, color.g, color.b, color.a);
  }

  return { positions, colors };
}

/**
 * Simple fan triangulation for convex polygons
 */
function triangulateConvex(
  points: { x: number; y: number }[],
  z: number,
  color: { r: number; g: number; b: number; a: number },
  transform: { centerX: number; centerY: number; rotation: number }
): { positions: number[]; colors: number[] } {
  if (points.length < 3) {
    return { positions: [], colors: [] };
  }

  const worldPoints = points.map(p =>
    transformPoint(p.x, p.y, transform.centerX, transform.centerY, transform.rotation)
  );

  const positions: number[] = [];
  const colors: number[] = [];

  for (let i = 1; i < worldPoints.length - 1; i++) {
    positions.push(
      worldPoints[0].x, worldPoints[0].y, z,
      worldPoints[i].x, worldPoints[i].y, z,
      worldPoints[i + 1].x, worldPoints[i + 1].y, z
    );
    colors.push(
      color.r, color.g, color.b, color.a,
      color.r, color.g, color.b, color.a,
      color.r, color.g, color.b, color.a
    );
  }

  return { positions, colors };
}

/**
 * Point-in-triangle test using barycentric coordinates.
 */
function pointInTriangle(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): boolean {
  const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Ear-clipping triangulation for arbitrary simple (non-self-intersecting) polygons.
 *
 * Handles both convex and concave polygons correctly. For convex polygons,
 * this is equivalent to fan triangulation. For concave polygons (like L-shaped
 * corridor wedges and inner cores), it produces correct non-overlapping triangles.
 *
 * Algorithm:
 * 1. Determine polygon winding order (CW/CCW)
 * 2. Find an "ear" vertex: convex, and the ear triangle contains no other vertices
 * 3. Clip the ear (emit triangle, remove vertex)
 * 4. Repeat until only a triangle remains
 */
function triangulatePolygon(
  points: { x: number; y: number }[],
  z: number,
  color: { r: number; g: number; b: number; a: number },
  transform: { centerX: number; centerY: number; rotation: number }
): { positions: number[]; colors: number[] } {
  const n = points.length;
  if (n < 3) return { positions: [], colors: [] };

  // Transform all points to world coordinates
  const wp = points.map(p =>
    transformPoint(p.x, p.y, transform.centerX, transform.centerY, transform.rotation)
  );

  if (n === 3) {
    return {
      positions: [wp[0].x, wp[0].y, z, wp[1].x, wp[1].y, z, wp[2].x, wp[2].y, z],
      colors: [
        color.r, color.g, color.b, color.a,
        color.r, color.g, color.b, color.a,
        color.r, color.g, color.b, color.a
      ]
    };
  }

  // For 4-point polygons (quads), fan triangulation is always valid
  if (n === 4) {
    const positions: number[] = [];
    const colors: number[] = [];
    for (let i = 1; i < n - 1; i++) {
      positions.push(wp[0].x, wp[0].y, z, wp[i].x, wp[i].y, z, wp[i + 1].x, wp[i + 1].y, z);
      colors.push(color.r, color.g, color.b, color.a, color.r, color.g, color.b, color.a, color.r, color.g, color.b, color.a);
    }
    return { positions, colors };
  }

  // Determine winding order
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    signedArea += wp[i].x * wp[j].y - wp[j].x * wp[i].y;
  }
  const isCCW = signedArea > 0;

  // Ear clipping
  const indices: number[] = [];
  for (let i = 0; i < n; i++) indices.push(i);

  const positions: number[] = [];
  const colors: number[] = [];

  let safety = n * n;
  while (indices.length > 3 && safety-- > 0) {
    let earFound = false;
    const m = indices.length;

    for (let i = 0; i < m; i++) {
      const prevIdx = indices[(i - 1 + m) % m];
      const currIdx = indices[i];
      const nextIdx = indices[(i + 1) % m];

      const prev = wp[prevIdx];
      const curr = wp[currIdx];
      const next = wp[nextIdx];

      // Check if vertex is convex (ear candidate)
      const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
      const isConvex = isCCW ? cross >= 0 : cross <= 0;

      if (!isConvex) continue;

      // Check if any other vertex lies inside the ear triangle
      let containsVertex = false;
      for (let j = 0; j < m; j++) {
        if (j === (i - 1 + m) % m || j === i || j === (i + 1) % m) continue;
        if (pointInTriangle(wp[indices[j]], prev, curr, next)) {
          containsVertex = true;
          break;
        }
      }

      if (!containsVertex) {
        // Clip this ear
        positions.push(prev.x, prev.y, z, curr.x, curr.y, z, next.x, next.y, z);
        colors.push(
          color.r, color.g, color.b, color.a,
          color.r, color.g, color.b, color.a,
          color.r, color.g, color.b, color.a
        );
        indices.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) break; // Degenerate polygon
  }

  // Final triangle
  if (indices.length === 3) {
    positions.push(
      wp[indices[0]].x, wp[indices[0]].y, z,
      wp[indices[1]].x, wp[indices[1]].y, z,
      wp[indices[2]].x, wp[indices[2]].y, z
    );
    colors.push(
      color.r, color.g, color.b, color.a,
      color.r, color.g, color.b, color.a,
      color.r, color.g, color.b, color.a
    );
  }


  return { positions, colors };
}

/**
 * Create mesh for a unit (rectangle or L-shaped polygon)
 */
function createUnitMesh(
  unit: UnitBlock,
  z: number,
  color: { r: number; g: number; b: number; a: number },
  transform: { centerX: number; centerY: number; rotation: number }
): { positions: number[]; colors: number[] } {
  if (unit.polyPoints && unit.polyPoints.length >= 3) {
    // L-shaped or polygon unit — use ear-clipping for all polygon shapes
    if (unit.isLShaped && unit.polyPoints.length === 6) {
      return triangulateLShape(unit.polyPoints, z, color, transform);
    } else if (unit.isLShaped && unit.polyPoints.length === 7) {
      return triangulate7PointLShape(unit.polyPoints, z, color, transform);
    } else {
      return triangulatePolygon(unit.polyPoints, z, color, transform);
    }
  } else {
    // Simple rectangle
    return createRectangleMesh(unit.x, unit.y, unit.width, unit.depth, z, color, transform);
  }
}

/**
 * Transform parameters for rendering
 */
type Transform = { centerX: number; centerY: number; rotation: number };

// Border color (dark gray/black for visibility)
const BORDER_COLOR = { r: 30, g: 30, b: 30, a: 255 };
const BORDER_WIDTH = 0.15; // meters (~6 inches)

/**
 * Create border lines for a rectangle
 */
function createRectangleBorders(
  x: number,
  y: number,
  width: number,
  depth: number,
  z: number,
  transform: Transform
): { positions: number[]; colors: number[] } {
  const positions: number[] = [];
  const colors: number[] = [];
  const bw = BORDER_WIDTH;

  // Four border rectangles: bottom, top, left, right
  const borders = [
    // Bottom border
    { x, y, w: width, d: bw },
    // Top border
    { x, y: y + depth - bw, w: width, d: bw },
    // Left border
    { x, y: y + bw, w: bw, d: depth - 2 * bw },
    // Right border
    { x: x + width - bw, y: y + bw, w: bw, d: depth - 2 * bw }
  ];

  borders.forEach(b => {
    const { positions: p, colors: c } = createRectangleMesh(
      b.x, b.y, b.w, b.d, z, BORDER_COLOR, transform
    );
    positions.push(...p);
    colors.push(...c);
  });

  return { positions, colors };
}

/**
 * Create border lines for a polygon (L-shape or other)
 */
function createPolygonBorders(
  points: { x: number; y: number }[],
  z: number,
  transform: Transform
): { positions: number[]; colors: number[] } {
  const positions: number[] = [];
  const colors: number[] = [];
  const bw = BORDER_WIDTH;

  // Create thin rectangles along each edge of the polygon
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    // Calculate edge direction and perpendicular
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) continue;

    // Normalize and get perpendicular (inward)
    const nx = -dy / len;
    const ny = dx / len;

    // Create a thin quad along the edge (on the inside)
    const corners = [
      { x: p1.x, y: p1.y },
      { x: p2.x, y: p2.y },
      { x: p2.x + nx * bw, y: p2.y + ny * bw },
      { x: p1.x + nx * bw, y: p1.y + ny * bw }
    ];

    const worldCorners = corners.map(c =>
      transformPoint(c.x, c.y, transform.centerX, transform.centerY, transform.rotation)
    );

    // Two triangles for the quad
    positions.push(
      worldCorners[0].x, worldCorners[0].y, z,
      worldCorners[1].x, worldCorners[1].y, z,
      worldCorners[2].x, worldCorners[2].y, z,
      worldCorners[0].x, worldCorners[0].y, z,
      worldCorners[2].x, worldCorners[2].y, z,
      worldCorners[3].x, worldCorners[3].y, z
    );

    for (let j = 0; j < 6; j++) {
      colors.push(BORDER_COLOR.r, BORDER_COLOR.g, BORDER_COLOR.b, BORDER_COLOR.a);
    }
  }

  return { positions, colors };
}

/**
 * Create borders for a unit
 */
function createUnitBorders(
  unit: UnitBlock,
  z: number,
  transform: Transform
): { positions: number[]; colors: number[] } {
  if (unit.polyPoints && unit.polyPoints.length >= 3) {
    return createPolygonBorders(unit.polyPoints, z, transform);
  } else {
    return createRectangleBorders(unit.x, unit.y, unit.width, unit.depth, z, transform);
  }
}

/**
 * Render all units to mesh data (fills only)
 */
function renderUnitFills(units: UnitBlock[], elevation: number, transform: Transform): FormaMeshData {
  const allPositions: number[] = [];
  const allColors: number[] = [];

  units.forEach(unit => {
    // Parse color from unit.color hex string, fallback to legacy UNIT_COLORS lookup
    const color = unit.color
      ? parseHexColor(unit.color)
      : (unit.type ? UNIT_COLORS[unit.type] : { r: 128, g: 128, b: 128, a: 200 });
    const { positions, colors } = createUnitMesh(unit, elevation, color, transform);
    allPositions.push(...positions);
    allColors.push(...colors);
  });

  return {
    positions: new Float32Array(allPositions),
    colors: new Uint8Array(allColors)
  };
}

/**
 * Render unit borders to mesh data
 */
function renderUnitBorders(units: UnitBlock[], elevation: number, transform: Transform): FormaMeshData {
  const allPositions: number[] = [];
  const allColors: number[] = [];

  units.forEach(unit => {
    const { positions, colors } = createUnitBorders(unit, elevation, transform);
    allPositions.push(...positions);
    allColors.push(...colors);
  });

  return {
    positions: new Float32Array(allPositions),
    colors: new Uint8Array(allColors)
  };
}

/**
 * Render all cores to mesh data
 */
function renderCores(cores: CoreBlock[], elevation: number, transform: Transform): FormaMeshData {
  const allPositions: number[] = [];
  const allColors: number[] = [];
  const color = UNIT_COLORS['Core'];

  cores.forEach(core => {
    const { positions, colors } = core.polyPoints && core.polyPoints.length >= 3
      ? triangulatePolygon(core.polyPoints, elevation, color, transform)
      : createRectangleMesh(core.x, core.y, core.width, core.depth, elevation, color, transform);
    allPositions.push(...positions);
    allColors.push(...colors);
  });

  return {
    positions: new Float32Array(allPositions),
    colors: new Uint8Array(allColors)
  };
}

/**
 * Convert fillers into core-like render blocks so uncovered footprint areas
 * are still visible in both 3D and 2D outputs.
 */
function fillersToCoreBlocks(fillers: FillerBlock[]): CoreBlock[] {
  return fillers.map((filler, idx) => ({
    id: filler.id || `filler-${idx}`,
    x: filler.x,
    y: filler.y,
    width: filler.width,
    depth: filler.depth,
    type: 'Mid',
    side: filler.side,
    polyPoints: filler.polyPoints
  }));
}

/**
 * Render corridor to mesh data
 */
function renderCorridor(corridor: CorridorBlock, elevation: number, transform: Transform): FormaMeshData {
  const color = UNIT_COLORS['Corridor'];
  let signedArea = 0;
  if (corridor.polyPoints && corridor.polyPoints.length >= 3) {
    for (let i = 0; i < corridor.polyPoints.length; i++) {
      const a = corridor.polyPoints[i];
      const b = corridor.polyPoints[(i + 1) % corridor.polyPoints.length];
      signedArea += a.x * b.y - b.x * a.y;
    }
  }
  const corridorPolyForRender =
    corridor.polyPoints && corridor.polyPoints.length >= 3 && signedArea < 0
      ? [...corridor.polyPoints].reverse()
      : corridor.polyPoints;
  const { positions, colors } = corridorPolyForRender && corridorPolyForRender.length >= 3
    ? triangulatePolygon(corridorPolyForRender, elevation, color, transform)
    : createRectangleMesh(corridor.x, corridor.y, corridor.width, corridor.depth, elevation, color, transform);

  return {
    positions: new Float32Array(positions),
    colors: new Uint8Array(colors)
  };
}

/**
 * Combine multiple FormaMeshData objects into one by concatenating arrays.
 */
function combineMeshes(meshes: FormaMeshData[]): FormaMeshData {
  if (meshes.length === 0) {
    return { positions: new Float32Array(0), colors: new Uint8Array(0) };
  }
  if (meshes.length === 1) return meshes[0];
  const totalPos = meshes.reduce((s, m) => s + m.positions.length, 0);
  const totalCol = meshes.reduce((s, m) => s + m.colors.length, 0);
  const positions = new Float32Array(totalPos);
  const colors = new Uint8Array(totalCol);
  let posOff = 0, colOff = 0;
  for (const m of meshes) {
    positions.set(m.positions, posOff);
    colors.set(m.colors, colOff);
    posOff += m.positions.length;
    colOff += m.colors.length;
  }
  return { positions, colors };
}

/**
 * Converts a FloorPlanData object into Forma-compatible mesh data for 3D rendering.
 *
 * Transforms all floorplate elements (corridor, cores, units) from local building
 * coordinates to world coordinates using the floorplan's transform data. Creates
 * triangle meshes with per-vertex colors that can be rendered directly in Forma.
 *
 * **Rendering layers (bottom to top):**
 * 1. Corridor (gray) - base layer
 * 2. Cores (dark gray) - +0.1m elevation
 * 3. Unit fills (colored by type) - +0.2m elevation
 * 4. Unit borders (dark outlines) - +0.3m elevation
 *
 * WHY elevation offsets? Without them, overlapping surfaces cause z-fighting
 * (flickering) as WebGL can't determine which surface is "on top". The 0.1m
 * gaps are imperceptible but eliminate z-fighting completely.
 *
 * @param floorplan - Generated floorplan data from `generateFloorplate()`.
 *                    Must include transform data for coordinate conversion.
 * @param elevationOffset - Height above floor to render the floorplate.
 *                          Default 0.5m prevents z-fighting with the building floor.
 * @returns FormaMeshData containing:
 *          - `positions`: Float32Array of vertex positions [x,y,z, x,y,z, ...]
 *          - `colors`: Uint8Array of vertex colors [r,g,b,a, r,g,b,a, ...]
 *
 * @example
 * ```typescript
 * const floorplan = generateFloorplate(footprint, config, egressConfig);
 * const meshData = renderFloorplate(floorplan);
 *
 * // Add to Forma's 3D view
 * await Forma.render.addMesh({
 *   geometryData: {
 *     position: meshData.positions,
 *     color: meshData.colors
 *   }
 * });
 * ```
 */
export function renderFloorplate(floorplan: FloorPlanData, elevationOffset: number = 0.5): FormaMeshData {
  const elevation = floorplan.floorElevation + elevationOffset;
  const transform = floorplan.transform;
  const fillerCores = fillersToCoreBlocks(floorplan.fillers ?? []);
  const allCores = [...floorplan.cores, ...fillerCores];

  // Render corridor(s) first (bottom layer)
  // For multi-wing buildings, render each corridor segment separately
  const corridorMesh = floorplan.corridorSegments && floorplan.corridorSegments.length > 0
    ? combineMeshes(floorplan.corridorSegments.map(seg => renderCorridor(seg, elevation, transform)))
    : renderCorridor(floorplan.corridor, elevation, transform);

  // Render cores
  const coresMesh = renderCores(allCores, elevation + 0.1, transform);

  // Render unit fills
  const unitFillsMesh = renderUnitFills(floorplan.units, elevation + 0.2, transform);

  // Render unit borders on top
  const unitBordersMesh = renderUnitBorders(floorplan.units, elevation + 0.3, transform);

  // Combine all meshes
  const totalVertices =
    corridorMesh.positions.length / 3 +
    coresMesh.positions.length / 3 +
    unitFillsMesh.positions.length / 3 +
    unitBordersMesh.positions.length / 3;

  const combinedPositions = new Float32Array(totalVertices * 3);
  const combinedColors = new Uint8Array(totalVertices * 4);

  let posOffset = 0;
  let colorOffset = 0;

  // Add corridor
  combinedPositions.set(corridorMesh.positions, posOffset);
  combinedColors.set(corridorMesh.colors, colorOffset);
  posOffset += corridorMesh.positions.length;
  colorOffset += corridorMesh.colors.length;

  // Add cores
  combinedPositions.set(coresMesh.positions, posOffset);
  combinedColors.set(coresMesh.colors, colorOffset);
  posOffset += coresMesh.positions.length;
  colorOffset += coresMesh.colors.length;

  // Add unit fills
  combinedPositions.set(unitFillsMesh.positions, posOffset);
  combinedColors.set(unitFillsMesh.colors, colorOffset);
  posOffset += unitFillsMesh.positions.length;
  colorOffset += unitFillsMesh.colors.length;

  // Add unit borders
  combinedPositions.set(unitBordersMesh.positions, posOffset);
  combinedColors.set(unitBordersMesh.colors, colorOffset);

  return {
    positions: combinedPositions,
    colors: combinedColors
  };
}

/**
 * Renders floorplate elements as separate mesh layers.
 *
 * Useful for debugging or when you need selective rendering control.
 * Returns each layer (corridor, cores, units, borders) as independent
 * mesh data that can be rendered, hidden, or styled separately.
 *
 * @param floorplan - Generated floorplan data from `generateFloorplate()`.
 * @param elevationOffset - Height above floor (default 0.5m).
 * @returns Object containing separate FormaMeshData for each layer:
 *          - `corridor`: Central hallway mesh
 *          - `cores`: Elevator/stair core meshes
 *          - `units`: Unit fill meshes (colored by type)
 *          - `borders`: Unit outline meshes (dark borders)
 *
 * @example
 * ```typescript
 * const layers = renderFloorplateLayers(floorplan);
 *
 * // Render only units and borders (hide corridor/cores)
 * await Forma.render.addMesh({ geometryData: {
 *   position: layers.units.positions,
 *   color: layers.units.colors
 * }});
 * ```
 */
export function renderFloorplateLayers(
  floorplan: FloorPlanData,
  elevationOffset: number = 0.5
): {
  corridor: FormaMeshData;
  cores: FormaMeshData;
  units: FormaMeshData;
  borders: FormaMeshData;
} {
  const elevation = floorplan.floorElevation + elevationOffset;
  const transform = floorplan.transform;
  const fillerCores = fillersToCoreBlocks(floorplan.fillers ?? []);
  const allCores = [...floorplan.cores, ...fillerCores];

  const corridorMeshForLayers = floorplan.corridorSegments && floorplan.corridorSegments.length > 0
    ? combineMeshes(floorplan.corridorSegments.map(seg => renderCorridor(seg, elevation, transform)))
    : renderCorridor(floorplan.corridor, elevation, transform);

  return {
    corridor: corridorMeshForLayers,
    cores: renderCores(allCores, elevation + 0.1, transform),
    units: renderUnitFills(floorplan.units, elevation + 0.2, transform),
    borders: renderUnitBorders(floorplan.units, elevation + 0.3, transform)
  };
}

/**
 * Gets the default RGBA color for a unit type.
 *
 * Returns colors from the UNIT_COLORS constant map. These are the
 * standard colors used when no custom colors are specified.
 *
 * @param type - The UnitType enum value (Studio, OneBed, TwoBed, ThreeBed).
 * @returns RGBA color object with r, g, b values (0-255) and a (alpha, 0-255).
 *
 * @example
 * ```typescript
 * const studioColor = getUnitColor(UnitType.Studio);
 * // Returns { r: 160, g: 212, b: 220, a: 200 } (light blue)
 * ```
 */
export function getUnitColor(type: UnitType): { r: number; g: number; b: number; a: number } {
  return UNIT_COLORS[type];
}
