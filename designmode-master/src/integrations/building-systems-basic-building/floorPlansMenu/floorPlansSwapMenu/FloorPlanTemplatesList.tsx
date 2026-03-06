import type { FloorPlanTemplate } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanTemplateHooks"
import TextInput from "src/integrations/inputs/TextInput"
import { useMemo, useState } from "react"
import { HamburgerIcon } from "src/lib/components/icons/HamburgerIcon"
import { LayoutIcon } from "src/integrations/building-systems-basic-building/floorPlansMenu/SvgComponents/LayoutsIcon"
import { useTranslator } from "src/i18n"
import type {
  SpaceUnits,
  SpaceUnit,
} from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import { polygonWithHolesToXY } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import type { FootPrint } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/footPrints"
import { makeGraphFromSpaces } from "src/integrations/building-systems-basic-building/lib/graph/makeGraphFromSpaces"
import { findPolygonsWithHolesInGraph } from "src/integrations/building-systems-basic-building/lib/graph/findPolygonsWithHolesInGraph"
import type { VertexPolygon } from "src/integrations/building-systems-common/buildingMigrations/pureMigrationFunctions/graph/graph"
import { mapStructureTypeToUnitProgram } from "src/integrations/building-systems-basic-building/floorPlansMenu/mappingTypes"

import type { Graph } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"
import { getIntersectionAreaOfPolygonsWithHoles } from "@spacemakerai/line-buildings-shared/helpers/fps/intersectionArea"

function ItemContextMenu({
  close,
  contextMenuOpenPosition,
  toggleEditName,
  deleteTemplate,
}: {
  close: () => any
  contextMenuOpenPosition: { top: number; left: number }
  toggleEditName: (t: boolean) => any
  deleteTemplate: () => void
}) {
  const t = useTranslator()
  return (
    <div
      style={`position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100001;`}
      onClick={(e) => {
        close()
        e.stopPropagation()
      }}
    >
      <forma-context-menu-container
        left={contextMenuOpenPosition.left}
        top={contextMenuOpenPosition.top}
        onClose={() => close()}
      >
        <forma-context-menu>
          <forma-context-menu-item
            text={t(($) => $.ui.rename)}
            onClick={() => {
              toggleEditName(true)
              close()
            }}
          />
          <forma-context-menu-item
            text={t(($) => $.ui.delete)}
            onClick={() => {
              deleteTemplate()
              close()
            }}
          />
        </forma-context-menu>
      </forma-context-menu-container>
    </div>
  )
}

////
//

const FloorPlanTitleStyle = `
  font: var(--11-medium);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 100%;
`

function FloorPlanTitle({ name, toggleEdit }: { name: string; toggleEdit: (t: boolean) => any }) {
  return (
    <div
      style={FloorPlanTitleStyle}
      /* eslint-disable-next-line react/no-unknown-property */
      onDblClick={() => toggleEdit(true)}
    >
      {name}
    </div>
  )
}

const FloorPlanTitleEditStyle = `
    font-family: Artifakt Element, sans-serif;
    font-style: normal;
    font-weight: 600;
    font-size: 11px;
    line-height: 14px;
    color: #3C3C3C;
    margin-left: 7px;
    width: 187px;
`

function FloorPlanTitleEdit({
  name,
  updateName,
  edit,
  toggleEdit,
}: {
  name: string
  updateName: (newName: string) => void
  edit: boolean
  toggleEdit: (t: boolean) => any
}) {
  return (
    <div style={FloorPlanTitleEditStyle} onKeyDown={(e) => e.stopPropagation()}>
      <TextInput
        initialValue={name}
        onChange={(value) => {
          updateName(value)
        }}
        onBlur={(value) => {
          updateName(value)
          toggleEdit(false)
        }}
        isSelected={edit}
      />
    </div>
  )
}

///
///

const ItemTitleTextStyle = (hover: boolean, numberOfIcons: number) => `
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
  ${hover ? "background: rgba(128, 128, 128, 0.1);" : ""}

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`

const ItemWrapperStyle = `
  display: flex;
  height: 40px;
  width: 228px;
  cursor: pointer;
  box-sizing: border-box;

  display: flex;
  align-items: center;
  justify-content: space-between;
`

export const FloorPlanTemplateItem = ({
  floorPlanTemplate,
  apply,
  deleteTemplate,
  name,
  renameFloorPlanTemplate,
}: {
  floorPlanTemplate: FloorPlanTemplate
  apply: () => void
  deleteTemplate: () => void
  name: string
  renameFloorPlanTemplate: (templateId: string, newName: string) => void
}) => {
  const [hover, setHover] = useState(false)
  const [hoverIcon, setHoverIcon] = useState(false)
  const [editName, setEditName] = useState(false)
  const [contextMenuOpenPosition, setContextMenuOpenPosition] = useState<{ top: number; left: number } | undefined>(
    undefined,
  )

  const spaceUnits: SpaceUnits = useMemo(() => {
    const spaceUnits: SpaceUnits = floorPlanTemplate.units.map((unit) => {
      const polygon = unit.geo.polygon.map(([x, y]: [number, number]) => {
        return { x, y }
      })
      const holes = unit.geo.holes.map((hole: any) =>
        hole.map(([x, y]: [number, number]) => {
          return { x, y }
        }),
      )
      const program = mapStructureTypeToUnitProgram(unit.type)
      return { id: unit.id, polygon, holes, program: program, properties: {} }
    })
    return spaceUnits
  }, [floorPlanTemplate])

  const numberOfIcons = 1
  const showNameHoverEffect = hover && !hoverIcon
  const showContextMenuIcon = hover && !editName

  return (
    <div
      style={ItemWrapperStyle}
      onMouseEnter={() => {
        setHover(true)
      }}
      onMouseLeave={() => {
        setHover(false)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenuOpenPosition({ top: e.clientY, left: e.clientX })
      }}
    >
      <div
        style={`display: flex; align-items: center;`}
        onClick={() => {
          apply()
        }}
      >
        <LayoutIcon spaceUnits={spaceUnits} width={28} height={28} />
        {!editName && (
          <div
            style={ItemTitleTextStyle(showNameHoverEffect, numberOfIcons)}
            /* eslint-disable-next-line react/no-unknown-property */
            onDblClick={() => {
              setEditName(true)
            }}
          >
            <FloorPlanTitle
              name={name}
              toggleEdit={() => {
                setEditName(true)
              }}
            />
          </div>
        )}
        {editName && (
          <FloorPlanTitleEdit
            name={name}
            updateName={(updatedName) => renameFloorPlanTemplate(floorPlanTemplate.id, updatedName)}
            edit={editName}
            toggleEdit={setEditName}
          />
        )}
      </div>
      <div
        style={"display: flex;"}
        onMouseEnter={() => {
          setHoverIcon(true)
        }}
        onMouseLeave={() => {
          setHoverIcon(false)
        }}
      >
        {showContextMenuIcon && (
          <div style={"width: 28px;"}>
            <weave-icon-button
              onClick={(e) => {
                setContextMenuOpenPosition({ top: e.clientY, left: e.clientX })
                e.stopPropagation()
              }}
            >
              {<HamburgerIcon />}
            </weave-icon-button>
          </div>
        )}
      </div>
      {contextMenuOpenPosition && (
        <ItemContextMenu
          close={() => {
            setContextMenuOpenPosition(undefined)
          }}
          contextMenuOpenPosition={contextMenuOpenPosition}
          toggleEditName={() => {
            setEditName(true)
          }}
          deleteTemplate={() => {
            deleteTemplate()
          }}
        />
      )}
    </div>
  )
}

////
// Empty prompt

const NoFloorPlansWrapper = `
  text-align: center;
  font: var(--11-regular);
`

const NoFloorPlanUpperBox = `
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 25px 16px 5px 16px;
`
const NoFloorPlanLowerBox = `
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 16px 25px 16px;
`

const NoFittingFloorPlansMessage = () => {
  const t = useTranslator()
  return (
    <div style={NoFloorPlansWrapper}>
      <div style={NoFloorPlanUpperBox}>{t(($) => $.building.floorPlans.noLibraryDescription)}</div>
      <div style={NoFloorPlanLowerBox}>{t(($) => $.building.floorPlans.rightClickToAddDescription)}</div>
    </div>
  )
}

////
// Templates list

const ListStyleOuter = `
  width: calc(226px + 16px);
  max-height: 182px;
  box-sizing: border-box;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
`

const ListStyleInner = `
  width: 226px;
  padding-top: 14px;
  padding-bottom: 14px;
`

function findBestMatchingOldUnit(polygonWithHoles: PolygonWithHolesXY, oldUnits: SpaceUnit[]) {
  let maxArea = 0
  let matchingUnit
  for (const unit of oldUnits) {
    const area = getIntersectionAreaOfPolygonsWithHoles(polygonWithHoles, unit)
    if (area > maxArea + 1e-2) {
      maxArea = area
      matchingUnit = unit
    }
  }
  if (maxArea > 1e-4) return matchingUnit
  return undefined
}

type SpaceVertexUnit = { polygon: VertexPolygon; holes: VertexPolygon[]; id: string; program: string | undefined }
export type FloorTemplate = {
  footPrint: FootPrint
  graph: Graph
  spaceVertexUnits: SpaceVertexUnit[]
}
function templateToFloorPlanWithFootPrint(template: FloorPlanTemplate): FloorTemplate {
  const footPrint: FootPrint = template.outerGeo.map(polygonWithHolesToXY)
  const spaceUnits: SpaceUnits = template.units.map((unit) => {
    const { polygon, holes } = polygonWithHolesToXY(unit.geo)
    const program = mapStructureTypeToUnitProgram(unit.type)
    return { id: unit.id, polygon, holes, program, properties: {} }
  })
  const graph: Graph = makeGraphFromSpaces(spaceUnits)
  const spaceVertexUnits: SpaceVertexUnit[] = []
  const vertexPolygonsWithHoles = findPolygonsWithHolesInGraph(graph)
  for (const vertexPolygonWithHoles of vertexPolygonsWithHoles) {
    const bestMatchingOldUnit = findBestMatchingOldUnit(vertexPolygonWithHoles, spaceUnits)
    if (bestMatchingOldUnit === undefined) continue
    const spaceVertexUnit: SpaceVertexUnit = {
      ...vertexPolygonWithHoles,
      program: bestMatchingOldUnit.program,
      id: bestMatchingOldUnit.id,
    }
    spaceVertexUnits.push(spaceVertexUnit)
  }
  return { footPrint, graph, spaceVertexUnits }
}
export const FloorPlanTemplatesList = ({
  floorPlanTemplates,
  apply,
  deleteFloorPlanTemplate,
  renameFloorPlanTemplate,
}: {
  floorPlanTemplates: FloorPlanTemplate[]
  apply: (template: FloorTemplate) => void
  deleteFloorPlanTemplate: (templateId: string) => void
  renameFloorPlanTemplate: (templateId: string, newName: string) => void
}) => {
  if (floorPlanTemplates.length === 0) {
    return <NoFittingFloorPlansMessage />
  }
  return (
    <div style={ListStyleOuter}>
      <div style={ListStyleInner}>
        {floorPlanTemplates.map((template) => {
          return (
            <FloorPlanTemplateItem
              key={template.id}
              floorPlanTemplate={template}
              apply={() => {
                const floorPlanWithFootPrint = templateToFloorPlanWithFootPrint(template)
                apply(floorPlanWithFootPrint)
              }}
              deleteTemplate={() => {
                deleteFloorPlanTemplate(template.id)
              }}
              renameFloorPlanTemplate={renameFloorPlanTemplate}
              name={template.name}
            />
          )
        })}
      </div>
    </div>
  )
}
