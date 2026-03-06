// @ts-nocheck
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

  // Link prev and next
  for (let i = 0; i < n; i++) {
    result[i].prev = result[(i - 1 + n) % n];
    result[i].next = result[(i + 1) % n];
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
// Step 3: Detect Wings (Edge Pairing)
// ============================================================================

export function buildWings(
  vertices: FootprintVertex[],
  topology?: import('./types').FootprintTopology
): Wing[] {
  const n = vertices.length;
  const wings: Wing[] = [];

  // 1. Extract all valid edges from topology if available, else fallback to vertices
  const edges: { i: number; j: number; length: number; angle: number; assigned: boolean; startPt: {x:number, y:number}; endPt: {x:number, y:number} }[] = [];
  
  if (topology) {
    // Extract edges from all rings
    const rings = [topology.outer, ...topology.holes];
    let edgeIdx = 0;
    for (const ring of rings) {
      const rn = ring.length;
      for (let i = 0; i < rn; i++) {
        const j = (i + 1) % rn;
        const dx = ring[j].x - ring[i].x;
        const dy = ring[j].y - ring[i].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.1) {
          edges.push({ 
            i: edgeIdx, 
            j: edgeIdx + 1, 
            length: len, 
            angle: Math.atan2(dy, dx), 
            assigned: false,
            startPt: ring[i],
            endPt: ring[j]
          });
          edgeIdx += 2;
        }
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = vertices[j].x - vertices[i].x;
      const dy = vertices[j].y - vertices[i].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.1) {
        edges.push({ 
          i, 
          j, 
          length: len, 
          angle: Math.atan2(dy, dx), 
          assigned: false,
          startPt: vertices[i],
          endPt: vertices[j]
        });
      }
    }
  }

  // 2. Sort by length descending to greedily find the largest wings first
  edges.sort((a, b) => b.length - a.length);

  let wingId = 0;
  for (const baseEdge of edges) {
    if (baseEdge.assigned) continue;

    const dir = baseEdge.angle;
    const cosD = Math.cos(dir);
    const sinD = Math.sin(dir);

    const vi = baseEdge.startPt;
    const vj = baseEdge.endPt;
    const baseMinAlong = Math.min(vi.x * cosD + vi.y * sinD, vj.x * cosD + vj.y * sinD);
    const baseMaxAlong = Math.max(vi.x * cosD + vi.y * sinD, vj.x * cosD + vj.y * sinD);
    const basePerp = -vi.x * sinD + vi.y * cosD;

    let bestOpposite: typeof baseEdge | null = null;
    let minOppositeDist = Infinity;
    let oppPerp = basePerp;
    let oppMinAlong = baseMinAlong;
    let oppMaxAlong = baseMaxAlong;

    // 3. Find opposite parallel edge enclosing the interior
    for (const cand of edges) {
      if (cand.assigned || cand === baseEdge) continue;

      let dAngle = Math.abs(cand.angle - dir) % Math.PI;
      if (dAngle > Math.PI / 2) dAngle = Math.PI - dAngle;

      // Must be roughly parallel
      if (dAngle < degreesToRadians(15)) {
        const ci = cand.startPt;
        const cj = cand.endPt;
        const cMinAlong = Math.min(ci.x * cosD + ci.y * sinD, cj.x * cosD + cj.y * sinD);
        const cMaxAlong = Math.max(ci.x * cosD + ci.y * sinD, cj.x * cosD + cj.y * sinD);

        // Must overlap in the longitudinal direction
        const overlap = Math.max(0, Math.min(baseMaxAlong, cMaxAlong) - Math.max(baseMinAlong, cMinAlong));
        if (overlap > 1) { // Require at least 1m overlap
          // Compute perpendicular offset
          const cPerp = (-ci.x * sinD + ci.y * cosD + -cj.x * sinD + cj.y * cosD) / 2;
          const dist = cPerp - basePerp;
          
          // Since it's a CCW polygon, the interior is to the LEFT of the base edge.
          // The perp axis (-x*sin + y*cos) points exactly left.
          // So the opposite edge must have a greater perp coordinate!
          // We limit the maximum width of a single wing to 35 meters to prevent jumping across courtyards.
          if (dist > 3 && dist < 35 && dist < minOppositeDist) {
            minOppositeDist = dist;
            bestOpposite = cand;
            oppPerp = cPerp;
            oppMinAlong = cMinAlong;
            oppMaxAlong = cMaxAlong;
          }
        }
      }
    }

    if (bestOpposite) {
      baseEdge.assigned = true;
      bestOpposite.assigned = true;

      const width = Math.abs(oppPerp - basePerp);
      const minAlong = Math.min(baseMinAlong, oppMinAlong);
      const maxAlong = Math.max(baseMaxAlong, oppMaxAlong);
      const length = maxAlong - minAlong;

      // Only create a wing if it is somewhat elongated and has real width (filters out zero-width cut-lines)
      // Minimum width of 8.0m ensures we don't pick up slivers or jagged drawing artifacts
      // (a standard single-loaded wing needs at least ~7m units + ~2m corridor = ~9m)
      if (length >= width * 0.4 && width >= 8.0) {
        const perpCenter = (basePerp + oppPerp) / 2;
        const alongCenter = (minAlong + maxAlong) / 2;

        const center = {
          x: alongCenter * cosD - perpCenter * sinD,
          y: alongCenter * sinD + perpCenter * cosD
        };

        const halfLen = length / 2;
        const centerline = {
          start: { x: center.x - cosD * halfLen, y: center.y - sinD * halfLen },
          end: { x: center.x + cosD * halfLen, y: center.y + sinD * halfLen }
        };

        // Construct a conservative bounding box
        const corners = [
          { a: minAlong, p: basePerp }, { a: maxAlong, p: basePerp },
          { a: maxAlong, p: oppPerp }, { a: minAlong, p: oppPerp }
        ].map(c => ({
          x: c.a * cosD - c.p * sinD,
          y: c.a * sinD + c.p * cosD
        }));

        const bounds = {
          minX: Math.min(...corners.map(c => c.x)),
          maxX: Math.max(...corners.map(c => c.x)),
          minY: Math.min(...corners.map(c => c.y)),
          maxY: Math.max(...corners.map(c => c.y))
        };

        wings.push({
          id: wingId++,
          vertices: corners as FootprintVertex[], // store bounding corners for back-compat
          direction: dir,
          length,
          width,
          centerline,
          bounds,
          center,
          sourceEdges: [
            { vi: baseEdge.startPt as FootprintVertex, vj: baseEdge.endPt as FootprintVertex },
            { vi: bestOpposite.startPt as FootprintVertex, vj: bestOpposite.endPt as FootprintVertex }
          ]
        });
        
        // Attach original perp bounds for intersection mapping
        (wings[wings.length - 1] as any).basePerp = basePerp;
        (wings[wings.length - 1] as any).oppPerp = oppPerp;
      }
    } else {
      // Mark as assigned anyway so we don't process end caps as base edges
      baseEdge.assigned = true;
    }
  }

  // 4. Deduplicate wings that are essentially the same
  let uniqueWings: Wing[] = [];
  for (const w of wings) {
    const dup = uniqueWings.find(u => 
      Math.abs(u.center!.x - w.center!.x) < 1 && 
      Math.abs(u.center!.y - w.center!.y) < 1 &&
      (Math.abs(u.direction - w.direction) < 0.2 || Math.abs(Math.abs(u.direction - w.direction) - Math.PI) < 0.2)
    );
    if (!dup) {
      uniqueWings.push(w);
    } else if (w.length > dup.length) {
      // Keep the longer variant
      Object.assign(dup, w);
    }
  }
  
  // 5. Merge collinear adjacent wings (fixes the "split wing" issue from zero-width cut lines)
  // With topology, we don't have zero-width cut lines, but we might still have collinear wings
  // from slight facade jogs.
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < uniqueWings.length; i++) {
      for (let j = i + 1; j < uniqueWings.length; j++) {
        const w1 = uniqueWings[i];
        const w2 = uniqueWings[j];
        
        // Check if parallel
        const dAngle = Math.abs(w1.direction - w2.direction) % Math.PI;
        const isParallel = dAngle < 0.2 || Math.abs(dAngle - Math.PI) < 0.2;
        
        if (isParallel) {
          const cosD = Math.cos(w1.direction);
          const sinD = Math.sin(w1.direction);
          
          // Project centers onto w1's perpendicular axis to check alignment
          const p1 = -w1.center!.x * sinD + w1.center!.y * cosD;
          const p2 = -w2.center!.x * sinD + w2.center!.y * cosD;
          
          // If they are aligned within 5 meters (allows for slight facade jogs)
          if (Math.abs(p1 - p2) < 5.0) {
            // Project onto w1's along axis to check adjacency/overlap
            const a1 = w1.center!.x * cosD + w1.center!.y * sinD;
            const a2 = w2.center!.x * cosD + w2.center!.y * sinD;
            
            const w1Min = a1 - w1.length / 2;
            const w1Max = a1 + w1.length / 2;
            const w2Min = a2 - w2.length / 2;
            const w2Max = a2 + w2.length / 2;
            
            // If they overlap or are adjacent (within 5 meters)
            if (w1Max >= w2Min - 5.0 && w2Max >= w1Min - 5.0) {
              // Merge them!
              const newMin = Math.min(w1Min, w2Min);
              const newMax = Math.max(w1Max, w2Max);
              const newLength = newMax - newMin;
              const newAlongCenter = (newMin + newMax) / 2;
              
              // Average the perpendicular position based on length weights
              const newPerpCenter = (p1 * w1.length + p2 * w2.length) / (w1.length + w2.length);
              const newWidth = Math.max(w1.width, w2.width);
              
              const newCenter = {
                x: newAlongCenter * cosD - newPerpCenter * sinD,
                y: newAlongCenter * sinD + newPerpCenter * cosD
              };
              
              const halfLen = newLength / 2;
              const newCenterline = {
                start: { x: newCenter.x - cosD * halfLen, y: newCenter.y - sinD * halfLen },
                end: { x: newCenter.x + cosD * halfLen, y: newCenter.y + sinD * halfLen }
              };
              
              const newBounds = {
                minX: Math.min(w1.bounds.minX, w2.bounds.minX),
                maxX: Math.max(w1.bounds.maxX, w2.bounds.maxX),
                minY: Math.min(w1.bounds.minY, w2.bounds.minY),
                maxY: Math.max(w1.bounds.maxY, w2.bounds.maxY)
              };
              
      const mergedWing: Wing = {
        id: w1.id, // keep first id
        vertices: [...w1.vertices, ...w2.vertices], // just keep all for bounds
        direction: w1.direction,
        length: newLength,
        width: newWidth,
        centerline: newCenterline,
        bounds: newBounds,
        center: newCenter,
        sourceEdges: [...(w1.sourceEdges || []), ...(w2.sourceEdges || [])]
      };
      
      // Update original oppPerp/basePerp if needed
      (mergedWing as any).basePerp = Math.min((w1 as any).basePerp || 0, (w2 as any).basePerp || 0);
      (mergedWing as any).oppPerp = Math.max((w1 as any).oppPerp || 0, (w2 as any).oppPerp || 0);

      // Replace w1, remove w2
      uniqueWings[i] = mergedWing;
              uniqueWings.splice(j, 1);
              merged = true;
              break;
            }
          }
        }
      }
      if (merged) break;
    }
  }
  
  // Ensure sequential IDs
  uniqueWings.forEach((w, i) => w.id = i);

  return uniqueWings;
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
// ============================================================================
// Step 4: Find Intersections
// ============================================================================


/**
 * Find the wing that most closely matches the given edge.
 */
function findWingForEdge(wings: Wing[], vi: FootprintVertex, vj: FootprintVertex, cornerVertex: FootprintVertex): Wing | null {
  // 1. Topological Match: A wing owns this edge if its sourceEdges array contains it.
  // This perfectly handles adjacent wings without false geometric positives.
  for (const w of wings) {
    if (w.sourceEdges) {
      for (const edge of w.sourceEdges) {
        // Since we paired them, edge.vi and edge.vj might correspond to vi,vj or vj,vi
        if ((edge.vi.index === vi.index && edge.vj.index === vj.index) ||
            (edge.vi.index === vj.index && edge.vj.index === vi.index)) {
          return w;
        }
      }
    }
  }

  // 2. Strict Spatial Fallback: If edge was part of a dropped artifact (e.g. zero-width cut),
  // we find a wing that is closely aligned to the edge AND physically contains the corner.
  const dx = vj.x - vi.x;
  const dy = vj.y - vi.y;
  const angle = Math.atan2(dy, dx);
  
  let bestWing: Wing | null = null;
  let bestScore = Infinity;

  for (const w of wings) {
    // Topology match failed, but check if the corner vertex literally touches this wing.
    // Convert to wing-local coordinates
    const cosD = Math.cos(w.direction);
    const sinD = Math.sin(w.direction);
    
    const cx = w.center!.x;
    const cy = w.center!.y;
    const vx = cornerVertex.x - cx;
    const vy = cornerVertex.y - cy;
    
    const localX = vx * cosD + vy * sinD;
    const localY = -vx * sinD + vy * cosD;
    
    // The corner must actually be touching the wing!
    // A concave corner *must* lie exactly on the side wall of the wing, or at its tip.
    // So the Y-distance (perp) must be roughly width/2, and X-distance must be within length/2.
    // Allow generous tolerance for intersection matching, especially on inner corners of O buildings
    // where the actual concave vertex might be far from the wing center.
    const maxLocalY = w.width / 2 + 5.0; 
    const maxLocalX = w.length / 2 + 10.0;

    if (Math.abs(localY) > maxLocalY || Math.abs(localX) > maxLocalX) {
      // Corner is physically outside this wing
      continue;
    }

    // Now check if the edge is parallel to the wing
    let dAngle = Math.abs(angle - w.direction) % Math.PI;
    if (dAngle > Math.PI / 2) dAngle = Math.PI - dAngle;
    
    if (dAngle > degreesToRadians(15)) continue;

    // Corner touches the wing AND edge is parallel to it. This is our fallback match.
    // Pick the one that is closest in angle.
    if (dAngle < bestScore) {
      bestScore = dAngle;
      bestWing = w;
    }
  }
  
  return bestWing;
}

function findWingIntersections(
  wings: Wing[],
  allVertices: FootprintVertex[],
  concaveIndices: number[]
): WingIntersection[] {
  const intersections: WingIntersection[] = [];

  
  const debugLogs: any[] = [];

  for (const idx of concaveIndices) {
    const v = allVertices[idx];
    
    // Check both topological neighbors (from the same ring)
    if (!v.prev || !v.next) continue;

    // For holes (which are CW relative to building interior), the "in" and "out"
    // edges might need to be checked in reverse if the corners are on the hole.
    // However, the topological match (does wing contain both vi and vj) is undirected!
    const eIn = { vi: v.prev, vj: v };
    const eOut = { vi: v, vj: v.next };

    const wingIn = findWingForEdge(wings, eIn.vi, eIn.vj, v);
    const wingOut = findWingForEdge(wings, eOut.vi, eOut.vj, v);
    
    // Fallback: If one wing fails to be found via the standard edges, search all other wings
    // to see if they overlap this intersection point geographically. This fixes the O building
    // where a hole edge wasn't mapping correctly.
    if (!wingIn || !wingOut) {
      const candidates = wings.filter(w => {
        // Quick bounding box check
        const mergeEps = 5.0;
        if (!(v.x >= w.bounds.minX - mergeEps && v.x <= w.bounds.maxX + mergeEps &&
              v.y >= w.bounds.minY - mergeEps && v.y <= w.bounds.maxY + mergeEps)) {
          return false;
        }
        
        const cosD = Math.cos(w.direction);
        const sinD = Math.sin(w.direction);
        const cx = w.center!.x;
        const cy = w.center!.y;
        const vx = v.x - cx;
        const vy = v.y - cy;
        const perpDist = Math.abs(-vx * sinD + vy * cosD);
        const alongDist = Math.abs(vx * cosD + vy * sinD);
        
        return perpDist <= (w.width / 2) + 5.0 && alongDist <= (w.length / 2) + 5.0;
      });
      
      if (candidates.length >= 2) {
        // Find best perpendicular pair among candidates
        let w1 = candidates[0], w2 = candidates[1];
        let bestScore = -Infinity;
        for (let i = 0; i < candidates.length; i++) {
          for (let j = i + 1; j < candidates.length; j++) {
            const angle = Math.abs(candidates[i].direction - candidates[j].direction) % Math.PI;
            const score = Math.sin(angle);
            if (score > bestScore) {
              bestScore = score;
              w1 = candidates[i];
              w2 = candidates[j];
            }
          }
        }
        if (w1.id !== w2.id) {
          const existing = intersections.find(i => 
            (i.wingIds[0] === w1.id && i.wingIds[1] === w2.id) ||
            (i.wingIds[0] === w2.id && i.wingIds[1] === w1.id)
          );
          if (!existing) {
            const angle = Math.abs(w1.direction - w2.direction);
            const dAngle = angle % Math.PI;
            const isParallel = dAngle < (15 * Math.PI / 180) || dAngle > Math.PI - (15 * Math.PI / 180);
            
            if (!isParallel) {
              const maxDepth = WING_DETECTION.maxInnerZoneDepth;
              const d1 = Math.min(w1.width / 2, maxDepth);
              const d2 = Math.min(w2.width / 2, maxDepth);
              const innerZonePolygon = buildInnerZonePolygon(v, w1, w2, d1, d2);
              intersections.push({
                point: v,
                type: 'inner',
                wingIds: [w1.id, w2.id],
                angle,
                innerZone: { polygon: innerZonePolygon, area: d1 * d2 }
              });
            }
          }
        }
      }
    } else if (wingIn && wingOut && wingIn.id !== wingOut.id) {
      // Standard intersection logic
      // Prevent duplicate intersections for the same wing pair
      const exists = intersections.some(i => 
        (i.wingIds[0] === wingIn.id && i.wingIds[1] === wingOut.id) ||
        (i.wingIds[0] === wingOut.id && i.wingIds[1] === wingIn.id)
      );

      if (!exists) {
        let angle = Math.abs(wingIn.direction - wingOut.direction);
        const dAngle = angle % Math.PI;
        const isParallel = dAngle < (15 * Math.PI / 180) || dAngle > Math.PI - (15 * Math.PI / 180);
        if (isParallel) {
          // Do not intersect roughly parallel wings (e.g. adjacent segments of a wonky snake)
          continue;
        }

        const maxDepth = WING_DETECTION.maxInnerZoneDepth;
        const d1 = Math.min(wingIn.width / 2, maxDepth);
        const d2 = Math.min(wingOut.width / 2, maxDepth);
        
        const innerZonePolygon = buildInnerZonePolygon(v, wingIn, wingOut, d1, d2);

        intersections.push({
          point: v,
          type: 'inner',
          wingIds: [wingIn.id, wingOut.id],
          angle,
          innerZone: { polygon: innerZonePolygon, area: d1 * d2 }
        });
      }
    } else {
      debugLogs.push({
        failed: true,
        reason: !wingIn ? 'no wingIn' : !wingOut ? 'no wingOut' : 'same wing',
        wingInId: wingIn?.id,
        wingOutId: wingOut?.id
      });
    }
  }

  // Outer corners ...
  // For standard shapes, the outer corner heuristic works. For Courtyards / O-buildings, 
  // where four wings close a loop, all 4 intersections are often correctly found by the fallback check above.
  for (const inner of [...intersections]) {
    const w1 = wings.find(w => w.id === inner.wingIds[0])!;
    const w2 = wings.find(w => w.id === inner.wingIds[1])!;
    if (!w1 || !w2) continue;

    const outerVertex = findOuterCornerVertex(w1, w2, allVertices);
    if (outerVertex && outerVertex.cornerType === CornerType.CONVEX) {
      intersections.push({
        point: outerVertex,
        type: 'outer',
        wingIds: [w1.id, w2.id],
        angle: inner.angle,
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
  intersections: WingIntersection[],
  _polygon: FootprintVertex[]
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

  // Pre-calculate projections of all intersections onto each wing
  const wingIntersectionsMap = new Map<number, { index: number, point: FootprintVertex, along: number }[]>();
  for (const w of wings) {
    wingIntersectionsMap.set(w.id, []);
  }

  for (let ii = 0; ii < innerIntersections.length; ii++) {
    const inter = innerIntersections[ii];
    for (const wid of inter.wingIds) {
      const w = wings.find(wing => wing.id === wid)!;
      const cosD = Math.cos(w.direction);
      const sinD = Math.sin(w.direction);
      const dx = inter.point.x - w.center!.x;
      const dy = inter.point.y - w.center!.y;
      const along = dx * cosD + dy * sinD;
      
      wingIntersectionsMap.get(wid)!.push({
        index: ii,
        point: inter.point,
        along
      });
    }
  }

  // Helper to determine 'left' or 'right' end using sorted projections or footprint edges
  const getIntersectionEndForWing = (wid: number, ii: number): 'left' | 'right' => {
    const inters = wingIntersectionsMap.get(wid)!;
    if (inters.length === 0) return 'left';
    
    if (inters.length === 1) {
      const inter = innerIntersections[inters[0].index];
      const pt = inter.point;
      
      // Find the adjacent vertices in the footprint polygon using prev/next
      const prevPt = pt.prev;
      const nextPt = pt.next;
      
      if (!prevPt || !nextPt) {
        return 'left'; // Fallback
      }
      
      const w = wings.find(wing => wing.id === wid)!;
      const dirX = Math.cos(w.direction);
      const dirY = Math.sin(w.direction);
      
      const vecPrevX = prevPt.x - pt.x;
      const vecPrevY = prevPt.y - pt.y;
      const lenPrev = Math.hypot(vecPrevX, vecPrevY);
      const dotPrev = lenPrev > 0.01 ? Math.abs((vecPrevX * dirX + vecPrevY * dirY) / lenPrev) : 0;
      
      const vecNextX = nextPt.x - pt.x;
      const vecNextY = nextPt.y - pt.y;
      const lenNext = Math.hypot(vecNextX, vecNextY);
      const dotNext = lenNext > 0.01 ? Math.abs((vecNextX * dirX + vecNextY * dirY) / lenNext) : 0;
      
      // Use the edge that aligns better with the wing direction
      let edgeVecX, edgeVecY;
      if (dotPrev > dotNext) {
        edgeVecX = vecPrevX;
        edgeVecY = vecPrevY;
      } else {
        edgeVecX = vecNextX;
        edgeVecY = vecNextY;
      }
      
      // Project this edge vector onto the wing direction
      const dotEdge = edgeVecX * dirX + edgeVecY * dirY;
      
      // If dotEdge is positive, the footprint edge physically points in the positive direction.
      // This means the physical bulk of the wing lies in the positive direction from the intersection.
      // Thus, the intersection is at the negative end ('left').
      // Conversely, if dotEdge is negative, the wing bulk lies in the negative direction,
      // so the intersection is at the positive end ('right').
      const end = dotEdge >= 0 ? 'left' : 'right';

      return end;
    }
    
    // Sort intersections along the wing
    const sorted = [...inters].sort((a, b) => a.along - b.along);
    const sortedIndex = sorted.findIndex(x => x.index === ii);
    
    // The one with the minimum 'along' is the 'left' end. Others are 'right'.
    return sortedIndex === 0 ? 'left' : 'right';
  };

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
    const hostCenterY = (hostWing.bounds.minY + hostWing.bounds.maxY) / 2;
    const hostCoreSide: 'North' | 'South' = concaveVertex.y <= hostCenterY ? 'North' : 'South';

    const hostIntersectionEnd = getIntersectionEndForWing(hostId, ii);

    const guestCenterY = (guestWing.bounds.minY + guestWing.bounds.maxY) / 2;
    const guestCoreSide: 'North' | 'South' = concaveVertex.y <= guestCenterY ? 'North' : 'South';
    const guestIntersectionEnd = getIntersectionEndForWing(guestId, ii);

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
  
  // A courtyard has a closed cycle of wings.
  // We can check this by building a graph of inner intersections.
  const adj = new Map<number, number[]>();
  for (const w of wings) adj.set(w.id, []);
  for (const i of intersections) {
    if (i.type === 'inner') {
      adj.get(i.wingIds[0])!.push(i.wingIds[1]);
      adj.get(i.wingIds[1])!.push(i.wingIds[0]);
    }
  }
  
  let hasCycle = false;
  const visited = new Set<number>();
  
  const dfs = (curr: number, parent: number) => {
    visited.add(curr);
    for (const neighbor of adj.get(curr)!) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, curr);
      } else if (neighbor !== parent) {
        hasCycle = true;
      }
    }
  };
  
  for (const w of wings) {
    if (!visited.has(w.id)) {
      dfs(w.id, -1);
    }
  }

  if (hasCycle) return 'courtyard';

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
 * @param topology - Optional topology containing outer and hole rings
 * @returns WingDetectionResult with all wing/intersection data + roles/net lengths
 */
export function analyzeFootprint(
  polygon: { x: number; y: number }[],
  topology?: import('./types').FootprintTopology
): MultiWingAnalysis {
  // Classify vertices (rotation-invariant: cross products don't change with rotation)
  const vertices = classifyVertices(polygon);

      // Check for simple bar (no concave corners and no holes)
  const hasConcave = vertices.some(v => v.cornerType === CornerType.CONCAVE);
  const hasHoles = topology && topology.holes && topology.holes.length > 0;
  if (!hasConcave && !hasHoles) {
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
  
  // Also normalize topology if provided
  let alignedTopology = undefined;
  if (topology) {
    const cosA = Math.cos(-normAngle);
    const sinA = Math.sin(-normAngle);
    const alignRing = (ring: {x:number, y:number}[]) => ring.map(v => {
      const tx = v.x - normCx;
      const ty = v.y - normCy;
      return { x: tx * cosA - ty * sinA, y: tx * sinA + ty * cosA };
    });
    alignedTopology = {
      outer: alignRing(topology.outer),
      holes: topology.holes.map(alignRing)
    };
  }

  const alignedVertices = classifyVertices(aligned);
  
  // Combine all vertices from outer and holes for intersection detection
  let allVertices = [...alignedVertices];
  if (alignedTopology) {
    allVertices = classifyVertices(alignedTopology.outer);
    for (const hole of alignedTopology.holes) {
      // Holes are CW. If we pass them directly to classifyVertices, right turns (cross < 0) 
      // will be classified as CONCAVE. Because the building material is outside the hole 
      // (to the left when walking CW), these right turns are indeed reflex angles (concave)
      // for the building itself. This perfectly matches the logic we need!
      const holeVerts = classifyVertices(hole);
      // Adjust indices so they don't overlap
      const offset = allVertices.length;
      for (const v of holeVerts) {
        v.index += offset;
        allVertices.push(v);
      }
    }
  }

  // Detect dominant directions on axis-aligned polygon
  detectDominantDirections(alignedVertices); // kept for now if we want to log

  // Start walk at farthest vertex from any concave vertex to avoid degenerate splits
  const concaveIndices = allVertices
    .map((v, i) => ({ v, i }))
    .filter(e => e.v.cornerType === CornerType.CONCAVE)
    .map(e => e.i);
    
  // Identify wings (returns groups + junction vertex indices between wings)
  const wings = buildWings(alignedVertices, alignedTopology);

  // Normalize wings topology edges to use the unified allVertices so that prev/next match.
  // Because `buildWings` only had access to `alignedTopology` which was built from `aligned` (outer) and `alignedTopology.holes`,
  // the vertex objects in the wings `sourceEdges` might be different object references than `allVertices`.
  for (const w of wings) {
    if (w.sourceEdges) {
      for (const edge of w.sourceEdges) {
        // Find the matching vertex by coordinate. 
        // We use a small epsilon because rotation/unrotation can introduce tiny precision errors.
        const eps = 0.01;
        edge.vi = allVertices.find(v => Math.abs(v.x - edge.vi.x) < eps && Math.abs(v.y - edge.vi.y) < eps) || edge.vi;
        edge.vj = allVertices.find(v => Math.abs(v.x - edge.vj.x) < eps && Math.abs(v.y - edge.vj.y) < eps) || edge.vj;
      }
    }
  }

  // Find intersections (using global edge proximity)
  const intersections = findWingIntersections(wings, allVertices, concaveIndices);

  // Determine host/guest roles
  const wingRoles = determineWingRoles(wings, intersections, allVertices);

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
