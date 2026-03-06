import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { atom, useRecoilState, useResetRecoilState, useSetRecoilState } from "recoil"
import type { SelectableAnalysisType } from "./analysis-selection-state"
import {
  activeSelectableAreasState,
  circleAnalysisTypes,
  DefaultArea,
  defaultAreaSelectedState,
  entireSiteAnalysisTypes,
  selectableAreasSignal,
} from "./analysis-selection-state"
import { AnalyticsLegacy } from "src/core/analytics"
import styles from "./SelectionDialog.module.pcss"
import { toolbarApi } from "src/integrations/toolbar/ToolbarAPI"
import emptyStateIllustration from "./assets/analysis-emptystate.svg"
import {
  AnalysisBuildingColorLayer,
  useAnalysisBuildingColorApi,
} from "src/integrations/analyses/useAnalysisBuildingColorApi"
import { ANALYSIS_TYPES_SUPPORTING_SCENARIO_CHILD_NODES, useSelectedElementPaths } from "./useSelectedElementPaths"
import { Divider } from "src/integrations/analyses/Divider"
import combineClasses from "src/lib/combineClasses"
import { useTranslator } from "src/i18n"
import { getAnalysisSupportLevelColors } from "src/integrations/analyses/Triggers/analysisSupportLevels"
import { elementState } from "src/core/elements/ElementState"
import { SELECTED_FOR_ANALYSIS_COLOR } from "src/integrations/analyses/Triggers/constants"
import { scenarioChildNodesSignal } from "src/integrations/Scenarios/scenarioElementUploadState"

const emptyDialogOpenedTimestampState = atom<Date | undefined>({
  key: "analysis-selection-mode/emptyDialogOpenedTimestampState",
  default: undefined,
})

export function SelectionDialog({
  setEnclosingCircleLogicDisabled,
  analysisType,
}: {
  setEnclosingCircleLogicDisabled: (disabled: boolean | ((prev: boolean) => boolean)) => void
  analysisType: SelectableAnalysisType
  onClose: () => void
}) {
  const t = useTranslator()
  const proposal = elementState.currentProposalSignal.value
  const [hoverPaths, setHoverPaths] = useState<Set<string>>(new Set())
  const [activeSelectableAreas, setActiveSelectableAreas] = useRecoilState(activeSelectableAreasState(proposal.id))
  const [defaultAreaSelected, setDefaultAreaSelected] = useRecoilState(defaultAreaSelectedState(proposal.id))
  const resetDefaultAreaSelected = useResetRecoilState(defaultAreaSelectedState(proposal.id))
  const setEmptyDialogOpenedTimestamp = useSetRecoilState(emptyDialogOpenedTimestampState)
  const selectableAreas = selectableAreasSignal.value
  const selectableAreaPaths = useMemo(() => selectableAreas.map((a) => a.path), [selectableAreas])
  const isSelectAllSelected =
    selectableAreaPaths.length > 0 && selectableAreaPaths.every((path) => activeSelectableAreas.has(path))
  const { colorElementPaths } = useSelectedElementPaths()
  const buildingColorAPI = useAnalysisBuildingColorApi(AnalysisBuildingColorLayer.AreaSelection)
  const scenarioChildNodes = scenarioChildNodesSignal.value

  useEffect(() => {
    const userFixedEmptyStateTracker = ((e: CustomEvent<{ analysisType: string; isLoading: boolean }>) => {
      setEmptyDialogOpenedTimestamp((currentTimestamp) => {
        if (!currentTimestamp) return undefined
        if (e.detail.isLoading && e.detail.analysisType && ["sun", "sky-component"].includes(e.detail.analysisType)) {
          // Don't track this with new tracking schema
          AnalyticsLegacy.track("Analysis selection mode - Empty state dialog resolved", {
            analysisType: e.detail.analysisType,
            elapsedSinceEmptyDialogOpened: (Date.now() - currentTimestamp.getTime()) / 1000,
          })
        }
        return undefined
      })
    }) as EventListener

    window.addEventListener("forma-analysis-loadingstate-changed", userFixedEmptyStateTracker)
    return () => window.removeEventListener("forma-analysis-loadingstate-changed", userFixedEmptyStateTracker)
  }, [setEmptyDialogOpenedTimestamp])

  const onTagClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      resetDefaultAreaSelected()
      const tagId = (event.target as HTMLElement).getAttribute("data-tag-id")!
      setActiveSelectableAreas((areas) => {
        const newAreas = new Set(areas)
        if (newAreas.has(tagId)) {
          newAreas.delete(tagId)
        } else {
          newAreas.add(tagId)
        }
        return newAreas
      })
      // Don't track this with new tracking schema
      AnalyticsLegacy.track("Analysis selection mode - Selection modified", {
        analysisType,
      })
      setEnclosingCircleLogicDisabled(false)
    },
    [analysisType, resetDefaultAreaSelected, setActiveSelectableAreas, setEnclosingCircleLogicDisabled],
  )

  const onTagMouseOver = useCallback(
    (event: MouseEvent) => {
      const tagId = (event.target as HTMLElement).getAttribute("data-tag-id")!
      setHoverPaths((paths) => {
        const newPaths = new Set(paths)
        newPaths.add(tagId)
        return newPaths
      })
    },
    [setHoverPaths],
  )

  const onTagMouseOut = useCallback(
    (event: MouseEvent) => {
      const tagId = (event.target as HTMLElement).getAttribute("data-tag-id")!
      setHoverPaths((paths) => {
        const newPaths = new Set(paths)
        newPaths.delete(tagId)
        return newPaths
      })
    },
    [setHoverPaths],
  )

  const onEntireSiteClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      setActiveSelectableAreas(new Set())
      setDefaultAreaSelected(DefaultArea.EntireSite)
    },
    [setActiveSelectableAreas, setDefaultAreaSelected],
  )

  const onCustomAreaClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      window.dispatchEvent(new CustomEvent("forma/analysis-selection/custom-circle-enabled"))
      setActiveSelectableAreas(new Set())
      setDefaultAreaSelected(DefaultArea.CustomCircle)
    },
    [setActiveSelectableAreas, setDefaultAreaSelected],
  )

  const onSelectAllClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      resetDefaultAreaSelected()
      setActiveSelectableAreas((areas) => {
        const currentlyAllSelected =
          selectableAreaPaths.length > 0 && selectableAreaPaths.every((path) => areas.has(path))
        return currentlyAllSelected ? new Set() : new Set(selectableAreaPaths)
      })
      // Don't track this with new tracking schema
      AnalyticsLegacy.track("Analysis selection mode - Selection modified", {
        analysisType,
      })
      setEnclosingCircleLogicDisabled(false)
    },
    [
      analysisType,
      resetDefaultAreaSelected,
      selectableAreaPaths,
      setActiveSelectableAreas,
      setEnclosingCircleLogicDisabled,
    ],
  )

  useEffect(() => {
    const includeScenario = ANALYSIS_TYPES_SUPPORTING_SCENARIO_CHILD_NODES.includes(analysisType)
    const analysisSupportColors = getAnalysisSupportLevelColors(
      analysisType,
      colorElementPaths,
      proposal.snapshot,
      includeScenario ? scenarioChildNodes : [],
    )
    buildingColorAPI.setBuildingColors(analysisSupportColors)
    buildingColorAPI.setBuildingColors(colorMapAllPaths([...hoverPaths], SELECTED_FOR_ANALYSIS_COLOR))
    return () => buildingColorAPI.clearBuildingColors()
  }, [colorElementPaths, hoverPaths, buildingColorAPI, proposal, analysisType, scenarioChildNodes])

  return (
    <div className={styles.dialog}>
      <div className={styles.selectionTags}>
        {entireSiteAnalysisTypes.includes(analysisType) && (
          <button
            onClick={onEntireSiteClick}
            className={combineClasses([styles.selectionButton, styles.fullRow, styles.entireModelOption], {
              [styles.buttonSelected]: defaultAreaSelected === DefaultArea.EntireSite,
            })}
          >
            {t(($) => $.analysis.entireModel)}
          </button>
        )}
        {circleAnalysisTypes.includes(analysisType) && (
          <button
            onClick={onCustomAreaClick}
            className={combineClasses([styles.selectionButton, styles.fullRow, styles.entireModelOption], {
              [styles.buttonSelected]: defaultAreaSelected === DefaultArea.CustomCircle,
            })}
          >
            {t(($) => $.analysis.customCircle)}
          </button>
        )}
        {selectableAreas.length > 2 && (
          <button
            onClick={onSelectAllClick}
            className={combineClasses([styles.selectionButton, styles.fullRow], {
              [styles.buttonSelected]: isSelectAllSelected,
            })}
          >
            {t(($) => (isSelectAllSelected ? $.analysis.deselectAllAreasButton : $.analysis.selectAllAreasButton))}
          </button>
        )}
        {selectableAreas.map((area) => (
          <button
            key={area.path}
            data-tag-id={area.path}
            className={combineClasses([styles.selectionButton], {
              [styles.buttonSelected]: activeSelectableAreas.has(area.path),
            })}
            onClick={onTagClick}
            onMouseOver={onTagMouseOver}
            onMouseOut={onTagMouseOut}
          >
            {area.title}
          </button>
        ))}
        {selectableAreas.length === 0 && <AnalysisSelectionModeDialogEmptyState analysisType={analysisType} />}
      </div>
    </div>
  )
}

function AnalysisSelectionModeDialogEmptyState({ analysisType }: { analysisType: SelectableAnalysisType }) {
  const t = useTranslator()
  const setEmptyDialogOpenedTimestamp = useSetRecoilState(emptyDialogOpenedTimestampState)

  useEffect(() => {
    setEmptyDialogOpenedTimestamp(new Date())
    // Don't track this with new tracking schema
    AnalyticsLegacy.track("Analysis selection mode - Empty state dialog opened", {
      analysisType,
    })
  }, [analysisType, setEmptyDialogOpenedTimestamp])

  const handleShowToolbarItem = useCallback(() => {
    toolbarApi.displayTool(
      (t) => t(($) => $.limits.title),
      (t) => t(($) => $.limits.siteLimit.name),
    )
  }, [])

  const handleHideToolbarItem = useCallback(() => {
    toolbarApi.reset()
  }, [])

  return (
    <div className={styles.dialog}>
      <Divider />
      <div className={styles.emptyTags} onMouseOver={handleShowToolbarItem} onMouseOut={handleHideToolbarItem}>
        <img style={{ height: "96px", margin: "16px 0 16px" }} src={emptyStateIllustration} />
        <div className={styles.title}>{t(($) => $.analysis.emptyStateZoneExplanation)}</div>
      </div>
    </div>
  )
}

function colorMapAllPaths(paths: string[], color: string) {
  return Object.fromEntries(paths.map((path) => [path, color]))
}
