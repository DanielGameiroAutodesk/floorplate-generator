import type { AddSectionCutData, DragSectionCutData, HoveredSectionCut } from "./helpers/sectionDragging"
import { Color, Group } from "three"
import { useMemo } from "preact/compat"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { moveGraphToCenterLine } from "./helpers/lineAlignment"
import { addBreadcrumb } from "@sentry/browser"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { screenResolutionVector } from "src/core/three/sceneManager"
import type { Graph } from "@spacemakerai/line-buildings-shared/shapeHelpers"
import type { SectionProps } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"
import { getUnitNormalVectorXY, getUnitVectorXY } from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"
import type { GraphZ } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"

const SectionCutHoverLineMaterial = new LineMaterial({
  color: new Color("#0676C6").getHex(),
  linewidth: 4,
  resolution: screenResolutionVector,
  polygonOffset: true,
  polygonOffsetFactor: -1.4,
  polygonOffsetUnits: -0.2,
})

function getLinePositionsAdd({
  addSectionCutData,
  centerGraph,
  sectionProps,
  floorHeight,
  width,
  lowestZ,
}: {
  addSectionCutData: AddSectionCutData
  centerGraph: Graph
  sectionProps: SectionProps
  floorHeight: number
  width: number
  lowestZ: number
}) {
  const { edgeId, sectionId, cutDistance } = addSectionCutData

  const edge = centerGraph.edges[edgeId]
  const startVertex = centerGraph.vertices[edge.start]
  const endVertex = centerGraph.vertices[edge.end]
  const unit = getUnitVectorXY(startVertex, endVertex)
  const normal = getUnitNormalVectorXY(startVertex, endVertex)

  const numberOfFloors = sectionProps[sectionId].numberOfFloors

  const xc = startVertex.x + unit.x * cutDistance
  const yc = startVertex.y + unit.y * cutDistance
  const xl = xc + normal.x * 0.5 * width
  const xr = xc - normal.x * 0.5 * width
  const yl = yc + normal.y * 0.5 * width
  const yr = yc - normal.y * 0.5 * width

  const z = floorHeight * numberOfFloors + lowestZ

  return new Float32Array([xl, yl, z, xr, yr, z])
}

function getLinePositionsDrag({
  dragSectionCut,
  dragSectionCutData,
  centerGraph,
  sectionProps,
  floorHeight,
  width,
  lowestZ,
}: {
  dragSectionCut: HoveredSectionCut
  dragSectionCutData: DragSectionCutData
  centerGraph: Graph
  sectionProps: SectionProps
  floorHeight: number
  width: number
  lowestZ: number
}) {
  const { edgeId, cutIndex, startCornerCut, endCornerCut } = dragSectionCut
  let cutDistance = dragSectionCutData.cutDistance
  if (dragSectionCutData.fixedBeforeLength !== undefined) {
    cutDistance += dragSectionCutData.fixedBeforeLength - dragSectionCutData.newSectionLengthBefore
  } else if (dragSectionCutData.fixedAfterLength !== undefined) {
    cutDistance += dragSectionCutData.effectiveSectionLengthAfter - dragSectionCutData.fixedAfterLength
  }
  const edge = centerGraph.edges[edgeId]
  const startVertex = centerGraph.vertices[edge.start]
  const endVertex = centerGraph.vertices[edge.end]
  const unit = getUnitVectorXY(startVertex, endVertex)
  const normal = getUnitNormalVectorXY(startVertex, endVertex)

  let beforeSectionId = edgeId + "::" + (cutIndex - 1)
  let afterSectionId = edgeId + "::" + cutIndex
  if (startCornerCut) {
    beforeSectionId = startVertex.id + "::" + 0
  }
  if (endCornerCut) {
    afterSectionId = endVertex.id + "::" + 0
  }
  const numberOfFloorsBefore = sectionProps[beforeSectionId].numberOfFloors
  const numberOfFloorsAfter = sectionProps[afterSectionId].numberOfFloors
  const numberOfFloors = Math.max(numberOfFloorsAfter, numberOfFloorsBefore)

  const xc = startVertex.x + unit.x * cutDistance
  const yc = startVertex.y + unit.y * cutDistance
  const xl = xc + normal.x * 0.5 * width
  const xr = xc - normal.x * 0.5 * width
  const yl = yc + normal.y * 0.5 * width
  const yr = yc - normal.y * 0.5 * width

  const z = floorHeight * numberOfFloors + lowestZ

  return new Float32Array([xl, yl, z, xr, yr, z])
}

function getLinePositionsHover({
  hoveredSectionCut,
  centerGraph,
  sectionProps,
  floorHeight,
  width,
  lowestZ,
}: {
  hoveredSectionCut: HoveredSectionCut
  centerGraph: Graph
  sectionProps: SectionProps
  floorHeight: number
  width: number
  lowestZ: number
}): Float32Array {
  const { edgeId, cutDistance, cutIndex, startCornerCut, endCornerCut } = hoveredSectionCut
  const edge = centerGraph.edges[edgeId]
  const startVertex = centerGraph.vertices[edge.start]
  const endVertex = centerGraph.vertices[edge.end]
  const unit = getUnitVectorXY(startVertex, endVertex)
  const normal = getUnitNormalVectorXY(startVertex, endVertex)
  let beforeSectionId = edgeId + "::" + (cutIndex - 1)
  let afterSectionId = edgeId + "::" + cutIndex
  if (startCornerCut) {
    beforeSectionId = startVertex.id + "::" + 0
  }
  if (endCornerCut) {
    afterSectionId = endVertex.id + "::" + 0
  }
  const numberOfFloorsBefore = sectionProps[beforeSectionId].numberOfFloors
  const numberOfFloorsAfter = sectionProps[afterSectionId].numberOfFloors
  const numberOfFloors = Math.max(numberOfFloorsAfter, numberOfFloorsBefore)

  const xc = startVertex.x + unit.x * cutDistance
  const yc = startVertex.y + unit.y * cutDistance
  const xl = xc + normal.x * 0.5 * width
  const xr = xc - normal.x * 0.5 * width
  const yl = yc + normal.y * 0.5 * width
  const yr = yc - normal.y * 0.5 * width

  const z = floorHeight * numberOfFloors + lowestZ

  return new Float32Array([xl, yl, z, xr, yr, z])
}

export function SectionCutVisual({
  hoveredSectionCut,
  dragSectionCut,
  dragSectionCutData,
  addSectionCutData,
  transSideGraph,
  sectionProps,
  floorHeight,
  width,
  lineAlignment,
}: {
  hoveredSectionCut?: HoveredSectionCut | undefined
  dragSectionCut?: HoveredSectionCut | undefined
  dragSectionCutData?: DragSectionCutData | undefined
  addSectionCutData?: AddSectionCutData | undefined
  transSideGraph: GraphZ
  sectionProps: SectionProps
  floorHeight: number
  width: number
  lineAlignment: "left" | "right" | "center"
}) {
  const renderApi = useRenderAPI("default")
  const visuals = useMemo(() => {
    const group = new Group()
    const lowestZ = Object.values(transSideGraph.vertices)[0]?.z || 0
    const centerGraph = moveGraphToCenterLine(transSideGraph, { width, lineAlignment })

    if (hoveredSectionCut && !dragSectionCut) {
      const linesGeometry: Float32Array = getLinePositionsHover({
        hoveredSectionCut,
        centerGraph,
        sectionProps,
        floorHeight,
        width,
        lowestZ,
      })
      const linesGeo = new LineSegmentsGeometry().setPositions(linesGeometry)
      const mesh = new LineSegments2(linesGeo, SectionCutHoverLineMaterial)
      group.add(mesh)
    }
    if (dragSectionCut && dragSectionCutData) {
      try {
        const linesGeometry: Float32Array = getLinePositionsDrag({
          dragSectionCut,
          dragSectionCutData,
          centerGraph,
          sectionProps,
          floorHeight,
          width,
          lowestZ,
        })
        const linesGeo = new LineSegmentsGeometry().setPositions(linesGeometry)
        const mesh = new LineSegments2(linesGeo, SectionCutHoverLineMaterial)
        group.add(mesh)
      } catch (e) {
        addBreadcrumb({
          type: "default",
          data: {
            dragSectionCut,
            dragSectionCutData,
            centerGraph,
            sectionProps,
            floorHeight,
            width,
            lowestZ,
          },
        })
        throw e
      }
    }
    if (addSectionCutData) {
      const linesGeometry: Float32Array = getLinePositionsAdd({
        addSectionCutData,
        centerGraph,
        sectionProps,
        floorHeight,
        width,
        lowestZ,
      })
      const linesGeo = new LineSegmentsGeometry().setPositions(linesGeometry)
      const mesh = new LineSegments2(linesGeo, SectionCutHoverLineMaterial)
      group.add(mesh)
    }

    return group
  }, [
    transSideGraph,
    sectionProps,
    floorHeight,
    width,
    lineAlignment,
    hoveredSectionCut,
    dragSectionCut,
    dragSectionCutData,
    addSectionCutData,
  ])

  renderApi.useObjectLifecycle_TEMPORARY_FIX(visuals)
  return <></>
}
