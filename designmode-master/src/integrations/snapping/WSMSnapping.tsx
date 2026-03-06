import sceneManager from "src/core/three/sceneManager"
import type { MessageHandler } from "@spacemakerai/web-sketch-renderer"
import { Propagate } from "@spacemakerai/web-sketch-renderer"
import { useCallback, useEffect, useRef } from "preact/hooks"
import { WSRContext } from "src/integrations/wsm-tools/wsr/wsrContext"
import { MessageListenerResource } from "@spacemakerai/web-sketch-renderer"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { Priority, useEventHandler } from "src/lib/eventManager"
import { useSyncPath } from "src/integrations/wsm-tools/wsr/api/useSync"
import type { Vector3 } from "three"
import type { ScreenPoint } from "src/integrations/wsm-tools/wsr/utils"
import {
  getMessageHandler,
  getNormalizedScreenPoint,
  getScreenPointFromMouseEvent,
} from "src/integrations/wsm-tools/wsr/utils"
import { atom, useRecoilState } from "recoil"
import { captureException } from "@sentry/browser"
import { formItKeyboardModifier, formItMouseButton } from "@spacemakerai/web-sketch-renderer"
import { WSMPoint3dFeetToVector3Meter } from "src/integrations/wsm-tools/wsr/integrated/utils"
import { elementState } from "src/core/elements/ElementState"
import { useIntegrated3DSketchAPI } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import { getHoveredPathFromMouseEvent } from "src/core/selection/raycast-targets"

type WSMSnappedPoint = WSM.InferenceInputPointInterface
export type SnappingReturnType = { point3DInMeters: Vector3; inputPoint: WSMSnappedPoint }

// Modifier keys to disable snapping, while pressed
const disableSnappingHotkeysWSM = ["Alt", "Option"]

// Public Snapping API
export type WSMSnappingAPI = {
  snap: (screenPoint: ScreenPoint, previousPoint?: WSMSnappedPoint) => SnappingReturnType
}

// Keeping track of snapping enabled/disabled
export const enableSnappingAtomWSM = atom<boolean>({
  key: "enableSnapAtomWSM",
  default: true,
})

// WSM Snapping API implementation
export function useWSMSnappingAPI(): WSMSnappingAPI {
  const isWSMLoaded = formitInitializedSignal.value

  const terrainPath = elementState.currentTerrainSignal.value?.path.value
  const sync = useSyncPath()

  const wsrContextRef = useRef<WSRContext>()
  const messageHandler: MessageHandler = getMessageHandler()
  const i3dsAPI = useIntegrated3DSketchAPI()

  const [snappingEnabledWSM, setSnappingEnabledWSM] = useRecoilState(enableSnappingAtomWSM)

  // Sync terrain
  useEffect(() => {
    if (!isWSMLoaded) {
      throw new Error("useWSMSnappingAPI was called without WSM initialized (consider using toolCfg.needsWSM = true)")
    }

    if (terrainPath) sync(terrainPath)
  }, [isWSMLoaded, sync, terrainPath])

  // Set up WSR
  useEffect(() => {
    if (!isWSMLoaded) {
      throw new Error("useWSMSnappingAPI was called without WSM initialized (consider using toolCfg.needsWSM = true)")
    }

    WSM.InferenceEngine.Reset()
    FormIt.Tools.StartTool(FormIt.ToolType.FORMA_INFERENCING)

    try {
      wsrContextRef.current = new WSRContext(
        sceneManager,
        FormIt.Model.GetHistoryID(),
        sceneManager.scene,
        {
          blockInstanceCreation: true,
          inferenceHighlightMeshFaces: true,
          isIntegrated3DSketch: i3dsAPI.inI3DSMode,
        },
        messageHandler,
      )
    } catch (err) {
      captureException(err, {
        tags: { owner: "conceptual", errorPoint: "WSM snapping", "integration-type": "integrated" },
      })
    }

    if (!wsrContextRef.current) {
      return
    }

    const messageListener = new MessageListenerResource(
      wsrContextRef.current.resourceManager,
      "WSMSnappingMessageListener",
    )

    messageListener.addMessageHandler(FormIt.Message.kToolGotFocus, () => {
      wsrContextRef.current?.onRequestSceneUpdate() // Needed?
    })

    wsrContextRef.current?.sketchScene.syncChanges(FormIt.Model.GetHistoryID())
    wsrContextRef.current?.animate(0)

    return () => {
      messageListener.dispose()
      wsrContextRef.current?.onShutdown()
    }
  }, [isWSMLoaded, messageHandler, i3dsAPI.inI3DSMode])

  // handle mouse move
  const mouseEventHander = useCallback(
    (e: MouseEvent) => {
      if (!wsrContextRef.current || !snappingEnabledWSM) {
        return Propagate.YES
      }
      const path = getHoveredPathFromMouseEvent(e)
      if (path) {
        sync(path)
      }

      // Handle mouse event. Need to execute FindInputPoint via FormIt.Events.MouseMove
      // so that FormItInferencing tool can set the correct variables for locking axis
      const screenPoint = getScreenPointFromMouseEvent(e)
      const normalizedScreenPoint = getNormalizedScreenPoint(screenPoint, sceneManager.renderer.domElement)

      const pt2d = WSM.Geom.Point2d(normalizedScreenPoint.x, normalizedScreenPoint.y)
      let b = formItMouseButton(e)
      FormIt.Events.MouseMove(pt2d, b, FormIt.KeyboardModifier.NoModifier)

      return Propagate.YES
    },
    [sync, snappingEnabledWSM],
  )

  // handle key down event (locks inferencing to hover axis)
  const keyDownEventHander = useCallback(
    (ev: KeyboardEvent): Propagate => {
      if (ev.repeat) {
        return Propagate.YES
      }

      if (disableSnappingHotkeysWSM.includes(ev.key)) {
        ev.preventDefault() // prevent alt key from shifting focus away from window on Windows, preventing future keydowns from registering.
        setSnappingEnabledWSM(false)
      }

      // Pass event on to FormIt for inferencing stuff
      let modifierKey = formItKeyboardModifier(ev)
      FormIt.Events.KeyDownWithString(ev.keyCode, modifierKey, `${ev.key}`)

      return Propagate.YES
    },
    [setSnappingEnabledWSM],
  )

  // handle key up event (unlocks inferencing from hover axis)
  const keyUpEventHander = useCallback(
    (ev: KeyboardEvent): Propagate => {
      if (ev.repeat) {
        return Propagate.YES
      }

      if (disableSnappingHotkeysWSM.includes(ev.key)) {
        setSnappingEnabledWSM(true)
      }

      // Pass event on to FormIt for inferencing stuff
      let modifierKey = formItKeyboardModifier(ev)
      FormIt.Events.KeyUp(ev.keyCode, modifierKey)

      return Propagate.YES
    },
    [setSnappingEnabledWSM],
  )

  useEventHandler("mousemove", mouseEventHander, Priority.WSM_TOOL_SNAPPING, sceneManager.canvas)
  useEventHandler("mousedown", mouseEventHander, Priority.WSM_TOOL_SNAPPING, sceneManager.canvas)
  useEventHandler("mouseup", mouseEventHander, Priority.WSM_TOOL_SNAPPING, sceneManager.canvas)
  useEventHandler("keyup", keyUpEventHander, Priority.WSM_TOOL_SNAPPING)
  useEventHandler("keydown", keyDownEventHander, Priority.WSM_TOOL_SNAPPING)

  // Always reset snapping on unmount
  useEffect(() => () => setSnappingEnabledWSM(true), [setSnappingEnabledWSM])

  return {
    snap: (screenPoint: ScreenPoint, previousPoint?: WSMSnappedPoint) => {
      const mousePoint = getNormalizedScreenPoint(screenPoint, sceneManager.renderer.domElement)

      // Get the 3d point (in meters) from the mouse position, using WSM inferencing
      const pickRay = WSM.Utils.PickRayFromNormalizedScreenPoint(mousePoint.x, mousePoint.y)
      const inputPoint = WSM.InferenceEngine.FindInputPoint(pickRay, previousPoint, "WSMSnapping")

      return { point3DInMeters: WSMPoint3dFeetToVector3Meter(inputPoint.Point3D), inputPoint }
    },
  }
}
