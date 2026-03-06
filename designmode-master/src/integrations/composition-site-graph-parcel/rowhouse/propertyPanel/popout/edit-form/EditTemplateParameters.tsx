import { useCallback } from "react"
import styles from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/popout/RowhouseTypologiesPopup.module.pcss"
import propertyPanelStyles from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/sideBar/RowHousePropertyPanel.module.pcss"
import Divider from "src/integrations/building-systems-site-study/ExploreMenu/Divider"
import { useEffect } from "preact/hooks"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import PopUpBox from "src/lib/components/PopUps/PopUpBox"
import {
  WeaveInputComponent,
  withAccess,
  withImperial,
  withNumber,
} from "src/lib/components/LengthInput/WeaveInputHelpers"
import Width_16 from "src/lib/components/icons/Width_16"
import Length_16 from "src/lib/components/icons/Length_16"
import NumberOfFloors_16 from "src/lib/components/icons/NumberOfFloors_16"
import StoryHeight_16 from "src/lib/components/icons/StoryHeight_16"
import { useMemo, useState } from "preact/compat"
import {
  AlignHorizontalCenter_16,
  AlignHorizontalLeft_16,
  AlignHorizontalRight_16,
  AlignVerticalBottom_16,
  AlignVerticalCenter_16,
  AlignVerticalTop_16,
} from "src/lib/components/icons/Align_16"
import GableRoof_24 from "src/lib/components/icons/GableRoof_24"
import ShedRoof_24 from "src/lib/components/icons/ShedRoof_24"
import FlatRoof_24 from "src/lib/components/icons/FlatRoof_24"
import Angle_16 from "src/lib/components/icons/Angle_16"
import RotateAroundAxis_16 from "src/lib/components/icons/RotateAroundAxis_16"
import type { ParcelParameters } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { IconCarousel } from "src/lib/components/IconCarousel/IconCarousel"
import { AnalyticsLegacy } from "src/core/analytics"
import {
  CompositionEventNames,
  CompositionTrackingDataNames,
} from "src/integrations/composition/CompositionMixpanelEventNames"
import TextInput from "src/integrations/inputs/TextInput"
import type { CameraPreset } from "src/integrations/composition-site-graph-parcel/rowhouse/preview"
import { FormaFunctionDropdown } from "src/lib/components/FormaFunctionDropdown"
import type { RowHouseParameters } from "src/integrations/composition-row-house-generator/api"
import { PROJECT_ID } from "src/core/project/project"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useTranslator } from "src/i18n"

export const EditingHeader = ({
  templateName,
  currentlyRenaming,
  onRename,
  onCancel,
}: {
  templateName: string
  currentlyRenaming: boolean
  onRename: (name: string) => void
  onCancel: () => void
}) => {
  return (
    <>
      <PopUpBox.HeaderTitle>
        {currentlyRenaming ? (
          <PopupHeaderRenameField templateName={templateName} onRename={onRename} />
        ) : (
          <div>{templateName}</div>
        )}
      </PopUpBox.HeaderTitle>
      <weave-button variant="flat" onMouseDown={(e) => e.stopPropagation()} onClick={onCancel} tabIndex={1}>
        Cancel
      </weave-button>
    </>
  )
}

function PopupHeaderRenameField({
  templateName,
  onRename,
}: {
  templateName: string
  onRename: (title: string) => void
}) {
  return (
    <div
      onMouseDown={(e) => {
        e.stopPropagation()
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
      }}
    >
      <TextInput initialValue={templateName} onBlur={onRename} isSelected={true} />
    </div>
  )
}

const DistanceInput = withAccess(withImperial(WeaveInputComponent))
const UnitInput = withAccess(withNumber(WeaveInputComponent))

export function EditTemplateParameters({
  templateId,
  rowHouseParameters,
  parcelParameters,
  functionId,
  setFunctionId,
  onChange,
  onPublish,
  onChangeCameraPreset,
}: {
  templateId: string
  rowHouseParameters: RowHouseParameters
  parcelParameters: ParcelParameters
  setFunctionId: (functionId: string) => void
  functionId: string
  onPublish: (rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => Promise<void>
  onChange: (rowHouseParameters: RowHouseParameters, parcelParameters: ParcelParameters) => void
  onChangeCameraPreset: (preset: CameraPreset) => void
}) {
  const t = useTranslator()
  const actionAPI = useActionAPI()
  const [publishing, setPublishing] = useState(false)

  const onChangeRowHouseParameters = useCallback(
    (parameter: keyof RowHouseParameters, value: RowHouseParameters[keyof RowHouseParameters]) => {
      // Don't track this with new tracking schema
      AnalyticsLegacy.track(CompositionEventNames.Templates_ParameterUpdate, {
        [CompositionTrackingDataNames.templateId]: templateId,
        [CompositionTrackingDataNames.parameterName]: parameter,
      })
      const newParameters: RowHouseParameters = {
        ...rowHouseParameters,
        [parameter]: value,
      }
      onChange(newParameters, parcelParameters)
    },
    [onChange, parcelParameters, rowHouseParameters, templateId],
  )

  const onChangeParcelParameters = useCallback(
    (parameter: keyof ParcelParameters, value: ParcelParameters[keyof ParcelParameters]) => {
      // Don't track this with new tracking schema
      AnalyticsLegacy.track(CompositionEventNames.Templates_ParameterUpdate, {
        [CompositionTrackingDataNames.templateId]: templateId,
        [CompositionTrackingDataNames.parameterName]: parameter,
      })
      const newParameters: ParcelParameters = {
        ...parcelParameters,
        [parameter]: value,
      }
      onChange(rowHouseParameters, newParameters)
    },
    [onChange, parcelParameters, rowHouseParameters, templateId],
  )

  const publish = useCallback(() => {
    async function run() {
      setPublishing(true)
      await onPublish(rowHouseParameters, parcelParameters)
      setPublishing(false)
    }
    void run()
  }, [onPublish, parcelParameters, rowHouseParameters])

  //if click in scene and we lose selection, we need to reset preview.
  useEffect(() => {
    return () => {
      actionAPI.resetPreview_UNSTABLE()
    }
  }, [actionAPI])

  return (
    <div className={styles.EditTemplate}>
      <RowhouseParameters
        currentParameters={rowHouseParameters}
        onChangeParameterUpdated={onChangeRowHouseParameters}
        onChangeCameraPreset={onChangeCameraPreset}
      />
      <Divider />
      <ParcelParametersComponent
        currentParameters={parcelParameters}
        onChangeParameterUpdated={onChangeParcelParameters}
        onChangeCameraPreset={onChangeCameraPreset}
      />
      <Divider />
      <LayoutParameters
        currentParameters={parcelParameters}
        onChangeParameterUpdated={onChangeParcelParameters}
        onChangeCameraPreset={onChangeCameraPreset}
      />
      <div style={{ marginTop: "16px" }}>
        <hr className={propertyPanelStyles.Divider} />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <FormaFunctionDropdown
          projectId={PROJECT_ID}
          canEdit={canEditProposalSignal.value}
          setBuildingFunction={(f) => setFunctionId(f.functionId!)}
          selectedBuildingFunctions={[{ functionId }]}
        />
      </div>
      <div className={styles.EditTemplateSection}>
        <weave-button
          variant="solid"
          iconposition="left"
          density="medium"
          onClick={publish}
          className={styles.FullWidth}
          disabled={publishing}
          tabIndex={1}
        >
          {publishing ? (
            <weave-progress style={{ color: "rgba(0,0,0,0)" }} size={"xs"} />
          ) : (
            t(($) => $.rowhouse.publish)
          )}
          <span slot="explain">{t(($) => $.rowhouse.publish)}</span>
        </weave-button>
      </div>
    </div>
  )
}

function RowhouseParameters({
  currentParameters,
  onChangeParameterUpdated,
  onChangeCameraPreset,
}: {
  currentParameters: RowHouseParameters
  onChangeParameterUpdated: <T extends keyof RowHouseParameters>(parameter: T, value: RowHouseParameters[T]) => void
  onChangeCameraPreset: (preset: CameraPreset) => void
}) {
  const t = useTranslator()
  return (
    <div className={styles.EditTemplateSection}>
      <p className={styles.FullWidth}>{t(($) => $.rowhouse.buildingLabel)}</p>

      <label htmlFor="buildingWidth" className={styles.IconA}>
        <weave-tooltip text={t(($) => $.rowhouse.tooltips.width)}>
          <Width_16 />
        </weave-tooltip>
      </label>
      <DistanceInput
        id={"buildingWidth"}
        className={styles.InputA}
        tabIndex={1}
        metricValue={currentParameters.buildingWidth}
        onChangeValue={(newValue) => onChangeParameterUpdated("buildingWidth", newValue)}
        editAccess={canEditProposalSignal.value}
        metricStep={0.5}
        metricMin={1}
        onFocus={() => onChangeCameraPreset("frontHigh")}
      />

      <label htmlFor="buildingDepth" className={styles.IconB}>
        <weave-tooltip text={t(($) => $.rowhouse.tooltips.length)}>
          <Length_16 />
        </weave-tooltip>
      </label>
      <DistanceInput
        id={"buildingDepth"}
        className={styles.InputB}
        tabIndex={1}
        metricValue={currentParameters.buildingDepth}
        onChangeValue={(newValue) => onChangeParameterUpdated("buildingDepth", newValue)}
        editAccess={canEditProposalSignal.value}
        metricStep={0.5}
        metricMin={1}
        onFocus={() => onChangeCameraPreset("sideHigh")}
      />

      <label htmlFor="numberOfFloors" className={styles.IconA}>
        <weave-tooltip text={t(($) => $.rowhouse.tooltips.numberOfFloors)}>
          <NumberOfFloors_16 />
        </weave-tooltip>
      </label>
      <UnitInput
        id={"numberOfFloors"}
        type="number"
        value={currentParameters.numberOfStories}
        onChangeValue={(newVal) => onChangeParameterUpdated("numberOfStories", newVal)}
        step={1}
        min={1}
        max={20}
        className={styles.InputA}
        tabIndex={1}
        editAccess={canEditProposalSignal.value}
        onFocus={() => onChangeCameraPreset("default")}
      />

      <label htmlFor="storyHeight" className={styles.IconB}>
        <weave-tooltip text={t(($) => $.rowhouse.tooltips.storyHeight)}>
          <StoryHeight_16 />
        </weave-tooltip>
      </label>
      <DistanceInput
        id={"storyHeight"}
        metricValue={currentParameters.storyHeight}
        onChangeValue={(newVal) => onChangeParameterUpdated("storyHeight", newVal)}
        metricStep={0.5}
        className={styles.InputB}
        tabIndex={1}
        editAccess={canEditProposalSignal.value}
        onFocus={() => onChangeCameraPreset("default")}
      />

      <IconCarousel<RowHouseParameters["roofShape"]>
        items={{
          gable: (
            <weave-tooltip text={t(($) => $.rowhouse.tooltips.gableRoof)}>
              <GableRoof_24 />
            </weave-tooltip>
          ),
          shed: (
            <weave-tooltip text={t(($) => $.rowhouse.tooltips.shedRoof)}>
              <ShedRoof_24 />
            </weave-tooltip>
          ),
          flat: (
            <weave-tooltip text={t(($) => $.rowhouse.tooltips.flatRoof)}>
              <FlatRoof_24 />
            </weave-tooltip>
          ),
        }}
        currentItem={currentParameters.roofShape}
        onCurrentItemChanged={(newVal) => {
          onChangeCameraPreset("default")
          onChangeParameterUpdated("roofShape", newVal)
        }}
        editAccess={canEditProposalSignal.value}
        tabIndex={1}
      />

      <label htmlFor="roofAngle" className={styles.IconB}>
        <weave-tooltip text={t(($) => $.rowhouse.tooltips.roofAngle)}>
          <Angle_16 />
        </weave-tooltip>
      </label>
      <UnitInput
        id={"roofAngle"}
        value={currentParameters.roofAngle}
        onChangeValue={(newVal) => onChangeParameterUpdated("roofAngle", newVal)}
        step={1}
        min={1}
        max={89}
        className={styles.InputB}
        tabIndex={1}
        editAccess={canEditProposalSignal.value}
        disabled={currentParameters.roofShape == "flat"}
        onFocus={() =>
          onChangeCameraPreset(
            currentParameters.roofRidgeDirection == 0 || currentParameters.roofRidgeDirection == 180
              ? "sideLow"
              : "frontLow",
          )
        }
        unit={"°"}
      />

      <label htmlFor="roofRidgeDirection" className={styles.IconB}>
        <weave-tooltip text={t(($) => $.rowhouse.tooltips.ridgeDirection)}>
          <RotateAroundAxis_16 />
        </weave-tooltip>
      </label>
      <RoofRidgeDirectionDropdown
        id={"roofRidgeDirection"}
        className={styles.InputB}
        tabIndex={1}
        roofShape={currentParameters.roofShape}
        roofRidgeDirection={currentParameters.roofRidgeDirection}
        onRoofRidgeDirectionChange={(newVal) => onChangeParameterUpdated("roofRidgeDirection", newVal)}
        onFocus={() => onChangeCameraPreset("default")}
      />
    </div>
  )
}

function RoofRidgeDirectionDropdown({
  roofShape,
  roofRidgeDirection,
  onRoofRidgeDirectionChange,
  ...props
}: {
  roofShape: RowHouseParameters["roofShape"]
  roofRidgeDirection: RowHouseParameters["roofRidgeDirection"]
  onRoofRidgeDirectionChange: (newValue: RowHouseParameters["roofRidgeDirection"]) => void
} & JSX.IntrinsicElements["forma-select-native"]) {
  type RoofRidgeDirection = NonNullable<RowHouseParameters["roofRidgeDirection"]>
  const optionValues: RoofRidgeDirection[] = [90, 270, 180, 0]
  const optionLabels: Record<RoofRidgeDirection, string> = useMemo(
    () =>
      ({
        gable: { 0: "Along", 90: "Across", 180: "Along", 270: "Across" },
        shed: { 0: "Front", 90: "Right", 180: "Back", 270: "Left" },
        flat: { 0: "Flat", 90: "Flat", 180: "Flat", 270: "Flat" },
      })[roofShape],
    [roofShape],
  )
  const optionVisibility: Record<RoofRidgeDirection, boolean> = useMemo(
    () =>
      ({
        // Gabled roofs only need options 0 or 90, but our current value might
        // be 180 or 270 if roof was shed and later changed to gable. Thus we
        // switch between using 0/90 or 180/270 depending on the current value
        gable: {
          0: roofRidgeDirection == 0 || roofRidgeDirection == 90,
          90: roofRidgeDirection == 0 || roofRidgeDirection == 90,
          180: roofRidgeDirection == 180 || roofRidgeDirection == 270,
          270: roofRidgeDirection == 180 || roofRidgeDirection == 270,
        },
        shed: { 0: true, 90: true, 180: true, 270: true },
        flat: { 0: true, 90: true, 180: true, 270: true },
      })[roofShape],
    [roofShape, roofRidgeDirection],
  )
  return (
    <forma-select-native
      {...props}
      value={roofRidgeDirection}
      disabled={!canEditProposalSignal.value || roofShape == "flat"}
      onChange={(e) =>
        onRoofRidgeDirectionChange(parseInt((e as CustomEvent<{ value: string }>).detail.value) as RoofRidgeDirection)
      }
    >
      <>
        {optionValues.map((direction) => (
          <option key={direction} value={direction} style={{ display: optionVisibility[direction] ? "block" : "none" }}>
            {optionLabels[direction]}
          </option>
        ))}
      </>
    </forma-select-native>
  )
}

function ParcelParametersComponent({
  currentParameters,
  onChangeParameterUpdated,
  onChangeCameraPreset,
}: {
  currentParameters: ParcelParameters
  onChangeParameterUpdated: <T extends keyof ParcelParameters>(parameter: T, value: ParcelParameters[T]) => void
  onChangeCameraPreset: (preset: CameraPreset) => void
}) {
  const t = useTranslator()
  return (
    <div className={styles.EditTemplateSection}>
      <p className={styles.FullWidth}>{t(($) => $.rowhouse.parcelLabel)}</p>
      <label htmlFor="width" className={styles.IconA}>
        <weave-tooltip text={t(($) => $.rowhouse.tooltips.width)}>
          <Width_16 />
        </weave-tooltip>
      </label>
      <DistanceInput
        id={"width"}
        className={styles.InputA}
        tabIndex={1}
        metricValue={currentParameters.width}
        onChangeValue={(newValue) => onChangeParameterUpdated("width", newValue)}
        editAccess={canEditProposalSignal.value}
        metricStep={0.5}
        metricMin={1}
        onFocus={() => onChangeCameraPreset("frontHigh")}
      />

      <label htmlFor="depth" className={styles.IconB}>
        <weave-tooltip text={t(($) => $.rowhouse.tooltips.length)}>
          <Length_16 />
        </weave-tooltip>
      </label>
      <DistanceInput
        id={"depth"}
        className={styles.InputB}
        tabIndex={1}
        metricValue={currentParameters.depth}
        onChangeValue={(newValue) => onChangeParameterUpdated("depth", newValue)}
        editAccess={canEditProposalSignal.value}
        metricStep={0.5}
        metricMin={1}
        onFocus={() => onChangeCameraPreset("sideHigh")}
      />
    </div>
  )
}

type LayoutState = { x: 0 | 1 | 2; y: 0 | 1 | 2 }

const placementToIndex = { start: 0, center: 1, end: 2 } as const
const indexToLayout = { 0: "start", 1: "center", 2: "end" } as const
const iconMap = {
  x: { start: AlignHorizontalLeft_16, center: AlignHorizontalCenter_16, end: AlignHorizontalRight_16 },
  y: { start: AlignVerticalTop_16, center: AlignVerticalCenter_16, end: AlignVerticalBottom_16 },
} satisfies {
  x: Record<ParcelParameters["buildingPositionParameters"]["x"]["type"], () => JSX.Element>
  y: Record<ParcelParameters["buildingPositionParameters"]["y"]["type"], () => JSX.Element>
}

function LayoutParameters({
  currentParameters,
  onChangeParameterUpdated,
  onChangeCameraPreset,
}: {
  currentParameters: ParcelParameters
  onChangeParameterUpdated: <T extends keyof ParcelParameters>(parameter: T, value: ParcelParameters[T]) => void
  onChangeCameraPreset: (preset: CameraPreset) => void
}) {
  const t = useTranslator()
  const layout: LayoutState = useMemo(() => {
    return {
      x: placementToIndex[currentParameters.buildingPositionParameters.x.type],
      y: placementToIndex[currentParameters.buildingPositionParameters.y.type],
    }
  }, [currentParameters.buildingPositionParameters.x.type, currentParameters.buildingPositionParameters.y.type])

  const setLayout = useCallback(
    (l: LayoutState) => {
      const prev = currentParameters.buildingPositionParameters
      const xType = indexToLayout[l.x]
      const yType = indexToLayout[l.y]
      const newLayout: ParcelParameters["buildingPositionParameters"] = {
        x: xType === "center" ? { type: xType } : { type: xType, buffer: prev.x.type === xType ? prev.x.buffer : 0 },
        y: yType === "center" ? { type: yType } : { type: yType, buffer: prev.y.type === yType ? prev.y.buffer : 0 },
      }
      onChangeParameterUpdated("buildingPositionParameters", newLayout)
    },
    [currentParameters, onChangeParameterUpdated],
  )

  return (
    <div className={styles.EditTemplateSection}>
      <p className={styles.FullWidth}>{t(($) => $.rowhouse.layoutLabel)}</p>

      <LayoutThing
        className={styles.LayoutSVG}
        state={layout}
        setState={setLayout}
        onChangeCameraPreset={onChangeCameraPreset}
        editAccess={canEditProposalSignal.value}
        tabIndex={1}
      />

      <label htmlFor="xFloat" className={styles.IconB}>
        {iconMap.x[currentParameters.buildingPositionParameters.x.type]()}
      </label>
      <DistanceInput
        id={"xFloat"}
        className={styles.InputB}
        tabIndex={1}
        metricValue={
          currentParameters.buildingPositionParameters.x.type !== "center"
            ? currentParameters.buildingPositionParameters.x.buffer
            : undefined
        }
        onChangeValue={(newValue) => {
          if (currentParameters.buildingPositionParameters.x.type === "center") return
          onChangeParameterUpdated("buildingPositionParameters", {
            ...currentParameters.buildingPositionParameters,
            x: { ...currentParameters.buildingPositionParameters.x, buffer: newValue },
          })
        }}
        placeholder={currentParameters.buildingPositionParameters.x.type === "center" ? "Center" : undefined}
        disabled={currentParameters.buildingPositionParameters.x.type === "center"}
        editAccess={canEditProposalSignal.value}
        metricStep={0.5}
        onFocus={() => onChangeCameraPreset("above")}
      />

      <label htmlFor="yFloat" className={styles.IconB}>
        {iconMap.y[currentParameters.buildingPositionParameters.y.type]()}
      </label>
      <DistanceInput
        id={"yFloat"}
        className={styles.InputB}
        tabIndex={1}
        placeholder={currentParameters.buildingPositionParameters.y.type === "center" ? "Center" : undefined}
        disabled={currentParameters.buildingPositionParameters.y.type === "center"}
        metricValue={
          currentParameters.buildingPositionParameters.y.type !== "center"
            ? currentParameters.buildingPositionParameters.y.buffer
            : undefined
        }
        onChangeValue={(newValue) => {
          if (currentParameters.buildingPositionParameters.y.type === "center") return
          onChangeParameterUpdated("buildingPositionParameters", {
            ...currentParameters.buildingPositionParameters,
            y: { ...currentParameters.buildingPositionParameters.y, buffer: newValue },
          })
        }}
        editAccess={canEditProposalSignal.value}
        metricStep={0.5}
        onFocus={() => onChangeCameraPreset("above")}
      />
    </div>
  )
}

function LayoutThing({
  state,
  setState,
  onChangeCameraPreset,
  editAccess,
  ...props
}: JSX.HTMLAttributes<HTMLDivElement> & {
  state: LayoutState
  setState: (newVal: LayoutState) => void
  onChangeCameraPreset: (preset: CameraPreset) => void
  editAccess: boolean
}) {
  const setClampedState = (x: number, y: number) => {
    if (!editAccess) return
    onChangeCameraPreset("above")
    const clampedX = Math.max(0, Math.min(2, x)) as 0 | 1 | 2
    const clampedY = Math.max(0, Math.min(2, y)) as 0 | 1 | 2
    setState({ x: clampedX, y: clampedY })
  }
  return (
    <div
      {...props}
      onKeyDown={(event) => {
        if (event.key == "ArrowLeft") setClampedState(state.x - 1, state.y)
        if (event.key == "ArrowRight") setClampedState(state.x + 1, state.y)
        if (event.key == "ArrowUp") setClampedState(state.x, state.y - 1)
        if (event.key == "ArrowDown") setClampedState(state.x, state.y + 1)
      }}
    >
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="59" height="59" stroke="#808080" strokeOpacity="0.2" />
        {[12, 30, 48].map((x, i) => {
          return [12, 30, 48].map((y, j) => {
            if (state.x === i && state.y === j) {
              return (
                <g
                  key={`${i}-${j}`}
                  onClick={() => {
                    if (!editAccess) return
                    onChangeCameraPreset("above")
                  }}
                >
                  <rect
                    x={x - 5.5}
                    y={y - 5.5}
                    width="11"
                    height="11"
                    stroke="#0696D7"
                    fill="#0696D7"
                    fillOpacity={0}
                  />
                  <circle cx={x} cy={y} r="1.5" fill="#0696D7" />
                </g>
              )
            }

            return (
              <g key={`${i}-${j}`} onClick={() => setClampedState(i, j)}>
                <rect
                  x={x - 5.5}
                  y={y - 5.5}
                  width="11"
                  height="11"
                  stroke="#0696D7"
                  fill="#0696D7"
                  fillOpacity={0}
                  strokeOpacity={0}
                />
                <circle cx={x} cy={y} r="1.5" fill="#808080" />
              </g>
            )
          })
        })}
      </svg>
    </div>
  )
}
