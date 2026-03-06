import { useResetRecoilState, useSetRecoilState } from "recoil"
import { useCallback, useEffect, useMemo } from "preact/hooks"

import type { InternalPath } from "src/lib/element/path"
import { tooltipState } from "./tooltip-state"

export type AnalysisBuildingTooltips = { [buildingPath: InternalPath]: string }

export type AnalysisBuildingTooltipApi = {
  setBuildingTooltips: (buildingTooltips: AnalysisBuildingTooltips) => void
  clearBuildingTooltips: () => void
}

export const useAnalysisBuildingTooltipApi = () => {
  const setAnalysisTooltips = useSetRecoilState(tooltipState)
  const clearBuildingTooltips = useResetRecoilState(tooltipState)

  useEffect(() => {
    return () => {
      clearBuildingTooltips()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setBuildingTooltips = useCallback(
    function (buildingTooltips: AnalysisBuildingTooltips) {
      const newTooltips: Map<InternalPath, string> = new Map()
      Object.entries(buildingTooltips).forEach(([buildingPath, message]) => {
        newTooltips.set(buildingPath, message)
      })
      setAnalysisTooltips(newTooltips)
    },
    [setAnalysisTooltips],
  )

  return useMemo(
    () => ({
      setBuildingTooltips,
      clearBuildingTooltips,
    }),
    [clearBuildingTooltips, setBuildingTooltips],
  )
}
