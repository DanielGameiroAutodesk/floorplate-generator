import { atom, selector, useRecoilCallback, useRecoilValue } from "recoil"
import { useEffect } from "preact/hooks"
import { FetchError, requestApiGateway } from "src/lib/request"
import { useState } from "preact/compat"
import { captureBuildingSystemsFetchError } from "src/integrations/building-systems-common/captureBuildingSystemsFetchError"
import { newRevision } from "src/lib/element/urn"
import { PROJECT_ID } from "src/core/project/project"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import { getTranslator } from "src/i18n"

type State = { data: CustomLayout[]; revision: string | undefined }
const stateAtom = atom<State>({
  key: "projectLevelFloorPlansAtom",
  default: { data: [], revision: undefined },
})
const persistedRevisionAtom = atom<string | undefined>({
  key: "projectLevelFloorPlansPersistedRevisionAtom",
  default: undefined,
})
const loadedAtom = atom<boolean>({ key: "projectLevelFloorPlansLoadedAtom", default: false })

function fetchProjectLevelPlans(revision?: string): Promise<State> {
  let url = `/api/floor-plan-store/${PROJECT_ID}?authcontext=${PROJECT_ID}&newRepresentations`
  if (revision) url += "&revision=" + revision
  return requestApiGateway(url).then((r) => r.json())
}

function useFetch() {
  const fetchPlans = useRecoilCallback(
    ({ set }) =>
      () => {
        fetchProjectLevelPlans()
          .then((d) => {
            set(stateAtom, d)
            set(persistedRevisionAtom, d.revision)
            set(loadedAtom, true)
          })
          .catch(captureBuildingSystemsFetchError)
      },
    [],
  )
  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])
}

function putProjectLevelPlans(state: State, persistedRevision: string | undefined) {
  return requestApiGateway(
    `/api/floor-plan-store/${PROJECT_ID}?authcontext=${PROJECT_ID}&nextRevision=${state.revision}&newRepresentations`,
    {
      method: "PUT",
      body: JSON.stringify(state.data),
      headers: persistedRevision ? { ["If-Match"]: persistedRevision } : {},
    },
  )
}

function mergeFloorPlans(latest: CustomLayout[], edited: CustomLayout[], original: CustomLayout[]) {
  function getDiffs(updatedLayouts: CustomLayout[], original: CustomLayout[]) {
    const added = updatedLayouts.filter((l) => !original.some((org) => l.id === org.id))
    const deleted = original.filter((l) => !updatedLayouts.some((org) => l.id === org.id))
    const edited = updatedLayouts.filter((l) => original.some((org) => l.id === org.id && l.revision !== org.revision))
    return { added, deleted, edited }
  }
  const localDiffs = getDiffs(edited, original)
  const serverDiffs = getDiffs(latest, original)
  const editConflicts = localDiffs.edited.filter((l) => serverDiffs.edited.some((l2) => l.id === l2.id))

  const edits = localDiffs.edited
    .filter((l) => !serverDiffs.edited.some((l2) => l.id === l2.id))
    .concat(serverDiffs.edited)
  const added = localDiffs.added
    .filter((l) => !serverDiffs.added.some((l2) => l.id === l2.id))
    .concat(serverDiffs.added)
  const deleted = localDiffs.deleted
    .concat(serverDiffs.deleted)
    .filter((d) => !edits.some((e) => e.id === d.id) && !added.some((a) => a.id === d.id))
  const merged: Record<string, CustomLayout> = {}
  for (const customLayout of edits.concat(added)) {
    merged[customLayout.id] = customLayout
  }
  for (const customLayout of original) {
    if (!deleted.some((d) => d.id === customLayout.id) && !merged[customLayout.id])
      merged[customLayout.id] = customLayout
  }
  return { merged: Object.values(merged), conflicts: editConflicts.length > 0 }
}

function useAutoSave() {
  const [saving, setSaving] = useState(false)
  const state = useRecoilValue(stateAtom)
  const persistedRevision = useRecoilValue(persistedRevisionAtom)
  const loaded = useRecoilValue(loadedAtom)

  const save = useRecoilCallback(
    ({ set, snapshot }) =>
      (state: State) => {
        if (!state.revision) {
          console.warn("missing revision on project level floor plans. Dropping save", state)
          return
        }
        console.log("saving", state)
        setSaving(true)
        const persistedRevision = snapshot.getLoadable(persistedRevisionAtom).valueOrThrow()
        putProjectLevelPlans(state, persistedRevision)
          .then(() => {
            set(persistedRevisionAtom, state.revision)
            setSaving(false)
          })
          .catch((e) => {
            if (e instanceof FetchError && e.responseCode === 412) {
              console.warn("Revision mismatch, trying to merge with newest")
              return Promise.all([fetchProjectLevelPlans(), fetchProjectLevelPlans(persistedRevision)]).then(
                ([latest, original]) => {
                  const { merged, conflicts } = mergeFloorPlans(latest.data, state.data, original.data)
                  if (conflicts) throw new Error("conflicting changes in project level floor plans")
                  return putProjectLevelPlans({ ...state, data: merged }, latest.revision).then(() => {
                    set(persistedRevisionAtom, state.revision)
                    set(stateAtom, { ...state, data: merged })
                    setSaving(false)
                  })
                },
              )
            }
            throw e
          })
          .catch((e) => {
            console.warn(e)
            const t = getTranslator()
            window.forma_toasts.push({
              status: "error",
              content: t(($) => $.errors.library.failedToSaveFloorPlans),
              autoDismiss: false,
            })
            captureBuildingSystemsFetchError(e)
          })
      },
    [],
  )
  useEffect(() => {
    if (!loaded) return
    if (state.revision === persistedRevision || saving) return
    const handler = setTimeout(() => {
      return save(state)
    }, 500)
    return () => {
      clearTimeout(handler)
    }
  }, [loaded, persistedRevision, save, saving, state])
}

export function useProjectLevelFloorPlans() {
  useFetch()
  useAutoSave()
}

export const projectLevelFloorPlansSelector = selector({
  key: "projectLevelFloorPlansSelector",
  get: ({ get }) => {
    return get(stateAtom).data
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export function useUpdateProjectLevelFloorPlans() {
  return useRecoilCallback(({ set }) => (data: CustomLayout[]) => {
    const newState = { revision: newRevision(), data }
    set(stateAtom, (old) => (JSON.stringify(newState.data) !== JSON.stringify(old.data) ? newState : old))
  })
}
