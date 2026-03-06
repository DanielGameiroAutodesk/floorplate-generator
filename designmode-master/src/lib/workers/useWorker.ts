import { useCallback } from "react"

type Primitive = undefined | null | boolean | number | symbol | string
interface HasToJSON {
  toJSON(): SerializableParam
}

export type SerializableParam =
  | Primitive
  | HasToJSON
  | ReadonlyArray<SerializableParam>
  | ReadonlySet<SerializableParam>
  | ReadonlyMap<SerializableParam, SerializableParam>
  | Readonly<{ [key: string]: SerializableParam }>

function createWorkerPromise<I, O>(worker: Worker, input: I): Promise<O> {
  return new Promise<O>((resolve, reject) => {
    function workerCallback(e: MessageEvent<O>) {
      worker.terminate()
      resolve(e.data)
    }

    worker.onmessage = workerCallback
    worker.onerror = (error: ErrorEvent) => {
      error.preventDefault()
      worker.terminate()
      reject(new Error(`Error from worker: ${error.message}`, { cause: error }))
    }
    worker.postMessage(input)
  })
}

export function useInputOutputWorker<I extends SerializableParam, O extends SerializableParam>(CustomWorker: {
  new (): Worker
}) {
  return useCallback(
    (input: I): Promise<O> => {
      if (!window.Worker) {
        throw new Error(`Workers are not available in this browser.`)
      }
      const worker = new CustomWorker()
      return createWorkerPromise<I, O>(worker, input)
    },
    [CustomWorker],
  )
}

/**
 * If you need the possibility of terminating the worker while it's running, this hook can be used.
 * @param CustomWorker
 */
export function useInputOutputWorkerWithTerminate<
  I extends SerializableParam,
  O extends SerializableParam,
>(CustomWorker: { new (): Worker }) {
  return useCallback(
    (input: I): [Promise<O>, () => void] => {
      if (!window.Worker) {
        throw new Error(`Workers are not available in this browser.`)
      }
      const worker = new CustomWorker()
      return [createWorkerPromise<I, O>(worker, input), () => worker.terminate()]
    },
    [CustomWorker],
  )
}
