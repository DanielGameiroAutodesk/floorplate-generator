import { useCallback, useMemo } from "preact/hooks"
import { Euler, Matrix4, Vector3 } from "three"
import { DashedLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DashedLineSegment"
import { LineSegmentTool } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import ArrayUtils from "src/lib/array"
import { getWallHandlePosition } from "./ExtrudedPolygonHandles"
import PushPullPreview from "./PushPullPreview"
import { ShapeUtils, SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON_WITH_HOLES } from "src/lib/three/Shape/shapeUtils"
import type { Properties } from "@spacemakerai/element-types"
import type { ExtrudedPolygonFeature, Segment } from "src/lib/geometry/geometryTypes"
import { at } from "src/lib/array-at"
import type { Shape } from "src/lib/three/Shape/types"

const v1 = new Vector3()
const v2 = new Vector3()
const getDiff = (l: Segment, guide: Vector3) => {
  v1.set(...l[0])
  v2.set(...l[1])
  const v1v2 = v2.clone().sub(v1)
  return v1v2.length() * (v1v2.dot(guide) >= 0 ? 1 : -1)
}

export function getWallNormal(feature: ExtrudedPolygonFeature, index: number, worldRotation: Matrix4) {
  const footprint = feature.geometry.coordinates[0]
  const [v1, v2] = footprint.slice(index, index + 2)
  const x = v1[0] - v2[0]
  const y = v1[1] - v2[1]
  const normal = new Vector3(x, y, 0).applyMatrix4(worldRotation).normalize()
  normal.applyEuler(new Euler(0, 0, 0.5 * Math.PI))
  return normal
}

function removeDuplicateVerticesFromSingleClosedPolygon(shape: Shape): Shape {
  const vertices = shape.vertices
  const newVertices = []
  const vertexIndexMap = new Map<string, number>()
  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i]
    const key = `${vertex.x.toFixed(4)}_${vertex.y.toFixed(4)}`
    const existingIndex = vertexIndexMap.get(key)
    if (existingIndex === undefined) {
      vertexIndexMap.set(key, newVertices.length)
      newVertices.push(vertex)
    }
  }
  const newEdges: [number, number][] = newVertices.map((_, i) => [i, (i + 1) % newVertices.length])
  return {
    ...shape,
    vertices: newVertices,
    edges: newEdges,
    loops: [newEdges.map((_, i) => i)],
  }
}

function findIntersectionDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  adx: number,
  ady: number,
  bdx: number,
  bdy: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const det = bdx * ady - bdy * adx
  const u = (dy * bdx - dx * bdy) / det
  const v = (dy * adx - dx * ady) / det
  if (u > 0 && v > 0) return u
}

export function pushPullWall(footPrint: Shape, wallIndex: number, wallNormal: Vector3, distanceAlongNormal: number) {
  const vertices = footPrint.vertices
  const a1 = at(vertices, wallIndex - 1)
  const v1 = at(vertices, wallIndex)
  const v2 = at(vertices, wallIndex + 1)
  const a2 = at(vertices, wallIndex + 2)

  const v1a1 = v1.clone().sub(a1).normalize()
  const v2a2 = v2.clone().sub(a2).normalize()

  const newVertices = vertices.map((v, i) => {
    if (i === wallIndex) {
      return v.clone().add(v1a1.clone().multiplyScalar(distanceAlongNormal * (1 / v1a1.dot(wallNormal))))
    } else if (i === (wallIndex + 1) % vertices.length) {
      return v.clone().add(v2a2.clone().multiplyScalar(distanceAlongNormal * (1 / v2a2.dot(wallNormal))))
    }
    return v
  })

  const newShape = removeDuplicateVerticesFromSingleClosedPolygon({
    ...footPrint,
    vertices: newVertices,
  } as Shape)

  return newShape
}

const identity = new Matrix4()

export const isValidWalls = (shape: Shape) => SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON_WITH_HOLES(shape)

export function PushPullWalls({
  feature,
  worldTransform,
  wallIndex,
  onComplete,
  onCancel,
  elementProperties,
}: {
  feature: ExtrudedPolygonFeature
  worldTransform: Matrix4
  wallIndex: number
  onComplete: (feature: ExtrudedPolygonFeature) => void
  onCancel: () => void
  elementProperties?: Properties
}) {
  const { elevation } = feature.properties
  const footPrint = useMemo(() => {
    const vertices = feature.geometry.coordinates[0]
      .slice(0, -1)
      .map(([x, y]) => new Vector3(x, y, elevation).applyMatrix4(worldTransform ?? identity))
    const edges = ArrayUtils.sliding2(vertices.map((_, i) => i)).concat([[vertices.length - 1, 0]])
    return {
      vertices,
      edges,
      loops: [edges.map((_, i) => i)],
      faces: [],
    } as Shape
  }, [elevation, feature.geometry.coordinates, worldTransform])

  const worldRotation = useMemo(() => {
    const rotation = new Matrix4()
    if (worldTransform) rotation.extractRotation(worldTransform)
    return rotation
  }, [worldTransform])

  const normal = useMemo(() => {
    return getWallNormal(feature, wallIndex, worldRotation)
  }, [feature, wallIndex, worldRotation])

  const normalInitialShape = useMemo(() => {
    const labelPosition = getWallHandlePosition(feature, wallIndex, worldTransform)
    return [labelPosition.toArray(), labelPosition.toArray()] as [[number, number, number], [number, number, number]]
  }, [feature, wallIndex, worldTransform])

  const commitPolygon = useCallback(
    (l: Segment) => {
      if (!normal) return
      const diff = getDiff(l, normal)
      const invertedWorlTransform = worldTransform.clone().invert()
      const newShape = pushPullWall(footPrint, wallIndex, normal, diff)
      if (!isValidWalls(newShape)) return
      newShape.vertices = newShape.vertices.map((v) => v.clone().applyMatrix4(invertedWorlTransform))
      const coordinates = ShapeUtils.coordinatesFromShape(newShape)

      const newGeoJson = {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates,
        },
      }
      onComplete(newGeoJson)
    },
    [normal, footPrint, wallIndex, feature, onComplete, worldTransform],
  )

  const pushPullPreviewRenderer = useMemo(() => {
    return function Preview({ lineSegment }: { lineSegment?: Segment }) {
      if (!lineSegment) return null
      const diff = getDiff(lineSegment, normal)
      return (
        <>
          <PushPullPreview
            distance={diff}
            feature={feature}
            transform={worldTransform}
            surface={wallIndex}
            elementProperties={elementProperties}
          />
          <DashedLineSegment lineSegment={lineSegment} />
        </>
      )
    }
  }, [feature, normal, wallIndex, worldTransform, elementProperties])

  const guide = useMemo(() => {
    const vertices = footPrint.vertices
    const a1 = at(vertices, wallIndex - 1)
    const v1 = at(vertices, wallIndex)
    const v2 = at(vertices, wallIndex + 1)
    const a2 = at(vertices, wallIndex + 2)

    const adjacent1 = v1.clone().sub(a1)
    const adjacent2 = v2.clone().sub(a2)
    let max = Math.min(
      Math.abs(adjacent1.dot(normal) < 0 ? adjacent1.dot(normal) : Infinity),
      Math.abs(adjacent2.dot(normal) < 0 ? adjacent2.dot(normal) : Infinity),
    )
    let min = Math.max(
      adjacent1.dot(normal) > 0 ? -adjacent1.dot(normal) : -Infinity,
      adjacent2.dot(normal) > 0 ? -adjacent2.dot(normal) : -Infinity,
    )
    if (vertices.length < 5) min += 0.1 // prevent creating completely flat geometry

    adjacent1.normalize()
    adjacent2.normalize()

    const intersectionDistance = findIntersectionDistance(
      v1.x,
      v1.y,
      v2.x,
      v2.y,
      adjacent1.x,
      adjacent1.y,
      adjacent2.x,
      adjacent2.y,
    )
    if (intersectionDistance) max = Math.min(max, intersectionDistance * adjacent1.dot(normal))

    return {
      direction: normal,
      max,
      min,
    }
  }, [footPrint.vertices, normal, wallIndex])

  return (
    <LineSegmentTool
      onCancel={onCancel}
      onComplete={commitPolygon}
      previewRenderers={pushPullPreviewRenderer}
      initialDefinition={normalInitialShape}
      guide={guide}
    />
  )
}
