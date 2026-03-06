import type { InternalPath } from "src/lib/element/path"
import { getParentPath } from "src/lib/element/path"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import type { Matrix4 } from "three"
import { Box3, Vector3 } from "three"
import { useCallback, useEffect, useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { useMemo, useState } from "preact/compat"
import { getTranslator } from "src/i18n"
import type { Edges, Graph, Vertex, Vertices } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import type {
  BasicBuilding,
  BasicBuildingElement,
  Floor,
  Spaces,
} from "src/integrations/building-systems-basic-building/lib/types"
import type { Shape } from "src/lib/three/Shape/types"
import { isDefined } from "src/lib/array"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import { CreateToolMode, ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { parseUrn } from "src/lib/element/urn"
import { randomId } from "src/integrations/building-systems-basic-building/lib/utils"
import type {
  LineXY,
  Polygon,
  PolygonWithHoles,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import {
  isPointOnLine,
  isPolygonClockwise,
  polygonToXY,
  polygonWithHolesToXY,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import { isSelfIntersecting } from "src/lib/three/Shape/shapeUtils"
import { validateRelationsBetweenHolesAndExterior } from "./validation"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import { SNAPPING_SENSITIVITY } from "src/integrations/snapping/constants"
import { getIntersectionAreaOfPolygonsWithHoles } from "src/integrations/building-systems-common/buildingMigrations/pureMigrationFunctions/geometry/areaOfPolygonIntersection"
import { areaOfPolygon } from "src/lib/geometry/areaOfPolygon"
import type { PointXY } from "src/lib/geometry/polygonXY"
import { elementState } from "src/core/elements/ElementState"
import { resetFadeAllExceptSignal, setFadeAllExceptSignalValue } from "src/core/selection/selectionState"
import sceneManager from "src/core/three/sceneManager"
import { exitCurrentTool } from "src/core/toolsState"
import { HiddenPaths } from "src/core/hidden"

////
// Illegal types and function
/////

function bboxFromEndpoints(end1: Vector3, end2: Vector3, buffer = 0): Box3 {
  return new Box3().expandByPoint(end1).expandByPoint(end2).expandByScalar(buffer)
}

type Segment3 = {
  start: Vector3
  end: Vector3
  bbox: Box3
}

type SnappingLine = {
  type: "LINE"
  start: Vector3
  end: Vector3
  center: Vector3
  onTerrain: boolean
  segments: Segment3[]
  shapeId: string
  refLines?: SnappingLine[]
}

//////
///
////////

const Preview = ({ building, worldMatrix }: { building: BasicBuilding; worldMatrix: Matrix4 }) => {
  const renderAPI = useRenderAPI("basic-preview")

  useMemo(() => {
    const transform = worldMatrix.toArray()
    for (const object of BasicBuildingAPI.makePreviewObjects(building, transform)) {
      renderAPI.upsert(object)
    }
  }, [building, renderAPI, worldMatrix])

  return null
}

function useHideAndFade(path: InternalPath) {
  useEffect(() => {
    HiddenPaths.setPathHidden(path, true)
    return () => {
      HiddenPaths.setPathHidden(path, false)
    }
  }, [path])

  useEffect(() => {
    setFadeAllExceptSignalValue([path])
    return () => resetFadeAllExceptSignal()
  }, [path])
}

function sameEdge(startOne: Vertex, endOne: Vertex, startTwo: Vertex, endTwo: Vertex): boolean {
  return startOne.x === startTwo.x && startOne.y === startTwo.y && endOne.x === endTwo.x && endOne.y === endTwo.y
}

function sameGraphAsPrev(graph: Graph, prevGraph: Graph | undefined) {
  if (prevGraph === undefined) return false
  if (Object.values(graph.edges).length !== Object.values(prevGraph.edges).length) return false
  for (let edge of Object.values(graph.edges)) {
    let found = false
    for (let prevEdge of Object.values(prevGraph.edges)) {
      const vStart = graph.vertices[edge.start]
      const vEnd = graph.vertices[edge.end]
      const vStartPrev = prevGraph.vertices[prevEdge.start]
      const vEndPrev = prevGraph.vertices[prevEdge.end]
      if (sameEdge(vStart, vEnd, vStartPrev, vEndPrev)) {
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
}

function getFloorGraphMap(graphOne: Graph, graphTwo: Graph, spaces: Spaces, prevSpaces: Spaces) {
  const vertexMap: Record<string, string> = {}
  for (const vertexOne of Object.values(graphOne.vertices)) {
    for (const vertexTwo of Object.values(graphTwo.vertices)) {
      if (vertexOne.x === vertexTwo.x && vertexOne.y === vertexTwo.y) {
        vertexMap[vertexOne.id] = vertexTwo.id
      }
    }
  }
  const edgeMap: Record<string, string> = {}
  for (const edgeOne of Object.values(graphOne.edges)) {
    for (const edgeTwo of Object.values(graphTwo.edges)) {
      const startOne = vertexMap[edgeOne.start]
      const endOne = vertexMap[edgeOne.end]
      if (
        (startOne === edgeTwo.start && endOne === edgeTwo.end) ||
        (startOne === edgeTwo.end && endOne === edgeTwo.start)
      ) {
        edgeMap[edgeOne.id] = edgeTwo.id
      }
    }
  }
  const spaceMap: Record<string, string> = {}
  for (const spaceOne of Object.values(spaces)) {
    for (const spaceTwo of Object.values(prevSpaces)) {
      const matchOne = spaceOne.polygon.every((pointOneId) => {
        const vertexId = vertexMap[pointOneId]
        return spaceTwo.polygon.find((pointTwoId: string) => pointTwoId === vertexId)
      })
      if (!matchOne) continue
      const matchTwo = spaceTwo.polygon.every((pointTwoId) => {
        return spaceOne.polygon.find((pointOneId) => {
          return pointTwoId === vertexMap[pointOneId]
        })
      })
      if (matchOne && matchTwo) {
        spaceMap[spaceOne.id] = spaceTwo.id
        break
      }
    }
  }

  return { spaceMap }
}

type SpaceIdToLoopIndexes = Record<string, { polygon: number; holes: number[] }>

function makeInitShapeAndLoopsMap(building: BasicBuilding, worldTransform: Matrix4, singleFloorIndex?: number) {
  const shapeVertices: Vector3[] = []
  const shapeEdges: [number, number][] = []
  const loops = []

  const vertexIds: string[] = []
  const spaceIdToLoopIndexes: SpaceIdToLoopIndexes = {}

  let elevation = 0
  let prevFloor: Floor | undefined = undefined
  for (let floorIndex = 0; floorIndex < building.floors.length; floorIndex++) {
    if (singleFloorIndex !== undefined && singleFloorIndex !== floorIndex) {
      elevation += building.floors[floorIndex].height
      continue
    }
    const floor = building.floors[floorIndex]
    const floorVertexIdToIndex = {} as Record<string, number>
    const floorEdgeIdToIndex = {} as Record<string, number>

    const graph = floor.graph
    const spaces = floor.spaces
    if (prevFloor && sameGraphAsPrev(graph, prevFloor.graph)) {
      const { spaceMap } = getFloorGraphMap(graph, prevFloor.graph, spaces, prevFloor.spaces)
      for (const currentFloorSpaceId of Object.keys(spaceMap)) {
        const baseFloorSpaceId = spaceMap[currentFloorSpaceId]
        spaceIdToLoopIndexes[floor.id + "#" + currentFloorSpaceId] =
          spaceIdToLoopIndexes[prevFloor.id + "#" + baseFloorSpaceId]
      }
      elevation += floor.height
      continue
    }
    for (const vertex of Object.values(graph.vertices)) {
      const vec = new Vector3(vertex.x, vertex.y, elevation).applyMatrix4(worldTransform)
      shapeVertices.push(vec)
      floorVertexIdToIndex[vertex.id] = shapeVertices.length - 1
      vertexIds.push(vertex.id)
    }

    const verticesToEdgeMap: Record<string, number> = {}
    for (const edge of Object.values(graph.edges)) {
      const shapeEdge: [number, number] = [vertexIds.indexOf(edge.start), vertexIds.indexOf(edge.end)]
      shapeEdges.push(shapeEdge)
      const edgeIndex = shapeEdges.length - 1
      floorEdgeIdToIndex[edge.id] = edgeIndex
      verticesToEdgeMap[edge.start + "#" + edge.end] = edgeIndex
      verticesToEdgeMap[edge.end + "#" + edge.start] = edgeIndex
    }

    for (const space of Object.values(floor.spaces)) {
      const n = loops.length
      const m = space.holes.length
      loops.push(
        space.polygon
          .map((p, i, l) => {
            const next = l[(i + 1) % l.length]
            const edgeIndex = verticesToEdgeMap[p + "#" + next]
            if (next === p) return undefined
            if (edgeIndex === undefined) throw new Error("edge not found")
            return edgeIndex
          })
          .filter(isDefined),
      )
      const holeLoopIndexes: number[] = []

      for (let j = 0; j < m; j++) {
        const hole = space.holes[j]
        const loop = hole
          .map((p, i, l) => {
            const next = l[(i + 1) % l.length]
            const edgeIndex = verticesToEdgeMap[p + "#" + next]
            if (next === p) return undefined
            if (edgeIndex === undefined) throw new Error("edge not found")
            return edgeIndex
          })
          .filter(isDefined)
        loops.push(loop)
        holeLoopIndexes.push(n + j + 1)
      }
      spaceIdToLoopIndexes[floor.id + "#" + space.id] = { polygon: n, holes: holeLoopIndexes }
    }

    elevation += floor.height
    prevFloor = floor
  }
  const initShape: Shape = { vertices: shapeVertices, edges: shapeEdges, loops: loops }
  const numberOfLoops = loops.length
  return { initShape, spaceIdToLoopIndexes, numberOfLoops }
}

function getUpdateBuildingOnShapeUpdate(
  building: BasicBuilding,
  shape: Shape,
  worldTransform: Matrix4,
  spaceIdToLoopIndexes: SpaceIdToLoopIndexes,
  singleFloorIndex?: number,
): BasicBuilding | undefined {
  const inverseTransform = worldTransform.clone().invert()
  const transformedVertices = shape.vertices.map((vertex) => {
    if (vertex === undefined) return undefined
    return vertex.clone().applyMatrix4(inverseTransform)
  })

  const updatedFloors: Floor[] = []

  const vertexIds = shape.vertices.map(() => randomId())
  const edgeIds = shape.edges.map(() => randomId())

  for (let floorIndex = 0; floorIndex < building.floors.length; floorIndex++) {
    if (singleFloorIndex !== undefined && singleFloorIndex !== floorIndex) {
      updatedFloors.push(building.floors[floorIndex])
      continue
    }
    const oldFloor = building.floors[floorIndex]

    const madeVertices: Record<number, string> = {}
    const madeEdges: Record<number, boolean> = {}

    const updatedVertices: Vertices = {}
    const updatedEdges: Edges = {}
    const updatedSpaces: Spaces = {}

    for (const space of Object.values(oldFloor.spaces)) {
      const loops = spaceIdToLoopIndexes[oldFloor.id + "#" + space.id]
      const polygonLoop = shape.loops[loops.polygon]
      const holeLoops = loops.holes.map((index) => shape.loops[index]).filter(isDefined)
      if (polygonLoop === undefined) return

      const polygon: string[] = []
      for (let i = 0; i < polygonLoop.length; i++) {
        const edgeIndex = polygonLoop[i]
        const indexEdge = shape.edges[edgeIndex]
        const [startVertexIndex, endVertexIndex] = indexEdge
        if (!madeVertices[startVertexIndex]) {
          const id = vertexIds[startVertexIndex]
          const vertex3D = transformedVertices[startVertexIndex]
          if (vertex3D === undefined) return
          const vertex = { id, x: vertex3D.x, y: vertex3D.y }
          madeVertices[startVertexIndex] = vertex.id
          updatedVertices[vertex.id] = vertex
        }
        if (!madeVertices[endVertexIndex]) {
          const id = vertexIds[endVertexIndex]
          const vertex3D = transformedVertices[endVertexIndex]
          if (vertex3D === undefined) return
          const vertex = { id, x: vertex3D.x, y: vertex3D.y }
          madeVertices[endVertexIndex] = vertex.id
          updatedVertices[vertex.id] = vertex
        }
        if (!madeEdges[edgeIndex]) {
          madeEdges[edgeIndex] = true
          const id = edgeIds[edgeIndex]
          const edge = { id, start: madeVertices[startVertexIndex], end: madeVertices[endVertexIndex] }
          updatedEdges[edge.id] = edge
        }
        const startVertex = updatedVertices[madeVertices[startVertexIndex]]
        const endVertex = updatedVertices[madeVertices[endVertexIndex]]

        const nextEdgeIndex = polygonLoop[(i + 1) % polygonLoop.length]
        const nextIndexEdge = shape.edges[nextEdgeIndex]

        if (nextIndexEdge.includes(startVertexIndex)) {
          polygon.push(endVertex.id)
        } else {
          polygon.push(startVertex.id)
        }
      }

      const holes: string[][] = []
      for (const holeLoop of holeLoops) {
        const hole: string[] = []
        for (let i = 0; i < holeLoop.length; i++) {
          const edgeIndex = holeLoop[i]
          const indexEdge = shape.edges[edgeIndex]
          const [startVertexIndex, endVertexIndex] = indexEdge
          if (!madeVertices[startVertexIndex]) {
            const id = vertexIds[startVertexIndex]
            const vertex3D = transformedVertices[indexEdge[0]]
            if (vertex3D === undefined) return
            const vertex = { id, x: vertex3D.x, y: vertex3D.y }
            madeVertices[startVertexIndex] = vertex.id
            updatedVertices[vertex.id] = vertex
          }
          if (!madeVertices[endVertexIndex]) {
            const id = vertexIds[endVertexIndex]
            const vertex3D = transformedVertices[endVertexIndex]
            if (vertex3D === undefined) return
            const vertex = { id, x: vertex3D.x, y: vertex3D.y }
            madeVertices[endVertexIndex] = vertex.id
            updatedVertices[vertex.id] = vertex
          }
          if (!madeEdges[edgeIndex]) {
            const id = edgeIds[edgeIndex]
            const edge = { id, start: madeVertices[startVertexIndex], end: madeVertices[endVertexIndex] }
            updatedEdges[edge.id] = edge
          }
          const startVertex = updatedVertices[madeVertices[startVertexIndex]]
          const endVertex = updatedVertices[madeVertices[endVertexIndex]]

          const nextEdgeIndex = holeLoop[(i + 1) % holeLoop.length]
          const nextIndexEdge = shape.edges[nextEdgeIndex]
          if (nextIndexEdge.includes(startVertexIndex)) {
            hole.push(endVertex.id)
          } else {
            hole.push(startVertex.id)
          }
        }
        holes.push(hole)
      }

      updatedSpaces[space.id] = { ...space, polygon, holes }
    }

    const updatedGraph = { edges: updatedEdges, vertices: updatedVertices }
    const updatedFloor: Floor = { ...oldFloor, spaces: updatedSpaces, graph: updatedGraph }
    updatedFloors.push(updatedFloor)
  }
  return { ...building, floors: updatedFloors }
}

function pointOnLineShapeToolLoopTest(polygon: Polygon) {
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const point = polygon[i]
    const pointXY: PointXY = { x: point[0], y: point[1] }
    for (let j = 0; j < n; j++) {
      const edgeStart = polygon[j]
      const edgeEnd = polygon[(j + 1) % n]
      const lineXY: LineXY = [edgeStart, edgeEnd].map(([x, y]) => ({ x, y })) as LineXY
      const pointOnLine = isPointOnLine(pointXY, lineXY, 1e-2)
      if (pointOnLine) return true
    }
  }
  return false
}

function testForVertexDuplication(transformedVertices: any) {
  const n = transformedVertices.length
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const v0 = transformedVertices[i]
      const v1 = transformedVertices[j]
      if (v0 === undefined || v1 === undefined) continue
      if (v0.x === v1.x && v0.y === v1.y && v0.z === v1.z) {
        return true
      }
    }
  }
  return false
}

function isShapeValid(
  shape: Shape,
  numberOfLoops: number,
  building: BasicBuilding,
  spaceIdToLoopIndexes: SpaceIdToLoopIndexes,
  singleFloorIndex?: number,
): boolean {
  if (shape.loops.length !== numberOfLoops) return false
  if (testForVertexDuplication(shape.vertices)) return false

  for (let floorIndex = 0; floorIndex < building.floors.length; floorIndex++) {
    if (singleFloorIndex !== undefined && singleFloorIndex !== floorIndex) {
      continue
    }
    const oldFloor = building.floors[floorIndex]

    const polygonsWithHoles: PolygonWithHoles[] = []
    for (const space of Object.values(oldFloor.spaces)) {
      const loops = spaceIdToLoopIndexes[oldFloor.id + "#" + space.id]
      const polygonLoop = shape.loops[loops.polygon]
      const holeLoops = loops.holes.map((index) => shape.loops[index]).filter(isDefined)
      if (polygonLoop === undefined) return false

      const polygon: Polygon = []

      for (let i = 0; i < polygonLoop.length; i++) {
        const edgeIndex = polygonLoop[i]
        const indexEdge = shape.edges[edgeIndex]
        const [startVertexIndex, endVertexIndex] = indexEdge
        const startVertex = shape.vertices[startVertexIndex]
        const endVertex = shape.vertices[endVertexIndex]

        const nextEdgeIndex = polygonLoop[(i + 1) % polygonLoop.length]
        const nextIndexEdge = shape.edges[nextEdgeIndex]

        if (nextIndexEdge.includes(startVertexIndex)) {
          polygon.push([endVertex.x, endVertex.y])
        } else {
          polygon.push([startVertex.x, startVertex.y])
        }
      }
      const loopArea = areaOfPolygon(polygonToXY(polygon))
      if (loopArea < 1e-2) return false

      if (pointOnLineShapeToolLoopTest(polygon)) {
        return false
      }

      const holes: Polygon[] = []
      for (const holeLoop of holeLoops) {
        const hole: Polygon = []
        for (let i = 0; i < holeLoop.length; i++) {
          const edgeIndex = holeLoop[i]
          const indexEdge = shape.edges[edgeIndex]
          const [startVertexIndex, endVertexIndex] = indexEdge
          const startVertex = shape.vertices[startVertexIndex]
          const endVertex = shape.vertices[endVertexIndex]

          const nextEdgeIndex = holeLoop[(i + 1) % holeLoop.length]
          const nextIndexEdge = shape.edges[nextEdgeIndex]

          if (nextIndexEdge.includes(startVertexIndex)) {
            hole.push([endVertex.x, endVertex.y])
          } else {
            hole.push([startVertex.x, startVertex.y])
          }
        }
        holes.push(hole)
      }
      const polygonWithHoles: PolygonWithHoles = { polygon, holes }
      polygonsWithHoles.push(polygonWithHoles)
    }

    for (let i = 0; i < polygonsWithHoles.length; i++) {
      for (let j = i + 1; j < polygonsWithHoles.length; j++) {
        const polyOne = polygonWithHolesToXY(polygonsWithHoles[i])
        const polyTwo = polygonWithHolesToXY(polygonsWithHoles[j])
        const area = getIntersectionAreaOfPolygonsWithHoles(polyOne, polyTwo)
        if (area > 1e-8) return false
      }
    }
    for (const polygonWithHoles of polygonsWithHoles) {
      const polygon = polygonWithHoles.polygon.map(([x, y]) => {
        return new Vector3(x, y, 0)
      })
      if (isSelfIntersecting(polygon)) return false
      if (isPolygonClockwise(polygon)) return false
      for (const hole of polygonWithHoles.holes) {
        const holeVec = hole.map(([x, y]) => {
          return new Vector3(x, y, 0)
        })
        if (isSelfIntersecting(holeVec)) return false
        if (!isPolygonClockwise(holeVec)) return false
      }
      if (!validateRelationsBetweenHolesAndExterior(polygonWithHoles)) return false
    }
  }
  return true
}

const SHAPE_TOOL_CONFIG = {
  toolMode: CreateToolMode.Edit,
  moveModes: [ShapeToolMoveMode.HORIZONTAL],
  onTerrain: false,
  useContextualLines: true,
  linkVerticesVertically: true,
  requireAlwaysValid: false,
  snapToExternalShape: true,
}

const EditBasicBuildingInner = ({
  path,
  element,
  worldTransform,
}: {
  path: InternalPath
  element: BasicBuildingElement
  worldTransform: Matrix4
}) => {
  useHideAndFade(path)
  const actionAPI = useActionAPI()

  const { initShape, spaceIdToLoopIndexes, numberOfLoops } = useMemo(() => {
    return makeInitShapeAndLoopsMap(element.representations.__INTERNAL__.data, worldTransform)
  }, [element, worldTransform])

  const [liveBuilding, setLiveBuilding] = useState(() => {
    return element.representations.__INTERNAL__.data
  })

  const onComplete = useCallback(
    (building: BasicBuilding) => {
      BasicBuildingAPI.actions.executeUpdate("Update new basic building", path, element, building, actionAPI)
      exitCurrentTool()
    },
    [actionAPI, element, path],
  )

  const onCompleteShape = useCallback(
    (shape: Shape) => {
      if (shape.loops.length !== numberOfLoops) return false
      const updatedBuilding = getUpdateBuildingOnShapeUpdate(
        element.representations.__INTERNAL__.data,
        shape,
        worldTransform,
        spaceIdToLoopIndexes,
      )
      if (updatedBuilding === undefined) return
      onComplete(updatedBuilding)
    },
    [element.representations.__INTERNAL__.data, numberOfLoops, onComplete, spaceIdToLoopIndexes, worldTransform],
  )

  const onPreviewChange = useCallback(
    (shape: Shape) => {
      const valid = isShapeValid(shape, numberOfLoops, element.representations.__INTERNAL__.data, spaceIdToLoopIndexes)
      if (!valid) return
      const updatedBuilding = getUpdateBuildingOnShapeUpdate(
        element.representations.__INTERNAL__.data,
        shape,
        worldTransform,
        spaceIdToLoopIndexes,
      )
      if (updatedBuilding === undefined) return
      setLiveBuilding(updatedBuilding)
      return
    },
    [element.representations.__INTERNAL__.data, numberOfLoops, spaceIdToLoopIndexes, worldTransform],
  )

  const onCancel = useCallback(() => {
    if (liveBuilding) {
      return onComplete(liveBuilding)
    }
    exitCurrentTool()
  }, [liveBuilding, onComplete])

  const isValid = useCallback(
    (shape: Shape) => {
      return isShapeValid(shape, numberOfLoops, element.representations.__INTERNAL__.data, spaceIdToLoopIndexes)
    },
    [element.representations.__INTERNAL__.data, numberOfLoops, spaceIdToLoopIndexes],
  )

  return (
    <>
      <ShapeTool
        initialShape={initShape}
        onPreviewChange={onPreviewChange}
        onComplete={onCompleteShape}
        isValid={isValid}
        onCancel={onCancel}
        config={SHAPE_TOOL_CONFIG}
      />
      <Preview building={liveBuilding} worldMatrix={worldTransform} />
    </>
  )
}

export const EditBasicBuilding = ({ path }: { path: InternalPath }) => {
  const snapshot = elementState.currentSnapshot.value

  const node = snapshot.getNodeOrThrow(path)
  const element = node.element
  const worldTransform = node.globalMatrix

  useErrorBoundary((error, errorInfo) => {
    console.error("Edit new basic building error: ", error)
    console.warn(errorInfo)
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.building.failedToEdit), status: "warning" })
    captureException(error, { tags: { owner: "building-systems" }, extra: { errorInfo } })
    exitCurrentTool()
  })

  const basicBuildingElement = element as BasicBuildingElement
  return (
    <>
      <EditBasicBuildingInner path={path} element={basicBuildingElement} worldTransform={worldTransform} />
    </>
  )
}

//////
// Single floor edit
///

function makeSnappingLinesOfBuilding(building: BasicBuilding, worldTransform: Matrix4, singleFloorIndex: number) {
  const snappingLines: SnappingLine[] = []

  let elevation = 0
  for (let floorIndex = 0; floorIndex < building.floors.length; floorIndex++) {
    if (singleFloorIndex === floorIndex) continue
    const floor = building.floors[floorIndex]
    const elevationLevels = [elevation, elevation + floor.height]
    for (const elevationLevel of elevationLevels) {
      for (const edge of Object.values(floor.graph.edges)) {
        const startVertex = floor.graph.vertices[edge.start]
        const endVertex = floor.graph.vertices[edge.end]

        const startVec = new Vector3(startVertex.x, startVertex.y, elevationLevel).applyMatrix4(worldTransform)
        const endVec = new Vector3(endVertex.x, endVertex.y, elevationLevel).applyMatrix4(worldTransform)
        const centerVec = new Vector3(
          0.5 * (startVec.x + endVec.x),
          0.5 * (startVec.y + endVec.y),
          0.5 * (startVec.z + endVec.z),
        )
        const bbox = bboxFromEndpoints(
          startVec,
          endVec,
          pixelsToMetersAtPosition(SNAPPING_SENSITIVITY, sceneManager.camera, startVec),
        )
        const segments = [{ start: startVec, end: endVec, bbox }]
        const snappingLine: any = {
          type: "LINE",
          start: startVec,
          end: endVec,
          center: centerVec,
          segments: segments,
          onTerrain: false,
          shapeId: floor.id + ":" + edge.id,
        }
        snappingLines.push(snappingLine)
      }
    }

    elevation += floor.height
  }
  return snappingLines
}

const EditBasicFloorInner = ({
  buildingPath,
  floorPath,
  element,
  worldTransform,
  floorIndex,
}: {
  floorIndex: number
  floorPath: InternalPath
  buildingPath: InternalPath
  element: BasicBuildingElement
  worldTransform: Matrix4
}) => {
  const actionAPI = useActionAPI()

  useHideAndFade(buildingPath)
  useHideAndFade(floorPath)

  const { initShape, spaceIdToLoopIndexes, numberOfLoops } = useMemo(() => {
    return makeInitShapeAndLoopsMap(element.representations.__INTERNAL__.data, worldTransform, floorIndex)
  }, [element.representations.__INTERNAL__.data, floorIndex, worldTransform])

  const snappingLines: SnappingLine[] = useMemo(() => {
    return makeSnappingLinesOfBuilding(element.representations.__INTERNAL__.data, worldTransform, floorIndex)
  }, [element.representations.__INTERNAL__.data, floorIndex, worldTransform])

  const originalBuilding = element.representations.__INTERNAL__.data

  const [liveBuilding, setLiveBuilding] = useState(originalBuilding)

  const onComplete = useCallback(
    (building: BasicBuilding) => {
      BasicBuildingAPI.actions.executeUpdate(
        "Update new basic building on floor edit",
        buildingPath,
        element,
        building,
        actionAPI,
      )
      exitCurrentTool()
    },
    [actionAPI, buildingPath, element],
  )

  const onCompleteShape = useCallback(
    (shape: Shape) => {
      if (shape.loops.length !== numberOfLoops) return false
      const updatedBuilding = getUpdateBuildingOnShapeUpdate(
        element.representations.__INTERNAL__.data,
        shape,
        worldTransform,
        spaceIdToLoopIndexes,
        floorIndex,
      )
      if (updatedBuilding === undefined) return
      onComplete(updatedBuilding)
    },
    [
      element.representations.__INTERNAL__.data,
      floorIndex,
      numberOfLoops,
      onComplete,
      spaceIdToLoopIndexes,
      worldTransform,
    ],
  )

  const onPreview = useCallback(
    (shape: Shape) => {
      if (
        !isShapeValid(shape, numberOfLoops, element.representations.__INTERNAL__.data, spaceIdToLoopIndexes, floorIndex)
      )
        return
      const updatedBuilding = getUpdateBuildingOnShapeUpdate(
        element.representations.__INTERNAL__.data,
        shape,
        worldTransform,
        spaceIdToLoopIndexes,
        floorIndex,
      )
      if (updatedBuilding === undefined) return
      setLiveBuilding(updatedBuilding)
    },
    [element.representations.__INTERNAL__.data, floorIndex, numberOfLoops, spaceIdToLoopIndexes, worldTransform],
  )

  const onCancel = useCallback(() => {
    if (liveBuilding) {
      onComplete(liveBuilding)
    }
    exitCurrentTool()
  }, [liveBuilding, onComplete])

  const isValid = useCallback(
    (shape: Shape) => {
      return isShapeValid(
        shape,
        numberOfLoops,
        element.representations.__INTERNAL__.data,
        spaceIdToLoopIndexes,
        floorIndex,
      )
    },
    [element.representations.__INTERNAL__.data, floorIndex, numberOfLoops, spaceIdToLoopIndexes],
  )

  return (
    <>
      <ShapeTool
        initialShape={initShape}
        onPreviewChange={onPreview}
        onComplete={onCompleteShape}
        onCancel={onCancel}
        isValid={isValid}
        config={SHAPE_TOOL_CONFIG}
        additionalSnappingLines={snappingLines}
      />
      <Preview building={liveBuilding} worldMatrix={worldTransform} />
    </>
  )
}

export const EditBasicFloor = ({ path }: { path: InternalPath }) => {
  const snapshot = elementState.currentSnapshot.value

  const floorElementNode = snapshot.getNodeOrThrow(path)
  const parentPath = getParentPath(path)!
  const buildingElementNode = snapshot.getNodeOrThrow(parentPath)
  const worldTransform = buildingElementNode.globalMatrix

  useErrorBoundary((error, errorInfo) => {
    console.error("Edit new basic building error: ", error)
    console.warn(errorInfo)
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.building.failedToEdit), status: "warning" })
    captureException(error, { tags: { owner: "building-systems" }, extra: { errorInfo } })
    exitCurrentTool()
  })

  const { floorIndex } = BasicBuildingAPI.deconstructFloorId(parseUrn(floorElementNode.urn).id)

  const basicBuildingElement = buildingElementNode.element as BasicBuildingElement
  return (
    <>
      <EditBasicFloorInner
        floorPath={path}
        floorIndex={floorIndex}
        buildingPath={parentPath}
        element={basicBuildingElement}
        worldTransform={worldTransform}
      />
    </>
  )
}
