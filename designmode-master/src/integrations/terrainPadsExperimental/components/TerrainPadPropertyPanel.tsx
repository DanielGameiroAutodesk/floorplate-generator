import { computed, signal } from "@preact/signals"
import debounce from "lodash/debounce"
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "preact/compat"
import { elementState } from "src/core/elements/ElementState"
import type { Terrain } from "src/core/elements/Terrain"
import { selectionPathsSignal } from "src/core/selection/selectionState"
import { isCustomSelectionPath, parseCustomSelectionPath } from "src/core/selection/selectionTypes"
import type { FlatPolygonV1 } from "src/core/terrain/terrain-types"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import { DEFAULT_BUFFER_RATIO } from "src/integrations/terrainPadsExperimental/utils/bufferOperations"
import { calculateGeometryVolume } from "src/integrations/terrainPadsExperimental/utils/geometryUtils"
import { icons } from "./svg-icons"
import { Mesh } from "three"
import styles from "./TerrainPadPropertyPanel.module.pcss"
import { ClickOutside } from "src/lib/components/ClickOutside2"
import combineClasses from "src/lib/combineClasses"
import { WeaveInputComponent, withAccess, withImperial } from "src/lib/components/LengthInput/WeaveInputHelpers"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { SlottedIcon } from "./SlottedIcon"
import { toolAPI } from "src/core/toolsState"
import { useIsImperial } from "src/lib/unitSettings"
import {
  TerrainEditVisuals,
  terrainEditVisualizationSignal,
} from "src/integrations/terrainPadsExperimental/visuals/TerrainEditVisuals"
import { useTranslator } from "src/i18n"

const selectedTerrainPadsSignal = computed(() =>
  Array.from(selectionPathsSignal.value)
    .filter(isCustomSelectionPath)
    .map(parseCustomSelectionPath)
    .filter(({ integration }) => integration === "terrain_pads")
    .map(({ id }) => id),
)

type SlopeUnit = "ratio" | "percentage"

const terrainSlopeUnitSignal = signal<SlopeUnit>("ratio")

const updateTerrainPad = (updatedPad: FlatPolygonV1, currentTerrain: Terrain) => {
  const changeElevationDebouncedOperation = terrainApi.getTerrainOperations(currentTerrain.element)
  const updatedTerrainPads = changeElevationDebouncedOperation.map((pad) => {
    if (pad.id === updatedPad?.id) {
      return updatedPad
    }
    return pad
  })

  terrainApi.applyTerrainOperationsToElementState(updatedTerrainPads)
}

export function TerrainPadPropertyPanel() {
  const t = useTranslator()
  const currentTerrain = elementState.currentTerrainSignal.value
  if (!currentTerrain) return null

  if (!selectedTerrainPadsSignal.value.length) {
    if (toolAPI.currentToolSignal.value.id === "terrain-pads") {
      return (
        <>
          <h3 className={styles.header}>{t(($) => $.terrain.pad.header)}</h3>
          <div className={styles.terrainPadInputsContainer}>
            <BufferInput initialBuffer={DEFAULT_BUFFER_RATIO} applyGrade={true} />
          </div>
          <TerrainEditVisuals currentTerrain={currentTerrain} />
        </>
      )
    }
    return null
  }

  const initGeometry = currentTerrain.data.baseTerrain?.baseTerrainGeometry
  if (!initGeometry) return null

  const originalTerrainVolume = calculateGeometryVolume(initGeometry)
  const massBalance = calculateSiteBalance(currentTerrain, originalTerrainVolume)

  if (selectedTerrainPadsSignal.value.length === 1) {
    const selectedId = selectedTerrainPadsSignal.value[0]
    const pad = terrainApi.getTerrainOperation(currentTerrain.element, selectedId)

    if (!pad) return null
    return (
      <>
        <SinglePadProperties key={selectedId} pad={pad} currentTerrain={currentTerrain} massBalance={massBalance} />
        <TerrainEditVisuals currentTerrain={currentTerrain} />
      </>
    )
  }

  const selectedPads = selectedTerrainPadsSignal.value
    .map((id) => terrainApi.getTerrainOperation(currentTerrain.element, id))
    .filter((pad): pad is FlatPolygonV1 => pad !== undefined)

  return (
    <>
      <MultiplePadsSummary selectedPads={selectedPads} massBalance={massBalance} currentTerrain={currentTerrain} />
      <TerrainEditVisuals currentTerrain={currentTerrain} />
    </>
  )
}

function SinglePadProperties({
  pad,
  currentTerrain,
  massBalance,
}: {
  pad: FlatPolygonV1
  currentTerrain: Terrain
  massBalance: number
}) {
  const t = useTranslator()
  const [selectedPadVolume, setSelectedPadVolume] = useState<number | null>(null)

  useEffect(() => {
    const selectedPad = calculateSelectedPadsVolume([pad], currentTerrain)
    setSelectedPadVolume(selectedPad)
  }, [pad, currentTerrain])

  const debouncedChangeElevation = useMemo(
    () =>
      debounce((newElevation: number) => {
        const updatedPad = {
          ...pad,
          elevation: newElevation,
        }
        updateTerrainPad(updatedPad, currentTerrain)
      }, 300),
    [pad, currentTerrain],
  )

  const onChangeElevation = useCallback(
    (newElevation: number) => debouncedChangeElevation(newElevation),
    [debouncedChangeElevation],
  )

  const debouncedChangeBuffer = useMemo(
    () =>
      debounce((newBuffer: number, applyGrade: boolean) => {
        const updatedPad = {
          ...pad,
          applyGrade,
          buffer: newBuffer,
        }
        updateTerrainPad(updatedPad, currentTerrain)
      }, 300),
    [pad, currentTerrain],
  )

  const onChangeBuffer = useCallback(
    (newBuffer: number, applyGrade: boolean) => debouncedChangeBuffer(newBuffer, applyGrade),
    [debouncedChangeBuffer],
  )

  const initialBuffer = pad.buffer ?? DEFAULT_BUFFER_RATIO

  return (
    <div>
      <div className={styles.header}>{t(($) => $.terrain.pad.header)}</div>
      <div className={styles.terrainPadInputsContainer}>
        <ElevationInput onChangeElevation={onChangeElevation} initElevation={pad.elevation} />

        <BufferInput
          key={pad.id}
          initialBuffer={initialBuffer}
          currentTerrain={currentTerrain}
          selectedPadId={pad.id}
          onChangeBuffer={onChangeBuffer}
          applyGrade={pad.applyGrade === undefined ? true : pad.applyGrade}
        />
      </div>
      <div className={styles.header}>{t(($) => $.terrain.metricsHeader)}</div>
      <UnitConversionDisplay
        label={t(($) => $.terrain.labels.padVolume)}
        metricValue={selectedPadVolume}
        metricUnit="m³"
        tooltip={t(($) => $.terrain.padVolumeHover)}
      />
      <UnitConversionDisplay
        label={t(($) => $.terrain.labels.totalMassBalance)}
        metricValue={massBalance}
        metricUnit="m³"
        tooltip={t(($) => $.terrain.massBalanceHover)}
      />
    </div>
  )
}

function MultiplePadsSummary({
  selectedPads,
  massBalance,
  currentTerrain,
}: {
  selectedPads: FlatPolygonV1[]
  massBalance: number
  currentTerrain: Terrain
}) {
  const t = useTranslator()
  const [selectedPadsVolume, setSelectedPadsVolume] = useState<number | null>(null)

  useEffect(() => {
    const calculatedVolume = calculateSelectedPadsVolume(selectedPads, currentTerrain)
    setSelectedPadsVolume(calculatedVolume)
  }, [selectedPads, currentTerrain])

  return (
    <div>
      <div className={styles.header}>{t(($) => $.terrain.padsHeader)}</div>
      <UnitConversionDisplay
        label={t(($) => $.terrain.labels.numberOfSelectedPads)}
        metricValue={selectedPads.length}
      />
      <UnitConversionDisplay
        label={t(($) => $.terrain.labels.padsVolume)}
        metricValue={selectedPadsVolume}
        metricUnit="m³"
        tooltip={t(($) => $.terrain.padVolumeHover)}
      />
      <UnitConversionDisplay
        label={t(($) => $.terrain.labels.totalMassBalance)}
        metricValue={massBalance}
        metricUnit="m³"
        tooltip={t(($) => $.terrain.massBalanceHover)}
      />
    </div>
  )
}

const UnitConversionDisplay = ({
  label,
  metricValue,
  metricUnit,
  tooltip,
}: {
  label: string
  metricValue: number | null
  metricUnit?: "m" | "m³"
  tooltip?: string
}) => {
  const isImperial = useIsImperial()

  const METER_TO_YARD = 1.09361

  const format = (num: number): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(num)
  }

  const convertValue = () => {
    if (metricValue === null) return null
    switch (metricUnit) {
      case "m":
        return isImperial ? metricValue * METER_TO_YARD : metricValue
      case "m³":
        return isImperial ? metricValue * METER_TO_YARD ** 3 : metricValue
      default:
        return metricValue
    }
  }

  const getUnitLabel = () => {
    if (!metricUnit) return ""
    if (isImperial) {
      switch (metricUnit) {
        case "m":
          return "yd"
        case "m³":
          return "yd³"
      }
    }
    return metricUnit
  }

  const displayValue = convertValue()

  return (
    <div className={styles.menu}>
      <weave-tooltip text={tooltip}>
        <span className={styles.label}>{label}</span>
      </weave-tooltip>
      <span className={styles.value}>
        <span className={getUnitLabel() !== "" ? styles.numberWithUnit : styles.number}>
          {displayValue !== null ? format(displayValue) : "Calculating"}
        </span>
        <span className={styles.unit}>{getUnitLabel()}</span>
      </span>
    </div>
  )
}

const calculateSelectedPadsVolume = (selectedPads: FlatPolygonV1[], currentTerrain: Terrain): number => {
  const initGeometry = currentTerrain.data.baseTerrain?.baseTerrainGeometry
  if (!initGeometry) throw new Error("Base terrain geometry is not available")
  const currentTerrainMesh = currentTerrain.mesh
  const currentTerrainVolume = calculateGeometryVolume(currentTerrainMesh.geometry)
  const selectedPadIds = selectedPads.map((pad) => pad.id)

  const otherPads = terrainApi
    .getTerrainOperations(currentTerrain.element)
    .filter((pad) => !selectedPadIds.includes(pad.id))

  const { mesh: meshWithoutSelectedPad } = terrainApi.applyTerrainPads(
    otherPads,
    initGeometry,
    new Mesh(initGeometry.clone()),
    currentTerrain.element.properties,
  )
  const volumeOfMeshWithoutPad = calculateGeometryVolume(meshWithoutSelectedPad.geometry)
  const selectedPadVolume = currentTerrainVolume - volumeOfMeshWithoutPad

  return selectedPadVolume
}

const calculateSiteBalance = (currentTerrain: Terrain, originalTerrainVolume: number): number => {
  const currentTerrainMesh = currentTerrain.mesh
  const currentTerrainVolume = calculateGeometryVolume(currentTerrainMesh.geometry)

  const siteBalance = currentTerrainVolume - originalTerrainVolume

  return siteBalance
}

const ElevationInput = ({
  onChangeElevation,
  initElevation,
}: {
  onChangeElevation: (elevation: number) => void
  initElevation: number
}) => {
  const t = useTranslator()
  const MeterInput = withAccess(withImperial(WeaveInputComponent))
  const isEditingShape = toolAPI.currentToolSignal.value.id === "editTerrainPads"
  return (
    <div>
      <p>{t(($) => $.terrain.elevation)}</p>
      <div className={styles.inputWrapper}>
        <MeterInput
          type="number"
          className={styles.terrainInput}
          editAccess={canEditProposalSignal.value}
          metricValue={initElevation}
          onChangeValue={onChangeElevation}
          label="pad height"
          disabled={isEditingShape}
        >
          <SlottedIcon icon={<icons.Elevation />} style={{ marginRight: "4px" }} />
        </MeterInput>
      </div>
    </div>
  )
}

const BufferInput = ({
  initialBuffer,
  selectedPadId,
  currentTerrain,
  onChangeBuffer,
  applyGrade,
}: {
  initialBuffer: number
  selectedPadId?: string
  currentTerrain?: Terrain
  onChangeBuffer?: (buffer: number, applyGrade: boolean) => void
  applyGrade: boolean
}) => {
  const t = useTranslator()
  const [buffer, setBuffer] = useState<number>(initialBuffer)

  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [previewOp, setPreviewOp] = useState<FlatPolygonV1 | undefined>(undefined)
  enum SlopeMode {
    CUSTOM_SLOPE = 1,
    NO_SLOPE = 2,
  }

  const [slopeMode, setSlopeMode] = useState<SlopeMode>(applyGrade ? SlopeMode.CUSTOM_SLOPE : SlopeMode.NO_SLOPE)

  useEffect(() => {
    setBuffer(initialBuffer)
  }, [initialBuffer])

  const handlePercentageChange = (value: string) => {
    const val = parseFloat(value.replace(",", "."))
    if (!isNaN(val)) {
      setBuffer(val)
      onChangeBuffer?.(val, true)
    }
  }

  const handleRatioChange = (value: string) => {
    const [left, right] = value.split(":").map((s) => parseFloat(s.trim().replace(",", ".")))
    if (!isNaN(left) && !isNaN(right) && right !== 0) {
      setSlopeMode(SlopeMode.CUSTOM_SLOPE)
      const percent = (left / right) * 100
      setBuffer(percent)
      onChangeBuffer?.(percent, true)
    }
  }

  const handleSliderChange = (event: any) => {
    const newVal = parseFloat(event.detail)
    if (!isNaN(newVal)) {
      setSlopeMode(SlopeMode.CUSTOM_SLOPE)
      setBuffer(newVal)
      if (!currentTerrain || !selectedPadId) return
      const currentPad = terrainApi.getTerrainOperation(currentTerrain.element, selectedPadId)
      if (!currentPad) return

      const updatedPad = { ...currentPad, buffer: newVal }
      setPreviewOp(updatedPad)
    }
  }

  const handleSliderCommit = (event: any) => {
    const newVal = parseFloat(event.detail)
    if (!isNaN(newVal) && onChangeBuffer) {
      onChangeBuffer(newVal, true)
    }
  }

  useLayoutEffect(() => {
    if (!previewOp) return
    terrainEditVisualizationSignal.value = { previewOp }
    return () => (terrainEditVisualizationSignal.value = {})
  }, [previewOp])

  return (
    <div>
      <p>{t(($) => $.terrain.slope)}</p>
      <div className={styles.slopeContainer}>
        <div className={styles.inputWrapper}>
          {terrainSlopeUnitSignal.value === "percentage" ? (
            <weave-input
              className={styles.terrainInput}
              value={buffer}
              onChange={(e) => handlePercentageChange(e.currentTarget.value)}
              disabled={!canEditProposalSignal.value || !onChangeBuffer}
            >
              <SlottedIcon icon={<icons.Slope />} style={{ marginRight: "4px" }} />
            </weave-input>
          ) : (
            <weave-input
              className={styles.terrainInput}
              value={`${buffer / 100}:1`}
              onChange={(e) => handleRatioChange(e.currentTarget.value)}
              disabled={!canEditProposalSignal.value || !onChangeBuffer}
            >
              <SlottedIcon icon={<icons.Slope />} style={{ marginRight: "4px" }} />
            </weave-input>
          )}

          <button
            className={styles.slopeButton}
            onClick={() => setFlyoutOpen(true)}
            title={
              terrainSlopeUnitSignal.value === "percentage"
                ? t(($) => $.terrain.labels.showAsRatio)
                : t(($) => $.terrain.labels.showAsPercentage)
            }
          >
            {terrainSlopeUnitSignal.value === "percentage" ? "%" : "/"}
          </button>

          <ClickOutside onClickOutside={() => flyoutOpen && setFlyoutOpen(false)}>
            <weave-flyout open={flyoutOpen} nub="up-right" hide-arrow>
              <div className={styles.flyout}>
                <button
                  className={combineClasses([styles.flyoutButton], {
                    [styles.activeFlyout]: terrainSlopeUnitSignal.value === "ratio",
                  })}
                  onClick={() => {
                    terrainSlopeUnitSignal.value = "ratio"
                    setFlyoutOpen(false)
                  }}
                >
                  <span className={styles.iconSlot}>
                    {terrainSlopeUnitSignal.value === "ratio" && <forma-check slot="icon" />}
                  </span>
                  Ratio
                </button>
                <button
                  className={combineClasses([styles.flyoutButton], {
                    [styles.activeFlyout]: terrainSlopeUnitSignal.value === "percentage",
                  })}
                  onClick={() => {
                    terrainSlopeUnitSignal.value = "percentage"
                    setFlyoutOpen(false)
                  }}
                >
                  <span className={styles.iconSlot}>
                    {terrainSlopeUnitSignal.value === "percentage" && <forma-check slot="icon" />}
                  </span>
                  Percentage
                </button>
              </div>
            </weave-flyout>
          </ClickOutside>
        </div>
        <weave-segmented-buttons-group value={slopeMode}>
          <weave-segmented-button
            onClick={() => {
              setSlopeMode(SlopeMode.CUSTOM_SLOPE)
              setBuffer(300)
              onChangeBuffer?.(300, true)
            }}
            value="1"
          >
            <SlottedIcon icon={icons.Slope()} />
          </weave-segmented-button>
          <weave-segmented-button
            onClick={() => {
              setSlopeMode(SlopeMode.NO_SLOPE)
              setBuffer(5000)
              onChangeBuffer?.(5000, false)
            }}
            value="2"
          >
            <SlottedIcon icon={icons.NoSlope()} />
          </weave-segmented-button>
        </weave-segmented-buttons-group>
      </div>

      {onChangeBuffer && (
        <div className={styles.sliderContainer}>
          <weave-slider
            min="30"
            max="750"
            step="10"
            value={buffer.toString()}
            onChange={handleSliderCommit}
            onInput={handleSliderChange}
          />
        </div>
      )}
    </div>
  )
}
