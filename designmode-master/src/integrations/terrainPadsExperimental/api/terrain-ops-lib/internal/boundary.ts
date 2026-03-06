function comparePoints2D(p0: [number, number], p1: [number, number]) {
  return p0[0] !== p1[0] ? p0[0] - p1[0] : p0[1] - p1[1]
}

export function getTriangleGroupBoundaryEdges(
  trianglesIndexes: [number, number, number][],
  position: Float32Array,
  interiorPointsMask: boolean[],
) {
  const edges = new Map<string, [number, number]>()
  for (let [a, b, c] of trianglesIndexes) {
    const pa: [number, number] = [position[a * 3], position[a * 3 + 1]]
    const pb: [number, number] = [position[b * 3], position[b * 3 + 1]]
    const pc: [number, number] = [position[c * 3], position[c * 3 + 1]]
    // Don't need to check an edge with a point known to be inside
    const aInside = interiorPointsMask[a]
    const bInside = interiorPointsMask[b]
    const cInside = interiorPointsMask[c]

    const processTriangleEdge = (p0: [number, number], p1: [number, number], i0: number, i1: number) => {
      const key = [p0, p1].sort(comparePoints2D).flat().join("_")
      if (edges.has(key))
        edges.delete(key) // If edge is shared with another triangle, it's not a boundary edge
      else edges.set(key, [i0, i1])
    }
    if (!aInside && !bInside) processTriangleEdge(pa, pb, a, b)
    if (!bInside && !cInside) processTriangleEdge(pb, pc, b, c)
    if (!cInside && !aInside) processTriangleEdge(pc, pa, c, a)
  }
  return Array.from(edges.values())
}
