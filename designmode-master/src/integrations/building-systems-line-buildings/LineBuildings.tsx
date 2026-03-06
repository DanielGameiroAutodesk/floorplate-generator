import { getLineOnRoof } from "./helpers/getLineOnRoof"
import type { Matrix4 } from "three"
import { Group } from "three"
import { moveGraphToCenterLine, moveGraphToSideLine } from "./helpers/lineAlignment"
import { getVertexElevation } from "./helpers/getVertexElevation"
import { lineBuildingApi } from "./lineBuildingApi"
import { useMemo } from "preact/compat"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { defaultRoofLineMaterial } from "./EditVisuals"
import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { useProjectLevelFloorPlans } from "./projectLevelFloorPlans"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { IgnoreContext } from "src/core/ignore-context"
import { HiddenPaths } from "src/core/hidden"
import { elementState } from "src/core/elements/ElementState"
import { useComputed } from "@preact/signals"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import { getTranslator } from "src/i18n"

function buildRoofLines(parameters: LineBuildingParameters) {
  const graph = parameters.graph
  const transSideGraph = moveGraphToSideLine(graph, parameters)
  const lowestZ = 0
  const initVertices = Object.values(transSideGraph.vertices).map((vertex) => {
    const z = getVertexElevation(parameters, vertex)
    return { ...vertex, z }
  })
  const centerGraph = moveGraphToCenterLine(transSideGraph, parameters)
  const { liveParameters: updatedParameters } = lineBuildingApi.runLive({
    ...parameters,
    graph: centerGraph,
  })

  const roofLines = getLineOnRoof(transSideGraph, updatedParameters, lowestZ, initVertices)
  const n = roofLines.length * 6
  const position = new Float32Array(n)
  let c = 0
  for (const [start, end] of roofLines) {
    position[c++] = start.x
    position[c++] = start.y
    position[c++] = start.z
    position[c++] = end.x
    position[c++] = end.y
    position[c++] = end.z
  }
  return position
}

function LineBuildingRoofLine({
  parameters,
  worldMatrix,
  hidden,
}: {
  parameters: LineBuildingParameters
  worldMatrix: Matrix4 | undefined
  hidden: boolean
}) {
  const renderApi = useRenderAPI("default")
  const lineVisual = useMemo(() => {
    const group = new Group()
    const position = buildRoofLines(parameters)
    const geom = new LineSegmentsGeometry()
    geom.setPositions(position)
    const visuals = new LineSegments2(geom, defaultRoofLineMaterial)
    visuals.computeLineDistances()
    group.add(visuals)
    if (worldMatrix) group.applyMatrix4(worldMatrix)
    return group
  }, [parameters, worldMatrix])
  renderApi.useObjectLifecycle_TEMPORARY_FIX(lineVisual, !hidden)
  return null
}

export function LineBuildings() {
  useProjectLevelFloorPlans()

  const toplevel = useComputed(() =>
    elementState.currentProposalSignal.value.getToplevelNodes().map((node) => ({
      element: node.elementContainer.element,
      path: node.path,
      worldTransform: node.globalMatrix,
      hidden: node.getIsHiddenReactive(),
    })),
  ).value

  const lineBuildingElements = toplevel.filter((e) => lineBuildingApi.isLineBuildingFormaElement(e.element))
  const faintIds = IgnoreContext.idsNotInContextSignal.value
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("Line Buildings error: ", error)
    console.warn(errorInfo)
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.lineBuilding.failedToDraw), status: "warning" })
    captureException(error, { tags: { owner: "squad-composition" }, extra: { errorInfo } })
  })
  if (error) {
    //Not sure what we should do if we crash here, right now all lines will disappear...
    return null
  }
  return (
    <>
      {lineBuildingElements.map((e) => (
        <LineBuildingRoofLine
          key={e.path}
          parameters={e.element.properties!.generator.parameters}
          worldMatrix={e.worldTransform}
          hidden={e.hidden || HiddenPaths.hiddenPathsSignal.value.has(e.path) || faintIds.has(e.path)}
        />
      ))}
    </>
  )
}
