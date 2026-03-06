import type { Vector3 } from "three"
import { useEffect, useState } from "preact/compat"
import type { SnapInfo } from "./snappingEngine"
import { isSnappingLine, isSnappingPoint } from "./snappingEngine"
import {
  ACTIVE_SNAPPING_LINE_MATERIAL,
  ACTIVE_SNAPPING_LINE_MATERIAL_ZAXIS,
  DASHED_SNAPPING_LINE_MATERIAL,
} from "src/integrations/tools-common/Drawing/shapeTool/visuals/snappingLineMaterials"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import { useLineVisuals } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/LineVisuals"
import type { SnappingLine } from "./snapping"
import { AngleCornerVisual } from "src/integrations/tools-common/Drawing/shapeTool/visuals/AngleCornerVisual"
import { samePoint } from "src/lib/three/geometryUtils"
import { extractVerticalSnappingLines } from "./snapping-picker/SnappingPickerVisuals"

type Props = {
  snapInfo: SnapInfo | undefined
  showSnappingPoints: boolean
}

export const SnappingIndicator = ({ snapInfo, showSnappingPoints }: Props) => {
  const [snappedPointPos, setSnappedPointPos] = useState<Vector3 | undefined>()
  const [snappedReferencePos, setSnappedReferencePos] = useState<Vector3 | undefined>()

  const highlightedLines = useLineVisuals(ACTIVE_SNAPPING_LINE_MATERIAL)
  const highlightedLinesZAxis = useLineVisuals(ACTIVE_SNAPPING_LINE_MATERIAL_ZAXIS)
  const dashedLines = useLineVisuals(DASHED_SNAPPING_LINE_MATERIAL)

  const [rightAngles, setRightAngles] = useState<[Vector3, Vector3, Vector3][]>([])

  useEffect(() => {
    if (!snapInfo || !snapInfo.data || snapInfo.type === "NOT_SNAPPED") {
      highlightedLines.updatePositions([])
      dashedLines.updatePositions([])
      highlightedLinesZAxis.updatePositions([])
      setSnappedReferencePos(undefined)
      setSnappedPointPos(undefined)
      setRightAngles([])
      return
    }

    if (isSnappingPoint(snapInfo.data)) {
      setSnappedPointPos(snapInfo.position)
      setSnappedReferencePos(snapInfo.orgSnappingPos)
    }

    if (isSnappingLine(snapInfo.data)) {
      setSnappedPointPos(undefined)
      setSnappedReferencePos(snapInfo.type === "LINE" ? snapInfo.data.center : undefined)
    }

    let angles: [Vector3, Vector3, Vector3][] = []
    if (snapInfo.data.type === "INTERSECTION" && snapInfo.data.refLines?.some((l) => l.type === "ORTHOGONAL")) {
      const l1Center = snapInfo.data.refLines[0]?.center
      const l2Center = snapInfo.data.refLines[1]?.center
      if (l1Center && l2Center) {
        angles = [[l1Center, snapInfo.data.position, l2Center]]
      }
    }
    setRightAngles(angles)

    const lines = extractVerticalSnappingLines(getHighlightedLines(snapInfo))
    highlightedLines.updateLines(lines.otherLines)
    highlightedLinesZAxis.updateLines(lines.zAxisLines)
    dashedLines.updatePositions(getDashedPositions(snapInfo))
  }, [dashedLines, snapInfo, highlightedLines, highlightedLinesZAxis])

  return (
    <>
      {showSnappingPoints && (
        <>
          {snappedPointPos && <Handle position={snappedPointPos} snapActive />}
          {snappedReferencePos && <Handle position={snappedReferencePos} snapPassive />}
        </>
      )}
      {rightAngles.map(([p1, p2, p3], i) => (
        <AngleCornerVisual currentPoint={p3} startPoint={p1} pivotPoint={p2} key={i} />
      ))}
    </>
  )
}

function getHighlightedLines(snapInfo: SnapInfo): SnappingLine[] {
  let highlightedLines: SnappingLine[] = []

  if (snapInfo.data && isSnappingLine(snapInfo.data)) highlightedLines.push(snapInfo.data)
  if (snapInfo.data && snapInfo.data.refLines) highlightedLines.push(...snapInfo.data.refLines)

  return highlightedLines
}

function getDashedPositions(snapInfo: SnapInfo): number[] {
  let dashedPositions: number[] = []

  if (snapInfo.data && isSnappingPoint(snapInfo.data) && snapInfo.data.refPos) {
    dashedPositions.push(...[snapInfo.data.position, snapInfo.data.refPos].flatMap((v) => [v.x, v.y, v.z]))
  }

  if (!samePoint(snapInfo.position, snapInfo.orgSnappingPos)) {
    dashedPositions.push(...[snapInfo.position, snapInfo.orgSnappingPos].flatMap((v) => [v.x, v.y, v.z]))
  }

  return dashedPositions
}
