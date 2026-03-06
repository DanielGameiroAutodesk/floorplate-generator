import { captureException } from "@sentry/browser"

/*
 * Timer which logs Sentry errors if it takes more than x seconds from action to autosave triggers
 *
 * - startTimer is initiated in core actions code
 * - cancelTimer is called in the start of the save function
 * */

const TIMEOUT_IN_SECONDS = 20
const TIMEOUT_INTERVAL = TIMEOUT_IN_SECONDS * 1000
let saveInitiatedTimeoutId: NodeJS.Timeout | undefined

function logError(operationName: string): void {
  console.error(
    `Autosave spent more than ${TIMEOUT_IN_SECONDS} seconds from action to initiating a save. Operation: [${operationName}]`,
  )
  captureException(
    new Error(`Autosave spent more than ${TIMEOUT_IN_SECONDS} seconds from action to initiating a save`),
    {
      extra: { operationName },
    },
  )
  cancelLongSaveTimeDetector()
}

// TODO: This isn't used any more. Cleanup the concept of implement?
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function startTimer(name: string) {
  if (saveInitiatedTimeoutId) return
  saveInitiatedTimeoutId = setTimeout(() => logError(name), TIMEOUT_INTERVAL)
}

export function cancelLongSaveTimeDetector() {
  if (saveInitiatedTimeoutId) {
    clearTimeout(saveInitiatedTimeoutId)
    saveInitiatedTimeoutId = undefined
  }
}
