import type { FetchError } from "src/lib/request"
import { captureException } from "@sentry/browser"

export function captureBuildingSystemsFetchError(error: FetchError) {
  const level = error.responseCode === 401 || error.responseCode === 403 || !error.responseCode ? "warning" : "error"
  captureException(error, {
    level,
    tags: {
      owner: "building-systems",
      responseCode: error.responseCode,
      ...(error.requestId ? { requestId: error.requestId } : {}),
    },
  })
}
