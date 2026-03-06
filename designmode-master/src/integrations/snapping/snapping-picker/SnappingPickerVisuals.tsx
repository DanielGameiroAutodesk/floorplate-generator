import { useEffect } from "preact/compat"
import {
  lockedSnapLineSignal,
  selectedDerivedSnappingLinesSignal,
  selectedSnappingLinesSignal,
} from "src/integrations/snapping/snappingPicker.state"
import {
  ACTIVE_SNAPPING_LINE_MATERIAL,
  ACTIVE_SNAPPING_LINE_MATERIAL_ZAXIS,
  ADDABLE_SNAPPING_LINE_MATERIAL,
  ADDABLE_SNAPPING_LINE_MATERIAL_ZAXIS,
  BOLD_SNAPPING_LINE_MATERIAL,
  BOLD_SNAPPING_LINE_MATERIAL_ZAXIS,
  PASSIVE_SNAPPING_LINE_MATERIAL,
  PASSIVE_SNAPPING_LINE_MATERIAL_ZAXIS,
} from "src/integrations/tools-common/Drawing/shapeTool/visuals/snappingLineMaterials"
import { useLineVisuals } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/LineVisuals"
import type { SnappingLine } from "src/integrations/snapping/snapping"
import { snappingLineFromEndpoints } from "src/integrations/snapping/snappingEngineHelpers"
import { Vector3 } from "three"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import sceneManager from "src/core/three/sceneManager"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

// split an array of snapping lines in two arrays, with one containing
// all snapping lines that are vertical and the other with snapping lines
// that are not vertical
const verticalAngleTol2 = 0.99999695383 // cos(0.1 degree) ^ 2
export function extractVerticalSnappingLines(lines: SnappingLine[]): {
  zAxisLines: SnappingLine[]
  otherLines: SnappingLine[]
} {
  const reusableVector = new Vector3()
  const zAxisLines: SnappingLine[] = []
  const otherLines: SnappingLine[] = []

  lines.forEach((line) => {
    const vector = reusableVector.subVectors(line.start, line.end)

    const z2 = vector.z * vector.z
    const len2 = vector.x * vector.x + vector.y * vector.y + z2

    if (len2 > 1e-12 && z2 / len2 > verticalAngleTol2) {
      zAxisLines.push(line)
    } else {
      otherLines.push(line)
    }
  })

  return {
    zAxisLines: zAxisLines,
    otherLines: otherLines,
  }
}

export default function SnappingPickerVisuals({
  hoveredLine,
  hoveredPointLine,
}: {
  hoveredLine: SnappingLine | undefined
  hoveredPointLine: SnappingLine | undefined
}) {
  const selectedSnappingLines = selectedSnappingLinesSignal.value
  const selectedDerivedSnappingLines = selectedDerivedSnappingLinesSignal.value
  const lockedSnapLine = lockedSnapLineSignal.value
  const terrain = terrainSignal.value.terrainSamplerData

  const addableLines = useLineVisuals(ADDABLE_SNAPPING_LINE_MATERIAL)
  const passiveVisuals = useLineVisuals(PASSIVE_SNAPPING_LINE_MATERIAL)
  const shiftLockedVisual = useLineVisuals(BOLD_SNAPPING_LINE_MATERIAL)
  const hoveredVisual = useLineVisuals(ACTIVE_SNAPPING_LINE_MATERIAL)

  const addableLinesZAxis = useLineVisuals(ADDABLE_SNAPPING_LINE_MATERIAL_ZAXIS)
  const passiveVisualsZAxis = useLineVisuals(PASSIVE_SNAPPING_LINE_MATERIAL_ZAXIS)
  const shiftLockedVisualZAxis = useLineVisuals(BOLD_SNAPPING_LINE_MATERIAL_ZAXIS)
  const hoveredVisualZAxis = useLineVisuals(ACTIVE_SNAPPING_LINE_MATERIAL_ZAXIS)

  useEffect(() => {
    const lines = extractVerticalSnappingLines(hoveredLine ? [hoveredLine] : [])
    hoveredVisual.updateLines(lines.otherLines)
    hoveredVisualZAxis.updateLines(lines.zAxisLines)
  }, [hoveredVisual, hoveredVisualZAxis, hoveredLine, selectedSnappingLines])

  useEffect(() => {
    const lines = extractVerticalSnappingLines(selectedDerivedSnappingLines)
    passiveVisuals.updateLines(lines.otherLines)
    passiveVisualsZAxis.updateLines(lines.zAxisLines)
  }, [selectedDerivedSnappingLines, passiveVisuals, passiveVisualsZAxis])

  useEffect(() => {
    const lines = extractVerticalSnappingLines(lockedSnapLine ? [lockedSnapLine] : [])
    shiftLockedVisual.updateLines(lines.otherLines)
    shiftLockedVisualZAxis.updateLines(lines.zAxisLines)
  }, [lockedSnapLine, shiftLockedVisual, shiftLockedVisualZAxis])

  useEffect(() => {
    if (!hoveredPointLine || !terrain) return
    const lines = extractVerticalSnappingLines([lineIndicator(hoveredPointLine, terrain)])
    addableLines.updateLines(lines.otherLines)
    addableLinesZAxis.updateLines(lines.zAxisLines)
    return () => addableLines.updateLines([])
  }, [hoveredPointLine, terrain, addableLines, addableLinesZAxis])

  return <></>
}

function lineIndicator(hoveredPointLine: SnappingLine, terrain: TerrainSamplerData): SnappingLine {
  let segmentLength = pixelsToMetersAtPosition(50, sceneManager.camera, hoveredPointLine.center)
  const start = new Vector3()
    .subVectors(hoveredPointLine.start, hoveredPointLine.center)
    .normalize()
    .multiplyScalar(segmentLength)
    .add(hoveredPointLine.center)
  const end = new Vector3()
    .subVectors(hoveredPointLine.end, hoveredPointLine.center)
    .normalize()
    .multiplyScalar(segmentLength)
    .add(hoveredPointLine.center)
  return snappingLineFromEndpoints(start, end, hoveredPointLine.type, hoveredPointLine.onTerrain, terrain)
}
