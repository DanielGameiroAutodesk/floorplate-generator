import type { SpaceUnits, FloorPlansByBuilding, FloorTemplate } from "./matchingFloorPlansInBuildings"
import { useMemo, useState } from "react"
import { useRef } from "preact/hooks"
import { ContextMenuWrapper } from "./ContextMenu"
import { LayoutIcon } from "src/integrations/building-systems-basic-building/floorPlansMenu/SvgComponents/LayoutsIcon"
import type { FootPrint } from "./footPrints"
import { getRealignFootPrintTransform } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlansSwapMenu/ShapeMatching/realignShapes"
import { transformPolygonWithHolesXY } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import { useTranslator } from "src/i18n"

const FeatureBodyBoxStyle = `
    display: flex;
    justify-content: space-between;
    width: 100%;
    align-items: center;
    height: 40px;
 `

const InnerTileStyle = `
    display: flex;
    align-items: center;
    cursor: pointer;
 `

const FeatureBoxTextItemsStyle = (hover: boolean, numberOfIcons: number) => `
  height: 36px;
  min-width: 50px;
  max-width: ${numberOfIcons === 2 ? "134px" : numberOfIcons === 1 ? "162px" : "190px"};
  border-top-right-radius: 2px;
  border-bottom-right-radius: 2px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding-left: 12px;
  padding-right: 10px;
  ${hover ? "background: var(--background-color-ghost-high-hover);" : ""}

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`

const NameTextStyle = `
  font: var(--11-medium);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 100%;
`

const TileButtonsStyle = `
  display: flex;
  cursor: pointer;
`

const FloorPlanTile = ({
  spaceUnits,
  onClick,
  addToLibrary,
  onDelete,
  name,
  empty,
}: {
  spaceUnits: SpaceUnits
  onClick: () => void
  addToLibrary: () => void
  onDelete?: () => void
  name: string
  empty: boolean
}) => {
  const t = useTranslator()
  const ref = useRef<HTMLDivElement>(null)

  const [hover, setHover] = useState(false)

  const [contextMenuOpen, setContextMenuOpen] = useState<undefined | { top: number; right: number }>(undefined)

  return (
    <div
      style={FeatureBodyBoxStyle}
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={(e) => {
        setContextMenuOpen({ top: e.clientY, right: window.innerWidth - e.clientX })
        e.preventDefault()
      }}
    >
      <div style={InnerTileStyle} onClick={onClick}>
        <LayoutIcon spaceUnits={spaceUnits} width={28} height={28} />
        <div style={FeatureBoxTextItemsStyle(hover, hover ? 1 : 0)}>
          <div style={NameTextStyle}>{name}</div>
        </div>
      </div>
      {!empty && hover && onDelete && (
        <div style={TileButtonsStyle}>
          <weave-icon-button onClick={onDelete}>
            <weave-close slot={"icon"} />
          </weave-icon-button>
        </div>
      )}

      {contextMenuOpen && (
        <ContextMenuWrapper
          close={() => setContextMenuOpen(undefined)}
          top={contextMenuOpen.top}
          right={contextMenuOpen.right}
        >
          <forma-context-menu>
            <forma-context-menu-item text={t(($) => $.ui.edit)} onClick={onClick} />
            {!empty && (
              <forma-context-menu-item
                text={t(($) => $.building.floorPlans.addToLibraryTooltip)}
                onClick={addToLibrary}
              />
            )}
            {!empty && onDelete && <forma-context-menu-item text={t(($) => $.ui.delete)} onClick={onDelete} />}
          </forma-context-menu>
        </ContextMenuWrapper>
      )}
    </div>
  )
}

export function getRealignFloorPlanAndFootPrint(spaceUnits: SpaceUnits, footPrint: FootPrint) {
  const transform = getRealignFootPrintTransform(footPrint)
  if (transform === undefined) return { spaceUnits, footPrint }
  const realignedFootPrint = footPrint.map((polygonWithHoles) =>
    transformPolygonWithHolesXY(polygonWithHoles, transform.origin, transform.unitVector),
  )
  const realignedSpaceUnits = spaceUnits.map((spaceUnit) => {
    const polygonWithHoles = transformPolygonWithHolesXY(spaceUnit, transform.origin, transform.unitVector)
    return { ...spaceUnit, ...polygonWithHoles }
  })
  return { spaceUnits: realignedSpaceUnits, footPrint: realignedFootPrint }
}

const FeaturesWrapperStyle = `
  max-height: 240px;
  overflow: auto;
`
type SelectFloorPlansProps = {
  selectedFloorPlansByBuilding: FloorPlansByBuilding
  editFloor: (buildingIndex: number, spaceUnits: SpaceUnits) => void
  emptyFloor: (buildingIndex: number, spaceUnits: SpaceUnits) => void
  addToLibrary: (name: string, floorTemplate: FloorTemplate) => void
}
export const SelectedFloorPlans = ({
  selectedFloorPlansByBuilding,
  editFloor,
  emptyFloor,
  addToLibrary,
}: SelectFloorPlansProps) => {
  const selectedFloors = useMemo(() => {
    const selectedFloors: {
      realignedSpaceUnits: SpaceUnits
      realignedFootPrint: FootPrint
      spaceUnits: SpaceUnits
      empty: boolean
      buildingIndex: number
      name: string
    }[] = []
    let buildingNr = 1
    selectedFloorPlansByBuilding.forEach((building, buildingIndex) => {
      let addedFloorPlan = false
      const needsNumbering = building.flat().length > 1
      let templateNr = 1

      building.forEach((floorTemplate) => {
        const realignFloorPlanAndFootPrint = getRealignFloorPlanAndFootPrint(
          floorTemplate.spaceUnits,
          floorTemplate.footPrint,
        )
        addedFloorPlan = true
        selectedFloors.push({
          realignedSpaceUnits: realignFloorPlanAndFootPrint.spaceUnits,
          realignedFootPrint: realignFloorPlanAndFootPrint.footPrint,
          spaceUnits: floorTemplate.spaceUnits,
          empty: floorTemplate.empty,
          buildingIndex,
          name: "Floor plan " + buildingNr + (needsNumbering ? " - " + templateNr++ : ""),
        })
      })
      if (addedFloorPlan) buildingNr++
    })
    return selectedFloors
  }, [selectedFloorPlansByBuilding])
  return (
    <>
      <div style={FeaturesWrapperStyle}>
        {selectedFloors.map((selectedFloor) => {
          return (
            <FloorPlanTile
              key={selectedFloor.name}
              name={selectedFloor.name}
              spaceUnits={selectedFloor.realignedSpaceUnits}
              onClick={() => {
                editFloor(selectedFloor.buildingIndex, selectedFloor.spaceUnits)
              }}
              onDelete={() => {
                emptyFloor(selectedFloor.buildingIndex, selectedFloor.spaceUnits)
              }}
              empty={selectedFloor.empty}
              addToLibrary={() => {
                addToLibrary(selectedFloor.name, {
                  spaceUnits: selectedFloor.realignedSpaceUnits,
                  footPrint: selectedFloor.realignedFootPrint,
                  empty: selectedFloor.empty,
                })
              }}
            />
          )
        })}
      </div>
    </>
  )
}
