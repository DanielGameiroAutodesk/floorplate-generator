import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Vector3,
} from "three"
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh"
import { signedAngleTo } from "./signedAngle"
import {
  isPointInsideMappedEdgesPolygon,
  mapPolygonEdgesToXIntervals,
  type PolygonEdgesMappedToXIntervals,
} from "./mapPolygonEdges"
import { pointInPolygon2D } from "./pointInTriangle"
import { type BBox, isPointInBBox } from "./BBoxIntersection"
import polygonClipping from "polygon-clipping"
import type { FlatPolygonV1, TerrainOperation } from "src/core/terrain/terrain-types"
import { shortenSegments } from "./shortenSegments"
import type { Vec3 } from "src/lib/geometry/geometryTypes"
import { doEdgesIntersect } from "./doEdgesIntersect"
import { DEFAULT_BUFFER, MAX_BUFFER } from "./types"
import { runConstrainedDelaunay } from "./delaunator"
import ArrayUtils from "src/lib/array"
import { filterTrianglesOutsideEdges } from "./padTriangulation"

// intermediate data structure for pads
// the coordinates are stored as 2 polygons: the outer polygon and the inner polygon (both with z = elevation)
// There's also a mesh that can be used for raycasting. This is not exact (contains some unnecessary triangles for concave pad footprints)
// but it's only used for raycasting, so it doesn't matter.
export type MeshedPad = {
  coordinates: [[number, number, number][], [number, number, number][]]
  bbox: [[number, number], [number, number]] // [[minX, minY], [maxX, maxY]]
  mesh: Mesh
  slopes: [[number, number, number], [number, number, number]][] // [[x,y,z], [x,y,z]]
  elevation: number
  id: string
}

type XY = { x: number; y: number }
type PolygonXY = XY[]

function isClockwise(poly: PolygonXY) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length].x - p.x) * (poly[(i + 1) % poly.length].y + p.y),
    0,
  )
  return sum > 0
}

function reversePolygon(polygon: PolygonXY) {
  let reversedPolygon: PolygonXY = []
  for (let i = 0; i < polygon.length; i++) {
    reversedPolygon.push(polygon[polygon.length - i - 1])
  }
  return reversedPolygon
}

function getCCWPolygon(polygon: PolygonXY) {
  if (isClockwise(polygon)) {
    return reversePolygon(polygon)
  } else {
    return polygon
  }
}

const rc = new Raycaster()
let baseTerrainMesh: Mesh

function setupBaseTerrainBVH(geometry: BufferGeometry) {
  if (!baseTerrainMesh || geometry !== baseTerrainMesh.geometry) {
    if (!geometry.boundsTree) {
      geometry.computeBoundsTree = computeBoundsTree
      geometry.disposeBoundsTree = disposeBoundsTree
      geometry.computeBoundsTree()
    }
    baseTerrainMesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }))
    baseTerrainMesh.raycast = acceleratedRaycast
  }
}

function createFastRaycastMesh(mesh: Mesh) {
  mesh.geometry.computeBoundsTree = computeBoundsTree
  mesh.geometry.disposeBoundsTree = disposeBoundsTree
  mesh.geometry.computeBoundsTree()
  mesh.raycast = acceleratedRaycast
  return mesh
}

function getRayDirection(from: Vector3, to: Vector3, slope: number) {
  const nextDir = new Vector2(to.x - from.x, to.y - from.y)
  const nextDir2d = new Vector2(nextDir.y, -nextDir.x).normalize()
  const nextDirDown = new Vector3(nextDir2d.x, nextDir2d.y, -slope).normalize()
  return nextDirDown
}

const MIN_DISTANCE = 0.05

function getIntersectionPoint(
  point: Vector3,
  downDir: Vector3,
  previouslyAppliedPads: MeshedPad[],
): Vector3 | undefined {
  function cast(dir: Vector3) {
    rc.set(point, dir)
    const v0_intersections = rc.intersectObject(baseTerrainMesh)
    // filter terrain intersections that are already covered by pads
    const filteredTerrainIntersection = v0_intersections.find((intersection) => {
      if (intersection.distance < MIN_DISTANCE) return false
      const { x, y } = intersection.point
      return !previouslyAppliedPads.some(
        (pad) => isPointInBBox(x, y, pad.bbox) && pointInPolygon2D(x, y, pad.coordinates[0]),
      )
    })
    // also intersect against meshes of previously applied pads
    const pad_intersections = previouslyAppliedPads.flatMap((pad, i) => {
      const intersections = rc.intersectObject(pad.mesh)
      const firstMatch = intersections.find((intersection) => {
        if (intersection.distance < MIN_DISTANCE) return false
        const { x, y } = intersection.point
        const subsequentPads = previouslyAppliedPads.slice(i + 1)
        // filter out any pad intersections that are covered by already applied pads.
        // this is needed because the mesh for each pad is created when it is first applied,
        // but parts of the mesh might be covered by other pads that were applied later.
        return !subsequentPads.some(
          (pad) => isPointInBBox(x, y, pad.bbox) && pointInPolygon2D(x, y, pad.coordinates[0]),
        )
      })
      return firstMatch ? [firstMatch] : []
    })
    if (pad_intersections.length > 0) {
      return pad_intersections[0].point
    }

    return filteredTerrainIntersection?.point
  }

  // create separate input for this at some point
  const upDir = downDir.clone().setZ(downDir.z * -1)
  const intersectionDown = cast(downDir)
  const intersectionUp = cast(upDir)
  if (intersectionDown && intersectionUp) {
    return intersectionDown.distanceTo(point) < intersectionUp.distanceTo(point) ? intersectionDown : intersectionUp
  } else if (intersectionDown) {
    return intersectionDown
  } else if (intersectionUp) {
    return intersectionUp
  } else {
    return point.clone().add(downDir.clone().setZ(0).normalize().multiplyScalar(MIN_DISTANCE))
  }
}

export type AppliedOperation = {
  base: Vec3[]
  padding: Vec3[][]
  valid: boolean
}

const toVec3 = (p: [number, number, number]) => ({ x: p[0], y: p[1], z: p[2] })

const overlap1d = (a1: number, a2: number, b1: number, b2: number) => {
  return Math.max(a1, b1) <= Math.min(a2, b2)
}

const overlap2d = (a: BBox, b: BBox) => {
  return overlap1d(a[0][0], a[1][0], b[0][0], b[1][0]) && overlap1d(a[0][1], a[1][1], b[0][1], b[1][1])
}

// the % operator, but it works for negative numbers too
const mod = (n: number, m: number) => ((n % m) + m) % m

// this function takes the points in the polygon and filters out the ones that are inside the other polygons
// it returns an array of "linestrings", i.e. arrays of points that are connected by edges in the original array.
// TODO: can we make this more efficient? Maybe store the polygons in a tree structure?
function filterPolygonsToNonOverlappingLinestrings(
  polygon: Vec3[],
  polygonBbox: [[number, number], [number, number]],
  potentiallyOverlappingPolygons: Vec3[][],
  potentialOverlappingPolygonBboxes: BBox[],
  potentialOverlappingEdgeMaps: PolygonEdgesMappedToXIntervals[],
): Vec3[][] {
  const filteredSections: Vec3[][] = []
  let currentSection: Vec3[] = []

  const bboxOverlapPolygons: Vec3[][] = []
  const bboxOverlapPolygonsEdgeMaps: PolygonEdgesMappedToXIntervals[] = []

  potentialOverlappingPolygonBboxes.forEach((bbox, index) => {
    if (overlap2d(polygonBbox, bbox)) {
      bboxOverlapPolygons.push(potentiallyOverlappingPolygons[index])
      bboxOverlapPolygonsEdgeMaps.push(potentialOverlappingEdgeMaps[index])
    }
  })

  for (let i = 0; i < polygon.length; i++) {
    const point = polygon[i]
    const prevPoint = polygon[mod(i - 1, polygon.length)]

    const isInside = bboxOverlapPolygonsEdgeMaps.some((edgeMap) =>
      isPointInsideMappedEdgesPolygon([point.x, point.y], edgeMap),
    )

    const removePoint =
      isInside ||
      bboxOverlapPolygons.some((poly) => {
        return poly.some((p1, i) => {
          const p2 = poly[(i + 1) % poly.length]
          return doEdgesIntersect(prevPoint.x, prevPoint.y, point.x, point.y, p1.x, p1.y, p2.x, p2.y)
        })
      })

    if (removePoint) {
      if (currentSection.length > 0) {
        filteredSections.push(currentSection)
        currentSection = []
      }
    } else {
      currentSection.push(point)
    }
  }
  if (currentSection.length > 0) {
    filteredSections.push(currentSection)
  }
  return filteredSections
}

export function filterOverlappingPadSegments(operations: MeshedPad[]): Vec3[][] {
  // get all outer polygons
  const outer = operations.map((pad) => pad.coordinates[0].map(toVec3))
  const outerBboxes = operations.map((pad) => pad.bbox)

  const edgeMaps = outer.map((poly) => mapPolygonEdgesToXIntervals(poly))

  // filter out points in baseGeo that are inside outer pad
  // remove duplicate points from pads
  const filteredPads = operations.flatMap((pad, i) => {
    const overlappingOuter = outer.slice(i + 1)

    const filteredOuter = filterPolygonsToNonOverlappingLinestrings(
      pad.coordinates[0].map(toVec3),
      pad.bbox,
      overlappingOuter,
      outerBboxes.slice(i + 1),
      edgeMaps.slice(i + 1),
    )
    const filteredInner = filterPolygonsToNonOverlappingLinestrings(
      pad.coordinates[1].map(toVec3),
      pad.bbox,
      overlappingOuter,
      outerBboxes.slice(i + 1),
      edgeMaps.slice(i + 1),
    )

    return [...filteredInner, ...filteredOuter] // remove filteredouter to get something
  })

  return filteredPads
}

// Adapted from https://stackoverflow.com/a/74502156
// remove inbetween poly vertices
function removeInbetweenPoints(points: [number, number][]) {
  let pointsNew = []
  let currentAngle = +getAngle(points[0], points[1]).toFixed(0)

  for (let i = 0; i < points.length; i++) {
    let p1 = points[i]
    // p2 gets get first point if last index
    let n = points[i + 1] ? i + 1 : 0
    let p2 = points[n]
    let angle = +getAngle(p1, p2).toFixed(0)
    // angle change - add vertex to reduced point array
    if (angle != currentAngle || i == 0) {
      pointsNew.push(p1)
      // update current angle for next segment checks
      currentAngle = angle
    }
    // remove start if it intersects with first side
    // if (i == points.length - 1) {
    //   let pLast = points[points.length - 1]
    //   let pSecond = points[1]
    //   let angle2 = +getAngle(pLast, pSecond).toFixed(0)
    //   pointsNew.shift()
    // }
  }
  return pointsNew
}

// get angle helper
function getAngle(p1: [number, number], p2: [number, number]): number {
  return (Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI
}

function preprocessPolygon(polygon: [number, number][]): [number, number][] {
  // const convexHull = hull(polygon, Infinity).slice(0, -1) as [number, number][]
  const filtered = removeInbetweenPoints(polygon)

  return filtered
}

const UP = new Vector3(0, 0, 1)

function xyHash(x: number, y: number) {
  return `${x.toFixed(3)},${y.toFixed(3)}`
}

function removeDuplicatedAndSelfIntersections(polygon: Vector3[], getZ: (x: number, y: number) => Vector3) {
  function removeDuplicates(poly: Vector3[]) {
    const unique = new Map<string, Vector3>()
    for (let point of poly) {
      unique.set(xyHash(point.x, point.y), point)
    }
    return [...unique.values()]
  }

  const inputPolygonWithoutDuplicates = removeDuplicates(polygon)

  const horizontalTo3DMap = new Map<string, Vector3>()
  for (let point of inputPolygonWithoutDuplicates) {
    horizontalTo3DMap.set(xyHash(point.x, point.y), point)
  }

  // use polygonClipping.union of the polygon to remove self intersections
  // this works because this algorithm interprets self crossing sections using the non-zero rule
  // (see https://www.npmjs.com/package/polygon-clipping#user-content-input) and (https://en.wikipedia.org/wiki/Nonzero-rule)
  const union = polygonClipping.union([
    inputPolygonWithoutDuplicates.map((point) => {
      return [point.x, point.y] as [number, number]
    }),
  ])

  const resultIn3D = union[0][0] // we only have one polygon
    .slice(0, -1) // remove last vertex because our subsequent algorithm to filter out overlapping segments assumes that
    .map(([x, y]) => horizontalTo3DMap.get(xyHash(x, y)) || getZ(x, y)) // convert back to 3D

  const outputPolygonWithoutDuplicates = removeDuplicates(resultIn3D)
  return outputPolygonWithoutDuplicates
}

// polygon segments get shortened to this length - increases precision of approximation
const MAX_SEGMENT_LENGTH = 1
// corner segments get subdivided into smaller pieces based on this angle
const ANGULAR_STEP_SIZE = Math.PI / 30
const doublesideMaterial = new MeshBasicMaterial({ side: DoubleSide })

function flatPolygonToMeshedPad(op: FlatPolygonV1, previouslyAppliedPads: MeshedPad[]): MeshedPad {
  const slope = op.applyGrade ? (op.buffer ? op.buffer / 100 : DEFAULT_BUFFER / 100) : MAX_BUFFER / 100

  const polygon = preprocessPolygon(op.coordinates.map(({ x, y }) => [x, y]))
  const polygonWithElevations = shortenSegments(polygon, MAX_SEGMENT_LENGTH).map(
    ([x, y]) => new Vector3(x, y, op.elevation),
  )

  let padding: Vector3[][] = []

  const sideTriangles: [Vector3, Vector3, Vector3][] = []
  let terrainPoint0: Vector3 | undefined, terrainPoint1: Vector3 | undefined, terrainPoint2: Vector3 | undefined
  for (let i = 0; i < polygonWithElevations.length; i++) {
    const v0 = polygonWithElevations[i]
    const v1 = polygonWithElevations[(i + 1) % polygonWithElevations.length]
    const v2 = polygonWithElevations[(i + 2) % polygonWithElevations.length]

    const edge01dir = getRayDirection(v0, v1, slope)
    const edge12dir = getRayDirection(v1, v2, slope)

    const f01 = new Vector3(edge01dir.x, edge01dir.y).normalize()
    const f12 = new Vector3(edge12dir.x, edge12dir.y).normalize()

    const signedAngle = signedAngleTo(f01, f12)

    terrainPoint0 = terrainPoint2 ?? getIntersectionPoint(v0, edge01dir, previouslyAppliedPads)
    terrainPoint1 = getIntersectionPoint(v1, edge01dir, previouslyAppliedPads)
    terrainPoint2 =
      Math.abs(f01.clone().cross(f12).z) < 1e-8
        ? terrainPoint1
        : getIntersectionPoint(v1, edge12dir, previouslyAppliedPads)

    if (!terrainPoint0 || !terrainPoint1 || !terrainPoint2) continue

    /** Edge polygon*/
    const edgePolygon: Vector3[] = []
    let error = false

    edgePolygon.push(terrainPoint1)

    sideTriangles.push([v0, terrainPoint0, terrainPoint1])
    sideTriangles.push([terrainPoint1, v1, v0])

    const numSteps = Math.ceil(Math.abs(signedAngle) / ANGULAR_STEP_SIZE)
    const stepSize = signedAngle / numSteps
    let prev: Vector3 | undefined = terrainPoint1
    for (let i = 1; i < numSteps; i++) {
      const terrainPointX = getIntersectionPoint(
        v1,
        edge01dir.clone().applyAxisAngle(UP, i * stepSize),
        previouslyAppliedPads,
      )
      if (terrainPointX) {
        edgePolygon.push(terrainPointX)
        sideTriangles.push([terrainPointX, v1, prev])
        prev = terrainPointX
      } else {
        error = true
      }
    }
    edgePolygon.push(terrainPoint2)
    sideTriangles.push([terrainPoint2, v1, prev])

    if (error) {
      console.log("there is an error")
      continue
    }
    padding.push(edgePolygon)
  }

  const getZ = (x: number, y: number): Vector3 =>
    getIntersectionPoint(new Vector3(x, y, 0), new Vector3(0, 0, -1), previouslyAppliedPads) || new Vector3(x, y, 0)
  const nonSelfIntersectingPadding = removeDuplicatedAndSelfIntersections(padding.flat(), getZ)

  const coordinates = [
    nonSelfIntersectingPadding.flat().map(({ x, y, z }) => [x, y, z]),
    polygonWithElevations.map((p) => [p.x, p.y, p.z]),
  ] as [[number, number, number][], [number, number, number][]]

  const { mesh, slopes } = buildMeshAndSlopesFromSideTriangles(
    nonSelfIntersectingPadding,
    polygonWithElevations,
    sideTriangles,
  )

  const bbox = [
    [
      Math.min(...coordinates.flatMap((poly) => poly.map(([x]) => x))),
      Math.min(...coordinates.flatMap((poly) => poly.map(([, y]) => y))),
    ],
    [
      Math.max(...coordinates.flatMap((poly) => poly.map(([x]) => x))),
      Math.max(...coordinates.flatMap((poly) => poly.map(([, y]) => y))),
    ],
  ] as [[number, number], [number, number]]

  return {
    coordinates,
    bbox,
    id: op.id,
    elevation: op.elevation,
    mesh,
    slopes,
  }
}

function buildMeshAndSlopesFromSideTriangles(
  paddingCoordinates: Vector3[],
  padCoordinates: Vector3[],
  sideTriangles: [Vector3, Vector3, Vector3][],
) {
  const allCoordinates = [...paddingCoordinates, ...padCoordinates]
  const allCoordinatesMapped = allCoordinates.map(({ x, y, z }) => [x, y, z] as [number, number, number])

  // Extract all "slope edges" from the side triangles, i.e. the edges that go directly from the
  // base to the padding, but not the diagonal edges. By convention, we know that the first two
  // vertices of the side triangle comprise the slope edge we are interested in
  const slopeEdges = sideTriangles.map((tri) => [tri[0], tri[1]])

  // Filter the slope edges to only include the ones that are "present", i.e. both vertices are
  // present in the pad/padding coordinates. Map to indices while at it, and normalize the order so
  // that pad index is first and padding index is second.
  const coordToIndexMap = new Map(allCoordinates.map(({ x, y }, index) => [xyHash(x, y), index]))
  let presentSlopesIndices = slopeEdges
    .map(([paddingVertex, padVertex]) => {
      const paddingIndex = coordToIndexMap.get(xyHash(paddingVertex.x, paddingVertex.y)) ?? -1
      const padIndex = coordToIndexMap.get(xyHash(padVertex.x, padVertex.y)) ?? -1
      if (paddingIndex !== -1 && padIndex !== -1) {
        return paddingIndex < padIndex ? [paddingIndex, padIndex] : [padIndex, paddingIndex]
      }
      return null
    })
    .filter((edge): edge is [number, number] => edge !== null)

  // Create a hash table mapping from padding index to pad index, and vice versa
  const paddingToPadMap = new Map<number, number>()
  const padToPaddingMap = new Map<number, number>()

  for (const [paddingIndex, padIndex] of presentSlopesIndices) {
    paddingToPadMap.set(paddingIndex, padIndex)
    padToPaddingMap.set(padIndex, paddingIndex)
  }

  // Create list of non-present padding indices
  const paddingIndices = [...Array(paddingCoordinates.length).keys()]
  const presentSlopesIndicesSet = new Set(presentSlopesIndices.map(([paddingIndex]) => paddingIndex))
  const nonPresentPaddingIndices = paddingIndices.filter((index) => !presentSlopesIndicesSet.has(index))

  // Construct additional slope edges for the nonpresent indices. For each nonpresent padding index,
  // we decrement index to go back to a valid padding index, find the corresponding valid pad index,
  // and increment to go to the invalid pad index that matches the FIRST invalid padding index.
  // Similarly, we can take the nonpresent padding index, increment it to a valid index and find the
  // LAST invalid padding index. With this range of invalid pad indices, we create new slope edges
  // that point to the invalid padding index.
  for (const nonPresentPaddingIndex of nonPresentPaddingIndices) {
    const prevPaddingIndex = mod(nonPresentPaddingIndex - 1, paddingIndices.length)
    const nextPaddingIndex = mod(nonPresentPaddingIndex + 1, paddingIndices.length)

    const correspondingPadIndexStart = paddingToPadMap.get(prevPaddingIndex)!
    const correspondingPadIndexEnd = paddingToPadMap.get(nextPaddingIndex)!

    const startPadIndex = correspondingPadIndexStart + 1
    const endPadIndex = correspondingPadIndexEnd - 1
    for (let i = startPadIndex; i <= endPadIndex; i++) {
      const paddingIndex = nonPresentPaddingIndex
      const padIndex = i
      if (paddingIndex !== -1 && padIndex !== -1) {
        presentSlopesIndices.push([paddingIndex, padIndex])
      }
    }
  }

  // Post-process all the edges in presentSlopesIndices to make sure they are unique (consider both
  // the forward and backward order of the vertices), and also that no edges have length 0
  const uniqueEdges = new Set<string>()
  presentSlopesIndices = presentSlopesIndices.filter(([a, b]) => {
    if (a === b) return false // Remove edges with length 0
    const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}` // Normalize edge order
    if (uniqueEdges.has(edgeKey)) return false // Remove duplicate edges
    uniqueEdges.add(edgeKey)
    return true
  })

  let triangleVertexIndices
  try {
    triangleVertexIndices = runConstrainedDelaunay(allCoordinatesMapped, presentSlopesIndices)
  } catch (e) {
    console.warn("Error running constrained delaunay triangulation", e)
    triangleVertexIndices = runConstrainedDelaunay(allCoordinatesMapped, [])
  }

  const paddingEdges = ArrayUtils.sliding2([...paddingIndices, paddingIndices[0]])
  const filteredIndices = filterTrianglesOutsideEdges(
    paddingEdges,
    allCoordinatesMapped,
    triangleVertexIndices,
    () => true,
  )
  const triangleVertices = [...filteredIndices].map((i) => allCoordinatesMapped[i])

  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(triangleVertices.flat()), 3))
  const mesh = createFastRaycastMesh(new Mesh(geometry, doublesideMaterial))

  const slopes: MeshedPad["slopes"] = presentSlopesIndices.map(([paddingIndex, padIndex]) => [
    allCoordinatesMapped[paddingIndex],
    allCoordinatesMapped[padIndex],
  ])

  return { mesh, slopes }
}

export function operationsToMeshedPads(terrainOperations: TerrainOperation[], baseGeo: BufferGeometry) {
  const ccwTerrainOperations = terrainOperations.map((terrainOperation) => ({
    ...terrainOperation,
    coordinates: getCCWPolygon(terrainOperation.coordinates),
  }))
  setupBaseTerrainBVH(baseGeo)
  const meshedPads: MeshedPad[] = []
  for (let i = 0; i < ccwTerrainOperations.length; i++) {
    const op = ccwTerrainOperations[i]
    switch (op.type) {
      case "flat-polygon/v1":
        meshedPads.push(flatPolygonToMeshedPad(op, meshedPads))
        break
    }
  }
  return meshedPads
}
