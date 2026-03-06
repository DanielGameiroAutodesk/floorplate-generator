import { useComputed } from "@preact/signals"
import type { Transform } from "@spacemakerai/element-types"
import { useMemo } from "preact/compat"
import { useCallback, useEffect, useState } from "preact/hooks"
import { useRecoilValue } from "recoil"
import {
  drawLineBuildingModeAtom,
  DrawLineBuildingToolbar,
} from "src/integrations/Toolbars/CoreToolbar/domain/common/DrawLineBuildingToolbar"
import { showCategory } from "src/core/categories"
import { elementState } from "src/core/elements/ElementState"
import { contextRootSignal, scenarioModeSignal, useForceNoSelectedPaths } from "src/core/selection/selectionState"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool } from "src/core/toolsState"
import { getTranslationMatrix } from "src/integrations/building-systems-common/geoHelpers"
import {
  isGraphValid,
  moveGraphToSideLine,
} from "src/integrations/building-systems-line-buildings/helpers/lineAlignment"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import type { OtherBuildingsData } from "src/integrations/building-systems-line-buildings/mergeLineBuildings"
import {
  mergeGraphsOfLineBuildings,
  mergeLineBuildings,
  transformGraph,
} from "src/integrations/building-systems-line-buildings/mergeLineBuildings"
import { useLineBuildingToolParams } from "src/integrations/building-systems-line-buildings/quickDrawState"
import { getSnappingPointsToOtherBuilding } from "src/integrations/building-systems-line-buildings/snappingToOtherBuildings"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import type { Shape } from "src/lib/three/Shape/types"
import type { Action } from "src/core/legacy-actions"
import { PickElement } from "src/integrations/tools-common/Drawing/basicShape/PickElement"
import type { LineAlignment } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { LineBuildingParametersInner } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import { type Graph, makeGraphFromShape } from "@spacemakerai/line-buildings-shared/shapeHelpers"
import { type DrawingSnapData, DrawLineBuildingTool } from "./DrawLineBuildingTool"
import { newChildKey } from "src/lib/element/urn"
import { Matrix4 } from "three"
import type { ConnectToOtherBuildingPoint } from "./drawLineBuildingSnapping"
import { HiddenPaths } from "src/core/hidden"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"
import { EventName } from "@spacemakerai/webapp-analytics"

export const LINE_BUILDING_TOOL_CFG: ToolCfg = {
  id: "lineBuilding",
  toolbar: () => <DrawLineBuildingToolbar />,
  tool: DrawLineBuilding,
  propertyPanel: "default",
}

function useGetOtherLineBuildings(
  parameters: {
    width: number
    sectionToggle: boolean
    lineAlignment: "left" | "right" | "center"
  },
  drawingSnapData: DrawingSnapData,
) {
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

    return lineBuildingsOnProposal.filter((lineBuilding) => {
      const params = lineBuilding?.element?.properties?.generator?.parameters
      if (params?.width !== parameters.width) return false
      return params?.sectionToggle === parameters.sectionToggle
    })
  }, [toplevel, parameters.width, parameters.sectionToggle])

  const otherBuildingsData: OtherBuildingsData = useMemo(() => {
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

  const connectionPoints = useMemo(() => {
    const connectionPoints: ConnectToOtherBuildingPoint[] = []
    otherLineBuildings.forEach((otherBuilding) => {
      const params = otherBuilding?.element?.properties?.generator?.parameters
      const worldTransformation = otherBuilding.worldTransform
      const snapPointsOtherBuilding = getSnappingPointsToOtherBuilding(
        params,
        worldTransformation,
        parameters.lineAlignment,
        !drawingSnapData.startedDrawing,
      )
      const drawingFromBuilding = drawingSnapData?.startSnap?.path === otherBuilding.path
      if (snapPointsOtherBuilding) {
        const { start, end, nextStartVec, preEndVec } = snapPointsOtherBuilding
        const startHeight = params.floorHeight * params.numberOfFloors
        const endHeight = params.floorHeight * params.numberOfFloors
        if (!drawingFromBuilding || drawingSnapData?.startSnap.side !== "start")
          connectionPoints.push({
            point: start,
            prevPoint: nextStartVec,
            side: "start",
            buildingID: "",
            height: startHeight,
            path: otherBuilding.path,
            id: otherBuilding.path + "::start",
          })
        if (!drawingFromBuilding || drawingSnapData?.startSnap.side !== "end")
          connectionPoints.push({
            point: end,
            prevPoint: preEndVec,
            side: "end",
            buildingID: "",
            height: endHeight,
            path: otherBuilding.path,
            id: otherBuilding.path + "::end",
          })
      }
    })
    return connectionPoints
  }, [otherLineBuildings, drawingSnapData, parameters.lineAlignment])

  return { connectionPoints, otherBuildingsData }
}

let hiddenPaths: Record<string, boolean> = {}

function useShowBuildingsCategory() {
  const scenarioMode = scenarioModeSignal.value
  useEffect(() => {
    showCategory("building", scenarioMode)
  }, [scenarioMode])
}

function useDrawLineBuildingMode() {
  return useRecoilValue(drawLineBuildingModeAtom)
}

export function DrawLineBuilding() {
  const contextRoot = contextRootSignal.value
  const renderApi = useRenderAPI("default")
  const parameters = useLineBuildingToolParams()
  const [drawingSnapData, setDrawingSnapData] = useState<DrawingSnapData>({ startedDrawing: false })
  const { otherBuildingsData, connectionPoints } = useGetOtherLineBuildings(parameters, drawingSnapData)

  useShowBuildingsCategory()

  useForceNoSelectedPaths()

  useEffect(() => {
    // TODO temporary fix for hidden lineBuildings bug
    const newHiddenPaths: Record<string, boolean> = {}
    if (drawingSnapData?.startSnap?.path) newHiddenPaths[drawingSnapData?.startSnap?.path] = true
    if (drawingSnapData?.endSnap?.path) newHiddenPaths[drawingSnapData?.endSnap?.path] = true

    Object.keys(hiddenPaths).forEach((path) => {
      if (!newHiddenPaths[path]) HiddenPaths.setPathHidden(path, false)
    })
    Object.keys(newHiddenPaths).forEach((path: string) => {
      if (!hiddenPaths[path]) HiddenPaths.setPathHidden(path, true)
    })
    hiddenPaths = newHiddenPaths
  }, [drawingSnapData, renderApi])

  useEffect(() => {
    return () => {
      HiddenPaths.resetHiddenPaths()
    }
  }, [])

  const isValid = useCallback(
    ({
      sideGraph,
      parameters,
      otherBuildingsData,
      drawingSnapData,
    }: {
      sideGraph: Graph
      parameters: { width: number; lineAlignment: LineAlignment }
      otherBuildingsData: OtherBuildingsData
      drawingSnapData: DrawingSnapData
    }) => {
      const { width } = parameters
      const { sideGraph: mergedSideGraph, lineAlignment: mergedLineAlignment } = mergeGraphsOfLineBuildings({
        drawSideGraph: sideGraph,
        parameters,
        otherBuildingsData,
        drawingSnapData,
      })
      return isGraphValid(mergedSideGraph, width, mergedLineAlignment)
    },
    [],
  )

  const groundPolygonMode = useDrawLineBuildingMode()

  const actionApi = useActionAPI()
  const onComplete = useCallback(
    ({
      graph,
      lowestZ,
      parameters,
      drawingSnapData,
    }: {
      graph: Graph
      lowestZ: number
      parameters: LineBuildingParametersInner
      drawingSnapData: DrawingSnapData
    }) => {
      const empty = Object.values(graph.edges).length === 0
      if (empty) {
        exitCurrentTool()
        return
      }

      const valid = isValid({ sideGraph: graph, parameters, drawingSnapData, otherBuildingsData })
      if (!valid) {
        exitCurrentTool()
        return
      }

      const mergedLineBuilding = mergeLineBuildings({ ...parameters, graph }, otherBuildingsData, drawingSnapData)
      const { geometry, element } = lineBuildingApi.run(mergedLineBuilding)
      const transform: Transform = getTranslationMatrix(0, 0, lowestZ)

      const actions: Action[] = []
      const childKey = newChildKey()
      actions.push({
        type: "create",
        parentPath: contextRoot,
        child: { key: childKey, transform },
        element,
        representations: {
          volumeMesh: geometry,
          footprint: undefined,
          terrainShape: undefined,
          terrainTexture: undefined,
          buildingFloors3DSketch_UNSTABLE: undefined,
        },
        persisted: false,
      })
      if (drawingSnapData.startSnap) {
        actions.push({ type: "delete", path: drawingSnapData.startSnap.path })
      }
      if (drawingSnapData.endSnap && drawingSnapData.endSnap.path !== drawingSnapData?.startSnap?.path) {
        actions.push({ type: "delete", path: drawingSnapData.endSnap.path })
      }
      actionApi.apply(
        "Draw Line Building",
        actions,
        {
          elementCategory: "building",
          tool: `lineBuilding:${groundPolygonMode}`,
          numElements: 1,
          eventType: "add",
          sectionToggle: parameters.sectionToggle,
          ...(parameters.functionId ? { functionId: parameters.functionId } : {}),
          width: parameters.width,
          floorHeight: parameters.floorHeight,
          lineAlignment: parameters.lineAlignment,
          numberOfFloors: parameters.numberOfFloors,
          minSubBuildingLength: parameters.minSubBuildingLength,
        },
        new Set([contextRoot + "/" + childKey]),
      )

      dispatchBuildingEvent("line_building", EventName.Add, "draw")
      exitCurrentTool()
    },
    [isValid, otherBuildingsData, contextRoot, actionApi, groundPolygonMode],
  )

  const onCompleteShapeTool = useCallback(
    (shape: Shape) => {
      const graph = makeGraphFromShape(shape)
      const lowestZ = Math.min(...shape.vertices.map((vertex) => vertex.z))
      onComplete({ graph, lowestZ, parameters, drawingSnapData })
    },
    [onComplete, parameters, drawingSnapData],
  )

  const onCancel = useCallback(() => {
    exitCurrentTool()
  }, [])

  return groundPolygonMode === "pick" ? (
    <PickElement
      onCancel={onCancel}
      onLinePicked={onCompleteShapeTool}
      onPolygonPicked={onCompleteShapeTool}
      onExtrudedPolygonPicked={onCompleteShapeTool}
    />
  ) : (
    <>
      <DrawLineBuildingTool
        connectionPoints={connectionPoints}
        parameters={parameters}
        otherBuildingsData={otherBuildingsData}
        drawingSnapData={drawingSnapData}
        setDrawingSnapData={setDrawingSnapData}
        isValid={isValid}
        onComplete={onComplete}
      />
    </>
  )
}
