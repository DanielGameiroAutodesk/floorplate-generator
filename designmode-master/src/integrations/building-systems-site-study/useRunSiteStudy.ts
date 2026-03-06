import { atom, useRecoilState } from "recoil"
import type { LoadingSiteStudySolution, SiteStudyInputPolygon, WithId } from "./SiteStudyToolState"
import {
  setFailedSiteStudy,
  setSiteStudies,
  setSiteStudySolution,
  useSelectAndApplyElementActions,
} from "./SiteStudyToolState"
import { useInputOutputWorkerWithTerminate } from "src/lib/workers/useWorker"
import type { SiteStudy, SiteStudyInput } from "./generator/siteStudySpec"
import Worker from "./generator/worker?worker"
import { useCallback } from "react"
import type { SiteStudyParams } from "./generator/siteStudySpec"
import { newId } from "src/lib/element/urn"
import { captureException } from "@sentry/browser"

const NUMBER_OF_STUDIES = 24

/**
 * Storing workers that were trigged earlier to kill them, to avoid queuing tons of workers
 */
const prevWorkersAtom = atom<(() => void)[]>({
  key: "prevWorkers",
  default: [],
})

type WorkerOutput = {
  siteStudy: Omit<SiteStudy, "studyPolygon">
  hash: string
}

type SiteStudyWorkerResult = SuccessResult | ErrorResult

type SuccessResult = {
  siteStudy: WithId<SiteStudy>
  hash: string
  status: "SUCCESS"
}

type ErrorResult = {
  id: string
  status: "ERROR"
  error: Error
}

function useCreateSiteStudyWorkers() {
  const runWorker = useInputOutputWorkerWithTerminate<SiteStudyInput, WorkerOutput>(Worker)
  return useCallback(
    (
      siteStudyInput: SiteStudyInputPolygon,
      parameters: SiteStudyParams,
      initialSiteStudies: LoadingSiteStudySolution[],
    ): {
      terminateWorkerCallbacks: (() => void)[]
      promises: Promise<SiteStudyWorkerResult>[]
    } => {
      const transformedSiteStudyInput = {
        studyPolygon: siteStudyInput.shape.vertices.map((v) => ({
          x: v.x,
          y: v.y,
        })),
        parameters,
      }
      let terminateWorkerCallbacks: (() => void)[] = []
      const promises: Promise<SiteStudyWorkerResult>[] = initialSiteStudies.map((initialStudy) => {
        const [outputPromise, terminateWorker] = runWorker(transformedSiteStudyInput)
        terminateWorkerCallbacks.push(terminateWorker)
        return outputPromise
          .catch(() => runWorker(transformedSiteStudyInput)[0])
          .then((output) => {
            if (!output.siteStudy) {
              throw new Error("Invalid response from worker")
            }
            return {
              siteStudy: {
                ...output.siteStudy,
                studyPolygon: siteStudyInput,
                id: initialStudy.id,
              },
              hash: output.hash,
              status: "SUCCESS" as const,
            }
          })
          .catch((err) => {
            const errorResult: ErrorResult = {
              id: initialStudy.id,
              status: "ERROR",
              error: err,
            }
            return errorResult
          })
      })
      return { terminateWorkerCallbacks, promises }
    },
    [runWorker],
  )
}

export function useRunSiteStudy() {
  const [prevWorkers, setPrevWorkers] = useRecoilState(prevWorkersAtom)

  const createSiteStudyWorkers = useCreateSiteStudyWorkers()
  const selectAndApplyElementActions = useSelectAndApplyElementActions()
  return useCallback(
    (siteStudyInput: SiteStudyInputPolygon, parameters: SiteStudyParams) => {
      const initialSiteStudies = Array.from(Array(NUMBER_OF_STUDIES)).map(() => ({
        id: newId(),
        status: "LOADING" as const,
      }))
      setSiteStudies(initialSiteStudies)
      prevWorkers.forEach((terminateWorker) => terminateWorker())
      let { terminateWorkerCallbacks, promises } = createSiteStudyWorkers(
        siteStudyInput,
        parameters,
        initialSiteStudies,
      )
      setPrevWorkers(terminateWorkerCallbacks)
      let haveSelectedYet = false
      promises.forEach((promise) => {
        void promise.then((output) => {
          switch (output.status) {
            case "SUCCESS": {
              // The returned promise can possibly be non-relevant if a new site study is started before this run finishes.
              const siteStudyStillRelevant = setSiteStudySolution(output.siteStudy.id, output.siteStudy, output.hash)
              if (!haveSelectedYet && siteStudyStillRelevant) {
                const { success } = selectAndApplyElementActions(output.siteStudy, parameters)
                if (success) {
                  haveSelectedYet = true
                } else {
                  console.error("Failed to select site study, check the baking code!")
                  setFailedSiteStudy(output.siteStudy.id)
                }
              }
              break
            }
            case "ERROR": {
              console.error("Failed twice to generate!")
              setFailedSiteStudy(output.id)
              captureException(output.error, {
                tags: { owner: "squad-composition" },
              })
              break
            }
          }
        })
      })
    },
    [createSiteStudyWorkers, prevWorkers, selectAndApplyElementActions, setPrevWorkers],
  )
}
