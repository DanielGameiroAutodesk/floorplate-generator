import type { Urn } from "forma-elements"
import { getNewestRevision } from "./ProposalElements"
import { getTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

export async function editInRevit(projectId: string, proposalUrn: Urn) {
  const newestUrn = await getNewestRevision(proposalUrn)
  const url = `/api/revit/sync?projectId=${projectId}&authcontext=${projectId}`
  try {
    return await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        elementId: newestUrn,
        dataRegion: window.location.origin,
        projectId,
      }),
    })
      .then(() => {
        window.forma_toasts.push({
          content: getTranslator()(($) => $.toast.revitSendSuccess),
          status: "success",
        })
      })
      .catch((e) => {
        console.error(e)
        window.forma_toasts.push({
          content: getTranslator()(($) => $.toast.revitSendFailed),
          status: "error",
        })
      })
  } catch (e) {
    throw new Error(`Fetch on url= ${url} failed. Error=${String(e)}`)
  }
}

export function downloadRevitAddIn() {
  window.open("/api/revit/installer/latest?nextgen", "_blank")
}
