import { FetchError } from "@spacemakerai/fetch-enhance"
import type { Urn } from "forma-elements"

import { request } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/http"
import { getTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

// Sentry link: https://spacemaker-ai.sentry.io/projects/export-proposal-ifc/?project=4508856732024832
const DSN = "https://94199936718de9cc2bb21b9074120879@o163647.ingest.us.sentry.io/4508856732024832"
const RELEASE = __SENTRY_RELEASE__ || "local"

// We use our own definition to ensure sentry errors get directed to the apprioriate project.
function captureException(exception: unknown) {
  if (window.SENTRY?.captureException) {
    window.SENTRY.captureException(exception, {
      dsn: DSN,
      release: RELEASE,
    })
  } else {
    console.error("Failed to captureException.")
  }
}

function getSuccessToast() {
  const t = getTranslator()
  return {
    content: {
      linkText: t(($) => $.toast.exportSuccessLinkText),
      title: t(($) => $.toast.exportSuccessTitle),
      text: t(($) => $.toast.exportSuccessText),
      url: "https://acc.autodesk.com/home",
    },
    status: "success" as const,
    target: "_blank",
    autoDismiss: false,
  }
}

function getGenericErrorToast() {
  const t = getTranslator()
  return {
    content: {
      title: t(($) => $.toast.exportErrorTitle),
      text: t(($) => $.toast.exportErrorText),
    },
    status: "error" as const,
    autoDismiss: false,
  }
}

function getTimeoutToast() {
  const t = getTranslator()
  return {
    content: {
      title: t(($) => $.toast.exportTimeoutTitle),
      text: t(($) => $.toast.exportTimeoutText),
    },
    status: "error" as const,
    autoDismiss: false,
  }
}

function getAccessDeniedToast() {
  const t = getTranslator()
  return {
    content: {
      title: t(($) => $.toast.exportAccessDeniedTitle),
      text: t(($) => $.toast.exportAccessDeniedText),
    },
    status: "warning" as const,
    autoDismiss: false,
  }
}

// 600 * 1500 => 900_000 ms = 15 minutes
const POLLING_COUNT = 600
const POLLING_TIMEOUT = 1500 // in milliseconds

type PollingArgs = {
  docsProjectId: string
  docsFolderId: string
  exportId: string
  authContext: string
}

function startPolling(args: PollingArgs, count = POLLING_COUNT) {
  return new Promise((resolve, reject) => {
    // Poll for 15 minutes and after that, we call it a fail
    async function poll(args: PollingArgs, count = POLLING_COUNT) {
      if (count < 0) {
        // We've timed out.
        const timeoutError = new Error("Polling timed out")
        captureException(timeoutError)
        window.forma_toasts?.push({ ...getTimeoutToast(), id: args.exportId })
        reject(timeoutError)
        return
      }

      try {
        const response = await request(
          `/api/proposal-docs-mirror/project/${args.docsProjectId}/folder/${args.docsFolderId}/exports/${args.exportId}?authcontext=${args.authContext}`,
        )

        // This will happen if the user got a 401 (users token has expired)
        // The request function already covers this with a toast so we can just
        // terminate here as the user has to refresh.
        if (response === undefined) {
          resolve(true)
          return
        }

        const result = (await response.json()) as PollingResponse
        if (result.status === "COMPLETED") {
          window.forma_toasts?.push({ ...getSuccessToast(), id: args.exportId })
          resolve(true)
          return
        }
        if (result.status === "FAILED") {
          // Error logging should have been done in the backend
          const failedError = new Error("Export failed")
          window.forma_toasts?.push({ ...getGenericErrorToast(), id: args.exportId })
          reject(failedError)
          return
        }
      } catch (err) {
        captureException(err)

        // If the fetch failes, we should expect a FetchError
        if (err instanceof FetchError) {
          if (err.response?.status === 403) {
            window.forma_toasts?.push({ ...getAccessDeniedToast(), id: args.exportId })
          }
        } else {
          window.forma_toasts?.push({ ...getGenericErrorToast(), id: args.exportId })
        }

        reject(err instanceof Error ? err : new Error(String(err)))
      }

      // Wait
      setTimeout(() => void poll(args, count - 1), POLLING_TIMEOUT)
    }

    void poll(args, count)
  })
}

type CreateExportArgs = {
  proposalUrn: Urn
  filename: string
  docsHubId: string
  docsProjectId: string
  docsFolderId: string
}

type CreateExportResponse = {
  exportId: string
}

type PollingResponse = {
  status: "CREATED" | "COMPLETED" | "IN_PROGRESS" | "FAILED"
}

export async function createExport(args: CreateExportArgs) {
  const authContext = args.proposalUrn.split(":")[3]
  let result: CreateExportResponse

  try {
    const response = await request(
      `/api/proposal-docs-mirror/project/${args.docsProjectId}/folder/${args.docsFolderId}/exports?authcontext=${authContext}`,
      {
        method: "POST",
        body: JSON.stringify({
          hubId: args.docsHubId,
          proposalUrn: args.proposalUrn,
          filename: args.filename,
        }),
      },
    )

    // This will happen if the user got a 401 (users token has expired)
    // The request function already covers this with a toast so we can just
    // terminate here as the user has to refresh.
    if (response === undefined) {
      return
    }

    result = (await response.json()) as CreateExportResponse
  } catch (err) {
    captureException(err)

    if (err instanceof FetchError) {
      if (err.response?.status === 403) {
        window.forma_toasts?.push(getAccessDeniedToast())
      } else {
        window.forma_toasts?.push(getGenericErrorToast())
      }
    }

    return
  }

  await startPolling({
    docsFolderId: args.docsFolderId,
    docsProjectId: args.docsProjectId,
    exportId: result.exportId,
    authContext,
  })

  return
}
