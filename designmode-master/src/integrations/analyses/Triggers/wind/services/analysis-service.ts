import type { Urn } from "@spacemakerai/element-types"
import { requestApiGateway, FetchError } from "src/lib/request"
import { addToast } from "src/integrations/analyses/Triggers/analysis-events"
import type { Circle } from "src/integrations/analyses/Selection/analysis-selection-state"
import { getTranslator } from "src/i18n"

export interface Analysis {
  analysisId: string
  authContext: string
  rootElementUrn: Urn
  createdAt: number
  status: "CREATED" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "STOPPED" | "INVALIDATED"
}

type TriggerAnalysisParameters = {
  user_specified_circle?: Circle
  geoLocation: [number, number]
  force_run_analysis_with_steep_terrain?: boolean
}

export type AnalysisStatus = {
  concurrentUsage: number
  concurrentLimit: number
  last24hUsage: number
  last24hLimit: number
  queueStatus: "OK" | "AT_CAPACITY"
  nextAvailableAt: number | null
}

export async function getWindStatus(): Promise<AnalysisStatus | undefined> {
  const response = await requestApiGateway(`/api/wind-analysis/status`, {
    method: "GET",
  })
  return (await response.json()) as AnalysisStatus
}

export async function triggerAnalysis(
  rootElementUrn: Urn,
  parameters: TriggerAnalysisParameters,
): Promise<Analysis | undefined> {
  const authcontext = rootElementUrn.split(":")[3]

  try {
    const response = await requestApiGateway(`/api/wind-analysis/order?authcontext=${authcontext}`, {
      method: "POST",
      body: JSON.stringify({ rootElementUrn, parameters }),
      headers: { "Content-Type": "application/json" },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = errorText ? (JSON.parse(errorText) as { errorCode?: string }) : {}
      const errorCode = error.errorCode?.toString()
      const status = response.status

      if (status === 429) {
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

      throw new Error(errorText || response.statusText)
    }

    return (await response.json()) as Analysis
  } catch (err: unknown) {
    // Don't capture 401/403 errors (handled globally)
    if (err instanceof FetchError && err.responseCode && [0, 401, 403].includes(err.responseCode)) {
      throw err
    }
    throw err
  }
}

export async function fetchLatestAnalysis(
  authcontext: string,
  rootElementUrnPrefix: Urn,
): Promise<Analysis | undefined> {
  const response = await requestApiGateway(
    `/api/wind-analysis?authcontext=${authcontext}&rootElementUrnPrefix=${rootElementUrnPrefix}&limit=1`,
  )
  const analyses = (await response.json()) as Analysis[]
  return analyses[0]
}

export async function fetchAnalysisById(authcontext: string, analysisId: string): Promise<Analysis | undefined> {
  try {
    const response = await requestApiGateway(`/api/wind-analysis/${analysisId}?authcontext=${authcontext}`)
    return (await response.json()) as Analysis
  } catch (err) {
    if (err instanceof FetchError && err.responseCode === 404) {
      return undefined
    }
    throw err
  }
}
