/**
 * Corridor graph construction and shortest-path for egress validation.
 *
 * The corridor in a multi-wing building is a polyline that turns at
 * intersections. To validate dead-end and travel distances we model
 * the corridor as a small weighted graph and run Dijkstra.
 */

import { Point } from '../types/geometry';
import { distance } from './point';

export interface CorridorGraphNode {
  point: Point;
  isCore: boolean;
}

export interface CorridorGraph {
  nodes: CorridorGraphNode[];
  /** [nodeA index, nodeB index, weight (distance)] */
  edges: [number, number, number][];
}

/**
 * Build a corridor graph from wing centerlines, intersection points, and core positions.
 *
 * Each wing contributes two endpoint nodes (its far tip and its intersection tip).
 * Intersection points merge nearby endpoints. Core positions flag the nearest node.
 */
export function buildCorridorGraph(
  wingCenterlines: { start: Point; end: Point }[],
  intersectionPoints: Point[],
  corePositions: Point[]
): CorridorGraph {
  const nodes: CorridorGraphNode[] = [];
  const edges: [number, number, number][] = [];

  const findOrAddNode = (p: Point, isCore: boolean): number => {
    const MERGE_DIST = 1.0;
    for (let i = 0; i < nodes.length; i++) {
      if (distance(nodes[i].point, p) < MERGE_DIST) {
        if (isCore) nodes[i].isCore = true;
        return i;
      }
    }
    nodes.push({ point: p, isCore });
    return nodes.length - 1;
  };

  // Add wing centerline edges
  for (const cl of wingCenterlines) {
    const a = findOrAddNode(cl.start, false);
    const b = findOrAddNode(cl.end, false);
    edges.push([a, b, distance(cl.start, cl.end)]);
  }

  // Add intersection points — then split any nearby edges to ensure connectivity.
  // Without splitting, an intersection point >1.0m from both endpoints becomes
  // an isolated node (Dijkstra returns Infinity, breaking egress validation).
  for (const ip of intersectionPoints) {
    const ipNode = findOrAddNode(ip, false);

    // Check if this intersection node was newly created (not merged into an existing endpoint).
    // If so, find the closest edge and split it at this point.
    const SPLIT_DIST = 3.0; // max distance from edge to consider splitting
    let bestEdgeIdx = -1;
    let bestT = 0;
    let bestDistToEdge = SPLIT_DIST;

    for (let ei = 0; ei < edges.length; ei++) {
      const [aIdx, bIdx] = edges[ei];
      // Skip edges that already touch this node
      if (aIdx === ipNode || bIdx === ipNode) {
        bestEdgeIdx = -1;
        break;
      }
      const a = nodes[aIdx].point;
      const b = nodes[bIdx].point;
      const dx = b.x - a.x, dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((ip.x - a.x) * dx + (ip.y - a.y) * dy) / lenSq));
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
      // Replace the original edge with two sub-edges through the intersection node
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
 * Shortest distance from a given node to the nearest core node via Dijkstra.
 * Returns Infinity if no core is reachable.
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
