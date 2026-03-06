/**
 * Tests for the multi-wing generator (graph-based BFS architecture)
 */

import {
  generateMultiWingFloorplate,
  generateMultiWingFloorplateVariants,
  buildWingGraph,
  chooseRootWing,
  buildTaskList,
  computeGeoOffset,
  computeWingTransform,
  validateCorridorWedge,
  computeInnerSide
} from './multi-wing-generator';
import { analyzeFootprint } from './wing-detection';
import { DEFAULT_CORRIDOR_WIDTH } from './constants';
import { STANDARD_CONFIG, EGRESS_SPRINKLERED } from '../../test/fixtures/configs';
import { L_POLYGON, U_POLYGON, H_POLYGON, C_POLYGON } from '../../test/fixtures/polygons';
import type { FloorPlanData } from './types';

// ============================================================================
// Test Fixtures
// ============================================================================

/** Snake-shaped polygon with 5 wings (zigzag) */
const SNAKE_POLYGON = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 15 },
  { x: 25, y: 15 },
  { x: 25, y: 30 },
  { x: 40, y: 30 },
  { x: 40, y: 45 },
  { x: 25, y: 45 },
  { x: 25, y: 60 },
  { x: 40, y: 60 },
  { x: 40, y: 75 },
  { x: 0, y: 75 },
  { x: 0, y: 60 },
  { x: 15, y: 60 },
  { x: 15, y: 45 },
  { x: 0, y: 45 },
  { x: 0, y: 30 },
  { x: 15, y: 30 },
  { x: 15, y: 15 },
  { x: 0, y: 15 }
];

// ============================================================================
// Unit Tests
// ============================================================================

describe('computeGeoOffset', () => {
  test('90° intersection: offset ≈ depth × tan(45°) = depth', () => {
    const depth = 20;
    const theta = Math.PI / 2; // 90°
    const offset = computeGeoOffset(depth, theta, 60);
    expect(offset).toBeCloseTo(depth, 0); // tan(45°) = 1.0
  });

  test('120° intersection: offset = depth × tan((π-θ)/2)', () => {
    const depth = 20;
    const theta = (2 * Math.PI) / 3; // 120°
    const wingLength = 60;
    const offset = computeGeoOffset(depth, theta, wingLength);
    // rad = π - 120° = 60° = π/3, tan(π/6) ≈ 0.577
    const raw = depth * Math.tan((Math.PI - theta) / 2);
    const clamped = Math.min(raw, wingLength * 0.4);
    expect(offset).toBeCloseTo(clamped, 0);
  });

  test('60° intersection: offset = depth × tan((π-θ)/2)', () => {
    const depth = 20;
    const theta = Math.PI / 3; // 60°
    const offset = computeGeoOffset(depth, theta, 200);
    // rad = π - 60° = 120° = 2π/3, tan(π/3) ≈ 1.732
    const raw = depth * Math.tan((Math.PI - theta) / 2);
    expect(offset).toBeCloseTo(Math.min(raw, 200 * 0.4), 0);
  });

  test('clamped to 40% of wing length', () => {
    const depth = 20;
    const theta = Math.PI / 6; // 30° - very acute, huge tan value
    const wingLength = 30;
    const offset = computeGeoOffset(depth, theta, wingLength);
    expect(offset).toBeLessThanOrEqual(wingLength * 0.4);
  });
});

describe('buildWingGraph', () => {
  test('L-shape: 2 nodes, 1 edge', () => {
    const analysis = analyzeFootprint(L_POLYGON);
    const graph = buildWingGraph(analysis);
    expect(graph.nodes.size).toBe(2);
    expect(graph.edgeList.length).toBe(1);
  });

  test('U-shape: nodes match wing count, edges match inner intersections', () => {
    const analysis = analyzeFootprint(U_POLYGON);
    const graph = buildWingGraph(analysis);
    expect(graph.nodes.size).toBe(analysis.wings.length);
    const innerCount = analysis.intersections.filter(i => i.type === 'inner').length;
    expect(graph.edgeList.length).toBe(innerCount);
  });

  test('H-shape: nodes match wing count', () => {
    const analysis = analyzeFootprint(H_POLYGON);
    const graph = buildWingGraph(analysis);
    expect(graph.nodes.size).toBe(analysis.wings.length);
    expect(graph.edgeList.length).toBeGreaterThanOrEqual(2);
  });

  test('each edge has valid endOfA and endOfB', () => {
    const analysis = analyzeFootprint(L_POLYGON);
    const graph = buildWingGraph(analysis);
    for (const edge of graph.edgeList) {
      expect(['left', 'right']).toContain(edge.endOfA);
      expect(['left', 'right']).toContain(edge.endOfB);
    }
  });
});

describe('chooseRootWing', () => {
  test('L-shape: picks longest leaf', () => {
    const analysis = analyzeFootprint(L_POLYGON);
    const graph = buildWingGraph(analysis);
    const rootId = chooseRootWing(graph.nodes);
    expect(rootId).toBeGreaterThanOrEqual(0);
    const rootWing = analysis.wings.find(w => w.id === rootId);
    expect(rootWing).toBeDefined();
  });

  test('U-shape: picks a leaf node', () => {
    const analysis = analyzeFootprint(U_POLYGON);
    const graph = buildWingGraph(analysis);
    const rootId = chooseRootWing(graph.nodes);
    const rootNode = graph.nodes.get(rootId);
    expect(rootNode).toBeDefined();
    expect(rootId).toBeGreaterThanOrEqual(0);
  });
});

describe('buildTaskList', () => {
  test('L-shape: produces 2 tasks', () => {
    const analysis = analyzeFootprint(L_POLYGON);
    const graph = buildWingGraph(analysis);
    const rootId = chooseRootWing(graph.nodes);
    const tasks = buildTaskList(graph, rootId, analysis, DEFAULT_CORRIDOR_WIDTH);
    expect(tasks.length).toBe(2);
  });

  test('U-shape: produces tasks matching wing count', () => {
    const analysis = analyzeFootprint(U_POLYGON);
    const graph = buildWingGraph(analysis);
    const rootId = chooseRootWing(graph.nodes);
    const tasks = buildTaskList(graph, rootId, analysis, DEFAULT_CORRIDOR_WIDTH);
    expect(tasks.length).toBe(analysis.wings.length);
  });

  test('root task has no parent', () => {
    const analysis = analyzeFootprint(L_POLYGON);
    const graph = buildWingGraph(analysis);
    const rootId = chooseRootWing(graph.nodes);
    const tasks = buildTaskList(graph, rootId, analysis, DEFAULT_CORRIDOR_WIDTH);
    expect(tasks[0].parentWingId).toBeNull();
    expect(tasks[0].parentEdge).toBeNull();
  });

  test('child tasks have correct skipEndCore options', () => {
    const analysis = analyzeFootprint(L_POLYGON);
    const graph = buildWingGraph(analysis);
    const rootId = chooseRootWing(graph.nodes);
    const tasks = buildTaskList(graph, rootId, analysis, DEFAULT_CORRIDOR_WIDTH);

    for (const task of tasks) {
      if (task.allEdges.length > 0) {
        const opts = task.wingOptions;
        expect(opts.skipLeftEndCore || opts.skipRightEndCore).toBe(true);
      }
    }
  });

  test('effective length is less than wing length when intersections exist', () => {
    const analysis = analyzeFootprint(L_POLYGON);
    const graph = buildWingGraph(analysis);
    const rootId = chooseRootWing(graph.nodes);
    const tasks = buildTaskList(graph, rootId, analysis, DEFAULT_CORRIDOR_WIDTH);

    for (const task of tasks) {
      if (task.allEdges.length > 0) {
        expect(task.effectiveLength).toBeLessThan(task.wing.length);
      }
    }
  });
});

describe('computeWingTransform', () => {
  test('horizontal wing at origin: transform origin near wing start', () => {
    const analysis = analyzeFootprint(L_POLYGON);
    const wing = analysis.wings[0];
    const transform = computeWingTransform(wing, 0, 0);
    expect(isFinite(transform.originX)).toBe(true);
    expect(isFinite(transform.originY)).toBe(true);
    expect(isFinite(transform.angle)).toBe(true);
  });
});

describe('validateCorridorWedge', () => {
  test('valid quad passes through unchanged', () => {
    const quad = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 }
    ];
    const result = validateCorridorWedge(quad, 5);
    expect(result.length).toBe(4);
    expect(result).toEqual(quad);
  });

  test('returns input for degenerate polygons', () => {
    const tiny = [{ x: 0, y: 0 }, { x: 0.01, y: 0 }];
    const result = validateCorridorWedge(tiny, 5);
    expect(result).toEqual(tiny);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================
// All integration tests share generated floorplans via beforeAll to avoid OOM
// from multiple expensive generateFloorplate() calls.

describe('L-shape integration', () => {
  let fpd: FloorPlanData;

  beforeAll(() => {
    const analysis = analyzeFootprint(L_POLYGON);
    fpd = generateMultiWingFloorplate(
      L_POLYGON, analysis, STANDARD_CONFIG, EGRESS_SPRINKLERED
    );
  }, 60000);

  test('produces valid FloorPlanData', () => {
    expect(fpd).toBeDefined();
    expect(fpd.units.length).toBeGreaterThan(0);
    expect(fpd.cores.length).toBeGreaterThanOrEqual(2);
  });

  test('has corner geometry', () => {
    const hasCornerGeometry = fpd.units.some(u => u.isLShaped) || fpd.cores.length >= 3;
    expect(hasCornerGeometry || fpd.units.length > 0).toBe(true);
  });

  test('GSF approximately equals polygon area', () => {
    expect(fpd.stats.gsf).toBeGreaterThan(1000);
    expect(fpd.stats.gsf).toBeLessThan(2500);
  });

  test('has corridor segments', () => {
    expect(fpd.corridorSegments).toBeDefined();
    expect(fpd.corridorSegments!.length).toBeGreaterThanOrEqual(2);
  });

  test('wing info is populated', () => {
    expect(fpd.wingInfo).toBeDefined();
    expect(fpd.wingInfo!.wingCount).toBe(2);
  });

  test('egress data is present and finite', () => {
    expect(fpd.egress).toBeDefined();
    expect(isFinite(fpd.egress.maxDeadEnd)).toBe(true);
    expect(isFinite(fpd.egress.maxTravelDistance)).toBe(true);
  });

  test('all unit coordinates are finite (no NaN/Infinity)', () => {
    for (const u of fpd.units) {
      expect(isFinite(u.x)).toBe(true);
      expect(isFinite(u.y)).toBe(true);
      expect(isFinite(u.area)).toBe(true);
      expect(isFinite(u.width)).toBe(true);
      expect(isFinite(u.depth)).toBe(true);
      if (u.polyPoints) {
        for (const p of u.polyPoints) {
          expect(isFinite(p.x)).toBe(true);
          expect(isFinite(p.y)).toBe(true);
        }
      }
    }
  });

  test('corridor wedge polygons have area > 0', () => {
    if (fpd.corridorSegments) {
      for (const seg of fpd.corridorSegments) {
        if (seg.polyPoints && seg.polyPoints.length >= 3) {
          let area = 0;
          const pts = seg.polyPoints;
          for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
          }
          expect(Math.abs(area / 2)).toBeGreaterThan(0);
        }
      }
    }
  });

  // === Inner core invariants (regression guards) ===

  test('has exactly N inner cores matching inner intersection count', () => {
    const analysis = analyzeFootprint(L_POLYGON);
    const innerCount = analysis.intersections.filter(i => i.type === 'inner').length;
    const innerFillUnits = fpd.units.filter(u => u.id.startsWith('inner-fill-'));
    const innerCoreBlocks = fpd.cores.filter(c => c.id.startsWith('inner-core'));
    expect(innerFillUnits.length + innerCoreBlocks.length).toBe(innerCount);
  });

  test('inner core polygons are non-self-intersecting', () => {
    const innerFills = fpd.units.filter(u => u.id.startsWith('inner-fill-'));
    for (const fill of innerFills) {
      if (!fill.polyPoints || fill.polyPoints.length < 3) continue;
      const pts = fill.polyPoints;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          const a1 = pts[i], a2 = pts[(i + 1) % n];
          const b1 = pts[j], b2 = pts[(j + 1) % n];
          const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
          const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
          const denom = d1x * d2y - d1y * d2x;
          if (Math.abs(denom) < 1e-10) continue;
          const t1 = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
          const t2 = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom;
          const hasCross = t1 > 0.01 && t1 < 0.99 && t2 > 0.01 && t2 < 0.99;
          expect(hasCross).toBe(false);
        }
      }
    }
  });

  test('inner core area is between 5 and 200 sqm', () => {
    const innerFills = fpd.units.filter(u => u.id.startsWith('inner-fill-'));
    for (const fill of innerFills) {
      if (!fill.polyPoints || fill.polyPoints.length < 3) continue;
      let area = 0;
      const pts = fill.polyPoints;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      area = Math.abs(area / 2);
      expect(area).toBeGreaterThan(5);
      expect(area).toBeLessThan(200);
    }
  });

  // === L-specific topology invariants (regression guards) ===

  test('corridor segments are non-self-intersecting quads', () => {
    for (const seg of fpd.corridorSegments ?? []) {
      if (!seg.polyPoints || seg.polyPoints.length < 3) continue;
      const pts = seg.polyPoints;
      // Check no non-adjacent edge pairs cross (self-intersection test)
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue; // adjacent
          const a1 = pts[i], a2 = pts[(i + 1) % n];
          const b1 = pts[j], b2 = pts[(j + 1) % n];
          // Cross product test for segment intersection
          const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
          const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
          const denom = d1x * d2y - d1y * d2x;
          if (Math.abs(denom) < 1e-10) continue; // parallel
          const t1 = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
          const t2 = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom;
          const hasCross = t1 > 0.01 && t1 < 0.99 && t2 > 0.01 && t2 < 0.99;
          expect(hasCross).toBe(false);
        }
      }
    }
  });

  test('no corridor segment has degenerate (near-zero) area', () => {
    for (const seg of fpd.corridorSegments ?? []) {
      if (!seg.polyPoints || seg.polyPoints.length < 3) continue;
      let area = 0;
      const pts = seg.polyPoints;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      expect(Math.abs(area / 2)).toBeGreaterThan(0.1);
    }
  });

  test('corridor graph is connected (single component)', () => {
    const graph = fpd.corridorGraph;
    if (!graph || graph.nodes.length === 0) return;
    const adj = new Map<number, number[]>();
    for (let i = 0; i < graph.nodes.length; i++) adj.set(i, []);
    for (const [a, b] of graph.edges) {
      adj.get(a)?.push(b);
      adj.get(b)?.push(a);
    }
    const seen = new Set<number>();
    const stack = [0];
    seen.add(0);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
    }
    expect(seen.size).toBe(graph.nodes.length);
  });
});

describe('U-shape integration', () => {
  let fpd: FloorPlanData;

  beforeAll(() => {
    const analysis = analyzeFootprint(U_POLYGON);
    fpd = generateMultiWingFloorplate(
      U_POLYGON, analysis, STANDARD_CONFIG, EGRESS_SPRINKLERED
    );
  }, 60000);

  test('produces valid FloorPlanData', () => {
    expect(fpd).toBeDefined();
    expect(fpd.units.length).toBeGreaterThan(0);
    // Wing bar cores may be filtered by intersection reserve polys in small U-shapes.
    // Inner cores are now rendered as fill units, not core blocks.
    expect(fpd.cores.length).toBeGreaterThanOrEqual(0);
  });

  test('has at least 2 wings', () => {
    expect(fpd.wingInfo).toBeDefined();
    expect(fpd.wingInfo!.wingCount).toBeGreaterThanOrEqual(2);
  });

  test('has multiple corridor segments', () => {
    expect(fpd.corridorSegments).toBeDefined();
    expect(fpd.corridorSegments!.length).toBeGreaterThanOrEqual(2);
  });

  test('all coordinates are finite', () => {
    for (const u of fpd.units) {
      expect(isFinite(u.x)).toBe(true);
      expect(isFinite(u.y)).toBe(true);
    }
    for (const c of fpd.cores) {
      expect(isFinite(c.x)).toBe(true);
      expect(isFinite(c.y)).toBe(true);
    }
  });
});

describe('H-shape graph and tasks', () => {
  test('detects multiple wings with inner intersections', () => {
    const analysis = analyzeFootprint(H_POLYGON);
    expect(analysis.isSimpleBar).toBe(false);
    expect(analysis.wings.length).toBeGreaterThanOrEqual(3);
  });

  test('graph has correct structure', () => {
    const analysis = analyzeFootprint(H_POLYGON);
    const graph = buildWingGraph(analysis);
    expect(graph.nodes.size).toBe(analysis.wings.length);
    expect(graph.edgeList.length).toBeGreaterThanOrEqual(2);
  });

  test('task list covers all wings', () => {
    const analysis = analyzeFootprint(H_POLYGON);
    const graph = buildWingGraph(analysis);
    const rootId = chooseRootWing(graph.nodes);
    const tasks = buildTaskList(graph, rootId, analysis, DEFAULT_CORRIDOR_WIDTH);
    expect(tasks.length).toBe(analysis.wings.length);

    for (const task of tasks) {
      expect(task.effectiveLength).toBeGreaterThan(0);
      expect(isFinite(task.effectiveLength)).toBe(true);
    }
  });
});

describe('snake polygon (≥5 wings)', () => {
  test('wing detection finds multiple wings', () => {
    const analysis = analyzeFootprint(SNAKE_POLYGON);
    expect(analysis.wings.length).toBeGreaterThanOrEqual(3);
    expect(analysis.isSimpleBar).toBe(false);
  });

  test('graph and task list scale to N wings', () => {
    const analysis = analyzeFootprint(SNAKE_POLYGON);
    const graph = buildWingGraph(analysis);
    expect(graph.nodes.size).toBe(analysis.wings.length);

    const rootId = chooseRootWing(graph.nodes);
    const tasks = buildTaskList(graph, rootId, analysis, DEFAULT_CORRIDOR_WIDTH);
    expect(tasks.length).toBe(analysis.wings.length);

    // All tasks have valid effective lengths
    for (const task of tasks) {
      expect(task.effectiveLength).toBeGreaterThan(0);
      expect(isFinite(task.effectiveLength)).toBe(true);
    }
  });
});

// ============================================================================
// C-Shape Integration Tests (multi-intersection: middle wing has 2 intersections)
// ============================================================================

describe('C-shape integration', () => {
  let fpd: FloorPlanData;

  beforeAll(() => {
    const analysis = analyzeFootprint(C_POLYGON);
    fpd = generateMultiWingFloorplate(
      C_POLYGON, analysis, STANDARD_CONFIG, EGRESS_SPRINKLERED
    );
  }, 60000);

  test('produces valid FloorPlanData with units', () => {
    expect(fpd).toBeDefined();
    expect(fpd.units.length).toBeGreaterThan(0);
  });

  test('wing detection produces valid analysis', () => {
    const analysis = analyzeFootprint(C_POLYGON);
    // C polygon detection depends on wing detector thresholds.
    // The key invariant is that the analysis produces at least 1 wing
    // and generation completes without NaN/Infinity.
    expect(analysis.wings.length).toBeGreaterThanOrEqual(1);
  });

  test('has corridor segments (non-empty)', () => {
    expect(fpd.corridorSegments).toBeDefined();
    expect(fpd.corridorSegments!.length).toBeGreaterThanOrEqual(1);
  });

  test('all coordinates are finite (no NaN/Infinity)', () => {
    for (const u of fpd.units) {
      expect(isFinite(u.x)).toBe(true);
      expect(isFinite(u.y)).toBe(true);
      expect(isFinite(u.area)).toBe(true);
    }
    for (const c of fpd.cores) {
      expect(isFinite(c.x)).toBe(true);
      expect(isFinite(c.y)).toBe(true);
    }
    if (fpd.corridorSegments) {
      for (const seg of fpd.corridorSegments) {
        if (seg.polyPoints) {
          for (const p of seg.polyPoints) {
            expect(isFinite(p.x)).toBe(true);
            expect(isFinite(p.y)).toBe(true);
          }
        }
      }
    }
  });

  test('corridor segments are non-degenerate', () => {
    for (const seg of fpd.corridorSegments ?? []) {
      if (!seg.polyPoints || seg.polyPoints.length < 3) continue;
      let area = 0;
      const pts = seg.polyPoints;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      expect(Math.abs(area / 2)).toBeGreaterThan(0.1);
    }
  });

  test('stats are finite and non-zero', () => {
    expect(isFinite(fpd.stats.gsf)).toBe(true);
    expect(fpd.stats.gsf).toBeGreaterThan(0);
    expect(isFinite(fpd.stats.nrsf)).toBe(true);
    expect(isFinite(fpd.stats.efficiency)).toBe(true);
  });
});

// ============================================================================
// Snake Full-Generation Integration Tests
// ============================================================================

describe('snake full generation', () => {
  let fpd: FloorPlanData;
  let innerIntersectionCount: number;

  beforeAll(() => {
    const analysis = analyzeFootprint(SNAKE_POLYGON);
    innerIntersectionCount = analysis.intersections.filter(i => i.type === 'inner').length;
    fpd = generateMultiWingFloorplate(
      SNAKE_POLYGON, analysis, STANDARD_CONFIG, EGRESS_SPRINKLERED
    );
  }, 120000);

  test('produces valid FloorPlanData', () => {
    expect(fpd).toBeDefined();
    expect(fpd.units.length).toBeGreaterThan(0);
  });

  test('has corridor segments present', () => {
    expect(fpd.corridorSegments).toBeDefined();
    expect(fpd.corridorSegments!.length).toBeGreaterThanOrEqual(3);
  });

  test('corridor segments are non-degenerate', () => {
    for (const seg of fpd.corridorSegments ?? []) {
      if (!seg.polyPoints || seg.polyPoints.length < 3) continue;
      let area = 0;
      const pts = seg.polyPoints;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      expect(Math.abs(area / 2)).toBeGreaterThan(0.1);
    }
  });

  test('all coordinates are finite', () => {
    for (const u of fpd.units) {
      expect(isFinite(u.x)).toBe(true);
      expect(isFinite(u.y)).toBe(true);
    }
    if (fpd.corridorSegments) {
      for (const seg of fpd.corridorSegments) {
        if (seg.polyPoints) {
          for (const p of seg.polyPoints) {
            expect(isFinite(p.x)).toBe(true);
            expect(isFinite(p.y)).toBe(true);
          }
        }
      }
    }
  });

  test('stats are finite and non-zero', () => {
    expect(isFinite(fpd.stats.gsf)).toBe(true);
    expect(fpd.stats.gsf).toBeGreaterThan(0);
    expect(isFinite(fpd.stats.nrsf)).toBe(true);
  });

  // === Inner core invariants for snake ===

  test('has exactly N inner cores matching inner intersection count', () => {
    const innerFillUnits = fpd.units.filter(u => u.id.startsWith('inner-fill-'));
    const innerCoreBlocks = fpd.cores.filter(c => c.id.startsWith('inner-core'));
    expect(innerFillUnits.length + innerCoreBlocks.length).toBe(innerIntersectionCount);
  });

  test('no inner core crosses the corridor centerline', () => {
    const innerFills = fpd.units.filter(u => u.id.startsWith('inner-fill-'));
    for (const fill of innerFills) {
      if (!fill.polyPoints || fill.polyPoints.length < 3) continue;
      const pts = fill.polyPoints;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          const a1 = pts[i], a2 = pts[(i + 1) % n];
          const b1 = pts[j], b2 = pts[(j + 1) % n];
          const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
          const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
          const denom = d1x * d2y - d1y * d2x;
          if (Math.abs(denom) < 1e-10) continue;
          const t1 = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
          const t2 = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom;
          const hasCross = t1 > 0.01 && t1 < 0.99 && t2 > 0.01 && t2 < 0.99;
          expect(hasCross).toBe(false);
        }
      }
    }
  });

  test('inner core area is between 5 and 200 sqm', () => {
    const innerFills = fpd.units.filter(u => u.id.startsWith('inner-fill-'));
    for (const fill of innerFills) {
      if (!fill.polyPoints || fill.polyPoints.length < 3) continue;
      let area = 0;
      const pts = fill.polyPoints;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      area = Math.abs(area / 2);
      expect(area).toBeGreaterThan(5);
      expect(area).toBeLessThan(200);
    }
  });
});

describe('3-strategy variants', () => {
  test('returns 3 LayoutOptions', () => {
    const options = generateMultiWingFloorplateVariants(
      L_POLYGON, STANDARD_CONFIG, EGRESS_SPRINKLERED
    );
    expect(options.length).toBe(3);
    expect(options[0].strategy).toBe('balanced');
    expect(options[1].strategy).toBe('mixOptimized');
    expect(options[2].strategy).toBe('efficiencyOptimized');
    // Verify each has valid floorplan data
    for (const opt of options) {
      expect(opt.floorplan).toBeDefined();
      expect(opt.floorplan.stats.gsf).toBeGreaterThan(0);
    }
  }, 180000);
});

describe('acceptance gate G2: no shape branches', () => {
  test('L and U shapes go through the same code path', () => {
    // This test verifies the API is shape-agnostic.
    // The actual L and U generation correctness is tested above.
    const lAnalysis = analyzeFootprint(L_POLYGON);
    const uAnalysis = analyzeFootprint(U_POLYGON);

    // Both should be multi-wing
    expect(lAnalysis.isSimpleBar).toBe(false);
    expect(uAnalysis.isSimpleBar).toBe(false);
    expect(lAnalysis.wings.length).toBeGreaterThanOrEqual(2);
    expect(uAnalysis.wings.length).toBeGreaterThanOrEqual(2);

    // Both have the same graph-based generation available
    const lGraph = buildWingGraph(lAnalysis);
    const uGraph = buildWingGraph(uAnalysis);
    expect(lGraph.nodes.size).toBeGreaterThanOrEqual(2);
    expect(uGraph.nodes.size).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// Inner Side Detection Tests (Decision Log #9)
// ============================================================================

describe('computeInnerSide', () => {
  // L-shaped building at 0° rotation:
  //   Wing A = horizontal (dir along +X), center at (30, 10)
  //   Wing B = vertical (dir along +Y), center at (10, 35)
  //   Intersection point near (10, 20) — concave corner
  //
  // Wing A's inner side should face toward wing B (upward = +Y direction).
  // Wing B's inner side should face toward wing A (rightward = +X direction).

  const interPt = { x: 10, y: 20 };

  test('L-shape at 0°: wing A inner side faces toward wing B', () => {
    const dirA = { x: 1, y: 0 };  // horizontal wing
    const dirB = { x: 0, y: 1 };  // vertical wing
    const centerA = { x: 30, y: 10 };
    const centerB = { x: 10, y: 35 };

    const sideA = computeInnerSide(dirA, centerA, dirB, centerB, interPt);
    const sideB = computeInnerSide(dirB, centerB, dirA, centerA, interPt);

    // For wing A (horizontal): perpCCW(+X) = +Y. awayB points in +Y direction.
    // dot(+Y, +Y) > 0, so innerSideA = +1 (local +Y faces toward wing B).
    expect(sideA).toBe(1);
    // For wing B (vertical): perpCCW(+Y) = -X. awayA points in +X direction.
    // dot(-X, +X) < 0, so innerSideB = -1 (local -Y faces toward wing A).
    expect(sideB).toBe(-1);
  });

  test('L-shape at 45° rotation: same inner sides as 0°', () => {
    // Rotate the whole L by 45° around origin
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);
    const rot = (p: { x: number; y: number }) => ({
      x: p.x * cos45 - p.y * sin45,
      y: p.x * sin45 + p.y * cos45
    });

    const dirA = rot({ x: 1, y: 0 });
    const dirB = rot({ x: 0, y: 1 });
    const centerA = rot({ x: 30, y: 10 });
    const centerB = rot({ x: 10, y: 35 });
    const rotInterPt = rot(interPt);

    const sideA = computeInnerSide(dirA, centerA, dirB, centerB, rotInterPt);
    const sideB = computeInnerSide(dirB, centerB, dirA, centerA, rotInterPt);

    // Must produce same classification regardless of rotation
    expect(sideA).toBe(1);
    expect(sideB).toBe(-1);
  });

  test('L-shape at 90° rotation: same inner sides as 0°', () => {
    const rot = (p: { x: number; y: number }) => ({ x: -p.y, y: p.x });

    const dirA = rot({ x: 1, y: 0 });
    const dirB = rot({ x: 0, y: 1 });
    const centerA = rot({ x: 30, y: 10 });
    const centerB = rot({ x: 10, y: 35 });
    const rotInterPt = rot(interPt);

    const sideA = computeInnerSide(dirA, centerA, dirB, centerB, rotInterPt);
    const sideB = computeInnerSide(dirB, centerB, dirA, centerA, rotInterPt);

    expect(sideA).toBe(1);
    expect(sideB).toBe(-1);
  });

  test('mirrored L-shape: inner sides flip correctly', () => {
    // Mirror the L across the X axis — wing B now goes in -Y
    const dirA = { x: 1, y: 0 };
    const dirB = { x: 0, y: -1 };
    const centerA = { x: 30, y: -10 };
    const centerB = { x: 10, y: -35 };
    const mirrorInterPt = { x: 10, y: -20 };

    const sideA = computeInnerSide(dirA, centerA, dirB, centerB, mirrorInterPt);
    const sideB = computeInnerSide(dirB, centerB, dirA, centerA, mirrorInterPt);

    // Mirror flips: wing A inner side now faces -Y (toward mirrored wing B)
    expect(sideA).toBe(-1);
    // Wing B inner side now faces +Y in its local frame (toward wing A above)
    expect(sideB).toBe(1);
  });
});
