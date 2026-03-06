import type { ElementContainer } from "src/core/elements/ElementContainer"
import { conceptualElementsApi } from "./conceptualElementsApi"
import { BuiltInSurfaceFunctions, type Surface } from "src/integrations/area-stats/surface"
import { parseUrn } from "src/lib/element/urn"
import { getInMapOrThrow } from "src/lib/map"
import { getRepresentationJsonUnsafe } from "@spacemakerai/elements-client"
import type { MultiRingPolygon } from "forma-elements"
import { Matrix4, Vector3 } from "three"

const TESTFIT_PARKING_GENERATOR_ID =
  "urn:adsk-forma-generators:extension:ltsWz50imxYSBeSG9q03iik16SErqrjt:ltsWz50imxYSBeSG9q03iik16SErqrjt:gen_wporbxendr"

export function getIntegrateAreaStatsSurfaces(container: ElementContainer): Surface[] {
  const element = container.element

  if (conceptualElementsApi.is3dSketchBuilding(element)) {
    if (!element.children || element.children.length == 0) return []

    const firstChild = element.children[0]
    const firstChildUrnId = parseUrn(firstChild.urn).id
    if (!firstChildUrnId.includes("+") || firstChildUrnId.split("+")[1] !== "0") return []

    const floorContainer = getInMapOrThrow(container.childrenByUrn, firstChild.urn)
    if (!conceptualElementsApi.is3dSketchFloor(floorContainer.element)) return []

    const gfaUnitsRep = floorContainer.element.representations?.gfaUnits
    if (!gfaUnitsRep || gfaUnitsRep.type !== "embedded-json") return []

    const gfaUnits = getRepresentationJsonUnsafe(gfaUnitsRep)
    const translationZ = firstChild.transform
      ? new Vector3().setFromMatrixPosition(new Matrix4().fromArray(firstChild.transform)).z
      : 0
    return gfaUnits.flatMap((gfaUnit) =>
      gfaUnit.areas.map(
        (gfaArea): Surface => ({
          polygon: gfaArea.coordinates as MultiRingPolygon,
          functions: [{ id: BuiltInSurfaceFunctions.Building }],
          horizontalProjection: { type: "atElevation", elevation: translationZ + gfaArea.elevation },
        }),
      ),
    )
  }

  if (
    element.properties?.generator?.generatorId === TESTFIT_PARKING_GENERATOR_ID &&
    element.properties.generator.values?.boundary?.points &&
    element.properties.generator.values.boundary.points.length >= 3
  ) {
    return [
      {
        polygon: [element.properties.generator.values.boundary.points as [number, number][]],
        functions: [{ id: BuiltInSurfaceFunctions.Parking }],
        horizontalProjection: { type: "onGround" },
      },
    ]
  }

  return []
}
