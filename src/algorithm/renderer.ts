/**
 * Floorplate Generator - Renderer
 * Converts FloorPlanData to Forma mesh data
 *
 * Handles transformation from local coordinates (building-aligned)
 * to world coordinates (Forma scene).
 */

import { FloorPlanData, UnitBlock, CoreBlock, CorridorBlock, UnitType } from './types';
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
 * Decompose an L-shaped polygon into triangles
 * L-shapes are concave, so we decompose into two rectangles (4 triangles)
 */
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
 * Create mesh for a unit (rectangle or L-shaped polygon)
 */
function createUnitMesh(
  unit: UnitBlock,
  z: number,
  color: { r: number; g: number; b: number; a: number },
  transform: { centerX: number; centerY: number; rotation: number }
): { positions: number[]; colors: number[] } {
  if (unit.polyPoints && unit.polyPoints.length >= 3) {
    // L-shaped or polygon unit
    if (unit.isLShaped && unit.polyPoints.length === 6) {
      return triangulateLShape(unit.polyPoints, z, color, transform);
    } else {
      return triangulateConvex(unit.polyPoints, z, color, transform);
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
    const { positions, colors } = createRectangleMesh(
      core.x,
      core.y,
      core.width,
      core.depth,
      elevation,
      color,
      transform
    );
    allPositions.push(...positions);
    allColors.push(...colors);
  });

  return {
    positions: new Float32Array(allPositions),
    colors: new Uint8Array(allColors)
  };
}

/**
 * Render corridor to mesh data
 */
function renderCorridor(corridor: CorridorBlock, elevation: number, transform: Transform): FormaMeshData {
  const color = UNIT_COLORS['Corridor'];
  const { positions, colors } = createRectangleMesh(
    corridor.x,
    corridor.y,
    corridor.width,
    corridor.depth,
    elevation,
    color,
    transform
  );

  return {
    positions: new Float32Array(positions),
    colors: new Uint8Array(colors)
  };
}

/**
 * Render complete floorplate to combined mesh data
 */
export function renderFloorplate(floorplan: FloorPlanData, elevationOffset: number = 0.5): FormaMeshData {
  const elevation = floorplan.floorElevation + elevationOffset;
  const transform = floorplan.transform;

  // Render corridor first (bottom layer)
  const corridorMesh = renderCorridor(floorplan.corridor, elevation, transform);

  // Render cores
  const coresMesh = renderCores(floorplan.cores, elevation + 0.1, transform);

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
 * Render individual layer meshes (for debugging/selective rendering)
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

  return {
    corridor: renderCorridor(floorplan.corridor, elevation, transform),
    cores: renderCores(floorplan.cores, elevation + 0.1, transform),
    units: renderUnitFills(floorplan.units, elevation + 0.2, transform),
    borders: renderUnitBorders(floorplan.units, elevation + 0.3, transform)
  };
}

/**
 * Get unit color by type
 */
export function getUnitColor(type: UnitType): { r: number; g: number; b: number; a: number } {
  return UNIT_COLORS[type];
}
