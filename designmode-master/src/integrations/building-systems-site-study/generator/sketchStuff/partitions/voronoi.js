import { v4 as uuidv4 } from "uuid"
import Voronoi from "voronoi"
import { getGraphCutToBuildingLimits } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellGraphIntersection.js"
import {
  affineMultiply,
  createRotateAffine,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/affineHelpers.js"
import { closedPolygonCentroid } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
const voronoi = new Voronoi()

function findPointId(x, y, vertices) {
  return vertices.find((v) => v.x === x && v.y === y).id
}

export function generateVoronoiGraph(structure) {
  const { originPoint, boxWidth, boxHeight, angle, points } = structure
  const bbox = {
    xl: originPoint[0],
    xr: originPoint[0] + boxWidth,
    yt: originPoint[1],
    yb: originPoint[1] + boxHeight,
  }

  const diagram = voronoi.compute(
    points.map(([x, y]) => ({
      x,
      y,
    })),
    bbox,
  )
  voronoi.recycle(diagram)

  const vertices = diagram.vertices.map((v) => ({
    id: uuidv4(),
    x: v.x,
    y: v.y,
  }))

  const edges = diagram.edges.reduce((acc, e) => {
    const edge = {
      id: uuidv4(),
      start: findPointId(e.va.x, e.va.y, vertices),
      end: findPointId(e.vb.x, e.vb.y, vertices),
    }
    return { ...acc, [edge.id]: edge }
  }, {})

  const pivotPoint = [
    structure.originPoint[0] + structure.boxWidth / 2,
    structure.originPoint[1] + structure.boxHeight / 2,
  ]
  const rotateAffine = createRotateAffine(-angle, pivotPoint)

  return {
    vertices: vertices.reduce((acc, v) => {
      const rotated = affineMultiply([v.x, v.y], rotateAffine)
      return {
        ...acc,
        [v.id]: {
          ...v,
          x: rotated[0],
          y: rotated[1],
        },
      }
    }, {}),
    edges,
  }
}
export function generateVoronoiCellGraph({ structure, streetWidth, buildingLimits }) {
  const voronoiGraph = generateVoronoiGraph(structure)
  Object.values(voronoiGraph.edges).forEach((edge) => (edge.width = streetWidth))
  const graphCutToBuildingLimits = getGraphCutToBuildingLimits(voronoiGraph, buildingLimits)
  return {
    ...graphCutToBuildingLimits,
    vertices: Object.values(graphCutToBuildingLimits.vertices)
      .filter(
        (v) =>
          Object.values(graphCutToBuildingLimits.edges).filter((e) => e.start === v.id || e.end === v.id).length > 0,
      )
      .reduce((acc, v) => ({ ...acc, [v.id]: v }), {}),
  }
}

function samePoint(vertex1, vertex2) {
  return vertex1.x === vertex2.x && vertex1.y === vertex2.y
}

function getPolygonFromHalfegdes(edges) {
  let vertexList = []
  if (samePoint(edges[0].va, edges[1].va) || samePoint(edges[0].va, edges[1].vb)) vertexList.push(edges[0].va)
  else vertexList.push(edges[0].vb)

  for (let i = 1; i < edges.length; i++) {
    if (samePoint(vertexList[i - 1], edges[i].va)) vertexList.push(edges[i].vb)
    else vertexList.push(edges[i].va)
  }
  return vertexList.map((v) => [v.x, v.y])
}

export function stabilizeVoronoi(structure, iterations) {
  const { originPoint, boxWidth, boxHeight, points } = structure
  if (points.length < 2) return structure
  const bbox = {
    xl: originPoint[0],
    xr: originPoint[0] + boxWidth,
    yt: originPoint[1],
    yb: originPoint[1] + boxHeight,
  }

  let diagram = voronoi.compute(
    points.map(([x, y]) => ({
      x,
      y,
    })),
    bbox,
  )

  for (let i = 0; i < iterations; i++) {
    const centroids = diagram.cells.map((cell) => {
      const polygon = getPolygonFromHalfegdes(cell.halfedges.map((he) => he.edge))
      return closedPolygonCentroid([...polygon, polygon[0]])
    })

    diagram = voronoi.compute(
      centroids.map((centroid) => ({ x: centroid[0], y: centroid[1] })),
      bbox,
    )
  }
  return {
    ...structure,
    points: diagram.cells.map((cell) => {
      const polygon = getPolygonFromHalfegdes(cell.halfedges.map((he) => he.edge))
      return closedPolygonCentroid([...polygon, polygon[0]])
    }),
  }
}
