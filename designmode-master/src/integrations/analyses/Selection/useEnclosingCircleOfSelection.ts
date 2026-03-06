import { useRecoilValue, useSetRecoilState } from "recoil"
import type { SelectableAnalysisType } from "./analysis-selection-state"
import {
  circleAnalysisTypes,
  DefaultArea,
  defaultAreaSelectedState,
  enclosingCircleOfAnalyzeSelectionState,
} from "./analysis-selection-state"
import { useEffect, useState } from "preact/hooks"
import { useSelectedElementPaths } from "./useSelectedElementPaths"
import { useGetEnclosingCircle } from "./useGetEnclosingCircle"
import { proposalIdSignal } from "src/core/proposal"

export function useEnclosingCircleOfSelection(analysisType: SelectableAnalysisType | undefined) {
  const setEnclosingCircleToAnalyze = useSetRecoilState(enclosingCircleOfAnalyzeSelectionState)
  const [enclosingCircleLogicDisabled, setEnclosingCircleLogicDisabled] = useState(false)
  const { selectedElementPaths } = useSelectedElementPaths()
  const getEnclosingCircle = useGetEnclosingCircle()

  useEffect(() => {
    const disableEnclosingCircle = () => {
      setEnclosingCircleToAnalyze(undefined)
      setEnclosingCircleLogicDisabled(true)
    }
    window.addEventListener("forma/analysis-selection/custom-circle-enabled", disableEnclosingCircle)
    return () => window.removeEventListener("forma/analysis-selection/custom-circle-enabled", disableEnclosingCircle)
  }, [setEnclosingCircleLogicDisabled, setEnclosingCircleToAnalyze])

  const defaultAreaSelected = useRecoilValue(defaultAreaSelectedState(proposalIdSignal.value))
  const hasSelectedCirclePreviously = sessionStorage.getItem(`forma-selected-${analysisType}-circle`) !== null

  useEffect(() => {
    if (
      analysisType &&
      circleAnalysisTypes.includes(analysisType) &&
      (defaultAreaSelected !== DefaultArea.CustomCircle || !hasSelectedCirclePreviously)
    ) {
      if (!enclosingCircleLogicDisabled) {
        const enclosingCircle = getEnclosingCircle(selectedElementPaths)
        setEnclosingCircleToAnalyze(enclosingCircle)
      }
    } else {
      setEnclosingCircleToAnalyze(undefined)
    }
    return () => setEnclosingCircleToAnalyze(undefined)
  }, [
    setEnclosingCircleToAnalyze,
    selectedElementPaths,
    analysisType,
    enclosingCircleLogicDisabled,
    defaultAreaSelected,
    hasSelectedCirclePreviously,
    getEnclosingCircle,
  ])

  return setEnclosingCircleLogicDisabled
}
