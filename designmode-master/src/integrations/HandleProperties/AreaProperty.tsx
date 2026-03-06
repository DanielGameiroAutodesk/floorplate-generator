import { useMemo } from "react"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"
import type { Urn } from "forma-elements"
import { selectedPathsInCurrentProposalSignal } from "src/core/selection/selectionState"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

function determinant(vector1: number[], vector2: number[]) {
  return vector1[0] * vector2[1] - vector1[1] * vector2[0]
}
function polygonArea(poly: number[][]) {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i]
    const p2 = poly[(i + 1) % poly.length]
    area += determinant(p1, p2)
  }
  return 0.5 * Math.abs(area)
}

type FootprintDeprecated = { type: "LineString" | "Polygon"; coordinates: number[][] }

// TODO: Rewrite this to handle e.g. holes in a polygon.
function getFootprintDeprecated(snapshot: ElementSnapshot, urn: Urn): FootprintDeprecated | undefined {
  const container = snapshot.getElementContainer(urn)
  const feature = container?.representations.footprint

  if (feature?.geometry.type === "LineString") {
    return { type: "LineString", coordinates: feature.geometry.coordinates }
  } else if (feature?.geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: feature.geometry.coordinates[0] }
  }
}

export function AreaProperty() {
  const t = useTranslator()
  const proposal = elementState.currentProposalSignal.value
  const imperial = useIsImperial()
  const selection = selectedPathsInCurrentProposalSignal.value

  const { area, footprints } = useMemo(() => {
    const footprints: number[][][] = []
    for (const path of selection) {
      const element = proposal.snapshot.getNode(path)?.element
      const footPrint = element && getFootprintDeprecated(proposal.snapshot, element.urn)
      if (footPrint?.type === "Polygon" && !element?.representations?.volumeMesh) {
        footprints.push(footPrint.coordinates)
      }
    }
    if (footprints.length !== selection.size) return { area: undefined, footprints: undefined }
    const area = footprints.reduce((acc, a) => acc + polygonArea(a), 0)

    //TODO(overgai): This looks wrong?
    const m2ToFt2 = 1 / Math.pow(0.3048, 2)
    return { area: imperial ? area * m2ToFt2 : area, footprints }
  }, [imperial, proposal, selection])

  return area === undefined ? null : (
    <div
      style={{
        height: "36px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ font: "var(--12-medium)" }}>
        {footprints.length > 1 ? t(($) => $.ui.areaSum) : t(($) => $.ui.area)}
      </div>
      <div style={{ font: "var(--11-regular)" }}>
        {area.toFixed(1)} {imperial ? "ft²" : "m²"}
      </div>
    </div>
  )
}
