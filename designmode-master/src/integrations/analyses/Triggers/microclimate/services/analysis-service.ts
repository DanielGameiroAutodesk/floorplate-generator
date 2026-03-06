import type { Circle } from "src/integrations/analyses/Selection/analysis-selection-state"
import { requestApiGateway, FetchError } from "src/lib/request"
import type { Urn } from "@spacemakerai/element-types"
import { captureException } from "@sentry/browser"
import { addToast } from "src/integrations/analyses/Triggers/analysis-events"
import { getTranslator } from "src/i18n"

export interface TriggerAnalysisParams {
  rootElementUrn: Urn
  selectedElementPaths: string[]
  circle: Circle
  geoLocation: [number, number]
  timezone: string
}

interface Analysis {
  analysisId: string
  status: "IN_PROGRESS" | "SUCCEEDED"
}

export async function triggerAnalysis(parameters: TriggerAnalysisParams) {
  const rootElementUrn = parameters.rootElementUrn
  const authContext = rootElementUrn.split(":")[3]

  // "Fire & forget" to cache the typical weather data
  for (let month = 1; month <= 12; month++) {
    requestApiGateway(
      `/api/microclimate/typical-weather?latitude=${parameters.geoLocation[0]}&longitude=${parameters.geoLocation[1]}&month=${month}&timezone=${parameters.timezone}`,
    ).catch(() => {})
  }

  try {
    const response = await requestApiGateway(`/api/microclimate/order?authcontext=${authContext}`, {
      method: "POST",
      body: JSON.stringify({
        rootElementUrn,
        parameters,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    })
    return (await response.json()) as Pick<Analysis, "analysisId" | "status">
  } catch (err) {
    if (err instanceof FetchError) {
      if ([401, 403].includes(err.responseCode || 0) || err.message.startsWith("Network error")) {
        return null
      }

      if (err.responseCode === 429) {
        try {
          const errorText = err.body
          if (errorText) {
            const error = JSON.parse(errorText) as { errorCode?: string }
            const errorCode = error.errorCode?.toString()
            const t = getTranslator()
            if (errorCode === "too_many_concurrent_analyses") {
              addToast({
                content: {
                  text: t(($) => $.analysisErrors.concurrentAnalysesReached),
                },
                status: "error",
              })
              return undefined
            } else if (errorCode === "too_many_analyses_per_day") {
              addToast({
                content: { text: t(($) => $.analysisErrors.dailyQuotaReached) },
                status: "error",
              })
              return undefined
            }
          }
        } catch {
          // Fall through to generic error handling
        }
      }
      throw new Error(err.body || err.message)
    }
    throw err
  }
}

export interface AnalysisStatus {
  concurrentUsage: number
  concurrentLimit: number
  last24hUsage: number
  last24hLimit: number
  queueStatus: "OK" | "AT_CAPACITY"
}

export async function getWindStatus(): Promise<AnalysisStatus | undefined> {
  try {
    const response = await requestApiGateway(`/api/wind-analysis/status`, {
      method: "GET",
    })
    return (await response.json()) as AnalysisStatus
  } catch (err) {
    if (err instanceof FetchError) {
      // Ignore certain errors
      if ([401, 403].includes(err.responseCode || 0) || err.message.startsWith("Network error")) {
        return undefined
      }
    }
    captureException(err)
    return undefined
  }
}
