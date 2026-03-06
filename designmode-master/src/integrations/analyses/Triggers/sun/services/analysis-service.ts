import { requestApiGateway } from "src/lib/request"

export interface SunDate {
  month: number
  date: number
}

interface AnalysisParams {
  selectedElementPaths: string[]
  sunDate: SunDate
  geoLocation: [number, number] // lat,lon
}

export type TriggerBatchAnalysisParams = Omit<AnalysisParams, "sunDate">

interface TriggerPayload {
  rootElementUrn: string
  scenarioElementUrn?: string
  params: TriggerBatchAnalysisParams
  dates: SunDate[]
  tags?: string[]
}

export interface Analysis {
  analysisId: string
  status: "IN_PROGRESS" | "SUCCEEDED" | unknown
}

export async function triggerBatchAnalysis(
  rootElementUrn: string,
  params: TriggerBatchAnalysisParams,
  dates: SunDate[],
  scenarioElementUrn?: string,
) {
  const authContext = rootElementUrn.split(":")[3]
  const payload: TriggerPayload = {
    rootElementUrn,
    scenarioElementUrn,
    params,
    dates,
  }

  const extraTags: Set<string> = new Set()
  extraTags.add("exclude-vegetation") // TODO: move this logic to backend (always excluding)

  if (extraTags.size > 0) payload.tags = ["catalog", ...Array.from(extraTags)] // override default tags

  const response = await requestApiGateway(`/api/sun-analysis/trigger_batch?authcontext=${authContext}`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  })

  return (await response.json()) as Analysis[]
}

export async function findByInput(rootElementUrn: string, params: AnalysisParams, scenarioElementUrn?: string) {
  const authContext = rootElementUrn.split(":")[3]
  const response = await requestApiGateway(`/api/sun-analysis/find_by_input?authcontext=${authContext}`, {
    method: "POST",
    body: JSON.stringify({
      rootElementUrn,
      scenarioElementUrn,
      params,
    }),
    headers: { "Content-Type": "application/json" },
  })

  return (await response.json()) as Analysis | null
}
