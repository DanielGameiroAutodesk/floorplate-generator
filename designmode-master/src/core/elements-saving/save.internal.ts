import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { getNotPersisted } from "./state.internal"
import type { NotPersistedContainers, Result, SavingError, SavingSuccess } from "./result"
import { err, isErr, isOk, ok } from "./result"
import { parseUrn } from "src/lib/element/urn"
import { PROJECT_ID } from "src/core/project/project"
import { isDefined } from "src/lib/array"
import { FormaElementBox } from "src/lib/element/statebox"
import { addToMap } from "src/lib/map"
import { isDebugEnabled } from "src/lib/debug"
import { getRegisteredElementSystem } from "src/core/element-systems"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"

export async function save(snapshot: ElementSnapshot): Promise<Result<SavingSuccess, SavingError[]>> {
  const allElements = new Map(snapshot.getFormaElementBoxes())
  const savedElements = new Map<Urn, FormaElement>()
  let notPersistedElements = getNotPersisted(snapshot)
  const MAX_ITER = 10
  let iter = 1
  while (notPersistedElements.length > 0 && iter < MAX_ITER) {
    iter++

    const groupedBySystem = notPersistedElements.reduce<Record<string, NotPersistedContainers[]>>((prev, curr) => {
      const system = parseUrn(curr.urn).system
      if (!isDefined(prev[system])) {
        prev[system] = []
      }
      prev[system].push(curr)
      return prev
    }, {})

    const saveCalls = Object.entries(groupedBySystem).flatMap(
      ([systemName, toBeSaved]): Promise<Result<SavingSuccess, SavingError>[]> => {
        const system = getRegisteredElementSystem(systemName)
        if (!isDefined(system) || !isDefined(system.saveHandler)) {
          return Promise.resolve([
            err<SavingError>({
              type: "SAVING_FOR_SYSTEM_NOT_IMPLEMENTED",
              system: systemName,
            }),
          ])
        }

        if (isDebugEnabled) {
          const depReady = toBeSaved.reduce((acc, cur) => acc + (cur.dependenciesPersisted ? 1 : 0), 0)
          const depWait = toBeSaved.reduce((acc, cur) => acc + (cur.dependenciesPersisted ? 0 : 1), 0)

          console.log(`Save for ${systemName} (${depReady} elements with dependencies persisted, ${depWait} not)`, {
            toBeSaved,
          })
        }

        return system.saveHandler(toBeSaved, PROJECT_ID)
      },
    )
    const saved = (await Promise.all(saveCalls)).flat()

    for (const response of saved) {
      if (isOk(response)) {
        addToMap(savedElements, response.data.updatedElementsFromSystem)

        for (const [urn, element] of response.data.updatedElementsFromSystem) {
          allElements.set(urn, FormaElementBox.fromServer(element))
        }
      }
    }

    const errors = saved.filter(isErr)
    if (errors.length > 0) {
      return err(errors.map((err) => err.data))
    }

    notPersistedElements = getNotPersisted(snapshot, new Set(savedElements.keys()))
  }

  if (notPersistedElements.length > 0) {
    return err(notPersistedElements.map(({ urn }): SavingError => ({ type: "URN_NOT_SAVED_AFTER_MAX_DEPTH", urn })))
  }

  return ok({
    updatedElementsFromSystem: savedElements,
  })
}
