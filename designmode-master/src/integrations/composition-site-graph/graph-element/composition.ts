import type { Graph, Id } from "src/integrations/composition-site-graph/graph/types"
import type { ChildKey, CompositionElement, Dimensions, GraphToChildrenConnection, With } from "./types"
import { ELEMENT_PROPERTIES_COMPOSING_ELEMENT } from "./types"
import { createUrn, newChildKey, newId, newRevision, replaceRevision } from "src/lib/element/urn"
import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import { getParcelsFromGraph } from "src/integrations/composition-site-graph-parcel/simpleParcel"
import type { ParcelCompositionElement } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { toElements } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { ParcelTemplate } from "src/integrations/composition-site-graph-parcel/templates/types"
import graph from "src/integrations/composition-site-graph/graph/graph"
import type { SnappedSegment } from "src/integrations/composition-site-graph/tools/snapping"
import { isDefined } from "src/lib/array"
import graphInternal from "src/integrations/composition-site-graph/graph/graph-internal"
import { createRoadElements } from "./toElements"
import { mapOfFormaElements } from "src/lib/element/utils"
import { mergeMaps } from "src/lib/map"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { mergeRepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { PROJECT_ID } from "src/core/project/project"
import { getClosestPointOnLine } from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"

export const COMPOSITION_GRAPH_GENERATOR_ID = "composition-graph-v0"

const replaceCompositionRevision = (urn: Urn): Urn => {
  const newCompositionRevision = Date.now().toString() + "-" + Math.random().toString(16).slice(8)
  return replaceRevision(urn, newCompositionRevision)
}

export type CompositionAction = {
  rootUrn: Urn
  elements: Map<Urn, FormaElement>
  representations: RepresentationsByUrn
}

function create(
  graph: Graph,
  template: ParcelTemplate,
  elevationAt: (x: number, y: number) => number,
): CompositionAction {
  const { graphToChildrenConnection, elements, representations, children } = generateChildren(
    graph,
    template,
    elevationAt,
  )

  const rootUrn = createUrn("parametric", PROJECT_ID, newId(), newRevision())

  const rootElement: CompositionElement = {
    urn: rootUrn,
    properties: {
      generator: { generatorId: COMPOSITION_GRAPH_GENERATOR_ID },
      definingRepresentation: { graph, graphToChildrenConnection },
      [ELEMENT_PROPERTIES_COMPOSING_ELEMENT]: true,
      capabilities: {
        updateTransform: {
          script: {
            url: "/api/parametric/capabilities",
            function: "move",
          },
        },
      },
      category: "composition",
    },
    children: children,
  }

  return {
    rootUrn,
    elements: mergeMaps(mapOfFormaElements(rootElement), elements),
    representations,
  }
}

const getGraphToChildrenConnection = (element: CompositionElement): GraphToChildrenConnection => {
  return element.properties.definingRepresentation.graphToChildrenConnection
}

function updateCompositionWithGraphToChildrenConnection(
  compositionElement: CompositionElement,
  updatedGraph: Graph,
  updatedGraphToChildrenConnection: GraphToChildrenConnection,
) {
  return {
    urn: replaceCompositionRevision(compositionElement.urn),
    properties: {
      ...compositionElement.properties,
      definingRepresentation: {
        graph: updatedGraph,
        graphToChildrenConnection: updatedGraphToChildrenConnection,
      },
    },
  }
}

function updateGraph(
  element: CompositionElement,
  newGraph: Graph,
  fallbackTemplate: ParcelTemplate,
  elevationAt: (x: number, y: number) => number,
  getElement: (urn: Urn) => FormaElement,
): {
  rootUrn: Urn
  elements: Map<Urn, FormaElement>
  representations: RepresentationsByUrn
} {
  const parcelElements = updateRowhouseElementsForNewGraph(element, newGraph, fallbackTemplate, getElement, elevationAt)
  const roads = createRoadElements(newGraph)

  const children: Child[] = [...parcelElements.children, ...roads.children]

  const newCompositionElement: CompositionElement = {
    ...element,
    urn: replaceCompositionRevision(element.urn),
    properties: {
      ...element.properties,
      definingRepresentation: {
        ...element.properties.definingRepresentation,
        graph: newGraph,
        graphToChildrenConnection: {
          ...element.properties.definingRepresentation.graphToChildrenConnection,
          coEdges: parcelElements.coEdgeConnection,
        },
      },
    },
    children,
  }

  return {
    rootUrn: newCompositionElement.urn,
    elements: mergeMaps(mapOfFormaElements(newCompositionElement), parcelElements.elements, roads.elements),
    representations: mergeRepresentationsByUrn(parcelElements.representations, roads.representations),
  }
}

function setTemplatesForPaths(
  element: CompositionElement,
  childKeys: ChildKey[],
  template: ParcelTemplate,
  elevationAt: (x: number, y: number) => number,
  getElement: (urn: Urn) => FormaElement,
): {
  rootUrn: Urn
  elements: Map<Urn, FormaElement>
  representations: RepresentationsByUrn
} {
  const rowhouses = updateRowhouseElements(element, childKeys, template, getElement, elevationAt)
  const roads = createRoadElements(element.properties.definingRepresentation.graph)

  const children: Child[] = [...rowhouses.children, ...roads.children]

  const newCompositionElement: CompositionElement = {
    ...element,
    urn: replaceCompositionRevision(element.urn),
    properties: {
      ...element.properties,
      definingRepresentation: {
        ...element.properties.definingRepresentation,
        graphToChildrenConnection: {
          ...element.properties.definingRepresentation.graphToChildrenConnection,
          coEdges: rowhouses.coEdgeConnection,
        },
      },
    },
    children,
  }

  return {
    rootUrn: newCompositionElement.urn,
    elements: mergeMaps(roads.elements, rowhouses.elements, mapOfFormaElements(newCompositionElement)),
    representations: mergeRepresentationsByUrn(rowhouses.representations, roads.representations),
  }
}

function createRowHouseElements(
  graph: Graph,
  template: ParcelTemplate,
  elevationAt: (x: number, y: number) => number,
): {
  elements: Map<Urn, FormaElement>
  representations: RepresentationsByUrn
  children: Child[]
  newCoEdgeMap: GraphToChildrenConnection["coEdges"]
} {
  function getChildWithDimensions(): With<Child, Dimensions> {
    const params = template.element.properties.generator.parameters
    const child: Child = { key: newChildKey(), urn: template.element.urn }
    return { width: params.width, depth: params.depth, data: child }
  }

  const coEdgeMap = getParcelsFromGraph(graph, elevationAt, getChildWithDimensions)

  const newCoEdgeMap: Record<Id, Child[]> = Object.fromEntries(
    Object.entries(coEdgeMap).map(([coEdgeId, childrenWithTransform]): [Id, Child[]] => [
      coEdgeId,
      childrenWithTransform.map(({ transform, data }): Child => ({ ...data, transform: transform.toArray() })),
    ]),
  )

  const children: Child[] = Object.values(newCoEdgeMap).flat()

  const { elements } = toElements(template)
  return {
    elements,
    representations: template.representations,
    children,
    newCoEdgeMap,
  }
}

function updateRowhouseElementsForNewGraph(
  element: CompositionElement,
  newGraph: Graph,
  template: ParcelTemplate,
  getElement: (urn: Urn) => FormaElement,
  elevationAt: (x: number, y: number) => number,
): {
  elements: Map<Urn, FormaElement>
  representations: RepresentationsByUrn
  children: Child[]
  coEdgeConnection: GraphToChildrenConnection["coEdges"]
} {
  function getChildWithDimensions(coEdgeId: Id, index: number): With<Child, Dimensions> {
    const forCoEdges = element.properties.definingRepresentation.graphToChildrenConnection.coEdges[coEdgeId]

    /* When editing a graph, you can get coEdges without children, such as when crossing yourself (or splitting an edge?)
     * In that case, we just return the template element
     */
    if (!forCoEdges || forCoEdges.length === 0) {
      return {
        width: template.element.properties.generator.parameters.width,
        depth: template.element.properties.generator.parameters.depth,
        data: { key: newChildKey(), urn: template.element.urn },
      }
    }

    const child: Child =
      index >= forCoEdges.length
        ? { key: newChildKey(), urn: forCoEdges[forCoEdges.length - 1].urn }
        : forCoEdges[index]

    const childElement = getElement(child.urn)
    const params = (childElement as ParcelCompositionElement).properties.generator.parameters
    return { width: params.width, depth: params.depth, data: { ...child, urn: childElement.urn } }
  }

  const coEdgeToChildInfo = getParcelsFromGraph(newGraph, elevationAt, getChildWithDimensions)

  const coEdgeConnection: GraphToChildrenConnection["coEdges"] = Object.fromEntries(
    Object.entries(coEdgeToChildInfo).map(([coEdgeId, childrenWithTransform]): [Id, Child[]] => [
      coEdgeId,
      childrenWithTransform.map(({ transform, data }): Child => ({ ...data, transform: transform.toArray() })),
    ]),
  )

  const children = Object.values(coEdgeConnection).flat()

  const { elements } = toElements(template)

  return { coEdgeConnection, children, representations: template.representations, elements }
}

function updateToReSetElevation(
  element: CompositionElement,
  elevationAt: (x: number, y: number) => number,
  getElement: (urn: Urn) => FormaElement,
): {
  rootUrn: Urn
  elements: Map<Urn, FormaElement>
  representations: RepresentationsByUrn
} {
  const roads = createRoadElements(element.properties.definingRepresentation.graph)

  const children: Child[] = [
    ...updateParcelElementsToReSetElevation(element, getElement, elevationAt),
    ...roads.children,
  ]

  const newCompositionElement: CompositionElement = {
    ...element,
    urn: replaceCompositionRevision(element.urn),
    children,
  }

  return {
    rootUrn: newCompositionElement.urn,
    elements: mergeMaps(roads.elements, mapOfFormaElements(newCompositionElement)),
    representations: roads.representations,
  }
}

function updateParcelElementsToReSetElevation(
  element: CompositionElement,
  getElement: (urn: Urn) => FormaElement,
  elevationAt: (x: number, y: number) => number,
): Child[] {
  function getChildWithDimensions(coEdgeId: Id, index: number): With<Child, Dimensions> | undefined {
    const forCoEdges = element.properties.definingRepresentation.graphToChildrenConnection.coEdges[coEdgeId]
    if (forCoEdges.length === 0) return
    const child: Child =
      index >= forCoEdges.length
        ? { key: newChildKey(), urn: forCoEdges[forCoEdges.length - 1].urn }
        : forCoEdges[index]

    const childElement = getElement(child.urn)
    const params = (childElement as ParcelCompositionElement).properties.generator.parameters
    return { width: params.width, depth: params.depth, data: { ...child, urn: childElement.urn } }
  }

  const coEdgeToChildInfo = getParcelsFromGraph(
    element.properties.definingRepresentation.graph,
    elevationAt,
    getChildWithDimensions,
  )

  const coEdgeConnection: GraphToChildrenConnection["coEdges"] = Object.fromEntries(
    Object.entries(coEdgeToChildInfo).map(([coEdgeId, childrenWithTransform]): [Id, Child[]] => [
      coEdgeId,
      childrenWithTransform.map(({ transform, data }): Child => ({ ...data, transform: transform.toArray() })),
    ]),
  )

  return Object.values(coEdgeConnection).flat()
}

function updateRowhouseElements(
  element: CompositionElement,
  childKeys: ChildKey[],
  template: ParcelTemplate,
  getElement: (urn: Urn) => FormaElement,
  elevationAt: (x: number, y: number) => number,
): {
  elements: Map<Urn, FormaElement>
  representations: RepresentationsByUrn
  children: Child[]
  coEdgeConnection: GraphToChildrenConnection["coEdges"]
} {
  function getChildWithDimensions(coEdgeId: Id, index: number): With<Child, Dimensions> {
    const forCoEdges = element.properties.definingRepresentation.graphToChildrenConnection.coEdges[coEdgeId]
    const prevChild = index < forCoEdges.length ? forCoEdges[index] : undefined
    const prevLastChild = forCoEdges[forCoEdges.length - 1]
    const lastIsChanged = prevLastChild?.key && childKeys.includes(prevLastChild.key)

    let newChild: Child
    let childElement: ParcelCompositionElement

    if (!prevChild) {
      if (lastIsChanged) {
        newChild = { key: newChildKey(), urn: template.element.urn }
        childElement = template.element
      } else {
        if (!prevLastChild) {
          newChild = { key: newChildKey(), urn: template.element.urn }
          childElement = template.element
        } else {
          newChild = { key: newChildKey(), urn: prevLastChild.urn }
          childElement = getElement(prevLastChild.urn) as ParcelCompositionElement
        }
      }
    } else {
      if (childKeys.includes(prevChild.key)) {
        newChild = { ...prevChild, urn: template.element.urn }
        childElement = template.element
      } else {
        newChild = prevChild
        childElement = getElement(prevChild.urn) as ParcelCompositionElement
      }
    }

    const params = childElement.properties.generator.parameters
    return { width: params.width, depth: params.depth, data: newChild }
  }

  const coEdgeToChildInfo = getParcelsFromGraph(
    element.properties.definingRepresentation.graph,
    elevationAt,
    getChildWithDimensions,
  )

  const coEdgeConnection: GraphToChildrenConnection["coEdges"] = Object.fromEntries(
    Object.entries(coEdgeToChildInfo).map(([coEdgeId, childrenWithTransform]): [Id, Child[]] => [
      coEdgeId,
      childrenWithTransform.map(({ transform, data }): Child => ({ ...data, transform: transform.toArray() })),
    ]),
  )

  const children = Object.values(coEdgeConnection).flat()

  const { elements } = toElements(template)
  return { coEdgeConnection, children, representations: template.representations, elements }
}

function generateChildren(
  graph: Graph,
  template: ParcelTemplate,
  elevationAt: (x: number, y: number) => number,
): {
  graphToChildrenConnection: GraphToChildrenConnection
  elements: Map<Urn, FormaElement>
  representations: RepresentationsByUrn
  children: Child[]
} {
  const roads = createRoadElements(graph)
  const rowHouses = createRowHouseElements(graph, template, elevationAt)
  return {
    graphToChildrenConnection: {
      edges: {
        ...roads.edgeIdMapping,
      },
      coEdges: { ...rowHouses.newCoEdgeMap },
    },
    elements: mergeMaps(roads.elements, rowHouses.elements),
    representations: mergeRepresentationsByUrn(roads.representations, rowHouses.representations),
    children: [...roads.children, ...rowHouses.children],
  }
}

function upgradeGraphToChildrenConnection(compositionElement: CompositionElement, newToOldIdMap: Record<Id, Id>) {
  const graphToChildrenConnection = getGraphToChildrenConnection(compositionElement)
  const updatedGraphToChildrenConnection: GraphToChildrenConnection = {
    edges: { ...graphToChildrenConnection.edges },
    coEdges: { ...graphToChildrenConnection.coEdges },
  }
  Object.entries(newToOldIdMap).forEach(([newId, oldId]) => {
    const children = graphToChildrenConnection.coEdges[oldId]
    updatedGraphToChildrenConnection.coEdges[newId] = children?.map((child) => ({ ...child, key: newChildKey() }))
    delete updatedGraphToChildrenConnection.coEdges[oldId]
  })
  return updatedGraphToChildrenConnection
}

const moveVertex = (compositionElement: CompositionElement, state: Graph, vertexId: string, x: number, y: number) => {
  const [updatedGraph, newToOldCoEdgeMap] = graph.moveVertex(state, vertexId, x, y)
  // Use the supplied map of new to old coEdgeIds to update graphToChildrenConnection
  const updatedGraphToChildrenConnection = upgradeGraphToChildrenConnection(compositionElement, newToOldCoEdgeMap)
  // Update the composition element with the new graphToChildrenConnection
  return {
    graph: updatedGraph,
    element: updateCompositionWithGraphToChildrenConnection(
      compositionElement,
      updatedGraph,
      updatedGraphToChildrenConnection,
    ),
  }
}

const splitEdge = (compositionElement: CompositionElement, position: SnappedSegment, currentGraph: Graph) => {
  const closestPointOnLine = getClosestPointOnLine(
    position.segment.position[0],
    position.segment.position[1],
    position.point,
  )
  const internalEdgeId = position.segment.internalEdgeId
  const newPoint = { x: closestPointOnLine.x, y: closestPointOnLine.y }

  //graph operation
  const [updatedGraph, , newToOldIdMap] = graph.splitEdge(currentGraph, internalEdgeId, newPoint)

  //Update graphToChildrenConnection
  const updatedGraphToChildrenConnection = upgradeGraphToChildrenConnection(compositionElement, newToOldIdMap)

  return {
    graph: updatedGraph,
    element: updateCompositionWithGraphToChildrenConnection(
      compositionElement,
      updatedGraph,
      updatedGraphToChildrenConnection,
    ),
  }
}

function updateGraphToChildrenConnectionByTouchedSuperEdgeIds(
  currentGraph: Graph<any, any, any, any>,
  updatedGraph: Graph<any, any, any, any>,
  connectedEdgesToDeletedVertex: string[],
  currentChildToGraphConnection: GraphToChildrenConnection,
) {
  const oldCoEdgesIThink = Object.values(currentGraph._loops)
    .flatMap((loop) => {
      return loop.coEdgeIds.map((coEdgeId) => {
        const coEdge = currentGraph._coEdges[coEdgeId]
        if (connectedEdgesToDeletedVertex.includes(currentGraph._edges[coEdge.edgeId].superEdgeId)) {
          return { ...coEdge, id: coEdgeId }
        }
      })
    })
    .filter(isDefined)

  const updatedGraphToChildrenConnection: GraphToChildrenConnection = {
    edges: { ...currentChildToGraphConnection.edges },
    coEdges: { ...currentChildToGraphConnection.coEdges },
  }
  const connectedChildren = oldCoEdgesIThink
    .map((coEdge) => {
      const children = currentChildToGraphConnection.coEdges[coEdge.id]
      delete updatedGraphToChildrenConnection.coEdges[coEdge.id]
      if (children) {
        return children
      }
    })
    .flat()
    .filter(isDefined)

  Object.entries(updatedGraph._edges).forEach(([edgeId, edge]) => {
    if (connectedEdgesToDeletedVertex.includes(edge.superEdgeId)) {
      const coEdges = Object.entries(updatedGraph._coEdges)
        .map(([coEdgeId, coEdge]) => {
          if (coEdge.edgeId === edgeId) {
            return { ...coEdge, id: coEdgeId }
          }
        })
        .filter(isDefined)
        .filter((x) => x.properties?.parcelParameters)
      coEdges.forEach((coEdge) => {
        updatedGraphToChildrenConnection.coEdges[coEdge.id] = connectedChildren.map((child) => ({
          ...child,
          key: newChildKey(),
        }))
      })
    }
  })
  return updatedGraphToChildrenConnection
}

const removeVertex = (compositionElement: CompositionElement, currentGraph: Graph, vertexId: string) => {
  //Do graph operation
  const [updatedGraph, connectedEdgesToDeletedVertex] = graph.removeVertex(currentGraph, vertexId)
  //update graphToChildrenConnection
  const currentGraphToChildrenConnection = getGraphToChildrenConnection(compositionElement)
  const updatedGraphToChildrenConnection = updateGraphToChildrenConnectionByTouchedSuperEdgeIds(
    currentGraph,
    updatedGraph,
    connectedEdgesToDeletedVertex,
    currentGraphToChildrenConnection,
  )
  return {
    graph: updatedGraph,
    element: updateCompositionWithGraphToChildrenConnection(
      compositionElement,
      updatedGraph,
      updatedGraphToChildrenConnection,
    ),
  }
}
const addEdge = (compositionElement: CompositionElement, state: Graph, vertexId0: string, vertexId1: string) => {
  const [updatedGraph] = graph.addEdge(state, vertexId0, vertexId1)
  return { graph: updatedGraph, element: compositionElement }
}

const replaceVertex = (
  compositionElement: CompositionElement,
  state: Graph,
  vertexIdToReplace: string,
  vertexIdToReplaceWith: string,
) => {
  //TODO is it ok to use graph internals here?
  const [g1, edgesConnectedToReplacedVertex] = graph.replaceVertex(state, vertexIdToReplace, vertexIdToReplaceWith)
  const g2 = graphInternal._removeVertex(g1, vertexIdToReplace)
  const g3 = graphInternal._updateInternals(g2, [...edgesConnectedToReplacedVertex])
  return { graph: g3, element: compositionElement }
}

export default {
  create,
  addEdge,
  setTemplatesForPaths,
  splitEdge,
  updateGraph,
  updateToReSetElevation,
  replaceVertex,
  moveVertex,
  removeVertex,
}
