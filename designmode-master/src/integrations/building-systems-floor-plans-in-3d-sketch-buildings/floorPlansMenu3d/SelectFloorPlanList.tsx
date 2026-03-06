import type { FixedFloor } from "./MeshFps"
import { useMemo, useRef } from "preact/hooks"
import { useState } from "react"
import { LayoutIcon } from "src/integrations/building-systems-basic-building/floorPlansMenu/SvgComponents/LayoutsIcon"
import { ContextMenuWrapper } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/ContextMenu"
import type { SpaceUnits } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import { compareFloorOutlines } from "./compareFloors"
import { mapUnitProgramToStructureType } from "src/integrations/building-systems-basic-building/floorPlansMenu/mappingTypes"
import { doFloorPlansInBuildingMatch } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloors"
import type { Graph } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import { isFloorEmpty } from "./emptyFloors"
import type { MeshBuildingFloorPlans } from "./FloorPlansMenu3d"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"
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

type FloorPlanTileProps = {
  spaceUnits: SpaceUnits
  onClick: () => void
  onDelete?: () => void
  name: string
  empty: boolean
}

const FloorPlanTile = ({ spaceUnits, onClick, onDelete, name, empty }: FloorPlanTileProps) => {
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
            {!empty && onDelete && <forma-context-menu-item text={t(($) => $.ui.delete)} onClick={onDelete} />}
          </forma-context-menu>
        </ContextMenuWrapper>
      )}
    </div>
  )
}

////
//
////

function makeSpaceUnitsFromFloorOutline(floor: FixedFloor): SpaceUnits {
  return floor.outline.map((polygonWithHoles) => {
    return { ...polygonWithHoles, id: "", program: undefined, properties: {} }
  })
}

function makeSpaceUnitsFromFloorPlan(floorPlans: MeshBuildingFloorPlans) {
  const spaceUnitsByFloor: SpaceUnits[] = []
  const spaceUnitProgramMap: Record<string, string> = {}
  for (const unit of floorPlans.units) {
    const spaceUnitProgram = mapUnitProgramToStructureType(unit.program)
    for (const space of unit.spaces) {
      const spaceKey = space.floorId + "#" + space.spaceId
      spaceUnitProgramMap[spaceKey] = spaceUnitProgram
    }
  }
  for (let i = 0; i < floorPlans.floors.length; i++) {
    const graph: Graph = floorPlans.floors[i].graph
    const spaceUnits: SpaceUnits = Object.values(floorPlans.floors[i].spaces).map((space) => {
      const polygon = space.polygon.map((id) => graph.vertices[id])
      const holes = space.holes.map((hole) => hole.map((id) => graph.vertices[id]))
      const spaceKey = floorPlans.floors[i].id + "#" + space.id
      const spaceUnitProgram = spaceUnitProgramMap[spaceKey]
      return {
        id: space.id,
        polygon,
        holes,
        program: spaceUnitProgram,
        properties: {},
      }
    })
    spaceUnitsByFloor.push(spaceUnits)
  }
  return spaceUnitsByFloor
}

type SelectFloorPlanListProps = {
  floors: FixedFloor[]
  floorPlans: MeshBuildingFloorPlans | undefined
  floorIds: string[]
  editFloors: (floorNumbers: number[]) => void
  emptyFloors: (floorNumbers: number[]) => void
  floorIndices: number[]
}
const WrapperStyle = `
  max-height: 240px;
  overflow: auto;
`
export const SelectFloorPlanList = ({
  floors,
  floorPlans,
  floorIds,
  editFloors,
  emptyFloors,
  floorIndices,
}: SelectFloorPlanListProps) => {
  const groupedFloors = useMemo(() => {
    const groupedFloors: { outline: PolygonWithHolesXY[]; floorNumbers: number[]; spaceUnits: SpaceUnits }[] = []
    if (floorPlans === undefined) {
      for (let i = 0; i < floors.length; i++) {
        if (floorIndices?.length && !floorIndices.includes(i)) continue
        const floor = floors[i]
        const matchIndex = groupedFloors.findIndex((baseFloor) => {
          return compareFloorOutlines(baseFloor.outline, floor.outline)
        })
        if (matchIndex === -1) {
          const spaceUnits: SpaceUnits = makeSpaceUnitsFromFloorOutline(floor)
          groupedFloors.push({ outline: floor.outline, floorNumbers: [i], spaceUnits })
        } else {
          groupedFloors[matchIndex].floorNumbers.push(i)
        }
      }
    } else {
      const spaceFloors = makeSpaceUnitsFromFloorPlan(floorPlans)
      for (let i = 0; i < floors.length; i++) {
        if (floorIndices?.length && !floorIndices.includes(i)) continue
        const floor = floors[i]
        const spaceFloor = spaceFloors[i]
        const matchIndex = groupedFloors.findIndex((baseFloor) => {
          return doFloorPlansInBuildingMatch(baseFloor.spaceUnits, spaceFloor)
        })
        if (matchIndex === -1) {
          groupedFloors.push({ outline: floor.outline, floorNumbers: [i], spaceUnits: spaceFloor })
        } else {
          groupedFloors[matchIndex].floorNumbers.push(i)
        }
      }
    }
    return groupedFloors
  }, [floorIndices, floorPlans, floors])

  const emptyFloor = useMemo(() => {
    return groupedFloors.map((floorGroup) => {
      if (floorPlans === undefined) return true
      const baseFloorNumber = floorGroup.floorNumbers[0]
      const floorId = floorPlans.floors[baseFloorNumber].id
      return isFloorEmpty(floorPlans, floorId)
    })
  }, [floorPlans, groupedFloors])

  return (
    <div style={WrapperStyle}>
      {groupedFloors.map((floorGroup, i) => {
        const baseFloorNumber = floorGroup.floorNumbers[0]
        const floorId = floorIds[baseFloorNumber]
        const empty = emptyFloor[i]
        return (
          <FloorPlanTile
            key={floorId}
            name={"Floor plan " + (i + 1)}
            spaceUnits={floorGroup.spaceUnits}
            onClick={() => {
              editFloors(floorGroup.floorNumbers)
            }}
            empty={empty}
            onDelete={() => {
              emptyFloors(floorGroup.floorNumbers)
            }}
          />
        )
      })}
    </div>
  )
}
