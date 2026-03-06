import { useMemo } from "react"
import PopUpBox from "src/lib/components/PopUps/PopUpBox"
import type { BasicPlusBuilding } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanSketcher"
import { useTranslator } from "src/i18n"
import type {
  FloorPlanTemplate,
  FloorPlanTemplates,
} from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanTemplateHooks"
import { useFloorPlanTemplates } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanTemplateHooks"
import type {
  FloorFootPrintByBuildingMap,
  FootPrint,
} from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/footPrints"
import type { FootPrintWithIds } from "./ShapeMatching/compareOuterShapes"
import { doOuterShapesMatch, getUniqueOuterShapes } from "./ShapeMatching/compareOuterShapes"
import type { SpaceUnits } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import { spaceToSpaceUnit } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import { getUniqueFloorPlanTemplates } from "./ShapeMatching/compareFloorPlans"
import { useState } from "preact/compat"
import { SelectedFloorPlanView } from "./SelectedFloorPlanView"
import { SelectOuterShape } from "./SelectOuterShape"
import type { FloorTemplate } from "./FloorPlanTemplatesList"
import { FloorPlanTemplatesList } from "./FloorPlanTemplatesList"
import { polygonWithHolesToXY } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import { alignFloorPlanWithOuterShape, realignOuterShape } from "./ShapeMatching/realignShapes"
import { getUpdatedBuildingsAfterApplyingTemplate } from "./ShapeMatching/getUpdatedBuildingsAfterApplyingTemplate"
import { getUnitLookup } from "src/integrations/building-systems-basic-building/lib/utils"

function getUniqueOuterShapesInSelection(
  basicBuildings: BasicPlusBuilding[],
  floorFootPrintsByBuildings: FloorFootPrintByBuildingMap,
) {
  const footPrintsWithIds: FootPrintWithIds[] = []
  for (const building of basicBuildings) {
    const buildingId = building.id
    const footPrints = floorFootPrintsByBuildings[building.id]
    for (let i = 0; i < footPrints.length; i++) {
      if (building.selectedFloors && !building.selectedFloors[i]) continue
      const footPrint = footPrints[i]
      footPrintsWithIds.push({ footPrint, ids: [`${buildingId}-${i}`] })
    }
  }
  // for (const buildingId of Object.keys(floorFootPrintsByBuildings)) {
  //   const footPrints = floorFootPrintsByBuildings[buildingId]
  //   for (let i = 0; i < footPrints.length; i++) {
  //     const footPrint = footPrints[i]
  //     footPrintsWithIds.push({ footPrint, ids: [`${buildingId}-${i}`] })
  //   }
  // }
  return getUniqueOuterShapes(footPrintsWithIds).map((footPrintWithIds) => {
    const footPrint = realignOuterShape(footPrintWithIds.footPrint)
    return { ...footPrintWithIds, footPrint }
  })
}

////
//

type FloorToOuterShapeIndexMap = Record<string, number>
function makeFloorToOuterShapeIndexMap(uniqueOuterShapesWithIds: FootPrintWithIds[]) {
  const floorToOuterShapeIndexMap: FloorToOuterShapeIndexMap = {}
  for (let i = 0; i < uniqueOuterShapesWithIds.length; i++) {
    const ids = uniqueOuterShapesWithIds[i].ids
    for (const id of ids) {
      floorToOuterShapeIndexMap[id] = i
    }
  }
  return floorToOuterShapeIndexMap
}

function getFloorPlansByOuterShape(
  uniqueOuterShapesWithIds: FootPrintWithIds[],
  basicBuildings: BasicPlusBuilding[],
  floorFootPrintsByBuildings: FloorFootPrintByBuildingMap,
): SpaceUnits[][] {
  const floorPlansByOuterShape: { spaceUnits: SpaceUnits; footPrint: FootPrint }[][] = uniqueOuterShapesWithIds.map(
    () => {
      return []
    },
  )
  const floorToOuterShapeIndexMap = makeFloorToOuterShapeIndexMap(uniqueOuterShapesWithIds)
  for (const building of basicBuildings) {
    const unitLookup = getUnitLookup(building.units)
    for (let i = 0; i < building.floors.length; i++) {
      if (building.selectedFloors && !building.selectedFloors[i]) continue
      const id = `${building.id}-${i}`

      const floor = building.floors[i]
      const spaceUnits: SpaceUnits = Object.values(floor.spaces).map((space) =>
        spaceToSpaceUnit(space, unitLookup(floor.id, space.id), floor.graph),
      )
      const footPrint = floorFootPrintsByBuildings[building.id][i]
      floorPlansByOuterShape[floorToOuterShapeIndexMap[id]].push({ spaceUnits, footPrint })
    }
  }
  return floorPlansByOuterShape
    .map((floorPlans) => getUniqueFloorPlanTemplates(floorPlans))
    .map((floorPlans, i) =>
      floorPlans.map((floorPlan) => {
        const outerShape = uniqueOuterShapesWithIds[i]
        return alignFloorPlanWithOuterShape(floorPlan, outerShape.footPrint).spaceUnits
      }),
    )
}

////
//

function groupFloorPlanTemplatesByOuterShapes(floorPlanTemplates: FloorPlanTemplates, outerShapes: FootPrint[]) {
  const listOfTemplates = Object.values(floorPlanTemplates)
  const groupedTemplates: FloorPlanTemplate[][] = outerShapes.map(() => {
    return []
  })
  for (const template of listOfTemplates) {
    const footPrint: FootPrint = template.outerGeo.map(polygonWithHolesToXY)
    for (let i = 0; i < outerShapes.length; i++) {
      const match = doOuterShapesMatch(footPrint, outerShapes[i])
      if (match.match) {
        groupedTemplates[i].push(template)
        break
      }
    }
  }
  return groupedTemplates
}

////
//

const MainBodyStyle = `
  width: 260px;
  box-sizing: border-box;
  padding-left: 16px;
  padding-right: 16px;
`

export type FloorPlanMenuOpenData = { top: number }
export const FloorPlansSwapMenu = ({
  openData,
  close,
  apply,
  basicBuildings,
  floorFootPrintsByBuildings,
}: {
  openData: FloorPlanMenuOpenData
  close: () => void
  apply: (updatedBuildings: Record<string, BasicPlusBuilding>) => void
  basicBuildings: BasicPlusBuilding[]
  floorFootPrintsByBuildings: FloorFootPrintByBuildingMap
}) => {
  const t = useTranslator()
  const { templates: floorPlanTemplates, deleteFloorPlanTemplate, renameFloorPlanTemplate } = useFloorPlanTemplates()

  const uniqueOuterShapesWithIds = useMemo(() => {
    return getUniqueOuterShapesInSelection(basicBuildings, floorFootPrintsByBuildings)
  }, [basicBuildings, floorFootPrintsByBuildings])

  const numberOfFloorsPerOuterShape = useMemo(() => {
    return uniqueOuterShapesWithIds.map((uniqueOuterShapeWithIds) => uniqueOuterShapeWithIds.ids.length)
  }, [uniqueOuterShapesWithIds])

  const outerShapesInSelection = useMemo(() => {
    return uniqueOuterShapesWithIds.map((outerShapeWithId) => outerShapeWithId.footPrint)
  }, [uniqueOuterShapesWithIds])

  const selectedFloorPlansByOuterShape = useMemo(() => {
    return getFloorPlansByOuterShape(uniqueOuterShapesWithIds, basicBuildings, floorFootPrintsByBuildings)
  }, [uniqueOuterShapesWithIds, floorFootPrintsByBuildings, basicBuildings])

  const [selectedOuterShapeIndex, setOuterShapeIndex] = useState(0)

  const templatesGroupedByOuterShapes = useMemo(() => {
    return groupFloorPlanTemplatesByOuterShapes(floorPlanTemplates, outerShapesInSelection)
  }, [floorPlanTemplates, outerShapesInSelection])

  const templatesForSelectedOuterShape: FloorPlanTemplate[] = useMemo(() => {
    const numberOfShapes = outerShapesInSelection.length
    return templatesGroupedByOuterShapes[selectedOuterShapeIndex % numberOfShapes]
  }, [templatesGroupedByOuterShapes, selectedOuterShapeIndex, outerShapesInSelection])

  const showSelectOuterShape = useMemo(() => {
    return outerShapesInSelection.length >= 2
  }, [outerShapesInSelection])

  const adjustedTop = useMemo(() => {
    return openData.top - 200
  }, [openData])

  return (
    <PopUpBox.Container
      top={adjustedTop}
      header={<PopUpBox.DefaultHeader onClose={close} title={t(($) => $.building.floorPlans.popupTitle)} />}
      id={"floor-plans-swap-menu"}
    >
      <SelectedFloorPlanView
        outerShapesInSelection={outerShapesInSelection}
        selectedOuterShapeIndex={selectedOuterShapeIndex}
        selectedFloorPlansByOuterShape={selectedFloorPlansByOuterShape}
      />
      <div style={MainBodyStyle}>
        {showSelectOuterShape && (
          <SelectOuterShape
            outerShapesInSelection={outerShapesInSelection}
            selectedOuterShapeIndex={selectedOuterShapeIndex}
            setOuterShapeIndex={setOuterShapeIndex}
            numberOfFloorsPerOuterShape={numberOfFloorsPerOuterShape}
          />
        )}
        <FloorPlanTemplatesList
          floorPlanTemplates={templatesForSelectedOuterShape}
          apply={(template: FloorTemplate) => {
            const updatedBuildings = getUpdatedBuildingsAfterApplyingTemplate(
              template,
              floorFootPrintsByBuildings,
              basicBuildings,
            )
            apply(updatedBuildings)
          }}
          deleteFloorPlanTemplate={deleteFloorPlanTemplate}
          renameFloorPlanTemplate={renameFloorPlanTemplate}
        />
      </div>
    </PopUpBox.Container>
  )
}
