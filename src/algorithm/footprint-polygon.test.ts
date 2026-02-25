/**
 * Tests for footprint polygon extraction module
 */

import { weldVertices, extractFootprintPolygon, polygonToLegacyFootprint } from './footprint-polygon';
import { polygonArea } from '../geometry/polygon';
import { RECTANGLE_TRIANGLES, L_SHAPE_TRIANGLES, U_SHAPE_TRIANGLES, NOISY_L_SHAPE_TRIANGLES } from '../../test/fixtures/meshes';

describe('weldVertices', () => {
  test('merges two vertices within epsilon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.0001, y: 0 }, // within 0.001 epsilon
      { x: 5, y: 5 }
    ];
    const { uniquePoints, indexMap } = weldVertices(points, 0.001);
    expect(uniquePoints.length).toBe(2);
    expect(indexMap[0]).toBe(indexMap[1]); // first two map to same
    expect(indexMap[2]).not.toBe(indexMap[0]); // third is separate
  });

  test('keeps all distinct vertices', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ];
    const { uniquePoints, indexMap } = weldVertices(points, 0.001);
    expect(uniquePoints.length).toBe(4);
    expect(new Set(indexMap).size).toBe(4);
  });

  test('handles points exactly at epsilon boundary', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.0005, y: 0 }, // within 0.001 epsilon
      { x: 0.002, y: 0 }   // outside 0.001 epsilon from first
    ];
    const { uniquePoints } = weldVertices(points, 0.001);
    // First two merge, third is separate
    expect(uniquePoints.length).toBe(2);
  });

  test('L-shape with 6 identical vertices returns 6 unique', () => {
    const lShape = [
      { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 },
      { x: 20, y: 20 }, { x: 20, y: 50 }, { x: 0, y: 50 }
    ];
    const { uniquePoints } = weldVertices(lShape, 0.001);
    expect(uniquePoints.length).toBe(6);
  });
});

describe('extractFootprintPolygon', () => {
  test('rectangle mesh produces 4-vertex polygon', () => {
    const { polygon, floorZ, height } = extractFootprintPolygon(RECTANGLE_TRIANGLES);
    expect(polygon.length).toBe(4);
    expect(floorZ).toBe(0);
    expect(height).toBe(10);
    // Area should be close to 60×20 = 1200 m²
    const area = polygonArea({ vertices: polygon });
    expect(area).toBeCloseTo(1200, 0);
  });

  test('L-shaped mesh produces 6-vertex polygon', () => {
    const { polygon } = extractFootprintPolygon(L_SHAPE_TRIANGLES);
    expect(polygon.length).toBe(6);
    // Area should be 60×20 + 20×30 = 1800 m²
    const area = polygonArea({ vertices: polygon });
    expect(area).toBeCloseTo(1800, 0);
  });

  test('L-shaped polygon area is NOT the bounding box area (3000 m²)', () => {
    const { polygon } = extractFootprintPolygon(L_SHAPE_TRIANGLES);
    const area = polygonArea({ vertices: polygon });
    expect(area).not.toBeCloseTo(3000, -1); // Not the 60×50 bounding box
    expect(area).toBeCloseTo(1800, 0);
  });

  test('U-shaped mesh produces 8-vertex polygon', () => {
    const { polygon } = extractFootprintPolygon(U_SHAPE_TRIANGLES);
    expect(polygon.length).toBe(8);
    // Area should be 50×20 + 10×20 + 10×20 = 1400 m²
    const area = polygonArea({ vertices: polygon });
    expect(area).toBeCloseTo(1400, 0);
  });

  test('noisy L-shaped mesh still produces 6-vertex polygon', () => {
    const { polygon } = extractFootprintPolygon(NOISY_L_SHAPE_TRIANGLES);
    // Welding + simplification should clean this up
    expect(polygon.length).toBeGreaterThanOrEqual(4);
    const area = polygonArea({ vertices: polygon });
    expect(area).toBeCloseTo(1800, -1); // Within 100 m² tolerance
  });
});

describe('polygonToLegacyFootprint', () => {
  test('rectangle polygon produces correct width and depth', () => {
    const poly = [
      { x: 0, y: 0 }, { x: 60, y: 0 },
      { x: 60, y: 20 }, { x: 0, y: 20 }
    ];
    const fp = polygonToLegacyFootprint(poly, 0, 10);
    expect(fp.width).toBeCloseTo(60, 1);
    expect(fp.depth).toBeCloseTo(20, 1);
    expect(fp.centerX).toBeCloseTo(30, 1);
    expect(fp.centerY).toBeCloseTo(10, 1);
    expect(fp.floorZ).toBe(0);
    expect(fp.height).toBe(10);
    expect(fp.polygon).toBeDefined();
    expect(fp.polygon!.length).toBe(4);
  });

  test('polygon field is preserved in output', () => {
    const poly = [
      { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 },
      { x: 20, y: 20 }, { x: 20, y: 50 }, { x: 0, y: 50 }
    ];
    const fp = polygonToLegacyFootprint(poly, 0, 10);
    expect(fp.polygon).toEqual(poly);
  });
});
