import { requestApiGateway, FetchError } from "src/lib/request"
import { addToast } from "src/integrations/analyses/Triggers/analysis-events"
import { getTranslator } from "src/i18n"

export interface TriggerAnalysisParams {
  selectedElementPaths: string[]
}

interface TriggerPayload {
  rootElementUrn: string
  params: TriggerAnalysisParams
  tags?: string[]
}

interface Analysis {
  analysisId: string
  status: "IN_PROGRESS" | "SUCCEEDED"
}

export const createAnalysisUrl = (item: { elementUrn: string; analysisId: string }) =>
  `/sky-component-analysis/${item.elementUrn}/${item.analysisId}`

export async function triggerAnalysis(rootElementUrn: string, params: TriggerAnalysisParams) {
  const authContext = rootElementUrn.split(":")[3]
  const payload: TriggerPayload = {
    rootElementUrn,
    params,
  }

  try {
    const response = await requestApiGateway(`/api/sky-component-analysis/trigger?authcontext=${authContext}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = errorText ? (JSON.parse(errorText) as { errorCode?: string }) : {}
      const errorCode = error.errorCode?.toString()
      const status = response.status

      if (status === 500) {
        const t = getTranslator()
        addToast({
          content: { text: t(($) => $.analysisErrors.somethingWentWrong) },
          status: "error",
        })
        return null
      }

      // Handle specific error cases
      if (status === 400 && errorCode === "no_analyzable_elements") {
        const t = getTranslator()
        addToast({
          content: { text: t(($) => $.analysisErrors.nothingToAnalyze) },
          status: "error",
        })
        return null
      } else if (status === 429 && errorCode === "too_many_concurrent_analyses") {
        const t = getTranslator()
        addToast({
          content: {
            text: t(($) => $.analysisErrors.concurrentAnalysesReached),
          },
          status: "error",
        })
        return null
      } else if (status === 429 && errorCode === "too_many_analyses_per_day") {
        const t = getTranslator()
        addToast({
          content: { text: t(($) => $.analysisErrors.dailyQuotaReached) },
          status: "error",
        })
        return null
      }

      throw new Error(errorText || response.statusText)
    }

    return (await response.json()) as Pick<Analysis, "analysisId" | "status">
  } catch (err: unknown) {
    // Don't capture 401/403 errors (handled globally)
    if (err instanceof FetchError && (err.responseCode === 401 || err.responseCode === 403)) {
      return null
    }
    throw err
  }
}
