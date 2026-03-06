import { atom } from "recoil"
import { useCallback, useMemo } from "preact/hooks"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { Shape } from "src/lib/three/Shape/types"
import type { SiteStudy } from "./generator/siteStudySpec"
import type { SiteStudyParams } from "./generator/siteStudySpec"
import type { InternalPath } from "src/lib/element/path"
import { useBaking } from "./baking"
import { getDefaultSiteStudyParams } from "./generator/defaultSiteStudyParams"
import { explicitSignal, explicitSignalWithReset } from "src/lib/signal"
import { exitCurrentTool } from "src/core/toolsState"
import { AnalyticsUtils, Analytics } from "src/core/analytics"
import { EventName, FeatureCategory, legacyTrack } from "@spacemakerai/webapp-analytics"
import { useIsImperial } from "src/lib/unitSettings"

export type WithId<T> = T & { id: string }

type Hash = string
type Id = string

export type SiteStudySolutionState = {
  //to find duplicates
  alreadySeenSolutions: Record<Hash, Id>
  siteStudySolutions: Record<Id, SiteStudySolution>
}

export type SiteStudySolution = LoadingSiteStudySolution | FinishedSiteStudySolution

export type FinishedSiteStudySolution = {
  id: string
  siteStudy: WithId<SiteStudy>
  hash: string
  status: "FINISHED"
}

export type LoadingSiteStudySolution = {
  id: string
  status: "LOADING"
}

export const [siteStudySolutionSignal, setSiteStudySolutionSignalValue, resetSiteStudySolutionSignal] =
  explicitSignalWithReset<SiteStudySolutionState>({
    alreadySeenSolutions: {},
    siteStudySolutions: {},
  })

export function setSiteStudies(studies: LoadingSiteStudySolution[]) {
  setSiteStudySolutionSignalValue({
    alreadySeenSolutions: {},
    siteStudySolutions: Object.fromEntries(studies.map((study) => [study.id, study])),
  })
}

export function setSiteStudySolution(id: string, siteStudy: WithId<SiteStudy>, hash: string) {
  let didUpdate = false
  setSiteStudySolutionSignalValue((prevState) => {
    /* If the site study ID is not in state, it means that the user has triggered a new run and has wiped the
     * state clean in the meantime. In that case, we return early and throw this site study result away.
     */
    if (!prevState.siteStudySolutions[id]) return prevState
    const solutionCopy = { ...prevState.siteStudySolutions }
    /* To remove identical results, we delete this ID from the site study state if the hash is already present. */
    if (prevState.alreadySeenSolutions[hash]) {
      delete solutionCopy[id]
      return {
        ...prevState,
        siteStudySolutions: solutionCopy,
      }
    }
    const hashCopy = { ...prevState.alreadySeenSolutions }
    const siteStudySolution: FinishedSiteStudySolution = { id, siteStudy, hash, status: "FINISHED" }
    hashCopy[hash] = siteStudySolution.id
    solutionCopy[id] = siteStudySolution
    didUpdate = true
    return { alreadySeenSolutions: hashCopy, siteStudySolutions: solutionCopy }
  })
  return didUpdate
}

export function setFailedSiteStudy(id: string) {
  setSiteStudySolutionSignalValue((prevState) => {
    const solutionCopy = { ...prevState.siteStudySolutions }
    delete solutionCopy[id]
    return { ...prevState, siteStudySolutions: solutionCopy }
  })
}

export type SiteStudyInputPolygon = {
  shape: Shape
  setElevation?: number
  fallbackElevation: number
}

export const siteStudyInputPolygonAtom = atom<SiteStudyInputPolygon | null>({
  key: "siteStudyInputPolygon",
  default: null,
})

export enum SiteStudyState {
  NotStarted,
  PickingPolygon,
  RunningStudy,
  PickingStudy,
}

export const [siteStudySignal, setSiteStudySignalValue, resetSiteStudySignal] = explicitSignalWithReset<
  SiteStudyState.NotStarted | SiteStudyState.PickingPolygon | SiteStudyState.RunningStudy | SiteStudyState.PickingStudy
>(SiteStudyState.NotStarted)

type SelectedSiteStudy = {
  internalPaths: InternalPath[]
  study: WithId<SiteStudy>
}

export const [selectedSiteStudySignal, setSelectedSiteStudySignalValue, resetSelectedSiteStudySignal] =
  explicitSignalWithReset<SelectedSiteStudy | null>(null)

function setSelectedStudy(addedPaths: InternalPath[], siteStudy: WithId<SiteStudy>): InternalPath[] {
  let toDelete: InternalPath[] = []
  setSelectedSiteStudySignalValue((currentlySelected) => {
    if (currentlySelected && currentlySelected.internalPaths.length > 0) {
      toDelete = currentlySelected.internalPaths
    }
    return { study: siteStudy, internalPaths: addedPaths }
  })
  return toDelete
}

export function useSelectAndApplyElementActions() {
  const bake = useBaking()
  const actionAPI = useActionAPI()
  return useCallback(
    (studyToSelect: WithId<SiteStudy>, siteStudyParams: SiteStudyParams): { success: boolean } => {
      try {
        const { actions, addedPaths } = bake(studyToSelect, siteStudyParams)
        const pathsToDelete = setSelectedStudy(addedPaths, studyToSelect)
        if (pathsToDelete.length > 0) actions.push(...actionAPI.delete.multiple(pathsToDelete))
        actionAPI.apply("Explore - Apply Site Study proposal", actions)
        Analytics.trackAddElement(
          EventName.Add,
          { feature_category: FeatureCategory.DesignTool, feature: "explore", object_type: "element" },
          {
            category: AnalyticsUtils.trackedElementCategory(
              actions.filter((a) => a.type === "add").map((a) => a.element.properties?.category),
            ),
          },
        )
        return { success: true }
      } catch (e) {
        console.error(e)
        return { success: false }
      }
    },
    [actionAPI, bake],
  )
}

export const [siteStudyToolParamsSignal, setSiteStudyToolParamsSignalValue] = explicitSignal<Partial<SiteStudyParams>>({
  clampToTerrain: true,
})

export function useSiteStudyToolParams() {
  const imperialFlag = useIsImperial()
  const siteStudyToolParams = siteStudyToolParamsSignal.value

  return useMemo(() => {
    return unpartialSiteStudyParams(siteStudyToolParams, imperialFlag)
  }, [imperialFlag, siteStudyToolParams])
}

export function unpartialSiteStudyParams(params: Partial<SiteStudyParams>, imperialFlag: boolean) {
  return { ...getDefaultSiteStudyParams(imperialFlag), ...params }
}

export function setSiteStudyToolParams(updatedParams: any) {
  setSiteStudyToolParamsSignalValue((oldParams: any) => {
    return { ...oldParams, ...updatedParams }
  })
}

export function onExitSiteStudyTool() {
  legacyTrack("Explore – close tool")
  resetSiteStudySignal()
  resetSiteStudySolutionSignal()
  resetSelectedSiteStudySignal()
  exitCurrentTool()
}

export function useIsInSiteStudyTool() {
  const siteStudyState = siteStudySignal.value
  return siteStudyState !== SiteStudyState.NotStarted
}
