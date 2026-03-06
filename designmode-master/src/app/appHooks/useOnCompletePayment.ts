import { useEffect } from "preact/compat"
import { useSetRecoilState } from "recoil"
import { resourcesModalState } from "src/integrations/resources-modal/ResourcesModal"
import { AnalyticsLegacy } from "src/core/analytics"

const STRIPE_URL_PARAM = "stripe"

export default function useOnCompletePayment() {
  const setResourcesModalOpen = useSetRecoilState(resourcesModalState)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has(STRIPE_URL_PARAM)) {
      // don't track this with new tracking schema
      AnalyticsLegacy.track("Resource modal (open)", { source: "Data order successful" })
      setResourcesModalOpen({ open: true, tab: "order" })
      url.searchParams.delete(STRIPE_URL_PARAM)
      window.history.replaceState({}, document.title, url)
    }
  }, [setResourcesModalOpen])
}
