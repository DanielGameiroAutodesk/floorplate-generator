import type { Urn } from "forma-elements"
import { getNewestRevision } from "./ProposalElements"
import { captureException } from "@sentry/browser"
import { getTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

export async function downloadIfcFile(projectId: string, proposalUrn: Urn) {
  window.forma_toasts.push({
    content: getTranslator()(($) => $.toast.ifcExportStarted),
    status: "primary",
    autoDismiss: false,
  })

  try {
    const newestUrn = await getNewestRevision(proposalUrn)

    // This will fetch a signed s3 url if response is successful.
    const apiUrl = `/api/get-ifc/${projectId}/${newestUrn}?authcontext=${projectId}`
    const result = await fetch(apiUrl)
    if (!result.ok) {
      throw new Error(`API request failed with status ${result.status}: ${result.statusText}`)
    }
    const s3Url = await result.text()

    // Validate that we received a URL
    if (!s3Url || !s3Url.startsWith("https")) {
      throw new Error("Invalid URL received from API")
    }

    const a = document.createElement("a")
    a.href = s3Url
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (error) {
    window.forma_toasts.push({
      content: getTranslator()(($) => $.toast.ifcExportFailed),
      status: "error",
      autoDismiss: false,
    })
    captureException(error)
  }
}
