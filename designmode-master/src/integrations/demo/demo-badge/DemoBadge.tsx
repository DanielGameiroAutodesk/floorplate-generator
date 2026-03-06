import { useState } from "preact/hooks"
import styles from "./DemoBadge.module.pcss"
import { request } from "src/lib/request"
import { constSelector, selectorFamily, useRecoilValueLoadable } from "recoil"
import { useTranslator } from "src/i18n"
import { ClickOutside } from "src/lib/components/ClickOutside"
import { AnalyticsLegacy } from "src/core/analytics"
import { isDemoSignal, projectSignal } from "src/core/project/project"

const EMPTY = undefined

async function fetchCanCreateSites(unifiedProjectId?: string) {
  const input = encodeURIComponent(JSON.stringify({ unified_project_id: unifiedProjectId }))
  const opaUrl = `/api/authz/data/api/sites/edit/can_create_sites?input=${input}`
  const decision = await request(opaUrl).then((res) => res.json())
  return decision?.result
}

const canCreateSites = selectorFamily({
  key: "canCreateSitesState",
  get: (unifiedProjectId?: string) => async () => {
    return await fetchCanCreateSites(unifiedProjectId)
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

function useCanCreateSites(unifiedProjectId?: string, skipCheck?: boolean) {
  const loadableRole = useRecoilValueLoadable(skipCheck ? constSelector(EMPTY) : canCreateSites(unifiedProjectId))
  switch (loadableRole.state) {
    case "hasValue": {
      return loadableRole.getValue()
    }
    default:
  }
}

function intentToIntercomAction(tags?: string[]): { id: number; action: "startChecklist" | "startTour" } | undefined {
  const intent = tags?.find((tag) =>
    ["enrich_project", "quick_massing", "sustainability", "main_call_to_action"].includes(tag),
  )
  switch (intent) {
    case "enrich_project":
      return { id: 32230468, action: "startChecklist" }
    case "quick_massing":
      return { id: 32524236, action: "startChecklist" }
    case "sustainability":
      return { id: 32229906, action: "startChecklist" }
    case "main_call_to_action": {
      const regionalTours = {
        "autodeskforma.eu": 495810,
        "autodeskforma.com": 500211,
        "forma.aus.autodesk.com": 597210,
      }
      const id = Object.entries(regionalTours).find(([domain]) => window.location.hostname.endsWith(domain))?.[1]
      return id ? { id, action: "startTour" } : undefined
    }
  }
}

declare global {
  interface Window {
    Intercom: any
  }
}

export function DemoBadge() {
  const t = useTranslator()
  const [open, setOpen] = useState(false)
  const isDemo = isDemoSignal.value
  const canCreateNewSite = useCanCreateSites(projectSignal.value?.unifiedProjectId, !isDemo)

  if (!isDemo || canCreateNewSite === undefined) {
    return null
  }

  return (
    <ClickOutside onClickOutside={() => open && setOpen(false)}>
      <weave-flyout open={open} nub="up-center">
        <weave-badge
          slot="trigger"
          style={{ cursor: "pointer" }}
          variant="text"
          customBackgroundColor="var(--text-color-placeholder)"
          onClick={() => {
            setOpen(!open)
          }}
        >
          {t(($) => $.demoSite.badge)}
        </weave-badge>
        <div className={styles.demoBadgeFlyout}>
          <h1>{t(($) => $.demoSite.flyout.header)}</h1>
          <p>{t(($) => $.demoSite.flyout.content)}</p>
          <div className={styles.buttonRow}>
            <weave-button
              variant="outlined"
              onClick={() => {
                // Don't track this with new tracking schema
                AnalyticsLegacy.track("Demo Badge - Take tour")
                setOpen(false)
                const intercomAction = intentToIntercomAction(projectSignal.value?.tags)
                if (window.Intercom && intercomAction) {
                  window.Intercom(intercomAction.action, intercomAction.id)
                }
              }}
            >
              {t(($) => $.demoSite.flyout.startGuideButton)}
            </weave-button>
            <weave-tooltip
              text={!canCreateNewSite ? t(($) => $.demoSite.flyout.createSiteTooltip) : ""}
              nub="up-center"
              width="20rem"
            >
              <div>
                <weave-linkbutton
                  href={`/forma-setup?workspace=${projectSignal.value?.customerId}&unifiedProjectId=${projectSignal.value?.unifiedProjectId}`}
                  variant="solid"
                  disabled={!canCreateNewSite}
                  onClick={(e) => {
                    e.preventDefault()
                    // Don't track this with new tracking schema
                    AnalyticsLegacy.track("Demo Badge - Create new project")
                    window.location.href = e.currentTarget?.href
                  }}
                >
                  {t(($) => $.demoSite.flyout.createSiteButton)}
                </weave-linkbutton>
              </div>
            </weave-tooltip>
          </div>
        </div>
      </weave-flyout>
    </ClickOutside>
  )
}
