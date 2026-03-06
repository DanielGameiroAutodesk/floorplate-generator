import { requestApiGateway } from "src/lib/request"
import type { Analysis, SunDate } from "src/integrations/analyses/Triggers/sun/services/analysis-service"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID, projectSignal } from "src/core/project/project"
import { useSignal, useSignalEffect } from "@preact/signals"
import { proposalHas3DGeometrySignal } from "src/integrations/tutorial/state/has3DGeometry"
import { useEffect } from "preact/compat"
import {
  AUTOMATED_ONBOARDING_PARAM,
  hasTriggeredSunAnalysisSignal,
  runAutomatedOnboardingSignal,
} from "./automatedOnboardingState"
import SunAnalysisCoachmark from "./SunAnalysisCoachmark"
import { fetchLibraryItems, Status } from "src/integrations/library/api"
import FinalModal from "./FinalModal"
import IntroModal from "./IntroModal"
import { getTranslator } from "src/i18n"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { EXPERIMENT_ID } from "./analytics"

const POLL_INTERVAL_MS = 2000
const DEFAULT_SUN_DATE: SunDate = { month: 6, date: 21 }

interface AnalysisParams {
  selectedElementPaths: string[]
  sunDate: SunDate
  geoLocation: [number, number] // lat,lon
}

interface TriggerPayload {
  rootElementUrn: string
  params: AnalysisParams
  tags?: string[]
}

async function triggerSunAnalysis(rootElementUrn: string, params: AnalysisParams) {
  const authContext = rootElementUrn.split(":")[3]
  const payload: TriggerPayload = {
    rootElementUrn,
    params,
    tags: ["exclude-vegetation", "catalog"],
  }

  const response = await requestApiGateway(`/api/sun-analysis/trigger?authcontext=${authContext}`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  })

  Analytics.track(
    EventName.Run,
    {
      feature_category: FeatureCategory.Analysis,
      feature: "analysis-trigger",
    },
    {
      experiment_id: EXPERIMENT_ID,
      analysis_type: "sun",
      has_3d_geometry: true, //trigger only called if proposal has 3D geometry
      automated: true,
    },
  )

  return (await response.json()) as Analysis
}

const AutomatedOnboarding = () => {
  if (!runAutomatedOnboardingSignal.value) {
    return null
  }
  return <AutomatedOnboardingInner />
}

// User-facing state: Controls which modal to show
type ModalState = "intro" | "final" | "none" | "done"

function AutomatedOnboardingInner() {
  const modalStateSignal = useSignal<ModalState>("intro")

  const buildingOrdersCompleteSignal = useSignal(false)
  const hasAttemptedSunAnalysisSignal = useSignal(false)

  // Remove query param on load
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete(AUTOMATED_ONBOARDING_PARAM)
    window.history.replaceState({}, document.title, url)
  }, [])

  // Poll order API to check that all building orders have succeeded
  useSignalEffect(() => {
    let cancelled = false
    let timeoutId: NodeJS.Timeout | undefined

    const pollBuildingOrders = async () => {
      if (cancelled) return

      const items = await fetchLibraryItems(PROJECT_ID)
      const buildingOrders = items.filter(
        (item) =>
          item.properties?.["orderId"] &&
          (item.properties?.["dataType"] === "buildings" || item.properties?.["dataType"] === "buildings-lod2"),
      )

      if (buildingOrders.length === 0) {
        buildingOrdersCompleteSignal.value = true
        return
      }

      const allSucceeded = buildingOrders.every((o) => o.status === Status.SUCCESS)
      const someFailed = buildingOrders.some((o) => o.status === Status.FAILED)

      if (allSucceeded) {
        buildingOrdersCompleteSignal.value = true
        return
      }

      if (someFailed) {
        // No toast necessary, handled by error handling in useAutoPlaceDataOrders
        console.error("[AutomatedOnboarding] Building data order failed.")
        return
      }

      timeoutId = setTimeout(() => void pollBuildingOrders(), POLL_INTERVAL_MS)
    }

    void pollBuildingOrders()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  })

  // Automatically trigger sun analysis when building data orders are
  // complete and we have 3D geometry in the proposal.
  // Only attempt the trigger once, and update the trigger signal if succeeded
  useSignalEffect(() => {
    const snapshot = elementState.currentSnapshot.value
    if (!snapshot.isPersisted) return

    if (hasAttemptedSunAnalysisSignal.value) return

    if (!buildingOrdersCompleteSignal.value) return

    if (!proposalHas3DGeometrySignal.value) return

    const geoLocation = projectSignal.value?.geoLocation
    if (!geoLocation) return

    hasAttemptedSunAnalysisSignal.value = true

    const rootElementUrn = snapshot.rootUrn

    triggerSunAnalysis(rootElementUrn, {
      selectedElementPaths: ["root"],
      geoLocation,
      sunDate: DEFAULT_SUN_DATE,
    })
      .then(() => {
        hasTriggeredSunAnalysisSignal.value = true
      })
      .catch(() => {
        const t = getTranslator()
        window.forma_toasts.push({
          status: "error",
          content: t(($) => $.automatedOnboarding.sunAnalysisTriggerError),
          autoDismiss: false,
        })
      })
  })

  // Listen for analysis modal close
  useEffect(() => {
    const handler = () => {
      if (modalStateSignal.peek() === "done") return

      if (hasTriggeredSunAnalysisSignal.peek()) {
        modalStateSignal.value = "final"
      }
    }

    window.addEventListener("analysis-modal-closed", handler)
    return () => {
      window.removeEventListener("analysis-modal-closed", handler)
    }
  }, [modalStateSignal])

  return (
    <>
      <SunAnalysisCoachmark />
      {modalStateSignal.value === "intro" && <IntroModal onClose={() => (modalStateSignal.value = "none")} />}
      {modalStateSignal.value === "final" && <FinalModal onClose={() => (modalStateSignal.value = "done")} />}
    </>
  )
}

export default AutomatedOnboarding
