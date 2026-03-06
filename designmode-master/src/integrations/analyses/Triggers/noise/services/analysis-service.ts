import { requestApiGateway, FetchError } from "src/lib/request"
import { addToast } from "src/integrations/analyses/Triggers/analysis-events"
import type { Circle } from "src/integrations/analyses/Selection/analysis-selection-state"
import { getTranslator } from "src/i18n"

export interface TriggerAnalysisParams {
  selectedElementPaths: string[]
  customCircle?: Circle
}

interface Analysis {
  analysisId: string
  status: "CREATED" | "SUCCEEDED"
}

export const createAnalysisUrl = (item: { elementUrn: string; analysisId: string }) =>
  `/noise/${item.elementUrn}/${item.analysisId}`

export async function triggerAnalysis(rootElementUrn: string, params: TriggerAnalysisParams) {
  const authContext = rootElementUrn.split(":")[3]

  try {
    const response = await requestApiGateway(`/api/noise/order?authcontext=${authContext}`, {
      method: "POST",
      body: JSON.stringify({
        rootElementUrn,
        params,
      }),
      headers: { "Content-Type": "application/json" },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = errorText ? (JSON.parse(errorText) as { errorCode?: string }) : {}
      const errorCode = error.errorCode?.toString()
      const status = response.status

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
            text: t(($) => $.analysisErrors.concurrentNoiseAnalysesReached),
          },
          status: "error",
        })
        return null
      } else if (status === 429 && errorCode === "too_many_analyses_per_day") {
        const t = getTranslator()
        addToast({
          content: {
            text: t(($) => $.analysisErrors.dailyNoiseQuotaReached),
          },
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
