import { createFetchEnhance } from "@spacemakerai/fetch-enhance"
import { getTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

const fetchEnhance = createFetchEnhance({
  clientName: "proposal-list-v2",
})

export async function request(url: string, options?: { method: string; body?: string }) {
  const response = await fetchEnhance(url, {
    ...options,
    skipFetchErrorForStatus: [401],
  })

  if (response.status === 401) {
    window.forma_toasts.push({
      content: getTranslator()(($) => $.toast.sessionExpired),
      status: "warning",
      autoDismiss: false,
    })
    return undefined
  }

  return response
}
