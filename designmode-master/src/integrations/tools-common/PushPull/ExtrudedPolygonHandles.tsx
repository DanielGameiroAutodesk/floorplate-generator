import polylabel from "polylabel"
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks"
import { useRecoilState } from "recoil"
import type { Matrix4 } from "three"
import { Group, Vector2, Vector3 } from "three"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import PushPullHeight from "./PushPullHeight"
import { pushPullAtom, usePushPullSurfaces as usePushPullHandles, usePushPullSurfaces } from "./PushPull"
import SurfaceHandle from "./SurfaceHandle"
import { PushPullWalls } from "./PushPullWalls"
import type { Properties } from "@spacemakerai/element-types"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import { at } from "src/lib/array-at"

export function getRoofHandlePosition(feature: ExtrudedPolygonFeature, transform?: Matrix4) {
  const footprint = feature.geometry.coordinates
  const { elevation, height } = feature.properties
  const [x, y] = polylabel(footprint)

  const position = new Vector3(x, y, elevation + height)
  if (transform) position.applyMatrix4(transform)
  return position
}

export function getWallHandlePosition(feature: ExtrudedPolygonFeature, index: number, transform?: Matrix4) {
  const footprint = feature.geometry.coordinates[0]
  const { elevation, height } = feature.properties
  const [v1, v2] = footprint.slice(index, index + 2)
  const midX = (v1[0] + v2[0]) / 2
  const midY = (v1[1] + v2[1]) / 2
  const position = new Vector3(midX, midY, elevation + height / 2)
  if (transform) position.applyMatrix4(transform)
  return position
}

const errorMargin = 0.01
const a1v1 = new Vector2()
const v1v2 = new Vector2()
const v2a2 = new Vector2()
function isWallParallelToAdjacent(vertices: number[][], wallIndex: number) {
  const a1 = at(vertices, wallIndex - 1)
  const v1 = at(vertices, wallIndex)
  const v2 = at(vertices, wallIndex + 1)
  const a2 = at(vertices, wallIndex + 2)

  a1v1.set(v1[0] - a1[0], v1[1] - a1[1]).normalize()
  v1v2.set(v2[0] - v1[0], v2[1] - v1[1]).normalize()
  v2a2.set(a2[0] - v2[0], a2[1] - v2[1]).normalize()

  return Math.abs(a1v1.dot(v1v2) - 1) < errorMargin || Math.abs(v1v2.dot(v2a2) - 1) < errorMargin
}

export const WallHandles = ({
  id,
  feature,
  worldTransform,
  onStart,
  onComplete,
  onCancel,
  elementProperties,
}: {
  id: string
  feature: ExtrudedPolygonFeature
  worldTransform: Matrix4
  onStart?: (id: string) => void
  onComplete: (id: string, feature: ExtrudedPolygonFeature) => void
  onCancel?: (id: string) => void
  elementProperties?: Properties
}) => {
  const [pushPullState, setPushPullState] = useRecoilState(pushPullAtom)
  const currentHandle = pushPullState?.path === id ? pushPullState?.surface : undefined
  const isActive = typeof currentHandle === "number"

  const hasStarted = useRef(false)
  useEffect(() => {
    if (isActive && !hasStarted.current) {
      onStart?.(id)
      hasStarted.current = true
    } else if (!isActive && hasStarted.current) {
      hasStarted.current = false
    }
  }, [isActive, id, onStart])

  const handles = useMemo(() => {
    let wallHandles: SurfaceHandle[] = []
    for (const footprint of feature.geometry.coordinates.slice(0, 1)) {
      const footprintOpen = footprint.slice(0, -1)
      for (let i = 0; i < footprintOpen.length; i++) {
        if (!isWallParallelToAdjacent(footprint, i)) {
          wallHandles.push(new SurfaceHandle(id, feature, i, worldTransform))
        }
      }
    }
    return wallHandles
  }, [feature, id, worldTransform])

  const handlesGroup = useMemo(() => {
    let group = new Group()
    group.name = "Push/Pull Handles"
    if (handles.length) {
      group.add(...handles)
    }
    return group
  }, [handles])

  useObjectLifecycle(handlesGroup)

  usePushPullHandles(handles)

  const handleCancel = useCallback(() => {
    setPushPullState(undefined)
    onCancel?.(id)
  }, [id, onCancel, setPushPullState])

  const handleComplete = useCallback(
    (feature: ExtrudedPolygonFeature) => {
      setPushPullState(undefined)
      onComplete(id, feature)
    },
    [id, onComplete, setPushPullState],
  )

  if (typeof currentHandle === "number") {
    return (
      <PushPullWalls
        feature={feature}
        worldTransform={worldTransform}
        onComplete={handleComplete}
        onCancel={handleCancel}
        wallIndex={currentHandle}
        elementProperties={elementProperties}
      />
    )
  }
  return null
}

export const RoofHandle = ({
  id,
  feature,
  worldTransform,
  onStart,
  onComplete,
  onCancel,
  stepSize,
  elementProperties,
  previewFunction,
}: {
  id: string
  feature: ExtrudedPolygonFeature
  worldTransform: Matrix4
  onStart?: (id: string) => void
  onComplete: (id: string, feature: ExtrudedPolygonFeature) => void
  onCancel?: (id: string) => void
  stepSize?: number
  elementProperties?: Properties
  previewFunction?: (zDiff: number) => void
}) => {
  const [pushPullState, setPushPullState] = useRecoilState(pushPullAtom)
  const currentHandle = pushPullState?.path === id ? pushPullState?.surface : undefined
  const isActive = currentHandle === "roof"

  const hasStarted = useRef(false)
  useEffect(() => {
    if (isActive && !hasStarted.current) {
      onStart?.(id)
      hasStarted.current = true
    } else if (!isActive && hasStarted.current) {
      hasStarted.current = false
    }
  }, [isActive, id, onStart])

  const roofHandle = useMemo(
    () => [new SurfaceHandle(id, feature, "roof", worldTransform)],
    [feature, id, worldTransform],
  )
  usePushPullSurfaces(roofHandle)
  useObjectLifecycle(roofHandle[0])

  const handleCancel = useCallback(() => {
    setPushPullState(undefined)
    onCancel?.(id)
  }, [id, onCancel, setPushPullState])

  const handleComplete = useCallback(
    (feature: ExtrudedPolygonFeature) => {
      setPushPullState(undefined)
      onComplete(id, feature)
    },
    [id, onComplete, setPushPullState],
  )

  if (currentHandle === "roof") {
    return (
      <PushPullHeight
        feature={feature}
        worldTransform={worldTransform}
        onComplete={handleComplete}
        onCancel={handleCancel}
        stepSize={stepSize}
        elementProperties={elementProperties}
        previewFunction={previewFunction}
      />
    )
  }

  return null
}
