import { useCallback, useMemo } from "preact/hooks"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

import automationStyles from "src/lib/components/automations/AutomationPropertyPanel.module.pcss"
import {
  WeaveInputComponent,
  withAccess,
  withImperial,
  withNumber,
} from "src/lib/components/LengthInput/WeaveInputHelpers"
import NumberOfFloors_16 from "src/lib/components/icons/NumberOfFloors_16"
import { canEditProposalSignal } from "src/core/edit-access-state"
import StoryHeight_16 from "src/lib/components/icons/StoryHeight_16"
import { isDefined } from "src/lib/array"
import PropertyPanel from "src/lib/components/PropertyPanel"
import { Analytics } from "src/core/analytics"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n/index"

import {
  IconButton,
  IconButtonGroup,
  PreviewTile,
  PreviewTileWrapper,
} from "src/integrations/building-systems-site-study/ExploreMenu/IconButton"
import { layoutIcons } from "src/integrations/building-systems-site-study/ExploreMenu/LayoutTypeIcons"
import icons from "src/integrations/building-systems-site-study/ExploreMenu/icons"
import { ITERATIVE_EXPLORE_FEATURE_NAME } from "src/integrations/building-systems-site-study/iterative/constants"

import { createDefaultBuildingsGeneratorConfig, type GeneratorParameters } from "./generator"
import { type Polygon, type Technique } from "./adapter"
import { BuildingsTechniquePreview } from "./BuildingsTechniquePreview"

type MultiEditGeneratorParametersProps = {
  parameters: GeneratorParameters[]
  onChange: (parameters: GeneratorParameters[]) => void
  disabled?: boolean
  /** Representative site polygon to use when generating previews of different building techniques */
  previewPolygon?: Polygon
}

export function MultiEditGeneratorParameters({
  parameters,
  onChange,
  disabled,
  previewPolygon,
}: MultiEditGeneratorParametersProps) {
  const t = useTranslator()
  const imperialFlag = useIsImperial()
  const buildingsGeneratorPresent = useMemo(() => !parameters.every((p) => p.technique == "blank"), [parameters])

  const addBuildingsGenerator = useCallback(() => {
    Analytics.track(EventName.Edit, {
      feature_category: FeatureCategory.DesignTool,
      feature: ITERATIVE_EXPLORE_FEATURE_NAME,
      sub_feature: "add_building_generator",
      object_type: "element",
    })
    onChange(parameters.map((p) => createDefaultBuildingsGeneratorConfig(p.polygon, imperialFlag, false).parameters))
  }, [imperialFlag, onChange, parameters])

  const removeBuildingsGenerator = useCallback(() => {
    Analytics.track(EventName.Edit, {
      feature_category: FeatureCategory.DesignTool,
      feature: ITERATIVE_EXPLORE_FEATURE_NAME,
      sub_feature: "remove_building_generator",
      object_type: "element",
    })
    onChange(parameters.map((p) => createDefaultBuildingsGeneratorConfig(p.polygon, imperialFlag, true).parameters))
  }, [imperialFlag, onChange, parameters])

  return (
    <div>
      <div className={automationStyles.SubHeaderWithIconWrapper}>
        <PropertyPanel.SubHeader title={t(($) => $.building.buildingsTitle)} />
        {buildingsGeneratorPresent ? (
          <weave-tooltip text={t(($) => $.building.tooltips.removeBuildingsButton)}>
            <weave-icon-button onClick={removeBuildingsGenerator}>
              <weave-solid-minus-operator slot="icon" />
            </weave-icon-button>
          </weave-tooltip>
        ) : (
          <weave-tooltip text={t(($) => $.building.tooltips.addBuildingsButton)}>
            <weave-icon-button onClick={addBuildingsGenerator}>
              <weave-solid-plus-operator slot="icon" />
            </weave-icon-button>
          </weave-tooltip>
        )}
      </div>
      {buildingsGeneratorPresent && (
        <>
          <EditMultiTechniqueParameter
            techniques={parameters.map((p) => p.technique)}
            onChange={(technique) => {
              Analytics.track(
                EventName.Edit,
                {
                  feature_category: FeatureCategory.DesignTool,
                  feature: ITERATIVE_EXPLORE_FEATURE_NAME,
                  sub_feature: "building_technique",
                  object_type: "element",
                },
                { technique },
              )
              onChange(parameters.map((p) => (p.technique == "blank" ? p : { ...p, technique })))
            }}
            disabled={disabled}
            previewPolygon={previewPolygon}
            previewBuildingWidth={parameters[0].buildingWidth}
            previewTowerWidth={parameters[0].towerWidth}
          />
          <div className={automationStyles.AutomationRowTwoColumns}>
            <EditMultiFloorsParameter
              floors={parameters.map((p) => p.floors)}
              onChange={(floors) => {
                Analytics.track(
                  EventName.Edit,
                  {
                    feature_category: FeatureCategory.DesignTool,
                    feature: ITERATIVE_EXPLORE_FEATURE_NAME,
                    sub_feature: "floors",
                    object_type: "element",
                  },
                  { floors },
                )
                onChange(parameters.map((p) => ({ ...p, floors })))
              }}
              disabled={disabled}
            />
            <EditMultiStoryHeightParameter
              heights={parameters.map((p) => p.floorHeight)}
              onChange={(floorHeight) => {
                Analytics.track(
                  EventName.Edit,
                  {
                    feature_category: FeatureCategory.DesignTool,
                    feature: ITERATIVE_EXPLORE_FEATURE_NAME,
                    sub_feature: "floor_height",
                    object_type: "element",
                  },
                  { floor_height: floorHeight },
                )
                onChange(parameters.map((p) => ({ ...p, floorHeight })))
              }}
              disabled={disabled}
            />
            <EditMultiBuildingWidthParameter
              buildingWidths={parameters.map((p) => p.buildingWidth)}
              onChange={(buildingWidth) => {
                Analytics.track(
                  EventName.Edit,
                  {
                    feature_category: FeatureCategory.DesignTool,
                    feature: ITERATIVE_EXPLORE_FEATURE_NAME,
                    sub_feature: "building_width",
                    object_type: "element",
                  },
                  { building_width: buildingWidth },
                )
                onChange(parameters.map((p) => ({ ...p, buildingWidth })))
              }}
              disabled={disabled}
            />
            <EditMultiTowerWidthParameter
              towerWidths={parameters.map((p) => p.towerWidth)}
              onChange={(towerWidth) => {
                Analytics.track(
                  EventName.Edit,
                  {
                    feature_category: FeatureCategory.DesignTool,
                    feature: ITERATIVE_EXPLORE_FEATURE_NAME,
                    sub_feature: "tower_width",
                    object_type: "element",
                  },
                  { tower_width: towerWidth },
                )
                onChange(parameters.map((p) => ({ ...p, towerWidth })))
              }}
              disabled={disabled}
            />
          </div>
        </>
      )}
    </div>
  )
}

const INACTIVE_ICON_COLOR = "#808080"
const ACTIVE_ICON_COLOR = "#0696D7"

type TechniqueGroup = { name: string; icon: (color: string) => JSX.Element; techniques: Technique[] }
type TechniqueGroupKey = "cityBlocks" | "linearBlocks" | "mixed" | "towerBlocks"

const techniqueGroups: Record<TechniqueGroupKey, TechniqueGroup> = {
  cityBlocks: {
    name: "City blocks",
    icon: layoutIcons.cityBlockss,
    techniques: ["closedCityBlock", "openCityBlock", "twoAngled", "oneAngled", "cityBlocksWithGaps"],
  },
  linearBlocks: {
    name: "Linear buildings",
    icon: layoutIcons.linearBlocks,
    techniques: ["fanBuildings", "eTypeLamellas", "smileyBlock"],
  },
  mixed: {
    name: "Mixed",
    icon: layoutIcons.mixed,
    techniques: ["openCityBlockPointHouseMix", "oneAngledTower"],
  },
  towerBlocks: {
    name: "Tower buildings",
    icon: layoutIcons.towerBlocks,
    techniques: ["POINT_BUILDINGS", "shiftedShortLamellas", "shiftedPointBuildings"],
  },
}

function findGroupForTechnique(technique: Technique): TechniqueGroupKey | undefined {
  return (Object.entries(techniqueGroups) as [TechniqueGroupKey, TechniqueGroup][]).find(
    ([, group]) => group.techniques.indexOf(technique) !== -1,
  )?.[0]
}

function EditMultiTechniqueParameter({
  techniques,
  onChange,
  disabled,
  previewPolygon,
  previewBuildingWidth,
  previewTowerWidth,
}: {
  techniques: Technique[]
  onChange: (technique: Technique) => void
  disabled?: boolean
  /** Representative site polygon to use when generating previews of different building techniques */
  previewPolygon?: Polygon
  previewBuildingWidth: number
  previewTowerWidth: number
}) {
  const t = useTranslator()
  const groupsWithActiveTechniques = useMemo<Set<TechniqueGroupKey>>(
    () => new Set(techniques.map((t) => findGroupForTechnique(t)).filter(isDefined)),
    [techniques],
  )

  const singleActiveGroup = useMemo<TechniqueGroupKey | undefined>(
    () => (groupsWithActiveTechniques.size == 1 ? groupsWithActiveTechniques.values().next().value : undefined),
    [groupsWithActiveTechniques],
  )

  const setActiveGroup = useCallback(
    (group: TechniqueGroupKey) => {
      onChange(techniqueGroups[group].techniques[0])
    },
    [onChange],
  )

  if (!previewPolygon) {
    throw new Error("Iterative Explore: Missing preview polygon")
  }
  return (
    <>
      <PropertyPanel.SubSubHeader title={t(($) => $.building.typesTitle)} />
      <IconButtonGroup>
        {(Object.entries(techniqueGroups) as [TechniqueGroupKey, TechniqueGroup][]).map(([groupKey, group]) => (
          <weave-tooltip key={group.name} text={group.name}>
            <IconButton
              icon={group.icon(groupKey == singleActiveGroup ? ACTIVE_ICON_COLOR : INACTIVE_ICON_COLOR)}
              selected={groupKey == singleActiveGroup}
              onClick={() => !disabled && setActiveGroup(groupKey)}
              disabled={disabled}
              dot={!singleActiveGroup && groupsWithActiveTechniques.has(groupKey)}
            />
          </weave-tooltip>
        ))}
      </IconButtonGroup>
      {singleActiveGroup && (
        <>
          <PropertyPanel.SubSubHeader title={t(($) => $.building.variationsTitle)} />
          <PreviewTileWrapper>
            {techniqueGroups[singleActiveGroup].techniques.map((_technique) => (
              <PreviewTile
                key={_technique}
                selected={techniques.includes(_technique)}
                onClick={() => !disabled && onChange(_technique)}
                disabled={disabled}
              >
                <BuildingsTechniquePreview
                  technique={_technique}
                  polygon={previewPolygon}
                  buildingWidth={previewBuildingWidth}
                  towerWidth={previewTowerWidth}
                />
              </PreviewTile>
            ))}
          </PreviewTileWrapper>
        </>
      )}
    </>
  )
}

const FloorsInput = withAccess(withNumber(WeaveInputComponent))

function EditMultiFloorsParameter({
  floors,
  onChange,
  disabled,
}: {
  floors: number[]
  onChange: (floors: number) => void
  disabled?: boolean
}) {
  return (
    <FloorsParameter floors={floors[0]} isMixed={new Set(floors).size !== 1} onChange={onChange} disabled={disabled} />
  )
}

function FloorsParameter({
  isMixed,
  floors,
  onChange,
  disabled,
}: {
  isMixed: boolean
  floors?: number
  onChange: (floors: number) => void
  disabled?: boolean
}) {
  const t = useTranslator()
  const inputId = "site-explore-building-floors-input"
  return (
    <div>
      <h3 className={automationStyles.SubSubHeader}>{t(($) => $.automation.explore.floors)}</h3>
      <div className={automationStyles.AutomationInputWithIcon}>
        <label htmlFor={inputId} className={automationStyles.AutomationIconLabel}>
          <weave-tooltip text={t(($) => $.building.tooltips.numberOfFloorsLabel)}>
            <NumberOfFloors_16 />
          </weave-tooltip>
        </label>
        <FloorsInput
          id={inputId}
          type="number"
          isMixed={isMixed}
          value={floors}
          onChangeValue={(newVal) => onChange(newVal)}
          editAccess={canEditProposalSignal.value}
          step={1}
          min={1}
          max={100}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

const StoryHeightInput = withAccess(withImperial(WeaveInputComponent))

function EditMultiStoryHeightParameter({
  heights,
  onChange,
  disabled,
}: {
  heights: number[]
  onChange: (heights: number) => void
  disabled?: boolean
}) {
  if (new Set(heights).size === 1) {
    return <StoryHeightParameter height={heights[0]} onChange={onChange} disabled={disabled} />
  }
  return <StoryHeightParameter onChange={onChange} disabled={disabled} isMixed />
}

function StoryHeightParameter({
  isMixed,
  height,
  onChange,
  disabled,
}: {
  isMixed?: boolean
  height?: number
  onChange: (height: number) => void
  disabled?: boolean
}) {
  const t = useTranslator()
  const inputId = "site-explore-building-floors-input"
  return (
    <div>
      <h3 className={automationStyles.SubSubHeader}>{t(($) => $.automation.explore.storyHeight)}</h3>
      <div className={automationStyles.AutomationInputWithIcon}>
        <label htmlFor={inputId} className={automationStyles.AutomationIconLabel}>
          <weave-tooltip text={t(($) => $.building.tooltips.storyHeightLabel)}>
            <StoryHeight_16 />
          </weave-tooltip>
        </label>
        <StoryHeightInput
          id={inputId}
          type="number"
          metricValue={height}
          isMixed={isMixed}
          onChangeValue={onChange}
          editAccess={canEditProposalSignal.value}
          metricMin={1}
          metricMax={20}
          metricStep={0.1}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

const BuildingWidthInput = withAccess(withImperial(WeaveInputComponent))

function EditMultiBuildingWidthParameter({
  buildingWidths,
  onChange,
  disabled,
}: {
  buildingWidths: number[]
  onChange: (buildingWidths: number) => void
  disabled?: boolean
}) {
  if (new Set(buildingWidths).size === 1) {
    return <BuildingWidthParameter buildingWidth={buildingWidths[0]} onChange={onChange} disabled={disabled} />
  }
  return <BuildingWidthParameter onChange={onChange} disabled={disabled} isMixed />
}

function BuildingWidthParameter({
  isMixed,
  buildingWidth,
  onChange,
  disabled,
}: {
  isMixed?: boolean
  buildingWidth?: number
  onChange: (buildingWidth: number) => void
  disabled?: boolean
}) {
  const t = useTranslator()
  const inputId = "site-explore-building-width-input"
  return (
    <div>
      <h3 className={automationStyles.SubSubHeader}>{t(($) => $.automation.explore.buildingWidth)}</h3>
      <div className={automationStyles.AutomationInputWithIcon}>
        <label htmlFor={inputId} className={automationStyles.AutomationIconLabel}>
          <weave-tooltip text={t(($) => $.building.tooltips.widthLabel)}>{icons.building_width}</weave-tooltip>
        </label>
        <BuildingWidthInput
          id={inputId}
          type="number"
          metricValue={buildingWidth}
          isMixed={isMixed}
          onChangeValue={onChange}
          editAccess={canEditProposalSignal.value}
          metricMin={1}
          metricMax={50}
          metricStep={1}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

const TowerWidthInput = withAccess(withImperial(WeaveInputComponent))

function EditMultiTowerWidthParameter({
  towerWidths,
  onChange,
  disabled,
}: {
  towerWidths: number[]
  onChange: (towerWidths: number) => void
  disabled?: boolean
}) {
  if (new Set(towerWidths).size === 1) {
    return <TowerWidthParameter towerWidth={towerWidths[0]} onChange={onChange} disabled={disabled} />
  }
  return <TowerWidthParameter onChange={onChange} disabled={disabled} isMixed />
}

function TowerWidthParameter({
  isMixed,
  towerWidth,
  onChange,
  disabled,
}: {
  isMixed?: boolean
  towerWidth?: number
  onChange: (towerWidth: number) => void
  disabled?: boolean
}) {
  const t = useTranslator()
  const inputId = "site-explore-tower-width-input"
  return (
    <div>
      <h3 className={automationStyles.SubSubHeader}>{t(($) => $.automation.explore.towerWidth)}</h3>
      <div className={automationStyles.AutomationInputWithIcon}>
        <label htmlFor={inputId} className={automationStyles.AutomationIconLabel}>
          <weave-tooltip text={t(($) => $.building.tooltips.towerWidthLabel)}>{icons.pointBuildingWidth}</weave-tooltip>
        </label>
        <TowerWidthInput
          id={inputId}
          type="number"
          metricValue={towerWidth}
          isMixed={isMixed}
          onChangeValue={onChange}
          editAccess={canEditProposalSignal.value}
          metricMin={1}
          metricMax={50}
          metricStep={1}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
