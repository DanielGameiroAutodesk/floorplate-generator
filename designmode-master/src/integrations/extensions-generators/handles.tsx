import { captureMessage } from "@sentry/browser"
import type { LineString } from "geojson"
import { useCallback, useRef } from "preact/hooks"
import type { Matrix4 } from "three"
import { Vector3 } from "three"
import { drawApi } from "src/integrations/draw/DrawAPI"
import type { Handle, Handles } from "src/integrations/extensions/EditHandles"
import {
  SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON,
  ShapeUtils,
  shapeToPolygonFeature,
} from "src/lib/three/Shape/shapeUtils"
import type { RequestHandlesFn } from "./WebComponent"
import { useDrawTool } from "./drawing"
import { assertNever } from "src/lib/assertNever"

function transformPoint2D(point: [number, number], transform: Matrix4): [number, number] {
  const transformed = new Vector3(...point).applyMatrix4(transform).toArray()
  return [transformed[0], transformed[1]]
}

function transformPoint3D(point: [number, number, number], transform: Matrix4): [number, number, number] {
  return new Vector3(...point).applyMatrix4(transform).toArray()
}

function transformHandles(handles: Handle[], transform: Matrix4): Handle[] {
  return handles.map((handle) => {
    if (handle.type === "point") {
      const point =
        handle.value.point.length === 3
          ? transformPoint3D(handle.value.point, transform)
          : transformPoint2D(handle.value.point, transform)
      return {
        ...handle,
        value: { point },
      }
    } else if (handle.type === "polygon") {
      const value = handle.value
        ? {
            polygon: handle.value.polygon.map((point) => transformPoint2D(point, transform)),
          }
        : undefined
      return {
        ...handle,
        value,
      }
    } else if (handle.type === "polyline") {
      const value = handle.value
        ? {
            polyline: handle.value.polyline.map((point) => transformPoint2D(point, transform)),
          }
        : undefined
      return {
        ...handle,
        value,
      }
    }
    assertNever(handle)
  })
}

function mapHandlesList(handles: Handle[]) {
  const polygonHandles = handles.flatMap((handle) => (handle.type === "polygon" ? [handle] : []))
  const firstPolygonHandle = polygonHandles[0]
  const polylineHandles = handles.flatMap((handle) => (handle.type === "polyline" ? [handle] : []))
  const firstPolylineHandle = polylineHandles[0]
  const pointHandles = handles.flatMap((handle) => (handle.type === "point" ? [handle] : []))

  // Only exactly one polygon or polyline is currently supported
  if (
    (firstPolygonHandle == null && firstPolylineHandle == null) ||
    (polygonHandles.length > 1 && polylineHandles.length > 1)
  ) {
    return { type: "unsupported" as const }
  }

  if (firstPolygonHandle != null && firstPolygonHandle.value == null) {
    const otherHandles: Handle[] = pointHandles
    return {
      type: "createPolygon" as const,
      polygon: firstPolygonHandle,
      otherHandles,
    }
  }

  // editHandles doesn't support polylines yet
  if (firstPolylineHandle != null) {
    const otherHandles: Handle[] = pointHandles
    return {
      type: "polyline" as const,
      polyline: firstPolylineHandle,
      otherHandles,
    }
  }

  return {
    type: "editHandles" as const,
    editHandles: {
      polygon: firstPolygonHandle,
      points: pointHandles,
    },
  }
}

function mapEditHandlesToHandlesList(handles: Handles): Handle[] {
  return ([] as Handle[]).concat(handles.points).concat(handles.polygon)
}

export function useRequestHandles(transform: Matrix4) {
  const { shapeTool, requestLineString } = useDrawTool(transform)

  const latestTransform = useRef(transform)
  latestTransform.current = transform

  const requestHandles = useCallback<RequestHandlesFn>(
    ({ handles, onPreview, onCommit, onComplete, onCancel }) => {
      const handlesOption = mapHandlesList(transformHandles(handles, latestTransform.current))

      if (handlesOption.type === "unsupported") {
        return
      }

      if (handlesOption.type === "createPolygon") {
        drawApi.getPolygon(
          (shape) => {
            if (!shape) {
              return onCancel()
            }
            const polygon = shapeToPolygonFeature(shape)
            const polygonCoordinates = polygon.geometry.coordinates[0] as [number, number][]
            const newHandle: Handle = {
              ...handlesOption.polygon,
              value: { polygon: polygonCoordinates },
            }
            onComplete(handlesOption.otherHandles.concat(newHandle))
          },
          (props) => {
            const closedShape = ShapeUtils.closeEdgesAndCreateLoopFromShape(props.shape)
            if (SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON(closedShape)) {
              const polygon = shapeToPolygonFeature(closedShape)
              const polygonCoordinates = polygon.geometry.coordinates[0] as [number, number][]
              const newHandle: Handle = {
                ...handlesOption.polygon,
                value: { polygon: polygonCoordinates },
              }
              onPreview(handlesOption.otherHandles.concat(newHandle))
            }
            return null
          },
        )
        return
      }

      if (handlesOption.type === "polyline") {
        const initialValue: LineString | undefined = handlesOption.polyline.value
          ? {
              type: "LineString",
              coordinates: handlesOption.polyline.value.polyline,
            }
          : undefined
        requestLineString({
          initialValue,
          onComplete: (value) => {
            const polylineCoordinates = value.coordinates as [number, number][]
            const newHandle: Handle = {
              ...handlesOption.polyline,
              value: { polyline: polylineCoordinates },
            }
            onComplete(handlesOption.otherHandles.concat(newHandle))
          },
          onCancel,
          onPreview: (value) => {
            const polylineCoordinates = value.coordinates as [number, number][]
            const newHandle: Handle = {
              ...handlesOption.polyline,
              value: { polyline: polylineCoordinates },
            }
            onPreview(handlesOption.otherHandles.concat(newHandle))
          },
        })
        return
      }

      const invertTransform = latestTransform.current.clone().invert()

      const { updateHandles } = drawApi.editHandles_EXPERIMENTAL(
        handlesOption.editHandles,
        (value) => {
          const newHandles = transformHandles(mapEditHandlesToHandlesList(value.handles), invertTransform)
          onComplete(newHandles)
        },
        (value) => {
          const newHandles = transformHandles(mapEditHandlesToHandlesList(value.handles), invertTransform)
          onCommit(newHandles)
        },
        (value) => {
          const newHandles = transformHandles(mapEditHandlesToHandlesList(value.handles), invertTransform)
          onPreview(newHandles)
        },
      )

      return {
        updateHandles: (handles: Handle[]) => {
          const newHandlesOption = mapHandlesList(transformHandles(handles, latestTransform.current))
          if (newHandlesOption.type === "editHandles") {
            updateHandles(newHandlesOption.editHandles)
          } else {
            captureMessage(`Invalid update handles received: ${newHandlesOption.type}`, {
              tags: { owner: "ecosystem" },
              level: "error",
            })
          }
        },
      }
    },
    [requestLineString, latestTransform],
  )

  return {
    requestHandles,
    shapeTool,
  }
}
