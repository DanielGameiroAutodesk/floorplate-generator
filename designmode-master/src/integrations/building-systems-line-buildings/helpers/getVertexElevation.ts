import type { Graph, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"

function getEdgeLength(vertexOne: GraphVertex, vertexTwo: GraphVertex) {
  return ((vertexOne.x - vertexTwo.x) ** 2 + (vertexOne.y - vertexTwo.y) ** 2) ** 0.5
}

function getNextNumberOfFloors(graph: Graph, vertex: GraphVertex, sectionProps: any) {
  const nextEdge = Object.values(graph.edges).find((edge) => edge.start === vertex.id)
  if (!nextEdge) return undefined
  const nextEdgeFirstSectionID = nextEdge.id + "::" + 0
  const nextProps = sectionProps[nextEdgeFirstSectionID]
  if (!nextProps) return undefined
  const nextVertex = graph.vertices[nextEdge.end]
  const nextEdgeLength = getEdgeLength(vertex, nextVertex)
  return { numberOfFloors: nextProps.numberOfFloors, edgeLength: nextEdgeLength }
}

function getPrevNumberOfFloors(graph: Graph, vertex: GraphVertex, sectionProps: any) {
  const prevEdge = Object.values(graph.edges).find((edge) => edge.end === vertex.id)
  if (!prevEdge) return undefined
  const edgeSectionIds = Object.keys(sectionProps).filter((sectionID) => {
    return sectionID.split("::")[0] === prevEdge.id
  })
  const n = edgeSectionIds.length
  const lastSectionId = prevEdge.id + "::" + (n - 1)
  const prevProps = sectionProps[lastSectionId]
  if (!prevProps) return undefined
  const prevVertex = graph.vertices[prevEdge.start]
  const prevEdgeLength = getEdgeLength(vertex, prevVertex)
  return { numberOfFloors: prevProps.numberOfFloors, edgeLength: prevEdgeLength }
}

export function getVertexElevation(parameters: any, vertex: any) {
  const { floorHeight, numberOfFloors, sectionToggle, sectionProps, graph } = parameters
  if (!sectionToggle) {
    return floorHeight * numberOfFloors
  }

  const sectionID = vertex.id + "::" + 0
  const props = sectionProps[sectionID]
  if (props) {
    return floorHeight * props.numberOfFloors
  }

  const nextNumberOfFloors = getNextNumberOfFloors(graph, vertex, sectionProps)
  const prevNumberOfFloors = getPrevNumberOfFloors(graph, vertex, sectionProps)
  if (nextNumberOfFloors && prevNumberOfFloors) {
    const numberOfFloors =
      nextNumberOfFloors.edgeLength < prevNumberOfFloors.edgeLength
        ? nextNumberOfFloors.numberOfFloors
        : prevNumberOfFloors.numberOfFloors
    return floorHeight * numberOfFloors
  }
  if (nextNumberOfFloors) {
    return floorHeight * nextNumberOfFloors.numberOfFloors
  }
  if (prevNumberOfFloors) {
    return floorHeight * prevNumberOfFloors.numberOfFloors
  }

  return floorHeight + numberOfFloors
}
