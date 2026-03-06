import { useCallback, useEffect, useRef } from "preact/hooks"
import { type ReadonlySignal, useSignal, useSignalEffect } from "@preact/signals"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

import ConfigureFilterPreferences_16 from "src/lib/components/icons/ConfigureFilterPreferences_16"
import { isDefined } from "src/lib/array"
import Angle_16 from "src/lib/components/icons/Angle_16"
import { Analytics } from "src/core/analytics"
import { useTranslator } from "src/i18n/index"

import { IconButton, IconButtonGroup } from "src/integrations/building-systems-site-study/ExploreMenu/IconButton"
import type { IterativeExploreState } from "src/integrations/building-systems-site-study/iterative/explore-tool-state"
import { ITERATIVE_EXPLORE_FEATURE_NAME } from "src/integrations/building-systems-site-study/iterative/constants"

import { getDefaultGridParamsBasedOfNode, type GridParams } from "./grid"
import type { Technique } from "./types"
import type { SimpleGraphGeneratorParameters } from "./generator"
import style from "./EditGeneratorParameters.module.css"

type Props = {
  parameters: SimpleGraphGeneratorParameters
  onChange: (parameters: SimpleGraphGeneratorParameters) => void
  disabled?: boolean
  graphEditorSignal: ReadonlySignal<IterativeExploreState>
  initGridTool: () => void
}

export function EditGeneratorParameters({ parameters, onChange, disabled, graphEditorSignal, initGridTool }: Props) {
  /**
   * Some fiddly logic here to allow to achieve:
   * - Hide the panel when setting grid position
   * - Allow the user to always override visibility of the panel
   */
  const gridPanelOpenSignal = useSignal(graphEditorSignal.value.type === "set-grid-position")
  const tempHiddenSignal = useSignal(graphEditorSignal.value.type === "set-grid-position")
  useSignalEffect(() => {
    tempHiddenSignal.value = graphEditorSignal.value.type === "set-grid-position"
  })

  const onChangeTechnique = useCallback(
    (technique: Technique) => {
      switch (technique) {
        case "grid2":
          onChange({ ...parameters, technique, params: getDefaultGridParamsBasedOfNode(parameters.polygons) })
          gridPanelOpenSignal.value = true
          break
        case "voronoi":
          onChange({ ...parameters, technique, maxCellArea: 100 })
          break
        case "grid":
        case "convex":
        case "blank":
          onChange({ ...parameters, technique })
          break
      }
    },
    [gridPanelOpenSignal, onChange, parameters],
  )

  return (
    <>
      <TechniqueParameter
        technique={parameters.technique}
        onChange={onChangeTechnique}
        onOptions={() => {
          if (tempHiddenSignal.value) {
            tempHiddenSignal.value = false
          } else {
            gridPanelOpenSignal.value = !gridPanelOpenSignal.value
          }
        }}
        disabled={disabled}
      />
      {parameters.technique === "grid2" && !disabled && (
        <GridParameters
          parameters={parameters}
          onChange={onChange}
          open={gridPanelOpenSignal.value && !tempHiddenSignal.value}
          setOpen={(val: boolean) => {
            if (val) {
              gridPanelOpenSignal.value = true
              tempHiddenSignal.value = false
            } else {
              gridPanelOpenSignal.value = false
              tempHiddenSignal.value = false
            }
          }}
          initGridTool={initGridTool}
        />
      )}
    </>
  )
}

function TechniqueParameter({
  technique,
  onChange,
  disabled,
  onOptions,
}: {
  technique: Technique
  onChange: (technique: Technique) => void
  disabled?: boolean
  onOptions?: () => void
}) {
  const t = useTranslator()
  const buttons: { technique: Technique; icon: JSX.Element; tooltip: string }[] = [
    { technique: "blank", icon: <BlankDivisionIcon />, tooltip: "Empty" },
    { technique: "grid2", icon: <GridDivisionIcon />, tooltip: "Grid" },
    { technique: "voronoi", icon: <VoronoiDivisionIcon />, tooltip: "Honeycomb" },
  ]
  return (
    <IconButtonGroup>
      {buttons.map((button) => (
        <weave-tooltip key={button.tooltip} text={button.tooltip} nub={"down-center"}>
          <IconButton
            icon={button.icon}
            selected={technique == button.technique}
            onClick={() => {
              Analytics.track(
                EventName.Edit,
                {
                  feature_category: FeatureCategory.DesignTool,
                  feature: ITERATIVE_EXPLORE_FEATURE_NAME,
                  sub_feature: "site_area_technique",
                  object_type: "element",
                },
                { technique: button.technique },
              )
              onChange(button.technique)
            }}
            disabled={disabled}
          />
        </weave-tooltip>
      ))}
      <weave-tooltip text={t(($) => $.ui.gridSettings)} nub={"down-center"} style={{ marginLeft: "auto" }}>
        <weave-icon-button onClick={onOptions} disabled={disabled || !isDefined(onOptions) || technique !== "grid2"}>
          <ConfigureFilterPreferences_16 slot={"icon"} />
        </weave-icon-button>
      </weave-tooltip>
    </IconButtonGroup>
  )
}

type GridParameters = Extract<SimpleGraphGeneratorParameters, { technique: "grid2" }>

function GridParameters({
  parameters,
  onChange,
  open,
  setOpen,
  initGridTool,
}: {
  parameters: GridParameters
  onChange: (params: GridParameters) => void
  open: boolean
  setOpen: (val: boolean) => void
  initGridTool: () => void
}) {
  const t = useTranslator()
  const popout = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = popout.current
    const close = () => setOpen(false)

    element?.addEventListener("weave-menu-container-close", close)
    return () => {
      element?.removeEventListener("weave-menu-container-close", close)
    }
  }, [popout, setOpen])

  return (
    <weave-menu-container ref={popout} title={t(($) => $.ui.gridSettings)} right={20} top={-60} open={open}>
      <GridPopout
        parameters={parameters.params}
        onChange={(params) => onChange({ ...parameters, params })}
        onInitTool={initGridTool}
      />
    </weave-menu-container>
  )
}

function GridPopout({
  parameters,
  onChange,
  onInitTool,
}: {
  parameters: GridParams
  onChange: (params: GridParams) => void
  onInitTool: () => void
}) {
  const t = useTranslator()
  return (
    <div>
      <div style={{ display: "grid", rowGap: "12px" }}>
        <InputSlider
          label={t(($) => $.vegetation.properties.gridWidthLabel)}
          val={parameters.dx}
          onChange={(val) => {
            Analytics.track(
              EventName.Edit,
              {
                feature_category: FeatureCategory.DesignTool,
                feature: ITERATIVE_EXPLORE_FEATURE_NAME,
                sub_feature: "grid_width",
                object_type: "element",
              },
              { width: val },
            )
            onChange({ ...parameters, dx: val })
          }}
        />
        <InputSlider
          label={t(($) => $.vegetation.properties.gridLengthLabel)}
          val={parameters.dy ?? parameters.dx}
          onChange={(val) => {
            Analytics.track(
              EventName.Edit,
              {
                feature_category: FeatureCategory.DesignTool,
                feature: ITERATIVE_EXPLORE_FEATURE_NAME,
                sub_feature: "grid_length",
                object_type: "element",
              },
              { length: val },
            )
            onChange({ ...parameters, dy: val })
          }}
        />
      </div>

      <weave-button
        onClick={() => {
          Analytics.track(EventName.Select, {
            feature_category: FeatureCategory.DesignTool,
            feature: ITERATIVE_EXPLORE_FEATURE_NAME,
            sub_feature: "grid_position",
          })
          onInitTool()
        }}
        density={"high"}
        style={{ marginTop: "16px" }}
      >
        <Angle_16 slot="icon" />
        {t(($) => $.automation.explore.editGridOrientationButton)}
      </weave-button>
    </div>
  )
}

const MIN = "10"
const MAX = "200"

function InputSlider({ label, val, onChange }: { label: string; val: number; onChange: (val: number) => void }) {
  return (
    <div className={style.SliderContainer}>
      <label className={style.SliderLabel}>{label}</label>
      <div className={style.SliderSlider}>
        <weave-slider
          value={`${val}`}
          min={MIN}
          max={MAX}
          step="1"
          variant="continuous"
          label={label}
          onChange={(e) => onChange(parseFloat(e.detail))}
        />
      </div>
      <div className={style.SliderInput}>
        <weave-input
          type="number"
          variant={"box"}
          value={val}
          label={label}
          //unit="m"
          step="1"
          style='--input-unit: "m"; width: 100%;'
          onChange={(e) => onChange(parseFloat(e.currentTarget.value))}
        />
      </div>
    </div>
  )
}

function VoronoiDivisionIcon() {
  return (
    <svg width="24" height="24" viewBox="2 2 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13 7.49921V3.49921M13 7.49921L17.7631 10.2492M13 7.49921L8.23688 10.2492M17.7631 10.2492L22.5 7.49921M17.7631 10.2492V15.7492M17.7631 15.7492L22.5 18.4992M17.7631 15.7492L13 18.4992M13 18.4992V22.4992M13 18.4992L8.23688 15.7492M8.23688 15.7492L3.5 18.4992M8.23688 15.7492V10.2492M8.23688 10.2492L3.5 7.49921"
        stroke="#808080"
      />
    </svg>
  )
}

function BlankDivisionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="2.5" width="19" height="19" rx="0.5" stroke="#808080" />
    </svg>
  )
}

function GridDivisionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 8.83331H21.5M2.5 15.1666H21.5M8.83334 2.5V21.4999M15.1667 2.5V21.4999" stroke="#808080" />
    </svg>
  )
}
