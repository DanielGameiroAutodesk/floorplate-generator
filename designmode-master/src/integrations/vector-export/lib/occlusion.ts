import { Box3, Line3, OrthographicCamera, type PerspectiveCamera, Plane, Triangle, Vector3 } from "three"
import { type MeshBVH } from "three-mesh-bvh"
import { INTERSECTED, NOT_INTERSECTED } from "three-mesh-bvh"
import { triangleQuadrilateralIntersection } from "./intersection"

function projectPointToNDC(vector3: Vector3, camera: PerspectiveCamera | OrthographicCamera, flattenZ = false) {
  const projected = vector3.clone().project(camera)
  if (flattenZ) {
    projected.z = 0
  }
  return projected
}

function projectLineToNDC(line: Line3, camera: PerspectiveCamera | OrthographicCamera, flattenZ = false) {
  return new Line3(projectPointToNDC(line.start, camera, flattenZ), projectPointToNDC(line.end, camera, flattenZ))
}

const mergeOccludedIntervals = (occludedIntervals: [number, number][]) => {
  const sortedOccludedIntervals = occludedIntervals.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0]
    return a[1] - b[1]
  })
  const mergedOccludedIntervals: [number, number][] = []
  for (const interval of sortedOccludedIntervals) {
    if (mergedOccludedIntervals.length === 0) {
      mergedOccludedIntervals.push(interval)
      continue
    }
    const lastInterval = mergedOccludedIntervals[mergedOccludedIntervals.length - 1]
    if (interval[0] <= lastInterval[1]) {
      mergedOccludedIntervals[mergedOccludedIntervals.length - 1][1] = Math.max(lastInterval[1], interval[1])
    } else {
      mergedOccludedIntervals.push(interval)
    }
  }
  return mergedOccludedIntervals
}

const getVisibleIntervals = (occludedIntervals: [number, number][]) => {
  const visibleIntervals: [number, number][] = []
  let start = 0
  for (const interval of occludedIntervals) {
    if (interval[0] > start) {
      visibleIntervals.push([start, interval[0]])
    }
    start = interval[1]
  }
  if (start < 1) {
    visibleIntervals.push([start, 1])
  }
  return visibleIntervals
}

const trimEdge = (edge: Line3, visibleInterval: [number, number]) => {
  const [startT, endT] = visibleInterval
  const vector = edge.end.clone().sub(edge.start)
  const start = edge.start.clone().add(vector.clone().multiplyScalar(startT))
  const end = edge.start.clone().add(vector.clone().multiplyScalar(endT))
  return new Line3(start, end)
}

// Function that finds the interval of the edge that is blocked _on screen_ by the intersection line
// This is done by finding how the intersection line overlaps with the edge in NDC space with _flattened Z coordinate_
// That overlap is then evaluated along the edge in _unflattened_ NDC coordinates to find the start/end points of the overlap
// Those points are transformed back into world coordinates to find the occluded interval on the edge in world coordinates
// This is necessary because the perspective projection distorts the length of the edge and hence the interval changes
const findOverlapIntervalInWorldCoords = (
  edge: Line3,
  projectedEdge: Line3,
  intersection: Line3,
  camera: PerspectiveCamera | OrthographicCamera,
): [number, number] => {
  const flatProjectedIntersection = projectLineToNDC(intersection, camera, true)
  const flatProjectedEdge = new Line3(
    new Vector3(projectedEdge.start.x, projectedEdge.start.y, 0),
    new Vector3(projectedEdge.end.x, projectedEdge.end.y, 0),
  )
  const t0_flatNDC = flatProjectedEdge.closestPointToPointParameter(flatProjectedIntersection.start, true)
  const t1_flatNDC = flatProjectedEdge.closestPointToPointParameter(flatProjectedIntersection.end, true)

  const p0 = projectedEdge.at(t0_flatNDC, new Vector3()).unproject(camera)
  const p1 = projectedEdge.at(t1_flatNDC, new Vector3()).unproject(camera)

  const t0 = edge.closestPointToPointParameter(p0, true)
  const t1 = edge.closestPointToPointParameter(p1, true)
  if (t0 > t1) {
    return [t1, t0]
  }
  return [t0, t1]
}

export function lineIntersectsBox3D(lineStart: Vector3, lineEnd: Vector3, box: Box3) {
  const x0 = lineStart.x,
    y0 = lineStart.y,
    z0 = lineStart.z
  const x1 = lineEnd.x,
    y1 = lineEnd.y,
    z1 = lineEnd.z

  // Delta values
  const dx = x1 - x0
  const dy = y1 - y0
  const dz = z1 - z0

  let t0 = 0 // start parameter (0 means p0)
  let t1 = 1 // end parameter (1 means p1)

  const p = [-dx, dx, -dy, dy, -dz, dz] // Clipping against left, right, bottom, top
  const q = [x0 - box.min.x, box.max.x - x0, y0 - box.min.y, box.max.y - y0, z0 - box.min.z, box.max.z - z0] // Distance to each boundary

  for (let i = 0; i < 6; i++) {
    if (p[i] === 0) {
      // Line is parallel to one of the box boundaries
      if (q[i] < 0) return null // Parallel and outside the box
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        t0 = Math.max(t0, t) // Moving the lower bound up
      } else {
        t1 = Math.min(t1, t) // Moving the upper bound down
      }
      if (t0 > t1) return null // The line doesn't intersect the box
    }
  }
  return { startT: t0, endT: t1 }
}

function removeLinesBeforeFrustum(line: Line3, camera: OrthographicCamera | PerspectiveCamera): Line3 | null {
  const cameraDirection = camera.getWorldDirection(new Vector3())
  const nearPlanePoint = camera.position.clone().add(cameraDirection.clone().multiplyScalar(camera.near))
  const nearPlane = new Plane().setFromNormalAndCoplanarPoint(cameraDirection, nearPlanePoint)

  const startToPlaneDistance = nearPlane.distanceToPoint(line.start)
  const endToPlaneDistance = nearPlane.distanceToPoint(line.end)
  if (startToPlaneDistance < 0 && endToPlaneDistance < 0) return null
  const intersection = nearPlane.intersectLine(line, new Vector3())
  if (intersection) {
    return startToPlaneDistance < 0 ? new Line3(intersection, line.end) : new Line3(line.start, intersection)
  }
  return line
}

function trimEdgeWithFrustum(line: Line3, camera: OrthographicCamera | PerspectiveCamera): Line3 | null {
  // First we need to remove all lines that are behind the camera since these will be transformed in wonky ways
  // and this will invalidate the assumption that if the projected line intersects the (-1,-1,-1)-to-(1,1,1) box
  // it will actually intersect the frustum.
  // We achieve this by removing the part of the line that is before (i.e. on the camera side of) the near plane of the frustum.
  const lineInFrontOfCamera = removeLinesBeforeFrustum(line, camera)
  if (!lineInFrontOfCamera) return null

  // When we know that the line is in front of the camera, we can project it to NDC and check if it intersects the viewing volume box
  const projectedLine = projectLineToNDC(lineInFrontOfCamera, camera)
  const intervalInFrustum = lineIntersectsBox3D(
    projectedLine.start,
    projectedLine.end,
    new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)),
  )
  if (!intervalInFrustum) return null

  // Note that we have to trim the line to this interval in the NDC space and then transform it back to world space
  // If we try to trim directly in world space, the interval will be slightly off due to the perspective projection
  const { startT, endT } = intervalInFrustum
  const trimmedStart = new Vector3(
    (1 - startT) * projectedLine.start.x + startT * projectedLine.end.x,
    (1 - startT) * projectedLine.start.y + startT * projectedLine.end.y,
    (1 - startT) * projectedLine.start.z + startT * projectedLine.end.z,
  ).unproject(camera)
  const trimmedEnd = new Vector3(
    (1 - endT) * projectedLine.start.x + endT * projectedLine.end.x,
    (1 - endT) * projectedLine.start.y + endT * projectedLine.end.y,
    (1 - endT) * projectedLine.start.z + endT * projectedLine.end.z,
  ).unproject(camera)

  return new Line3(trimmedStart, trimmedEnd)
}

// Takes in a single 3D line and occludes it according to the camera and a BVH of obstacle geometry
// Returns the resulting lines after split into visible and occluded segments
function calculateOcclusionOfEdge(
  edge: Line3,
  camera: OrthographicCamera | PerspectiveCamera,
  bvh: MeshBVH,
): { visible: Line3[]; occluded: Line3[] } {
  const visible: Line3[] = []
  const occluded: Line3[] = []

  let quadPointStartSide = new Vector3()
  let quadPointEndSide = new Vector3()
  const camDirection = camera.getWorldDirection(new Vector3())
  if (camera instanceof OrthographicCamera) {
    // Construct translation vector needed to project points onto near face of frustum
    const startToFrustum = new Vector3().copy(camDirection).multiplyScalar(camera.near - camDirection.dot(edge.start))
    const endToFrustum = new Vector3().copy(camDirection).multiplyScalar(camera.near - camDirection.dot(edge.end))
    quadPointStartSide.addVectors(edge.start, startToFrustum)
    quadPointEndSide.addVectors(edge.end, endToFrustum)
  } else {
    const nearPlane = new Plane().setFromNormalAndCoplanarPoint(
      camDirection,
      camera.position.clone().add(camDirection.clone().multiplyScalar(camera.near)),
    )
    const startIntersection = nearPlane.intersectLine(new Line3(edge.start, camera.position), new Vector3())
    const endIntersection = nearPlane.intersectLine(new Line3(edge.end, camera.position), new Vector3())
    if (startIntersection && endIntersection) {
      quadPointStartSide.copy(startIntersection)
      quadPointEndSide.copy(endIntersection)
    } else {
      console.warn(
        "Perspective camera triangle does not intersect near plane - this shouldn't happen if edge is within frustum",
      )
    }
  }

  const quadTriangle1 = new Triangle(edge.start, edge.end, quadPointStartSide)
  const quadTriangle2 = new Triangle(edge.end, quadPointStartSide, quadPointEndSide)
  let occludedIntervals: [number, number][] = []
  const projectedEdge = projectLineToNDC(edge, camera)
  bvh.shapecast({
    intersectsBounds: (box) => {
      const trianglesIntersectBox = quadTriangle1.intersectsBox(box) || quadTriangle2.intersectsBox(box)
      return trianglesIntersectBox ? INTERSECTED : NOT_INTERSECTED
    },
    intersectsTriangle: (tri) => {
      if (occludedIntervals.length === 1 && occludedIntervals[0][0] === 0 && occludedIntervals[0][1] === 1) return

      const intersection = triangleQuadrilateralIntersection(tri, quadTriangle1, quadTriangle2)
      if (intersection instanceof Line3) {
        const interval = findOverlapIntervalInWorldCoords(edge, projectedEdge, intersection, camera)
        occludedIntervals.push(interval)
        occludedIntervals = mergeOccludedIntervals(occludedIntervals)
      }
    },
  })
  if (occludedIntervals.length === 0) {
    visible.push(edge)
  } else {
    const minimumProjectedEdgeLength = 1e-4
    occludedIntervals.forEach((interval) => {
      const trimmedEdge = trimEdge(edge, interval)
      const projected = projectLineToNDC(trimmedEdge, camera)
      projected.distance() > minimumProjectedEdgeLength && occluded.push(trimmedEdge)
    })
    const visibleIntervals: [number, number][] = getVisibleIntervals(occludedIntervals)
    visibleIntervals.forEach((interval) => {
      const trimmedEdge = trimEdge(edge, interval)
      const projected = projectLineToNDC(trimmedEdge, camera)
      projected.distance() > minimumProjectedEdgeLength && visible.push(trimmedEdge)
    })
  }
  return { visible, occluded }
}

// Takes a list of 3D lines and occludes them according to the camera and BVHs of objects and terrain
// Returns the resulting lines transformed into the NDC defined by the camera and sorted by visibility into:
// 1) visible (not considering terrain) and above terrain
// 2) visible (not considering terrain), but under terrain
// 3) occluded by objects (other than terrain)
export function occludeByObjectsAndTerrain(
  allLines: Line3[],
  camera: OrthographicCamera | PerspectiveCamera,
  objectsBVH: MeshBVH,
  terrainBVH: MeshBVH | null,
) {
  const linesInsideFrustum: Line3[] = allLines
    .map((edge) => trimEdgeWithFrustum(edge, camera))
    .filter((_) => _ instanceof Line3)
  const visibleEdges: Line3[] = []
  const occludedEdges: Line3[] = []
  for (const edge of linesInsideFrustum) {
    const { visible, occluded } = calculateOcclusionOfEdge(edge, camera, objectsBVH)
    visibleEdges.push(...visible)
    occludedEdges.push(...occluded)
  }
  let visibleAbove: Line3[] = [...visibleEdges]
  const visibleBelow: Line3[] = []
  if (terrainBVH) {
    visibleAbove = []
    for (const edge of visibleEdges) {
      const { visible: above, occluded: below } = calculateOcclusionOfEdge(edge, camera, terrainBVH)
      visibleAbove.push(...above)
      visibleBelow.push(...below)
    }
  }

  return {
    visible: visibleAbove.map((edge) => projectLineToNDC(edge, camera)),
    hidden: occludedEdges.map((edge) => projectLineToNDC(edge, camera)),
    visibleBelow: visibleBelow.map((edge) => projectLineToNDC(edge, camera)),
  }
}
