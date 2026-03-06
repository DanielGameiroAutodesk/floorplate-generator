import type { DragSectionCutData, HoveredSectionCut } from "./helpers/sectionDragging"
import { getUpdatedSectionPropsAfterSectionDrag } from "./helpers/sectionDragging"
import { useMemo } from "preact/compat"
import { isGraphValid, moveGraphToCenterLine } from "./helpers/lineAlignment"
import { lineBuildingApi } from "./lineBuildingApi"
import { getLiveVerticesOnVertexDrag } from "./helpers/getLiveVerticesOnVertexDrag"
import { getLineOnRoof } from "./helpers/getLineOnRoof"
import { getTranslationMatrix } from "src/integrations/building-systems-common/geoHelpers"
import { getUpdatedGraphAfterVertexDrag } from "./helpers/updateGraphAfterVertexDrag"
import { addBreadcrumb } from "@sentry/browser"
import type { GraphZ } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"

export function useGetLineBuildingLiveVisuals({
  parameters,
  transSideGraph,
  initVertices,
  dragVertex,
  dragVertexData,
  dragSectionCut,
  dragSectionCutData,
  otherBuildingsSnapData,
}: {
  parameters: any
  transSideGraph: GraphZ
  initVertices: any
  dragVertex?: any
  dragVertexData?: any
  dragSectionCut?: HoveredSectionCut | undefined
  dragSectionCutData?: DragSectionCutData | undefined
  otherBuildingsSnapData?: any
}) {
  const lowestZ = useMemo(() => {
    return Object.values(transSideGraph.vertices)[0]?.z || 0
  }, [transSideGraph])

  const { liveGraphSide, liveGraph, liveParameters, geometry, lineGeometry, validGraph } = useMemo(() => {
    const customLayouts = parameters.customLayouts || []
    if (dragVertex !== undefined) {
      const { graph: liveGraphSide, parameters: updatedParameters } = getUpdatedGraphAfterVertexDrag(
        transSideGraph,
        dragVertexData,
        !!dragVertex,
        otherBuildingsSnapData,
        parameters,
      )
      const validGraph = isGraphValid(liveGraphSide, updatedParameters.width, updatedParameters.lineAlignment)
      const liveGraph = moveGraphToCenterLine(liveGraphSide, updatedParameters)
      const customLayouts = updatedParameters.customLayouts || []
      try {
        const { geometry, lineGeometry, liveParameters } = lineBuildingApi.runLive(
          {
            ...updatedParameters,
            graph: liveGraph,
          },
          customLayouts,
        )
        return { liveGraphSide, liveGraph, liveParameters, geometry, lineGeometry, validGraph }
      } catch (e) {
        addBreadcrumb({
          type: "default",
          data: { transSideGraph, dragVertexData, dragVertex, otherBuildingsSnapData, parameters, liveGraphSide },
        })
        throw e
      }
    } else if (dragSectionCut !== undefined && dragSectionCutData !== undefined) {
      const liveGraph = moveGraphToCenterLine(transSideGraph, parameters)
      const updatedSectionProps = getUpdatedSectionPropsAfterSectionDrag({
        sectionProps: parameters.sectionProps,
        dragSectionCut,
        dragSectionCutData,
        graph: transSideGraph,
      })
      const liveParameters = { ...parameters, sectionProps: updatedSectionProps }
      const { geometry, lineGeometry } = lineBuildingApi.runLive(
        {
          ...liveParameters,
          graph: liveGraph,
        },
        customLayouts,
      )
      return { liveGraphSide: transSideGraph, liveGraph, liveParameters, geometry, lineGeometry, validGraph: true }
    } else {
      const liveGraph = moveGraphToCenterLine(transSideGraph, parameters)
      const { geometry, lineGeometry } = lineBuildingApi.runLive(
        {
          ...parameters,
          graph: liveGraph,
        },
        customLayouts,
      )
      return {
        liveGraphSide: transSideGraph,
        liveGraph,
        liveParameters: parameters,
        geometry,
        lineGeometry,
        validGraph: true,
      }
    }
  }, [
    parameters,
    transSideGraph,
    dragVertex,
    dragVertexData,
    dragSectionCut,
    dragSectionCutData,
    otherBuildingsSnapData,
  ])

  return useMemo(() => {
    const liveVertices = getLiveVerticesOnVertexDrag({
      initVertices,
      dragVertex,
      dragVertexData,
      parameters: liveParameters,
      lowestZ,
    })

    const sideVertices = Object.values(liveGraphSide.vertices)
    const roofLines = getLineOnRoof(liveGraph, liveParameters, lowestZ, sideVertices)
    const buildingTranslation = getTranslationMatrix(0, 0, lowestZ)

    return { building: { geometry, lineGeometry }, buildingTranslation, roofLines, liveVertices, validGraph }
  }, [
    liveGraphSide,
    liveGraph,
    liveParameters,
    geometry,
    lineGeometry,
    lowestZ,
    dragVertex,
    dragVertexData,
    initVertices,
    validGraph,
  ])
}
