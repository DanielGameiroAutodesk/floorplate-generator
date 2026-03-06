import { AlwaysDepth, Box2, Color, Group, Matrix3, Vector2, Vector3 } from "three"
import { useCallback } from "preact/hooks"
import { LineSegments2, LineSegmentsGeometry } from "three/examples/jsm/Addons.js"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"
import { useSignal, useSignalEffect } from "@preact/signals"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

import { mousePosition } from "src/core/useMousePosition"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import sceneManager, { screenResolutionVector } from "src/core/three/sceneManager"
import { colors } from "src/lib/colors"
import { dispose } from "src/core/three/useObjectLifecycle"
import { useReadonlySignal } from "src/lib/signal"
import ArrayUtils from "src/lib/array"
import { Analytics } from "src/core/analytics"
import { sampleSegment2d } from "src/lib/geometry/sampleSegment2d"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"
import { getGraphCutToBuildingLimits } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellGraphIntersection"
import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"
import { ITERATIVE_EXPLORE_FEATURE_NAME } from "src/integrations/building-systems-site-study/iterative/constants"

import type { Polygon, SimpleGraph } from "./types"
import { createAxisAlignedGridInBox2, type GridParams, transformGraph } from "./grid"

export class GridPosition {
  private constructor(
    readonly origin: { x: number; y: number },
    readonly angle: number,
    readonly dx: number,
    readonly dy?: number,
  ) {}

  static fromParameters(parameters: GridParams): GridPosition {
    return new GridPosition(parameters.origin, parameters.angle, parameters.dx, parameters.dy)
  }

  toParameters(): GridParams {
    return {
      origin: this.origin,
      angle: this.angle,
      dx: this.dx,
      dy: this.dy,
    }
  }

  withOrigin(origin: GridParams["origin"]): GridPosition {
    return new GridPosition(origin, this.angle, this.dx, this.dy)
  }

  withAngle(angle: GridParams["angle"]): GridPosition {
    return new GridPosition(this.origin, angle, this.dx, this.dy)
  }

  withDirectionPoint(point: { x: number; y: number }) {
    const originVec = new Vector2(this.origin.x, this.origin.y)
    const secondVec = new Vector2(point.x, point.y)
    const diff = secondVec.sub(originVec)
    const angle = Math.atan2(diff.y, diff.x)
    return new GridPosition(this.origin, angle, this.dx, this.dy)
  }
}

const axisMaterial = new LineMaterial({
  color: new Color("#E30288").getHex(),
  linewidth: 1,
  depthFunc: AlwaysDepth,
  resolution: screenResolutionVector,
})

const gridMaterial = new LineMaterial({
  color: new Color(colors.black).getHex(),
  linewidth: 1,
  dashed: true,
  dashScale: 0.5,
  depthFunc: AlwaysDepth,
  resolution: screenResolutionVector,
})

const outerPolygonMaterial = new LineMaterial({
  color: new Color("#85FDDD").getHex(),
  linewidth: 2,
  depthFunc: AlwaysDepth,
  resolution: screenResolutionVector,
})

const CROSS_HAIR_SIZE = 300

class GridPositionVisual extends Group {
  axis: LineSegments2
  grid: LineSegments2
  handle: VertexHandle

  constructor(gridPosition: GridPosition, polygons: Polygon[]) {
    super()

    this.axis = this.getAxis(gridPosition)
    this.grid = this.getFullGrid(gridPosition, polygons)
    this.handle = this.getVertexHandle(gridPosition)

    this.add(this.axis)
    this.add(this.grid)
    this.add(this.handle)
  }

  private getAxis(gridPosition: GridPosition) {
    const dir = new Vector2(Math.cos(gridPosition.angle), Math.sin(gridPosition.angle))
    const dirOrtho = new Vector2(dir.y, -dir.x)

    const posOrigin = new Vector2(gridPosition.origin.x, gridPosition.origin.y)
    const posXPos = posOrigin.clone().add(dir.clone().setLength(CROSS_HAIR_SIZE))
    const posXNeg = posOrigin.clone().sub(dir.clone().setLength(CROSS_HAIR_SIZE))
    const posYPos = posOrigin.clone().add(dirOrtho.clone().setLength(CROSS_HAIR_SIZE))
    const posYNeg = posOrigin.clone().sub(dirOrtho.clone().setLength(CROSS_HAIR_SIZE))

    const positions = [
      [posOrigin, posXPos],
      [posOrigin, posXNeg],
      [posOrigin, posYPos],
      [posOrigin, posYNeg],
    ].flatMap(([from, to]) => sampleSegment2d(from, to))

    const positions3d = positions.flat().map((pos2d) => {
      const elevation = terrainSignal.peek().elevationAt(pos2d.x, pos2d.y)
      return new Vector3(pos2d.x, pos2d.y, elevation)
    })

    const geo = new LineSegmentsGeometry().setPositions(positions3d.flatMap((p) => p.toArray()))
    const axis = new LineSegments2(geo, axisMaterial)
    axis.computeLineDistances()
    return axis
  }

  private getVertexHandle(gridPosition: GridPosition): VertexHandle {
    const { x, y } = gridPosition.origin
    return new VertexHandle(new Vector3(x, y, terrainSignal.peek().elevationAt(x, y)))
  }

  private getFullGrid(gridPosition: GridPosition, polygons: Polygon[]): LineSegments2 {
    const matrix = new Matrix3()
      .premultiply(new Matrix3().makeTranslation(-gridPosition.origin.x, -gridPosition.origin.y))
      .premultiply(new Matrix3().makeRotation(-gridPosition.angle))

    const matrixInverse = matrix.clone().invert()

    const box = polygons
      .flat()
      .reduce<Box2>(
        (prev, [x, y]) => prev.expandByPoint(new Vector2(x, y).applyMatrix3(matrix)),
        new Box2(new Vector2(Infinity, Infinity), new Vector2(-Infinity, -Infinity)),
      )

    const tGraph = createAxisAlignedGridInBox2(box, gridPosition.dx, gridPosition.dy, true)

    const globalGraph = transformGraph(tGraph, matrixInverse)
    const graph = getGraphCutToBuildingLimits(globalGraph, polygons) as SimpleGraph

    const positions = Object.values(graph.edges)
      .flatMap(({ start, end }) => {
        const from = graph.vertices[start]
        const to = graph.vertices[end]
        return sampleSegment2d(new Vector2(from.x, from.y), new Vector2(to.x, to.y))
      })
      .flat()
      .map((vec2) => new Vector3(vec2.x, vec2.y, terrainSignal.peek().elevationAt(vec2.x, vec2.y)))
      .flatMap((v) => v.toArray())

    const geo = new LineSegmentsGeometry().setPositions(positions)

    geo.computeBoundingSphere()
    geo.computeBoundingBox()
    const mesh = new LineSegments2(geo, gridMaterial)
    mesh.computeLineDistances()
    return mesh
  }
}

function getPosition() {
  const snappedPosition = snappingAPIStateful.snap(mousePosition)

  const intersections = mousePosition.intersectObject(terrainSignal.peek().mesh)
  if (snappedPosition) {
    snappingAPIStateful.setSnapInfo(snappedPosition)
    return snappedPosition.position
  } else if (intersections.length > 0) {
    snappingAPIStateful.clearSnapInfo()
    return intersections[0].point
  } else {
    snappingAPIStateful.clearSnapInfo()
    return undefined
  }
}

export function SetGridTool({
  parameters,
  polygons,
  onExit,
  onComplete,
}: {
  parameters: GridParams
  polygons: Polygon[]
  onExit: () => void
  onComplete: (parameters: GridParams) => void
}) {
  const parameterSignal = useSignal<GridPosition>(GridPosition.fromParameters(parameters))
  const stateSignal = useSignal<"first-point" | "second-point">("first-point")
  const polygonsSignal = useReadonlySignal(polygons)

  useSignalEffect(() => {
    const positions = polygonsSignal.value
      .flatMap((polygon) =>
        ArrayUtils.sliding2(polygon)
          .map(([from, to]) => sampleSegment2d(new Vector2(from[0], from[1]), new Vector2(to[0], to[1])))
          .flat(2)
          .map((vec2) => new Vector3(vec2.x, vec2.y, terrainSignal.peek().elevationAt(vec2.x, vec2.y))),
      )
      .flatMap((vec3) => vec3.toArray())

    const geo = new LineSegmentsGeometry().setPositions(positions)
    const mesh = new LineSegments2(geo, outerPolygonMaterial)
    sceneManager.scene.add(mesh)
    sceneManager.render()
    return () => {
      sceneManager.scene.remove(mesh)
      dispose(mesh)
    }
  })

  useSignalEffect(() => {
    const visual = new GridPositionVisual(parameterSignal.value, polygonsSignal.value)
    sceneManager.scene.add(visual)
    sceneManager.render(false, true)

    return () => {
      sceneManager.scene.remove(visual)
      dispose(visual)
      sceneManager.render(false, true)
    }
  })

  const mouseup = useCallback(() => {
    const position = getPosition()
    if (!position) return Propagate.YES
    switch (stateSignal.peek()) {
      case "first-point":
        parameterSignal.value = parameterSignal.peek().withOrigin({ x: position.x, y: position.y })
        stateSignal.value = "second-point"
        break
      case "second-point":
        Analytics.track(EventName.Edit, {
          feature_category: FeatureCategory.DesignTool,
          feature: ITERATIVE_EXPLORE_FEATURE_NAME,
          sub_feature: "grid_position",
          object_type: "element",
        })
        onComplete(parameterSignal.peek().withDirectionPoint({ x: position.x, y: position.y }).toParameters())
        break
    }

    return Propagate.NO
  }, [onComplete, parameterSignal, stateSignal])

  const mousemove = useCallback(() => {
    const position = getPosition()
    if (!position) return Propagate.YES
    switch (stateSignal.peek()) {
      case "first-point":
        parameterSignal.value = parameterSignal.peek().withOrigin({ x: position.x, y: position.y })
        break
      case "second-point":
        parameterSignal.value = parameterSignal.peek().withDirectionPoint({ x: position.x, y: position.y })
        break
    }
    return Propagate.NO
  }, [parameterSignal, stateSignal])

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        Analytics.track(EventName.Close, {
          feature_category: FeatureCategory.DesignTool,
          feature: ITERATIVE_EXPLORE_FEATURE_NAME,
          sub_feature: "grid_position",
        })
        onExit()
        return Propagate.NO
      }
      return Propagate.YES
    },
    [onExit],
  )

  useEventHandler("mouseup", mouseup, Priority.TOOL, sceneManager.canvas)
  useEventHandler("mousemove", mousemove, Priority.TOOL, sceneManager.canvas)
  useEventHandler("keydown", keydown, Priority.TOOL)

  return <snappingAPIStateful.visualsComponent />
}
