import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { useSetRecoilState } from "recoil"
import {
  BufferAttribute,
  BufferGeometry,
  Line3,
  LineSegments,
  MeshLambertMaterial,
  Plane,
  Vector2,
  Vector3,
} from "three"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { defaultCursor, setCrossHairCursor } from "src/integrations/cursors/setCursor"
import { mousePosition } from "src/core/useMousePosition"
import sceneManager from "src/core/three/sceneManager"
import { degreesToRadians } from "@turf/helpers"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { EasingFunctions } from "src/lib/easing"
import { isOnMac } from "src/lib/measurementSystem"
import type { HotkeyKeyRegistration } from "src/core/hotkeys"
import { HotkeyCategory } from "src/core/hotkeys"
import { useHotkey } from "src/core/hotkeys"
import type { I18nStringProvider } from "src/i18n"

const reusedVector2 = new Vector2()
// Main class that handles the execution of the look form tool
export const LookFromToolExecute = () => {
  // From and to points
  const [fromPoint, setFromPoint] = useState<Vector3>(new Vector3())
  const [toPoint, setToPoint] = useState<Vector3>(new Vector3())
  const [toPointDefault, setToPointDefault] = useState<Vector3>(new Vector3())
  const [hitPoint, setHitPoint] = useState<Vector3>(new Vector3())
  const [lastDirection, setLastDirection] = useState<Vector3>(new Vector3())

  // Tool state:
  // "fromPoint" : before first mouse down. Showing the preview graphics as the mouse moves through the scene
  // "toPoint" : while the mouse is down. Rotating the view direction
  // "done" : End of tool
  type ClickState = "fromPoint" | "toPoint" | "done"
  const [clickState, setClickState] = useState<ClickState>("fromPoint")

  // Convert a 2d point to a Vector3, substituting 0 for z
  function toVector3({ x, y }: { x: number; y: number }): Vector3 {
    return new Vector3(x, y)
  }

  // Generate the point buffer for the preview lines
  // pairs of x,y,z for each line, flattened to an array of floats
  const getPreviewGraphics = useCallback(function (
    fromPoint: Vector3,
    toPoint: Vector3,
    toPointDefault: Vector3,
    hitPoint: Vector3,
  ): Float32Array {
    const cameraSettings = cameraApi.getCameraSettings()

    if (cameraSettings.type === "perspective" && !fromPoint.equals(toPoint)) {
      const vertHalfAngle = degreesToRadians(cameraSettings.fov) * 0.5
      const dir = toPoint.clone().sub(fromPoint).normalize()
      const dirDefaultPoint = toPointDefault.clone().sub(fromPoint).normalize()

      const dist = cameraApi.pixelsToMetersAtPosition(window.innerHeight * 0.05, fromPoint)
      const toPointNormalized = fromPoint.clone().addScaledVector(dir, dist)
      const toPointDefaultScale = fromPoint.clone().addScaledVector(dirDefaultPoint, dist * 2.0)

      const vDist = Math.tan(vertHalfAngle) * dist
      const hDist = vDist * cameraSettings.aspect

      const vDir = new Vector3(0, 0, 1)
      const hDir = vDir.clone().cross(dir)
      const ll = toPointNormalized.clone().addScaledVector(hDir, hDist).addScaledVector(vDir, -vDist)
      const ul = toPointNormalized.clone().addScaledVector(hDir, hDist).addScaledVector(vDir, vDist)
      const ur = toPointNormalized.clone().addScaledVector(hDir, -hDist).addScaledVector(vDir, vDist)
      const lr = toPointNormalized.clone().addScaledVector(hDir, -hDist).addScaledVector(vDir, -vDist)
      const linePoints = [
        hitPoint,
        fromPoint,
        fromPoint,
        toPointDefaultScale,
        fromPoint,
        ll,
        fromPoint,
        ul,
        fromPoint,
        ur,
        fromPoint,
        lr,
        ll,
        ul,
        ul,
        ur,
        ur,
        lr,
        lr,
        ll,
      ]
      return new Float32Array(
        linePoints.flatMap((p) => {
          return [p.x, p.y, p.z]
        }),
      )
    }

    return new Float32Array()
  }, [])

  // Calculate the camera from point and to point on a building at the current mouse position
  // Returns undefined if the mouse if not on a building
  const getFromAndToPoint = useCallback(
    function (): { fromPoint: Vector3; toPoint: Vector3; hitPoint: Vector3 } | undefined {
      // Do a ray cast to get an intersection point
      const terrain = sceneManager.scene.getObjectByName("Terrain")
      if (terrain == undefined) return undefined

      const hit = raycastApi.raycastMousePosition()

      if (hit && hit.normal) {
        // Get the normal direction at the intersection. If it is from the terrain, always use z up
        const normal = hit.onTerrain ? new Vector3(0, 0, 1) : new Vector3(hit.normal.x, hit.normal.y, hit.normal.z)
        const intPt = new Vector3(hit.position.x, hit.position.y, hit.position.z)

        if (normal !== undefined) {
          let viewDirection = new Vector3()
          const dotProduct = normal.dot(new Vector3(0, 0, 1))
          let directionOffset = 0.5 // 0.5 meters in front of the surface
          // If the normal of the target surface is along z axis use the last
          // direction for the new view direction. If the last view direction is
          // not defined, use the horizontal camera direction

          if (Math.abs(dotProduct) > 1.0 - 1.0e-6) {
            if (lastDirection.lengthSq() === 0 && cameraApi.getCurrentCameraState().direction !== undefined) {
              viewDirection = new Vector3(
                cameraApi.getCurrentCameraState().direction?.x,
                cameraApi.getCurrentCameraState().direction?.y,
                cameraApi.getCurrentCameraState().direction?.z,
              )
              viewDirection.setZ(0)
              viewDirection.normalize()
            } else {
              viewDirection.copy(lastDirection)
            }
            directionOffset = 1.5 // 1.5 meters, i.e eye height, above the intersection point
          } else {
            normal.setZ(0)
            normal.normalize()
            viewDirection.copy(normal)
            setLastDirection(viewDirection.clone())
          }
          // Set the from point to be "directionOffset" meters away from the target point
          const from = intPt.clone().add(normal.clone().multiplyScalar(directionOffset))
          // Set the to point to be along the view direction (see above)
          const dist = cameraApi.pixelsToMetersAtPosition(window.innerHeight * 0.05, from)
          const to = from.clone().add(viewDirection.multiplyScalar(dist))

          return { fromPoint: from, toPoint: to, hitPoint: intPt }

          // No target normal found. Reset the last view direction
        } else {
          setLastDirection(new Vector3())
        }
        // No intersection found. Reset the last view direction
      } else {
        setLastDirection(new Vector3())
      }
      return undefined
    },
    [lastDirection],
  )

  // Calculates the camera to point. Intersects the mouse ray with a plane parallel to xy and
  // through fromPoint. If the current mouse position is within a tolerance of the first clicked point or
  // within a tolerance of the line between the fromPoint and the default toPoint, the default toPoint
  // is returned
  const getToPoint = useCallback(
    function (screenPt: Vector2): Vector3 | undefined {
      // Check whether the current mouse position is within a tolerance of the
      // first clicked point
      const tolSquared = 25
      const { x: hitX, y: hitY } = cameraApi.worldToScreen(hitPoint)
      reusedVector2.set(hitX, hitY)
      if (screenPt.distanceToSquared(reusedVector2) < tolSquared) {
        return toPointDefault
      }

      // Check whether the current mouse position is within a tolerance of the line
      // between the fromPoint and the default toPoint
      const dist = cameraApi.pixelsToMetersAtPosition(window.innerHeight * 0.05, fromPoint)
      const dirDefaultPoint = toPointDefault.clone().sub(fromPoint).normalize()
      const toPointDefaultScale = fromPoint.clone().addScaledVector(dirDefaultPoint, dist * 2.0)

      const ptOnDefaultDir = new Vector3()
      const defaultDir = new Line3(
        toVector3(cameraApi.worldToScreen(fromPoint)),
        toVector3(cameraApi.worldToScreen(toPointDefaultScale)),
      )
      defaultDir.closestPointToPoint(toVector3(screenPt), true, ptOnDefaultDir)
      if (ptOnDefaultDir.distanceToSquared(toVector3(screenPt)) < tolSquared) {
        return toPointDefault
      }

      // Intersect the mouse ray with the plane parallel to xy and through fromPoint
      const point = new Vector3()
      const plane = new Plane(new Vector3(0, 0, -1), fromPoint.z)
      if (mousePosition.ray.intersectPlane(plane, point) != null) {
        return point
      }

      return undefined
    },
    [hitPoint, fromPoint, toPointDefault],
  )

  // Done with the tool
  // Set the camera position to fromPoint pointing at toPoint
  // Animate the transition from the current camera position
  const onComplete = useCallback((from: Vector3, to: Vector3) => {
    // Return to selection tool
    exitCurrentTool()

    // Animate the zoom to take 2 seconds
    const duration = 2000
    void cameraApi.moveCamera(from, to, undefined, duration, EasingFunctions.easeInOutQuart)
  }, [])

  // Cancel the tool and returns to select as the active tool
  const onCancel = exitCurrentTool

  //-------------------------------------------------------------------------------------------------------
  // Mouse / key events
  //-------------------------------------------------------------------------------------------------------

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
      if (e.button === 0) {
        if (clickState == "fromPoint") {
          const result = getFromAndToPoint()

          if (result != undefined) {
            setFromPoint(result.fromPoint)
            setToPoint(result.toPoint)
            setToPointDefault(result.toPoint)
            setHitPoint(result.hitPoint)
            setClickState("toPoint")
          }
          // If the mousedown didn't result in a valid point, cancel the tool
          else {
            onCancel()
          }
        }
      }

      return Propagate.NO
    },
    [onCancel, clickState, getFromAndToPoint],
  )
  useEventHandler("mousedown", onMouseDown, Priority.TOOL)

  // Mouse up from click completes the tool, if a valid point was picked
  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      if (e.button === 0) {
        if (clickState == "toPoint") {
          const pt = getToPoint(new Vector2(e.clientX, window.innerHeight - e.clientY))
          if (pt != undefined) {
            setToPoint(pt)
            onComplete(fromPoint, toPoint)
            setClickState("done")
          }
          // If the mousedown didn't result in a valid point, mouse up become a cancel
        } else {
          onCancel()
        }
      }
      return Propagate.NO
    },
    [onComplete, onCancel, clickState, getToPoint, fromPoint, toPoint],
  )
  useEventHandler("mouseup", onMouseUp, Priority.TOOL)

  // Mouse move will set the current from and to points
  // which will trigger the preview to be drawn
  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (clickState == "fromPoint") {
        const result = getFromAndToPoint()
        if (result != undefined) {
          setFromPoint(result.fromPoint)
          setToPoint(result.toPoint)
          setToPointDefault(result.toPoint)
          setHitPoint(result.hitPoint)
        } else {
          setFromPoint(new Vector3())
          setToPoint(new Vector3())
          setHitPoint(new Vector3())
        }
      } else if (clickState == "toPoint") {
        const pt = getToPoint(new Vector2(e.clientX, window.innerHeight - e.clientY))
        if (pt != undefined) {
          setToPoint(pt)
        }
      }
      return Propagate.NO
    },
    [clickState, getFromAndToPoint, getToPoint],
  )
  useEventHandler("mousemove", onMouseMove, Priority.TOOL)

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

  // Render the previewLines when the from point changes
  useEffect(() => {
    const pointsArray = getPreviewGraphics(fromPoint, toPoint, toPointDefault, hitPoint)
    previewLines.geometry.setAttribute("position", new BufferAttribute(pointsArray, 3))
    previewLines.geometry.computeBoundingBox()
    previewLines.geometry.computeBoundingSphere()

    sceneManager.render()
  }, [fromPoint, toPoint, hitPoint, previewLines, toPointDefault, getPreviewGraphics])

  // Tool tip
  const setGuideText = useSetRecoilState(guideTextAtom)
  useEffect(() => {
    setGuideText((): I18nStringProvider => (t) => t(($) => $.camera.lookFrom.tooltip))
    return () => setGuideText(() => () => "")
  }, [setGuideText])

  // Cursor
  useEffect(() => {
    setCrossHairCursor()
    return () => defaultCursor()
  }, [])

  return <> </>
}

// Look from tool. Creates a button, that when clicked sets the
// active tool to be "lookFrom"
const LookFromToolCfg: ToolCfg = {
  id: "lookFrom",
  tool: LookFromToolExecute,
  toolbar: "topLevel",
  propertyPanel: "default",
}

const hotkey: Omit<HotkeyKeyRegistration, "callback"> = {
  meta: isOnMac,
  ctrl: !isOnMac,
  description: (t) => t(($) => $.camera.lookFrom.title),
  keyCode: "L",
  editAccessRequired: false,
  category: HotkeyCategory.Camera,
}
export const useLookFromTool = () => {
  const lookFromFitExecute = useCallback(() => {
    toolAPI.setTool(LookFromToolCfg)
  }, [])

  const perspectiveMode = cameraApi.getCameraSettings().type === "perspective"

  const lookFromHotkey = useMemo(() => {
    return {
      ...hotkey,
      callback: lookFromFitExecute,
      disabled: !perspectiveMode,
    }
  }, [lookFromFitExecute, perspectiveMode])

  useHotkey(lookFromHotkey)

  if (!perspectiveMode) {
    return () => {}
  }

  return lookFromFitExecute
}
