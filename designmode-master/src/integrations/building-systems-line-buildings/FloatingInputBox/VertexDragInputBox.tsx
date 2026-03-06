import { useMemo } from "preact/compat"
import type { Vector3 } from "three"
import { getAngleXY } from "./geoHelpers"
import type { ControlContextValue } from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import FloatingToolInputs from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import { exitCurrentTool } from "src/core/toolsState"
import type { Graph, GraphEdge } from "@spacemakerai/line-buildings-shared/shapeHelpers"

function getPrevEdgeLength(transSideGraph: Graph, dragVertexData: DragVertexData) {
  const prevEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.end === dragVertexData.dragVertexId
  })
  if (prevEdge === undefined) return -1
  const prevVertex = transSideGraph.vertices[prevEdge.start]

  return (
    ((dragVertexData.snappedPosition.x - prevVertex.x) ** 2 + (dragVertexData.snappedPosition.y - prevVertex.y) ** 2) **
    0.5
  )
}

function getNextEdgeLength(transSideGraph: Graph, dragVertexData: DragVertexData) {
  const nextEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.start === dragVertexData.dragVertexId
  })
  if (nextEdge === undefined) return -1
  const nextVertex = transSideGraph.vertices[nextEdge.end]

  return (
    ((dragVertexData.snappedPosition.x - nextVertex.x) ** 2 + (dragVertexData.snappedPosition.y - nextVertex.y) ** 2) **
    0.5
  )
}

function getPrevCornerAngle(transSideGraph: Graph, dragVertexData: DragVertexData) {
  const prevEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.end === dragVertexData.dragVertexId
  })
  if (prevEdge === undefined) return -1
  const prevVertex = transSideGraph.vertices[prevEdge.start]
  const prevPrevEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.end === prevVertex.id
  })
  if (prevPrevEdge === undefined) return -1
  const prevPrevVertex = transSideGraph.vertices[prevPrevEdge.start]

  return getAngleXY(prevPrevVertex, prevVertex, dragVertexData.snappedPosition)
}

function getNextCornerAngle(transSideGraph: Graph, dragVertexData: DragVertexData) {
  const nextEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.start === dragVertexData.dragVertexId
  })
  if (nextEdge === undefined) return -1
  const nextVertex = transSideGraph.vertices[nextEdge.end]
  const nextNextEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.start === nextVertex.id
  })
  if (nextNextEdge === undefined) return -1
  const nextNextVertex = transSideGraph.vertices[nextNextEdge.end]

  return getAngleXY(dragVertexData.snappedPosition, nextVertex, nextNextVertex)
}

type ActiveInputs = {
  prevEdgeLengthActive: boolean
  nextEdgeLengthActive: boolean
  prevCornerAngleActive: boolean
  nextCornerAngleActive: boolean
}

function getActiveInputFields(transSideGraph: Graph, dragVertexData: DragVertexData): ActiveInputs {
  const prevEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.end === dragVertexData.dragVertexId
  })
  const prevPrevEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.end === prevEdge?.start
  })
  const prevEdgeLengthActive = prevEdge !== undefined
  const prevCornerAngleActive = prevEdge !== undefined && prevPrevEdge !== undefined

  const nextEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.start === dragVertexData.dragVertexId
  })
  const nextNextEdge = Object.values(transSideGraph.edges).find((edge: GraphEdge) => {
    return edge.start === nextEdge?.end
  })
  const nextEdgeLengthActive = nextEdge !== undefined
  const nextCornerAngleActive = nextEdge !== undefined && nextNextEdge !== undefined

  return { prevEdgeLengthActive, prevCornerAngleActive, nextEdgeLengthActive, nextCornerAngleActive }
}

export type VertexDragInputData = {
  fixedPrevEdgeLength?: number
  fixedNextEdgeLength?: number
  fixedPrevCornerAngle?: number
  fixedNextCornerAngle?: number
}

type DragVertexData = {
  dragVertexId: string
  snappedPosition: Vector3
}
export const VertexDragInputBox = ({
  vertexDragInputData,
  updateVertexDragInputData,
  dragVertexData,
  transSideGraph,
}: {
  vertexDragInputData: VertexDragInputData
  updateVertexDragInputData: (vertexDragInputData: VertexDragInputData) => void
  dragVertexData: DragVertexData
  transSideGraph: Graph
}) => {
  const activeInputFields = useMemo(
    () => getActiveInputFields(transSideGraph, dragVertexData),
    [transSideGraph, dragVertexData],
  )

  const { fixedPrevEdgeLength, fixedNextEdgeLength, fixedPrevCornerAngle, fixedNextCornerAngle } = vertexDragInputData

  const prevEdgeLengthLocal = useMemo(() => {
    let prevLength
    if (fixedPrevEdgeLength !== undefined) prevLength = fixedPrevEdgeLength
    else prevLength = getPrevEdgeLength(transSideGraph, dragVertexData)
    return prevLength
  }, [fixedPrevEdgeLength, dragVertexData, transSideGraph])

  const prevCornerAngleLocal = useMemo(() => {
    let cornerAngle
    if (fixedPrevCornerAngle !== undefined) cornerAngle = fixedPrevCornerAngle
    else cornerAngle = getPrevCornerAngle(transSideGraph, dragVertexData)
    return (cornerAngle / Math.PI) * 180
  }, [fixedPrevCornerAngle, dragVertexData, transSideGraph])

  const nextEdgeLengthLocal = useMemo(() => {
    let prevLength
    if (fixedNextEdgeLength !== undefined) prevLength = fixedNextEdgeLength
    else prevLength = getNextEdgeLength(transSideGraph, dragVertexData)
    return prevLength
  }, [fixedNextEdgeLength, dragVertexData, transSideGraph])

  const nextCornerAngleLocal = useMemo(() => {
    let cornerAngle
    if (fixedNextCornerAngle !== undefined) cornerAngle = fixedNextCornerAngle
    else cornerAngle = getNextCornerAngle(transSideGraph, dragVertexData)
    return (cornerAngle / Math.PI) * 180
  }, [fixedNextCornerAngle, dragVertexData, transSideGraph])

  const inputFields = useMemo(() => {
    const fields: ControlContextValue[] = []

    if (activeInputFields.prevEdgeLengthActive) {
      fields.push({
        type: "horizontal",
        value: prevEdgeLengthLocal,
        change: (fixedLengthLocal: number | undefined) => {
          let fixedLength
          if (fixedLengthLocal !== undefined) {
            fixedLength = Math.max(fixedLengthLocal, 0)
          }
          updateVertexDragInputData({
            fixedPrevEdgeLength: fixedLength,
            fixedPrevCornerAngle: fixedPrevCornerAngle,
            fixedNextEdgeLength: undefined,
            fixedNextCornerAngle: undefined,
          })
        },
      })
    }

    if (activeInputFields.nextEdgeLengthActive) {
      fields.push({
        type: "horizontal",
        value: nextEdgeLengthLocal,
        change: (fixedLengthLocal: number | undefined) => {
          let fixedLength
          if (fixedLengthLocal !== undefined) {
            fixedLength = Math.max(fixedLengthLocal, 0)
          }
          updateVertexDragInputData({
            fixedPrevEdgeLength: undefined,
            fixedPrevCornerAngle: undefined,
            fixedNextEdgeLength: fixedLength,
            fixedNextCornerAngle: fixedNextCornerAngle,
          })
        },
      })
    }

    if (activeInputFields.prevCornerAngleActive) {
      fields.push({
        type: "angle",
        value: prevCornerAngleLocal,
        change: (fixedAngleLocal: number | undefined) => {
          let fixedAngle
          if (fixedAngleLocal !== undefined) {
            fixedAngle = (fixedAngleLocal / 180) * Math.PI
          }
          updateVertexDragInputData({
            fixedPrevEdgeLength: fixedPrevEdgeLength,
            fixedPrevCornerAngle: fixedAngle,
            fixedNextEdgeLength: undefined,
            fixedNextCornerAngle: undefined,
          })
        },
      })
    }

    if (activeInputFields.nextCornerAngleActive) {
      fields.push({
        type: "angle",
        value: nextCornerAngleLocal,
        change: (fixedAngleLocal: number | undefined) => {
          let fixedAngle
          if (fixedAngleLocal !== undefined) {
            fixedAngle = (fixedAngleLocal / 180) * Math.PI
          }
          updateVertexDragInputData({
            fixedPrevEdgeLength: undefined,
            fixedPrevCornerAngle: undefined,
            fixedNextEdgeLength: fixedNextEdgeLength,
            fixedNextCornerAngle: fixedAngle,
          })
        },
      })
    }

    return fields
  }, [
    activeInputFields.nextCornerAngleActive,
    activeInputFields.nextEdgeLengthActive,
    activeInputFields.prevCornerAngleActive,
    activeInputFields.prevEdgeLengthActive,
    fixedNextCornerAngle,
    fixedNextEdgeLength,
    fixedPrevCornerAngle,
    fixedPrevEdgeLength,
    nextCornerAngleLocal,
    nextEdgeLengthLocal,
    prevCornerAngleLocal,
    prevEdgeLengthLocal,
    updateVertexDragInputData,
  ])

  return <FloatingToolInputs fields={inputFields} cancel={exitCurrentTool} />
}
