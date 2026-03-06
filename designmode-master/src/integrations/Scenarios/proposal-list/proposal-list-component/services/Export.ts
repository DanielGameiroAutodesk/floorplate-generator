import type { Urn } from "forma-elements"
import { getNewestRevision } from "./ProposalElements"
import { getTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

function isTimeoutOrCrash(response: Response, durationInMs: DOMHighResTimeStamp) {
  return (
    // API Gateway gives 504 if it takes too long time.
    response.status === 504 ||
    // API Gateway gives 502 if the service crashes.
    // We assume that if it has run for at least a few seconds
    // and gives 502 it's due to the service crashing and too complex results.
    (response.status === 502 && durationInMs >= 2000)
  )
}

export async function exportProposal(projectId: string, proposalUrn: Urn) {
  window.forma_toasts.push({
    content: getTranslator()(($) => $.toast.exportInProgress),
    status: "primary",
    autoDismiss: false,
  })

  const newestUrn = await getNewestRevision(proposalUrn)

  const exportStart = performance.now()
  const url = `/api/export-service/export/${encodeURIComponent(newestUrn)}?authcontext=${encodeURIComponent(projectId)}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      const durationInMs = performance.now() - exportStart

      if (isTimeoutOrCrash(response, durationInMs)) {
        window.forma_toasts.push({
          content: getTranslator()(($) => $.toast.exportTooLargeError),
          status: "error",
          autoDismiss: false,
        })
        return
      }
      throw new Error(`Received status ${response.status} when trying to export`)
    }

    const body = (await response.json()) as {
      downloadUrl: string
    }

    const a = document.createElement("a")
    a.href = body.downloadUrl
    a.click()

    window.forma_toasts.push({
      content: getTranslator()(($) => $.toast.exportDownloaded),
      status: "success",
      autoDismiss: false,
    })
  } catch (e) {
    window.forma_toasts.push({
      content: getTranslator()(($) => $.toast.exportGenericError),
      status: "error",
      autoDismiss: false,
    })

    throw new Error(`Fetch on url= ${url} failed. Error=${String(e)}`)
  }
}
