import { useTranslator } from "src/i18n"
import releaseToFloorplan from "src/integrations/building-systems-line-buildings/assets/release-to-floorplan.gif"

import { ExpandedTooltip } from "src/lib/components/ExpandedTooltip"

export function ReleaseToFloorPlanTooltip({ targetId }: { targetId: string }) {
  const t = useTranslator()
  return (
    <ExpandedTooltip
      target={targetId}
      title={(t) => t(($) => $.building.lineBuilding.releaseToFloorPlanAction)}
      bodyText={(t) => t(($) => $.building.lineBuilding.releaseToFloorPlanExplanation)}
      position="bottom"
      icon={
        <img
          src={releaseToFloorplan}
          alt={t(($) => $.building.lineBuilding.releaseToFloorPlanAnimationAlt)}
          height="110"
          width="196"
          loading="lazy"
        />
      }
    />
  )
}
