import type { MoveMode } from "./types"
import { defaultExtrudeMode, defaultMoveMode, Integrated3DSketchEditModeType } from "./types"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { WSRContext } from "src/integrations/wsm-tools/wsr/wsrContext"

import type { MessageHandler, SketchSceneOptions } from "@spacemakerai/web-sketch-renderer"
import {
  LocalAxisDisplayMode,
  MessageListenerResource,
  Propagate,
  SketchMaterials,
  WSRMeshLambertMaterial,
} from "@spacemakerai/web-sketch-renderer"
import { FEET_TO_METER } from "@spacemakerai/forma-units"
import sceneManager from "src/core/three/sceneManager"
import { Priority, useEventHandler } from "src/lib/eventManager"
import { getHistoryAndObjectFromInstancePath } from "./getHistoryAndObjectFromInstancePath"
import { useSyncPath, WSMSyncUtils } from "./useSync"
import { ToolStackBreadcrumb } from "src/integrations/wsm-tools/wsr/tools/ToolStackBreadcrumb"
import { ToolCursors } from "src/integrations/wsm-tools/wsr/tools/ToolCursors"
import { useQuickAccessHotkeys } from "./useQuickAccessHotkeys"
import { ToolTipComponent } from "src/integrations/wsm-tools/wsr/toolTipComponent"
import useFeatureFlag, { URLFlag } from "src/lib/featureToggling"
import type { SetterOrUpdater } from "recoil"
import { atom, useRecoilState, useRecoilValue, useSetRecoilState } from "recoil"
import {
  useIntegrated3DSketchAPI,
  wsmLevelChangedPayload,
  wsmModelChangedPayload,
  wsmNeedsSaveSignal,
} from "./Integrated3DSketchAPI"
import type { InternalPath } from "src/lib/element/path"
import { captureException } from "@sentry/browser"
import { Analytics } from "src/core/analytics"
import WSMContextMenu from "src/integrations/wsm-tools/wsr/integrated/components/WSMContextMenu/WSMContextMenu"
import ArrayToolDialog, {
  showArrayToolDialogState,
} from "src/integrations/wsm-tools/wsr/integrated/components/ArrayToolDialog/ArrayToolDialog"
import DimensionInputDialog from "src/integrations/wsm-tools/wsr/integrated/components/DimensionInputDialog/DimensionInputDialog"
import AdvancedModelingConfirmation from "src/integrations/wsm-tools/wsr/integrated/components/AdvancedModelingConfirmation"
import {
  backfaceSelectedState,
  isButtonClickedState,
  isSelectionChangedState,
  nonWatertightSelectedState,
  setLastDrawToolID,
  showModelDiagnosticsState,
  wsmModelChangedNotContinuousSignal,
  wsmToolIDSignal,
  wsrHasNonManifoldSignal,
} from "src/integrations/wsm-tools/wsr/integrated/state"
import { initWSMValidationAlerts } from "src/integrations/wsm-tools/wsm-integration/validationAlerts"
import {
  I3DS_ELEMENT_BLUE_DESATURATION_INFLUENCE,
  I3DS_ELEMENT_COLOR_DESATURATION,
  I3DS_ELEMENT_COLOR_LIGHTENING_FACTOR,
  I3DS_MATERIALS,
} from "src/integrations/wsm-tools/wsr/materials/i3dsMaterials"
import { CONSTRAINT_MATERIALS } from "src/integrations/wsm-tools/wsr/materials/constraintMaterials"
import { isSingleEdgeMoveToolSignal, ToolDimensionInput } from "src/integrations/wsm-tools/wsr/ToolDimensionInput"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"

import { resetFadeAllExceptSignal, setFadeAllExceptSignalValue } from "src/core/selection/selectionState"
import { EditMeshWarningDialog } from "src/integrations/wsm-tools/wsr/dialogs/EditMeshWarningDialog"
import FloatingToolOptions, {
  showFloatingToolOptionsState,
} from "src/integrations/wsm-tools/wsr/integrated/components/FloatingToolOptions/FloatingToolOptions"
import {
  getChildrenPathsOfParentPath,
  getCurrentDrawingMode,
  hasMeshesInSelection,
} from "src/integrations/wsm-tools/wsr/integrated/utils"
import { HiddenPaths } from "src/core/hidden"
import { isDefined } from "src/lib/array"
import useModelFileDropHandler from "src/integrations/wsm-tools/wsr/integrated/hooks/useModelFileDropHandler"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { elementState } from "src/core/elements/ElementState"
import { getHoveredPathFromMouseEvent } from "src/core/selection/raycast-targets"
import { wsmSideEffectAdapter } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import {
  GetSingleEdgeMoveNextInputAndMoveMode,
  handleFormItCameraChange,
  HandleInputModeSwitch,
} from "src/integrations/wsm-tools/wsr/tools/toolUtils"
import { computed, signal } from "@preact/signals"
import { Color, DoubleSide, type HSL } from "three"
import { lerp } from "three/src/math/MathUtils.js"
import { BlockUI } from "src/integrations/wsm-tools/wsr/BlockUI"
import {
  isRecoveryLoadingSignal,
  isSketchEmpty,
  recoveryConfirmedSignal,
} from "src/integrations/wsm-tools/wsr/recovery"
import { EditDimensionDialog } from "src/integrations/wsm-tools/wsr/dialogs/EditDimensionDialog"
import { getFormItCommandForKeyEvent, getNameFromToolType } from "src/integrations/wsm-tools/wsr/toolMeta"
import { useStartUIToolsHandler } from "src/integrations/wsm-tools/wsr/integrated/hooks/useStartUIToolsHandler"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { useIsImperial } from "src/lib/unitSettings"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { type I18nStringProvider } from "src/i18n"

// Redefinable callback to save 3d sketch
export let save3dSketch = () => {}

// Signal to block UI when saving
export const isBlockingUISignal = signal(false)

const CONSTRAINT_SKETCH_SCENE_OPTIONS = {
  defaultMaterialOverrides: CONSTRAINT_MATERIALS,
  wsmToThreeScaleRatio: FEET_TO_METER,
  disableCastShadow: true,
  disableReceiveShadow: true,
  showAxisMarkers: false,
}

const I3DS_SKETCH_SCENE_OPTIONS = {
  defaultMaterialOverrides: I3DS_MATERIALS,
  wsmToThreeScaleRatio: FEET_TO_METER,
  disableCastShadow: false,
  disableReceiveShadow: false,
  showAxisMarkers: false,
}

// Signal to indicate if we're in focus mode or not
export const isI3dsFocusModeActiveSignal = signal<boolean>(false)

export const wsmToolIDState = atom<FormIt.ToolType>({
  key: "wsmToolIDState",
  default: 0,
})

export const wsmToolActionIdsToShowState = atom<number[]>({
  key: "wsmToolActionIdsToShowState",
  default: [],
})

export const formItContextToolInfoToShowState = atom<FormIt.ToolInfo[]>({
  key: "formItContextToolInfoToShowState",
  default: [],
})

/** Controls displaying the triangle count warning dialog box */
export const displayTriangleCountWarningDialog = atom<boolean>({
  key: "i3dsDisplayTriangleCountWarning",
  default: false,
})

// Signal to indicate user is in 3d sketch
export const in3DSketchSignal = computed(() => {
  const currentToolId = toolAPI.currentToolSignal.value.id
  return currentToolId === "WSRAPITool"
})

// Signal that defines the design mdoe path for the 3DS element being edited
export const edited3DSPathSignal = signal<string | undefined>(undefined)

// Signal that keeps track of whether the current tool is waiting for selection
export const toolWaitingForSelectionSignal = signal<boolean>(false)

// Signal that keeps track of whether the current tool is using inferencing
export const inferencingActiveSignal = signal<boolean>(false)

/**
 * Allow tools to configure themselves when they get focus
 * Sets general feature flags and the move mode which toggles between
 * straight and taper
 */
export function setOptionsForToolOnFocus(
  toolType: FormIt.ToolType,
  setMoveMode: SetterOrUpdater<MoveMode>,
  defaultMode: MoveMode,
  repeatLastEvent: boolean,
) {
  if (FormIt.Tools.AllowEmptySelection(toolType)) {
    // Implicit tools
    FormIt.SetFeatureFlag(WSM.Tools.kUseHybridToolsMode, false, repeatLastEvent)
    FormIt.SetFeatureFlag(WSM.Tools.kUseImplicitToolsFeatureFlag, true, repeatLastEvent)
  } else {
    // Explicit tools
    FormIt.SetFeatureFlag(WSM.Tools.kUseHybridToolsMode, true, repeatLastEvent)
    FormIt.SetFeatureFlag(WSM.Tools.kUseImplicitToolsFeatureFlag, false, repeatLastEvent)
  }

  // Move mode
  switch (toolType) {
    // Edge move uses taper/straight
    case FormIt.ToolType.TRANSLATION_IMPLICIT:
    case FormIt.ToolType.TRANSLATION:
      if (defaultMode == "tMove") {
        FormIt.SetFeatureFlag(WSM.Tools.kUseMoveEdgeByTweak, true, repeatLastEvent)
        Analytics.track(EventName.Use, {
          feature_category: FeatureCategory.DesignTool,
          feature: "3dSketch",
          sub_feature: "Move Edge tool in Taper mode",
        })
      } else {
        FormIt.SetFeatureFlag(WSM.Tools.kUseMoveEdgeByTweak, false, repeatLastEvent)
        Analytics.track(EventName.Use, {
          feature_category: FeatureCategory.DesignTool,
          feature: "3dSketch",
          sub_feature: "Move Edge tool in Straight mode",
        })
      }
      break

    // Drag face uses taper/straight
    case FormIt.ToolType.DRAG_FACE:
      if (defaultMode == "tMove") {
        FormIt.SetFeatureFlag(WSM.Tools.kUseDragFaceByTweak, true, repeatLastEvent)
        Analytics.track(EventName.Use, {
          feature_category: FeatureCategory.DesignTool,
          feature: "3dSketch",
          sub_feature: "Extrude Face tool in Taper mode",
        })
      } else {
        FormIt.SetFeatureFlag(WSM.Tools.kUseDragFaceByTweak, false, repeatLastEvent)
        Analytics.track(EventName.Use, {
          feature_category: FeatureCategory.DesignTool,
          feature: "3dSketch",
          sub_feature: "Extrude Face tool in Straight mode",
        })
      }
      break
  }
  setMoveMode(defaultMode)
}

// When the LCS is not defined (i.e. never set or the Axes Reset tool was invoked)
// disable axes display. This also disables inferencing to x/y axes.
// When the LCS is set, enable axes display. However actual display of the axes is
// still subject to the Show Axes user option.
function setLCSDisplay() {
  const lcs = WSM.APIGetLocalCoordinateSystemReadOnly(FormIt.GroupEdit.GetEditingHistoryID())
  let coordinateSystem = WSM.Transf3d.GetCoordinateSystem(lcs)
  if (
    WSM.Vector3d.AreParallel(coordinateSystem.xDir, WSM.Vector3d.XDirection()) &&
    WSM.Vector3d.AreParallel(coordinateSystem.yDir, WSM.Vector3d.YDirection()) &&
    WSM.Point3d.AreEqual(coordinateSystem.origin, WSM.Point3d.Point3d(0, 0, 0))
  ) {
    FormIt.VisualStyles.EnableAxisDisplay(false)
  } else {
    FormIt.VisualStyles.EnableAxisDisplay(true)
  }
}

/**
 * This class allows us to edit and create WSM elements in general, whether
 * they're integrated 3d sketch elements or constraints or whatever
 * new elements we add this functionality to. This basically gives us
 * all of FormIt's tools embedded in design mode and threejs.
 *
 * @returns
 */
export function EditWSMElementTool({
  instancePath,
  modeType,
  onComplete,
  path = "", // internal path
  onSave,
  elementProperties,
  recoverySave,
}: {
  instancePath: WSM.GroupInstancePathInterface
  modeType: Integrated3DSketchEditModeType
  onComplete: () => void
  path?: InternalPath
  onSave: () => void
  elementProperties?: { color?: string }
  recoverySave?: () => void
}) {
  const wsrContextRef = useRef<WSRContext>()
  const isImperial = useIsImperial()

  const isWSMDebug = useFeatureFlag(URLFlag.WSMDebug)
  const sync = useSyncPath()

  // This is used by the dimension box, but need to be set as state here
  // because we need the keyboard handler to be able to call setMoveMode
  const [moveMode, setMoveMode] = useState<"sMove" | "tMove">(defaultMoveMode)
  const [showEditDimensionModal, setShowEditDimensionModal] = useState(false)
  const [showEditDimensionModalDimId, setShowEditDimensionModalDimId] = useState(-1)
  const [showEditDimensionModalText, setShowEditDimensionModalText] = useState("0")

  // The tooltip component needs to know if floating tool inputs are
  // visible from the dimension box in order to set a proper offset.
  const [showFloatingToolInputs, setShowFloatingToolInputs] = useState(false)

  if (!isImperial) {
    // Set the current project and the default. The primitive tool
    // get the sizes based on the default units.
    FormIt.Model.SetUnitTypeCurrent(FormIt.UnitType.kMetricMeter)
    FormIt.SetUnitTypeDefault(FormIt.UnitType.kMetricMeter)
  } else {
    // If default was 1previously metric, we need to make sure this
    // is changed explicitly.
    FormIt.Model.SetUnitTypeCurrent(FormIt.UnitType.kImperialFeetInches)
    FormIt.SetUnitTypeDefault(FormIt.UnitType.kImperialFeetInches)
  }

  // There are certain contexts where onComplete
  // doesn't seem to be called reliably, so this
  // wraps it to ensure that it's called once and only once.
  const handleComplete = useCallback(() => {
    if (wsrContextRef.current) {
      if (wsrContextRef.current?.wasCompleted) {
        return
      }
      isI3dsFocusModeActiveSignal.value = false // Reset focus mode signal on exit as this affects raycastTargetsList
      wsrContextRef.current.wasCompleted = true
      FormIt.Selection.ClearSelections()
      FormIt.Selection.ClearPreSelections()
      edited3DSPathSignal.value = undefined
      return onComplete?.()
    }
  }, [wsrContextRef, onComplete])

  const messageHandler: MessageHandler = getMessageHandler()
  const { historyId, objectIds } = useMemo(() => {
    return getHistoryAndObjectFromInstancePath(instancePath)
  }, [instancePath])

  // Used to rerender the component when orbit is no longer propogating mouse handling
  // https://legacy.reactjs.org/docs/hooks-faq.html#is-there-something-like-forceupdate
  // const [, forceUpdate] = useReducer((x) => x + 1, 0)

  const setFormItToolID = useSetRecoilState(wsmToolIDState)
  // recoil state which is updated any time the WSM model changes
  // used for updating UI when model changes, like for Constraint properties
  const setModelChangedPayload = useSetRecoilState(wsmModelChangedPayload)
  const isButtonClicked = useRecoilValue(isButtonClickedState)
  const setIsButtonClickedState = useSetRecoilState(isButtonClickedState)
  const [toolFocusPayload, setToolFocusPayload] = useState<FormIt.ToolType>()
  const [secondaryToolFocusPayload, setSecondaryToolFocusPayload] = useState<FormIt.ToolType>()
  const [isArrayDialogOpen, setShowArrayToolDialog] = useRecoilState(showArrayToolDialogState)
  const setToolActionIdsToShow = useSetRecoilState(wsmToolActionIdsToShowState)
  const setFormItContextToolInfoToShow = useSetRecoilState(formItContextToolInfoToShowState)
  const setIsSelectionChanged = useSetRecoilState(isSelectionChangedState)
  const setIsLevelManagerChanged = useSetRecoilState(wsmLevelChangedPayload)
  const displayTriangleWarning = useRecoilValue(displayTriangleCountWarningDialog)
  const setDisplayTriangleWarning = useSetRecoilState(displayTriangleCountWarningDialog)
  const [showFloatingToolOptions, setShowFloatingToolOptions] = useRecoilState(showFloatingToolOptionsState)
  const i3dsAPI = useIntegrated3DSketchAPI()
  const inI3DSMode = i3dsAPI.inI3DSMode && !i3dsAPI.isEditingConstraint
  const inEditConstraintMode = i3dsAPI.isEditingConstraint && !inI3DSMode
  const currentDrawingMode = useMemo(() => {
    return getCurrentDrawingMode(inI3DSMode, inEditConstraintMode)
  }, [inI3DSMode, inEditConstraintMode])
  const isModelDiagnosticsEnabled = useRecoilValue(showModelDiagnosticsState)
  const isNonWatertightSelected = useRecoilValue(nonWatertightSelectedState)
  const isBackfaceSelected = useRecoilValue(backfaceSelectedState)
  const isSelectionChanged = useRecoilValue(isSelectionChangedState)
  const setGuideText = useSetRecoilState(guideTextAtom)
  const [lastHoveredPath, setLastHoveredPath] = useState<string>("")
  const [lastHoveredPathTime, setLastHoveredPathTime] = useState<number>(0)

  // Special handler for fillet, offset body, and shell, because
  // they start a dimension input dialog
  useStartUIToolsHandler()

  // This registers the 3DS hotkeys with designmode core hotkeys and takes care
  // of removing them once unmounted.
  useQuickAccessHotkeys()

  // Set the Integrated 3DSketch Constraint Edit Mode flag in FormIt
  useEffect(() => {
    FormIt.SetFeatureFlag(WSM.Tools.kEditingFormaConstraint, modeType === Integrated3DSketchEditModeType.Constraints)
    return () => {
      FormIt.SetFeatureFlag(WSM.Tools.kEditingFormaConstraint, false)
    }
  }, [modeType])

  // Always reset enable axes display on unmount so that design mode
  // won't display LCS axes when inferencing (measure tool for example)
  useEffect(() => () => FormIt.VisualStyles.EnableAxisDisplay(false), [])

  // Set save 3d sketch callback
  useEffect(() => {
    save3dSketch = () => {
      isBlockingUISignal.value = true
      onSave()
      isBlockingUISignal.value = false
    }
    return () => {
      save3dSketch = () => {}
      isBlockingUISignal.value = false
    }
  }, [onSave])

  useEffect(() => {
    // Fade other elements if path is set
    if (path) setFadeAllExceptSignalValue([path])

    const sketchSceneOptions: Partial<SketchSceneOptions> =
      modeType === Integrated3DSketchEditModeType.Constraints
        ? CONSTRAINT_SKETCH_SCENE_OPTIONS
        : I3DS_SKETCH_SCENE_OPTIONS

    const ignoreList = WSM.APIGetAllNonOwnedReadOnly(historyId)
      .filter((id) => !objectIds.includes(id))
      .map((id) => WSM.ObjectHistoryID(historyId, id))

    try {
      FormIt.Selection.ClearSelections()
      FormIt.Selection.ClearPreSelections()

      const hasLevels =
        instancePath.ids.length > 0
          ? WSM.APIGetObjectLevelsReadOnly(instancePath.ids[0].History, instancePath.ids[0].Object).length > 0
          : false

      // Check if the element has a color property set; if it does
      // we want to update the default face color in 3d sketch to reflect it.
      if (
        !hasLevels &&
        elementProperties &&
        elementProperties.color &&
        modeType !== Integrated3DSketchEditModeType.Constraints
      ) {
        // desaturate the color so it doesn't overwhelm things
        const elementColor = new Color(elementProperties.color)
        const hsl: HSL = { h: 0, s: 0, l: 1 }
        elementColor.getHSL(hsl)

        console.log(`WSR: Object Hue/Saturation/Lighting ${JSON.stringify(hsl)}`)

        // This function creates a curve where things with a blueish hue (around 0.5),
        // are extra desaturated (to not hide selection graphics), whereas hues
        // towards 0 or 1 have a bit more saturation (since the colors don't conflict as much)
        // However, all colors are desatured and lightened a small amount.
        const blueDesaturation = lerp(
          Math.cos(hsl.h * 2 * 3.14159) * 0.25 + 0.75,
          1.0,
          1 - I3DS_ELEMENT_BLUE_DESATURATION_INFLUENCE,
        )

        const faceColor = new Color()
        faceColor.setHSL(
          hsl.h,
          hsl.s * I3DS_ELEMENT_COLOR_DESATURATION * blueDesaturation,
          lerp(hsl.l, 1.0, I3DS_ELEMENT_COLOR_LIGHTENING_FACTOR),
        )

        sketchSceneOptions.defaultMaterialOverrides!.faceMaterial = new WSRMeshLambertMaterial(
          {
            ...SketchMaterials.defaultFaceMaterial,
            side: DoubleSide,
            color: faceColor,
          },
          {},
        )
      } else if (modeType !== Integrated3DSketchEditModeType.Constraints) {
        sketchSceneOptions.defaultMaterialOverrides!.faceMaterial = new WSRMeshLambertMaterial(
          {
            ...SketchMaterials.defaultFaceMaterial,
            side: DoubleSide,
            color: SketchMaterials.defaultFaceMaterial.color,
          },
          {},
        )
      }
      wsrContextRef.current = new WSRContext(
        sceneManager,
        FormIt.Model.GetHistoryID(),
        sceneManager.scene,
        {
          ignoreList,
          inferenceHighlightMeshFaces: true,
          instanceWhiteList: [instancePath],
          // enable to see pink hover highlights on building
          // (disabled until some optimizations are added)
          allowHighlightsOutOfContext: false,
          useWSMMaterials: true,
          broadcastNonManifold: true,
          ...sketchSceneOptions,
        },
        messageHandler,
        instancePath,
      )
    } catch (err) {
      captureException(err, {
        tags: { owner: "conceptual", errorPoint: "Edit WSR Tool", "integration-type": "integrated" },
      })
    }

    if (!wsrContextRef.current) {
      return
    }

    const messageListener = new MessageListenerResource(
      wsrContextRef.current.resourceManager,
      "EditWSMElementTool-MessageListener",
    )

    messageListener.addMessageHandler("FormIt.Message.kShowEditedGroupOnlyChanged", (val: boolean) => {
      console.log("kShowEditedGroupOnlyChanged", val)
      if (val) {
        wsrContextRef.current?.sketchScene.enableFocusMode()
        isI3dsFocusModeActiveSignal.value = true
      } else {
        wsrContextRef.current?.sketchScene.disableFocusMode()
        isI3dsFocusModeActiveSignal.value = false
      }
    })

    messageListener.addMessageHandler("FormIt.Message.kShowContextMenu", (payload) => {
      const toolActionIdsToShow = payload.first.filter(Boolean)
      setToolActionIdsToShow(toolActionIdsToShow)
    })

    messageListener.addMessageHandler("FormIt.Message.kArrayToolRequest", () => {
      setShowArrayToolDialog(true)
    })

    messageListener.addMessageHandler("FormIt.Message.kSelectionsChanged", () => {
      setIsSelectionChanged({})
      // get the available action IDs from the
      // FormIt context menu given the current selection
      const toolActionIdsRaw = FormIt.GetContextMenuOptions()

      // these actionIds represent the specific slots in the old FormIt pie menu
      // so this list will contain 0s where the slots are empty - filter those out
      const toolActionIds = toolActionIdsRaw.filter((number) => number !== 0)

      // convert the tool action IDs to proper toolInfo objects
      const formItContextToolInfoToShow: FormIt.ToolInfo[] = []
      toolActionIds.forEach((actionId: number) => {
        const toolUUID = FormIt.Configuration.GetContextMenuToolUUIDFromActionId(actionId)
        const toolInfo = FormIt.Configuration.GetToolInfo(toolUUID)
        formItContextToolInfoToShow.push(toolInfo)
      })
      setFormItContextToolInfoToShow(formItContextToolInfoToShow)
    })

    messageListener.addMessageHandler("FormIt.Message.kLevelManagerChanged", () => {
      setIsLevelManagerChanged({})
    })

    messageListener.addMessageHandler(FormIt.Message.kModelChanged, (payload: FormIt.Message.kModelChangedPayload) => {
      setModelChangedPayload(payload)

      // Save if the model changed
      if (
        // not continuous action
        !FormIt.Tools.IsInContinuousAction() &&
        // not sync
        !wsmSideEffectAdapter.isLoading() &&
        // not recovery
        !isRecoveryLoadingSignal.peek()
      ) {
        // Show the save button
        wsmNeedsSaveSignal.value = true
        // Run recovery save
        recoverySave?.()
      }

      if (!FormIt.Tools.IsInContinuousAction()) {
        // Set the model changed signal
        wsmModelChangedNotContinuousSignal.value = new Object()
      }
    })

    messageListener.addMessageHandler("WSR.OnComplete", () => {
      try {
        // Do not update WSR when exiting the tool.
        FormIt.SuspendMessaging(true, 0, false)
        handleComplete()
        exitCurrentTool()
      } catch (e) {
        console.error(e)
      } finally {
        FormIt.ResumeMessaging()
      }
    })

    messageListener.addMessageHandler(FormIt.Message.kToolGotFocus, (payload: any) => {
      setToolFocusPayload(payload.first)
      // CONCEPT-1732: Ensure extrude face (drag face) is set to straight by default
      if (payload.first === FormIt.ToolType.DRAG_FACE) {
        setMoveMode(defaultExtrudeMode)
      }
      wsrContextRef.current?.onRequestSceneUpdate()
      sceneManager.canvas.focus()
    })

    messageListener.addMessageHandler(
      FormIt.Message.kToolRemoved,
      (payload: { first: FormIt.ToolType; second: FormIt.ToolType }) => {
        // If the placement tool just finished, FormIt suppresses kModelChanged during placement,
        // so explicitly trigger a recovery save once the tool exits
        if (payload.first === FormIt.ToolType.HISTORY_PLACEMENT) {
          if (
            !FormIt.Tools.IsInContinuousAction() &&
            !wsmSideEffectAdapter.isLoading() &&
            !isRecoveryLoadingSignal.peek()
          ) {
            recoverySave?.()
          }
        }
      },
    )

    wsrContextRef.current?.sketchScene.syncChanges(FormIt.Model.GetHistoryID())
    wsrContextRef.current?.animate(0)

    messageListener.addMessageHandler(FormIt.Message.kShowDimensionEditor, (payload) => {
      if (
        wsrContextRef.current?.hideFormItDimensions ||
        wsrContextRef.current?.hideFormItIntegrationDimensions ||
        wsrContextRef.current?.hidesketchScene2DDimensions
      ) {
        return
      }
      setShowEditDimensionModal(true)
      setShowEditDimensionModalDimId(payload.kShowDimensionEditorDimIDArg)
      setShowEditDimensionModalText(payload.kShowDimensionEditorTextArg)
    })

    /* Message forwarder for kToolDimensionUpdate */
    messageListener.addMessageHandler(FormIt.Message.kToolDimensionUpdateLinear, (payload: any) => {
      messageHandler.broadcastJSMessage("FormIt.Message.kToolDimensionUpdate", payload)
    })

    messageListener.addMessageHandler(FormIt.Message.kToolDimensionUpdateScalar, (payload: any) => {
      messageHandler.broadcastJSMessage("FormIt.Message.kToolDimensionUpdate", payload)
    })

    messageListener.addMessageHandler(FormIt.Message.kToolDimensionUpdateAngular, (payload: any) => {
      messageHandler.broadcastJSMessage("FormIt.Message.kToolDimensionUpdate", payload)
    })
    /* End kToolDimensionUpdate */

    // Set implicit feature flags in FormIt/WSM when the tool changes
    // Add any one time setup code here, that is executed as soon as the tool
    // becomes active
    messageListener.addMessageHandler(
      FormIt.Message.kToolGotFocus,
      (payload: { first: FormIt.ToolType; second: FormIt.ToolType }) => {
        const toolType = payload.first
        setSecondaryToolFocusPayload(payload.second) // used for tracking advanced modeling tools analytics
        setFormItToolID(toolType)
        wsmToolIDSignal.value = toolType

        // Store the last draw tool if in empty create mode
        if (!path && isSketchEmpty(instancePath)) setLastDrawToolID(toolType)
      },
    )

    messageListener.addMessageHandler(
      FormIt.Message.kToolRemoved,
      (payload: { first: FormIt.ToolType; second: FormIt.ToolType }) => {
        // Clear feature flags when the tool exits
        if (
          [FormIt.ToolType.TRANSLATION_IMPLICIT, FormIt.ToolType.TRANSLATION, FormIt.ToolType.DRAG_FACE].includes(
            payload.first,
          )
        ) {
          // Reset taper move
          FormIt.SetFeatureFlag(WSM.Tools.kUseMoveEdgeByTweak, false)
          // Reset taper extrude/drag face
          FormIt.SetFeatureFlag(WSM.Tools.kUseDragFaceByTweak, false)
        }
        // Clear floating tool options show flag on tool exit
        setShowFloatingToolOptions(false)

        // Always reset the global default move mode ("taper at the moment")
        setMoveMode(defaultMoveMode)

        // Abort any sync loops that have started
        WSMSyncUtils.stopSync()

        // Disable auto-extrude flag if enabled
        FormIt.SetFeatureFlag(WSM.Tools.kFaceDragAfterSketching, false)

        // Reset feature flags for too behavior
        FormIt.SetFeatureFlag(WSM.Tools.kUseHybridToolsMode, true, false)
        FormIt.SetFeatureFlag(WSM.Tools.kUseImplicitToolsFeatureFlag, false, false)
      },
    )

    messageListener.addMessageHandler(
      "FormIt.Message.kExitToParentContext",
      (payload: FormIt.Message.kExitToParentContextPayload) => {
        // if succeeded = false, we weren't able to exit to a parent context.
        // This generally happens if we're already at the root context, or
        // if we're trying to jump above our prefix context. In either case
        // we want to end the WSR tool
        if (!payload.succeeded || payload.newPath.ids.length === 0) {
          try {
            // Do not update WSR when exiting the tool.
            FormIt.SuspendMessaging(true, 0, false)
            handleComplete()
            exitCurrentTool()
          } catch (e) {
            console.error(e)
          } finally {
            FormIt.ResumeMessaging()
          }
        } else {
          console.log("Exit to parent context", payload)
        }
      },
    )

    // Set LCS display when LCS changes
    messageListener.addMessageHandler(FormIt.Message.kLCSChanged, () => {
      setLCSDisplay()
    })

    // Update Forma camera from Formit camera after a non interactive camera command
    // was executed, such as zoom fit
    messageListener.addMessageHandler(FormIt.Message.kCameraCommandExecuted, () => {
      handleFormItCameraChange()
    })

    // Set inferencing active mode
    messageListener.addMessageHandler("FormIt.Message.kInferenceEventInferencingActiveChanged", (active: boolean) => {
      inferencingActiveSignal.value = active
    })

    messageListener.addMessageHandler("FormIt.Message.kToolWaitingForSelection", (waiting: boolean) => {
      toolWaitingForSelectionSignal.value = waiting
    })

    // Set the non-manifold geometry signal
    messageListener.addMessageHandler("WSR.NonManifoldGeometry", (isNonManifold: boolean) => {
      wsrHasNonManifoldSignal.value = isNonManifold
    })

    // Set LCS display when component is mounted
    setLCSDisplay()

    // Initialize WSM validation alerts handling
    const disposeValidationAlerts = initWSMValidationAlerts()

    return () => {
      // Clean up validation alerts effect
      disposeValidationAlerts()
      console.log("Constraint editor unmounted")
      resetFadeAllExceptSignal()

      try {
        // Do not update WSR when exiting the tool.
        FormIt.SuspendMessaging(true, 0, false)

        if (!wsrContextRef.current?.wasCompleted) {
          // not completed before unmount
          handleComplete()
        } else {
          // We only want to exit the current tool if we intentionally
          // ended this one (which we know from if wasCompleted is set).
          // Otherwise, the current tool might have been switched out from
          // underneath us, and calling exitCurrentTool will exit that tool
          // instead. TODO: is this a bug in CoreAPI or the design of this tool?
          exitCurrentTool()
        }
        FormIt.GroupEdit.ClearInContextEditingPathRequiredPrefix()
        FormIt.GroupEdit.EndEditInContext()
        messageListener.dispose()
        wsrContextRef.current?.onShutdown()
      } catch (e) {
        console.error(e)
      } finally {
        FormIt.ResumeMessaging()
      }
    }
  }, [
    historyId,
    instancePath,
    messageHandler,
    objectIds,
    modeType,
    setFormItToolID,
    setModelChangedPayload,
    setToolFocusPayload,
    handleComplete,
    path,
    setToolActionIdsToShow,
    setFormItContextToolInfoToShow,
    setShowArrayToolDialog,
    setIsSelectionChanged,
    setIsLevelManagerChanged,
    setShowFloatingToolOptions,
    currentDrawingMode,
    elementProperties,
    recoverySave,
  ])

  useEffect(() => {
    const currentTool = toolFocusPayload as FormIt.ToolType
    setToolFocusPayload(FormIt.ToolType.NONE)
    setSecondaryToolFocusPayload(FormIt.ToolType.NONE)

    const logToolStartEvent = (tool: FormIt.ToolType, isButtonClicked: boolean) => {
      if (tool) {
        const toolName = getNameFromToolType(tool)
        const eventSource = isButtonClicked ? "toolbar" : "hotkey"
        if (toolName) {
          Analytics.trackSelectTool("3dSketch", toolName, eventSource, "design-tool")
        }
      }

      if (isButtonClicked) {
        setIsButtonClickedState(false)
      }
    }

    logToolStartEvent(currentTool, isButtonClicked)
  }, [
    toolFocusPayload,
    secondaryToolFocusPayload,
    isButtonClicked,
    setIsButtonClickedState,
    inEditConstraintMode,
    currentDrawingMode,
  ])

  useEffect(() => {
    // Set the model diagnostics options
    wsrContextRef.current?.sketchScene.setDrawNonManifoldEdgeDiagnostics(
      isModelDiagnosticsEnabled ? isNonWatertightSelected : false,
    )

    wsrContextRef.current?.sketchScene.setDrawBackfaceDiagnostics(
      isModelDiagnosticsEnabled ? isBackfaceSelected : false,
    )

    // Set the LCS display to show the coordinate system of the current instance
    wsrContextRef.current?.sketchScene.setLocalAxisDisplayMode(LocalAxisDisplayMode.CurrentContextOnly)

    wsrContextRef.current?.onRequestSceneUpdate()
  }, [isNonWatertightSelected, isBackfaceSelected, isModelDiagnosticsEnabled])

  // some designmode keys we need to listen for
  const quickAccessKey = "q"
  const cameraModeKey = "p"
  useEventHandler(
    "keydown",
    (e: KeyboardEvent) => {
      const path = e.composedPath()
      if (path.some((element) => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement))
        return Propagate.YES

      if (!wsrContextRef.current) {
        return Propagate.YES
      }

      // handle input mode and move mode switching for some tools. This is hardcoded to be the Tab key
      if (e.key === "Tab") {
        // For single edge move only, there is a 4 way switch between all move and input moode permutations
        if (isSingleEdgeMoveToolSignal.value) {
          let inputMode = FormIt.Tools.GetInputMode()
          const { nextInputMode, nextMoveMode } = GetSingleEdgeMoveNextInputAndMoveMode(inputMode, moveMode)
          setMoveMode(nextMoveMode)
          FormIt.Tools.SetInputMode(nextInputMode)
        }
        // For all other tools, we only switch move modes or input modes
        // Note that setMoveMode is benign for tools that don't support it and
        // HandleInputModeSwitch(true) ignores tools that don't support input mode switching
        else {
          setMoveMode(moveMode == "tMove" ? "sMove" : "tMove")
          HandleInputModeSwitch(true)
        }
        e.preventDefault()
        Propagate.NO
      }

      // Handle end of 3d sketch tool. This is hardcoded to be the Enter key
      if (e.key === "Enter" && FormIt.Tools.GetActiveToolType() == 0) {
        messageHandler.broadcastJSMessage("WSR.OnComplete", "")
        e.preventDefault()
        return Propagate.NO
      }

      // If key down event matches an existing shortcut, prevent default handling
      // through the browser. For example cntrl + F should zoom fit, not invoke the
      // browser find tool
      if (getFormItCommandForKeyEvent(e) !== undefined) {
        e.preventDefault()
      }

      // prevent alt key from shifting focus away from window on Windows, preventing future keydowns from registering.
      if (e.key === "Alt" || e.key === "Option") {
        e.preventDefault()
      }

      // ensure certain designmode shortcut keys
      // work in 3D Sketch
      if (e.key === quickAccessKey || e.key === cameraModeKey) {
        return Propagate.YES
      }

      // Handle key down event in FormIt
      return wsrContextRef.current?.toolManager.onKeyDown(e)
    },
    Priority.TOOL,
    window.document.body,
  )

  useEventHandler(
    "keyup",
    (e: KeyboardEvent) => {
      if (!wsrContextRef.current) {
        return Propagate.YES
      }

      // ensure certain designmode shortcut keys
      // work in 3D Sketch
      if (e.key === quickAccessKey || e.key === cameraModeKey) {
        return Propagate.YES
      }

      return wsrContextRef.current?.toolManager.onKeyUp(e)
    },
    Priority.TOOL,
    window.document.body,
  )

  useEventHandler(
    "keypress",
    (e: KeyboardEvent) => {
      if (!wsrContextRef.current) {
        return Propagate.YES
      }

      // ensure certain designmode shortcut keys
      // work in 3D Sketch
      if (e.key === quickAccessKey || e.key === cameraModeKey) {
        return Propagate.YES
      }

      return wsrContextRef.current?.toolManager.onKeyPressed(e)
    },
    Priority.TOOL,
    window.document.body,
  )

  useEventHandler(
    "mousedown",
    (e: MouseEvent) => {
      if (!wsrContextRef.current) {
        return Propagate.YES
      }
      return wsrContextRef.current?.toolManager.onMouseDown(e)
    },
    Priority.TOOL,
    sceneManager.canvas,
  )

  useEventHandler(
    "mouseout",
    () => {
      FormIt.Selection.ClearPreSelections()
      return Propagate.YES
    },
    Priority.TOOL,
    sceneManager.canvas,
  )

  useEventHandler(
    "mousemove",
    (e: MouseEvent) => {
      if (!wsrContextRef.current) {
        return Propagate.YES
      }

      // Sync on mouse move. Note, that used to only happen when the current tool was not
      // the default selection tool (i.e. intended for inferencing). However, syncing is
      // necessary for picking so that objects that occlude others prevent selection of the occluded properly
      const path = getHoveredPathFromMouseEvent(e)
      if (path) {
        let doSync = true
        let delaySync = false

        // Prevent syncing when just in a selection tool (ToolType NONE or SELECTION) and not
        // hovering over an element long enough (0.5 secs). This prevents oversyncing when
        // just moving the mouse through the scene
        const toolType = FormIt.Tools.GetActiveToolType()
        if (toolType === FormIt.ToolType.NONE || toolType === FormIt.ToolType.SELECTION) {
          delaySync = true
        }

        if (delaySync) {
          // If the last hovered path is not the same as the current path
          // store the path as the last hovered path, also store the current time
          // and delay syncing until the same path has been hovered for 0.5 seconds
          const now = Date.now()
          if (path !== lastHoveredPath) {
            setLastHoveredPath(path)
            setLastHoveredPathTime(now)
            doSync = false
            // If the last hovered path is the same as the current path, then check
            // the time since the path was first hovered. If more then 0.5 seconds
            // proceed with syncing
          } else {
            if (now - lastHoveredPathTime < 500) {
              doSync = false
            } else {
              setLastHoveredPathTime(now)
            }
          }
        }

        if (doSync) {
          sync(path)
        }
      }

      return wsrContextRef.current?.toolManager.onMouseMove(e)
    },
    Priority.TOOL,
    sceneManager.canvas,
  )

  useEventHandler(
    "mouseup",
    (e: MouseEvent) => {
      if (!wsrContextRef.current) {
        return Propagate.YES
      }
      return wsrContextRef.current?.toolManager.onMouseUp(e)
    },
    Priority.TOOL,
    sceneManager.canvas,
  )

  useEventHandler(
    "click",
    (e: MouseEvent) => {
      if (!wsrContextRef.current) {
        return Propagate.YES
      }
      return wsrContextRef.current?.toolManager.onClick(e)
    },
    Priority.TOOL,
    sceneManager.canvas,
  )

  let toolTipOffsetX = 0
  let toolTipOffsetY = 0

  if (showFloatingToolInputs) {
    toolTipOffsetX = 10
    toolTipOffsetY = 40
  }

  if (showFloatingToolOptions) {
    toolTipOffsetX = 25
    // Vertical offset tooltip by number of inputs
    toolTipOffsetY = 10 + 30 * FormIt.Tools.GetToolsOptionCount()
  }

  // Hide dm selection visuals while 3ds is running
  useEffect(() => {
    let toHide = [...getChildrenPathsOfParentPath(elementState.currentSnapshot.peek(), path), path].filter(isDefined)
    HiddenPaths.setHiddenPathsSignalValue(new Set(toHide))
    return () => {
      HiddenPaths.resetHiddenPaths()
    }
  }, [path])

  useModelFileDropHandler()

  useEffect(() => {
    // Reset the save button visibility in area metrics
    wsmNeedsSaveSignal.value = recoveryConfirmedSignal.peek()
  }, [])

  // Effect to display formit dimensions if we're using non-uniform scale
  useEffect(() => {
    const tt = FormIt.Tools.GetActiveToolType()
    if (tt == FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS || tt == FormIt.ToolType.EDIT_TEXTURES) {
      if (wsrContextRef.current) {
        wsrContextRef.current.hideFormItDimensions = false
      }
    }
  })

  // Effect to show guide text with certain selections
  const inferencingActive = inferencingActiveSignal.value
  const toolWaitingForSelection = toolWaitingForSelectionSignal.value
  useEffect(() => {
    // Meshes can be converted to editable breps via double-click
    if (hasMeshesInSelection()) {
      setGuideText((): I18nStringProvider => (t) => t(($) => $.wsm.mesh.convertHintMessage))
    }

    // Special guide text handing for non uniform scale tool, since ToolDimensionInput
    // component is not mounted for this tool
    if (FormIt.Tools.GetActiveToolType() == FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS) {
      // Current tool is waiting for selection
      if (toolWaitingForSelection) {
        const toolName = getNameFromToolType(FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS) ?? ""
        setGuideText((): I18nStringProvider => (t) => t(($) => $.hotkeys.selectSomethingToModify, { toolName }))
        return
      }
      // Guide text for non-uniform scale
      setGuideText(
        (): I18nStringProvider => (t) =>
          t(($) => $.hotkeys.clickAndMoveGrip) + (inferencingActive ? t(($) => $.guideText.snappingAxesHint) : ""),
      )
      return
    }
  }, [setGuideText, isSelectionChanged, inferencingActive, toolWaitingForSelection])

  return (
    <>
      <BlockUI />
      {isWSMDebug && <ToolStackBreadcrumb />}
      <ToolCursors />
      <ToolTipComponent offset={{ x: toolTipOffsetX, y: toolTipOffsetY }} messageHandler={messageHandler} />
      {/* Use FloatingToolInputs for move modes and standard dimensions */}
      {wsrContextRef.current &&
        FormIt.Tools.GetActiveToolType() != FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS &&
        FormIt.Tools.GetActiveToolType() != FormIt.ToolType.EDIT_TEXTURES && (
          <ToolDimensionInput
            showFloatingToolInputs={showFloatingToolInputs}
            setShowFloatingToolInputs={setShowFloatingToolInputs}
            moveMode={moveMode}
            setMoveMode={setMoveMode}
            wsrContext={wsrContextRef.current}
          />
        )}
      {showEditDimensionModal && (
        <EditDimensionDialog
          dimId={showEditDimensionModalDimId}
          initialValue={showEditDimensionModalText}
          onClose={() => setShowEditDimensionModal(false)}
        />
      )}

      <>
        <WSMContextMenu />
        {isArrayDialogOpen && <ArrayToolDialog />}
        {showFloatingToolOptions && <FloatingToolOptions />}
        <DimensionInputDialog />
        <AdvancedModelingConfirmation />
        {displayTriangleWarning && <EditMeshWarningDialog onContinue={() => setDisplayTriangleWarning(false)} />}
      </>
    </>
  )
}
