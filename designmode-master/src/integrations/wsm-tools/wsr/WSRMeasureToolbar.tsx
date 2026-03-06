import sceneManager, { screenResolutionVector } from "src/core/three/sceneManager"
import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import type { MessageHandler } from "@spacemakerai/web-sketch-renderer"
import { formItKeyboardModifier, formItMouseButton, Propagate } from "@spacemakerai/web-sketch-renderer"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { Priority, useEventHandler } from "src/lib/eventManager"
import type { ScreenPoint } from "./utils"
import { getMessageHandler, getNormalizedScreenPoint, getScreenPointFromMouseEvent } from "./utils"
import type { Texture } from "three"
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Line3,
  Mesh,
  MeshBasicMaterial,
  Plane,
  Vector3,
} from "three"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import type { Vec3 } from "src/lib/geometry/geometryTypes"
import { formatMetricLengthAs, UnitType } from "@spacemakerai/forma-units"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { colors } from "src/lib/colors"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { defaultCursor, moveHorizontalCursor } from "src/integrations/cursors/setCursor"
import { ToolCursors } from "./tools/ToolCursors"
import { ToolTipComponent } from "./toolTipComponent"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import { Analytics } from "src/core/analytics"
import { useWSMSnappingAPI } from "src/integrations/snapping/WSMSnapping"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { WSMPoint3dFeetToVector3Meter } from "./integrated/utils"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { useSetRecoilState } from "recoil"
import { GetInputModeGuideText, HandleInputModeSwitch } from "./tools/toolUtils"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { useIsImperial } from "src/lib/unitSettings"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"

/*** styling constants ***/
// padding "factor" above and below the text (multiplied by dimension box height)
const boxPaddingFactorTopBottom = 0.25
// padding "factor" to left and right of text (multiplied by dimension box height)
const boxPaddingFactorLeftRight = 0.5
// slight vertical offset for text inside box to account for descenders (in pixels)
const boxVerticalAlignOffset = 6
// blue color for measure dimension box and dashed lines
const boxAndLineColorStr = "#006EAF" // AKA "rgba(0, 110, 175, 1.0)"
const boxAndLineColor = new Color(boxAndLineColorStr)

function Vec3ToVector3(v: Vec3): Vector3 {
  return new Vector3(v.x, v.y, v.z)
}

// Convenience function to create Float32Array from an array of Vector3
function CreatePointsArray(pts: Vector3[]): Float32Array {
  return new Float32Array(
    pts.flatMap((p) => {
      return [p.x, p.y, p.z]
    }),
  )
}

// Create a three js plane from three points
function planeFromThreePoints(p1: Vector3, p2: Vector3, p3: Vector3): Plane {
  let v1 = new Vector3().subVectors(p1, p2)
  let v2 = new Vector3().subVectors(p1, p3)
  v1.cross(v2).normalize()
  let d = -p1.dot(v1)
  return new Plane(v1, d)
}

function createSetMeasureTool(method: "hotkey" | "toolbar") {
  return () => {
    toolAPI.setTool({
      id: "WSRMeasureDistance",
      tool: MeasureDistance,
      toolbar: WSRMeasureToolbar,
      propertyPanel: "default",
      needsWSM: true,
    })
    Analytics.trackSelectTool("measure_distance", undefined, method)
  }
}

// The measure distance tool. Note that currently it is doing only one dimension at a time
// meaning two clicks define a dimensions and the third click eliminates the previous dimension
// and starts a new one. However the code is set up to keep multiple (thus the measurePoints array)
export function MeasureDistance() {
  const messageHandler: MessageHandler = getMessageHandler()
  const RenderAPI = useRenderAPI("default")
  const imperialFlag = useIsImperial()

  type ClickState = "fromPoint" | "toPoint" | "done"
  const [clickState, setClickState] = useState<ClickState>("fromPoint")
  const [measurePoints, setMeasurePoints] = useState<Vector3[]>([])
  const [originalPoints, setOriginalPoints] = useState<Vector3[]>([])
  const [previousInputPoint, setPreviousInputPoint] = useState<WSM.InferenceInputPointInterface>()
  const [currentMousePoint, setCurrentMousePoint] = useState<ScreenPoint>({ pixelX: 0, pixelY: 0 })
  const [mouseDownButton, setMouseDownButton] = useState<FormIt.MouseButton>(FormIt.MouseButton.LEFT)

  // State to cause update of graphics when the camera changes
  const [cameraDirection, setCameraDirection] = useState<Vector3>(
    new Vector3(
      cameraApi.getCurrentCameraState().direction.x,
      cameraApi.getCurrentCameraState().direction.y,
      cameraApi.getCurrentCameraState().direction.z,
    ),
  )
  const [isOrthoTopViewCamera, setIsOrthoTopViewCamera] = useState<boolean>(false)

  const WSMSnappingAPI = useWSMSnappingAPI()

  // Update the last point in the measure points array
  const updateToPoint = useCallback(
    function (pt: Vector3) {
      let newPoints = [...measurePoints]
      newPoints[newPoints.length - 1] = pt
      setMeasurePoints([...newPoints])
    },
    [measurePoints],
  )

  // Guide text for free vs horizontal
  const setGuideText = useSetRecoilState(guideTextAtom)
  const [inputMode, setInputMode] = useState<WSM.Tools.InputMode>(WSM.Tools.InputMode.Free)

  // Get the 3d point (in meters) from the mouse position, using WSM inferencing
  function get3DPointFromScreenPoint(
    screenPoint: ScreenPoint,
    previousPoint?: WSM.InferenceInputPointInterface,
  ): { pt: Vector3; originalPoint: Vector3 | undefined; previousPoint: WSM.InferenceInputPointInterface } {
    const { point3DInMeters, inputPoint } = WSMSnappingAPI.snap(screenPoint, previousPoint)

    // When in 2d top view for the second input point, set the z value
    // of the second input point to be the same as the first input point.
    // And return the actual (not adjusted) second input point so that a
    // line can be drawn to it.
    let originalPt = undefined
    if (previousPoint && isOrthoTopViewCamera) {
      originalPt = point3DInMeters
      inputPoint.Point3D.z = previousPoint.Point3D.z
    }

    let pt = WSMPoint3dFeetToVector3Meter(inputPoint.Point3D)

    return { pt: pt, originalPoint: originalPt, previousPoint: inputPoint }
  }

  // Handles a click or enter to define the start or end point of the dimension
  function handleInputPointAtScreenPosition(screenPoint: ScreenPoint) {
    const result = get3DPointFromScreenPoint(screenPoint, clickState == "toPoint" ? previousInputPoint : undefined)

    if (clickState == "fromPoint") {
      setClickState("toPoint")
      setMeasurePoints([result.pt, result.pt])
      setPreviousInputPoint(result.previousPoint)
      setOriginalPoints([])

      // Generate the default inference axes at the first clicked point
      WSM.InferenceEngine.AddDefaultInferencesForInputPoint(result.previousPoint)

      // Allow locking input parallel to the ground when inferencing the terrain and pressing shift
      WSM.InferenceEngine.SetEnableLockParallelToGround(true)

      Analytics.track(EventName.Use, {
        feature_category: FeatureCategory.DesignTool,
        feature: "measure_distance",
        sub_feature: "First point placed",
      })
    } else if (clickState == "toPoint") {
      updateToPoint(result.pt)
      if (result.originalPoint) {
        setOriginalPoints([result.originalPoint])
      }
      setClickState("fromPoint")
      WSM.InferenceEngine.Reset()

      Analytics.track(EventName.Use, {
        feature_category: FeatureCategory.DesignTool,
        feature: "measure_distance",
        sub_feature: "Second point placed",
      })
    }
  }

  // handle mouse down (click)
  useEventHandler(
    "mousedown",
    (e: MouseEvent) => {
      if (e.button !== 0) {
        return Propagate.YES
      }
      const screenPoint = getScreenPointFromMouseEvent(e)

      handleInputPointAtScreenPosition(screenPoint)
      const normalizedScreenPoint = getNormalizedScreenPoint(screenPoint, sceneManager.renderer.domElement)

      const pt2d = WSM.Geom.Point2d(normalizedScreenPoint.x, normalizedScreenPoint.y)
      let b = formItMouseButton(e)
      setMouseDownButton(b)
      FormIt.Events.MouseDown(pt2d, b, FormIt.KeyboardModifier.NoModifier)

      return Propagate.NO
    },
    Priority.TOOL,
    sceneManager.canvas,
  )

  // handle mouse up (click)
  useEventHandler(
    "mouseup",
    (e: MouseEvent) => {
      if (e.button !== 0) {
        return Propagate.YES
      }

      const screenPoint = getScreenPointFromMouseEvent(e)
      const normalizedScreenPoint = getNormalizedScreenPoint(screenPoint, sceneManager.renderer.domElement)
      const pt2d = WSM.Geom.Point2d(normalizedScreenPoint.x, normalizedScreenPoint.y)
      FormIt.Events.MouseUp(pt2d, mouseDownButton, FormIt.KeyboardModifier.NoModifier)

      return Propagate.NO
    },
    Priority.TOOL,
    sceneManager.canvas,
  )

  // handle mouse move
  useEventHandler(
    "mousemove",
    (e: MouseEvent) => {
      const screenPoint = getScreenPointFromMouseEvent(e)
      const normalizedScreenPoint = getNormalizedScreenPoint(screenPoint, sceneManager.renderer.domElement)

      // Keep track of the current mouse point
      setCurrentMousePoint(screenPoint)

      if (clickState == "toPoint") {
        const result = get3DPointFromScreenPoint(screenPoint, previousInputPoint)
        updateToPoint(result.pt)
      } else {
        get3DPointFromScreenPoint(screenPoint)
      }

      // Pass event on to FormIt for inferencing stuff
      const pt2d = WSM.Geom.Point2d(normalizedScreenPoint.x, normalizedScreenPoint.y)
      let b = formItMouseButton(e)
      FormIt.Events.MouseMove(pt2d, b, FormIt.KeyboardModifier.NoModifier)

      return Propagate.NO
    },
    Priority.TOOL,
    sceneManager.canvas,
  )

  // handle key down event (locks inferencing to hover axis)
  useEventHandler(
    "keydown",
    (ev: KeyboardEvent): Propagate => {
      if (ev.repeat) {
        return Propagate.NO
      }

      if (ev.key === "Escape") {
        exitCurrentTool()

        Analytics.track(EventName.Use, {
          feature_category: FeatureCategory.DesignTool,
          feature: "measure_distance",
          sub_feature: "Exit via ESC",
        })

        return Propagate.NO
      }

      // Enter is the same as a mouse click.
      // Use last mouse position to generate the input point
      if (ev.key == "Enter") {
        handleInputPointAtScreenPosition(currentMousePoint)
        return Propagate.NO
      }

      // Toggle input mode between free and horizontal
      if (ev.key == "Tab") {
        HandleInputModeSwitch(false)
        setInputMode(FormIt.Tools.GetInputMode())
      }

      // Pass event on to FormIt for inferencing stuff
      let modifierKey = formItKeyboardModifier(ev)
      FormIt.Events.KeyDownWithString(ev.keyCode, modifierKey, `${ev.key}`)

      // Recapture the input point for the last mouse position because shift may lock to
      // an inference
      if (clickState == "toPoint") {
        const result = get3DPointFromScreenPoint(currentMousePoint, previousInputPoint)
        updateToPoint(result.pt)
      }

      return Propagate.NO
    },
    Priority.TOOL,
  )

  // handle key up event (unlocks inferencing from hover axis)
  useEventHandler(
    "keyup",
    (ev: KeyboardEvent): Propagate => {
      if (ev.repeat) {
        return Propagate.NO
      }

      // Pass event on to FormIt for inferencing stuff
      let modifierKey = formItKeyboardModifier(ev)
      FormIt.Events.KeyUp(ev.keyCode, modifierKey)

      // Recapture the input point for the last mouse position because shift may lock to
      // an inference
      if (clickState == "toPoint") {
        const result = get3DPointFromScreenPoint(currentMousePoint, previousInputPoint)
        updateToPoint(result.pt)
      }

      return Propagate.NO
    },
    Priority.TOOL,
  )

  // Handle updating the guide text
  useEffect(() => {
    // Nothing to display in the guide text
    if (clickState == "fromPoint") {
      setGuideText(() => () => "")
      return
    }

    setGuideText(() => GetInputModeGuideText(isOrthoTopViewCamera, inputMode))

    return () => setGuideText(() => () => "")
  }, [clickState, setGuideText, inputMode, isOrthoTopViewCamera])

  // ----------------------------------------------------------------------------
  // Graphics
  // ----------------------------------------------------------------------------

  // Textures that contain the rendered dimension text
  const allTextures: Texture[] = useMemo(() => {
    return []
  }, [])

  // Mesh for the dimension text. Not depth sorted
  const measureMesh: Mesh<BufferGeometry, MeshBasicMaterial> = useMemo(() => {
    const uvArray = new Float32Array([
      1,
      1, // ll
      0,
      1, // lr
      0,
      0, // ur
      1,
      1, // ll
      0,
      0, // ur
      1,
      0, // ul
    ])

    let geom = new BufferGeometry()
    geom.setAttribute("uv", new BufferAttribute(uvArray, 2, false))

    const material = new MeshBasicMaterial({
      side: DoubleSide,
      transparent: true,
      depthTest: false,
    })

    return new Mesh(geom, material)
  }, [])

  // Blue dashed lines that draw depth sorted
  const lines: LineSegments2 = useMemo(() => {
    const material = new LineMaterial({
      resolution: screenResolutionVector,
      color: boxAndLineColor.getHex(),
      dashed: true,
      dashSize: 1,
      gapSize: 1,
      dashScale: 1,
      depthTest: true,
      worldUnits: false,
    })

    return new LineSegments2(new LineSegmentsGeometry(), material)
  }, [])

  // Gray transparent dashed lines that draw not depth sorted
  const lines2: LineSegments2 = useMemo(() => {
    const material = new LineMaterial({
      resolution: screenResolutionVector,
      color: new Color(colors.gray40).getHex(),
      dashed: true,
      dashSize: 1,
      gapSize: 1,
      dashScale: 1,
      depthTest: false,
      worldUnits: false,
      transparent: true,
      opacity: 0.25,
    })
    return new LineSegments2(new LineSegmentsGeometry(), material)
  }, [])

  // Get a texture that contains the distance between the given points
  // Also returns the ratio of the texture (height / width)
  const getDimensionTexture = useCallback(
    function (p1: Vector3, p2: Vector3): { texture: Texture; ratio: number } | undefined {
      // // Create a canvas element for off screen drawing of the
      // // measure dimension as text into a texture
      const canvasHeight = 100
      let canvas = document.createElement("canvas")
      canvas.width = 500
      canvas.height = canvasHeight

      let ctx = canvas.getContext("2d")
      if (!ctx) return undefined

      let dist = p1.distanceTo(p2)
      let measureText = formatMetricLengthAs(dist, imperialFlag ? UnitType.ImperialFeetInches : UnitType.MetricMeter)

      let fontString = "100px Artifakt Element, sans-serif"
      ctx.font = fontString
      canvas.width = ctx.measureText(measureText).width + boxPaddingFactorLeftRight * canvasHeight * 2
      canvas.height += boxPaddingFactorTopBottom * canvasHeight * 2

      const texture = new CanvasTexture(canvas)
      texture.name = `Label X`
      // Three defaults to Linear, which is good for lighting
      // and general 3d graphics, but bad in this case.
      texture.colorSpace = "srgb"

      let ratio = canvas.height / canvas.width

      // first, create a transparent rectangle so when we add radius in a later step, we don't see black corners
      ctx.fillStyle = "rgba(255, 255, 255, 0)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // next, make blue rounded rectangle with 100% opacity (to correct previous step setting to 0% opacity)
      ctx.fillStyle = boxAndLineColorStr
      ctx.roundRect(0, 0, canvas.width, canvas.height, 30)
      ctx.fill()

      // finally, make the white text
      ctx.font = fontString
      ctx.fillStyle = "white"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(measureText, canvas.width / 2, canvas.height / 2 + boxVerticalAlignOffset)
      return { texture: texture, ratio: ratio }
    },
    [imperialFlag],
  )

  // Create rendering graphics
  const visuals = useMemo(() => {
    const group = new Group()

    // Dispose of old textures
    allTextures.map((texture) => {
      texture.dispose()
    })
    allTextures.length = 0

    for (let n = 0; n < measurePoints.length; n += 2) {
      // Draw the graphics if start and end are not identical
      if (!measurePoints[n + 1].equals(measurePoints[n])) {
        // Get texture with dimension text
        const result = getDimensionTexture(measurePoints[n + 1], measurePoints[n])
        if (result == undefined) return

        const { texture, ratio } = result
        if (texture) {
          allTextures.push(texture)
        }

        // Font size of text on screen in pixels
        const fontSize = 14
        const textureHeight = fontSize * (1.0 + boxPaddingFactorTopBottom * 2)

        // Text box size in world space
        const vec = new Vector3().subVectors(measurePoints[n + 1], measurePoints[n])
        const mid = measurePoints[n].clone().addScaledVector(vec, 0.5)
        const vSize = cameraApi.pixelsToMetersAtPosition(textureHeight, { x: mid.x, y: mid.y, z: mid.z })
        const hSize = vSize / ratio

        // Create points for text box, so that it will always face the camera
        const up = Vec3ToVector3(cameraApi.getCurrentCameraState().up)
        const right = cameraDirection.clone().cross(up).normalize()

        const ul = mid
          .clone()
          .addScaledVector(right, hSize * 0.5)
          .addScaledVector(up, -vSize * 0.5)

        const ur = mid
          .clone()
          .addScaledVector(right, -hSize * 0.5)
          .addScaledVector(up, -vSize * 0.5)

        const lr = mid
          .clone()
          .addScaledVector(right, -hSize * 0.5)
          .addScaledVector(up, vSize * 0.5)

        const ll = mid
          .clone()
          .addScaledVector(right, hSize * 0.5)
          .addScaledVector(up, vSize * 0.5)

        const meshPointsArray = CreatePointsArray([ll, lr, ur, ll, ur, ul])
        measureMesh.geometry.setAttribute("position", new BufferAttribute(meshPointsArray, 3))
        measureMesh.geometry.setIndex([0, 1, 2, 3, 4, 5])
        measureMesh.material.map = texture
        measureMesh.geometry.computeBoundingBox()
        measureMesh.geometry.computeBoundingSphere()

        // delay the rendering of this till after the rest of the scene
        // renders so that transparent materials don't draw on top of this.
        measureMesh.renderOrder = 5

        // Add the mesh the the group
        group.add(measureMesh)

        // Clip the dimension line against the text box. This is done by creating
        // four planes through the camera origin and the text box sides. Then the
        // line is intersected with each plane, and the intersection points closest
        // to the mid point of the line are the clipped point
        let cameraPos = Vec3ToVector3(cameraApi.getCurrentCameraState().position)
        let planes = []
        planes.push(planeFromThreePoints(cameraPos, ul, ur))
        planes.push(planeFromThreePoints(cameraPos, ur, lr))
        planes.push(planeFromThreePoints(cameraPos, lr, ll))
        planes.push(planeFromThreePoints(cameraPos, ll, ul))
        let mLine = new Line3(measurePoints[n], measurePoints[n + 1])
        let clipP1 = undefined
        let clipP2 = undefined
        let clipDist1 = -1.0e12
        let clipDist2 = 1.0e12
        for (let i = 0; i < 4; ++i) {
          let intPt = planes[i].intersectLine(mLine, new Vector3())
          if (intPt) {
            let dist = vec.dot(intPt.clone().subVectors(intPt, mid))
            if (dist < 0.0 && dist > clipDist1) {
              clipDist1 = dist
              clipP1 = intPt
            } else if (dist > 0.0 && dist < clipDist2) {
              clipDist2 = dist
              clipP2 = intPt
            }
          }
        }

        // Collect points for dimension lines to the left and right of the text box
        let clippedPoints = []
        if (clipP1) {
          clippedPoints.push(measurePoints[n])
          clippedPoints.push(clipP1)
        }
        if (clipP2) {
          clippedPoints.push(clipP2)
          clippedPoints.push(measurePoints[n + 1])
        }

        // Check if any dimension lines need to be drawn
        if (clippedPoints.length > 0) {
          let pointsArray = CreatePointsArray(clippedPoints)

          // Get the dash size in world space that is equivalent to 5 pixels at the measure line mid point
          let dashSize = cameraApi.pixelsToMetersAtPosition(5, { x: mid.x, y: mid.y, z: mid.z })

          // Dashed lines depth sorted
          lines.geometry = new LineSegmentsGeometry()
          lines.geometry.setPositions(pointsArray)
          lines.material.dashSize = dashSize
          lines.material.gapSize = dashSize
          lines.renderOrder = 2
          lines.computeLineDistances()
          group.add(lines)

          // Dashed lines not depth sorted
          lines2.geometry = new LineSegmentsGeometry()

          // Adding a dashed line to the original clicked point when in 2D mode
          if (originalPoints[n / 2]) {
            pointsArray = new Float32Array([
              ...pointsArray,
              ...CreatePointsArray([measurePoints[n + 1], originalPoints[n / 2]]),
            ])
          }
          lines2.geometry.setPositions(pointsArray)
          lines2.material.dashSize = dashSize
          lines2.material.gapSize = dashSize
          lines2.computeLineDistances()
          group.add(lines2)
        }
      }
    }

    group.renderOrder = 5
    return group
  }, [allTextures, cameraDirection, getDimensionTexture, lines, lines2, measureMesh, measurePoints, originalPoints])

  // Add the graphics to the rendering cycle
  RenderAPI.useObjectLifecycle_TEMPORARY_FIX(visuals, true, sceneManager.scene, false)

  // Update the measure graphics when the camera changes. This will keep
  // the measure text as a constant screen size
  useEffect(() => {
    const cameraChanged = () => {
      setCameraDirection(Vec3ToVector3(cameraApi.getCurrentCameraState().direction))
      setIsOrthoTopViewCamera(cameraApi.getCameraSettings().type === "orthographic")
    }
    sceneManager.controls.addEventListener("change", cameraChanged)
    setIsOrthoTopViewCamera(cameraApi.getCameraSettings().type === "orthographic")
    return () => {
      sceneManager.controls.removeEventListener("change", cameraChanged)
    }
  }, [])

  // Set cursor for this tool
  useEffect(() => {
    moveHorizontalCursor()
    return () => defaultCursor()
  }, [])

  // Clean up textures at end of tool
  useEffect(() => {
    return () => {
      // Dispose of old textures
      allTextures.forEach((texture) => {
        texture.dispose()
      })

      // Need to dispose lines materials, as useObjectLifecycle_TEMPORARY_FIX
      // does not do that
      lines.material.dispose()
      lines2.material.dispose()
    }
  }, [allTextures, lines.material, lines2.material])

  return (
    <>
      {messageHandler && (
        <>
          <ToolCursors />
          <ToolTipComponent messageHandler={getMessageHandler()} />
        </>
      )}
      {/* marker circles at start and end of dimension line */}
      {measurePoints[0] && <Handle position={measurePoints[0]} />}
      {measurePoints[1] && <Handle position={measurePoints[1]} />}
      {originalPoints[0] && <Handle position={originalPoints[0]} />}
    </>
  )
}

// Tool bar once tool is active. Currently there are no sub tools so
// just re-displaying the measure tool icon (per UX design)
export function WSRMeasureToolbar() {
  return (
    <>
      {/* Dummy button that just repeats the measure tool icon */}
      <ToolbarButton
        icon={<forma-measure-24 />}
        label={(t) => t(($) => $.hotkeys.measureDistance)}
        shortCut={HOTKEY_MEASURE_DISTANCE}
        onClick={() => {}}
        active={true}
      />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton
        onClick={() => {
          exitCurrentTool()
          sceneManager.canvas.focus()

          Analytics.track(EventName.Use, {
            feature_category: FeatureCategory.DesignTool,
            feature: "measure_distance",
            sub_feature: "Exit via toolbar",
          })
        }}
      />
    </>
  )
}

export const HOTKEY_MEASURE_DISTANCE = "D"

export function createMeasureToolHotkey(createMeasureTool: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.hotkeys.measureDistance),
    keyCode: HOTKEY_MEASURE_DISTANCE,
    callback: createMeasureTool,
    editAccessRequired: false,
    category: HotkeyCategory.Tools,
  }
}

// Measure tool button. Currently displayed in the top level tool bar
export function WSRMeasureToolButton() {
  const hotkey = useMemo(() => {
    return createMeasureToolHotkey(createSetMeasureTool("hotkey"))
  }, [])

  useHotkey(hotkey)

  return (
    <>
      <ToolbarButton
        icon={<forma-measure-24 />}
        label={(t) => t(($) => $.hotkeys.measureDistance)}
        shortCut={HOTKEY_MEASURE_DISTANCE}
        onClick={createSetMeasureTool("toolbar")}
      />
    </>
  )
}
