import { PROJECT_ID, projectSignal } from "src/core/project/project"
import { DemoBadge } from "src/integrations/demo/demo-badge/DemoBadge"
import styles from "./DesignModeNavbar.module.pcss"
import { isFlagActive, URLFlag } from "src/lib/featureToggling"
import { elementState } from "src/core/elements/ElementState"
import { proposalIdSignal } from "src/core/proposal"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { getBuildingDesignMode } from "src/integrations/building-design-detailedbuilding/building-design-mode"

export default function DesignModeNavbar() {
  const proposalUrn = isAppInitializedSignal.value ? elementState.currentSnapshot.value.rootUrn : ""
  const proposalId = proposalIdSignal.value
  const buildingDesignMode = getBuildingDesignMode()
  const showVisualization = isFlagActive(URLFlag.Visualization)
  return (
    <forma-navbar
      style={{ zIndex: "calc(var(--z-primary-navigation) + 10)" }}
      project-id={PROJECT_ID}
      active-link="design"
      hub-id={projectSignal.value?.hubId}
      proposal-urn={proposalUrn}
      show-building-design-tab={buildingDesignMode}
      show-visualization-tab={showVisualization}
    >
      <div slot="middle" className={styles.NavbarMiddle}>
        <DemoBadge />
      </div>
      <div slot="right" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <forma-navbar-project-members
          project-id={PROJECT_ID}
          invite-link-to={`/designmode/${PROJECT_ID}/${proposalId}`}
        ></forma-navbar-project-members>
      </div>
    </forma-navbar>
  )
}
