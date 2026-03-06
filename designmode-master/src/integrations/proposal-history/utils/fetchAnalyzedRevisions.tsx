import type { Urn } from "@spacemakerai/element-types"
import { request } from "src/lib/request"

type AnalysisStatus = "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "STOPPED" | "INVALIDATED"

export type AnalyzedRevision = {
  analysisId: string
  analysisType: string
  elementUrn?: Urn
  status: AnalysisStatus
  createdAt: number
  updatedAt: number
}

// "status" field in catalog has this type
type AnalysisStatusWithExtra =
  | AnalysisStatus
  | `IN_PROGRESS:${number}`
  | `FAILED:${string}`
  | `STOPPED:${string}`
  | `INVALIDATED:${string}`

export const ANALYSIS_TYPE_BASE_LOCATION: Record<string, string> = {
  wind: "wind",
  noise: "noise",
  sun: "sun-analysis",
  microclimate: "microclimate-analysis",
  "sky-component": "sky-component-analysis",
  "solar-panel": "solar-energy-analysis",
}
export const analysesIcons: Record<string, JSX.Element> = {
  wind: <forma-analyse-wind-16 />,
  sun: <forma-analyse-sun-16 />,
  noise: <forma-analyse-noise-16 />,
  microclimate: <forma-analyse-microclimate-16 />,
  "sky-component": <forma-analyse-daylight-16 />,
  "solar-panel": <forma-analyse-solarpanel-16 />,
}

export const ANALYSIS_TYPE_LABEL: Record<string, string> = {
  wind: "Wind",
  sun: "Sun hours",
  microclimate: "Microclimate",
  noise: "Noise",
  "sky-component": "Daylight potential",
  "solar-panel": "Solar energy",
}

export function getAnalysisURL(a: AnalyzedRevision, refRevision: string) {
  return `/${ANALYSIS_TYPE_BASE_LOCATION[a.analysisType]}/${a.elementUrn}/${
    a.analysisId
  }?refRevision=${encodeURIComponent(refRevision)}&source=proposalhistory`
}

// The API returns a status with extra information, e.g. "IN_PROGRESS:1234567890". Not using this info here for now, so just omit it.
const mapAnalysisCatalogItem = (item: AnalyzedRevision & { status: AnalysisStatusWithExtra }) => ({
  ...item,
  status: item.status.split(":", 2)[0] as AnalysisStatus,
})

export default function fetchAnalyzedRevisions(proposalId: string, authContext: string) {
  const baseUrl = "/api/analysis-catalog"
  const prefix = `urn:adsk-forma-elements:proposal:${authContext}:${proposalId}`

  const searchParams = new URLSearchParams()
  searchParams.set("authcontext", authContext)
  searchParams.set("analysesType", Object.values(ANALYSIS_TYPE_BASE_LOCATION).join(","))
  searchParams.set("status", "SUCCEEDED,IN_PROGRESS,INVALIDATED")
  searchParams.set("elementUrnPrefix", prefix)

  const url = `${baseUrl}?${searchParams.toString()}`
  return request(url)
    .then(async (res) => (await res.json()) as (AnalyzedRevision & { status: AnalysisStatusWithExtra })[])
    .then((items) => items.map(mapAnalysisCatalogItem))
}

export const formatAnalysisDate = (analysisDate: number) =>
  `${new Date(analysisDate * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} at ${new Date(analysisDate * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`

export const AnalysisInProgressDot = () => (
  <svg
    width="6"
    height="6"
    viewBox="0 0 6 6"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ position: "absolute", top: "-3px", right: "-4px" }}
  >
    <rect x="0.5" y="0.5" width="5" height="5" rx="2.5" fill="#CDEAF7" fillOpacity="0.6" />
    <rect x="0.5" y="0.5" width="5" height="5" rx="2.5" stroke="#0696D7" />
  </svg>
)
