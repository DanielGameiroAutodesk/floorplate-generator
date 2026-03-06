import { useMemo } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { AnalyticsLegacy } from "src/core/analytics"
import { useGetBasicBuildingWithSelectedFloorsInSelection } from "./floorPlansMenu/FloorPlansMenu"
import type { FloorTemplate } from "./floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import { getFloorPlansForSelectedFloorsInBuilding } from "./floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import { getFloorFootPrintsByBuildings } from "./floorPlansMenu/floorPlans/footPrints"
import { getRealignFloorPlanAndFootPrint } from "./floorPlansMenu/floorPlans/SelectedFloorPlans"
import type { FloorPlanTemplate } from "./floorPlansMenu/FloorPlanTemplateHooks"
import { useFloorPlanTemplates } from "./floorPlansMenu/FloorPlanTemplateHooks"
import { polygonWithHolesFromXY } from "./lib/geometry/geometry"
import { mapUnitProgramToStructureType } from "./floorPlansMenu/mappingTypes"
import { randomId } from "./lib/utils"
import { getElementsClient } from "src/core/elements-loading/loading"
import type { Urn } from "@spacemakerai/element-types"
import { newId, newRevision } from "src/lib/element/urn"
import { toMetersIfImperial } from "src/lib/measurementSystem"
import { createBasicBuildingFromSimpleBuilding } from "src/integrations/building-systems-common/buildingMigrations/pureMigrationFunctions/createBasicBuildingFromSimpleBuilding"
import { request } from "src/lib/request"
import { PROJECT_ID } from "src/core/project/project"

function toUnitType(type: string) {
  if (type === "LIVING_UNIT" || type === "CORE" || type === "CORRIDOR" || type === "UNASSIGNED") return type
  return "UNASSIGNED"
}

function getBasicBuildingFromFloorPlan(floorPlanTemplate: FloorPlanTemplate, imperial: boolean) {
  return createBasicBuildingFromSimpleBuilding({
    id: "",
    floors: [
      {
        height: imperial ? toMetersIfImperial(10, true) : 3,
        outerShapes: floorPlanTemplate.outerGeo,
        content: {
          type: "floorPlan",
          units: floorPlanTemplate.units.map((u) => ({
            type: toUnitType(u.type),
            id: u.id,
            polygon: u.geo.polygon,
            holes: u.geo.holes,
          })),
        },
      },
    ],
  })
}

export async function buildBasicBuildingFromFloorPlan(urn: Urn, imperial: boolean) {
  const { element } = await getElementsClient().getElementAutoBatched(urn)
  const floorPlanTemplate = element.properties?.floorPlanTemplate as FloorPlanTemplate
  const basicBuilding = getBasicBuildingFromFloorPlan(floorPlanTemplate, imperial)
  const revision = newRevision()
  const id = newId()
  const putBody = [{ id, revision, building: basicBuilding }]
  const res = await request(`/api/basicbuilding/elements-batch?authcontext=${PROJECT_ID}&newRepresentations`, {
    method: "PUT",
    body: JSON.stringify(putBody),
    headers: { "Content-Type": "application/json" },
  }).catch((e) => {
    console.error("Failed to save basic building", e)
    return undefined
  })
  if (!res?.ok) throw new Error("Could not put basic building from floor plan")
  return { urn: `urn:adsk-forma-elements:basicbuilding:${PROJECT_ID}:${id}:${revision}` satisfies Urn, id }
}

export function floorPlanToOldFloorPlanTemplate(name: string, floorTemplate: FloorTemplate): FloorPlanTemplate {
  const units: FloorPlanTemplate["units"] = floorTemplate.spaceUnits.map((spaceUnit) => {
    const polygonWithHoles = polygonWithHolesFromXY(spaceUnit)
    const structureType = mapUnitProgramToStructureType(spaceUnit.program)
    return { id: randomId(), geo: polygonWithHoles, type: structureType }
  })
  const outerGeo: FloorPlanTemplate["outerGeo"] = floorTemplate.footPrint.map(polygonWithHolesFromXY)
  return { name, id: randomId(), isEmptyTemplate: false, units, outerGeo }
}

export function useAddBasicBuildingFloorPlansToLibrary() {
  const basicBuildings = useGetBasicBuildingWithSelectedFloorsInSelection()

  const { saveFloorPlanTemplates } = useFloorPlanTemplates()
  const floorPlans = useMemo(() => {
    try {
      if (basicBuildings.length !== 1) return undefined
      return getFloorPlansForSelectedFloorsInBuilding(basicBuildings[0], getFloorFootPrintsByBuildings(basicBuildings))
        .filter((t) => !t.empty)
        .map((t) => ({ ...getRealignFloorPlanAndFootPrint(t.spaceUnits, t.footPrint), empty: false }))
    } catch (e) {
      captureException(e, { tags: { owner: "building-systems" } })
      return undefined
    }
  }, [basicBuildings])

  const disabled = floorPlans?.length !== 1
  const text = floorPlans?.length === 1 ? `Add floor plan to library` : "Add floor plans to library"
  const show = (floorPlans?.length || 0) > 0
  const onClick = disabled
    ? undefined
    : () => {
        saveFloorPlanTemplates(floorPlans.map((fp) => floorPlanToOldFloorPlanTemplate("Floor plan", fp)))
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("FloorPlans - Add floor plan to library from right click in scene")
      }
  return { disabled, text, show, onClick }
}
