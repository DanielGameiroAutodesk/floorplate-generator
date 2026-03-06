import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import { request } from "src/lib/request"
import { parseUrn } from "src/lib/element/urn"
import type { Urn } from "@spacemakerai/element-types"
import { captureException } from "@sentry/browser"
import { Analytics } from "src/core/analytics"
import { PROJECT_ID } from "src/core/project/project"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

const IMPACT_MAPPING_TRIGGERED_LOCAL_STORAGE_KEY = `impact-mapping-triggered-${PROJECT_ID}`
const IMPACT_MAPPING_DISMISSED_LOCAL_STORAGE_KEY_PREFIX = `impact-mapping-toast-dismissed-${PROJECT_ID}`

type IncidentAnalysisType = Exclude<AnalysisType, "area-metrics" | "embodied-carbon">
const analysisTypeToAppName: Record<IncidentAnalysisType, string> = {
  microclimate: "microclimate-analysis",
  wind: "wind",
  noise: "noise",
  sun: "sun-analysis",
  "solar-panel": "solar-energy-analysis",
  "sky-component": "sky-component-analysis",
}

export function checkForPotentialIncidents() {
  const triggeredPastHour = localStorage.getItem(IMPACT_MAPPING_TRIGGERED_LOCAL_STORAGE_KEY)
    ? Date.now() - Number(localStorage.getItem(IMPACT_MAPPING_TRIGGERED_LOCAL_STORAGE_KEY)) < 1000 * 60 * 60
    : false

  if (!triggeredPastHour) {
    request(`/api/impact-mapping/trigger?authcontext=${PROJECT_ID}`, { method: "PUT" })
      .then((resp) => {
        if (resp.ok) {
          localStorage.setItem(IMPACT_MAPPING_TRIGGERED_LOCAL_STORAGE_KEY, Date.now().toString())
        }
      })
      .catch((e) => {
        if ([401, 403, 404].includes(e.responseCode) || e.message.startsWith("Network error")) return
        captureException(new Error("Failed to trigger impact mapping", { cause: e }), {
          tags: { owner: "site-analysis" },
        })
        return
      })
  }
}

type Incident = {
  incidentId: string
  impactLevel: "UPDATE" | "ERROR"
  analysisType: AnalysisType
  impactedAnalyses: {
    id: string
    rootElementUrn: Urn
    newId: string
    status: "REPLACED" | "PENDING_REPLACEMENT"
  }[]
}

export function checkForPotentialImpactedAnalyses(proposalId: string) {
  request(`/api/impact-mapping/check-impacted-project?authcontext=${PROJECT_ID}`)
    .then(async (resp) => {
      if (resp.ok) {
        const incidentsOnProject: Incident[] = await resp.json()
        if (!incidentsOnProject || incidentsOnProject.length === 0) return
        incidentsOnProject.forEach(({ incidentId, analysisType, impactedAnalyses, impactLevel }) => {
          const proposalImpactedAnalyses = impactedAnalyses.filter(({ rootElementUrn, status }) => {
            return parseUrn(rootElementUrn).id === proposalId && status !== "REPLACED"
          })
          if (!proposalImpactedAnalyses || proposalImpactedAnalyses.length === 0) return
          if (localStorage.getItem(`${IMPACT_MAPPING_DISMISSED_LOCAL_STORAGE_KEY_PREFIX}-${incidentId}`)) return
          const redirectAnalysisId = proposalImpactedAnalyses[0].id
          const appName = analysisTypeToAppName[analysisType as IncidentAnalysisType] || analysisType
          const toastContent = {
            title: `Outdated ${analysisType} analysis result`,
            text:
              impactLevel === "UPDATE"
                ? `We released a new version of the ${analysisType} analysis and updated ${proposalImpactedAnalyses.length} of your analysis results`
                : `Results of ${proposalImpactedAnalyses.length} of your previously run ${analysisType} analyses are outdated due to an error`,
            linkText: `View ${impactLevel === "UPDATE" ? "outdated" : "impacted"} results`,
            url: `/${appName}/${proposalImpactedAnalyses[0].rootElementUrn}/${redirectAnalysisId}`,
          }
          Analytics.track(EventName.View, {
            feature_category: FeatureCategory.Analysis,
            feature: "incident notification",
            sub_feature: analysisType,
          })
          window.forma_toasts.push({
            content: toastContent,
            status: impactLevel === "UPDATE" ? "warning" : "error",
            autoDismiss: false,
            onClose: (automatic: boolean) => {
              // automatic is set to true if toast is dismissed without user interaction
              if (automatic) return
              Analytics.track(EventName.Close, {
                feature_category: FeatureCategory.Analysis,
                feature: "incident notification",
                sub_feature: analysisType,
              })
              localStorage.setItem(
                `${IMPACT_MAPPING_DISMISSED_LOCAL_STORAGE_KEY_PREFIX}-${incidentId}`,
                Date.now().toString(),
              )
            },
          })
        })
      }
    })
    .catch((e) => {
      if ([401, 403].includes(e.responseCode) || e.message.startsWith("Network error")) return
      captureException(new Error("Failed to check if impacted", { cause: e }), { tags: { owner: "site-analysis" } })
    })
}
