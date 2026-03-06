import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import type { WSRContext } from "./wsrContext"
import sceneManager from "src/core/three/sceneManager"
import { MessageListenerResource } from "@spacemakerai/web-sketch-renderer"
import type {
  ControlContextValue,
  ValueTypes,
} from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import FloatingToolInputs, { domCanvas } from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import { ToolInputIcons } from "src/integrations/inputs/floating/ToolInputIcons"
import { type SetterOrUpdater } from "recoil"
import { useSetRecoilState } from "recoil"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { toolInputUserStringState } from "src/integrations/inputs/floating/ToolStringInput"
import type { MoveMode } from "./api/types"
import { type I18nStringProvider } from "src/i18n"
import { ResourceManager } from "@spacemakerai/web-sketch-renderer"
import { useIntegrated3DSketchAPI } from "./api/Integrated3DSketchAPI"
import { getCurrentDrawingMode } from "./integrated/utils"
import {
  AllowInputModeSwitch,
  GetInputModeGuideText,
  GetSingleEdgeMoveNextInputAndMoveMode,
  IsSingleEdgeMoveTool,
  dragFaceDefaultToExtrude,
  moveEdgesDefaultToStraight,
} from "./tools/toolUtils"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import {
  inferencingActiveSignal,
  setOptionsForToolOnFocus,
  toolWaitingForSelectionSignal,
} from "./api/EditWSMElementTool"
import { getNameFromToolType } from "./toolMeta"
import { signal } from "@preact/signals"

// type guards
function isScalarDimensionUpdate(payload: any): payload is FormIt.Message.kToolDimensionUpdateScalarPayload {
  if (payload.type == "scalar") {
    return true
  }
  return false
}

export const isSingleEdgeMoveToolSignal = signal<boolean>(false)

/**
 * This component encapsulates the custom dimension box that
 * replaces FormIt's builtin dimensions.
 *
 * This rerenders a lot because FloatingToolInputs takes
 * x and y as props, so a very good potential optimization
 * may be to handle that differently (taking a ref and moving
 * it around directly for instance.)
 *
 * However, setting the input text (sMoveInput and tMoveInput)
 * will also cause a rerender, so it may not be worth it.
 *
 */
export function ToolDimensionInput({
  wsrContext,
  moveMode,
  setMoveMode,
  showFloatingToolInputs,
  setShowFloatingToolInputs,
}: {
  showFloatingToolInputs: boolean
  setShowFloatingToolInputs: (val: boolean) => any
  moveMode: MoveMode
  setMoveMode: SetterOrUpdater<MoveMode>
  wsrContext: WSRContext
}) {
  const [dimensionScreenLocation, setDimensionScreenLocation] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [showDimensionEditor, setShowDimensionEditor] = useState<boolean>(false)
  const dimensionId = useRef(-1)

  const dimensionScreenLocationCache = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const [sMoveInput, setSMoveInput] = useState<string | undefined>()
  const [tMoveInput, setTMoveInput] = useState<string | undefined>()
  const [showMoveModesPop, setShowMoveModesPop] = useState<boolean>(false)
  const [toolType, setToolType] = useState<string | undefined>()
  const [inContinuousAction, setInContinuousAction] = useState<boolean>(false)

  const dimensionOffsetX = -15
  const dimensionOffsetY = 10
  const setDimUserVal = useSetRecoilState(toolInputUserStringState)
  const setGuideText = useSetRecoilState(guideTextAtom)
  const i3dsAPI = useIntegrated3DSketchAPI()
  const inI3DSMode = i3dsAPI.inI3DSMode && !i3dsAPI.isEditingConstraint
  const inEditConstraintMode = i3dsAPI.isEditingConstraint && !inI3DSMode
  const currentDrawingMode = useMemo(() => {
    return getCurrentDrawingMode(inI3DSMode, inEditConstraintMode)
  }, [inI3DSMode, inEditConstraintMode])

  const [allowInputMode, setAllowInputMode] = useState<boolean>(false)
  const [inputMode, setInputMode] = useState<WSM.Tools.InputMode>(WSM.Tools.InputMode.Free)

  const derivedSMove = useMemo(() => {
    if (moveMode === "sMove" && sMoveInput) return sMoveInput
    return ""
  }, [sMoveInput, moveMode])

  const derivedTMove = useMemo(() => {
    if (moveMode === "tMove" && tMoveInput) return tMoveInput
    return ""
  }, [tMoveInput, moveMode])

  const handleSMoveChange = useCallback(
    (newSMove: number | string | undefined) => {
      setSMoveInput(newSMove as string)
    },
    [setSMoveInput],
  )

  const handleTMoveChange = useCallback(
    (newTMove: number | string | undefined) => {
      setTMoveInput(newTMove as string)
    },
    [setTMoveInput],
  )

  const fieldOptions = useMemo(
    () => ({
      blurOnEscapeKey: true,
      selectOnFocus: true,
      // Only type on mouse move if not in continuous action
      typeOnMouseMove: () => !FormIt.Tools.IsInContinuousAction(),
    }),
    [],
  )

  const fields = useMemo<ControlContextValue[]>(
    () =>
      showMoveModesPop
        ? [
            // Show taper/straight controls
            moveMode == "tMove"
              ? {
                  type: "string",
                  id: "tMove",
                  value: derivedTMove ?? "",
                  change: handleTMoveChange,
                  disabled: false,
                  submit: (val: any) => {
                    FormIt.HandleHUDTextInput(dimensionId.current, val as string)
                  },
                  hidden: moveMode != "tMove",
                  customIcon: <ToolInputIcons.tMoveIcon />,
                  options: fieldOptions,
                }
              : {
                  type: "string",
                  id: "sMove",
                  value: derivedSMove ?? "",
                  change: handleSMoveChange,
                  disabled: false,
                  submit: (val: any) => {
                    FormIt.HandleHUDTextInput(dimensionId.current, val as string)
                  },
                  hidden: moveMode != "sMove",
                  customIcon: <ToolInputIcons.sMoveIcon />,
                  options: fieldOptions,
                },
          ]
        : [
            // Show single string control
            {
              type: "string",
              id: "sMove",
              value: sMoveInput,
              change: handleSMoveChange,
              disabled: false,
              submit: (val: any) => {
                FormIt.HandleHUDTextInput(dimensionId.current, val as string)
              },
              customIcon:
                toolType == "angular" ? (
                  <ToolInputIcons.AngleIcon />
                ) : allowInputMode && inputMode == WSM.Tools.InputMode.Free ? (
                  <ToolInputIcons.ThreeDArrow />
                ) : (
                  <ToolInputIcons.HorizontalArrow />
                ),
              options: fieldOptions,
            },
          ],
    [
      derivedSMove,
      derivedTMove,
      handleSMoveChange,
      handleTMoveChange,
      showMoveModesPop,
      toolType,
      sMoveInput,
      moveMode,
      inputMode,
      allowInputMode,
      fieldOptions,
    ],
  )

  // Handle updating the guide text
  const cameraType = cameraApi.getCameraSettings().type
  const inferencingActive = inferencingActiveSignal.value
  const toolWaitingForSelection = toolWaitingForSelectionSignal.value
  const isSingleEdgeMove = isSingleEdgeMoveToolSignal.value
  useEffect(() => {
    const toolType = FormIt.Tools.GetActiveToolType()

    // Current tool is waiting for selection
    if (toolWaitingForSelection) {
      const toolName = getNameFromToolType(toolType) ?? ""
      setGuideText((): I18nStringProvider => (t) => t(($) => $.hotkeys.selectSomethingToModify, { toolName }))
      return
    }

    // NON UNIFORM SCALE tool
    if (toolType == FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS) {
      setGuideText(
        (): I18nStringProvider => (t) =>
          t(($) => $.hotkeys.clickAndMoveGrip) + (inferencingActive ? t(($) => $.guideText.snappingAxesHint) : ""),
      )
      return
    }

    // ROTATION and MIRROR tools
    if (toolType == FormIt.ToolType.ROTATION || toolType == FormIt.ToolType.MIRROR) {
      setGuideText(
        (): I18nStringProvider => (t) =>
          t(($) => $.guideText.alignRotationAxisWithGeometry) +
          (inferencingActive ? t(($) => $.guideText.snappingAxesHint) : ""),
      )
      return
    }

    // Nothing to display in the guide text
    if (!showMoveModesPop && !allowInputMode) {
      setGuideText(() => () => "")
      return
    }

    if (isSingleEdgeMove) {
      let inputMode = FormIt.Tools.GetInputMode()
      const { nextInputMode, nextMoveMode } = GetSingleEdgeMoveNextInputAndMoveMode(inputMode, moveMode)

      const moveModeText = moveMode == "tMove" ? "Taper" : "Straight"
      const inputModeText = inputMode == WSM.Tools.InputMode.Horizontal ? "Horizontal" : "Free"
      const nextMoveModeText = nextMoveMode == "tMove" ? "Taper" : "Straight"
      const nextInputModeText = nextInputMode == WSM.Tools.InputMode.Horizontal ? "Horizontal" : "Free"
      setGuideText(
        (): I18nStringProvider => (t) =>
          t(($) => $.guideText.rotateMoveText, { moveModeText, inputModeText, nextMoveModeText, nextInputModeText }) +
          (inferencingActive ? t(($) => $.guideText.snappingAxesHint) : ""),
      )
      return
    }

    if (allowInputMode) {
      setGuideText(
        (): I18nStringProvider => (t) =>
          GetInputModeGuideText(cameraType === "orthographic", inputMode)(t) +
          (inferencingActive ? t(($) => $.guideText.snappingAxesHint) : ""),
      )
      return
    }

    let actionName = "Move"
    if (toolType == FormIt.ToolType.DRAG_FACE) {
      actionName = "Extrude"
    }
    switch (moveMode) {
      case "tMove":
        setGuideText(
          (): I18nStringProvider => (t) =>
            t(($) => $.guideText.taperAction, { action: actionName }) +
            (inferencingActive ? t(($) => $.guideText.snappingAxesHint) : ""),
        )
        break
      case "sMove":
        setGuideText(
          (): I18nStringProvider => (t) =>
            t(($) => $.guideText.straightAction, { action: actionName }) +
            (inferencingActive ? t(($) => $.guideText.snappingAxesHint) : ""),
        )
        break
    }
    return () => setGuideText(() => () => "")
  }, [
    showMoveModesPop,
    showDimensionEditor,
    moveMode,
    setGuideText,
    allowInputMode,
    inputMode,
    cameraType,
    inferencingActive,
    toolWaitingForSelection,
    isSingleEdgeMove,
  ])

  const onFocus = useCallback(
    (_type: ValueTypes, id?: string) => {
      const toolType = FormIt.Tools.GetActiveToolType()
      if (id !== "tMove" && id !== "sMove") return

      // Set tool options
      setOptionsForToolOnFocus(toolType, setMoveMode, id, true)
    },
    [setMoveMode],
  )

  useEffect(() => {
    const localResourceManager = new ResourceManager(wsrContext.resourceManager.messageHandler)
    const messageListener = new MessageListenerResource(localResourceManager, "DimensionInputContainerListener")
    messageListener.addMessageHandler(
      "FormIt.Message.kDimensionGraphicsUpdate",
      (payload: FormIt.Message.kDimensionGraphicsUpdatePayload) => {
        const cachedPoint = dimensionScreenLocationCache.current
        const newPoint = payload.pixelPt2
        //console.log(JSON.stringify(newPoint))
        if (cachedPoint.x != newPoint.x || cachedPoint.y != newPoint.y) {
          dimensionScreenLocationCache.current = newPoint
          setDimensionScreenLocation(newPoint)
        }
      },
    )

    // Get whether tool is in action/rubberbanding
    messageListener.addMessageHandler("FormIt.Message.kToolContinuousActionUnderWay", (inContinuousAction: boolean) => {
      setInContinuousAction(inContinuousAction)
      if (inContinuousAction) {
        const currentTool = FormIt.Tools.GetActiveToolType()

        isSingleEdgeMoveToolSignal.value = IsSingleEdgeMoveTool()

        // For the face drag tool, check whether there are coplanar adjacent faces
        // and if so, change the move mode to straight
        if (currentTool == FormIt.ToolType.DRAG_FACE) {
          if (dragFaceDefaultToExtrude()) {
            setMoveMode("sMove")
          }
        }
        // For move edge, check whether there are coplanar adjacent faces
        // and if so, change the move mode to straight
        else if (currentTool == FormIt.ToolType.TRANSLATION || currentTool == FormIt.ToolType.TRANSLATION_IMPLICIT) {
          if (moveEdgesDefaultToStraight()) {
            setMoveMode("sMove")
          }
        }

        setAllowInputMode(AllowInputModeSwitch())
      } else {
        setAllowInputMode(false)
        isSingleEdgeMoveToolSignal.value = false
      }
    })

    messageListener.addMessageHandler(
      "FormIt.Message.kShowDimensionEditor",
      (dimArgs: {
        kShowDimensionEditorDimIDArg: number
        kShowDimensionEditorDimTypeArg: number
        kShowDimensionEditorScreenPosArg: WSM.Point2dInterface
        kShowDimensionEditorTabKeyArg: boolean
        kShowDimensionEditorTextArg: string
      }) => {
        if (dimArgs.kShowDimensionEditorTabKeyArg) return
        setDimUserVal(dimArgs.kShowDimensionEditorTextArg)
      },
    )

    // Set the dimension ID when a new dimension is created
    messageListener.addMessageHandler("FormIt.Message.kDimensionCreated", (dimId: number) => {
      dimensionId.current = dimId
    })

    // Hide the dimension pop and reset dimension id when dimension is deleted
    messageListener.addMessageHandler("FormIt.Message.kToolDimensionDelete", (payload: any) => {
      if (dimensionId.current != payload.id) return
      dimensionId.current = -1
      setShowMoveModesPop(false)
      setShowDimensionEditor(false)
      domCanvas.focus()
    })

    // Update the dimension display, type and id in the modes pop
    messageListener.addMessageHandler("FormIt.Message.kToolDimensionUpdate", (payload: any) => {
      const activeTool = FormIt.Tools.GetActiveToolType()
      const isScaleTool =
        activeTool == FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS ||
        activeTool == FormIt.ToolType.SCALE_OBJECTS ||
        activeTool == FormIt.ToolType.SCALE_FACE

      // FormIt will send 0' type==linear on camera orbit for some reason, so this ignores any
      // messages that are not of type "scalar" when we're in scale mode
      // Note: should probably fix this in formit-core
      if (isScaleTool && !isScalarDimensionUpdate(payload)) {
        return
      }

      setTMoveInput(payload?.text)
      setSMoveInput(payload?.text)
      setToolType(payload?.type)
      if (dimensionId.current == -1 && (payload?.id as number) != -1) {
        // Show mode switch or standard dimension pop
        const tt = FormIt.Tools.GetActiveToolType()
        const groupInstancePaths: WSM.GroupInstancePathInterface[] = FormIt.Selection.GetSelections()
        const objTypes = WSM.Utils.GetObjectTypesMultiHistory(groupInstancePaths ?? [])?.types
        let isValid = true

        // This is a temporary fix to hide purple lines in Sketch tools and have Linear Measure tool work
        if (tt == FormIt.ToolType.LINEAR_MEASURE) {
          wsrContext.hideFormItIntegrationDimensions = false
          wsrContext.hidesketchScene2DDimensions = true
        } else {
          wsrContext.hideFormItDimensions = true
        }

        // Determine whether we need to show the straight vs taper UI
        // aka move mode

        // Must have a selection
        if (!payload || objTypes?.length < 1) {
          isValid = false
        }
        // For translation tools, only support single edge selection
        else if (tt == FormIt.ToolType.TRANSLATION || tt == FormIt.ToolType.TRANSLATION_IMPLICIT) {
          if (objTypes?.length != 1 || objTypes[0] != WSM.nEdgeType) {
            isValid = false
          }
        }
        // For face drag tool, only allow one or more faces selected
        else if (tt == FormIt.ToolType.DRAG_FACE) {
          objTypes?.forEach((path) => {
            if (path != WSM.nFaceType) isValid = false
          })
        }
        // Other tools don't offer the move mode
        else {
          isValid = false
        }

        setShowMoveModesPop(isValid)
        // Not a move mode dimension. Show standard instead
        if (!isValid) {
          setShowDimensionEditor(true)
        }
      }
    })

    // Set input lock mode
    messageListener.addMessageHandler("FormIt.Message.kToolSetInputMode", (inputMode: WSM.Tools.InputMode) => {
      if (AllowInputModeSwitch()) {
        setInputMode(inputMode)
      }
    })

    return () => {
      messageListener.dispose()
    }
  }, [
    currentDrawingMode,
    inI3DSMode,
    setDimUserVal,
    moveMode,
    setMoveMode,
    wsrContext,
    setAllowInputMode,
    allowInputMode,
    setInputMode,
  ])

  if (showFloatingToolInputs != (showMoveModesPop || showDimensionEditor)) {
    setShowFloatingToolInputs(showMoveModesPop || showDimensionEditor)
  }

  return showMoveModesPop || showDimensionEditor ? (
    <span style={{ pointerEvents: !inContinuousAction ? "auto" : "none" }}>
      <FloatingToolInputs
        x={dimensionScreenLocation.x}
        y={sceneManager.canvas.clientHeight - dimensionScreenLocation.y}
        fields={fields}
        focus={onFocus}
        cancel={() => {}}
        offsetX={dimensionOffsetX}
        offsetY={dimensionOffsetY}
      />
    </span>
  ) : (
    <></>
  )
}
