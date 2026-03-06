import { layoutIcons } from "./LayoutTypeIcons"
import {
  setSiteStudyToolParams,
  siteStudyInputPolygonAtom,
  useSiteStudyToolParams,
} from "src/integrations/building-systems-site-study/SiteStudyToolState"
import styles from "./ExploreMenu.module.pcss"
import { useRecoilValue } from "recoil"
import { useRunSiteStudy } from "src/integrations/building-systems-site-study/useRunSiteStudy"
import { useCallback, useMemo } from "preact/hooks"
import type { SiteStudyParams } from "src/integrations/building-systems-site-study/generator/siteStudySpec"
import { useTranslator } from "src/i18n"

let debounceTimer: NodeJS.Timeout

type LayoutType = "cityBlocks" | "linearBlocks" | "towerBlocks" | "mix"

const layoutTypesToTypologies: Record<LayoutType, (keyof SiteStudyParams["layoutTypes"])[]> = {
  cityBlocks: ["closedCityBlock", "openCityBlock", "twoAngled", "oneAngled", "cityBlocksWithGaps"],
  linearBlocks: ["fanBuildings", "eTypeLamellas", "shiftedBuildings", "smileyBlock"],
  mix: ["openCityBlockPointHouseMix", "oneAngledTower"],
  towerBlocks: ["POINT_BUILDINGS"],
}

export const Layouts = () => {
  const t = useTranslator()
  const parameters = useSiteStudyToolParams()
  const siteStudyInputPolygon = useRecoilValue(siteStudyInputPolygonAtom)
  const runSiteStudy = useRunSiteStudy()
  const { layoutTypes } = parameters

  const selectedLayoutTypes = useMemo((): Record<LayoutType, boolean> => {
    const cityBlocks = layoutTypes.closedCityBlock
    const linearBlocks = layoutTypes.eTypeLamellas
    const towerBlocks = layoutTypes.POINT_BUILDINGS
    const mix = layoutTypes.oneAngledTower
    return { cityBlocks, linearBlocks, towerBlocks, mix }
  }, [layoutTypes.POINT_BUILDINGS, layoutTypes.closedCityBlock, layoutTypes.eTypeLamellas, layoutTypes.oneAngledTower])

  const onUpdateLayoutType = useCallback(
    (siteStudyParams: SiteStudyParams) => {
      if (siteStudyInputPolygon) runSiteStudy(siteStudyInputPolygon, siteStudyParams)
    },
    [runSiteStudy, siteStudyInputPolygon],
  )

  const onUpdateDebounced = useCallback(
    (layoutTypeName: LayoutType, selected: boolean) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      const updatedLayoutTypes = {
        ...layoutTypes,
        ...layoutTypesToTypologies[layoutTypeName].reduce(
          (acc, typology) => {
            acc[typology] = selected
            return acc
          },
          {} as Record<string, boolean>,
        ),
      }
      const newParams = {
        ...parameters,
        layoutTypes: updatedLayoutTypes,
      }
      setSiteStudyToolParams(newParams)
      debounceTimer = setTimeout(() => onUpdateLayoutType(newParams), 1000)
    },
    [layoutTypes, onUpdateLayoutType, parameters],
  )

  return (
    <div>
      <h2 className={styles.Header}>{t(($) => $.automation.explore.layouts)}</h2>
      <div className={styles.LayoutTypes}>
        <div
          className={styles.LayoutType}
          onClick={() => onUpdateDebounced("linearBlocks", !selectedLayoutTypes.linearBlocks)}
        >
          <div className={styles.icon}>
            {layoutIcons.linearBlocks(
              selectedLayoutTypes.linearBlocks ? "var(--icon-color-selected-default)" : "var(--icon-color-medium)",
            )}
          </div>
          <h3 style={selectedLayoutTypes.linearBlocks ? { fontWeight: 700 } : undefined}>
            {t(($) => $.automation.explore.linearBuildings)}
          </h3>
        </div>
        <div
          className={styles.LayoutType}
          onClick={() => onUpdateDebounced("cityBlocks", !selectedLayoutTypes.cityBlocks)}
        >
          <div className={styles.icon}>
            {layoutIcons.cityBlockss(
              selectedLayoutTypes.cityBlocks ? "var(--icon-color-selected-default)" : "var(--icon-color-medium)",
            )}
          </div>
          <h3 style={selectedLayoutTypes.cityBlocks ? { fontWeight: 700 } : undefined}>
            {t(($) => $.automation.explore.cityBlocks)}
          </h3>
        </div>
        <div
          className={styles.LayoutType}
          onClick={() => onUpdateDebounced("towerBlocks", !selectedLayoutTypes.towerBlocks)}
        >
          <div className={styles.icon}>
            {layoutIcons.towerBlocks(
              selectedLayoutTypes.towerBlocks ? "var(--icon-color-selected-default)" : "var(--icon-color-medium)",
            )}
          </div>
          <h3 style={selectedLayoutTypes.towerBlocks ? { fontWeight: 700 } : undefined}>
            {t(($) => $.automation.explore.towerBuildings)}
          </h3>
        </div>
        <div className={styles.LayoutType} onClick={() => onUpdateDebounced("mix", !selectedLayoutTypes.mix)}>
          <div className={styles.icon}>
            {layoutIcons.mixed(
              selectedLayoutTypes.mix ? "var(--icon-color-selected-default)" : "var(--icon-color-medium)",
            )}
          </div>
          <h3 style={selectedLayoutTypes.mix ? { fontWeight: 700 } : undefined}>
            {t(($) => $.automation.explore.mixed)}
          </h3>
        </div>
      </div>
      {/*<div className={styles.LayoutTypes}>
        <h3>City blocks</h3>
        <div style={LayoutTypesContainerStyle}>
          {Object.entries(layoutIcons.cityBlocks).map(([layoutTypeName, icon]) => (
            <LayoutIcon
              key={"layoutIcon" + layoutTypeName}
              selected={layoutTypes?.[layoutTypeName] || false}
              layoutTypeName={layoutTypeName}
              icon={icon}
              onUpdateDebounced={onUpdateDebounced}
            />
          ))}
        </div>
      </div>
      <div className={styles.LayoutTypes}>
        <h3>Linear blocks</h3>
        <div style={LayoutTypesContainerStyle}>
          {Object.entries(layoutIcons.lamellas).map(([layoutTypeName, icon]) => (
            <LayoutIcon
              key={"layoutIcon" + layoutTypeName}
              selected={layoutTypes?.[layoutTypeName] || false}
              layoutTypeName={layoutTypeName}
              icon={icon}
              onUpdateDebounced={onUpdateDebounced}
            />
          ))}
        </div>
      </div>
      <div className={styles.LayoutTypes}>
        <h3>Tower blocks</h3>
        <div style={LayoutTypesContainerStyle}>
          {Object.entries(layoutIcons.pointBuildings).map(([layoutTypeName, icon]) => (
            <LayoutIcon
              key={"layoutIcon" + layoutTypeName}
              selected={layoutTypes?.[layoutTypeName] || false}
              layoutTypeName={layoutTypeName}
              icon={icon}
              onUpdateDebounced={onUpdateDebounced}
            />
          ))}
        </div>
      </div>
      <div className={styles.LayoutTypes}>
        <h3>Mixed types</h3>
        <div style={LayoutTypesContainerStyle}>
          {Object.entries(layoutIcons.mix).map(([layoutTypeName, icon]) => (
            <LayoutIcon
              key={"layoutIcon" + layoutTypeName}
              selected={layoutTypes?.[layoutTypeName] || false}
              layoutTypeName={layoutTypeName}
              icon={icon}
              onUpdateDebounced={onUpdateDebounced}
            />
          ))}
        </div>
      </div>*/}
    </div>
  )
}
