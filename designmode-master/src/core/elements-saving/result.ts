import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { ElementContainer } from "src/core/elements/ElementContainer"

export type Ok<T> = {
  type: "ok"
  data: T
}
export type Err<E> = {
  type: "error"
  data: E
}
export type Result<T, E> = Ok<T> | Err<E>

export function ok<T>(data: T): Ok<T> {
  return { type: "ok", data }
}

export function err<E>(error: E): Err<E> {
  return { type: "error", data: error }
}

export function isOk<T>(result: Result<T, any>): result is Ok<T> {
  return result.type === "ok"
}

export function isErr<E>(result: Result<any, E>): result is Err<E> {
  return result.type === "error"
}

export type SavingResult = Result<SavingSuccess, SavingError>

export type SavingSuccess = {
  /**
   * This should contain all the persisted elements with the exact same value
   * as will be returned if the system is queried again (i.e. being the FormaElement
   * returned from the element system after being persisted).
   *
   * The input FormaElement should _NOT_ be reflected in this object, as it
   * might not be fully in sync with the system.
   */
  updatedElementsFromSystem: Map<Urn, FormaElement>
}

export async function mergeOkAndFlatMapAsync<T, E, R>(
  results: Result<T, E>[],
  mapper: (value: T[]) => Promise<Result<R, E>[]>,
): Promise<Result<R, E>[]> {
  if (results.length === 0) {
    return []
  }

  const finalResult: Result<R, E>[] = []
  const dataToMapper: T[] = []

  for (const result of results) {
    if (isOk(result)) {
      dataToMapper.push(result.data)
    } else {
      finalResult.push(result)
    }
  }

  if (dataToMapper.length > 0) {
    for (const item of await mapper(dataToMapper)) {
      finalResult.push(item)
    }
  }

  return finalResult
}

export async function catchSavingError<T>(fn: () => Promise<T>): Promise<Result<T, SavingError>> {
  try {
    return ok(await fn())
  } catch (e) {
    return genericSaveError(e)
  }
}

/**
 * Create a generic save error that ensures error property is actually a Error instance.
 */
export function genericSaveError(
  error: unknown,
  options?: {
    isReported?: boolean
  },
) {
  return err<SavingError>({
    type: "FAILED_TO_SAVE",
    error: error instanceof Error ? error : new Error("Failed to save", { cause: error }),
    ...(options?.isReported != null ? { isReported: options.isReported } : {}),
  })
}

export type NotPersistedContainers = {
  urn: Urn
  container: ElementContainer
  dependenciesPersisted: boolean
  parentUrn?: Urn
}
export type SavingError =
  | {
      type: "SAVING_FOR_SYSTEM_NOT_IMPLEMENTED"
      system: string
    }
  | {
      type: "FAILED_TO_SAVE"
      error: Error
      isReported?: boolean
    }
  | {
      type: "CONFLICT"
    }
  | {
      type: "NO_PROPOSAL"
    }
  | {
      type: "NO_ACCESS"
    }
  | {
      type: "URN_NOT_SAVED_AFTER_MAX_DEPTH"
      urn: Urn
    }
  | {
      type: "FAILED_TO_LOAD_ELEMENT"
      urn: Urn
      error: Error
    }
