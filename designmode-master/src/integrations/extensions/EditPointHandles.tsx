import { useCallback, useMemo } from "preact/compat"
import type { EditPoint } from "src/integrations/tools-common/Drawing/basicShape/EditPointsOnGround"
import EditPointsOnGround, { PointsRenderer } from "src/integrations/tools-common/Drawing/basicShape/EditPointsOnGround"
import { isDefined } from "src/lib/array"
import type { PointHandle, UpdatedPointHandles } from "./EditHandles"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

function calculateUpdateHandles(handles: PointHandle[], point: EditPoint) {
  const updatedHandle = handles.find((h) => h.id === point.id)
  if (!updatedHandle) throw new Error(`Could not find handle with id ${point.id} in handles`)
  const updatedPoint =
    updatedHandle.value.point.length === 3
      ? ([point.point.x, point.point.y, point.point.z] as [number, number, number])
      : ([point.point.x, point.point.y] as [number, number])
  const updatedHandles = handles.map((h) => (h.id === point.id ? { ...h, value: { point: updatedPoint } } : h))
  return { updatedHandle, updatedHandles }
}

export function EditPointHandles({
  handles,
  onCommit,
  onPreview,
}: {
  handles: PointHandle[]
  onCommit: (updatedHandles: UpdatedPointHandles) => void
  onPreview: (updatedHandles: UpdatedPointHandles) => void
}) {
  const terrain = terrainSignal.value

  const points: EditPoint[] | undefined = useMemo(() => {
    return handles
      .map((h) =>
        h.type === "point"
          ? {
              id: h.id,
              point: {
                x: h.value.point[0],
                y: h.value.point[1],
                z: h.value.point[2] ?? terrain.elevationAt(h.value.point[0], h.value.point[1]),
              },
            }
          : undefined,
      )
      .filter(isDefined)
  }, [handles, terrain])

  const commitCallback = useCallback(
    (point: EditPoint) => {
      const { updatedHandles } = calculateUpdateHandles(handles, point)
      onCommit({ handles: updatedHandles })
    },
    [handles, onCommit],
  )

  const previewCallback = useCallback(
    (point: EditPoint) => {
      const { updatedHandles } = calculateUpdateHandles(handles, point)
      onPreview({ handles: updatedHandles })
    },
    [handles, onPreview],
  )

  if (!points) {
    return null
  }
  return (
    <EditPointsOnGround
      onCommit={commitCallback}
      onChange={previewCallback}
      PreviewComponent={PointsRenderer}
      points={points}
    />
  )
}
