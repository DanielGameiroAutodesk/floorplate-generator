import { atom, useRecoilValue, useResetRecoilState, useSetRecoilState } from "recoil"
import { useCallback, useMemo } from "preact/hooks"
import { toMetersIfImperial } from "src/lib/measurementSystem"
import type { LineBuildingParametersInner } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import { useIsImperial } from "src/lib/unitSettings"

export function getDefaultLineBuildingParams(imperialFlag: boolean): LineBuildingParametersInner {
  return {
    width: imperialFlag ? toMetersIfImperial(40, imperialFlag) : 12,
    floorHeight: imperialFlag ? toMetersIfImperial(10, imperialFlag) : 3,
    //
    numberOfFloors: 4,
    minSubBuildingLength: imperialFlag ? toMetersIfImperial(50, imperialFlag) : 16,
    //
    lineAlignment: "center",
    feature: undefined,
    customLayouts: [],
    sectionToggle: false,
  }
}

const lineBuildingToolParamsAtom = atom<Partial<LineBuildingParametersInner>>({
  key: "lineBuildingToolParams",
  default: {
    lineAlignment: "center",
    feature: undefined,
    customLayouts: [],
    sectionToggle: true,
  },
})

export function useResetLineBuildingToolParams(): () => void {
  const reset = useResetRecoilState(lineBuildingToolParamsAtom)
  return reset
}

export function useLineBuildingToolParams() {
  const imperialFlag = useIsImperial()
  const lineBuildingToolParams = useRecoilValue(lineBuildingToolParamsAtom)
  return useMemo(() => {
    const defaultParameters = getDefaultLineBuildingParams(imperialFlag)
    const params: LineBuildingParametersInner = { ...defaultParameters, ...lineBuildingToolParams }
    return params
  }, [imperialFlag, lineBuildingToolParams])
}

export function useSetLineBuildingToolParams() {
  const setParams = useSetRecoilState(lineBuildingToolParamsAtom)
  return useCallback(
    (updatedParams: any) => {
      setParams((oldParams: any) => {
        return { ...oldParams, ...updatedParams }
      })
    },
    [setParams],
  )
}

export const lineBuildingActiveToolAtom = atom<"addSectionCut" | undefined>({
  key: "lineBuildingActiveToolAtom",
  default: undefined,
})

export const quickDrawTemporaryDumpAtom = atom<{
  selectedSectionIds: string[] | undefined
  drawSettingId: string | undefined
  hoverSectionIds: string[]
}>({
  key: "quickDrawTemporaryDumpAtom",
  default: { selectedSectionIds: undefined, drawSettingId: undefined, hoverSectionIds: [] },
})
