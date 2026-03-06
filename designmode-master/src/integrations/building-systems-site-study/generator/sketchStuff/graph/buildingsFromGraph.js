import {
  cleanPolygon,
  getVectorFromPointToPoint,
  movePointAlongVector,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import {
  getSectionsForGraphV2,
  splitGraphInOldAndNewSectionFormat,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/apartments/sections.js"
import {
  getOldCornerSections,
  getOldEdgeSections,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/apartments/oldSections.js"

function shiftSections(sections, normal, shiftLength) {
  const shiftedSections = sections.map(({ startWall, endWall }, i) => {
    const shift = (i - (sections.length - 1) / 2) * shiftLength
    return {
      startWall: startWall.map((p) => movePointAlongVector(p, normal, shift)),
      endWall: endWall.map((p) => movePointAlongVector(p, normal, shift)),
    }
  })
  const bottomWall = []
  const topWall = []
  const connectedSections = shiftedSections.map(({ startWall, endWall }, i) => {
    bottomWall.push(startWall[0])
    bottomWall.push(endWall[0])
    topWall.push(startWall[1])
    topWall.push(endWall[1])

    const newStartWall =
      i > 0
        ? [
            startWall[0],
            shiftLength < 0 ? shiftedSections[i - 1].endWall[1] : shiftedSections[i - 1].endWall[0],
            startWall[1],
          ]
        : startWall
    const newEndWall =
      i < shiftedSections.length - 1
        ? [
            endWall[0],
            shiftLength < 0 ? shiftedSections[i + 1].startWall[0] : shiftedSections[i + 1].startWall[1],
            endWall[1],
          ]
        : endWall
    return {
      startWall: newStartWall,
      endWall: newEndWall,
    }
  })
  return {
    newExteriorPolygon: [...topWall, ...bottomWall.reverse()],
    newSections: connectedSections,
  }
}

function shiftEdgeSections(edgeSections, graph) {
  const freeEdgeIds = Object.values(graph.edges)
    .filter(
      (e) =>
        !Object.values(graph.edges).some(
          (otherEdge) =>
            e.id !== otherEdge.id &&
            (e.start === otherEdge.start ||
              e.start === otherEdge.end ||
              e.end === otherEdge.start ||
              e.end === otherEdge.end),
        ),
    )
    .map((e) => e.id)

  return edgeSections.map((edgeSection) => {
    const { edge, sections, exteriorPolygon } = edgeSection
    if (freeEdgeIds.includes(edge.id) && sections.length > 1) {
      const edgeDirection = getVectorFromPointToPoint(
        [graph.vertices[edge.start].x, graph.vertices[edge.start].y],
        [graph.vertices[edge.end].x, graph.vertices[edge.end].y],
      )
      const normal = [-edgeDirection[1], edgeDirection[0]]
      const shiftLength = (edge.shiftFactor || 0) * edge.width
      const { newExteriorPolygon, newSections } =
        Math.abs(shiftLength) > 1e-1
          ? shiftSections(sections, normal, shiftLength)
          : { newSections: sections, newExteriorPolygon: exteriorPolygon }
      return {
        ...edgeSection,
        exteriorPolygon: newExteriorPolygon,
        sections: newSections,
      }
    } else return edgeSection
  })
}

export function getSectionsForGraph(graph, minBuildingWith) {
  const { newGraph, oldGraph } = splitGraphInOldAndNewSectionFormat(graph)

  const { vertices, edges } = oldGraph
  const oldCornerSections = getOldCornerSections(edges, vertices)
  const oldEgeSections = getOldEdgeSections(vertices, edges, oldCornerSections, minBuildingWith)

  const { edgeSections: edgeSectionsV2, cornerSections: cornerSectionsV2 } = getSectionsForGraphV2(newGraph)

  const unshiftedEdgeSections = oldEgeSections.concat(edgeSectionsV2)
  const cornerSections = oldCornerSections.concat(cornerSectionsV2)
  const edgeSections = shiftEdgeSections(unshiftedEdgeSections, graph)
  return { cornerSections, edgeSections }
}

export function cleanGraph(graph) {
  const { edges, vertices } = graph
  let graphWasInvalid = false
  let newEdges = {}
  let newVertices = {}
  Object.values(edges).forEach((e) => {
    if (vertices[e.start] === undefined || vertices[e.end] === undefined) {
      graphWasInvalid = true
    } else {
      newEdges[e.id] = e
    }
  })
  Object.values(vertices).forEach((v) => {
    if (Object.values(newEdges).find((e) => e.start === v.id || e.end === v.id) !== undefined) newVertices[v.id] = v
  })

  const newGraph = { edges: newEdges, vertices: newVertices }
  return { graph: newGraph, graphWasInvalid }
}

function mapCornerSectionsToBuildingPolygons(cornerSections) {
  return cornerSections.map(({ exteriorPolygon, vertex }) => {
    const cleanedPoly = cleanPolygon(exteriorPolygon)
    return {
      id: vertex.id,
      polygon: cleanedPoly,
    }
  })
}

function mapEdgeSectionsToBuildingPolygons(edgeSections) {
  return edgeSections.map(({ exteriorPolygon, edge }) => {
    const cleanedPoly = cleanPolygon(exteriorPolygon)
    return {
      id: edge.id,
      polygon: cleanedPoly,
    }
  })
}

export function buildingPolygonsFromGraph2(graph) {
  if (!graph.vertices || !graph.edges) {
    return []
  }
  const { cornerSections, edgeSections } = getSectionsForGraph(graph)
  const buildingPolygonsFromCornerSections = mapCornerSectionsToBuildingPolygons(cornerSections)
  const buildingPolygonsFromEdgeSections = mapEdgeSectionsToBuildingPolygons(edgeSections)

  return buildingPolygonsFromEdgeSections.concat(buildingPolygonsFromCornerSections)
}
