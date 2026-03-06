import type { CustomLayoutData } from "./LineBuildingMenus"
import { useMemo } from "preact/hooks"
import { FloorIcons } from "./FloorIcons/FloorIcons"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"

const CustomMenuBodyStyle = `
  padding: 16px 16px 8px 16px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`

export const FloorPlanPreview = ({
  customID,
  customLayoutData,
}: {
  customID: string
  customLayoutData: CustomLayoutData
}) => {
  const customLayout = useMemo(() => {
    return (
      customLayoutData.customLayouts.find((customLayout: CustomLayout) => customLayout.id === customID) ||
      customLayoutData.projectLevelLayouts.find((customLayout: CustomLayout) => customLayout.id === customID)
    )
  }, [customLayoutData, customID])

  if (!customLayout) return null

  return (
    customLayout && (
      <div style={CustomMenuBodyStyle}>
        <FloorIcons floors={customLayout.floors} width={75} />
      </div>
    )
  )
}
