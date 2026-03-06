import { atom, selector } from "recoil"
import { wsmModelChangedPayload } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import { METER_TO_FEET } from "@spacemakerai/forma-units"
import type { DimensionInputDialogType } from "./types"
import {
  defaultFloorHeightImperial,
  defaultFloorHeightMetric,
  WSM_MACHINE_TOL,
} from "src/integrations/wsm-tools/wsr/api/types"
import { toolMeta } from "src/integrations/wsm-tools/wsr/toolMeta"
import { HotkeyCategory } from "src/core/hotkeys"
import { computed, signal } from "@preact/signals"
import { isCurrentI3DSPathBuilding } from "src/integrations/wsm-tools/building/buildingFloorUtils"
import { in3DSketchSignal } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"
import type { ValidationError } from "src/core/elements/validation/geometry-validation/errors"
import groupBy from "lodash/groupBy"
import { hasLowestNonHorizontalFaces } from "src/integrations/wsm-tools/wsr/tools/toolUtils"

export const isSelectionChangedState = atom<any>({
  key: "i3ds_isSelectionChangedState",
  default: new Object(),
})

export const wsmChangedSelector = selector({
  key: "i3ds_wsmChangedSelector",
  get({ get }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isSelectionChanged = get(isSelectionChangedState)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isModelChanged = get(wsmModelChangedPayload)
    return new Object()
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export function wsmDefaultFloorHeightInFeet(isImperial: boolean) {
  return isImperial ? defaultFloorHeightImperial : defaultFloorHeightMetric * METER_TO_FEET
}

export const dimensionInputDialogState = atom<DimensionInputDialogType>({
  key: "i3ds_dimensionInputDialogState",
  default: {
    type: "",
    isOpen: false,
    title: "",
    inputLabel: "",
    defaultValue: -1,
    offset: { defaultValue: -1 },
    shell: { defaultValue: -1 },
    fillet: { defaultValue: 1 },
  },
})

export const wsmActiveToolState = atom<FormIt.ToolType>({
  key: "i3ds_wsmActiveTool",
  default: 0,
})

// Signal for the last draw tool id
export const wsmLastSketchToolSignal = signal(0)
export const wsmLastSketchToolBuildingSignal = signal(0)

// Store the last tool id if it's a Sketch Tool
export const setLastDrawToolID = (toolType: FormIt.ToolType) => {
  if (
    toolMeta
      ?.filter((val) => val.Category === HotkeyCategory["Sketch Tools"])
      .map((val) => val.ToolType)
      .includes(toolType)
  ) {
    if (isCurrentI3DSPathBuilding()) wsmLastSketchToolBuildingSignal.value = toolType
    else wsmLastSketchToolSignal.value = toolType
  }
}

export const wsmIsAdvancedToolActiveSelector = selector({
  key: "i3ds_wsmIsAdvancedToolActiveSelector",
  get({ get }) {
    return [
      FormIt.ToolType.JOIN,
      FormIt.ToolType.CUT,
      FormIt.ToolType.SWEEP,
      FormIt.ToolType.COVER_EDGES,
      FormIt.ToolType.LOFT_EDGES,
      FormIt.ToolType.OFFSET_BODY,
      FormIt.ToolType.BLEND,
    ].includes(get(wsmActiveToolState))
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

// Signal for the current tool id
export const wsmToolIDSignal = signal<FormIt.ToolType>(0)

// Signal to determine if the current tool is not a Sketch Tool and not the drag face tool
export const wsmIsNotSketchOrDragToolActiveSignal = computed(() => {
  if (!in3DSketchSignal.value) return false
  // Not a sketch tool
  return (
    !toolMeta
      ?.filter((val) => val.Category === HotkeyCategory["Sketch Tools"])
      .map((val) => val.ToolType)
      .includes(wsmToolIDSignal.value) &&
    // and not the drag face tool
    wsmToolIDSignal.value !== FormIt.ToolType.DRAG_FACE
  )
})

export const selectionMenuOpenState = atom<boolean>({
  key: "i3ds_selectionMenuOpenState",
  default: false,
})

export const guidesMeasurementMenuOpenState = atom<boolean>({
  key: "i3ds_guidesMeasurementMenuOpenState",
  default: false,
})

export const inContextEditingState = atom<boolean>({
  key: "i3ds_inContextEditingState",
  default: false,
})

export const showSurroundingsState = atom<boolean>({
  key: "i3ds_showSurroundingsState",
  default: false,
})

export const backfaceSelectedState = atom<boolean>({
  key: "i3ds_backfaceSelectedState",
  default: true,
})

export const visibilityMenuOpen = atom<boolean>({
  key: "i3ds_visibilityMenuOpen",
  default: false,
})

export const showModelDiagnosticsState = atom<boolean>({
  key: "i3ds_showModelDiagnosticsState",
  default: true,
})

export const nonWatertightSelectedState = atom<boolean>({
  key: "i3ds_nonWatertightSelectedState",
  default: true,
})

export const isButtonClickedState = atom<boolean>({
  key: "isButtonClickedState",
  default: false,
})

export const wsmIsBuildingSignal = computed(() => {
  // Rerender depends on 3D Sketch viz or model change
  if (!in3DSketchSignal.value || !wsmModelChangedNotContinuousSignal.value) return false

  // Get the instance path
  const instancePath = FormIt.GroupEdit.GetInContextEditingPath()
  if (instancePath.ids.length === 0) return false

  // Get the level ids
  const levelIds = WSM.APIGetObjectLevelsReadOnly(instancePath.ids[0].History, instancePath.ids[0].Object)

  if (!levelIds.length) return false

  // Check if non-zero height
  const instanceBox = WSM.APIGetBoxReadOnly(instancePath.ids[0].History, instancePath.ids[0].Object)
  const hasHeight = instanceBox?.upper.z - instanceBox?.lower.z >= WSM_MACHINE_TOL

  return hasHeight
})

export const wsmBuildingHasNoFloorAreaSignal = computed(() => {
  // Rerender depends on building status or model change
  if (!in3DSketchSignal.value || !wsmIsBuildingSignal.value || !wsmModelChangedNotContinuousSignal.value) return false

  // Get the instance path
  const instancePath = FormIt.GroupEdit.GetInContextEditingPath()
  if (instancePath.ids.length === 0) return false

  // Get the level ids
  const levelIds = WSM.APIGetObjectLevelsReadOnly(instancePath.ids[0].History, instancePath.ids[0].Object)

  if (!levelIds.length) return false

  // Get elevation of first level object
  const firstFloorData = FormIt.Levels.GetLevelData(instancePath.ids[0].History, levelIds[0])
  const firstFloorElevation = firstFloorData.LevelData.Elevation.toFixed(8)

  // Get the rendered level loops
  const levelLoops = FormIt.Levels.GetLoopsForObject(instancePath.ids[0].History, instancePath.ids[0].Object)

  // Group level loops by their z coordinates (to nearest 8 decimal places)
  const levelLoopsGrouped = Object.keys(groupBy(levelLoops, (levelLoop) => levelLoop[0].z.toFixed(8)))
  if (!levelLoops.length) return false
  const lowestLevelElevation = levelLoops[0][0].z.toFixed(8)

  const firstFloorHasArea = firstFloorElevation === lowestLevelElevation

  const levelDifference = levelIds.length - levelLoopsGrouped.length

  // True if first floor has area and levels are different
  // or if first floor has no area and there are more than 1 level difference
  return (firstFloorHasArea && levelDifference > 0) || (!firstFloorHasArea && levelDifference > 1)
})

export const wsmBuildingHasNoBottomFloorAreaSignal = computed(() => {
  // Rerender depends on building status or model change
  if (!in3DSketchSignal.value || !wsmIsBuildingSignal.value || !wsmModelChangedNotContinuousSignal.value) return false

  // Get the instance path
  const instancePath = FormIt.GroupEdit.GetInContextEditingPath()
  if (instancePath.ids.length === 0) return false

  // Get the level ids
  const levelIds = WSM.APIGetObjectLevelsReadOnly(instancePath.ids[0].History, instancePath.ids[0].Object)

  if (!levelIds.length) return false

  // No bottom floor area if the lowest eligible face is not horizontal. Uses the same method
  // to determine that face as the code that flattens it.
  return hasLowestNonHorizontalFaces(instancePath.ids[0].History, instancePath.ids[0].Object)
})

// Signal to check if building has non-manifold geometry
export const wsmBuildingHasNonManifoldSignal = computed(() => {
  if (!in3DSketchSignal.value || !wsmIsBuildingSignal.value || !wsmModelChangedNotContinuousSignal.value) return false

  return wsrHasNonManifoldSignal.value
})

// Signal to check if generic volume has non-manifold geometry
export const wsmGenericVolumeHasNonManifoldSignal = computed(() => {
  if (!in3DSketchSignal.value || wsmIsBuildingSignal.value || !wsmModelChangedNotContinuousSignal.value) return false

  return wsrHasNonManifoldSignal.value
})

// Signal for non-manifold geometry reported by WSR
export const wsrHasNonManifoldSignal = signal(false)

// signal when wsm model changes
export const wsmModelChangedNotContinuousSignal = signal({})

// signal for current wsm validation errors
export const wsmCurrentValidationErrorsSignal = computed(() => {
  if (!in3DSketchSignal.value) return []

  return [
    ...(wsmBuildingHasNoFloorAreaSignal.value ? [{ type: "wsm-floor-no-area", path: "" }] : []),
    ...(wsmBuildingHasNoBottomFloorAreaSignal.value ? [{ type: "wsm-bottom-floor-no-area", path: "" }] : []),
    ...(wsmBuildingHasNonManifoldSignal.value ? [{ type: "wsm-non-manifold-building", path: "" }] : []),
    ...(wsmGenericVolumeHasNonManifoldSignal.value ? [{ type: "wsm-non-manifold-volume", path: "" }] : []),
  ] as ValidationError[]
})

// Signal to track the previously shown validation errors
export const wsmPreviousValidationErrorsSignal = signal<ValidationError[]>([])

// Filtered validation errors (freezes at previous errors during sketch/drag operations)
export const wsmValidationErrorsSignal = computed(() => {
  if (!in3DSketchSignal.value) return []

  const currentErrors = wsmCurrentValidationErrorsSignal.value

  // Show current errors when not actively sketching/dragging, previous errors when sketching/dragging
  return wsmIsNotSketchOrDragToolActiveSignal.value ? currentErrors : wsmPreviousValidationErrorsSignal.value
})
