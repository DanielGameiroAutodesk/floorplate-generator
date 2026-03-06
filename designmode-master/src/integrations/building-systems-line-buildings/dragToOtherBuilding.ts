import { useMemo } from "preact/compat"
import type { OtherBuildingsData } from "./mergeLineBuildings"
import { transformGraph } from "./mergeLineBuildings"
import type { Vector3 } from "three"
import { Matrix4 } from "three"
import { moveGraphToSideLine } from "./helpers/lineAlignment"
import { getSnappingPointsToOtherBuilding } from "./snappingToOtherBuildings"
import { lineBuildingApi } from "./lineBuildingApi"
import { deepCopy } from "./helpers/helpers"
import { v4 as uuid } from "uuid"
import { useComputed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import type {
  SectionProps,
  Sections,
} from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { Graph, GraphEdge, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"

function makeLineBuildingCopyWithNewIds(_lineBuilding: any) {
  let lineBuilding = deepCopy(_lineBuilding)
  const params = lineBuilding?.element?.properties?.generator?.parameters as LineBuildingParameters
  const oldGraph = params.graph

  const edgeIdMap: Record<string, string> = {}
  const vertexIdMap: Record<string, string> = {}

  for (const edgeId of Object.keys(oldGraph.edges)) {
    edgeIdMap[edgeId] = uuid()
  }
  for (const vertexId of Object.keys(oldGraph.vertices)) {
    vertexIdMap[vertexId] = uuid()
  }

  const edges: Record<string, GraphEdge> = {}
  for (const edge of Object.values(oldGraph.edges)) {
    const edgeId = edgeIdMap[edge.id]
    const start = vertexIdMap[edge.start]
    const end = vertexIdMap[edge.end]
    edges[edgeId] = { id: edgeId, start, end }
  }
  const vertices: Record<string, GraphVertex> = {}
  for (const vertex of Object.values(oldGraph.vertices)) {
    const vertexId = vertexIdMap[vertex.id]
    vertices[vertexId] = { id: vertexId, x: vertex.x, y: vertex.y }
  }

  const sectionProps: SectionProps = {}
  for (const sectionId of Object.keys(params.sectionProps)) {
    const [oldVertexEdgeId, index] = sectionId.split("::")
    const vertexEdgeId = edgeIdMap[oldVertexEdgeId] || vertexIdMap[oldVertexEdgeId]
    const newSectionId = vertexEdgeId + "::" + index
    sectionProps[newSectionId] = params.sectionProps[sectionId]
  }

  const sections: Sections = {}
  for (const sectionId of Object.keys(params.sections)) {
    const [oldVertexEdgeId, index] = sectionId.split("::")
    const vertexEdgeId = edgeIdMap[oldVertexEdgeId] || vertexIdMap[oldVertexEdgeId]
    const newSectionId = vertexEdgeId + "::" + index
    sections[newSectionId] = params.sections[sectionId]
  }

  const graph: Graph = { vertices, edges }

  const updatedParams: LineBuildingParameters = { ...params, sectionProps, graph, sections }

  if (lineBuilding?.element?.properties?.generator?.parameters !== undefined)
    lineBuilding.element.properties.generator.parameters = updatedParams
  return lineBuilding
}

type SnapPoint = {
  point: Vector3
  buildingID: string
  side: "start" | "end"
  height: number
  path: string
  id: string
}

type OtherBuildingData = {
  centerGraph: Graph
  leftGraph: Graph
  rightGraph: Graph
  parameters: any
  worldTransform: Matrix4
}
export type OtherBuildingDragSnapData = {
  snappingPoints: { startDrag: SnapPoint[]; endDrag: SnapPoint[] }
  otherBuildingsData: { [path: string]: OtherBuildingData }
  otherLineBuildings: any[]
}

export function useGetOtherLineBuildingDragSnapData(
  parameters: {
    width: number
    sectionToggle: boolean
    lineAlignment: "left" | "right" | "center"
  },
  dbClickedElementId: string | undefined,
): OtherBuildingDragSnapData {
  const toplevel = useComputed(() =>
    elementState.currentProposalSignal.value.getToplevelNodes().map((node) => ({
      element: node.elementContainer.element,
      path: node.path,
      worldTransform: node.globalMatrix,
      isInBase: node.isInBase,
      hidden: node.getIsHiddenReactive(),
    })),
  ).value

  const otherLineBuildings = useMemo(() => {
    const lineBuildings = toplevel.filter((element) => {
      return lineBuildingApi.isLineBuildingFormaElement(element.element)
    })

    const lineBuildingsOnProposal = lineBuildings.filter((lineBuilding) => {
      return lineBuilding.path.split("/").length === 2
    })

    const otherLineBuilding = lineBuildingsOnProposal.filter((lineBuilding) => {
      return lineBuilding.path !== dbClickedElementId
    })

    return otherLineBuilding
      .filter((lineBuilding) => {
        const params = lineBuilding?.element?.properties?.generator?.parameters
        if (params?.width !== parameters.width) return false
        return params?.sectionToggle === parameters.sectionToggle
      })
      .map((lineBuilding) => {
        return makeLineBuildingCopyWithNewIds(lineBuilding)
      })
  }, [toplevel, parameters.width, parameters.sectionToggle, dbClickedElementId])

  const otherBuildingsData = useMemo(() => {
    const otherBuildingsData: OtherBuildingsData = {}
    for (let otherBuilding of otherLineBuildings) {
      const parameters = otherBuilding?.element?.properties?.generator?.parameters
      const worldTransform = otherBuilding.worldTransform || new Matrix4()

      const centerGraph = transformGraph(parameters.graph, worldTransform)
      const leftGraph = moveGraphToSideLine(centerGraph, { width: parameters.width, lineAlignment: "left" })
      const rightGraph = moveGraphToSideLine(centerGraph, { width: parameters.width, lineAlignment: "right" })
      otherBuildingsData[otherBuilding.path] = { centerGraph, leftGraph, rightGraph, parameters, worldTransform }
    }
    return otherBuildingsData
  }, [otherLineBuildings])

  const snappingPoints = useMemo(() => {
    const snappingPoints: { startDrag: SnapPoint[]; endDrag: SnapPoint[] } = { startDrag: [], endDrag: [] }
    otherLineBuildings.forEach((otherBuilding) => {
      const params = otherBuilding?.element?.properties?.generator?.parameters
      const worldTransformation = otherBuilding.worldTransform
      for (let dragVertexSide of ["startDrag", "endDrag"] as const) {
        const snapPointsOtherBuilding = getSnappingPointsToOtherBuilding(
          params,
          worldTransformation,
          parameters.lineAlignment,
          dragVertexSide === "startDrag",
        )
        if (snapPointsOtherBuilding) {
          const { start, end } = snapPointsOtherBuilding
          const startHeight = params.floorHeight * params.numberOfFloors
          const endHeight = params.floorHeight * params.numberOfFloors
          snappingPoints[dragVertexSide].push({
            point: start,
            side: "start",
            buildingID: "",
            height: startHeight,
            path: otherBuilding.path,
            id: otherBuilding.path + "::start",
          })
          snappingPoints[dragVertexSide].push({
            point: end,
            side: "end",
            buildingID: "",
            height: endHeight,
            path: otherBuilding.path,
            id: otherBuilding.path + "::end",
          })
        }
      }
    })
    return snappingPoints
  }, [otherLineBuildings, parameters.lineAlignment])

  return { snappingPoints, otherBuildingsData, otherLineBuildings }
}
