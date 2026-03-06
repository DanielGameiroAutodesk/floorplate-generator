// @ts-nocheck
/**
 * Multi-Wing Floorplate Generator — Graph-Based BFS Architecture
 *
 * Generates floorplates for multi-wing buildings (L, U, H, snake, courtyard)
 * by treating each wing as an independent bar and calling generateFloorplate()
 * per wing, then stitching results with explicit corner geometry.
 *
 * Architecture:
 *  1. Build wing connectivity graph from wing-detection output
 *  2. BFS traversal → ordered task list with geoOffsets per intersection
 *  3. Per wing: create synthetic BuildingFootprint, call generateFloorplate(),
 *     transform result from wing-local to world coordinates
 *  4. Per intersection: create corner unit, corridor wedge, inner core
 *  5. Assemble into single FloorPlanData with global egress validation
 *
 * Bar buildings (isSimpleBar = true) still go through generateFloorplate() unchanged.
 */

import {
  UnitType, UnitConfiguration, EgressConfig, FloorPlanData, LayoutOption,
  CoreBlock, UnitBlock, CorridorBlock, FillerBlock, OptimizationStrategy,
  BuildingFootprint, Wing, WingIntersection
} from './types';
import {
  DEFAULT_CORRIDOR_WIDTH, DEFAULT_CORE_WIDTH, DEFAULT_CORE_DEPTH,
  STRATEGY_LABELS, STRATEGY_DESCRIPTIONS, UNIT_COLORS
} from './constants';
import { generateFloorplate, WingGenerationOptions } from './generator-core';
import type { UnitColorMap } from './generator-core';
import { analyzeFootprint, MultiWingAnalysis } from './wing-detection';
import { polygonArea, ensureCounterClockwise, pointInPolygon } from '../geometry/polygon';
import { distance, rotateAroundOrigin } from '../geometry/point';
import { lineIntersection } from '../geometry/line';
import { buildCorridorGraph, shortestPathToCore } from '../geometry/graph';
import { Logger } from './utils/logger';
import { calculateGlobalUnitCounts } from './unit-counts';
import { isCornerEligible } from './flexibility-model';

// ============================================================================
// Section 1: Types & Interfaces
// ============================================================================

export interface MultiWingGeneratorOptions {
  corridorWidth?: number;
  coreWidth?: number;
  coreDepth?: number;
  coreSide?: 'North' | 'South';
  alignment?: number;
  strategy?: OptimizationStrategy;
  customColors?: Record<string, string>;
  includeIntersectionCustomUnits?: boolean;
}

type Pt = { x: number; y: number };

/** Wing adjacency graph edge (one per inner intersection) */
interface IntersectionEdge {
  index: number;                    // Index in intersections array
  intersection: WingIntersection;
  wingIdA: number;
  wingIdB: number;
  endOfA: 'left' | 'right';        // Which end of wing A faces this intersection
  endOfB: 'left' | 'right';        // Which end of wing B faces this intersection
  geoOffsetA: number;              // How much to trim from wing A at this intersection
  geoOffsetB: number;              // How much to trim from wing B at this intersection
  theta: number;                    // Angle between wings at intersection
}

/** Wing adjacency graph node */
interface WingNode {
  wingId: number;
  wing: Wing;
  edges: Map<number, IntersectionEdge>;  // neighborWingId → edge
}

/** Ordered task produced by BFS traversal */
interface WingTask {
  wingId: number;
  wing: Wing;
  parentWingId: number | null;
  parentEdge: IntersectionEdge | null;
  allEdges: IntersectionEdge[];     // All intersections this wing participates in
  effectiveLength: number;          // Wing length minus geoOffsets at intersection ends
  geoOffsetLeft: number;            // Trim from left end
  geoOffsetRight: number;           // Trim from right end
  wingOptions: WingGenerationOptions;
}

/** Per-wing transform: local coords → world coords */
interface WingTransform {
  originX: number;    // World position of wing-local (0,0)
  originY: number;
  angle: number;      // Wing direction in radians
}

// ============================================================================
// Section 2: Geometry Helpers
// ============================================================================

function normalize(v: Pt): Pt {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  return len > 1e-9 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
}

function addPt(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subPt(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scalePt(v: Pt, s: number): Pt {
  return { x: v.x * s, y: v.y * s };
}

function dot(a: Pt, b: Pt): number {
  return a.x * b.x + a.y * b.y;
}

function perpCCW(v: Pt): Pt {
  return { x: -v.y, y: v.x };
}

function polyAreaAbs(pts: Pt[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

function applyTransform(pt: Pt, transform: WingTransform): Pt {
  const rotated = rotateAroundOrigin(pt, transform.angle);
  return { x: rotated.x + transform.originX, y: rotated.y + transform.originY };
}

function transformPolyPoints(pts: Pt[], transform: WingTransform): Pt[] {
  return pts.map(p => applyTransform(p, transform));
}

/** Line-line intersection (infinite lines). Returns null if parallel. */
function llIntersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const result = lineIntersection(
    { start: p1, end: addPt(p1, d1) },
    { start: p2, end: addPt(p2, d2) }
  );
  return result.intersects ? result.point! : null;
}

// ============================================================================
// Section 3: Wing Graph Construction
// ============================================================================

function wingCenter(wing: Wing): Pt {
  return wing.center ?? {
    x: (wing.bounds.minX + wing.bounds.maxX) / 2,
    y: (wing.bounds.minY + wing.bounds.maxY) / 2
  };
}

function wingDir(wing: Wing): Pt {
  return normalize({ x: Math.cos(wing.direction), y: Math.sin(wing.direction) });
}

/**
 * Determine which end of a wing faces an intersection point.
 * 'left' = negative projection (start of wing), 'right' = positive (end of wing).
 */
function determineWingEnd(wing: Wing, intersectionPoint: Pt): 'left' | 'right' {
  const dir = wingDir(wing);
  const toInter = subPt(intersectionPoint, wingCenter(wing));
  return dot(dir, toInter) >= 0 ? 'right' : 'left';
}

/**
 * Compute how much to trim from the wing at an intersection.
 * raw = buildingDepth * tan(theta/2)
 */
function computeGeoOffset(buildingDepth: number, theta: number, wingLength: number): number {
  // theta is the interior angle between the wings.
  // We want the geometric offset to match the corner wedge depth
  const rad = Math.PI - theta;
  const tanHalf = Math.tan(rad / 2);
  const raw = buildingDepth * tanHalf;
  
  // Clamp to 40% of wing length to prevent completely degenerating wings at acute angles
  return Math.min(raw, wingLength * 0.4);
}

interface WingGraph {
  nodes: Map<number, WingNode>;
  edgeList: IntersectionEdge[];
}

function buildWingGraph(analysis: MultiWingAnalysis): WingGraph {
  const { wings, intersections, wingRoles } = analysis;
  const nodes = new Map<number, WingNode>();

  // Create a node for each wing
  for (const wing of wings) {
    nodes.set(wing.id, { wingId: wing.id, wing, edges: new Map() });
  }

  const edgeList: IntersectionEdge[] = [];

  // Create edges from inner intersections
  const innerIntersections = intersections.filter(i => i.type === 'inner');
  for (let idx = 0; idx < innerIntersections.length; idx++) {
    const inter = innerIntersections[idx];
    const [widA, widB] = inter.wingIds;
    const wA = wings.find(w => w.id === widA);
    const wB = wings.find(w => w.id === widB);
    if (!wA || !wB) continue;

    const interPt: Pt = { x: inter.point.x, y: inter.point.y };
    
    // Find ends from wingRoles
    const roleA = wingRoles.find(r => r.intersectionIndex === idx && r.wingId === widA);
    const roleB = wingRoles.find(r => r.intersectionIndex === idx && r.wingId === widB);
    
    const endOfA = roleA ? roleA.intersectionEnd : determineWingEnd(wA, interPt);
    const endOfB = roleB ? roleB.intersectionEnd : determineWingEnd(wB, interPt);

    // Compute angle between wings
    const dirA = wingDir(wA);
    const dirB = wingDir(wB);
    // Ensure directions point away from intersection
    const cA = wingCenter(wA);
    const cB = wingCenter(wB);
    const awayA = dot(dirA, subPt(cA, interPt)) >= 0 ? dirA : scalePt(dirA, -1);
    const awayB = dot(dirB, subPt(cB, interPt)) >= 0 ? dirB : scalePt(dirB, -1);
    const cosTheta = Math.max(-1, Math.min(1, dot(awayA, awayB)));
    const theta = Math.acos(cosTheta);

    const geoOffsetA = computeGeoOffset(wA.width, theta, wA.length);
    const geoOffsetB = computeGeoOffset(wB.width, theta, wB.length);

    const edge: IntersectionEdge = {
      index: idx,
      intersection: inter,
      wingIdA: widA,
      wingIdB: widB,
      endOfA,
      endOfB,
      geoOffsetA,
      geoOffsetB,
      theta
    };

    edgeList.push(edge);
    nodes.get(widA)?.edges.set(widB, edge);
    nodes.get(widB)?.edges.set(widA, edge);
  }

  return { nodes, edgeList };
}

// ============================================================================
// Section 4: BFS Traversal & Task Planning
// ============================================================================

/**
 * Pick the root wing for BFS: longest leaf node (degree 1), tiebreak by lowest ID.
 * If no leaves (courtyard), pick longest wing overall.
 */
function chooseRootWing(nodes: Map<number, WingNode>): number {
  let bestId = -1;
  let bestLength = -1;
  let hasLeaf = false;

  for (const [wid, node] of nodes) {
    const degree = node.edges.size;
    const isLeaf = degree <= 1;
    if (isLeaf) hasLeaf = true;

    if (hasLeaf && !isLeaf) continue; // Only consider leaves once we've found one
    if (!hasLeaf || isLeaf) {
      if (node.wing.length > bestLength || (node.wing.length === bestLength && wid < bestId)) {
        bestLength = node.wing.length;
        bestId = wid;
      }
    }
  }

  return bestId;
}

function buildTaskList(
  graph: WingGraph,
  rootWingId: number,
  _analysis: MultiWingAnalysis,
  _corridorWidth: number
): WingTask[] {
  const tasks: WingTask[] = [];
  const visited = new Set<number>();
  const queue: Array<{ wingId: number; parentWingId: number | null; parentEdge: IntersectionEdge | null }> = [];

  queue.push({ wingId: rootWingId, parentWingId: null, parentEdge: null });
  visited.add(rootWingId);
  
  const debugTasks: any[] = [];

  while (queue.length > 0) {
    const { wingId, parentWingId, parentEdge } = queue.shift()!;
    const node = graph.nodes.get(wingId);
    if (!node) continue;

    // Collect all edges this wing participates in
    const allEdges: IntersectionEdge[] = [];
    for (const edge of node.edges.values()) {
      allEdges.push(edge);
    }

    // Compute geoOffsets at each end
    let geoOffsetLeft = 0;
    let geoOffsetRight = 0;
    const intersectionEnds: ('left' | 'right')[] = [];

    for (const edge of allEdges) {
      const isA = edge.wingIdA === wingId;
      const myEnd = isA ? edge.endOfA : edge.endOfB;
      const myGeoOffset = isA ? edge.geoOffsetA : edge.geoOffsetB;
      
      const wingA = graph.nodes.get(edge.wingIdA)?.wing;
      const wingB = graph.nodes.get(edge.wingIdB)?.wing;

      // We use the true geoOffset to ensure perfect corridor intersections.
      const cappedGeoOffset = myGeoOffset;

      if (myEnd === 'left') {
        geoOffsetLeft = Math.max(geoOffsetLeft, cappedGeoOffset);
      } else {
        geoOffsetRight = Math.max(geoOffsetRight, cappedGeoOffset);
      }
      intersectionEnds.push(myEnd);
    }

    // If the geoOffsets consume the entire wing, scale them down proportionally
    // so that we have at least a tiny effective length (e.g. 0.1m) to avoid degenerate geometry.
    const totalGeoOffset = geoOffsetLeft + geoOffsetRight;
    const maxAllowedGeoOffset = Math.max(0, node.wing.length - 0.1);
    let scaled = false;
    if (totalGeoOffset > maxAllowedGeoOffset && totalGeoOffset > 0) {
      const scale = maxAllowedGeoOffset / totalGeoOffset;
      geoOffsetLeft *= scale;
      geoOffsetRight *= scale;
      scaled = true;
    }

    const effectiveLength = node.wing.length - geoOffsetLeft - geoOffsetRight;

    // Build WingGenerationOptions
    const skipLeftEndCore = intersectionEnds.includes('left');
  const skipRightEndCore = intersectionEnds.includes('right');

  const wingOptions: WingGenerationOptions = {
    skipLeftEndCore,
    skipRightEndCore,
    intersectionEnds: intersectionEnds.length > 0 ? intersectionEnds : undefined,
    skipEgress: true // Global egress validation done by orchestrator
  };

    tasks.push({
      wingId,
      wing: node.wing,
      parentWingId,
      parentEdge,
      allEdges,
      effectiveLength,
      geoOffsetLeft,
      geoOffsetRight,
      wingOptions
    });
    
    debugTasks.push({
      wingId,
      length: node.wing.length,
      geoOffsetLeft,
      geoOffsetRight,
      totalGeoOffset,
      maxAllowedGeoOffset,
      scaled,
      effectiveLength,
      intersectionEnds
    });

    // BFS: enqueue unvisited neighbors
    for (const [neighborId, edge] of node.edges) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ wingId: neighborId, parentWingId: wingId, parentEdge: edge });
      }
    }
  }

  return tasks;
}

// ============================================================================
// Section 5: Per-Wing Bar Generation
// ============================================================================

function generateWingBar(
  task: WingTask,
  config: UnitConfiguration,
  egressConfig: EgressConfig,
  corridorWidth: number,
  coreWidth: number,
  coreDepth: number,
  coreSide: 'North' | 'South',
  alignment: number,
  strategy: OptimizationStrategy,
  customColors?: UnitColorMap
): FloorPlanData {
  // Create synthetic BuildingFootprint in wing-local coordinates
  const footprint: BuildingFootprint = {
    width: task.effectiveLength,    // corridor direction
    depth: task.wing.width,         // perpendicular to corridor
    height: 0,
    centerX: task.effectiveLength / 2,
    centerY: task.wing.width / 2,
    rotation: 0,                    // local coords, no rotation
    floorZ: 0,
    minX: 0,
    maxX: task.effectiveLength,
    minY: 0,
    maxY: task.wing.width
  };

  return generateFloorplate(
    footprint, config, egressConfig,
    corridorWidth, coreWidth, coreDepth,
    coreSide, alignment, strategy,
    customColors, task.wingOptions
  );
}

/**
 * Compute the world-space transform for a wing.
 * generateFloorplate() returns wing-local geometry centered around (0,0),
 * so transform origin must be the CENTER of the trimmed wing segment.
 */
function computeWingTransform(wing: Wing, geoOffsetLeft: number, geoOffsetRight: number): WingTransform {
  const dir = wingDir(wing);
  const center = wingCenter(wing);
  const centerShiftAlongDir = (geoOffsetLeft - geoOffsetRight) / 2;
  return {
    originX: center.x + dir.x * centerShiftAlongDir,
    originY: center.y + dir.y * centerShiftAlongDir,
    angle: wing.direction
  };
}

/**
 * Transform a FloorPlanData from wing-local to world coordinates.
 */
function transformFloorPlanToWorld(
  fpd: FloorPlanData,
  transform: WingTransform
): FloorPlanData {
  const transformUnit = (u: UnitBlock): UnitBlock => {
    const worldPos = applyTransform({ x: u.x, y: u.y }, transform);
    const polyPts = u.polyPoints
      ? transformPolyPoints(u.polyPoints, transform)
      : transformPolyPoints([
          { x: u.x, y: u.y },
          { x: u.x + u.width, y: u.y },
          { x: u.x + u.width, y: u.y + u.depth },
          { x: u.x, y: u.y + u.depth }
        ], transform);
    return { ...u, x: worldPos.x, y: worldPos.y, polyPoints: polyPts };
  };

  const transformCore = (c: CoreBlock): CoreBlock => {
    const worldPos = applyTransform({ x: c.x, y: c.y }, transform);
    const polyPts = c.polyPoints
      ? transformPolyPoints(c.polyPoints, transform)
      : transformPolyPoints([
          { x: c.x, y: c.y },
          { x: c.x + c.width, y: c.y },
          { x: c.x + c.width, y: c.y + c.depth },
          { x: c.x, y: c.y + c.depth }
        ], transform);
    return { ...c, x: worldPos.x, y: worldPos.y, polyPoints: polyPts };
  };

  const transformFiller = (f: FillerBlock): FillerBlock => {
    const worldPos = applyTransform({ x: f.x, y: f.y }, transform);
    const polyPts = f.polyPoints
      ? transformPolyPoints(f.polyPoints, transform)
      : transformPolyPoints([
          { x: f.x, y: f.y },
          { x: f.x + f.width, y: f.y },
          { x: f.x + f.width, y: f.y + f.depth },
          { x: f.x, y: f.y + f.depth }
        ], transform);
    return { ...f, x: worldPos.x, y: worldPos.y, polyPoints: polyPts };
  };

  const transformCorridor = (c: CorridorBlock): CorridorBlock => {
    const worldPos = applyTransform({ x: c.x, y: c.y }, transform);
    const polyPts = c.polyPoints
      ? transformPolyPoints(c.polyPoints, transform)
      : transformPolyPoints([
          { x: c.x, y: c.y },
          { x: c.x + c.width, y: c.y },
          { x: c.x + c.width, y: c.y + c.depth },
          { x: c.x, y: c.y + c.depth }
        ], transform);
    return { ...c, x: worldPos.x, y: worldPos.y, polyPoints: polyPts };
  };

  // Transform corridor centerline endpoints (from wing-local centered coords to world)
  const cDepth = fpd.corridor.depth || DEFAULT_CORRIDOR_WIDTH;
  const clStart = applyTransform({ x: fpd.corridor.x, y: fpd.corridor.y + cDepth / 2 }, transform);
  const clEnd = applyTransform({ x: fpd.corridor.x + fpd.corridor.width, y: fpd.corridor.y + cDepth / 2 }, transform);

  return {
    ...fpd,
    units: fpd.units.map(transformUnit),
    cores: fpd.cores.map(transformCore),
    fillers: fpd.fillers.map(transformFiller),
    corridor: transformCorridor(fpd.corridor),
    corridorSegments: fpd.corridorSegments?.map(transformCorridor),
    corridorCenterline: [clStart, clEnd],
    transform: { centerX: 0, centerY: 0, rotation: 0 }
  };
}

// ============================================================================
// Section 6: Corner Geometry at Intersections
// ============================================================================

/**
 * Create a corner unit at an intersection using join geometry landmarks
 * and iterative wedge sizing. Returns the unit and optional fillers for
 * any gap between the corner unit legs and wing-bar ends.
 */
function createCornerUnit(
  joinGeom: IntersectionJoinGeometry,
  wingA: Wing,
  wingB: Wing,
  corridorWidth: number,
  targetArea: number,
  targetUnitType: UnitType,
  config: UnitConfiguration,
  customColors?: UnitColorMap
): { cornerUnit: UnitBlock | null; fillers: UnitBlock[] } {
  const { sOuter, sCorrOuter, aOuterFacadeWorld, bOuterFacadeWorld } = joinGeom;

  const dirA = wingDir(wingA);
  const dirB = wingDir(wingB);

  // Directions along outer edge away from sOuter (toward wing bar ends).
  // Use bar-end outer facade points. For a 90° L-shape, sOuter is at the building
  // corner (0,0) and aOuterFacadeWorld is at the wing bar end (20,0), giving 20m of space.
  const toBarA = subPt(aOuterFacadeWorld, sOuter);
  const awayA = (toBarA.x * toBarA.x + toBarA.y * toBarA.y > 1e-6)
    ? normalize(toBarA)
    : (dot(dirA, subPt(wingCenter(wingA), sOuter)) < 0 ? dirA : scalePt(dirA, -1));
  const toBarB = subPt(bOuterFacadeWorld, sOuter);
  const awayB = (toBarB.x * toBarB.x + toBarB.y * toBarB.y > 1e-6)
    ? normalize(toBarB)
    : (dot(dirB, subPt(wingCenter(wingB), sOuter)) < 0 ? dirB : scalePt(dirB, -1));

  const rdA = (wingA.width - corridorWidth) / 2;
  const rdB = (wingB.width - corridorWidth) / 2;
  if (rdA < 1 || rdB < 1) return { cornerUnit: null, fillers: [] };

  // Available outer edge lengths (from sOuter to wing bar-end outer facade)
  const availA = distance(sOuter, aOuterFacadeWorld);
  const availB = distance(sOuter, bOuterFacadeWorld);
  Logger.debug(`[MW] createCornerUnit availA=${availA.toFixed(2)}, availB=${availB.toFixed(2)}`);
  
  // Walls should be perpendicular to the corridor centerline, not the outer facade
  const pA = perpCCW(dirA);
  const pB = perpCCW(dirB);
  const nA_corr = dot(pA, awayB) > 0 ? pA : scalePt(pA, -1);
  const nB_corr = dot(pB, awayA) > 0 ? pB : scalePt(pB, -1);

  // Corridor directions pointing AWAY from the intersection
  const corrAwayA = dot(dirA, subPt(wingCenter(wingA), sCorrOuter)) > 0 ? dirA : scalePt(dirA, -1);
  const corrAwayB = dot(dirB, subPt(wingCenter(wingB), sCorrOuter)) > 0 ? dirB : scalePt(dirB, -1);

  // Door chamfer points (1.5m offset from the sharp inner notch)
  const p3A = addPt(sCorrOuter, scalePt(corrAwayA, 1.5));
  const p3B = addPt(sCorrOuter, scalePt(corrAwayB, 1.5));

  // Compute angle between wings
  const cosTheta = Math.max(-1, Math.min(1, dot(awayA, awayB)));
  const theta = Math.acos(cosTheta);
  const sinTheta = Math.sin(theta);
  if (sinTheta < 0.01) return { cornerUnit: null, fillers: [] };

  // Find optimal symmetric leg lengths (d) to hit target area
  const overlap = (rdA * rdB) / sinTheta;
  let cornerLeg = (targetArea + overlap) / (rdA + rdB);
  cornerLeg = Math.max(2, Math.min(cornerLeg, Math.min(availA, availB)));
  Logger.debug(`[MW] Corner unit cornerLeg=${cornerLeg.toFixed(2)}`);

  let bestD = cornerLeg; // start with analytical best guess
  let bestAreaDiff = Infinity;
  let bestPoly: Pt[] | null = null;
  // Let d go from 0 up to max(availA, availB) to allow pushing past the 
  // minimum required corner size, but don't exceed the available space
  // before hitting a core or another unit.
  const minAvail = Math.min(availA, availB);

  for (let d = cornerLeg * 0.5; d <= minAvail; d += 0.5) {
    const p1A = addPt(sOuter, scalePt(awayA, d));
    const p1B = addPt(sOuter, scalePt(awayB, d));
    const p2A = addPt(p1A, scalePt(nA_corr, rdA));
    const p2B = addPt(p1B, scalePt(nB_corr, rdB));
    const poly = [sOuter, p1A, p2A, p3A, sCorrOuter, p3B, p2B, p1B];
    const area = polygonArea({ vertices: poly });
    const diff = Math.abs(area - targetArea);
    if (diff < bestAreaDiff) {
      bestAreaDiff = diff;
      bestD = d;
      bestPoly = poly;
    }
    if (area >= targetArea) {
      bestD = d;
      bestPoly = poly;
      break;
    }
  }

  if (!bestPoly || bestD === 0) return { cornerUnit: null, fillers: [] };

  // Create filler blocks for remaining space along wings
  const fillers: UnitBlock[] = [];
  
  // Find minimum allowed unit size to see if a filler is too small
  const minUnitArea = Math.min(...[UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed].filter(t => config[t].percentage > 0).map(t => config[t].area));
  // If we don't have a valid min unit area (e.g. no percentages > 0), use a sensible default (Studio usually ~400 sqft / ~37 sqm)
  const safeMinArea = minUnitArea === Infinity ? 40 : minUnitArea;
  
  // Logic to absorb tiny fillers into the corner unit
  let expandD_A = bestD;
  let expandD_B = bestD;
  
  let fillerLengthA = availA - bestD;
  let areaA = fillerLengthA * rdA;
  if (fillerLengthA > 0 && areaA < safeMinArea) {
    // Tiny filler, corner unit absorbs it
    expandD_A = availA;
    fillerLengthA = 0;
  }
  
  let fillerLengthB = availB - bestD;
  let areaB = fillerLengthB * rdB;
  if (fillerLengthB > 0 && areaB < safeMinArea) {
    // Tiny filler, corner unit absorbs it
    expandD_B = availB;
    fillerLengthB = 0;
  }

  // RECALCULATE corner unit polygon with potential expansions
  const p1A_c = addPt(sOuter, scalePt(awayA, expandD_A));
  const p1B_c = addPt(sOuter, scalePt(awayB, expandD_B));
  const p2A_c = addPt(p1A_c, scalePt(nA_corr, rdA));
  const p2B_c = addPt(p1B_c, scalePt(nB_corr, rdB));
  const expandedPoly = [sOuter, p1A_c, p2A_c, p3A, sCorrOuter, p3B, p2B_c, p1B_c];
  const finalArea = polygonArea({ vertices: expandedPoly });
  
  // Calculate bounding box and center
  const xs = expandedPoly.map(p => p.x);
  const ys = expandedPoly.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  let polyCenterX = minX + (maxX - minX) / 2;
  let polyCenterY = minY + (maxY - minY) / 2;
  if (expandedPoly.length > 2) {
    // Simple centroid
    polyCenterX = expandedPoly.reduce((sum, p) => sum + p.x, 0) / expandedPoly.length;
    polyCenterY = expandedPoly.reduce((sum, p) => sum + p.y, 0) / expandedPoly.length;
  }

  const getUnitColor = (type: UnitType): string => {
    if (customColors && customColors[type]) return customColors[type];
    const DEFAULT_COLORS: Record<string, string> = {
      [UnitType.Studio]: '#A3D2CA',
      [UnitType.OneBed]: '#5EAAA8',
      [UnitType.TwoBed]: '#056676',
      [UnitType.ThreeBed]: '#004A55',
    };
    return DEFAULT_COLORS[type] || '#CCCCCC';
  };

  const getBestTypeForArea = (area: number): UnitType => {
    let bestType = UnitType.Studio;
    let minDiff = Infinity;
    const types = [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as UnitType[];
    for (const t of types) {
      if (config[t].percentage > 0 || t === UnitType.Studio) {
        const diff = Math.abs(config[t].area - area);
        if (diff < minDiff) {
          minDiff = diff;
          bestType = t;
        }
      }
    }
    return bestType;
  };

  const bestCornerType = getBestTypeForArea(finalArea);

  // Create corner unit
  const cornerUnit: UnitBlock = {
    id: `corner-${wingA.id}-${wingB.id}`,
    x: minX,
    y: minY,
    width: maxX - minX,
    depth: maxY - minY,
    area: finalArea,
    type: bestCornerType,
    typeId: bestCornerType,
    typeName: bestCornerType,
    color: getUnitColor(bestCornerType),
    polyPoints: expandedPoly,
    centerX: polyCenterX,
    centerY: polyCenterY
  };
  
  if (fillerLengthA > 0) {
    const numSlicesA = Math.max(1, Math.round(fillerLengthA / 6.5)); // aim for ~6.5m wide units (1BR/Studio)
    const sliceLenA = fillerLengthA / numSlicesA;
    
    for (let i = 0; i < numSlicesA; i++) {
      const p1_start = addPt(sOuter, scalePt(awayA, expandD_A + i * sliceLenA));
      const p1_end = addPt(sOuter, scalePt(awayA, expandD_A + (i + 1) * sliceLenA));
      const p2_start = addPt(p1_start, scalePt(nA_corr, rdA));
      const p2_end = addPt(p1_end, scalePt(nA_corr, rdA));
      const fillerPolyA = [p1_start, p1_end, p2_end, p2_start];
      
      const areaA = polygonArea({ vertices: fillerPolyA });
      
      const fXs = fillerPolyA.map(p => p.x);
      const fYs = fillerPolyA.map(p => p.y);
      const fMinX = Math.min(...fXs);
      const fMaxX = Math.max(...fXs);
      const fMinY = Math.min(...fYs);
      const fMaxY = Math.max(...fYs);

      const bestTypeA = getBestTypeForArea(areaA);
      fillers.push({
        id: `filler-corner-A-${wingA.id}-${i}`,
        x: fMinX, y: fMinY, width: fMaxX - fMinX, depth: fMaxY - fMinY,
        area: areaA,
        type: bestTypeA,
        typeId: bestTypeA,
        typeName: bestTypeA,
        color: getUnitColor(bestTypeA),
        polyPoints: fillerPolyA,
        centerX: fillerPolyA.reduce((sum, p) => sum + p.x, 0) / fillerPolyA.length,
        centerY: fillerPolyA.reduce((sum, p) => sum + p.y, 0) / fillerPolyA.length
      });
    }
  }

  if (fillerLengthB > 0) {
    const numSlicesB = Math.max(1, Math.round(fillerLengthB / 6.5)); // aim for ~6.5m wide units (1BR/Studio)
    const sliceLenB = fillerLengthB / numSlicesB;
    
    for (let i = 0; i < numSlicesB; i++) {
      const p1_start = addPt(sOuter, scalePt(awayB, expandD_B + i * sliceLenB));
      const p1_end = addPt(sOuter, scalePt(awayB, expandD_B + (i + 1) * sliceLenB));
      const p2_start = addPt(p1_start, scalePt(nB_corr, rdB));
      const p2_end = addPt(p1_end, scalePt(nB_corr, rdB));
      const fillerPolyB = [p1_start, p1_end, p2_end, p2_start];
      
      const areaB = polygonArea({ vertices: fillerPolyB });

      const fXs = fillerPolyB.map(p => p.x);
      const fYs = fillerPolyB.map(p => p.y);
      const fMinX = Math.min(...fXs);
      const fMaxX = Math.max(...fXs);
      const fMinY = Math.min(...fYs);
      const fMaxY = Math.max(...fYs);

      const bestTypeB = getBestTypeForArea(areaB);
      fillers.push({
        id: `filler-corner-B-${wingB.id}-${i}`,
        x: fMinX, y: fMinY, width: fMaxX - fMinX, depth: fMaxY - fMinY,
        area: areaB,
        type: bestTypeB,
        typeId: bestTypeB,
        typeName: bestTypeB,
        color: getUnitColor(bestTypeB),
        polyPoints: fillerPolyB,
        centerX: fillerPolyB.reduce((sum, p) => sum + p.x, 0) / fillerPolyB.length,
        centerY: fillerPolyB.reduce((sum, p) => sum + p.y, 0) / fillerPolyB.length
      });
    }
  }

  return { cornerUnit, fillers };
}

/**
 * Create corridor segments connecting two bar corridors through the geoOffset zone.
 * Uses a 6-point mitered L-polygon (bar-end to bar-end through the miter turn) plus
 * two rectangular extensions from far (original) wing boundaries to the bar ends,
 * filling the full corridor through the trimmed zone.
 */
/**
 * Create four discrete corridor segments at an intersection.
 *
 * Bug 8 spec: the corridor through an intersection is split into four
 * quadrilateral segments connecting at two key points:
 *   Point 1 (sCorrOuter) — corridor outer edges meet (convex/facade side)
 *   Point 2 (sCorrInner) — corridor inner edges meet (concave side)
 *
 * Segments:
 *   A: Wing A junction quad — aCorrOuterWorld → sCorrOuter → sCorrInner → aCorrInnerWorld
 *   B: Wing B junction quad — bCorrOuterWorld → sCorrOuter → sCorrInner → bCorrInnerWorld
 *   C: Wing A extension rect — aFarCorrOuter → aCorrOuterWorld → aCorrInnerWorld → aFarCorrInner
 *   D: Wing B extension rect — bFarCorrOuter → bCorrOuterWorld → bCorrInnerWorld → bFarCorrInner
 *
 * Each segment is an independent quad that tiles without overlap at Point 1/2.
 * This naturally composes for C/snake where a middle wing has two intersections.
 */
function createCorridorWedge(
  joinGeom: IntersectionJoinGeometry,
  corridorWidth: number
): CorridorBlock[] {
  const segments: CorridorBlock[] = [];

  const {
    aCorrOuterWorld, aCorrInnerWorld,
    bCorrOuterWorld, bCorrInnerWorld,
    sCorrOuter, sCorrInner   // Point 1 (outer), Point 2 (inner)
  } = joinGeom;

  // Helper to push a valid segment
  const pushSeg = (poly: Pt[], label: string) => {
    const area = polyAreaAbs(poly);
    if (area < 0.1) return;
    const validPoly = validateCorridorWedge(poly, corridorWidth);
    const cx = validPoly.reduce((s, p) => s + p.x, 0) / validPoly.length;
    const cy = validPoly.reduce((s, p) => s + p.y, 0) / validPoly.length;

    segments.push({
      x: cx, y: cy,
      width: Math.max(...validPoly.map(p => p.x)) - Math.min(...validPoly.map(p => p.x)),
      depth: corridorWidth,
      polyPoints: validPoly
    });
  };

  // Segment A: Wing A junction quad (bar end → Point 1/2)
  pushSeg([aCorrOuterWorld, sCorrOuter, sCorrInner, aCorrInnerWorld], 'WingA');

  // Segment B: Wing B junction quad (bar end → Point 1/2)
  pushSeg([bCorrOuterWorld, sCorrOuter, sCorrInner, bCorrInnerWorld], 'WingB');

  return segments;
}

function findIntersectionEdgeForWing(
  wing: Wing,
  intersection: WingIntersection,
  task: WingTask
): 'left' | 'right' {
  for (const edge of task.allEdges) {
    if (edge.intersection === intersection) {
      const isA = edge.wingIdA === wing.id;
      return isA ? edge.endOfA : edge.endOfB;
    }
  }
  // Fallback: use geometric test
  return determineWingEnd(wing, { x: intersection.point.x, y: intersection.point.y });
}

interface IntersectionJoinGeometry {
  edgeA: 'left' | 'right';
  edgeB: 'left' | 'right';
  aCorrInnerWorld: Pt;
  aCorrOuterWorld: Pt;
  bCorrInnerWorld: Pt;
  bCorrOuterWorld: Pt;
  sCorrInner: Pt;
  sCorrOuter: Pt;
  aInnerFacadeWorld: Pt;
  bInnerFacadeWorld: Pt;
  aOuterFacadeWorld: Pt;
  bOuterFacadeWorld: Pt;
  sOuter: Pt;
  sInnerFacade: Pt;
  aTipCorrInner: Pt;
  aTipCorrOuter: Pt;
  bTipCorrInner: Pt;
  bTipCorrOuter: Pt;
  aTipInnerFacade: Pt;
  bTipInnerFacade: Pt;
  aTipOuterFacade: Pt;
  bTipOuterFacade: Pt;
  dirA: Pt;
  dirB: Pt;
  // Far reference points: at original (untrimmed) wing boundary, geoOffset beyond bar end
  aFarOuterFacade: Pt;
  bFarOuterFacade: Pt;
  aFarCorrOuter: Pt;
  bFarCorrOuter: Pt;
  aFarCorrInner: Pt;
  bFarCorrInner: Pt;
  availA?: number;
  availB?: number;
}

function computeIntersectionJoinGeometry(
  intersection: WingIntersection,
  wingA: Wing,
  wingB: Wing,
  transformA: WingTransform,
  transformB: WingTransform,
  taskA: WingTask,
  taskB: WingTask,
  corridorWidth: number,
  fpdA?: import('./types').FloorPlanData,
  fpdB?: import('./types').FloorPlanData
): IntersectionJoinGeometry | null {
  const interPt: Pt = { x: intersection.point.x, y: intersection.point.y };

  // Which end of each wing faces the intersection
  const edgeA = findIntersectionEdgeForWing(wingA, intersection, taskA);
  const edgeB = findIntersectionEdgeForWing(wingB, intersection, taskB);
  const dirA = wingDir(wingA);
  const dirB = wingDir(wingB);

  // Compute geometric steal: how far back from the wing tip the intersection
  // geometry landmarks should be placed. Since the wing is already trimmed by 
  // geoOffset, the wing tip is exactly at the geometric steal boundary!
  const stealA = 0;
  const stealB = 0;

  // Local X at the steal boundary (pulled back from wing tip by steal distance)
  const wingTipA = edgeA === 'left' ? -taskA.effectiveLength / 2 : taskA.effectiveLength / 2;
  const wingTipB = edgeB === 'left' ? -taskB.effectiveLength / 2 : taskB.effectiveLength / 2;
  const stealSignA = edgeA === 'left' ? 1 : -1;
  const stealSignB = edgeB === 'left' ? 1 : -1;
  const aLocalX = wingTipA + stealSignA * stealA;
  const bLocalX = wingTipB + stealSignB * stealB;

  // Determine inner side using cross-product approach (robust, not distance-based).
  // The "inner side" of wing A is the side that faces toward wing B's body.
  // We find the direction from interPt along each wing axis toward its center,
  // then check which local-Y direction of wing A has a positive component toward wing B.
  const cA = wingCenter(wingA);
  const cB = wingCenter(wingB);
  const awayA = dot(dirA, subPt(cA, interPt)) >= 0 ? dirA : scalePt(dirA, -1);
  const awayB = dot(dirB, subPt(cB, interPt)) >= 0 ? dirB : scalePt(dirB, -1);

  // We want the side relative to the wing's +Y axis, which is perpCCW(dir)
  const innerSideA = dot(awayB, perpCCW(dirA)) >= 0 ? 1 : -1;
  const innerSideB = dot(awayA, perpCCW(dirB)) >= 0 ? 1 : -1;

  Logger.debug(`[MW] Inner side detection: wingA=${wingA.id} innerSide=${innerSideA}, wingB=${wingB.id} innerSide=${innerSideB}, method=cross-product`);

  // In centered coords, the building cross-section along Y is:
  //   -width/2 ... -corridorWidth/2 ... +corridorWidth/2 ... +width/2
  // The corridor band is from -cw/2 to +cw/2.
  // "Inner" = toward concave vertex = innerSide direction.
  //
  // Corridor inner edge = innerSide * corridorWidth/2 (corridor edge toward concave)
  // Corridor outer edge = -innerSide * corridorWidth/2 (corridor edge toward convex)
  // Inner facade = innerSide * width/2 (building edge on concave side)
  // Outer facade = -innerSide * width/2 (building edge on convex side)

  const aCorrInnerWorld = applyTransform({ x: aLocalX, y: innerSideA * corridorWidth / 2 }, transformA);
  const aCorrOuterWorld = applyTransform({ x: aLocalX, y: -innerSideA * corridorWidth / 2 }, transformA);
  const bCorrInnerWorld = applyTransform({ x: bLocalX, y: innerSideB * corridorWidth / 2 }, transformB);
  const bCorrOuterWorld = applyTransform({ x: bLocalX, y: -innerSideB * corridorWidth / 2 }, transformB);

  const aInnerFacadeWorld = applyTransform({ x: aLocalX, y: innerSideA * wingA.width / 2 }, transformA);
  const bInnerFacadeWorld = applyTransform({ x: bLocalX, y: innerSideB * wingB.width / 2 }, transformB);
  const aOuterFacadeWorld = applyTransform({ x: aLocalX, y: -innerSideA * wingA.width / 2 }, transformA);
  const bOuterFacadeWorld = applyTransform({ x: bLocalX, y: -innerSideB * wingB.width / 2 }, transformB);

  // Wing-tip points (at actual wing end, no steal) for corridor wedge endpoints
  const aTipCorrInner = applyTransform({ x: wingTipA, y: innerSideA * corridorWidth / 2 }, transformA);
  const aTipCorrOuter = applyTransform({ x: wingTipA, y: -innerSideA * corridorWidth / 2 }, transformA);
  const bTipCorrInner = applyTransform({ x: wingTipB, y: innerSideB * corridorWidth / 2 }, transformB);
  const bTipCorrOuter = applyTransform({ x: wingTipB, y: -innerSideB * corridorWidth / 2 }, transformB);
  const aTipInnerFacade = applyTransform({ x: wingTipA, y: innerSideA * wingA.width / 2 }, transformA);
  const bTipInnerFacade = applyTransform({ x: wingTipB, y: innerSideB * wingB.width / 2 }, transformB);
  const aTipOuterFacade = applyTransform({ x: wingTipA, y: -innerSideA * wingA.width / 2 }, transformA);
  const bTipOuterFacade = applyTransform({ x: wingTipB, y: -innerSideB * wingB.width / 2 }, transformB);

  // 4 miter points: intersect matched boundary lines from each wing
  const sCorrInner = llIntersect(aCorrInnerWorld, dirA, bCorrInnerWorld, dirB);
  const sCorrOuter = llIntersect(aCorrOuterWorld, dirA, bCorrOuterWorld, dirB);
  const sOuter = llIntersect(aOuterFacadeWorld, dirA, bOuterFacadeWorld, dirB);
  const sInnerFacade = llIntersect(aInnerFacadeWorld, dirA, bInnerFacadeWorld, dirB);

  // Safety clamp: if the intersection is insanely far away (e.g. wings are nearly parallel), reject the miter
  if (sOuter && distance(sOuter, aOuterFacadeWorld) > 100.0) {
    Logger.debug(`[MW] Intersection miter rejected (too far): wings ${wingA.id}-${wingB.id}`);
    return null;
  }


  if (!sCorrInner || !sCorrOuter || !sOuter || !sInnerFacade) {
    Logger.debug(`[MW] Intersection miter failed: wings ${wingA.id}-${wingB.id}`);
    return null;
  }

  Logger.debug(`[MW] sOuter=(${sOuter.x.toFixed(2)},${sOuter.y.toFixed(2)}), sInnerFacade=(${sInnerFacade.x.toFixed(2)},${sInnerFacade.y.toFixed(2)})`);
  Logger.debug(`[MW] aTipInnerFacade=(${aTipInnerFacade.x.toFixed(2)},${aTipInnerFacade.y.toFixed(2)}), bTipInnerFacade=(${bTipInnerFacade.x.toFixed(2)},${bTipInnerFacade.y.toFixed(2)})`);
  Logger.debug(`[MW] Corridor miter: sCorrOuter=(${sCorrOuter.x.toFixed(2)},${sCorrOuter.y.toFixed(2)}), sCorrInner=(${sCorrInner.x.toFixed(2)},${sCorrInner.y.toFixed(2)})`);


  // Far reference points: at the original (untrimmed) wing boundary.
  // The wing bar was trimmed by geoOffset; the far points are geoOffset beyond the bar end,
  // restoring the original wing boundary position before trimming.
  const geoA = edgeA === 'left' ? taskA.geoOffsetLeft : taskA.geoOffsetRight;
  const geoB = edgeB === 'left' ? taskB.geoOffsetLeft : taskB.geoOffsetRight;
  const farLocalA = wingTipA - stealSignA * geoA;
  const farLocalB = wingTipB - stealSignB * geoB;

  const aFarOuterFacade = applyTransform({ x: farLocalA, y: -innerSideA * wingA.width / 2 }, transformA);
  const bFarOuterFacade = applyTransform({ x: farLocalB, y: -innerSideB * wingB.width / 2 }, transformB);
  const aFarCorrOuter = applyTransform({ x: farLocalA, y: -innerSideA * corridorWidth / 2 }, transformA);
  const bFarCorrOuter = applyTransform({ x: farLocalB, y: -innerSideB * corridorWidth / 2 }, transformB);
  const aFarCorrInner = applyTransform({ x: farLocalA, y: innerSideA * corridorWidth / 2 }, transformA);
  const bFarCorrInner = applyTransform({ x: farLocalB, y: innerSideB * corridorWidth / 2 }, transformB);


  Logger.debug(`[MW] Far outer: A=(${aFarOuterFacade.x.toFixed(2)},${aFarOuterFacade.y.toFixed(2)}), B=(${bFarOuterFacade.x.toFixed(2)},${bFarOuterFacade.y.toFixed(2)})`);

  // Helper to calculate actual available space up to the nearest outer block
  const calcAvail = (
    sOut: Pt, awayD: Pt, outFac: Pt, inFac: Pt, width: number, fpd?: import('./types').FloorPlanData
  ) => {
    let baseDist = distance(sOut, outFac);
    if (!fpd || (!fpd.units.length && !fpd.cores.length)) return baseDist + 5; // Fallback
    
    const crossDir = normalize(subPt(inFac, outFac));
    let minD = Infinity;
    
    const checkBlock = (b: {x:number, y:number, width:number, depth:number, polyPoints?: Pt[]}) => {
      // Create poly if missing
      const poly = b.polyPoints && b.polyPoints.length > 2 
        ? b.polyPoints 
        : [
            { x: b.x, y: b.y },
            { x: b.x + b.width, y: b.y },
            { x: b.x + b.width, y: b.y + b.depth },
            { x: b.x, y: b.y + b.depth }
          ];
          
      // Centroid
      const centroid = {
        x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
        y: poly.reduce((s, p) => s + p.y, 0) / poly.length
      };
      
      const distToOut = dot(subPt(centroid, outFac), crossDir);
      if (distToOut < width * 0.6) {
        // It is on the outer side
        for (const v of poly) {
          const d = dot(subPt(v, sOut), awayD);
          if (d > 0 && d < minD) {
            minD = d;
          }
        }
      }
    };
    
    fpd.units.forEach(checkBlock);
    fpd.cores.forEach(checkBlock);
    
    // Add a tiny tolerance to prevent floating point issues or literal zero gaps
    return minD === Infinity ? baseDist + 5 : Math.max(baseDist, minD - 0.05);
  };

  // Provide available space on outer sides (this helps generator-core know how much space it can expand units into)
  const availA = calcAvail(sOuter, awayA, aOuterFacadeWorld, aInnerFacadeWorld, wingA.width, fpdA);
  const availB = calcAvail(sOuter, awayB, bOuterFacadeWorld, bInnerFacadeWorld, wingB.width, fpdB);

  // Return join geom
  return {
    edgeA,
    edgeB,
    aCorrInnerWorld,
    aCorrOuterWorld,
    bCorrInnerWorld,
    bCorrOuterWorld,
    sCorrInner,
    sCorrOuter,
    aInnerFacadeWorld,
    bInnerFacadeWorld,
    aOuterFacadeWorld,
    bOuterFacadeWorld,
    sOuter,
    sInnerFacade,
    aTipCorrInner,
    aTipCorrOuter,
    bTipCorrInner,
    bTipCorrOuter,
    aTipInnerFacade,
    bTipInnerFacade,
    aTipOuterFacade,
    bTipOuterFacade,
    dirA,
    dirB,
    aFarOuterFacade,
    bFarOuterFacade,
    aFarCorrOuter,
    bFarCorrOuter,
    aFarCorrInner,
    bFarCorrInner,
    availA,
    availB
  };
}

/**
 * Create the inner core polygon at an intersection.
 *
 * Builds the concave dark zone where two wings meet. This is NOT a stairwell/
 * elevator core — wing bars already have their own end cores. This polygon
 * defines the intersection zone's inner boundary, used for:
 *   1. Overlap filtering: wing-bar units/cores inside this polygon are removed
 *   2. Apartment fill: converted to a TwoBed-colored fill unit in assembleFloorPlan
 *
 * Polygon variants:
 *
 *   Compact (4 vertices):
 *     [sCorrOuter, aCorrInnerWorld, sCorrInner, bCorrInnerWorld]
 *     Small quad anchored at the corridor miter points.
 *
 *   Extended (7 vertices — captures full L-shaped dark zone):
 *     [sCorrOuter, aTipInnerFacade, sInnerFacade, bTipInnerFacade,
 *      bCorrInnerWorld, sCorrInner, aCorrInnerWorld]
 *     Adds inner facade vertices to fill the area between corridors and facades.
 *
 * Selection: extended polygon is used when extendedArea > compactArea * 1.05.
 *
 * INVARIANTS (see .cursor/rules/core-generation.md):
 *   - Vertices must be in explicit perimeter order (never radially sorted)
 *   - All facade tip points use trimmed wing boundaries (after geoOffset)
 *   - At acute angles (< 50°), sInnerFacade can be very far — the extended
 *     polygon may be oversized. This is a known limitation.
 */
function createInnerCore(
  joinGeom: IntersectionJoinGeometry
): CoreBlock | null {
  // Inner core polygon must stay on the concave (inner) side of the corridor.
  // We use a 6-point L-shaped hexagon that traces the inner corridor edges and inner facades.
  const polyPoints = [
    joinGeom.aCorrInnerWorld,    // Wing A corridor inner edge at bar end
    joinGeom.sCorrInner,         // corridor-corridor intersection (concave side)
    joinGeom.bCorrInnerWorld,    // Wing B corridor inner edge at bar end
    joinGeom.bTipInnerFacade,    // Wing B inner facade at bar end
    joinGeom.sInnerFacade,       // Inner facade intersection (concave vertex)
    joinGeom.aTipInnerFacade,    // Wing A inner facade at bar end
  ];

  const area = polyAreaAbs(polyPoints);

  if (area < 0.5) return null;

  const minX = Math.min(...polyPoints.map(p => p.x));
  const maxX = Math.max(...polyPoints.map(p => p.x));
  const minY = Math.min(...polyPoints.map(p => p.y));
  const maxY = Math.max(...polyPoints.map(p => p.y));

  return {
    id: 'inner-core',
    x: minX,
    y: minY,
    width: maxX - minX,
    depth: maxY - minY,
    type: 'End',
    side: 'North',
    polyPoints
  };
}

// ============================================================================
// Section 7: Validation & Clipping
// ============================================================================

/**
 * Self-intersection guard for corridor wedges.
 * If miter distance exceeds 2x corridor width (acute angle), bevel the join.
 */
function validateCorridorWedge(wedgePoly: Pt[], _corridorWidth: number): Pt[] {
  if (wedgePoly.length < 3) return wedgePoly;

  const result = lineIntersection(
    { start: wedgePoly[0], end: wedgePoly[2] },
    { start: wedgePoly[1], end: wedgePoly[3] }
  );
  if (!result.intersects || result.t1! <= 0.01 || result.t1! >= 0.99 ||
      result.t2! <= 0.01 || result.t2! >= 0.99) {
    // If diagonals don't intersect properly, it's self-intersecting (hourglass shape)
    // Or it's a bow-tie. Swap the last two vertices to fix winding order.
    return [wedgePoly[0], wedgePoly[1], wedgePoly[3], wedgePoly[2]];
  }

  return wedgePoly;
}

/**
 * Check that all unit coordinates are finite (no NaN/Infinity).
 */
function validateFiniteCoordinates(units: UnitBlock[]): void {
  for (const u of units) {
    if (!isFinite(u.x) || !isFinite(u.y) || !isFinite(u.area)) {
      Logger.debug(`[MW] Unit ${u.id} has non-finite coordinates: x=${u.x}, y=${u.y}, area=${u.area}`);
      u.x = 0;
      u.y = 0;
      u.area = 0;
    }
    if (u.polyPoints) {
      for (const p of u.polyPoints) {
        if (!isFinite(p.x) || !isFinite(p.y)) {
          Logger.debug(`[MW] Unit ${u.id} has non-finite polyPoint`);
          p.x = 0;
          p.y = 0;
        }
      }
    }
  }
}

function blockToPoly(block: { x: number; y: number; width: number; depth: number; polyPoints?: Pt[] }): Pt[] {
  if (block.polyPoints && block.polyPoints.length >= 3) return block.polyPoints;
  return [
    { x: block.x, y: block.y },
    { x: block.x + block.width, y: block.y },
    { x: block.x + block.width, y: block.y + block.depth },
    { x: block.x, y: block.y + block.depth }
  ];
}

function polygonsOverlapInterior(polyA: Pt[], polyB: Pt[]): boolean {
  const nA = polyA.length;
  const nB = polyB.length;
  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % nA];
    for (let j = 0; j < nB; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % nB];
      const result = lineIntersection({ start: a1, end: a2 }, { start: b1, end: b2 });
      if (result.intersects && result.t1 !== undefined && result.t2 !== undefined &&
          result.t1 > 1e-4 && result.t1 < 1 - 1e-4 &&
          result.t2 > 1e-4 && result.t2 < 1 - 1e-4) {
        return true;
      }
    }
  }
  // Full containment check using a single interior point (centroid)
  // This is more robust than just checking the first vertex, which can fail for complex shapes.
  
  const centroidA = {
    x: polyA.reduce((sum, p) => sum + p.x, 0) / polyA.length,
    y: polyA.reduce((sum, p) => sum + p.y, 0) / polyA.length
  };
  
  const centroidB = {
    x: polyB.reduce((sum, p) => sum + p.x, 0) / polyB.length,
    y: polyB.reduce((sum, p) => sum + p.y, 0) / polyB.length
  };

  return pointInPolygon({ vertices: polyA }, centroidB) || pointInPolygon({ vertices: polyB }, centroidA);
}

// ============================================================================
// Section 8: Assembly
// ============================================================================

/**
 * Stitch per-wing bar results and intersection geometry into a single FloorPlanData.
 *
 * OVERLAP FILTERING PIPELINE (order matters — do not reorder):
 *   1. Merge wing-bar units, cores, fillers into allUnits/allCores/allFillers
 *   2. Add corner units to allUnits (if includeIntersectionCustomUnits)
 *   3. Add corridor wedges to corridorSegments
 *   4. Block wing-bar units whose centroids fall inside any intersection polygon
 *   5. Filter wing-bar cores overlapping intersectionReservePolys
 *   6. Filter wing-bar fillers overlapping intersectionReservePolys
 *   7. Convert inner cores to TwoBed-colored fill units (id: inner-fill-*)
 *   8. Convert corner fillers to OneBed-colored fill units (id: corner-fill-*)
 *
 * intersectionReservePolys MUST include all 4 types: inner cores, corridor
 * wedges, corner units, corner fillers. Removing any causes overlap.
 *
 * See .cursor/rules/core-generation.md for invariants.
 */
function assembleFloorPlan(
  wingResults: Array<{ fpd: FloorPlanData; task: WingTask; transform: WingTransform }>,
  cornerUnits: UnitBlock[],
  corridorWedges: CorridorBlock[],
  innerCores: CoreBlock[],
  cornerFillers: FillerBlock[],
  polygon: Pt[],
  analysis: MultiWingAnalysis,
  egressConfig: EgressConfig,
  corridorWidth: number,
  includeIntersectionCustomUnits: boolean
): FloorPlanData {
  let allUnits: UnitBlock[] = [];
  let allCores: CoreBlock[] = [];
  let allFillers: FillerBlock[] = [];
  let corridorSegments: CorridorBlock[] = [];
  const corridorCenterline: Pt[] = [];
  const wingCenterlineSegments: Array<{ wingId: number; start: Pt; end: Pt }> = [];

  let unitId = 0;
  let coreId = 0;
  let fillerId = 0;

  // Merge wing results
  for (const { fpd, task } of wingResults) {
    let st=0, ob=0, tb=0, thb=0;
    for (const u of fpd.units) {
      if (u.type === UnitType.Studio) st++;
      else if (u.type === UnitType.OneBed) ob++;
      else if (u.type === UnitType.TwoBed) tb++;
      else if (u.type === UnitType.ThreeBed) thb++;
    }
    for (const u of fpd.units) {
      allUnits.push({ ...u, id: `unit-${++unitId}` });
    }
    for (const c of fpd.cores) {
      allCores.push({ ...c, id: `core-${++coreId}` });
    }
    for (const f of fpd.fillers) {
      allFillers.push({ ...f, id: `filler-${++fillerId}` });
    }

    // Add corridor from this wing
    corridorSegments.push(fpd.corridor);
    if (fpd.corridorCenterline && fpd.corridorCenterline.length >= 2) {
      const start = fpd.corridorCenterline[0];
      const end = fpd.corridorCenterline[fpd.corridorCenterline.length - 1];
      corridorCenterline.push(start, end);
      wingCenterlineSegments.push({ wingId: task.wingId, start, end });
    }
  }
  const baseWingUnits = [...allUnits];

  // Add corner units
  for (const cu of cornerUnits) {
    if (cu) {
      cu.id = `unit-${++unitId}`;
      allUnits.push(cu);
    }
  }

  // Add fillers
  for (const f of cornerFillers) {
    if (f) {
      f.id = `filler-${++fillerId}`;
      allFillers.push(f);
    }
  }

  // Add corridor wedges
  for (const cw of corridorWedges) {
    corridorSegments.push(cw);
  }

  // Inner cores and corner fillers are NOT added as dark core blocks.
  // Instead, they are converted to apartment-colored fill units below,
  // since the concave zone and filler gaps are apartment space (wing bars
  // already have their own elevator/stair cores).

  const innerIntersections = analysis.intersections.filter(i => i.type === 'inner');
  const interPoints = innerIntersections.map(i => ({ x: i.point.x, y: i.point.y }));

  const unitCentroid = (u: UnitBlock): Pt => {
    if (u.polyPoints && u.polyPoints.length >= 3) {
      return {
        x: u.polyPoints.reduce((s, p) => s + p.x, 0) / u.polyPoints.length,
        y: u.polyPoints.reduce((s, p) => s + p.y, 0) / u.polyPoints.length
      };
    }
    return { x: u.x + u.width / 2, y: u.y + u.depth / 2 };
  };
  const cornerUnitPolys: Pt[][] = cornerUnits.map(cu => blockToPoly(cu));
  const corePolys: Pt[][] = innerCores.map(ic => blockToPoly(ic));
  const fillerPolys: Pt[][] = cornerFillers.map(cf => blockToPoly(cf));
  const wedgePolys: Pt[][] = corridorWedges.map(w => blockToPoly(w));
  const blockedWingUnitIds = new Set<string>();
  for (const wu of baseWingUnits) {
    const centroid = unitCentroid(wu);
    const centroidInCorner = cornerUnitPolys.some(poly => pointInPolygon({ vertices: poly }, centroid));
    const centroidInWedge = wedgePolys.some(poly => pointInPolygon({ vertices: poly }, centroid));
    const centroidInFiller = fillerPolys.some(poly => pointInPolygon({ vertices: poly }, centroid));
    const overlapsCore = corePolys.some(poly =>
      pointInPolygon({ vertices: poly }, centroid) ||
      polygonsOverlapInterior(blockToPoly(wu), poly)
    );
    if (centroidInCorner || centroidInWedge || centroidInFiller || overlapsCore) {
      blockedWingUnitIds.add(wu.id);
    }
  }
  if (blockedWingUnitIds.size > 0) {
    allUnits = allUnits.filter(u => !blockedWingUnitIds.has(u.id));
  }
  const coreCenter = (c: CoreBlock): Pt => {
    if (c.polyPoints && c.polyPoints.length >= 3) {
      return {
        x: c.polyPoints.reduce((s, p) => s + p.x, 0) / c.polyPoints.length,
        y: c.polyPoints.reduce((s, p) => s + p.y, 0) / c.polyPoints.length
      };
    }
    return { x: c.x + c.width / 2, y: c.y + c.depth / 2 };
  };
  const intersectionReservePolys: Pt[][] = [
    ...innerCores.map(ic => blockToPoly(ic)),
    ...corridorWedges.map(w => blockToPoly(w)),
    ...cornerUnits.map(cu => blockToPoly(cu)),
    ...cornerFillers.map(cf => blockToPoly(cf))
  ];
  allCores = allCores.filter(c => {
    if (intersectionReservePolys.length === 0) return true;
    const cPoly = blockToPoly(c);
    const cCenter = coreCenter(c);
    return !intersectionReservePolys.some(rp =>
      polygonsOverlapInterior(cPoly, rp) || pointInPolygon({ vertices: rp }, cCenter)
    );
  });
  allFillers = allFillers.filter(f => {
    if (intersectionReservePolys.length === 0) return true;
    const fPoly = blockToPoly(f);
    const fCenter: Pt = { x: f.x + f.width / 2, y: f.y + f.depth / 2 };
    return !intersectionReservePolys.some(rp =>
      polygonsOverlapInterior(fPoly, rp) || pointInPolygon({ vertices: rp }, fCenter)
    );
  });

  // Add inner cores as actual egress cores instead of converting them to apartments
  for (const ic of innerCores) {
    allCores.push({ ...ic, id: `inner-core-final-${++coreId}` });
  }

  // Validate coordinates
  validateFiniteCoordinates(allUnits);

  const unitCountsMap: Record<string, number> = {};
  let nrsf = 0;
  for (const u of allUnits) {
    nrsf += u.area;
    unitCountsMap[u.typeId] = (unitCountsMap[u.typeId] ?? 0) + 1;
  }

  // GSF via Shoelace
  const ccwPoly = ensureCounterClockwise({ vertices: polygon });
  const gsf = polygonArea({ vertices: ccwPoly });
  const totalUnitCount = allUnits.length;
  const efficiency = gsf > 0 ? nrsf / gsf : 0;

  // AABB for dimensions
  const polyMinX = polygon.reduce((m, v) => Math.min(m, v.x), Infinity);
  const polyMaxX = polygon.reduce((m, v) => Math.max(m, v.x), -Infinity);
  const polyMinY = polygon.reduce((m, v) => Math.min(m, v.y), Infinity);
  const polyMaxY = polygon.reduce((m, v) => Math.max(m, v.y), -Infinity);

  // Egress validation via corridor graph
  const wingCenterlines = wingResults.map(({ fpd }) => {
    const cl = fpd.corridorCenterline;
    if (cl && cl.length >= 2) {
      return { start: cl[0], end: cl[cl.length - 1] };
    }
    // Fallback: use corridor position
    return {
      start: { x: fpd.corridor.x, y: fpd.corridor.y },
      end: { x: fpd.corridor.x + fpd.corridor.width, y: fpd.corridor.y }
    };
  });

  const corePositions = allCores.map(c => {
    if (c.polyPoints && c.polyPoints.length >= 3) {
      const cx = c.polyPoints.reduce((s, p) => s + p.x, 0) / c.polyPoints.length;
      const cy = c.polyPoints.reduce((s, p) => s + p.y, 0) / c.polyPoints.length;
      return { x: cx, y: cy };
    }
    return { x: c.x + c.width / 2, y: c.y + c.depth / 2 };
  });

  const graph = buildCorridorGraph(wingCenterlines, interPoints, corePositions);

  let maxDeadEnd = 0;
  let maxTravel = 0;
  for (let i = 0; i < graph.nodes.length; i++) {
    if (!graph.nodes[i].isCore) {
      const d = shortestPathToCore(graph, i);
      if (d < Infinity) {
        maxDeadEnd = Math.max(maxDeadEnd, d);
        maxTravel = Math.max(maxTravel, d);
      }
    }
  }

  const deadEndLimit = egressConfig.deadEndLimit ?? 15.24;
  const travelLimit = egressConfig.travelDistanceLimit ?? 76.2;

  // Primary corridor for backward compat
  let primaryCorridor = corridorSegments[0] ?? {
    x: 0, y: 0, width: 10, depth: corridorWidth
  };

  // Build corridor graph representation for FloorPlanData.
  // For multi-wing, connect each wing centerline to computed centerline join nodes
  // so dashed dimension segments meet at the same intersection point.
  let corridorGraphNodes: Pt[] = [];
  let corridorGraphEdges: [number, number][] = [];
  if (wingCenterlineSegments.length > 0) {
    const nodeMap = new Map<string, number>();
    const edgeSet = new Set<string>();
    const snap = 1e-4;

    const nodeKey = (p: Pt): string => `${Math.round(p.x / snap)}:${Math.round(p.y / snap)}`;
    const addNode = (p: Pt): number => {
      const key = nodeKey(p);
      const existing = nodeMap.get(key);
      if (existing !== undefined) return existing;
      const idx = corridorGraphNodes.length;
      corridorGraphNodes.push(p);
      nodeMap.set(key, idx);
      return idx;
    };
    const addEdge = (a: Pt, b: Pt): void => {
      if (distance(a, b) < 1e-6) return;
      const ai = addNode(a);
      const bi = addNode(b);
      if (ai === bi) return;
      const key = ai < bi ? `${ai}-${bi}` : `${bi}-${ai}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      corridorGraphEdges.push([ai, bi]);
    };

    const segmentByWingId = new Map<number, { wingId: number; start: Pt; end: Pt }>(
      wingCenterlineSegments.map(seg => [seg.wingId, seg])
    );
    const joinPointsByWing = new Map<number, Pt[]>();

    for (const intersection of innerIntersections) {
      const [wingAId, wingBId] = intersection.wingIds;
      const segA = segmentByWingId.get(wingAId);
      const segB = segmentByWingId.get(wingBId);
      if (!segA || !segB) continue;

      const dirA = normalize(subPt(segA.end, segA.start));
      const dirB = normalize(subPt(segB.end, segB.start));
      if (distance(dirA, { x: 0, y: 0 }) < 1e-9 || distance(dirB, { x: 0, y: 0 }) < 1e-9) continue;

      const join = llIntersect(segA.start, dirA, segB.start, dirB);
      if (!join || !Number.isFinite(join.x) || !Number.isFinite(join.y)) continue;

      // If the wings are nearly parallel, the intersection of their centerlines can be 
      // hundreds of meters away from the building footprint. 
      // We clamp/reject the join point if it's absurdly far from the physical corner.
      if (distance(join, intersection.point) > 50.0) {
        continue;
      }

      if (!joinPointsByWing.has(wingAId)) joinPointsByWing.set(wingAId, []);
      if (!joinPointsByWing.has(wingBId)) joinPointsByWing.set(wingBId, []);
      joinPointsByWing.get(wingAId)!.push(join);
      joinPointsByWing.get(wingBId)!.push(join);
    }

    for (const seg of wingCenterlineSegments) {
      const segDir = normalize(subPt(seg.end, seg.start));
      const segLen = distance(seg.start, seg.end);
      if (segLen < 1e-6) continue;

      // Collect wing endpoints + all join points (handles C/snake where
      // a middle wing has two join points from two intersections).
      const pointsOnWing: Pt[] = [seg.start, seg.end];
      const joins = joinPointsByWing.get(seg.wingId) ?? [];
      for (const jp of joins) {
        pointsOnWing.push(jp);
      }

      const uniqueByKey = new Map<string, Pt>();
      for (const p of pointsOnWing) uniqueByKey.set(nodeKey(p), p);
      const ordered = Array.from(uniqueByKey.values()).sort(
        (a, b) => dot(subPt(a, seg.start), segDir) - dot(subPt(b, seg.start), segDir)
      );
      for (let i = 0; i < ordered.length - 1; i++) {
        addEdge(ordered[i], ordered[i + 1]);
      }
    }
  }

  // Fallback for cases where no centerline graph could be assembled.
  if (corridorGraphNodes.length === 0) {
    corridorGraphNodes = corridorCenterline.length > 0 ? corridorCenterline : interPoints;
    corridorGraphEdges = [];
    for (let i = 0; i < corridorGraphNodes.length - 1; i++) {
      corridorGraphEdges.push([i, i + 1]);
    }
  }

  // The four-segment corridor model (from createCorridorWedge) already produces
  // geometrically correct corridor segments. Do NOT rebuild from centerline paths,
  // as the centerline rebuild can produce self-intersecting or overlapping polygons
  // when multiple intersections exist (C/snake middle wing). The centerline graph
  // is preserved for egress validation and dimension display only.

  Logger.debug(`[MW] Final: ${allUnits.length} units, ${allCores.length} cores, ${corridorSegments.length} corridor segments, GSF=${gsf.toFixed(1)}`);

  let st=0, ob=0, tb=0, thb=0;
  for (const u of allUnits) {
    if (u.type === UnitType.Studio) st++;
    else if (u.type === UnitType.OneBed) ob++;
    else if (u.type === UnitType.TwoBed) tb++;
    else if (u.type === UnitType.ThreeBed) thb++;
  }
  const totalRes = st + ob + tb + thb;
  const mix = totalRes > 0 ? {
    st: (st/totalRes*100).toFixed(1),
    ob: (ob/totalRes*100).toFixed(1),
    tb: (tb/totalRes*100).toFixed(1),
    thb: (thb/totalRes*100).toFixed(1)
  } : {};
  return {
    units: allUnits,
    cores: allCores,
    fillers: allFillers,
    corridor: primaryCorridor,
    buildingLength: polyMaxX - polyMinX,
    buildingDepth: polyMaxY - polyMinY,
    floorElevation: 0,
    transform: { centerX: 0, centerY: 0, rotation: 0 },
    stats: {
      gsf,
      nrsf,
      efficiency,
      unitCounts: unitCountsMap,
      totalUnits: totalUnitCount
    },
    egress: {
      maxDeadEnd,
      maxTravelDistance: maxTravel,
      deadEndStatus: maxDeadEnd <= deadEndLimit ? 'Pass' : 'Fail',
      travelDistanceStatus: maxTravel <= travelLimit ? 'Pass' : 'Fail'
    },
    corridorSegments,
    corridorCenterline: corridorGraphNodes,
    corridorGraph: {
      nodes: corridorGraphNodes,
      edges: corridorGraphEdges
    },
    wingInfo: {
      shape: analysis.shape || 'Unknown',
      wingCount: analysis.wings ? analysis.wings.length : 0,
      wings: analysis.wings ? analysis.wings.map(w => ({
        id: w.id,
        length: w.length,
        width: w.width,
        center: wingCenter(w),
        direction: w.direction
      })) : []
    }
  };
}

// ============================================================================
// Section 9: Entry Points
// ============================================================================

/**
 * Generate a multi-wing floorplate using graph-based BFS traversal.
 * Each wing is generated independently via generateFloorplate() and
 * stitched together with corner geometry at intersections.
 */
export function generateMultiWingFloorplate(
  polygon: Pt[],
  wingAnalysis: MultiWingAnalysis,
  config: UnitConfiguration,
  egressConfig: EgressConfig,
  options: MultiWingGeneratorOptions = {}
): FloorPlanData {
  const {
    corridorWidth = DEFAULT_CORRIDOR_WIDTH,
    coreWidth = DEFAULT_CORE_WIDTH,
    coreDepth = DEFAULT_CORE_DEPTH,
    coreSide = 'North',
    alignment = 0.5,
    strategy = 'balanced',
    customColors,
    includeIntersectionCustomUnits = false
  } = options;

  const { wings, intersections } = wingAnalysis;

  Logger.debug(`[MW] Starting graph-based generation for ${wings?.length} wings, ${intersections?.length} intersections`);

  if (!wings || wings.length === 0) {
    throw new Error("Invalid analysis object: wings array is missing or empty.");
  }

  // Step 1: Build wing connectivity graph
  const graph = buildWingGraph(wingAnalysis);
  // Step 2: BFS traversal → ordered task list
  const rootId = chooseRootWing(graph.nodes);
  if (rootId < 0) {
    Logger.debug('[MW] No valid root wing found, falling back to empty floorplan');
    return emptyFloorPlan(polygon);
  }

  const tasks = buildTaskList(graph, rootId, wingAnalysis, corridorWidth);

  Logger.debug(`[MW] BFS produced ${tasks.length} tasks, root wing=${rootId}`);

  // --------------------------------------------------------------------------
  // GLOBAL UNIT MIX ALLOCATION FOR MULTI-WING
  // --------------------------------------------------------------------------
  // To avoid over-generating large units, we calculate the global unit mix
  // for the entire building first, subtract the units forced into intersections,
  // and distribute the remainder to the individual wings.
  const totalEffectiveLength = tasks.reduce((sum, t) => sum + t.effectiveLength, 0);
  
  // Calculate EXACT total length by accounting for cores that take up space
  let actualTotalLength = 0;
  tasks.forEach(t => {
    let coresToSubtract = 0;
    if (!t.wingOptions.skipLeftEndCore) coresToSubtract += coreWidth;
    if (!t.wingOptions.skipRightEndCore) coresToSubtract += coreWidth;
    
    actualTotalLength += t.effectiveLength; // clear side
    actualTotalLength += Math.max(0, t.effectiveLength - coresToSubtract); // core side
  });

  const minSegmentsForMix = tasks.length * 2;
  
  // Approximate rentableDepth
  const approxRentableDepth = (wings[0]?.width || 18.28) / 2 - corridorWidth / 2;

  const globalCounts = calculateGlobalUnitCounts(
    actualTotalLength,
    config,
    approxRentableDepth,
    minSegmentsForMix,
    0, // totalBonusArea approximation
    strategy
  );

  // Sort active types by largest area first
  const activeTypes = [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio]
    .filter(t => config[t].percentage > 0)
    .sort((a, b) => config[b].area - config[a].area);
    
  const targetUnitType = activeTypes.length > 0 ? activeTypes[0] : UnitType.ThreeBed;

  if (includeIntersectionCustomUnits) {
    const numIntersections = intersections.filter(i => i.type === 'inner').length;
    
    // We want the intersections to "consume" the allocation of the largest typology.
    // But we must preserve the total physical width of the units assigned to the wings,
    // otherwise the wings will have white spaces.
    let unitsToRemove = Math.min(globalCounts[targetUnitType], numIntersections);
    
    if (unitsToRemove > 0) {
      globalCounts[targetUnitType] -= unitsToRemove;
      
      const removedWidth = unitsToRemove * (config[targetUnitType].area / approxRentableDepth);
      const otherTypes = activeTypes.filter(t => t !== targetUnitType);
      
      if (otherTypes.length > 0) {
        let remainingWidthToFill = removedWidth;
        
        // Distribute the missing width to other active types
        for (const type of otherTypes) {
           const w = config[type].area / approxRentableDepth;
           // Give a proportional share, or just greedy fill
           // Let's do greedy fill starting from second largest to avoid too many tiny units
           const countToAdd = Math.floor(remainingWidthToFill / w);
           globalCounts[type] += countToAdd;
           remainingWidthToFill -= countToAdd * w;
        }
        
        // If there's still a significant gap (>2m), add one more of the smallest type to ensure no white space
        if (remainingWidthToFill > 2) {
           const smallest = otherTypes[otherTypes.length - 1];
           globalCounts[smallest]++;
        }
      }
    }
    
    Logger.debug(`[MW] Global mix: Swapped ${unitsToRemove}x ${targetUnitType} for smaller units to accommodate intersections.`);
  }

  // Initialize unitInventory for each task and count exposed ends
  const taskExposedCorners = tasks.map(t => {
    t.wingOptions = t.wingOptions || {};
    t.wingOptions.unitInventory = {
      [UnitType.Studio]: 0,
      [UnitType.OneBed]: 0,
      [UnitType.TwoBed]: 0,
      [UnitType.ThreeBed]: 0
    };
    const hasLeft = t.wingOptions.intersectionEnds?.includes('left') || t.wingOptions.skipLeftEndCore;
    const hasRight = t.wingOptions.intersectionEnds?.includes('right') || t.wingOptions.skipRightEndCore;
    // Each exposed end has 2 corner segments (North and South)
    return ((hasLeft ? 0 : 1) + (hasRight ? 0 : 1)) * 2;
  });

  // PASS 1: Distribute corner-eligible units to exposed corners
  for (const type of activeTypes) {
    if (globalCounts[type] > 0 && isCornerEligible(type, config)) {
      // Find tasks with remaining exposed corner capacity
      for (let i = 0; i < tasks.length; i++) {
        while (taskExposedCorners[i] > 0 && globalCounts[type] > 0) {
          tasks[i].wingOptions.unitInventory![type]++;
          globalCounts[type]--;
          taskExposedCorners[i]--;
        }
      }
    }
  }

  // PASS 2: Distribute remaining global counts to wings proportionally by length
  for (const type of activeTypes) {
    const totalForType = globalCounts[type];
    if (totalForType <= 0) continue;

    const remainders: { taskIndex: number; value: number }[] = [];
    let currentSum = 0;

    tasks.forEach((t, index) => {
      const rawCount = totalForType * (t.effectiveLength / totalEffectiveLength);
      const intCount = Math.floor(rawCount);
      t.wingOptions.unitInventory![type] += intCount;
      currentSum += intCount;
      remainders.push({ taskIndex: index, value: rawCount - intCount });
    });

    const deficit = totalForType - currentSum;
    remainders.sort((a, b) => b.value - a.value);
    for (let i = 0; i < deficit; i++) {
      tasks[remainders[i].taskIndex].wingOptions.unitInventory![type]++;
    }
  }
  // --------------------------------------------------------------------------

  // Step 3: Generate each wing as an independent bar
  const wingResults: Array<{ fpd: FloorPlanData; task: WingTask; transform: WingTransform }> = [];
  const taskMap = new Map<number, WingTask>();
  const transformMap = new Map<number, WingTransform>();

  for (const task of tasks) {
    taskMap.set(task.wingId, task);

    const fpd = generateWingBar(
      task, config, egressConfig,
      corridorWidth, coreWidth, coreDepth,
      coreSide, alignment, strategy,
      customColors as UnitColorMap | undefined
    );

    const transform = computeWingTransform(task.wing, task.geoOffsetLeft, task.geoOffsetRight);
    transformMap.set(task.wingId, transform);

    const worldFpd = transformFloorPlanToWorld(fpd, transform);

    wingResults.push({ fpd: worldFpd, task, transform });

    Logger.debug(`[MW] Wing ${task.wingId}: ${worldFpd.units.length} units, ${worldFpd.cores.length} cores, effectiveLen=${task.effectiveLength.toFixed(1)}`);
  }

  // Step 4: Create corner geometry at each inner intersection
  const cornerUnits: UnitBlock[] = [];
  const corridorWedges: CorridorBlock[] = [];
  const innerCores: CoreBlock[] = [];
  const cornerFillers: FillerBlock[] = [];

  const innerIntersections = intersections.filter(i => i.type === 'inner');
  for (const inter of innerIntersections) {
    const [widA, widB] = inter.wingIds;
    const wA = wings.find(w => w.id === widA);
    const wB = wings.find(w => w.id === widB);
    if (!wA || !wB) continue;

    const taskA = taskMap.get(widA);
    const taskB = taskMap.get(widB);
    const transformA = transformMap.get(widA);
    const transformB = transformMap.get(widB);
    if (!taskA || !taskB || !transformA || !transformB) continue;

    // Compute join geometry once for all intersection pieces
    const wA_fpd = wingResults.find(r => r.task.wingId === widA)?.fpd;
    const wB_fpd = wingResults.find(r => r.task.wingId === widB)?.fpd;

    const joinGeom = computeIntersectionJoinGeometry(
      inter, wA, wB, transformA, transformB, taskA, taskB, corridorWidth, wA_fpd, wB_fpd
    );
    if (!joinGeom) continue;

    // Corner unit at outer vertex (using join geometry landmarks)
    if (includeIntersectionCustomUnits) {
      const activeTypes = [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio].filter(t => config[t].percentage > 0);
      // Use the LARGEST active unit type for the corner based on user feedback
      const targetUnitType = activeTypes.length > 0 ? activeTypes[0] : UnitType.ThreeBed;
      const targetArea = config[targetUnitType].area;
      const { cornerUnit: cu, fillers: cuFillers } = createCornerUnit(
        joinGeom, wA, wB, corridorWidth,
        targetArea, targetUnitType, config,
        customColors as UnitColorMap | undefined
      );
      if (cu) {
        cu.id = `corner-unit-${widA}-${widB}`;
        cornerUnits.push(cu);
        for (const f of cuFillers) {
          f.id = `corner-unit-extra-${widA}-${widB}-${Math.random().toString(36).slice(2, 7)}`;
          if (f) cornerUnits.push(f);
        }
      }
    }

    // Corridor wedge segments (extensions + junction)
    const wedgeSegments = createCorridorWedge(joinGeom, corridorWidth);
    for (const seg of wedgeSegments) corridorWedges.push(seg);

    // Inner core
    const core = createInnerCore(joinGeom);
    if (core) {
      innerCores.push(core);
    }

    Logger.debug(`[MW] Intersection ${widA}-${widB}: cornerUnitsEnabled=${includeIntersectionCustomUnits}, cornerCount=${cornerUnits.length}, wedgeSegs=${wedgeSegments.length}, core=${!!core}`);
  }

  // Step 5: Assemble everything
  return assembleFloorPlan(
    wingResults, cornerUnits, corridorWedges, innerCores, cornerFillers,
    polygon, wingAnalysis, egressConfig, corridorWidth, includeIntersectionCustomUnits
  );
}

/**
 * Generate multi-wing floorplate variants (3 strategies).
 */
export function generateMultiWingFloorplateVariants(
  polygon: Pt[],
  config: UnitConfiguration,
  egressConfig: EgressConfig,
  options: MultiWingGeneratorOptions = {},
  topology?: import('./types').FootprintTopology,
  precomputedAnalysis?: MultiWingAnalysis
): LayoutOption[] {
  try {
    const strategies: OptimizationStrategy[] = ['balanced', 'mixOptimized', 'efficiencyOptimized'];

    return strategies.map((strat, idx) => {
      const freshPolygon = polygon.map(p => ({x: p.x, y: p.y}));
      const freshWingAnalysis = precomputedAnalysis || analyzeFootprint(freshPolygon, topology);
      
      // If analyzeFootprint returns empty wings because topology wasn't available or we couldn't properly detect it,
      // fallback to treating it as a simple bar using the polygon's bounding box to avoid crashing.
      if (!freshWingAnalysis.wings || freshWingAnalysis.wings.length === 0) {
        Logger.warn('[MW] analyzeFootprint failed to find wings. Falling back to simple bar generation using bounding box.');
        
        const minX = Math.min(...freshPolygon.map(p => p.x));
        const maxX = Math.max(...freshPolygon.map(p => p.x));
        const minY = Math.min(...freshPolygon.map(p => p.y));
        const maxY = Math.max(...freshPolygon.map(p => p.y));
        const width = maxX - minX;
        const depth = maxY - minY;
        const centerX = minX + width / 2;
        const centerY = minY + depth / 2;
        
        const fallbackFootprint: BuildingFootprint = {
          width: width > 0 ? width : 10, 
          depth: depth > 0 ? depth : 10, 
          height: 3.2, 
          centerX, 
          centerY, 
          rotation: 0,
          minX, maxX, minY, maxY,
          floorZ: 0
        };
        
        const floorplan = generateFloorplate(fallbackFootprint, config, egressConfig, options.corridorWidth || DEFAULT_CORRIDOR_WIDTH, options.coreWidth || DEFAULT_CORE_WIDTH, options.coreDepth || DEFAULT_CORE_DEPTH, options.coreSide || 'North', options.alignment || 0.5, strat, options.customColors as any);
        return {
          id: `option-${idx + 1}`,
          strategy: strat,
          floorplan,
          label: STRATEGY_LABELS[strat],
          description: STRATEGY_DESCRIPTIONS[strat]
        };
      }
      
      let floorplan;
      try {
        floorplan = generateMultiWingFloorplate(
          freshPolygon, freshWingAnalysis, config, egressConfig, { ...options, strategy: strat }
        );
      } catch (err: any) {
        // Detailed error logging
        const simplifiedAnalysis = {
          wings: freshWingAnalysis?.wings?.map(w => ({ id: w.id, dir: w.dir, polyPts: w.polygon?.length, isOuterGapNull: w.outerGap == null })),
          intersections: freshWingAnalysis?.intersections?.map(i => ({ id: i.id, edges: i.edges?.length }))
        };
        const msg = String(err?.message || err);
        const stck = String(err?.stack || '');
        console.error(`[CRITICAL CRASH] Strategy ${strat} failed!`, msg, stck);
        throw err;
      }

      return {
        id: `option-${idx + 1}`,
        strategy: strat,
        floorplan,
        label: STRATEGY_LABELS[strat],
        description: STRATEGY_DESCRIPTIONS[strat]
      };
    });
  } catch (error: any) {
    const msg = String(error?.message || error);
    const stck = String(error?.stack || '');
    console.error(`[CRITICAL CRASH] generateMultiWingFloorplateVariants failed entirely!`, msg, stck);
    throw error;
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

function emptyFloorPlan(polygon: Pt[]): FloorPlanData {
  const polyMinX = polygon.reduce((m, v) => Math.min(m, v.x), Infinity);
  const polyMaxX = polygon.reduce((m, v) => Math.max(m, v.x), -Infinity);
  const polyMinY = polygon.reduce((m, v) => Math.min(m, v.y), Infinity);
  const polyMaxY = polygon.reduce((m, v) => Math.max(m, v.y), -Infinity);

  return {
    units: [],
    cores: [],
    fillers: [],
    corridor: { x: 0, y: 0, width: 1, depth: 1 },
    buildingLength: polyMaxX - polyMinX,
    buildingDepth: polyMaxY - polyMinY,
    floorElevation: 0,
    transform: { centerX: 0, centerY: 0, rotation: 0 },
    stats: { gsf: 0, nrsf: 0, efficiency: 0, unitCounts: {}, totalUnits: 0 },
    egress: { maxDeadEnd: 0, maxTravelDistance: 0, deadEndStatus: 'Fail', travelDistanceStatus: 'Fail' }
  };
}

/**
 * Compute which local-Y side of a wing faces toward the other wing.
 * Uses cross-product approach: robust and rotation-invariant.
 * Returns +1 if local +Y faces toward the other wing, -1 otherwise.
 * Exported for testing.
 */
function computeInnerSide(
  wingDir: Pt, _wingCenter: Pt,
  otherWingDir: Pt, otherWingCenter: Pt,
  interPt: Pt
): number {
  const awayOther = dot(otherWingDir, subPt(otherWingCenter, interPt)) >= 0 ? otherWingDir : scalePt(otherWingDir, -1);
  // We want the side relative to wingDir's +Y axis, which is perpCCW(wingDir)
  const innerSide = dot(awayOther, perpCCW(wingDir)) >= 0 ? 1 : -1;
  
  
  return innerSide;
}

// Exported for testing
export { buildWingGraph, chooseRootWing, buildTaskList, computeGeoOffset, computeWingTransform, validateCorridorWedge, computeInnerSide, computeIntersectionJoinGeometry, createInnerCore, createCornerUnit, createCorridorWedge };
export type { WingGraph, WingNode, IntersectionEdge, WingTask, WingTransform, IntersectionJoinGeometry };
