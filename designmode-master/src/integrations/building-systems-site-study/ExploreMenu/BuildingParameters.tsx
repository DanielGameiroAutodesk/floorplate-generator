import icons from "./icons"
import {
  selectedSiteStudySignal,
  setSiteStudyToolParams,
  siteStudyInputPolygonAtom,
  useSelectAndApplyElementActions,
  useSiteStudyToolParams,
} from "src/integrations/building-systems-site-study/SiteStudyToolState"
import { roundUpToClosestFootInMetric } from "src/lib/components/LengthInput/formaUnitUtils"
import styles from "./ExploreMenu.module.pcss"
import { IconButton } from "./IconButton"
import { studyIcons } from "./StudyIcons"
import { useRunSiteStudy } from "src/integrations/building-systems-site-study/useRunSiteStudy"
import { useRecoilValue } from "recoil"
import { TreeAreaPropertyPopout } from "src/integrations/basic-elements/trees/area/TreeAreaPropertyPopout"
import { defaultTreeAreaConfig, getTreeInputConfigs } from "src/integrations/basic-elements/trees/defaults"
import { useMemo } from "preact/hooks"
import type { SiteStudyParams } from "src/integrations/building-systems-site-study/generator/siteStudySpec"
import Divider from "./Divider"
import { default as InputWithIcon } from "src/integrations/InputWithIcon/InputWithIcon"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

const ParametersRowStyle = `
 height: 36px;
 display: flex;
 align-items: center;
 justify-content: space-between;
`

const DEBOUNCE_TIME = 1000

export const ExploreParameters = () => {
  const t = useTranslator()
  const isImperial = useIsImperial()

  const parameters = useSiteStudyToolParams()
  const siteStudyInputPolygon = useRecoilValue(siteStudyInputPolygonAtom)
  const runSiteStudy = useRunSiteStudy()

  const { siteBuffer, avgStories, roads, streetWidth, buildingWidth, pointBuildingWidth } = parameters

  return (
    <>
      <div style={ParametersRowStyle}>
        <InputWithIcon
          id={t(($) => $.building.divisionWidth)}
          icon={icons.divisionWidth}
          label={t(($) => $.building.lineBuilding.divisionWidthLabel)}
          unit={"length"}
          value={siteBuffer}
          onChange={(value) => {
            const newParams = {
              ...parameters,
              siteBuffer: value,
            }
            setSiteStudyToolParams(newParams)
            if (siteStudyInputPolygon) runSiteStudy(siteStudyInputPolygon, newParams)
          }}
          disabled={!canEditProposalSignal.value}
          metricMin={0}
          metricMax={isImperial ? roundUpToClosestFootInMetric(100) : 100}
          debounceTime={DEBOUNCE_TIME}
        />
        <InputWithIcon
          id={t(($) => $.building.properties.numberOfStoriesLabel)}
          icon={icons.stories}
          label={t(($) => $.building.properties.numberOfFloorsLabel)}
          unit={"count"}
          min={1}
          max={50}
          value={avgStories}
          onChange={(value) => {
            const newParams = { ...parameters, avgStories: value }
            setSiteStudyToolParams(newParams)
            if (siteStudyInputPolygon) runSiteStudy(siteStudyInputPolygon, newParams)
          }}
          disabled={!canEditProposalSignal.value}
          debounceTime={DEBOUNCE_TIME}
        />
      </div>
      <div style={ParametersRowStyle}>
        <InputWithIcon
          id={t(($) => $.building.buildingWidthLabel)}
          icon={icons.building_width}
          label={t(($) => $.building.tooltips.widthLabel)}
          unit={"length"}
          value={buildingWidth}
          onChange={(value) => {
            const newParams = {
              ...parameters,
              buildingWidth: value,
            }
            setSiteStudyToolParams({ buildingWidth: value })
            if (siteStudyInputPolygon) runSiteStudy(siteStudyInputPolygon, newParams)
          }}
          disabled={!canEditProposalSignal.value}
          metricMin={isImperial ? roundUpToClosestFootInMetric(8) : 8}
          metricMax={isImperial ? roundUpToClosestFootInMetric(50) : 50}
          debounceTime={DEBOUNCE_TIME}
        />
        <InputWithIcon
          id={t(($) => $.building.towerBlockWidthLabel)}
          icon={icons.pointBuildingWidth}
          label={t(($) => $.building.lineBuilding.towerWidthLabel)}
          unit={"length"}
          value={pointBuildingWidth}
          onChange={(value) => {
            const newParams = { ...parameters, pointBuildingWidth: value }
            setSiteStudyToolParams(newParams)
            if (siteStudyInputPolygon) runSiteStudy(siteStudyInputPolygon, newParams)
          }}
          disabled={!canEditProposalSignal.value}
          metricMin={isImperial ? roundUpToClosestFootInMetric(8) : 8}
          metricMax={isImperial ? roundUpToClosestFootInMetric(50) : 50}
          debounceTime={DEBOUNCE_TIME}
        />
      </div>
      {roads && (
        <div style={ParametersRowStyle}>
          <InputWithIcon
            id={t(($) => $.building.roadWidthLabel)}
            icon={icons.streetWidth}
            label={t(($) => $.transportation.roads.widthLabel)}
            unit={"length"}
            value={streetWidth}
            onChange={(value) => {
              const newParams = {
                ...parameters,
                streetWidth: value,
              }
              setSiteStudyToolParams(newParams)
              if (siteStudyInputPolygon) runSiteStudy(siteStudyInputPolygon, newParams)
            }}
            disabled={!canEditProposalSignal.value}
            metricMin={0}
            metricMax={isImperial ? roundUpToClosestFootInMetric(100) : 100}
            debounceTime={DEBOUNCE_TIME}
          />
        </div>
      )}
    </>
  )
}

export function Trees() {
  const t = useTranslator()
  const imperialUnits = useIsImperial()
  const params = useSiteStudyToolParams()
  const inputConfigs = useMemo(() => getTreeInputConfigs(imperialUnits), [imperialUnits])
  const selectAndApplyElementActions = useSelectAndApplyElementActions()
  const selectedSiteStudy = selectedSiteStudySignal.value
  const { trees } = params
  return trees.enabled ? (
    <>
      <Divider />
      <div>
        <h2 className={styles.Header}>{t(($) => $.vegetation.header)}</h2>
        <TreeAreaPropertyPopout
          currentConfig={trees.config}
          inputConfigs={inputConfigs}
          onUpdateAvgSpacing={(metricValue: number) => {
            const newParams = {
              ...params,
              trees: { enabled: true, config: { ...trees.config, avgSpacing: metricValue } },
            }
            setSiteStudyToolParams(newParams)
            if (selectedSiteStudy) selectAndApplyElementActions(selectedSiteStudy.study, newParams)
          }}
          onUpdateHeight={(metricValue: number) => {
            const newParams = {
              ...params,
              trees: { enabled: true, config: { ...trees.config, height: metricValue } },
            }
            setSiteStudyToolParams(newParams)
            if (selectedSiteStudy) selectAndApplyElementActions(selectedSiteStudy.study, newParams)
          }}
        />
      </div>
    </>
  ) : null
}

export function ClampToTerrain() {
  const t = useTranslator()
  const parameters = useSiteStudyToolParams()
  const siteStudyInputPolygon = useRecoilValue(siteStudyInputPolygonAtom)
  const runSiteStudy = useRunSiteStudy()
  return (
    <weave-checkbox
      style={{ marginTop: "8px" }}
      disabled={!canEditProposalSignal.value}
      label={t(($) => $.building.tooltips.clampToTerrainButton)}
      showlabel={true}
      checked={parameters.clampToTerrain}
      onChange={() => {
        const newParams = { ...parameters, clampToTerrain: !parameters.clampToTerrain }
        setSiteStudyToolParams(newParams)
        if (siteStudyInputPolygon) runSiteStudy(siteStudyInputPolygon, newParams)
      }}
    />
  )
}

/////
// Decorations
///

const DecorationsWrapperStyle = `



`

export const Decorations = () => {
  const parameters = useSiteStudyToolParams()
  const imperialFlag = useIsImperial()
  const selectedSiteStudy = selectedSiteStudySignal.value
  const selectAndApplyElementActions = useSelectAndApplyElementActions()
  const { roads, trees } = parameters

  return (
    <div style={DecorationsWrapperStyle}>
      <div className={styles.IconButtonGroup}>
        <IconButton icon={studyIcons.buildings("#0696D7")} selected={true} />
        <IconButton
          icon={studyIcons.trees(trees.enabled ? "#0696D7" : "#80808080")}
          selected={trees.enabled}
          onClick={() => {
            if (!canEditProposalSignal.value) return
            const newTrees: SiteStudyParams["trees"] = trees.enabled
              ? { enabled: false }
              : { enabled: true, config: defaultTreeAreaConfig(imperialFlag) }
            const newParams = {
              ...parameters,
              trees: newTrees,
            }
            setSiteStudyToolParams(newParams)

            if (selectedSiteStudy) selectAndApplyElementActions(selectedSiteStudy.study, newParams)
          }}
        />
        <IconButton
          icon={studyIcons.roads(roads ? "#0696D7" : "#80808080")}
          selected={roads}
          onClick={() => {
            if (!canEditProposalSignal.value) return
            const newParams = { ...parameters, roads: !roads }
            setSiteStudyToolParams(newParams)
            if (selectedSiteStudy) selectAndApplyElementActions(selectedSiteStudy.study, newParams)
          }}
        />
      </div>
    </div>
  )
}
