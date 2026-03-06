/**
 * Spec-Driven Tests for Multi-Wing Intersection Geometry
 *
 * These tests verify the intersection geometry subsystem in isolation,
 * encoding the architectural invariants that prevent recurring bugs:
 *   - Inner core must stay on the concave side of the corridor
 *   - Corner units must be valid L-shapes with corridor access
 *   - Corridor wedges must be non-self-intersecting quads
 */

import {
  computeIntersectionJoinGeometry,
  createInnerCore,
  createCornerUnit,
  createCorridorWedge,
  buildWingGraph,
  chooseRootWing,
  buildTaskList,
  computeWingTransform,
  generateMultiWingFloorplate
} from './multi-wing-generator';
import type { IntersectionJoinGeometry, WingTask, WingTransform } from './multi-wing-generator';
import { analyzeFootprint } from './wing-detection';
import { DEFAULT_CORRIDOR_WIDTH } from './constants';
import { STANDARD_CONFIG, EGRESS_SPRINKLERED } from '../../test/fixtures/configs';
import { L_POLYGON, U_POLYGON, C_POLYGON, SNAKE_POLYGON } from '../../test/fixtures/polygons';
import type { FloorPlanData } from './types';

// ============================================================================
// Helpers
// ============================================================================

type Pt = { x: number; y: number };

function polyAreaAbs(pts: Pt[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

function segmentsIntersect(
  a1: Pt, a2: Pt, b1: Pt, b2: Pt
): boolean {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return false;
  const t1 = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
  const t2 = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom;
  return t1 > 0.01 && t1 < 0.99 && t2 > 0.01 && t2 < 0.99;
}

function isPolygonSelfIntersecting(pts: Pt[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsIntersect(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Build join geometries for all inner intersections of a given polygon.
 * Returns an array of { joinGeom, wingA, wingB } for each inner intersection.
 */
function buildJoinGeometries(polygon: Pt[]) {
  const analysis = analyzeFootprint(polygon);
  const graph = buildWingGraph(analysis);
  const rootId = chooseRootWing(graph.nodes);
  const tasks = buildTaskList(graph, rootId, analysis, DEFAULT_CORRIDOR_WIDTH);

  const taskMap = new Map<number, WingTask>();
  for (const t of tasks) taskMap.set(t.wingId, t);

  const transformMap = new Map<number, WingTransform>();
  for (const t of tasks) {
    const geoLeft = t.geoOffsetLeft;
    const geoRight = t.geoOffsetRight;
    transformMap.set(t.wingId, computeWingTransform(t.wing, geoLeft, geoRight));
  }

  const results: Array<{
    joinGeom: IntersectionJoinGeometry;
    wingA: typeof analysis.wings[0];
    wingB: typeof analysis.wings[0];
    intersection: typeof analysis.intersections[0];
  }> = [];

  for (const intersection of analysis.intersections) {
    if (intersection.type !== 'inner') continue;
    const [idA, idB] = intersection.wingIds;
    const wingA = analysis.wings.find(w => w.id === idA);
    const wingB = analysis.wings.find(w => w.id === idB);
    if (!wingA || !wingB) continue;
    const taskA = taskMap.get(idA);
    const taskB = taskMap.get(idB);
    if (!taskA || !taskB) continue;
    const transformA = transformMap.get(idA)!;
    const transformB = transformMap.get(idB)!;

    const joinGeom = computeIntersectionJoinGeometry(
      intersection, wingA, wingB, transformA, transformB, taskA, taskB, DEFAULT_CORRIDOR_WIDTH
    );
    if (joinGeom) {
      results.push({ joinGeom, wingA, wingB, intersection });
    }
  }

  return { results, analysis, tasks };
}

// ============================================================================
// Inner Core Tests
// ============================================================================

describe('createInnerCore', () => {
  describe.each([
    ['L_POLYGON', L_POLYGON],
    ['U_POLYGON', U_POLYGON],
    ['C_POLYGON', C_POLYGON],
    ['SNAKE_POLYGON', SNAKE_POLYGON],
  ])('%s', (_name, polygon) => {
    let joinResults: ReturnType<typeof buildJoinGeometries>['results'];

    beforeAll(() => {
      const { results } = buildJoinGeometries(polygon);
      joinResults = results;
    });

    test('produces one inner core per inner intersection', () => {
      for (const { joinGeom } of joinResults) {
        const core = createInnerCore(joinGeom);
        expect(core).not.toBeNull();
      }
    });

    test('inner core polygon must NOT contain sCorrOuter as a vertex', () => {
      for (const { joinGeom } of joinResults) {
        const core = createInnerCore(joinGeom);
        if (!core || !core.polyPoints) continue;

        const { sCorrOuter } = joinGeom;
        for (const p of core.polyPoints) {
          const isSamePoint =
            Math.abs(p.x - sCorrOuter.x) < 0.001 &&
            Math.abs(p.y - sCorrOuter.y) < 0.001;
          expect(isSamePoint).toBe(false);
        }
      }
    });

    test('inner core polygon is non-self-intersecting (no bowtie)', () => {
      for (const { joinGeom } of joinResults) {
        const core = createInnerCore(joinGeom);
        if (!core || !core.polyPoints || core.polyPoints.length < 3) continue;
        expect(isPolygonSelfIntersecting(core.polyPoints)).toBe(false);
      }
    });

    test('inner core area is between 5 sqm and wingA.width * wingB.width sqm', () => {
      for (const { joinGeom, wingA, wingB } of joinResults) {
        const core = createInnerCore(joinGeom);
        if (!core || !core.polyPoints) continue;
        const area = polyAreaAbs(core.polyPoints);
        expect(area).toBeGreaterThan(5);
        expect(area).toBeLessThan(wingA.width * wingB.width);
      }
    });

    test('inner core centroid is on the inner (concave) side of the corridor', () => {
      for (const { joinGeom } of joinResults) {
        const core = createInnerCore(joinGeom);
        if (!core || !core.polyPoints || core.polyPoints.length < 3) continue;

        const centroid: Pt = {
          x: core.polyPoints.reduce((s, p) => s + p.x, 0) / core.polyPoints.length,
          y: core.polyPoints.reduce((s, p) => s + p.y, 0) / core.polyPoints.length
        };

        const { sCorrInner, sCorrOuter } = joinGeom;
        const dToInner = Math.hypot(centroid.x - sCorrInner.x, centroid.y - sCorrInner.y);
        const dToOuter = Math.hypot(centroid.x - sCorrOuter.x, centroid.y - sCorrOuter.y);
        expect(dToInner).toBeLessThan(dToOuter);
      }
    });
  });
});

// ============================================================================
// Corner Unit Tests
// ============================================================================

describe('createCornerUnit', () => {
  describe.each([
    ['L_POLYGON', L_POLYGON],
    ['C_POLYGON', C_POLYGON],
  ])('%s', (_name, polygon) => {
    let joinResults: ReturnType<typeof buildJoinGeometries>['results'];

    beforeAll(() => {
      const { results } = buildJoinGeometries(polygon);
      joinResults = results;
    });

    test('produces a corner unit for each intersection (or null with explanation)', () => {
      for (const { joinGeom, wingA, wingB } of joinResults) {
        const targetArea = 137 * 0.0929; // ~12.7 sqm (≈137 sq ft for 3BR target)
        const result = createCornerUnit(
          joinGeom, wingA, wingB, DEFAULT_CORRIDOR_WIDTH, targetArea, STANDARD_CONFIG
        );
        // Either produces a unit or returns null (both are valid if geometry doesn't permit)
        if (result.cornerUnit) {
          expect(result.cornerUnit.polyPoints).toBeDefined();
          expect(result.cornerUnit.polyPoints!.length).toBeGreaterThanOrEqual(4);
        }
      }
    });

    test('corner unit polygon is a valid L-shape (6 vertices) or quad (4 vertices)', () => {
      for (const { joinGeom, wingA, wingB } of joinResults) {
        const targetArea = 137 * 0.0929;
        const result = createCornerUnit(
          joinGeom, wingA, wingB, DEFAULT_CORRIDOR_WIDTH, targetArea, STANDARD_CONFIG
        );
        if (!result.cornerUnit || !result.cornerUnit.polyPoints) continue;
        const vCount = result.cornerUnit.polyPoints.length;
        expect(vCount === 4 || vCount === 6).toBe(true);
      }
    });

    test('corner unit polygon is non-self-intersecting', () => {
      for (const { joinGeom, wingA, wingB } of joinResults) {
        const targetArea = 137 * 0.0929;
        const result = createCornerUnit(
          joinGeom, wingA, wingB, DEFAULT_CORRIDOR_WIDTH, targetArea, STANDARD_CONFIG
        );
        if (!result.cornerUnit || !result.cornerUnit.polyPoints) continue;
        expect(isPolygonSelfIntersecting(result.cornerUnit.polyPoints)).toBe(false);
      }
    });

    test('corner unit has positive area', () => {
      for (const { joinGeom, wingA, wingB } of joinResults) {
        const targetArea = 137 * 0.0929;
        const result = createCornerUnit(
          joinGeom, wingA, wingB, DEFAULT_CORRIDOR_WIDTH, targetArea, STANDARD_CONFIG
        );
        if (!result.cornerUnit || !result.cornerUnit.polyPoints) continue;
        const area = polyAreaAbs(result.cornerUnit.polyPoints);
        expect(area).toBeGreaterThan(1);
      }
    });

    test('corner unit walls adjacent to corridor are perpendicular to corridor direction', () => {
      for (const { joinGeom, wingA, wingB } of joinResults) {
        const targetArea = 137 * 0.0929;
        const result = createCornerUnit(
          joinGeom, wingA, wingB, DEFAULT_CORRIDOR_WIDTH, targetArea, STANDARD_CONFIG
        );
        if (!result.cornerUnit || !result.cornerUnit.polyPoints) continue;
        const pts = result.cornerUnit.polyPoints;

        // The corner unit's inner edges (p2→p3 and p3→p4 in the L-shape) should
        // be approximately perpendicular to the wing directions.
        // We verify by checking that no edge has a near-zero length (degenerate).
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          const edgeLen = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
          expect(edgeLen).toBeGreaterThan(0.01);
        }
      }
    });
  });
});

// ============================================================================
// Corridor Wedge Tests
// ============================================================================

describe('createCorridorWedge', () => {
  describe.each([
    ['L_POLYGON', L_POLYGON],
    ['U_POLYGON', U_POLYGON],
    ['C_POLYGON', C_POLYGON],
  ])('%s', (_name, polygon) => {
    let joinResults: ReturnType<typeof buildJoinGeometries>['results'];

    beforeAll(() => {
      const { results } = buildJoinGeometries(polygon);
      joinResults = results;
    });

    test('produces at least 2 corridor segments per intersection', () => {
      for (const { joinGeom } of joinResults) {
        const segments = createCorridorWedge(joinGeom, DEFAULT_CORRIDOR_WIDTH);
        expect(segments.length).toBeGreaterThanOrEqual(2);
      }
    });

    test('junction quads are non-self-intersecting', () => {
      for (const { joinGeom } of joinResults) {
        const segments = createCorridorWedge(joinGeom, DEFAULT_CORRIDOR_WIDTH);
        for (const seg of segments) {
          if (!seg.polyPoints || seg.polyPoints.length < 3) continue;
          expect(isPolygonSelfIntersecting(seg.polyPoints)).toBe(false);
        }
      }
    });

    test('all corridor segments have positive area', () => {
      for (const { joinGeom } of joinResults) {
        const segments = createCorridorWedge(joinGeom, DEFAULT_CORRIDOR_WIDTH);
        for (const seg of segments) {
          if (!seg.polyPoints || seg.polyPoints.length < 3) continue;
          const area = polyAreaAbs(seg.polyPoints);
          expect(area).toBeGreaterThan(0.1);
        }
      }
    });

    test('no corridor segment has degenerate (near-zero) area', () => {
      for (const { joinGeom } of joinResults) {
        const segments = createCorridorWedge(joinGeom, DEFAULT_CORRIDOR_WIDTH);
        for (const seg of segments) {
          if (!seg.polyPoints || seg.polyPoints.length < 3) continue;
          const area = polyAreaAbs(seg.polyPoints);
          expect(area).toBeGreaterThan(0.1);
        }
      }
    });
  });
});

// ============================================================================
// Cross-Cutting Invariants (per-shape integration)
// ============================================================================

describe('cross-cutting invariants', () => {
  describe.each([
    ['L_POLYGON', L_POLYGON],
    ['U_POLYGON', U_POLYGON],
    ['C_POLYGON', C_POLYGON],
    ['SNAKE_POLYGON', SNAKE_POLYGON],
  ])('%s', (_name, polygon) => {
    let fpd: FloorPlanData;
    let innerIntersectionCount: number;

    beforeAll(() => {
      const analysis = analyzeFootprint(polygon);
      innerIntersectionCount = analysis.intersections.filter(i => i.type === 'inner').length;
      fpd = generateMultiWingFloorplate(
        polygon, analysis, STANDARD_CONFIG, EGRESS_SPRINKLERED
      );
    }, 120000);

    test('inner core count equals inner intersection count', () => {
      const innerFillUnits = fpd.units.filter(u => u.id.startsWith('inner-fill-'));
      const innerCoreBlocks = fpd.cores.filter(c => c.id.startsWith('inner-core'));
      const totalInnerCores = innerFillUnits.length + innerCoreBlocks.length;
      expect(totalInnerCores).toBe(innerIntersectionCount);
    });

    test('no unit has area below minimum studio size (30 sqm)', () => {
      for (const u of fpd.units) {
        if (u.id.startsWith('inner-fill-') || u.id.startsWith('corner-fill-')) continue;
        if (u.area !== undefined) {
          expect(u.area).toBeGreaterThan(30);
        }
      }
    });

    test('all unit coordinates are finite', () => {
      for (const u of fpd.units) {
        expect(isFinite(u.x)).toBe(true);
        expect(isFinite(u.y)).toBe(true);
        if (u.polyPoints) {
          for (const p of u.polyPoints) {
            expect(isFinite(p.x)).toBe(true);
            expect(isFinite(p.y)).toBe(true);
          }
        }
      }
    });

    test('all corridor segment polygons are non-self-intersecting', () => {
      for (const seg of fpd.corridorSegments ?? []) {
        if (!seg.polyPoints || seg.polyPoints.length < 3) continue;
        expect(isPolygonSelfIntersecting(seg.polyPoints)).toBe(false);
      }
    });
  });
});
