import { requestApiGateway, FetchError } from "src/lib/request"

const isDetailedStatsEnabled = new URLSearchParams(window.location.search).has("detailedStats")

export interface TriggerAnalysisParams {
  selectedElementPaths: string[]
  geoLocation: [number, number]
}

interface Analysis {
  analysisId: string
  status: "CREATED" | "IN_PROGRESS" | "SUCCEEDED"
}

interface TriggerPayload {
  rootElementUrn: string
  params: TriggerAnalysisParams
  tags?: string[]
}

export const createAnalysisUrl = (item: { elementUrn: string; analysisId: string }) =>
  `/solar-energy-analysis/${item.elementUrn}/${item.analysisId}`

export async function triggerAnalysis(rootElementUrn: string, params: TriggerAnalysisParams) {
  const authContext = rootElementUrn.split(":")[3]
  const payload: TriggerPayload = {
    rootElementUrn,
    params,
  }

  const extraTags: Set<string> = new Set()
  if (isDetailedStatsEnabled) extraTags.add("semanticMesh")
  if (extraTags.size > 0) payload.tags = ["catalog", ...Array.from(extraTags)] // override default tags

  try {
    const response = await requestApiGateway(`/api/solar-panel-analysis/trigger?authcontext=${authContext}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = errorText ? (JSON.parse(errorText) as { errorCode?: string }) : {}
      const errorCode = error.errorCode?.toString()
      const status = response.status

      // These errors are handled with toasts in the component, return null
      if (status === 400 && errorCode === "no_analyzable_elements") {
        throw new Error("Nothing to analyze")
      } else if (status === 429 && errorCode === "too_many_concurrent_analyses") {
        throw new Error("The limit of concurrent analyses has been reached")
      } else if (status === 429 && errorCode === "too_many_analyses_per_day") {
        throw new Error("Daily analysis quota has been reached")
      } else if (status === 500) {
        throw new Error("Something went wrong")
      }

      throw new Error(errorText || response.statusText)
    }

    return (await response.json()) as Pick<Analysis, "analysisId" | "status">
  } catch (err: unknown) {
    // Don't capture 401/403 errors (handled globally)
    if (err instanceof FetchError && (err.responseCode === 401 || err.responseCode === 403)) {
      throw err
    }
    throw err
  }
}

export async function fetchAnalysisById(authContext: string, analysisId: string) {
  const response = await requestApiGateway(`/api/solar-panel-analysis/${analysisId}?authcontext=${authContext}`)
  return (await response.json()) as Analysis
}
