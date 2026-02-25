/**
 * Wing Detection Algorithm
 *
 * Analyzes a building footprint polygon to identify:
 * - Rectangular wings (distinct sections of the building)
 * - Corner types (CONVEX/CONCAVE/STRAIGHT at each vertex)
 * - Wing intersections (where wings meet, inner/outer type)
 * - Host/guest roles for each intersection (who provides the core)
 * - Net wing lengths (excluding corner overlap zones)
 * - Shape classification (bar, L, U, V, H, snake, courtyard, complex)
 *
 * Based on Feature Spec Appendix C.
 */

import {
  CornerType,
  FootprintVertex,
  Wing,
  WingIntersection,
  WingDetectionResult
} from './types';
import { WING_DETECTION } from './constants';
import { degreesToRadians } from '../geometry/point';
import { polygonBoundingBox } from '../geometry/polygon';

// ============================================================================
// Internal Types
// ============================================================================

/** Role of a wing at a specific intersection */
export interface WingRole {
  wingId: number;
  intersectionIndex: number;
  role: 'host' | 'guest';
  /** Which side of the wing faces the inner corner */
  coreSide: 'North' | 'South';
  /** Which end of the wing (in wing-local coords) faces the intersection */
  intersectionEnd: 'left' | 'right';
  /** True for H/complex shapes where explicit core placement is needed */
  explicitPlacement: boolean;
}

/** Extended detection result including wing roles and net lengths */
export interface MultiWingAnalysis extends WingDetectionResult {
  wingRoles: WingRole[];
  netWingLengths: Map<number, number>;
}

// ============================================================================
// Step 1: Classify Vertices
// ============================================================================

/**
 * Classify each polygon vertex as CONVEX, CONCAVE, or STRAIGHT.
 *
 * For a counter-clockwise polygon:
 * - Cross product > 0 at vertex → CONVEX (exterior angle, "outer corner")
 * - Cross product < 0 at vertex → CONCAVE (reflex angle, "inner corner")
 * - Cross product ≈ 0 → STRAIGHT
 */
export function classifyVertices(polygon: { x: number; y: number }[]): FootprintVertex[] {
  const n = polygon.length;
  const result: FootprintVertex[] = [];
  const straightThreshold = Math.sin(degreesToRadians(WING_DETECTION.straightAngleTolerance));

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    const v1x = curr.x - prev.x, v1y = curr.y - prev.y;
    const v2x = next.x - curr.x, v2y = next.y - curr.y;

    const cross = v1x * v2y - v1y * v2x;
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    const denominator = len1 * len2;

    // Compute interior angle using atan2
    const dot = v1x * v2x + v1y * v2y;
    let interiorAngle = Math.PI - Math.atan2(Math.abs(cross), dot);
    if (cross < 0) interiorAngle = 2 * Math.PI - interiorAngle; // reflex

    let cornerType: CornerType;
    if (denominator < 1e-10) {
      cornerType = CornerType.STRAIGHT;
    } else {
      const sinAngle = Math.abs(cross) / denominator;
      if (sinAngle < straightThreshold) {
        cornerType = CornerType.STRAIGHT;
      } else if (cross > 0) {
        cornerType = CornerType.CONVEX;  // CCW polygon: positive cross = outer corner
      } else {
        cornerType = CornerType.CONCAVE; // negative cross = inner corner (reflex)
      }
    }

    result.push({ x: curr.x, y: curr.y, interiorAngle, cornerType, index: i });
  }

  return result;
}

// ============================================================================
// Step 2: Detect Dominant Directions
// ============================================================================

interface EdgeGroup {
  direction: number;   // normalized angle [0, π)
  edges: { start: number; end: number; length: number }[];
  totalLength: number;
}

/**
 * Group polygon edges by direction (within angleToleranceDegrees).
 * Angles are normalized to [0, π) since a direction and its reverse are the same.
 * Returns groups sorted by total length (dominant directions first).
 */
export function detectDominantDirections(
  vertices: FootprintVertex[],
  angleTolerance: number = WING_DETECTION.angleToleranceDegrees
): EdgeGroup[] {
  const n = vertices.length;
  const tolRad = degreesToRadians(angleTolerance);
  const groups: EdgeGroup[] = [];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const v1 = vertices[i];
    const v2 = vertices[j];
    const dx = v2.x - v1.x, dy = v2.y - v1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) continue; // skip degenerate edges

    // Normalize angle to [0, π)
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    if (angle >= Math.PI) angle -= Math.PI;

    // Find existing group within tolerance
    let found = false;
    for (const group of groups) {
      let diff = Math.abs(group.direction - angle);
      if (diff > Math.PI / 2) diff = Math.PI - diff; // handle wrap-around
      if (diff < tolRad) {
        group.edges.push({ start: i, end: j, length: len });
        group.totalLength += len;
        found = true;
        break;
      }
    }

    if (!found) {
      groups.push({
        direction: angle,
        edges: [{ start: i, end: j, length: len }],
        totalLength: len
      });
    }
  }

  return groups.sort((a, b) => b.totalLength - a.totalLength);
}

// ============================================================================
// Step 3: Identify Wings
// ============================================================================

/**
 * Result of wing vertex group identification.
 * junctionVertexIndices[i] = the polygon vertex index of the CONCAVE vertex
 * separating wingGroups[i-1] and wingGroups[i].
 */
interface WingGroupResult {
  groups: number[][];
  /** Vertex index of the concave junction BEFORE each group (null for groups after merge) */
  junctionVertexIndices: (number | null)[];
}

/**
 * Walk the polygon perimeter and group consecutive edges by dominant direction.
 * Split into new wings only when direction changes at a CONCAVE corner.
 *
 * IMPORTANT: The concave split vertex is recorded as the junction between wings.
 * It is included as the FIRST vertex of the new wing group AND recorded separately
 * for use in intersection detection.
 */
function identifyWingVertexGroups(
  vertices: FootprintVertex[],
  dominantDirs: EdgeGroup[],
  concaveIndices?: number[]
): WingGroupResult {
  if (dominantDirs.length === 0) {
    return {
      groups: [vertices.map((_, i) => i)],
      junctionVertexIndices: [null]
    };
  }

  const n = vertices.length;

  // Map each edge start vertex → dominant direction index
  const edgeDirMap = new Map<number, number>();
  for (let d = 0; d < dominantDirs.length; d++) {
    for (const edge of dominantDirs[d].edges) {
      edgeDirMap.set(edge.start, d);
    }
  }

  // Find start vertex: maximize minimum cyclic distance from any concave vertex
  // so that concave split points appear mid-walk, not at the end.
  let startIdx = 0;
  const cIndices = concaveIndices ?? [];
  if (cIndices.length > 0) {
    let bestMinDist = -1;
    for (let i = 0; i < n; i++) {
      if (vertices[i].cornerType === CornerType.CONCAVE) continue;
      let minDist = n;
      for (const ci of cIndices) {
        const fwd = (i - ci + n) % n;
        const bwd = (ci - i + n) % n;
        minDist = Math.min(minDist, Math.min(fwd, bwd));
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        startIdx = i;
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      if (vertices[i].cornerType === CornerType.CONVEX) {
        const prevEdge = (i - 1 + n) % n;
        const prevDir = edgeDirMap.get(prevEdge) ?? 0;
        const currDir = edgeDirMap.get(i) ?? 0;
        if (prevDir !== currDir) {
          startIdx = i;
          break;
        }
      }
    }
  }

  // Walk and group. Split when the CURRENT vertex is CONCAVE and direction changes
  // from the previous edge to this vertex's outgoing edge.
  const groups: number[][] = [];
  const junctions: (number | null)[] = [];
  let currentGroup: number[] = [];
  let currentJunction: number | null = null;

  for (let step = 0; step < n; step++) {
    const i = (startIdx + step) % n;
    const vertex = vertices[i];

    // Is this vertex a split point? (concave + direction change from prev edge)
    if (step > 0 && vertex.cornerType === CornerType.CONCAVE) {
      const prevI = (i - 1 + n) % n;
      const prevEdgeDir = edgeDirMap.get(prevI) ?? 0;
      const currEdgeDir = edgeDirMap.get(i) ?? 0;
      if (prevEdgeDir !== currEdgeDir) {
        // Finish current group (does NOT include this concave vertex)
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
          junctions.push(currentJunction);
          currentGroup = [];
        }
        // This concave vertex is the junction before the new group
        currentJunction = i;
      }
    }

    currentGroup.push(i);
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
    junctions.push(currentJunction);
  }

  // Merge first and last group if same direction (polygon is cyclic)
  if (groups.length >= 2) {
    const firstDir = edgeDirMap.get(groups[0][0]) ?? 0;
    const lastGroup = groups[groups.length - 1];
    const lastDir = edgeDirMap.get(lastGroup[0]) ?? 0;
    if (firstDir === lastDir) {
      groups[0] = [...lastGroup, ...groups[0]];
      groups.pop();
      junctions.shift(); // remove first junction (it's now internal to the merged group)
    }
  }

  return {
    groups: groups.filter(g => g.length > 0),
    junctionVertexIndices: junctions
  };
}

/**
 * Build Wing objects from vertex groups.
 * Uses longest-edge projection to compute accurate wing dimensions,
 * which handles non-axis-aligned wings (e.g., non-right-angle L-shapes).
 */
export function buildWingsFromGroups(
  vertexGroups: number[][],
  vertices: FootprintVertex[],
  _polygon: { x: number; y: number }[]
): Wing[] {
  const wings: Wing[] = [];
  const n = vertices.length;

  for (let id = 0; id < vertexGroups.length; id++) {
    const group = vertexGroups[id];
    const wingVertices = group.map(i => vertices[i]);

    // Find longest polygon edge starting from a vertex in this group
    let maxEdgeLen = 0;
    let direction = 0;
    for (const vi of group) {
      const vj = (vi + 1) % n;
      const dx = vertices[vj].x - vertices[vi].x;
      const dy = vertices[vj].y - vertices[vi].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > maxEdgeLen) {
        maxEdgeLen = len;
        direction = Math.atan2(dy, dx);
      }
    }

    // Project all wing vertices onto the wing direction and its perpendicular
    // to get the oriented bounding box (OBB) dimensions
    const cosD = Math.cos(direction), sinD = Math.sin(direction);
    let minAlong = Infinity, maxAlong = -Infinity;
    let minPerp = Infinity, maxPerp = -Infinity;
    for (const v of wingVertices) {
      const along = v.x * cosD + v.y * sinD;
      const perp = -v.x * sinD + v.y * cosD;
      if (along < minAlong) minAlong = along;
      if (along > maxAlong) maxAlong = along;
      if (perp < minPerp) minPerp = perp;
      if (perp > maxPerp) maxPerp = perp;
    }

    const length = maxAlong - minAlong;
    const width = maxPerp - minPerp;

    // OBB center in world coordinates
    const alongCenter = (minAlong + maxAlong) / 2;
    const perpCenter = (minPerp + maxPerp) / 2;
    const center = {
      x: alongCenter * cosD - perpCenter * sinD,
      y: alongCenter * sinD + perpCenter * cosD
    };

    // AABB bounds (for backward compat and intersection detection)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const v of wingVertices) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
    const bounds = { minX, maxX, minY, maxY };

    // Centerline along the wing direction
    const halfLen = length / 2;
    const centerline = {
      start: { x: center.x - cosD * halfLen, y: center.y - sinD * halfLen },
      end: { x: center.x + cosD * halfLen, y: center.y + sinD * halfLen }
    };

    wings.push({ id, vertices: wingVertices, direction, length, width, centerline, bounds, center });
  }

  return wings;
}

// ============================================================================
// Step 4: Find Intersections
// ============================================================================

/**
 * Find wing intersections using ADJACENCY from wing groups.
 *
 * The concave junction vertex separates adjacent wings in the polygon walk.
 * Wing[i] and Wing[i+1] share the junction vertex at junctionVertexIndices[i+1].
 *
 * This approach is robust because the concave vertex may not appear in both
 * wing vertex groups (it's the split point, so it starts the new group).
 *
 * Also identifies outer corners: the convex vertex at the "other" end of each
 * wing pair — the one facing the exterior of the building at the L-junction.
 */
function findWingIntersections(
  wings: Wing[],
  allVertices: FootprintVertex[],
  junctionVertexIndices: (number | null)[]
): WingIntersection[] {
  const intersections: WingIntersection[] = [];

  // Inner intersections: use junction vertex indices (direct adjacency)
  // wings[i] is adjacent to wings[(i+1) % wings.length] via junctionVertexIndices[i+1]
  const nWings = wings.length;
  for (let i = 0; i < nWings; i++) {
    const wing1 = wings[i];
    const wing2 = wings[(i + 1) % nWings];
    // The junction vertex is the first vertex of wing2's group
    const junctionIdx = junctionVertexIndices[(i + 1) % nWings];
    if (junctionIdx === null) continue;

    const junctionVertex = allVertices[junctionIdx];
    if (junctionVertex.cornerType !== CornerType.CONCAVE) continue;

    const angle = Math.abs(wing1.direction - wing2.direction);
    const maxDepth = WING_DETECTION.maxInnerZoneDepth;
    const d1 = Math.min(wing1.width / 2, maxDepth);
    const d2 = Math.min(wing2.width / 2, maxDepth);
    const innerZonePolygon = buildInnerZonePolygon(junctionVertex, wing1, wing2, d1, d2);

    intersections.push({
      point: junctionVertex,
      type: 'inner',
      wingIds: [wing1.id, wing2.id],
      angle,
      innerZone: { polygon: innerZonePolygon, area: d1 * d2 }
    });

    // Outer corner: the convex vertex on the opposite side of this junction.
    // For an L-shape, the outer corner is the convex vertex that lies at the
    // geometric corner between the two wing bounding boxes on the exterior side.
    // We identify it as the vertex in wing1's group closest to wing2's boundary
    // that is CONVEX.
    const outerVertex = findOuterCornerVertex(wing1, wing2, allVertices);
    if (outerVertex && outerVertex.cornerType === CornerType.CONVEX) {
      intersections.push({
        point: outerVertex,
        type: 'outer',
        wingIds: [wing1.id, wing2.id],
        angle,
        outerZone: { polygon: [{ x: outerVertex.x, y: outerVertex.y }], area: 0 }
      });
    }
  }

  return intersections;
}

/**
 * Find the outer corner vertex — the convex vertex near the intersection
 * that faces outward (opposite side from the inner concave corner).
 * This is where the premium L-shaped unit goes.
 */
function findOuterCornerVertex(
  wing1: Wing,
  wing2: Wing,
  allVertices: FootprintVertex[]
): FootprintVertex | null {
  // The outer corner is a convex vertex that lies within or near
  // the bounding box overlap of the two wings
  const overlapMinX = Math.max(wing1.bounds.minX, wing2.bounds.minX);
  const overlapMaxX = Math.min(wing1.bounds.maxX, wing2.bounds.maxX);
  const overlapMinY = Math.max(wing1.bounds.minY, wing2.bounds.minY);
  const overlapMaxY = Math.min(wing1.bounds.maxY, wing2.bounds.maxY);

  // Expand the search area slightly
  const eps = 1.0;
  for (const v of allVertices) {
    if (v.cornerType !== CornerType.CONVEX) continue;
    if (
      v.x >= overlapMinX - eps && v.x <= overlapMaxX + eps &&
      v.y >= overlapMinY - eps && v.y <= overlapMaxY + eps
    ) {
      // Make sure it's actually in both wings' bounding boxes
      const inWing1 = v.x >= wing1.bounds.minX - eps && v.x <= wing1.bounds.maxX + eps &&
                      v.y >= wing1.bounds.minY - eps && v.y <= wing1.bounds.maxY + eps;
      const inWing2 = v.x >= wing2.bounds.minX - eps && v.x <= wing2.bounds.maxX + eps &&
                      v.y >= wing2.bounds.minY - eps && v.y <= wing2.bounds.maxY + eps;
      if (inWing1 && inWing2) return v;
    }
  }
  return null;
}

/** Build a rectangular inner corner zone polygon */
function buildInnerZonePolygon(
  cornerVertex: FootprintVertex,
  wing1: Wing,
  wing2: Wing,
  depth1: number,
  depth2: number
): { x: number; y: number }[] {
  const p = cornerVertex;
  // Simple rectangular zone extending inward along each wing
  const cosD1 = Math.cos(wing1.direction), sinD1 = Math.sin(wing1.direction);
  const cosD2 = Math.cos(wing2.direction), sinD2 = Math.sin(wing2.direction);
  return [
    { x: p.x, y: p.y },
    { x: p.x + cosD1 * depth1, y: p.y + sinD1 * depth1 },
    { x: p.x + cosD1 * depth1 + cosD2 * depth2, y: p.y + sinD1 * depth1 + sinD2 * depth2 },
    { x: p.x + cosD2 * depth2, y: p.y + sinD2 * depth2 }
  ];
}

// ============================================================================
// Step 5: Wing Roles and Net Lengths
// ============================================================================

/**
 * Determine host/guest roles for each intersection.
 *
 * Host wing: the one whose end core will naturally sit at the inner corner.
 * This is the wing where the concave vertex is on its coreSide edge.
 *
 * For H/complex shapes where a wing has more intersections than ends,
 * set explicitPlacement = true so the orchestrator handles it.
 */
export function determineWingRoles(
  wings: Wing[],
  intersections: WingIntersection[]
): WingRole[] {
  const roles: WingRole[] = [];
  const innerIntersections = intersections.filter(i => i.type === 'inner');

  // Count intersections per wing
  const intersectionCount = new Map<number, number>();
  for (const wing of wings) {
    intersectionCount.set(wing.id, 0);
  }
  for (const inter of innerIntersections) {
    intersectionCount.set(inter.wingIds[0], (intersectionCount.get(inter.wingIds[0]) ?? 0) + 1);
    intersectionCount.set(inter.wingIds[1], (intersectionCount.get(inter.wingIds[1]) ?? 0) + 1);
  }

  for (let ii = 0; ii < innerIntersections.length; ii++) {
    const inter = innerIntersections[ii];
    const [wid1, wid2] = inter.wingIds;
    const wing1 = wings.find(w => w.id === wid1)!;
    const wing2 = wings.find(w => w.id === wid2)!;
    const concaveVertex = inter.point;

    // Determine which wing is host: the longer wing
    // For L-shape: the horizontal wing is typically longer
    const w1Intersections = intersectionCount.get(wid1) ?? 0;
    const w2Intersections = intersectionCount.get(wid2) ?? 0;
    // If either wing has more intersections than 2 ends, needs explicit placement
    const explicitNeeded = w1Intersections > 2 || w2Intersections > 2;

    let hostId: number, guestId: number;
    let hostWing: Wing, guestWing: Wing;

    if (wing1.length >= wing2.length) {
      hostId = wid1; guestId = wid2;
      hostWing = wing1; guestWing = wing2;
    } else {
      hostId = wid2; guestId = wid1;
      hostWing = wing2; guestWing = wing1;
    }

    // Determine coreSide for host: which side of the corridor faces the inner corner
    // The inner corner (concave vertex) is at one end of the host wing.
    // The core goes on the side where the concave vertex is.
    const hostCenterY = (hostWing.bounds.minY + hostWing.bounds.maxY) / 2;
    const hostCoreSide: 'North' | 'South' = concaveVertex.y <= hostCenterY ? 'North' : 'South';

    // Determine which end of each wing faces the intersection
    const hostCenterX = (hostWing.bounds.minX + hostWing.bounds.maxX) / 2;
    const hostIntersectionEnd: 'left' | 'right' = concaveVertex.x <= hostCenterX ? 'left' : 'right';

    const guestCenterY = (guestWing.bounds.minY + guestWing.bounds.maxY) / 2;
    // For vertical guest wing, "left" = top (min Y), "right" = bottom (max Y)
    // We use 'left' to mean "closer to intersection"
    const guestIntersectionEnd: 'left' | 'right' =
      Math.abs(concaveVertex.x - guestWing.bounds.minX) < Math.abs(concaveVertex.x - guestWing.bounds.maxX) ||
      Math.abs(concaveVertex.y - guestWing.bounds.minY) < Math.abs(concaveVertex.y - guestWing.bounds.maxY)
        ? 'left' : 'right';
    const guestCoreSide: 'North' | 'South' = concaveVertex.y <= guestCenterY ? 'North' : 'South';

    roles.push({
      wingId: hostId,
      intersectionIndex: ii,
      role: 'host',
      coreSide: hostCoreSide,
      intersectionEnd: hostIntersectionEnd,
      explicitPlacement: explicitNeeded
    });

    roles.push({
      wingId: guestId,
      intersectionIndex: ii,
      role: 'guest',
      coreSide: guestCoreSide,
      intersectionEnd: guestIntersectionEnd,
      explicitPlacement: explicitNeeded
    });
  }

  return roles;
}

/**
 * Compute net wing lengths (excluding corner overlap zones at intersection ends).
 *
 * Host wing: keeps full length (its end core sits in the overlap zone)
 * Guest wing: subtracts the host wing's depth at the intersection end
 */
export function computeNetWingLengths(
  wings: Wing[],
  intersections: WingIntersection[],
  wingRoles: WingRole[]
): Map<number, number> {
  const netLengths = new Map<number, number>();

  // Start with full lengths
  for (const wing of wings) {
    netLengths.set(wing.id, wing.length);
  }

  // Subtract overlap zones for guest wings
  const innerIntersections = intersections.filter(i => i.type === 'inner');
  for (let ii = 0; ii < innerIntersections.length; ii++) {
    const guestRoles = wingRoles.filter(r => r.intersectionIndex === ii && r.role === 'guest');

    for (const guestRole of guestRoles) {
      const guestWing = wings.find(w => w.id === guestRole.wingId)!;
      const hostRole = wingRoles.find(r => r.intersectionIndex === ii && r.role === 'host')!;
      const hostWing = wings.find(w => w.id === hostRole.wingId)!;

      // Overlap zone depth = host wing's width (since the guest sits perpendicular to host)
      const overlapDepth = hostWing.width;
      const currentLen = netLengths.get(guestWing.id) ?? guestWing.length;
      netLengths.set(guestWing.id, Math.max(0, currentLen - overlapDepth));
    }
  }

  return netLengths;
}

// ============================================================================
// Step 6: Shape Classification
// ============================================================================

function classifyShape(
  wings: Wing[],
  intersections: WingIntersection[]
): WingDetectionResult['shape'] {
  const n = wings.length;
  const innerCount = intersections.filter(i => i.type === 'inner').length;

  if (n === 1) return 'bar';
  if (n === 2 && innerCount === 1) {
    // Check if wings are at right angles (horizontal+vertical = L, other = V)
    // Normalize directions to [0, π/2] and check if they differ by ~90°
    const d1 = wings[0].direction % (Math.PI / 2);
    const d2 = wings[1].direction % (Math.PI / 2);
    const bothAligned = d1 < degreesToRadians(15) && d2 < degreesToRadians(15);
    // If both are axis-aligned (horizontal or vertical), it's L-shaped
    return bothAligned ? 'L' : 'V';
  }
  if (n === 3 && innerCount === 2) return 'U';
  if (n >= 3 && innerCount >= 4) return 'H';
  if (n >= 4) return 'snake';
  return 'complex';
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Normalize a polygon to axis-aligned orientation for robust wing detection.
 * Counter-rotates by the longest-edge angle so the primary axis is horizontal.
 */
function normalizePolygon(polygon: { x: number; y: number }[]): {
  aligned: { x: number; y: number }[];
  angle: number;
  cx: number;
  cy: number;
} {
  const n = polygon.length;
  const cx = polygon.reduce((s, v) => s + v.x, 0) / n;
  const cy = polygon.reduce((s, v) => s + v.y, 0) / n;

  let maxLen = 0, angle = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = polygon[j].x - polygon[i].x;
    const dy = polygon[j].y - polygon[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > maxLen) {
      maxLen = len;
      angle = Math.atan2(dy, dx);
    }
  }

  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  const aligned = polygon.map(v => {
    const tx = v.x - cx;
    const ty = v.y - cy;
    return {
      x: tx * cosA - ty * sinA,
      y: tx * sinA + ty * cosA
    };
  });

  return { aligned, angle, cx, cy };
}

/**
 * Rotate wing analysis results back to the original (world) coordinate frame.
 */
function denormalizeAnalysis(
  result: MultiWingAnalysis,
  angle: number,
  cx: number,
  cy: number
): void {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const rotatedPoints = new WeakSet<object>();

  const rotateBack = (p: { x: number; y: number }) => {
    const rx = p.x * cosA - p.y * sinA + cx;
    const ry = p.x * sinA + p.y * cosA + cy;
    p.x = rx;
    p.y = ry;
  };
  const rotateBackOnce = (p: { x: number; y: number }) => {
    if (rotatedPoints.has(p as object)) return;
    rotateBack(p);
    rotatedPoints.add(p as object);
  };

  for (const wing of result.wings) {
    wing.direction += angle;
    for (const v of wing.vertices) {
      rotateBackOnce(v);
    }
    rotateBackOnce(wing.centerline.start);
    rotateBackOnce(wing.centerline.end);
    if (wing.center) {
      rotateBackOnce(wing.center);
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const v of wing.vertices) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
    wing.bounds = { minX, maxX, minY, maxY };
  }

  for (const inter of result.intersections) {
    rotateBackOnce(inter.point);
    if (inter.innerZone) {
      for (const p of inter.innerZone.polygon) rotateBackOnce(p);
    }
    if (inter.outerZone) {
      for (const p of inter.outerZone.polygon) rotateBackOnce(p);
    }
  }
}

/**
 * Analyze a building footprint polygon to detect wings and intersections.
 *
 * @param polygon - Building footprint vertices in CCW winding order
 * @returns WingDetectionResult with all wing/intersection data + roles/net lengths
 */
export function analyzeFootprint(polygon: { x: number; y: number }[]): MultiWingAnalysis {
  // Classify vertices (rotation-invariant: cross products don't change with rotation)
  const vertices = classifyVertices(polygon);

  // Check for simple bar (no concave corners)
  const hasConcave = vertices.some(v => v.cornerType === CornerType.CONCAVE);
  if (!hasConcave) {
    // Simple bar building
    const bb = polygonBoundingBox({ vertices: polygon });
    const bboxW = bb.maxX - bb.minX;
    const bboxH = bb.maxY - bb.minY;
    const isHorizontal = bboxW >= bboxH;
    const wing: Wing = {
      id: 0,
      vertices,
      direction: isHorizontal ? 0 : Math.PI / 2,
      length: isHorizontal ? bboxW : bboxH,
      width: isHorizontal ? bboxH : bboxW,
      centerline: {
        start: { x: bb.minX, y: (bb.minY + bb.maxY) / 2 },
        end: { x: bb.maxX, y: (bb.minY + bb.maxY) / 2 }
      },
      bounds: bb
    };
    return {
      wings: [wing],
      intersections: [],
      isSimpleBar: true,
      shape: 'bar',
      wingRoles: [],
      netWingLengths: new Map([[0, wing.length]])
    };
  }

  // Normalize polygon to axis-aligned for robust wing detection on rotated buildings
  const { aligned, angle: normAngle, cx: normCx, cy: normCy } = normalizePolygon(polygon);
  const alignedVertices = classifyVertices(aligned);

  // Detect dominant directions on axis-aligned polygon
  const dominantDirs = detectDominantDirections(alignedVertices);

  // Start walk at farthest vertex from any concave vertex to avoid degenerate splits
  const concaveIndices = alignedVertices
    .map((v, i) => ({ v, i }))
    .filter(e => e.v.cornerType === CornerType.CONCAVE)
    .map(e => e.i);

  // Identify wings (returns groups + junction vertex indices between wings)
  let { groups: vertexGroups, junctionVertexIndices } = identifyWingVertexGroups(
    alignedVertices, dominantDirs, concaveIndices
  );

  // Merge degenerate groups (≤1 vertex) with the NEXT group.
  // This happens in U-shapes where two concave corners are adjacent,
  // creating a single-vertex "wing" for the connecting edge.
  for (let i = vertexGroups.length - 1; i >= 0; i--) {
    if (vertexGroups[i].length <= 1 && vertexGroups.length > 1) {
      const nextIdx = (i + 1) % vertexGroups.length;
      vertexGroups[nextIdx] = [...vertexGroups[i], ...vertexGroups[nextIdx]];
      vertexGroups.splice(i, 1);
      junctionVertexIndices.splice(i, 1);
    }
  }

  const wings = buildWingsFromGroups(vertexGroups, alignedVertices, aligned);

  // Find intersections (using adjacency + junction vertices for accuracy)
  const intersections = findWingIntersections(wings, alignedVertices, junctionVertexIndices);

  // Determine host/guest roles
  const wingRoles = determineWingRoles(wings, intersections);

  // Compute net wing lengths
  const netWingLengths = computeNetWingLengths(wings, intersections, wingRoles);

  // Classify shape
  const shape = classifyShape(wings, intersections);

  const result: MultiWingAnalysis = {
    wings,
    intersections,
    isSimpleBar: false,
    shape,
    wingRoles,
    netWingLengths
  };

  // Rotate all wing/intersection data back to original world coordinates
  denormalizeAnalysis(result, normAngle, normCx, normCy);

  return result;
}
