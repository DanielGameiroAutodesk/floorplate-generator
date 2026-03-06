/**
 * @fileoverview Corridor graph construction and shortest-path computation.
 *
 * Models the corridor network of a multi-wing building as a weighted graph:
 * nodes at wing endpoints and intersections, edges weighted by corridor length.
 * Used for egress validation: dead-end limits and travel distance to nearest
 * core (stairwell/elevator). Implements Dijkstra for shortest paths.
 *
 * **Architecture Role**: Called by egress validation logic after multi-wing
 * generation. Wing centerlines and intersection points are converted to a
 * graph; core positions mark exit nodes. Distances are in feet.
 *
 * **Graph Construction**: Wing endpoints are merged within MERGE_DIST (1.0 ft).
 * Intersection points that don't coincide with endpoints trigger edge-splitting:
 * the closest corridor edge is split so the intersection node is reachable.
 */

import { Point } from '../types/geometry';
import { distance } from './point';

/**
 * A node in the corridor graph.
 */
export interface CorridorGraphNode {
  /** Spatial position of the node */
  point: Point;
  /** True if this node represents a core (exit/stairwell) */
  isCore: boolean;
}

/**
 * Corridor graph: nodes and weighted edges.
 *
 * Edges are stored as [nodeA index, nodeB index, weight]. Graph is undirected.
 */
export interface CorridorGraph {
  nodes: CorridorGraphNode[];
  /** [nodeA index, nodeB index, weight (distance in feet)] */
  edges: [number, number, number][];
}

/**
 * Builds a corridor graph from wing centerlines, intersection points, and core positions.
 *
 * Creates nodes at wing endpoints (merged within 1.0 ft) and intersection points.
 * Edges follow wing centerlines. Intersection points that fall mid-edge (>1.0 ft
 * from endpoints) trigger edge-splitting so they are reachable. Core positions
 * mark exit nodes for egress distance computation.
 *
 * @param wingCenterlines - Line segments for each wing (start/end of centerline)
 * @param intersectionPoints - Points where wings meet
 * @param corePositions - Core (exit) locations
 * @returns CorridorGraph with nodes and weighted edges
 *
 * @remarks
 * MERGE_DIST (1.0) and SPLIT_DIST (3.0) are tuning constants. Intersection
 * points > SPLIT_DIST from any edge remain isolated; t ∈ (0.01, 0.99) avoids
 * splitting at endpoints.
 */
export function buildCorridorGraph(
  wingCenterlines: { start: Point; end: Point }[],
  intersectionPoints: Point[],
  corePositions: Point[]
): CorridorGraph {
  const nodes: CorridorGraphNode[] = [];
  const edges: [number, number, number][] = [];

  const findOrAddNode = (p: Point, isCore: boolean): number => {
    const MERGE_DIST = 1.0; // Merge endpoints within 1.0 ft
    for (let i = 0; i < nodes.length; i++) {
      if (distance(nodes[i].point, p) < MERGE_DIST) {
        if (isCore) nodes[i].isCore = true;
        return i;
      }
    }
    nodes.push({ point: p, isCore });
    return nodes.length - 1;
  };

  for (const cl of wingCenterlines) {
    const a = findOrAddNode(cl.start, false);
    const b = findOrAddNode(cl.end, false);
    edges.push([a, b, distance(cl.start, cl.end)]);
  }

  for (const ip of intersectionPoints) {
    const ipNode = findOrAddNode(ip, false);

    const SPLIT_DIST = 3.0; // Max distance from edge to consider splitting
    let bestEdgeIdx = -1;
    let bestT = 0;
    let bestDistToEdge = SPLIT_DIST;

    for (let ei = 0; ei < edges.length; ei++) {
      const [aIdx, bIdx] = edges[ei];
      if (aIdx === ipNode || bIdx === ipNode) {
        bestEdgeIdx = -1;
        break; // ipNode already an endpoint of this edge; no split
      }
      const a = nodes[aIdx].point;
      const b = nodes[bIdx].point;
      const dx = b.x - a.x, dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-9) continue; // Degenerate edge
      const t = Math.max(0, Math.min(1, ((ip.x - a.x) * dx + (ip.y - a.y) * dy) / lenSq)); // Projection param
      const projX = a.x + t * dx, projY = a.y + t * dy;
      const d = Math.sqrt((ip.x - projX) ** 2 + (ip.y - projY) ** 2);
      if (d < bestDistToEdge) {
        bestDistToEdge = d;
        bestEdgeIdx = ei;
        bestT = t;
      }
    }

    if (bestEdgeIdx >= 0 && bestT > 0.01 && bestT < 0.99) {
      const [aIdx, bIdx] = edges[bestEdgeIdx];
      const dA = distance(nodes[aIdx].point, ip);
      const dB = distance(nodes[bIdx].point, ip);
      edges[bestEdgeIdx] = [aIdx, ipNode, dA];
      edges.push([ipNode, bIdx, dB]);
    }
  }

  for (const cp of corePositions) {
    findOrAddNode(cp, true);
  }

  return { nodes, edges };
}

/**
 * Computes shortest distance from a node to the nearest core via Dijkstra.
 *
 * Runs single-source shortest path. Returns as soon as any core node is
 * reached (first core popped from priority queue), or scans all nodes and
 * returns minimum core distance (or Infinity if unreachable).
 *
 * @param graph - Corridor graph (nodes and edges)
 * @param fromNode - Starting node index
 * @returns Distance in feet to nearest core; Infinity if none reachable
 */
export function shortestPathToCore(
  graph: CorridorGraph,
  fromNode: number
): number {
  const n = graph.nodes.length;
  const dist = new Array<number>(n).fill(Infinity);
  const visited = new Array<boolean>(n).fill(false);
  dist[fromNode] = 0;

  const adj: [number, number][][] = Array.from({ length: n }, () => []);
  for (const [a, b, w] of graph.edges) {
    adj[a].push([b, w]);
    adj[b].push([a, w]);
  }

  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u === -1) break;
    visited[u] = true;

    if (graph.nodes[u].isCore && u !== fromNode) {
      return dist[u];
    }

    for (const [v, w] of adj[u]) {
      if (!visited[v] && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
      }
    }
  }

  let minCoreDist = Infinity;
  for (let i = 0; i < n; i++) {
    if (graph.nodes[i].isCore && dist[i] < minCoreDist) {
      minCoreDist = dist[i];
    }
  }
  return minCoreDist;
}
