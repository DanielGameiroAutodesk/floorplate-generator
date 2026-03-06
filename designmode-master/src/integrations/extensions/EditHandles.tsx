import equal from "fast-deep-equal"
import { useCallback, useEffect, useRef, useState } from "preact/compat"
import { atom, useRecoilValue, useSetRecoilState } from "recoil"
import { Matrix4 } from "three"
import { shapeConfig2D } from "src/integrations/basic-elements/tooling/polygon/EditPolygonElement"
import { newId } from "src/lib/element/urn"
import {
  SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON,
  polygonGeometryToShape,
  shapeToPolygonFeature,
} from "src/lib/three/Shape/shapeUtils"
import type { Shape } from "src/lib/three/Shape/types"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import { EditPointHandles } from "./EditPointHandles"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { signalFamily } from "src/lib/signal"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export type Handles = {
  points: PointHandle[]
  polygon: PolygonHandle
}

type PointValue = { point: [number, number] | [number, number, number] }

type PolygonValue = {
  polygon: [number, number][]
}

type PolylineValue = {
  polyline: [number, number][]
}

export type Handle = PolygonHandle | PolygonCreateHandle | PolylineHandle | PolylineCreateHandle | PointHandle

export type PolygonHandle = {
  id: string
  type: "polygon"
  value: PolygonValue
}

export type PolygonCreateHandle = {
  id: string
  type: "polygon"
  value?: undefined
}

export type PolylineHandle = {
  id: string
  type: "polyline"
  value: PolylineValue
}

export type PolylineCreateHandle = {
  id: string
  type: "polyline"
  value?: undefined
}

export type PointHandle = {
  id: string
  type: "point"
  value: PointValue
}

export type UpdatedPointHandles = {
  handles: PointHandle[]
}

export type UpdatedHandles = {
  handles: Handles
}

export function EditHandlesToolbar() {
  const onComplete = useRecoilValue(onCompleteCallbackState)
  return <ToolbarCloseButton onClick={onComplete.callback} />
}

const onCompleteCallbackState = atom<{ callback: () => void }>({
  key: "onCompleteCallbackState",
  default: {
    callback: () => {},
  },
})

const handlesSignalFamily = signalFamily<string, Handles | undefined>(undefined)

/**
 * Used by useCreateEditHandles to create a new EditHandles component.
 * See docs for useCreateEditHandles.
 */
function EditHandlesStateWrapper({
  editHandlesStateId,
  onComplete,
  onCommit,
  onPreview,
}: {
  editHandlesStateId: string
  onComplete: (updatedHandles: UpdatedHandles) => void
  onPreview: (updatedHandles: UpdatedHandles) => void
  onCommit: (updatedHandles: UpdatedHandles) => void
}) {
  const handlesState = handlesSignalFamily(editHandlesStateId).value
  if (!handlesState) return null
  return <EditHandles initialHandles={handlesState} onComplete={onComplete} onCommit={onCommit} onPreview={onPreview} />
}

/**
 * The circumstance around state and state wrapper components etc. is set up
 * to support the use case where a we want to update the handles using a function (the one returned by this hook) from
 * outside the component without remounting it, as we want to keep the state of the component – such as which handles
 * have been updated by the user.
 */
export function createEditHandles(
  handles: Handles,
  onComplete: (updatedHandles: UpdatedHandles) => void,
  onCommit: (updatedHandles: UpdatedHandles) => void,
  onPreview: (updatedHandles: UpdatedHandles) => void,
) {
  const editHandlesId = newId()
  function updateHandles(handles: Handles) {
    handlesSignalFamily(editHandlesId).value = handles
  }
  updateHandles(handles)
  return {
    updateHandles,
    component: (
      <EditHandlesStateWrapper
        editHandlesStateId={editHandlesId}
        onComplete={onComplete}
        onCommit={onCommit}
        onPreview={onPreview}
      />
    ),
  }
}

function EditHandles({
  initialHandles: _initialHandles,
  onComplete,
  onPreview,
  onCommit,
}: {
  initialHandles: Handles
  onComplete: (updatedHandles: UpdatedHandles) => void
  onPreview: (updatedHandles: UpdatedHandles) => void
  onCommit: (updatedHandles: UpdatedHandles) => void
}) {
  const terrain = terrainSignal.value
  const setOnCompleteCallback = useSetRecoilState(onCompleteCallbackState)

  const [initialHandles, setInitialHandles] = useState(_initialHandles)
  const handles = useRef(_initialHandles)

  // Do deep equal on updated initial handles before accepting updates,
  // so that we split up the update instead of updating all.
  useEffect(() => {
    setInitialHandles((prev) => {
      const updated = { ...prev }
      if (!equal(updated.polygon, _initialHandles.polygon)) {
        updated.polygon = _initialHandles.polygon
      }
      if (!equal(updated.points, _initialHandles.points)) {
        updated.points = _initialHandles.points
      }
      return updated
    })
  }, [_initialHandles])

  // Setup callback for Edit Toolbar.
  useEffect(() => {
    const externalOnCompleteCallback = () => {
      onComplete({
        handles: handles.current,
      })
    }
    setOnCompleteCallback({ callback: externalOnCompleteCallback })
  }, [onComplete, setOnCompleteCallback])

  const polygonShapeFromHandles = useCallback(
    (polygon: Handles["polygon"]) => {
      return polygonGeometryToShape(
        { type: "Polygon", coordinates: [polygon.value.polygon] },
        new Matrix4().identity(),
        terrain.elevationAt,
      )
    },
    [terrain.elevationAt],
  )

  const [editingPolygonShape, setEditingPolygonShape] = useState<Shape>(() =>
    polygonShapeFromHandles(initialHandles.polygon),
  )
  const [editingPoints, setEditingPoints] = useState<PointHandle[]>(() => initialHandles.points)

  // Accept updates from outside.
  useEffect(() => {
    setEditingPolygonShape(polygonShapeFromHandles(initialHandles.polygon))
  }, [polygonShapeFromHandles, initialHandles.polygon])
  useEffect(() => {
    setEditingPoints(initialHandles.points)
  }, [initialHandles.points])
  useEffect(() => {
    handles.current = initialHandles
  }, [initialHandles])

  const updatePoints = useCallback((pointHandles: UpdatedPointHandles) => {
    setEditingPoints(pointHandles.handles)
    handles.current = {
      ...handles.current,
      points: pointHandles.handles,
    }
    return {
      handles: handles.current,
    }
  }, [])

  const updatePolygon = useCallback((shape: Shape) => {
    setEditingPolygonShape(shape)
    handles.current = {
      ...handles.current,
      polygon: {
        ...handles.current.polygon,
        value: {
          polygon: shapeToPolygonFeature(shape).geometry.coordinates[0] as [number, number][],
        },
      },
    }
    return {
      handles: handles.current,
    }
  }, [])

  const [shapeToolKey, setShapeToolKey] = useState(0)
  useEffect(() => {
    setShapeToolKey((prev) => prev + 1)
  }, [initialHandles.polygon])

  const onPreviewPoints = useCallback(
    (pointHandles: UpdatedPointHandles) => {
      onPreview(updatePoints(pointHandles))
    },
    [onPreview, updatePoints],
  )

  const onCommitPoints = useCallback(
    (pointHandles: UpdatedPointHandles) => {
      onCommit(updatePoints(pointHandles))
    },
    [onCommit, updatePoints],
  )

  const onCompletePolygon = useCallback(
    (shape: Shape) => {
      onComplete(updatePolygon(shape))
    },
    [onComplete, updatePolygon],
  )

  const onPreviewPolygon = useCallback(
    (shape: Shape) => {
      if (!SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON(shape)) return
      onPreview(updatePolygon(shape))
    },
    [onPreview, updatePolygon],
  )

  const onCommitPolygon = useCallback(
    (shape: Shape) => {
      onCommit(updatePolygon(shape))
    },
    [onCommit, updatePolygon],
  )

  const onCancel = useCallback(() => {
    onComplete({ handles: handles.current })
  }, [onComplete])

  return (
    <>
      <EditPointHandles handles={editingPoints} onPreview={onPreviewPoints} onCommit={onCommitPoints} />
      <ShapeTool
        // Remounts the shape tool when the initial shape changes,
        // as ShapeTool don't support updating the initial shape.
        key={`shapetool-${shapeToolKey}`}
        onComplete={onCompletePolygon}
        onPreviewChange={onPreviewPolygon}
        onUpdate={onCommitPolygon}
        onCancel={onCancel}
        isValid={SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON}
        initialShape={editingPolygonShape}
        config={shapeConfig2D}
      />
    </>
  )
}
