import { APPNAME } from "src/core/analytics"
import { PROJECT_ID } from "src/core/project/project"
import { CurrentLocation } from "src/lib/location"
import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import type { analysisTriggerDisabledSignal } from "src/integrations/analyses/AnalysisSupport/analysisSupport"
import { SUPPORT_LEVEL_COLORS } from "./analysisSupportLevels"
import analysisSupportLevelsImageUrl from "./analysis-support-levels.webp"
import menuStyles from "./Triggers.module.pcss"
import { useTranslator, type I18nStringProvider } from "src/i18n"
import { legacyTrack } from "@spacemakerai/webapp-analytics"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { computed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { Proposal } from "src/core/elements/Proposal"

export const triggerDisabledTooltipText = {
  geometry_alerts: (t) => t(($) => $.analysis.disabledTooltips.geometryAlertsDetected),
  too_many_triangles: (t) => t(($) => $.analysis.disabledTooltips.geometryTooComplex),
  snapshot_not_persisted: (t) => t(($) => $.analysis.disabledTooltips.savingInProgress),
} satisfies Record<string, I18nStringProvider>

export const ColoredBullet = ({ color }: { color: string }) => (
  <div
    className={menuStyles.ColoredBullet}
    style={{
      backgroundColor: color,
    }}
  >
    &nbsp;
  </div>
)

export function AnalysisTriggerSupportLevelTooltip(props: { helpUrl?: string; visible: boolean }) {
  const t = useTranslator()
  const helpUrl = props.helpUrl || "https://help.autodeskforma.com/en/articles/6951253#h_99e4549cc1"
  return (
    <>
      <div id="analysis-trigger-tooltip" style={{ position: "relative", top: "-12px", left: "-16px" }}></div>
      <forma-expanded-tooltip
        target-id="analysis-trigger-tooltip"
        text={t(($) => $.analysis.supportLevel.title)}
        position="left"
        help-url={helpUrl}
        loadingduration={0}
        visible={props.visible.toString()}
      >
        <div>
          <img
            src={analysisSupportLevelsImageUrl}
            alt={t(($) => $.analysis.supportLevel.iconAlt)}
            width="208"
            loading="lazy"
          />
          <div style={{ display: "flex", alignItems: "center" }}>
            <ColoredBullet color={SUPPORT_LEVEL_COLORS.full} />
            {t(($) => $.analysis.supportLevel.buildingsFullSupport)}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <ColoredBullet color={SUPPORT_LEVEL_COLORS.partial} />
            {t(($) => $.analysis.supportLevel.buildingsPartialSupport)}
          </div>
        </div>
      </forma-expanded-tooltip>
    </>
  )
}

export const trackTriggerDisabledHoverOnce = (() => {
  const tracked: Set<AnalysisType> = new Set()
  return (analysisType: AnalysisType, disabledInfo: NonNullable<typeof analysisTriggerDisabledSignal.value>) => {
    if (tracked.has(analysisType)) return
    legacyTrack(`Analysis Trigger: Detailed Analysis - Trigger disabled (hover)`, {
      app: APPNAME,
      projectId: PROJECT_ID,
      proposalId: CurrentLocation.getProposalId(),
      analysisType,
      disabledReason: disabledInfo.code,
      ...(disabledInfo.code === "geometry_alerts" && { messageIds: disabledInfo.messageIds }),
    })
    tracked.add(analysisType)
  }
})()

//Checks if the proposal has 3D geometry (buildings, row houses, or generic volumes)
export const proposalHas3DGeometrySignal = computed<boolean>(() => {
  const is3DElement = (node: ChildNodeContainer) => {
    const properties = node.element.properties
    if (!properties?.category) {
      return false
    }

    const isBuilding = properties.category === "building"
    const isRowHouse = properties.category === "composition"
    const isGenericVolume = properties?.category === "generic" && properties?.name === "Volume"

    return isBuilding || isRowHouse || isGenericVolume
  }
  const snapshot = elementState.currentSnapshot.value
  const proposal = Proposal.of(snapshot)
  return proposal.getToplevelNodes().some(is3DElement)
})
