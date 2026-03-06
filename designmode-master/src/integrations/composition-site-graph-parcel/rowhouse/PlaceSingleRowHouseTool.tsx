import { useCallback, useEffect, useState } from "preact/hooks"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import sceneManager from "src/core/three/sceneManager"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { toElements } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { newChildKey } from "src/lib/element/urn"
import type { Vector3 } from "three"
import { Matrix4 } from "three"
import CurrentTemplate from "src/integrations/composition-site-graph-parcel/templates/CurrentTemplate"
import { useSetRecoilState } from "recoil"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"
import { mousePosition } from "src/core/useMousePosition"
import type { Vec3 } from "src/lib/geometry/geometryTypes"
import { AnalyticsLegacy } from "src/core/analytics"
import { CompositionEventNames } from "src/integrations/composition/CompositionMixpanelEventNames"
import { useMemo } from "preact/compat"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import type { I18nStringProvider } from "src/i18n"
import { exitCurrentTool } from "src/core/toolsState"
import { EventName } from "@spacemakerai/webapp-analytics"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"

type ToolMode = "place" | "rotate" // When mouse button is up or down, respectively
type Corner = "front-left" | "front-right" | "back-left" | "back-right"
type Placement = { position: Vec3; orientation: number }

const MIN_CURSOR_RADIUS_FOR_ROTATION = 10
const MAX_ANGLE_FOR_ANGLE_SNAPPING = Math.PI / 6

export function PlaceSingleRowHouseTool() {
  const actionAPI = useActionAPI()
  const currentTemplate = CurrentTemplate.templateSignal.value

  const [currentToolMode, setCurrentToolMode] = useState<ToolMode>("place")
  const [currentCorner, setCurrentCorner] = useState<Corner>("front-left")
  const [currentPlacement, setCurrentPlacement] = useState<Placement | undefined>(undefined)
  const [userSpecifiedOrientation, setUserSpecifiedOrientation] = useState<number>(0)

  // The following two states are only used during the rotation mode (mousedown)
  const [originalPlacementBeforeRotate, setOriginalPlacementBeforeRotate] = useState<Placement | undefined>(undefined)
  const [newUserSpecifiedOrientation, setNewUserSpecifiedOrientation] = useState<number | undefined>(undefined)

  const createSingleRowHouseAction = useCallback(() => {
    if (!currentTemplate || !currentPlacement) {
      return undefined
    }
    const parcelWidth = currentTemplate.element.properties.generator.parameters.width
    const parcelDepth = currentTemplate.element.properties.generator.parameters.depth
    const widthShift = ["front-left", "back-left"].includes(currentCorner) ? parcelWidth / 2 : -parcelWidth / 2
    const depthShift = ["front-left", "front-right"].includes(currentCorner) ? parcelDepth / 2 : -parcelDepth / 2
    const transform = new Matrix4()
      .makeTranslation(currentPlacement.position.x, currentPlacement.position.y, currentPlacement.position.z)
      .multiply(new Matrix4().makeRotationZ(currentPlacement.orientation))
      .multiply(new Matrix4().makeTranslation(widthShift, depthShift, 0))
      .toArray()
    const { elements, rootUrn } = toElements(currentTemplate)
    return actionAPI.add.subTree_UNSTABLE(rootUrn, elements, new Set(), currentTemplate.representations, {
      child: { key: newChildKey(), transform },
    })
  }, [currentTemplate, currentPlacement, currentCorner, actionAPI])

  // Automatically update the preview based on our relevant state variables for
  // createSingleRowHouseAction above (currentTemplate, currentPlacement, currentCorner)
  useEffect(() => {
    const rowHouseAction = createSingleRowHouseAction()
    if (rowHouseAction) {
      actionAPI.preview_UNSTABLE(rowHouseAction)
    } else {
      actionAPI.resetPreview_UNSTABLE()
    }
  }, [createSingleRowHouseAction, actionAPI])

  useEffect(() => {
    // we track with new tracking schema in mouseup callback
    AnalyticsLegacy.track(CompositionEventNames.Tool_SingleStart)
    return () => {
      AnalyticsLegacy.track(CompositionEventNames.Tool_SingleExit)
    }
  }, [])

  useEffect(() => {
    return () => {
      // Before unmounting, clean up from actionAPI.preview_UNSTABLE above
      actionAPI.resetPreview_UNSTABLE()
    }
  }, [actionAPI])

  const setGuideText = useSetRecoilState(guideTextAtom)
  useEffect(() => {
    setGuideText((): I18nStringProvider => (t) => t(($) => $.guideText.switchHouseCornerAndRotate))
    return () => setGuideText(() => () => "")
  }, [setGuideText])

  const switchCorner = useCallback(() => {
    const cornerOrder: Corner[] = ["front-left", "front-right", "back-right", "back-left"]
    const nextCorner = cornerOrder[(cornerOrder.indexOf(currentCorner) + 1) % cornerOrder.length]
    setCurrentCorner(nextCorner)
  }, [currentCorner, setCurrentCorner])

  const switchCornerHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.switchHouseCorner),
      keyCode: "Tab",
      editAccessRequired: true,
      callback: switchCorner,
    }
  }, [switchCorner])

  useHotkey(switchCornerHotkey)
  const escapeHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.exitHouseTool),
      keyCode: "Escape",
      editAccessRequired: true,
      callback: () => exitCurrentTool(),
    }
  }, [])
  useHotkey(escapeHotkey)
  const enterHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.exitHouseTool),
      keyCode: "Enter",
      editAccessRequired: true,
      callback: () => exitCurrentTool(),
    }
  }, [])
  useHotkey(enterHotkey)

  const snapCursor = useCallback((initialOrientation: number): Placement | undefined => {
    const snapInfo = snappingAPIStateful.snap(mousePosition)
    if (!snapInfo) {
      const hit = raycastApi.raycastTerrain()
      if (!hit) {
        return undefined
      }
      return { position: hit.position, orientation: initialOrientation }
    }
    snappingAPIStateful.setSnapInfo(snapInfo)
    const snappedPosition = {
      x: snapInfo.position.x,
      y: snapInfo.position.y,
      z: snapInfo.position.z,
    }
    const lines: { a: Vector3; b: Vector3 }[] = [
      ...snapInfo.candidateLines.map((cl) => ({ a: cl.line.start, b: cl.line.end })), // Forward
      ...snapInfo.candidateLines.map((cl) => ({ a: cl.line.end, b: cl.line.start })), // Backward
    ]
    const relevantOrientations = lines.map(({ a, b }) => Math.atan2(b.y - a.y, b.x - a.x))
    if (relevantOrientations.length == 0) {
      return {
        position: snappedPosition,
        orientation: initialOrientation,
      }
    }
    const normalizeAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
    const orientationDiffs = relevantOrientations.map((a) => normalizeAngle(a - Math.PI / 2 - initialOrientation))
    orientationDiffs.sort((a, b) => Math.abs(a) - Math.abs(b))
    const minOrientationDiff = orientationDiffs[0]
    const doAngleAdjust = Math.abs(minOrientationDiff) <= MAX_ANGLE_FOR_ANGLE_SNAPPING
    const angleAdjustment = doAngleAdjust ? minOrientationDiff : 0
    return {
      position: snappedPosition,
      orientation: initialOrientation + angleAdjustment,
    }
  }, [])

  const mousemovePlaceMode = useCallback(() => {
    const snap = snapCursor(userSpecifiedOrientation)
    setCurrentPlacement(snap)
  }, [userSpecifiedOrientation, snapCursor, setCurrentPlacement])

  const mousemoveRotateMode = useCallback(() => {
    const snap = snapCursor(0) // Ignore snapped orientation, only need position
    if (!snap || !originalPlacementBeforeRotate) {
      return
    }
    const dx = snap.position.x - originalPlacementBeforeRotate.position.x
    const dy = snap.position.y - originalPlacementBeforeRotate.position.y
    const cursorDistance = Math.sqrt(dx ** 2 + dy ** 2)
    const cursorOrientation = Math.PI / 2 + Math.atan2(dy, dx)

    const haveTriggeredNewOrientation = cursorDistance >= MIN_CURSOR_RADIUS_FOR_ROTATION
    const newOrientation = haveTriggeredNewOrientation ? cursorOrientation : undefined

    setNewUserSpecifiedOrientation(newOrientation)
    setCurrentPlacement({
      position: originalPlacementBeforeRotate.position,
      orientation: newOrientation ?? originalPlacementBeforeRotate.orientation,
    })
  }, [snapCursor, originalPlacementBeforeRotate, setNewUserSpecifiedOrientation, setCurrentPlacement])

  const mousemove = useCallback(() => {
    if (currentToolMode == "place") {
      mousemovePlaceMode()
    }
    if (currentToolMode == "rotate") {
      mousemoveRotateMode()
    }
    return Propagate.YES
  }, [currentToolMode, mousemovePlaceMode, mousemoveRotateMode])

  const mousedown = useCallback(
    (e: MouseEvent) => {
      if (e.button != 0 || !currentPlacement) {
        return Propagate.YES
      }
      setOriginalPlacementBeforeRotate(currentPlacement)
      setNewUserSpecifiedOrientation(undefined)
      setCurrentToolMode("rotate")
      return Propagate.NO
    },
    [currentPlacement, setOriginalPlacementBeforeRotate, setNewUserSpecifiedOrientation, setCurrentToolMode],
  )

  const mouseup = useCallback(
    (e: MouseEvent) => {
      if (e.button != 0) {
        return Propagate.YES
      }
      if (newUserSpecifiedOrientation !== undefined) {
        setUserSpecifiedOrientation(newUserSpecifiedOrientation)
      } else {
        const rowHouseAction = createSingleRowHouseAction()
        if (rowHouseAction) {
          actionAPI.apply(CompositionEventNames.Tool_SinglePlace, rowHouseAction)
          dispatchBuildingEvent("row_house", EventName.Add, "draw", { sub_feature: "single_row_house" })
        }
      }
      setCurrentToolMode("place")
      return Propagate.NO
    },
    [
      newUserSpecifiedOrientation,
      setUserSpecifiedOrientation,
      createSingleRowHouseAction,
      actionAPI,
      setCurrentToolMode,
    ],
  )

  useEventHandler("mousemove", mousemove, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("mousedown", mousedown, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("mouseup", mouseup, Priority.TOOL, sceneManager.renderer.domElement)

  return (
    <>
      {currentToolMode == "place" && snappingAPIStateful.visualsComponent()}
      {currentToolMode == "place" && snappingAPIStateful.snappingPicker()}
    </>
  )
}
