import { useCallback, useEffect, useState } from "preact/compat"
import SnappingPickerVisuals from "./SnappingPickerVisuals"
import {
  currentSnapInfoSignal,
  lockedSnapLineSignal,
  roundRobinNewSnapLine,
  setLockedSnapLineSignalValue,
  setSelectedInternalSnappingLinesSignalValue,
  setSelectedSnappingLinesSignalValue,
} from "src/integrations/snapping/snappingPicker.state"
import type { CandidateLine } from "src/integrations/snapping/snappingEngine"
import { isSnappingLine } from "src/integrations/snapping/snappingEngine"
import { createOrthogonalId, createOrthogonalSnappingLine } from "src/integrations/snapping/utils/createSnapLines"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import type { SnappingLine } from "src/integrations/snapping/snapping"

import { samePoint } from "src/lib/three/geometryUtils"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type Props = {
  ignoreTerrainSnappingLines?: boolean
  candidateLines: CandidateLine[]
}

// do something with ignoreTerrain

export default function SnappingPicker({ ignoreTerrainSnappingLines, candidateLines }: Props) {
  const terrainBin = terrainSignal.value.terrainSamplerData
  const currentSnapInfo = currentSnapInfoSignal.value

  const [hoveredLine, setHoveredLine] = useState<SnappingLine | undefined>()
  const [hoveredPointLine, setHoveredPointLine] = useState<SnappingLine | undefined>()

  const addSnappingShapes = useCallback((newLine: SnappingLine) => {
    setSelectedSnappingLinesSignalValue((currentSelected) => roundRobinNewSnapLine(currentSelected, newLine))
  }, [])

  useEffect(() => {
    const addHoveredLinesDelayed = setTimeout(() => {
      if (hoveredLine) addSnappingShapes(hoveredLine)
    }, 500)

    return () => {
      clearTimeout(addHoveredLinesDelayed)
    }
  }, [addSnappingShapes, hoveredLine])

  useEffect(() => {
    const addOrthogonalFromCenterDelayed = setTimeout(() => {
      if (hoveredPointLine) addSnappingShapes(hoveredPointLine)
    }, 500)

    return () => {
      clearTimeout(addOrthogonalFromCenterDelayed)
    }
  }, [addSnappingShapes, hoveredPointLine])

  const keydown = useCallback((e: KeyboardEvent) => {
    const currentSnapInfo = currentSnapInfoSignal.peek()
    if (e.key === "Shift" && currentSnapInfo?.data && isSnappingLine(currentSnapInfo.data)) {
      if (!lockedSnapLineSignal.peek()) setLockedSnapLineSignalValue(currentSnapInfo.data)
    } else if (e.shiftKey && e.code === "Space") {
      setSelectedSnappingLinesSignalValue([])
    }
    return Propagate.YES
  }, [])

  const keyup = useCallback((e: KeyboardEvent) => {
    if (e.key === "Shift") {
      setLockedSnapLineSignalValue(undefined)
    }
    return Propagate.YES
  }, [])

  useEffect(() => {
    const filteredLines = candidateLines.filter((l) => !ignoreTerrainSnappingLines || !l.line.onTerrain)

    if (!filteredLines || filteredLines.length === 0) {
      setHoveredLine(undefined)
      setHoveredPointLine(undefined)
      return
    }

    const firstLine = filteredLines[0].line
    const snappedToSignificantPoint =
      currentSnapInfo?.position &&
      [firstLine.start, firstLine.end, firstLine.center].find((p) => samePoint(p, currentSnapInfo.position, 0.0001))
    if (!hoveredLine || hoveredLine !== firstLine) {
      setHoveredLine(firstLine)
    }
    if (snappedToSignificantPoint) {
      let lineId = createOrthogonalId(firstLine)
      const newOrthogonal = createOrthogonalSnappingLine(firstLine, snappedToSignificantPoint, terrainBin, lineId)
      setHoveredPointLine(newOrthogonal)
    } else {
      setHoveredPointLine(undefined)
    }
  }, [candidateLines, currentSnapInfo, hoveredLine, ignoreTerrainSnappingLines, terrainBin])

  useEventHandler("keydown", keydown, Priority.TOOL_SNAPPING)
  useEventHandler("keyup", keyup, Priority.TOOL_SNAPPING)

  useEffect(() => {
    return () => {
      setSelectedInternalSnappingLinesSignalValue([])
      setSelectedSnappingLinesSignalValue([])
      setLockedSnapLineSignalValue(undefined)
    }
  }, [])

  return <SnappingPickerVisuals hoveredLine={hoveredLine} hoveredPointLine={hoveredPointLine} />
}
