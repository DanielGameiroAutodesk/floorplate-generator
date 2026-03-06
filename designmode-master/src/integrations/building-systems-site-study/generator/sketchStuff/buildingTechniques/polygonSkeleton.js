//create LAV

import { mod } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import { rayRayIntersection } from "./simplification.js"
import { addBuildingToGraph } from "./exploreLayoutTypes/templateHelpers.js"
import { getNormalizedVectorFromPointToPoint } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2.js"
import {
  pointPointDistance,
  pointToLineSegmentDistance,
  removeLastPointInPolygonIfEqualsFirst,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"

const testPolygon = [
  [0, 0],
  [10, 0],
  [10, 30],
  [5, 35],
  [0, 30],
]

function averageVec(vec1, vec2) {
  return [(vec1[0] + vec2[0]) / 2, (vec1[1] + vec2[1]) / 2]
}

function addVertexBisectors(lav) {
  //init
  Object.values(lav).forEach((vertex) => {
    const prevPoint = lav[vertex.prev].point
    const curPoint = vertex.point
    const nextPoint = lav[vertex.next].point
    const u1 = getNormalizedVectorFromPointToPoint(curPoint, prevPoint)
    const u2 = getNormalizedVectorFromPointToPoint(curPoint, nextPoint)
    const b = averageVec(u1, u2)
    vertex.edge1 = [curPoint, prevPoint]
    vertex.edge2 = [curPoint, nextPoint]
    vertex.bisectRay = b
    lav[vertex.id] = vertex
  })
  return lav
}

function getBisectorIntersections(lav) {
  const bisectorIntersections = []
  const lavIDs = Object.keys(lav)
  console.log("lavIDs", lavIDs)
  for (let i = 0; i < lavIDs.length; i++) {
    const vertex = lav[lavIDs[i]]
    const nextVertex = lav[vertex.next]
    const prevVertex = lav[vertex.prev]
    const intersectionPoint1 = rayRayIntersection(
      vertex.point,
      prevVertex.point,
      vertex.bisectRay,
      prevVertex.bisectRay,
    )
    const distance1 = intersectionPoint1
      ? pointToLineSegmentDistance(intersectionPoint1, vertex.point, prevVertex.point)
      : -1
    const intersectionPoint2 = rayRayIntersection(
      vertex.point,
      nextVertex.point,
      vertex.bisectRay,
      nextVertex.bisectRay,
    )
    const distance2 = intersectionPoint2
      ? pointToLineSegmentDistance(intersectionPoint2, vertex.point, nextVertex.point)
      : -1
    if (!intersectionPoint1 && !intersectionPoint2) {
      continue
    } else if (!intersectionPoint1 || distance2 < distance1) {
      bisectorIntersections.push({
        point: intersectionPoint2,
        distance: distance2,
        parent1: vertex.id,
        parent2: nextVertex.id,
      })
    } else
      bisectorIntersections.push({
        point: intersectionPoint1,
        distance: distance1,
        parent1: prevVertex.id,
        parent2: vertex.id,
      })
  }
  return bisectorIntersections
}

export function polygonSkeleton(polygon = testPolygon) {
  const openPolygon = removeLastPointInPolygonIfEqualsFirst(polygon)
  let lav = []
  const n = openPolygon.length

  for (let i = 0; i < openPolygon.length; i++) {
    const vertex = {
      id: i.toString(),
      prev: mod(i - 1, n).toString(),
      next: mod(i + 1, n).toString(),
      point: openPolygon[i],
      active: true,
    }
    lav[vertex.id] = vertex
  }

  //calculate vertex angle bisectors
  lav = addVertexBisectors(lav)

  //create priority queue
  const bisectorIntersections = getBisectorIntersections(lav)
  bisectorIntersections.sort((a, b) => a.distance - b.distance)

  //
  const totalArcs = []
  let totalNoVertices = openPolygon.length
  let iterations = 0
  while (bisectorIntersections.length && iterations < 50) {
    iterations++
    const intersection = bisectorIntersections.splice(0, 1)[0]
    if (!lav[intersection.parent1].active && !lav[intersection.parent2].active) {
      continue
    }
    if (lav[intersection.parent1].prev === lav[intersection.parent2].next) {
      const commonNeighbour = intersection.parent1
      const arcs = [
        [lav[intersection.parent1].point, intersection.point],
        [lav[intersection.parent2].point, intersection.point],
        [lav[commonNeighbour].point, intersection.point],
      ]
      totalArcs.push(...arcs)
      // lav[intersection.parent1].active = false;
      // lav[intersection.parent2].active = false;
      // lav[commonNeighbour].active = false;
      continue
    }

    const arcs = [
      [lav[intersection.parent1].point, intersection.point],
      [lav[intersection.parent2].point, intersection.point],
    ]
    totalArcs.push(...arcs)
    lav[intersection.parent1].active = false
    lav[intersection.parent2].active = false

    //TODO: verify valid
    const lavPoints = Object.keys(lav).map((id) => lav[id].point)
    if (lavPoints.some((p) => pointPointDistance(p, intersection.point) < 1e-6)) continue

    //add new vertex to LAV
    const newVertex = {
      id: totalNoVertices.toString(),
      point: intersection.point,
      prev: lav[intersection.parent1].prev,
      next: lav[intersection.parent2].next,
      active: true,
    }
    newVertex.edge1 = lav[intersection.parent1].edge1
    newVertex.edge2 = lav[intersection.parent2].edge2
    newVertex.bisectRay = averageVec(
      getNormalizedVectorFromPointToPoint(...newVertex.edge1),
      getNormalizedVectorFromPointToPoint(...newVertex.edge2),
    )
    lav[newVertex.id] = newVertex

    totalNoVertices++

    // add to priority queue
    const nextVertex = lav[newVertex.next]
    const prevVertex = lav[newVertex.prev]
    const intersectionPoint1 = rayRayIntersection(
      newVertex.point,
      prevVertex.point,
      newVertex.bisectRay,
      prevVertex.bisectRay,
    )
    const distance1 = intersectionPoint1 ? pointToLineSegmentDistance(intersectionPoint1, ...newVertex.edge1) : -1
    const intersectionPoint2 = rayRayIntersection(
      newVertex.point,
      nextVertex.point,
      newVertex.bisectRay,
      nextVertex.bisectRay,
    )
    const distance2 = intersectionPoint2 ? pointToLineSegmentDistance(intersectionPoint2, ...newVertex.edge2) : -1
    if (!intersectionPoint1 && !intersectionPoint2) {
      continue
    } else if (!intersectionPoint1) {
      bisectorIntersections.push({
        point: intersectionPoint2,
        distance: distance2,
        parent1: newVertex.id,
        parent2: nextVertex.id,
      })
    } else if (!intersectionPoint2) {
      bisectorIntersections.push({
        point: intersectionPoint1,
        distance: distance1,
        parent1: prevVertex.id,
        parent2: newVertex.id,
      })
    } else if (distance2 < distance1) {
      bisectorIntersections.push({
        point: intersectionPoint2,
        distance: distance2,
        parent1: newVertex.id,
        parent2: nextVertex.id,
      })
    } else {
      bisectorIntersections.push({
        point: intersectionPoint1,
        distance: distance1,
        parent1: prevVertex.id,
        parent2: newVertex.id,
      })
    }

    bisectorIntersections.sort((a, b) => a.distance - b.distance)
  }
  console.log("totalArcs", totalArcs)

  let graph = { vertices: {}, edges: {} }

  totalArcs.forEach((building) => {
    graph = addBuildingToGraph(graph, building, { stories: 1, width: 5 })
  })

  return graph
}
