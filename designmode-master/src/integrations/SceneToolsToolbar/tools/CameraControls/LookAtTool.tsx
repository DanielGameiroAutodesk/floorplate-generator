// Look at camera tool
// This tool allows the user to select a face and then zoom to that face
// Is also allows for dragging the zoom area to adjust the zoom size

import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { useRecoilState, useSetRecoilState } from "recoil"
import { BufferAttribute, BufferGeometry, LineSegments, MeshLambertMaterial, Plane, Vector3 } from "three"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { defaultCursor, invalidCursor, setCrossHairCursor } from "src/integrations/cursors/setCursor"
import { mousePosition } from "src/core/useMousePosition"
import sceneManager from "src/core/three/sceneManager"
import { degreesToRadians } from "@turf/helpers"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { EasingFunctions } from "src/lib/easing"
import { isOnMac } from "src/lib/measurementSystem"
import type { HotkeyKeyRegistration } from "src/core/hotkeys"
import { HotkeyCategory } from "src/core/hotkeys"
import { useHotkey } from "src/core/hotkeys"
import {
  enableSnappingAtomWSM,
  useWSMSnappingAPI,
  type SnappingReturnType,
} from "src/integrations/snapping/WSMSnapping"
import { getScreenPointFromMouseEvent, type ScreenPoint } from "src/integrations/wsm-tools/wsr/utils"
import {
  Vector3MeterToWSMPoint3dFeet,
  WSMVector3dFeetToVector3Meter,
} from "src/integrations/wsm-tools/wsr/integrated/utils"
import type { I18nStringProvider } from "src/i18n"

// Main class that handles the execution of the look at tool
const LookAtToolExecute = () => {
  const WSMSnappingAPI = useWSMSnappingAPI()

  // Various states to keep track of tool execution
  const [toPoint, setToPoint] = useState<Vector3>(new Vector3())
  const [zoomFace, setZoomFace] = useState<WSM.GroupInstancePathInterface>(WSM.GroupInstancePath([]))
  const [startDragPoint, setStartDragPoint] = useState<ScreenPoint>({ pixelX: 0, pixelY: 0 })
  const [facePlane, setFacePlane] = useState<Plane>(new Plane())
  const [dragPoint, setDragPoint] = useState<Vector3>(new Vector3())

  // Recoil state that allows for disabling of snapping after drag start
  const [, setSnappingEnabledWSM] = useRecoilState(enableSnappingAtomWSM)
  // Tool state:
  // "selectFace" : before first mouse down. Showing the preview of the face as the mouse moves through the scene
  // "waitForDrag" : initial state after the mouse is down. Stays in that state util the mouse moved at least
  // five pixels to start the drag
  // "dragZoomArea" : while the mouse is being dragged. The preview is updated as the mouse moves
  // "done" : End of tool
  type ClickState = "selectFace" | "waitForDrag" | "dragZoomArea" | "done"
  const [clickState, setClickState] = useState<ClickState>("selectFace")

  // Configure snapping:
  // Don't use hover inferences
  // Only use faces for snapping
  useEffect(() => {
    WSM.InferenceEngine.SetHoveredInferencesEnabled(false)
    WSM.InferenceEngine.SetPickObjectTypes(true, false, false, true)
    const groundObject = WSM.InferenceEngine.GetGroundObject()
    if (groundObject && WSM.GroupInstancePath.IsValid(groundObject)) {
      WSM.InferenceEngine.IgnoreObject(
        WSM.GroupInstancePath.GetTopObjectHistoryID(groundObject).Object,
        WSM.InferenceEngine.ObjectOnly,
      )
    }
  }, [])

  // Gets a list of 6 points that define the zoom data. They are
  // [0] the to point, i.e. where the camera is pointed at
  // [1] the from point, i.e. where the camera will be placed
  // [2-5] the 4 corners of the camera frustum on the selected face
  const getFaceZoomData = useCallback(
    function (): Vector3[] | undefined {
      const cameraSettings = cameraApi.getCameraSettings()

      // Not working in ortho views or if there is no valid face selection
      if (cameraSettings.type !== "perspective" || !WSM.GroupInstancePath.IsValid(zoomFace)) return undefined

      // Get the face data, including its plane
      const normal = WSM.Vector3d.Vector3d(facePlane.normal.x, facePlane.normal.y, facePlane.normal.z)

      // Get the x and y axis on the face plane. If the face is horizontal, the x axis is the
      // right vector of the camera
      let xAxis = WSM.Vector3d.Vector3d(1, 0, 0)
      if (!WSM.Vector3d.AreParallel(normal, WSM.Vector3d.ZDirection())) {
        xAxis = WSM.Vector3d.CrossProduct(normal, WSM.Vector3d.ZDirection())
      } else {
        const up = cameraApi.getCurrentCameraState().up
        const upVec = WSM.Vector3d.Vector3d(up.x, up.y, up.z)
        xAxis = WSM.Vector3d.CrossProduct(normal, upVec)
      }
      xAxis = WSM.Vector3d.GetNormalized(xAxis)
      let yAxis = WSM.Vector3d.CrossProduct(xAxis, normal)
      yAxis = WSM.Vector3d.GetNormalized(yAxis)

      let halfX = 0
      let halfY = 0
      let to = WSM.Point3d.Point3d()

      // When dragging the zoom area, calulate the frustum size from the drag distance
      if (clickState === "dragZoomArea") {
        to = Vector3MeterToWSMPoint3dFeet(toPoint)
        const dragPt = Vector3MeterToWSMPoint3dFeet(dragPoint)
        const dragVec = WSM.Point3d.SubtractPoint(dragPt, to)
        halfX = Math.abs(WSM.Vector3d.DotProduct(dragVec, xAxis))
        halfY = halfX / cameraSettings.aspect
      }
      // When selecting the face calculate the frustum size and center form the face extent
      else {
        // Get some point on the face (use the inference point)
        const center = Vector3MeterToWSMPoint3dFeet(toPoint)

        // Get the face or mesh face extent along the xand y axes
        const bbox2d = WSM.Utils.GetFaceOrMeshExtentsAlongAxes(zoomFace, xAxis, yAxis, center)
        if (!bbox2d.success) {
          return undefined
        }

        const minX = bbox2d.lower.x
        const maxX = bbox2d.upper.x
        const minY = bbox2d.lower.y
        const maxY = bbox2d.upper.y

        // Extent of the face in x and y
        halfX = (maxX - minX) * 0.5
        halfY = (maxY - minY) * 0.5

        // Get the to point, which is in the center of the extent
        const dx = minX + halfX
        const dy = minY + halfY
        const xVec = WSM.Vector3d.MultiplyByFactor(xAxis, dx)
        const yVec = WSM.Vector3d.MultiplyByFactor(yAxis, dy)
        const totalVec = WSM.Vector3d.AddVector(xVec, yVec)
        to = WSM.Point3d.AddVector(center, totalVec)
      }

      // Adjust extent in x or y to maintain camera aspect ratio
      const halfXActual = halfY * cameraSettings.aspect
      if (halfXActual > halfX) {
        halfX = halfXActual
      } else {
        halfY = halfX / cameraSettings.aspect
      }
      // Allow some buffer around the face
      halfX *= 1.1
      halfY *= 1.1

      // Get the from point so that the camera is at the right distance from the face
      const vertHalfAngle = degreesToRadians(cameraSettings.fov) * 0.5
      let fromDist = halfY / Math.tan(vertHalfAngle)
      const from = WSM.Point3d.AddVector(to, WSM.Vector3d.MultiplyByFactor(normal, fromDist))

      // Get the 4 corner points of the frustum on the face plane
      const vecX = WSM.Vector3d.MultiplyByFactor(xAxis, halfX)
      const vecY = WSM.Vector3d.MultiplyByFactor(yAxis, halfY)
      let zoomPoints: WSM.Point3dInterface[] = [
        WSM.Point3d.SubtractVector(WSM.Point3d.SubtractVector(to, vecX), vecY),
        WSM.Point3d.SubtractVector(WSM.Point3d.AddVector(to, vecX), vecY),
        WSM.Point3d.AddVector(WSM.Point3d.AddVector(to, vecX), vecY),
        WSM.Point3d.AddVector(WSM.Point3d.SubtractVector(to, vecX), vecY),
      ]

      // Put all points in the return array and convert to meters
      let points: Vector3[] = []
      points.push(WSMVector3dFeetToVector3Meter(to))
      points.push(WSMVector3dFeetToVector3Meter(from))
      zoomPoints.forEach((pt) => {
        points.push(WSMVector3dFeetToVector3Meter(pt))
      })

      return points
    },
    [clickState, dragPoint, facePlane, toPoint, zoomFace],
  )

  // Generates the preview graphics for the tool (the camera frustum)
  const getPreviewGraphics = useCallback(
    function (): Float32Array {
      const cameraSettings = cameraApi.getCameraSettings()

      if (cameraSettings.type === "perspective") {
        const points = getFaceZoomData()
        if (points === undefined) return new Float32Array()

        const linePoints = [
          points[0],
          points[1],
          points[2],
          points[3],
          points[3],
          points[4],
          points[4],
          points[5],
          points[5],
          points[2],
          points[1],
          points[2],
          points[1],
          points[3],
          points[1],
          points[4],
          points[1],
          points[5],
        ]

        return new Float32Array(
          linePoints.flatMap((p) => {
            return [p.x, p.y, p.z]
          }),
        )
      }

      return new Float32Array()
    },
    [getFaceZoomData],
  )

  // Cancel the tool and returns to select as the active tool
  const onCancel = exitCurrentTool

  //-------------------------------------------------------------------------------------------------------
  // Mouse / key events
  //-------------------------------------------------------------------------------------------------------

  // Set the zoom face, to point and face plane from a snap result
  const setZoomDataFromSnapResult = useCallback(
    (snapResult: SnappingReturnType) => {
      const path = snapResult.inputPoint.GroupInstancePath

      // No valid path : ignore
      if (!WSM.GroupInstancePath.IsValid(path)) {
        return
      }

      // path is ground object : ignore
      const groundObjectId = WSM.GroupInstancePath.GetTopObjectHistoryID(WSM.InferenceEngine.GetGroundObject())
      const pathId = WSM.GroupInstancePath.GetTopObjectHistoryID(path)
      if (pathId.History == groundObjectId.History && pathId.Object == groundObjectId.Object) {
        return
      }

      setZoomFace(path)
      setToPoint(snapResult.point3DInMeters)

      let normal = snapResult.inputPoint.Normal
      const dir = cameraApi.getCurrentCameraState().direction
      let cameraDir = WSM.Vector3d.Vector3d(dir.x, dir.y, dir.z)
      if (WSM.Vector3d.DotProduct(normal, cameraDir) > 0.0) {
        normal = WSM.Vector3d.MultiplyByFactor(normal, -1)
      }

      const dist = WSM.Vector3d.DotProduct(
        normal,
        WSM.Vector3d.Vector3d(snapResult.point3DInMeters.x, snapResult.point3DInMeters.y, snapResult.point3DInMeters.z),
      )
      const plane = new Plane(new Vector3(normal.x, normal.y, normal.z), -dist)
      setFacePlane(plane)
    },
    [setZoomFace, setToPoint, setFacePlane],
  )

  // Escape key cancels the tool
  const onKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel()
      }
      return Propagate.YES
    },
    [onCancel],
  )
  useEventHandler("keydown", onKeydown, Priority.TOOL)

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      // Uses left mouse button
      if (e.button === 0) {
        // Use snapping api to get the face under the mouse
        const screenPoint = getScreenPointFromMouseEvent(e)
        const snapResult = WSMSnappingAPI.snap(screenPoint)
        if (
          snapResult.inputPoint.ObjectType === WSM.nObjectType.nFaceType ||
          snapResult.inputPoint.ObjectType === WSM.nObjectType.nMeshType
        ) {
          // Set the states
          setZoomDataFromSnapResult(snapResult)
          setClickState("waitForDrag")
          setStartDragPoint(screenPoint)
        }
      }

      return Propagate.NO
    },
    [WSMSnappingAPI, setZoomDataFromSnapResult],
  )
  useEventHandler("mousedown", onMouseDown, Priority.TOOL)

  // Mouse move will select a face if in "selectFace" state
  // or drag the zoom area if in "dragZoomArea" state
  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const screenPoint = getScreenPointFromMouseEvent(e)

      // In toPoint state: select a face under mouse
      if (clickState == "selectFace") {
        const snapResult = WSMSnappingAPI.snap(screenPoint)

        if (
          snapResult.inputPoint.ObjectType === WSM.nObjectType.nFaceType ||
          snapResult.inputPoint.ObjectType === WSM.nObjectType.nMeshType
        ) {
          setZoomDataFromSnapResult(snapResult)
        } else {
          setZoomFace(WSM.GroupInstancePath([]))
        }
      }
      // In zoomPoint state, check if the mouse has moved enough to start dragging
      else if (clickState == "waitForDrag") {
        const toleranceSquared = 25
        const screenPoint = getScreenPointFromMouseEvent(e)
        const dx = screenPoint.pixelX - startDragPoint.pixelX
        const dy = screenPoint.pixelY - startDragPoint.pixelY
        if (dx * dx + dy * dy > toleranceSquared) {
          const point = new Vector3()
          if (mousePosition.ray.intersectPlane(facePlane, point) != null) {
            setDragPoint(point)
            setClickState("dragZoomArea")
            setSnappingEnabledWSM(false)
          }
        }
      }
      // In zoomPointDrag state, define the drag point for the zoom area
      else if (clickState == "dragZoomArea") {
        // Intersect the mouse ray with the face plane
        const point = new Vector3()
        if (mousePosition.ray.intersectPlane(facePlane, point) != null) {
          setDragPoint(point)
        }
      }

      return Propagate.NO
    },
    [clickState, WSMSnappingAPI, setZoomDataFromSnapResult, startDragPoint, facePlane, setSnappingEnabledWSM],
  )
  useEventHandler("mousemove", onMouseMove, Priority.TOOL)

  // Mouse up from click completes the tool. If no face was selected the tool does no
  // change the camera
  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      if (e.button === 0) {
        if (clickState == "waitForDrag" || clickState == "dragZoomArea") {
          const points = getFaceZoomData()
          if (points) {
            void cameraApi.moveCamera(points[1], points[0], 1.0, 1000, EasingFunctions.easeInOutQuart)
          }
        }

        exitCurrentTool()
      }
      return Propagate.NO
    },
    [clickState, getFaceZoomData],
  )
  useEventHandler("mouseup", onMouseUp, Priority.TOOL)

  //-------------------------------------------------------------------------------------------------------
  // Graphics
  //-------------------------------------------------------------------------------------------------------

  // Create preview lines once
  const previewLines = useMemo(() => {
    const lines = new LineSegments()

    const geometry = new BufferGeometry()
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(), 3))
    lines.geometry = geometry

    lines.material = new MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      polygonOffset: true,
    })
    return lines
  }, [])

  // Add previewLines the first time when they are created
  // and remove them when the tool exits
  useObjectLifecycle(previewLines, true, sceneManager.scene, false)

  // Render the previewLines when the face or drag point changes
  useEffect(() => {
    const pointsArray = getPreviewGraphics()
    previewLines.geometry.setAttribute("position", new BufferAttribute(pointsArray, 3))
    previewLines.geometry.computeBoundingBox()
    previewLines.geometry.computeBoundingSphere()

    sceneManager.render()
  }, [dragPoint, toPoint, previewLines, getPreviewGraphics])

  // Tool tip
  const setGuideText = useSetRecoilState(guideTextAtom)
  useEffect(() => {
    setGuideText((): I18nStringProvider => (t) => t(($) => $.camera.lookAt.tooltip))
    return () => setGuideText(() => () => "")
  }, [setGuideText])

  // Cursor
  useEffect(() => {
    if (WSM.GroupInstancePath.IsValid(zoomFace)) {
      setCrossHairCursor()
    } else {
      invalidCursor()
    }
    return () => defaultCursor()
  }, [zoomFace])

  return <> </>
}

// Look At tool. Creates a button, that when clicked sets the
// active tool to be "lookAt"
const LookAtToolCfg: ToolCfg = {
  id: "lookAt",
  tool: LookAtToolExecute,
  toolbar: "topLevel",
  propertyPanel: "default",
  needsWSM: true, // Uses WSM for snapping
}

// Set up hotkey and tool execution
const hotkey: Omit<HotkeyKeyRegistration, "callback"> = {
  meta: isOnMac,
  ctrl: !isOnMac,
  description: (t) => t(($) => $.camera.lookAt.title),
  keyCode: "E",
  editAccessRequired: false,
  category: HotkeyCategory.Camera,
}
export const useLookAtTool = () => {
  const lookAtExecute = useCallback(() => {
    toolAPI.setTool(LookAtToolCfg)
  }, [])

  const perspectiveMode = cameraApi.getCameraSettings().type === "perspective"

  const lookAtHotkey = useMemo(() => {
    return {
      ...hotkey,
      callback: lookAtExecute,
      disabled: !perspectiveMode,
    }
  }, [lookAtExecute, perspectiveMode])

  useHotkey(lookAtHotkey)

  if (!perspectiveMode) {
    return () => {}
  }

  return lookAtExecute
}
