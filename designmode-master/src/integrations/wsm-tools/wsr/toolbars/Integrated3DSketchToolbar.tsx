import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil"
import { useTranslator } from "src/i18n"

import { useCallback, useMemo } from "preact/compat"
import Sketch3DIcon from "src/integrations/wsm-tools/assets/Sketch3DIcon"
import toolTipImage3DSketch from "src/integrations/wsm-tools/assets/3d-sketch.gif"

import { Integrated3DSketchEditModeType } from "src/integrations/wsm-tools/wsr/api/types"
import {
  AdvancedModelingCoverIcon,
  AdvancedModelingFilletIcon,
  AdvancedModelingIntersectIcon,
  AdvancedModelingLoftIcon,
  AdvancedModelingOffsetIcon,
  AdvancedModelingShellIcon,
  AdvancedModelingSubtractIcon,
  AdvancedModelingSweepIcon,
  AdvancedModelingUnionIcon,
  PrimitivesCubeIcon,
  PrimitivesCylinderIcon,
  SketchArcThreePointsIcon,
  SketchCircleIcon,
  SketchLineIcon,
  SketchRectangleIcon,
  SketchSplineIcon,
} from "src/integrations/wsm-tools/wsr/svg-icons"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"

//TODO need to double check if there's APIs for these
import { canEditProposalSignal } from "src/core/edit-access-state"
import sceneManager from "src/core/three/sceneManager"

import type { ToolConfig } from "src/integrations/toolbar/ToolbarGroupedButton"
import { ToolbarGroupedButton } from "src/integrations/toolbar/ToolbarGroupedButton"
import {
  useIntegrated3DSketchAPI,
  wsmEditMode,
  wsmLevelChangedPayload,
} from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import {
  dimensionInputDialogState,
  isButtonClickedState,
  wsmActiveToolState,
  wsmIsAdvancedToolActiveSelector,
} from "src/integrations/wsm-tools/wsr/integrated/state"
import type { DimensionInputDialogType } from "src/integrations/wsm-tools/wsr/integrated/types"
import { ExplicitToolsToolbar } from "./ExplicitToolsToolbar"
import { showFloatingToolOptionsState } from "src/integrations/wsm-tools/wsr/integrated/components/FloatingToolOptions/FloatingToolOptions"
import { Analytics, type Method } from "src/core/analytics"
import { setSelectedSectionBoxSignal } from "src/integrations/section-box/state"
import PrismIcon from "src/lib/components/icons/PrismIcon"
import { getShortcutFromToolType } from "src/integrations/wsm-tools/wsr/toolMeta"
import { selectedTopLevelNodesSignal } from "src/core/selection/selectionState"
import useEditIn3DSketch from "src/integrations/3dsketch/useEditIn3DSketch"
import useShouldBeEditedIn3DSketch from "src/integrations/3dsketch/useShouldBeEditedIn3DSketch"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"
import { isElementEditableIn3DSketchWithCheckSignal } from "src/integrations/3dsketch/3dsketch-selection-state"

/** This is the generic integrated 3d sketch toolbar. */
export function Integrated3DSketchToolbar() {
  const [dimensionInputDialog, setDimensionInputDialog] = useRecoilState(dimensionInputDialogState)
  const [wsmActiveTool, setWSMActiveTool] = useRecoilState(wsmActiveToolState)
  const setIsButtonClickedState = useSetRecoilState(isButtonClickedState)
  const setShowFloatingToolOptions = useSetRecoilState(showFloatingToolOptionsState)
  // Used to show/hide the Sketch 3d toolbar when levels are added/removed
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const wsmLevelsChanged = useRecoilValue(wsmLevelChangedPayload)

  // Used to distinguish between the 3D sketch and 3D building tools
  const editMode = useRecoilValue(wsmEditMode)

  const activateFormitTool = useCallback(
    (toolType: FormIt.ToolType, isPrimitive: boolean = false) => {
      setIsButtonClickedState(true)
      FormIt.Tools.StartTool(toolType)
      setWSMActiveTool(toolType)
      // Show floating tool option inputs for primitives
      if (isPrimitive) {
        setShowFloatingToolOptions(true)
      }
    },
    [setIsButtonClickedState, setShowFloatingToolOptions, setWSMActiveTool],
  )

  const isFaceDragAfterSketching = FormIt.HaveFeatureFlag(WSM.Tools.kFaceDragAfterSketching)
  const isAdvancedToolActiveSelector = useRecoilValue(wsmIsAdvancedToolActiveSelector)

  const sketchTools: ToolConfig[] = useMemo(
    () => [
      {
        label: (t) => t(($) => $.basicElements.generic.line.name),
        icon: SketchLineIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.POLYLINE),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.POLYLINE)
        },
        active: wsmActiveTool === FormIt.ToolType.POLYLINE && !isFaceDragAfterSketching,
      },
      {
        label: (t) => t(($) => $.shapes.rectangle),
        icon: SketchRectangleIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.RECTANGLE),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.RECTANGLE)
        },
        active: wsmActiveTool === FormIt.ToolType.RECTANGLE && !isFaceDragAfterSketching,
      },
      {
        label: (t) => t(($) => $.shapes.arc),
        icon: SketchArcThreePointsIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.ARC),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.ARC)
        },
        active: wsmActiveTool === FormIt.ToolType.ARC,
      },
      {
        label: (t) => t(($) => $.shapes.circle),
        icon: SketchCircleIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.CIRCLE),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.CIRCLE)
        },
        active: wsmActiveTool === FormIt.ToolType.CIRCLE && !isFaceDragAfterSketching,
      },
      {
        label: (t) => t(($) => $.shapes.spline),
        icon: SketchSplineIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.SPLINE),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.SPLINE)
        },
        active: wsmActiveTool === FormIt.ToolType.SPLINE,
      },
    ],
    [activateFormitTool, wsmActiveTool, isFaceDragAfterSketching],
  )

  const shapes3dTools = useMemo<ToolConfig[]>(
    () => [
      {
        // TODO: These get both 3D Shapes and underlying FormIt tool analytics
        label: (t) => t(($) => $.hotkeys.freeform),
        icon: PrismIcon,
        onClick: () => {
          activateFormitTool(FormIt.ToolType.POLYLINE)
          // Enable drag face after sketching
          FormIt.SetFeatureFlag(WSM.Tools.kFaceDragAfterSketching, true)
          Analytics.trackSelectTool("3dSketch", "Freeform", "toolbar", "design-tool")
        },
        active: wsmActiveTool === FormIt.ToolType.POLYLINE && isFaceDragAfterSketching,
      },
      {
        label: (t) => t(($) => $.shapes.cuboid),
        icon: PrimitivesCubeIcon,
        onClick: () => {
          activateFormitTool(FormIt.ToolType.RECTANGLE)
          // Enable drag face after sketching
          FormIt.SetFeatureFlag(WSM.Tools.kFaceDragAfterSketching, true)
          Analytics.trackSelectTool("3dSketch", "Cuboid", "toolbar", "design-tool")
        },
        active: wsmActiveTool === FormIt.ToolType.RECTANGLE && isFaceDragAfterSketching,
      },
      {
        label: (t) => t(($) => $.shapes.cylinder),
        icon: PrimitivesCylinderIcon,
        onClick: () => {
          activateFormitTool(FormIt.ToolType.CIRCLE)
          // Enable drag face after sketching
          FormIt.SetFeatureFlag(WSM.Tools.kFaceDragAfterSketching, true)
          Analytics.trackSelectTool("3dSketch", "Cylinder", "toolbar", "design-tool")
        },
        active: wsmActiveTool === FormIt.ToolType.CIRCLE && isFaceDragAfterSketching,
      },
    ],
    [wsmActiveTool, isFaceDragAfterSketching, activateFormitTool],
  )

  const advancedModellingTools: ToolConfig[] = useMemo(
    () => [
      {
        label: (t) => t(($) => $.transform.union.name),
        icon: AdvancedModelingUnionIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.JOIN),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.JOIN)
        },
      },
      {
        label: (t) => t(($) => $.transform.subtract.name),
        icon: AdvancedModelingSubtractIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.CUT),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.CUT)
        },
      },
      {
        label: (t) => t(($) => $.transform.intersect.name),
        icon: AdvancedModelingIntersectIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.INTERSECT),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.INTERSECT)
        },
      },
      {
        label: (t) => t(($) => $.transform.sweep),
        icon: AdvancedModelingSweepIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.SWEEP),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.SWEEP)
        },
      },
      {
        label: (t) => t(($) => $.transform.cover),
        icon: AdvancedModelingCoverIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.COVER_EDGES),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.COVER_EDGES)
        },
      },
      {
        label: (t) => t(($) => $.transform.loft),
        icon: AdvancedModelingLoftIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.LOFT_EDGES),
        onClick: () => {
          activateFormitTool(FormIt.ToolType.LOFT_EDGES)
        },
      },
      {
        label: (t) => t(($) => $.transform.shell),
        icon: AdvancedModelingShellIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.SHELL_BODY),
        onClick: () => {
          setIsButtonClickedState(true)
          const shellDialogState: DimensionInputDialogType = {
            isOpen: true,
            title: "Shell",
            type: "shell",
            inputLabel: "Shell Thickness",
            defaultValue: -1,
            shell: { defaultValue: dimensionInputDialog.shell?.defaultValue ?? -1 },
            offset: { defaultValue: dimensionInputDialog.offset?.defaultValue ?? -1 },
            fillet: { defaultValue: dimensionInputDialog.fillet?.defaultValue ?? 1 },
          }
          setDimensionInputDialog(shellDialogState)
          setWSMActiveTool(FormIt.ToolType.SHELL_BODY)
        },
      },
      {
        label: (t) => t(($) => $.transform.offset.name),
        icon: AdvancedModelingOffsetIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.OFFSET_BODY),
        onClick: () => {
          setIsButtonClickedState(true)
          const offsetDialogState: DimensionInputDialogType = {
            isOpen: true,
            title: "Offset",
            type: "offset",
            inputLabel: "Offset Distance",
            defaultValue: -1,
            offset: { defaultValue: dimensionInputDialog.offset?.defaultValue ?? -1 },
            fillet: { defaultValue: dimensionInputDialog.fillet?.defaultValue ?? 1 },
            shell: { defaultValue: dimensionInputDialog.shell?.defaultValue ?? -1 },
          }
          setDimensionInputDialog(offsetDialogState)
          setWSMActiveTool(FormIt.ToolType.OFFSET_BODY)
        },
      },
      {
        label: (t) => t(($) => $.transform.fillet),
        icon: AdvancedModelingFilletIcon,
        shortCut: getShortcutFromToolType(FormIt.ToolType.BLEND),
        onClick: () => {
          setIsButtonClickedState(true)
          const filletDialogState: DimensionInputDialogType = {
            isOpen: true,
            title: "Fillet",
            type: "fillet",
            inputLabel: "Fillet Radius",
            defaultValue: 1,
            fillet: { defaultValue: dimensionInputDialog.fillet?.defaultValue ?? 1 },
            offset: { defaultValue: dimensionInputDialog.offset?.defaultValue ?? -1 },
            shell: { defaultValue: dimensionInputDialog.shell?.defaultValue ?? -1 },
          }
          setDimensionInputDialog(filletDialogState)
          setWSMActiveTool(FormIt.ToolType.BLEND)
        },
      },
    ],
    [
      activateFormitTool,
      dimensionInputDialog.fillet?.defaultValue,
      dimensionInputDialog.offset?.defaultValue,
      dimensionInputDialog.shell?.defaultValue,
      setDimensionInputDialog,
      setIsButtonClickedState,
      setWSMActiveTool,
    ],
  )

  const sketchToolbarGroup = useMemo(
    () => (
      <ToolbarGroupedButton
        id={"sketch-toolbar" + editMode}
        title={(t) => t(($) => $.wsm.actions.sketch)}
        configs={sketchTools}
        active={sketchTools.some((s) => s.active)}
      />
    ),
    [editMode, sketchTools],
  )
  const shapes3dToolbarGroup = useMemo(
    () => (
      <ToolbarGroupedButton
        id={"sketch-3d-toolbar" + editMode}
        title={(t) => t(($) => $.shapes.shapes3d)}
        configs={shapes3dTools}
        active={shapes3dTools.some((s) => s.active)}
      />
    ),
    [editMode, shapes3dTools],
  )
  const advancedModellingToolsGroup = useMemo(
    () => (
      <ToolbarGroupedButton
        active={isAdvancedToolActiveSelector}
        id={"advanced-modelling-toolbar" + editMode}
        title={(t) => t(($) => $.wsm.actions.advancedModelingTools)}
        configs={advancedModellingTools}
      />
    ),
    [advancedModellingTools, editMode, isAdvancedToolActiveSelector],
  )

  return (
    <>
      {sketchToolbarGroup}
      {shapes3dToolbarGroup}
      {advancedModellingToolsGroup}
      <ExplicitToolsToolbar />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton />
    </>
  )
}

export function useStart3DSketch() {
  const i3dsAPI = useIntegrated3DSketchAPI()
  const canEdit = canEditProposalSignal.value
  return useCallback(() => {
    if (!canEdit) return
    i3dsAPI.create3dMesh(Integrated3DSketchEditModeType.Default)
    sceneManager.canvas.focus()
  }, [canEdit, i3dsAPI])
}

export function useStart3DBuilding() {
  const i3dsAPI = useIntegrated3DSketchAPI()
  const canEdit = canEditProposalSignal.value
  return useCallback(
    (method: Method) => {
      if (!canEdit) return
      i3dsAPI.create3dBuilding(method)
      sceneManager.canvas.focus()
    },
    [canEdit, i3dsAPI],
  )
}

export default function Integrated3DSketchSketchModeButton() {
  const canEdit = canEditProposalSignal.value
  const i3dsAPI = useIntegrated3DSketchAPI()
  const edit3dSketch = useEditIn3DSketch("toolbar")
  const shouldEditIn3dSketch = useShouldBeEditedIn3DSketch()
  const selectedNodes = selectedTopLevelNodesSignal.value
  const isElementEditableIn3dSketch = isElementEditableIn3DSketchWithCheckSignal.value

  // Determine if edit in 3d sketch button should be shown or create
  const showEditIn3dSketch = useMemo(() => {
    const isSingleSelected = selectedNodes.length === 1
    return isSingleSelected && (shouldEditIn3dSketch(selectedNodes[0]?.path) || isElementEditableIn3dSketch)
  }, [isElementEditableIn3dSketch, selectedNodes, shouldEditIn3dSketch])

  const start3dSketch = useCallback(() => {
    setSelectedSectionBoxSignal(undefined)
    // only track 3DS "create" mode if we're not editing
    // since editing (and what element type) is already tracked elsewhere
    if (!showEditIn3dSketch) Analytics.trackSelectTool("3dSketch", undefined, "toolbar")
    if (showEditIn3dSketch) edit3dSketch()
    else i3dsAPI.create3dMesh(Integrated3DSketchEditModeType.Default)
    sceneManager.canvas.focus()
  }, [showEditIn3dSketch, edit3dSketch, i3dsAPI])

  const t = useTranslator()

  return (
    <>
      <forma-toolbar-button
        onClick={start3dSketch}
        id={showEditIn3dSketch ? "conceptual-edit" : "conceptual"}
        disabled={!canEdit}
      >
        {showEditIn3dSketch ? <Sketch3DIcon showEditArrow={true} /> : <Sketch3DIcon />}
        <forma-expanded-tooltip
          target-id={showEditIn3dSketch ? "conceptual-edit" : "conceptual"}
          text={showEditIn3dSketch ? t(($) => $.wsm.actions.editIn) : t(($) => $.wsm.actions.launch)}
          position="bottom"
          loadingduration={900}
          style={{ width: 0, height: 0 }}
        >
          <div>
            <img
              src={toolTipImage3DSketch}
              alt={t(($) => $.wsm.actions.launch)}
              height="110"
              width="196"
              loading="lazy"
            />
            <p>{t(($) => $.wsm.tooltips.launch)}</p>
          </div>
        </forma-expanded-tooltip>
      </forma-toolbar-button>
    </>
  )
}
