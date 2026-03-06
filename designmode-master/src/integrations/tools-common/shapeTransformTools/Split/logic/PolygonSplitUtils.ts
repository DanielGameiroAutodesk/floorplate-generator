import { ShapeUtils, Vector2, Vector3 } from "three"
import insidePolygon from "robust-point-in-polygon"
import uniqWith from "lodash/uniqWith"
import remove from "lodash/remove"
import { closePolygon } from "src/lib/three/polygon"

export type SplitablePolygon = Vector3[]
export type SplitLine = Vector3[]

type Coord = [number, number]
type LineSegment = [Coord, Coord]
export type LineChunk = {
  coords: Coord[]
  start: Coord
  end: Coord
}

//Converted from: http://bl.ocks.org/nitaku/fdbb70c3baa36e8feb4e
function intersection(L1Start: Vector3, L1End: Vector3, L2Start: Vector3, L2End: Vector3): Coord | undefined {
  const Ex = L1End.x - L1Start.x
  const Ey = L1End.y - L1Start.y
  const L1Direction = new Vector3().subVectors(L1End, L1Start) //F
  const L2Direction = new Vector3().subVectors(L2End, L2Start) //F

  const intersectionPointAlongL1 =
    (-L1Direction.y * (L1Start.x - L2Start.x) + Ex * (L1Start.y - L2Start.y)) /
    (-L2Direction.x * Ey + Ex * L2Direction.y)

  const intersectionPointAlongL2 =
    (L2Direction.x * (L1Start.y - L2Start.y) - L2Direction.y * (L1Start.x - L2Start.x)) /
    (-L2Direction.x * Ey + Ex * L2Direction.y)

  const round = (num: number) => Math.round((num + Number.EPSILON) * 1000) / 1000

  const onL1 = round(intersectionPointAlongL1) >= 0 && round(intersectionPointAlongL1) <= 1
  const onL2 = round(intersectionPointAlongL2) >= 0 && round(intersectionPointAlongL2) <= 1

  if (onL1 && onL2) {
    return [L1Start.x + intersectionPointAlongL2 * Ex, L1Start.y + intersectionPointAlongL2 * Ey]
  } else {
    return undefined
  }
}

function makeSegments(vertices: Vector3[]): LineSegment[] {
  return vertices
    .map((v) => [v.x, v.y] as Coord)
    .reduce<LineSegment[]>((segments, currentVertex, idx, polygon) => {
      if (idx === polygon.length - 1) return segments
      const nextVertex = polygon[idx + 1]
      return [...segments, [currentVertex, nextVertex]]
    }, [])
}

function intersectLines(line1: LineSegment, line2: LineSegment): Coord | undefined {
  let pointOfIntersection = intersection(
    new Vector3(line1[0][0], line1[0][1]),
    new Vector3(line1[1][0], line1[1][1]),
    new Vector3(line2[0][0], line2[0][1]),
    new Vector3(line2[1][0], line2[1][1]),
  )
  if (!pointOfIntersection) return undefined

  return pointOfIntersection
}

function chunk(segments: LineSegment[]): LineChunk {
  const line = [segments[0][0], ...segments.map((s) => s[1])]
  return {
    coords: line,
    start: line[0],
    end: line[line.length - 1],
  }
}

function coordDistance(c1: Coord, c2: Coord): number {
  return Math.sqrt(Math.pow(c2[0] - c1[0], 2) + Math.pow(c2[1] - c1[1], 2))
}

const chunkSegments = (segments: LineSegment[], intersectionCoords: Coord[]): LineChunk[] => {
  const chunks: LineChunk[] = []
  let building: LineSegment[] = []
  segments.forEach((seg) => {
    building.push(seg)

    const end = building[building.length - 1][1]
    if (
      intersectionCoords.some((point) => {
        return sameCoord(point, end)
      })
    ) {
      chunks.push(chunk(building))
      building = []
      return
    }
  })
  if (building.length > 0) {
    chunks.push(chunk(building))
  }
  return chunks
}

function splitSegment(segment: LineSegment, at: Coord[]): LineSegment[] {
  const slicePoints = uniqWith(at, (a, b) => sameCoord(a, b)).filter(
    (p) => !sameCoord(p, segment[0]) && !sameCoord(p, segment[1]),
  )
  if (slicePoints.length === 0) return [segment]

  const distanceToSegmentStart = (c: Coord) => coordDistance(segment[0], c)
  slicePoints.sort((a, b) => distanceToSegmentStart(a) - distanceToSegmentStart(b))

  const vertices = [segment[0], ...slicePoints, segment[1]]

  return vertices.reduce<LineSegment[]>((acc, currentVert, idx, vertices) => {
    if (idx === vertices.length - 1) return acc
    const next = vertices[idx + 1]
    return [...acc, [currentVert, next]]
  }, [])
}

export function connectInnerChunks(chunks: LineChunk[]) {
  const out: LineChunk[] = []
  const toDiscard: LineChunk[] = []

  chunks.forEach((c) => {
    let toAdd = c
    let connectedChunk = chunks.find((otherChunk) => {
      return sameCoord(otherChunk.start, c.end) && !sameCoord(otherChunk.end, c.start)
    })

    if (connectedChunk) {
      const [, ...addedCoords] = connectedChunk.coords
      const chunk: LineChunk = {
        start: c.start,
        end: connectedChunk.end,
        coords: [...c.coords, ...addedCoords],
      }

      const polygon = [c.start, c.end, connectedChunk.end, c.start].map((c) => new Vector2(c[0], c[1]))
      if (!ShapeUtils.isClockWise(polygon)) {
        toDiscard.push(connectedChunk)
        toDiscard.push(c)
        toAdd = chunk
      }
    }

    out.push(toAdd)
  })

  toDiscard.forEach((d) => remove(out, d))
  return out
}

function chunkInternalSegments(slicerSegments: LineSegment[], intersectionCoords: Coord[]) {
  //Connect the slicer segments into chunks
  let slicerChunks = chunkSegments(slicerSegments, intersectionCoords)
    //Add the reverse of each slicer chunk
    .flatMap((c) => {
      return [
        c,
        {
          coords: [...c.coords].reverse(),
          start: c.end,
          end: c.start,
        } as LineChunk,
      ]
    })
    .filter(
      (slicerChunk) =>
        intersectionCoords.filter((ic) => sameCoord(ic, slicerChunk.start) || sameCoord(ic, slicerChunk.end)).length ===
        2,
    )
  slicerChunks = connectInnerChunks(slicerChunks)
  return slicerChunks
}

function slice(
  slicee: LineSegment[],
  slicer: LineSegment[],
  inPoly: (ls: LineSegment) => boolean,
): [LineChunk[], LineChunk[]] {
  let slicerSegments: LineSegment[] = []
  let sliceeSegments = [...slicee]
  let intersectionCoords: Coord[] = []

  slicer.forEach((slicerSegment) => {
    const intersections: Coord[] = []
    const newSliceeSegments: LineSegment[] = []

    sliceeSegments.forEach((sliceeSegment) => {
      const intersectionAt = intersectLines(slicerSegment, sliceeSegment)

      if (intersectionAt) {
        intersections.push(intersectionAt)

        //Put the split slicee segment back into the list of slicee segments
        newSliceeSegments.push(...splitSegment(sliceeSegment, [intersectionAt]))
      } else {
        //Keep the existing slicee segment
        newSliceeSegments.push(sliceeSegment)
      }
    })
    sliceeSegments = newSliceeSegments

    // Split the slicer segment at all its intersection points and put those of the resulting segments
    // that are inside the original polygon into the list of resulting slicer segments
    slicerSegments.push(...splitSegment(slicerSegment, intersections).filter((l) => inPoly(l)))
    intersectionCoords.push(...intersections)
  })

  intersectionCoords = uniqWith(intersectionCoords, sameCoord)

  //Connect the slicee segments into chunks
  let sliceeChunks = chunkSegments(sliceeSegments, intersectionCoords)
  let slicerChunks = chunkInternalSegments(slicerSegments, intersectionCoords)

  return [sliceeChunks, slicerChunks]
}

const eps = 0.0001

function sameCoord(c1: Coord, c2: Coord): boolean {
  const dx = Math.abs(c1[0] - c2[0])
  const dy = Math.abs(c1[1] - c2[1])

  return dx < eps && dy < eps
}

type Vec = {
  x: number
  y: number
}

function segmentMiddle(l: LineSegment): Coord {
  const lx = l[1][0] - l[0][0]
  const ly = l[1][1] - l[0][1]

  return [l[0][0] + lx / 2, l[0][1] + ly / 2]
}

/**
 * Splits a polygon along a line
 * @author jorgen@spacemaker.ai
 *
 * @param polygon the polygon to be split
 * @param splitAlongLine the line to split along
 * @param isLine ths split shape is a line (non-closed polygon)
 * @return the list of resulting polygons
 */
export function splitPolygon(polygon: SplitablePolygon, splitAlongLine: Vector3[], isLine = false): Vec[][] {
  let thePolygon = isLine ? polygon : closePolygon(polygon)

  const poly: [number, number][] = thePolygon.map((v) => [v.x, v.y])
  const segmentInPoly = (lineSegment: LineSegment) => {
    const midPoint = segmentMiddle(lineSegment)
    return insidePolygon(poly, midPoint) === -1 //Middle of segment is inside polygon
  }

  const polygonSegments = makeSegments(thePolygon)
  const splitLineSegments = makeSegments(splitAlongLine)

  // Create list of chunks (connected line segments that span between two intersection points) that
  // will be part of the final polygons for the polygon and the splitting line.
  const [polygonChunks, innerLineChunks] = slice(polygonSegments, splitLineSegments, segmentInPoly)

  if (isLine) {
    return polygonChunks.map((c) => c.coords.map((c) => ({ x: c[0], y: c[1] })))
  }

  if (innerLineChunks.length === 0) return [polygon]

  const unpicked = [...polygonChunks]
  const polygons: Coord[][] = []

  //Construct the resulting polygons by connecting alternating chunks from the polygon and splitting line chunks
  while (unpicked.length > 0) {
    const first = unpicked.pop()!
    let cur: Coord[] = [...first.coords]
    let outerNext = false
    let misses = 0
    while (!sameCoord(cur[0], cur[cur.length - 1])) {
      const curLast = cur[cur.length - 1]

      if (outerNext) {
        const [matched] = remove(unpicked, (chunk) => sameCoord(chunk.start, curLast))
        if (matched) {
          const [, ...toAdd] = matched.coords
          cur = [...cur, ...toAdd]
          misses = 0
        } else {
          misses += 1
          //Can happen with partially overlapping chunks
          break
        }
      } else {
        const [matched] = remove(innerLineChunks, (chunk) => sameCoord(chunk.start, curLast))
        if (matched) {
          const [, ...toAdd] = matched.coords
          cur = [...cur, ...toAdd]
          misses = 0
        } else {
          misses += 1
        }
      }
      if (misses > 2) {
        throw new Error("Split not possible - couldn't find the next chunk")
      }
      outerNext = !outerNext
    }
    if (cur.length > 3) polygons.push(cur) //Floating point inaccuracies can sometimes cause single-segment (3 vertices) artifacts when splitting along a line.
  }

  return polygons.map((p) => p.map((c) => ({ x: c[0], y: c[1] })))
}
