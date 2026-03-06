import { useMemo } from "react"
import { elementState } from "src/core/elements/ElementState"
import { selectedPathsInCurrentProposalSignal } from "src/core/selection/selectionState"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

function calculateLineLength(coordinates: number[][]): number {
  let totalLength = 0
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [x1, y1] = coordinates[i]
    const [x2, y2] = coordinates[i + 1]
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
    totalLength += distance
  }
  return totalLength
}

export function LengthProperty() {
  const t = useTranslator()
  const proposal = elementState.currentProposalSignal.value
  const imperial = useIsImperial()
  const selection = selectedPathsInCurrentProposalSignal.value

  const { length, lines } = useMemo(() => {
    const lines: number[][][] = []
    for (const path of selection) {
      const node = proposal.snapshot.getNode(path)
      if (!node) continue

      const footprint = node.elementContainer.representations.footprint
      if (footprint?.geometry.type === "LineString") {
        lines.push(footprint.geometry.coordinates)
      }
    }
    const length = lines.reduce((acc, line) => acc + calculateLineLength(line), 0)

    // Convert meters to feet for imperial units
    const mToFt = 1 / 0.3048
    return { length: imperial ? length * mToFt : length, lines }
  }, [imperial, proposal, selection])

  return (
    <div
      style={{
        height: "36px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ font: "var(--12-medium)" }}>
        {lines.length > 1 ? t(($) => $.ui.lengthSum) : t(($) => $.ui.length)}
      </div>
      <div style={{ font: "var(--11-regular)" }}>
        {length.toFixed(1)} {imperial ? "ft" : "m"}
      </div>
    </div>
  )
}
