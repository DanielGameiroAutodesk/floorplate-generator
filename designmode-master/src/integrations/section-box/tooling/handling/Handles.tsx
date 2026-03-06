import polylabel from "polylabel"
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks"
import { Matrix4 } from "three"
import { Group, Vector2, Vector3 } from "three"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import { at } from "src/lib/array-at"
import SurfaceHandle from "src/integrations/tools-common/PushPull/SurfaceHandle"
import { useAddHandles } from "./PushPull"
import { PushPullSides } from "./PushPullSides"
import PushPullHeight from "./PushPullHeight"
import { sectionBoxUpdateState, setSectionBoxUpdateState } from "src/integrations/section-box/state"
import { type SectionBox } from "src/integrations/section-box/tooling/sectionBox"

export function getTopHandlePosition(feature: ExtrudedPolygonFeature, transform?: Matrix4) {
  const footprint = feature.geometry.coordinates
  const { elevation, height } = feature.properties
  const [x, y] = polylabel(footprint)

  const position = new Vector3(x, y, elevation + height)
  if (transform) position.applyMatrix4(transform)
  return position
}

export function getSideHandlePosition(feature: ExtrudedPolygonFeature, index: number, transform?: Matrix4) {
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

export const SideHandles = ({
  sectionBox,
  onComplete,
  onCancel,
  previewSectionBox,
}: {
  sectionBox: SectionBox
  onComplete: (sectionBox: SectionBox) => void
  onCancel: () => void
  previewSectionBox: (sectionBox: SectionBox) => void
}) => {
  const sectionBoxUpdate = sectionBoxUpdateState.value
  const currentHandle = sectionBoxUpdate?.surface
  const isActive = typeof currentHandle === "number"

  const hasStarted = useRef(false)
  useEffect(() => {
    if (isActive && !hasStarted.current) {
      hasStarted.current = true
    } else if (!isActive && hasStarted.current) {
      hasStarted.current = false
    }
  }, [isActive])

  const handles = useMemo(() => {
    let surfaceHandles: SurfaceHandle[] = []
    for (const footprint of sectionBox.geometry.coordinates.slice(0, 1)) {
      const footprintOpen = footprint.slice(0, -1)
      for (let i = 0; i < footprintOpen.length; i++) {
        if (!isWallParallelToAdjacent(footprint, i)) {
          surfaceHandles.push(new SurfaceHandle("Section box", sectionBox, i, new Matrix4()))
        }
      }
    }
    return surfaceHandles
  }, [sectionBox])

  const handlesGroup = useMemo(() => {
    let group = new Group()
    group.name = "Push/Pull Handles"
    if (handles.length) {
      group.add(...handles)
    }
    return group
  }, [handles])

  useObjectLifecycle(handlesGroup)
  useAddHandles(handles)

  const handleCancel = useCallback(() => {
    setSectionBoxUpdateState(undefined)
    onCancel()
  }, [onCancel])

  const handleComplete = useCallback(
    (sectionBox: SectionBox) => {
      setSectionBoxUpdateState(undefined)
      onComplete(sectionBox)
    },
    [onComplete],
  )

  if (isActive) {
    return (
      <PushPullSides
        sectionBox={sectionBox}
        onComplete={handleComplete}
        onCancel={handleCancel}
        previewSectionBox={previewSectionBox}
        sideIndex={currentHandle}
      />
    )
  }
  return null
}

export const TopHandle = ({
  sectionBox,
  onComplete,
  onCancel,
  previewSectionBox,
}: {
  sectionBox: SectionBox
  onComplete: (sectionBox: SectionBox) => void
  onCancel: () => void
  previewSectionBox: (sectionBox: SectionBox) => void
}) => {
  const sectionBoxUpdate = sectionBoxUpdateState.value
  const currentHandle = sectionBoxUpdate?.surface
  const isActive = currentHandle === "roof"

  const hasStarted = useRef(false)
  useEffect(() => {
    if (isActive && !hasStarted.current) {
      hasStarted.current = true
    } else if (!isActive && hasStarted.current) {
      hasStarted.current = false
    }
  }, [isActive])

  const roofHandle = useMemo(() => [new SurfaceHandle("Section box", sectionBox, "roof", new Matrix4())], [sectionBox])
  useAddHandles(roofHandle)
  useObjectLifecycle(roofHandle[0])

  const handleCancel = useCallback(() => {
    setSectionBoxUpdateState(undefined)
    onCancel()
  }, [onCancel])

  const handleComplete = useCallback(
    (sectionBox: SectionBox) => {
      setSectionBoxUpdateState(undefined)
      onComplete(sectionBox)
    },
    [onComplete],
  )

  if (isActive) {
    return (
      <PushPullHeight
        sectionBox={sectionBox}
        onComplete={handleComplete}
        onCancel={handleCancel}
        previewSectionBox={previewSectionBox}
      />
    )
  }

  return null
}
