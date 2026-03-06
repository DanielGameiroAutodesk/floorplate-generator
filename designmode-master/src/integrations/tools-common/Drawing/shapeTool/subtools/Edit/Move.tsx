import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import type { Vector3 } from "three"
import { AlwaysDepth, Color } from "three"
import { DistanceLabel } from "src/integrations/tools-common/Drawing/shapeTool/visuals/labels/DistanceLabel/DistanceLabel"
import type { Guide } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import { CalculateMousePosition } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import { snappingLineFromEndpoints } from "src/integrations/snapping/snappingEngineHelpers"
import { DashedLineMaterial } from "src/lib/three/materials/DashedLineMaterial"
import { defaultCursor, moveCursor, moveHorizontalCursor, moveVerticalCursor } from "src/integrations/cursors/setCursor"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import sceneManager, { screenResolutionVector } from "src/core/three/sceneManager"
import { dispose } from "src/core/three/useObjectLifecycle"
import { ThreeLine } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/ThreeLine"
import type { ShapeToolConfig } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { SnappingLine } from "src/integrations/snapping/snapping"
import type { Shape } from "src/lib/three/Shape/types"
import { colors } from "src/lib/colors"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type Props = {
  shape: Shape
  startPos: Vector3
  onMove: (newPos: Vector3) => any
  onComplete: () => any
  useImperialUnits: boolean
  toolConfig: ShapeToolConfig
  refPos: Vector3
  guide?: Guide
  enableSnappingPicker?: boolean
  discreteLength?: number
}

const refLineMat = new DashedLineMaterial({
  color: new Color(colors.gray20).getHex(),
  resolution: screenResolutionVector,
  depthFunc: AlwaysDepth,
})

function nextMoveMode(current: ShapeToolMoveMode, availableModes: ShapeToolMoveMode[] | undefined): ShapeToolMoveMode {
  const modes =
    availableModes ||
    Object.values(ShapeToolMoveMode).filter((v: string | number): v is ShapeToolMoveMode => typeof v === "number")
  const currIdx = modes.indexOf(current)
  return modes[(currIdx + 1) % modes.length]
}

export const Move = ({
  startPos,
  onMove,
  onComplete,
  shape,
  useImperialUnits,
  toolConfig,
  refPos,
  guide,
  enableSnappingPicker,
  discreteLength,
}: Props) => {
  const { moveModes, onTerrain, useContextualLines, ignoreTerrainSnappingLines } = toolConfig
  const [moveMode, setMoveMode] = useState<ShapeToolMoveMode>(
    (moveModes && moveModes[0]) || ShapeToolMoveMode.HORIZONTAL,
  )

  useEffect(() => {
    switch (moveMode) {
      case ShapeToolMoveMode.VERTICAL:
        moveVerticalCursor()
        break
      case ShapeToolMoveMode.HORIZONTAL:
        moveHorizontalCursor()
        break
      case ShapeToolMoveMode.TERRAIN:
        moveCursor()
        break
    }
    return defaultCursor
  }, [moveMode])

  const [atPos, setAtPos] = useState(startPos)

  const newPos = useCallback(
    (pos: Vector3) => {
      onMove(pos)
      setAtPos(pos)
    },
    [onMove],
  )

  const mouseup = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return Propagate.YES
      if (atPos.distanceTo(startPos) < pixelsToMetersAtPosition(5, sceneManager.camera, atPos)) return Propagate.YES
      onComplete()
      return Propagate.NO
    },
    [onComplete, startPos, atPos],
  )

  useEventHandler("mouseup", mouseup, Priority.SUBTOOL_LVL2)

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m") {
        setMoveMode(nextMoveMode(moveMode, moveModes))
        return Propagate.YES
      } else if (e.key === "Enter") {
        onComplete()
        return Propagate.NO
      }
      return Propagate.YES
    },
    [moveMode, moveModes, onComplete],
  )
  useEventHandler("keydown", keydown, Priority.SUBTOOL_LVL2)

  useEffect(() => {
    const line = new ThreeLine([refPos, atPos], refLineMat)

    sceneManager.scene.add(line)

    return () => {
      dispose(line)
      sceneManager.scene.remove(line)
    }
  }, [moveMode, refPos, atPos])

  const terrainBin = terrainSignal.value.terrainSamplerData
  const currentShapeSnappingLines = useMemo(() => {
    const placedLines: SnappingLine[] = shape.edges.map(([start, end]) =>
      snappingLineFromEndpoints(shape.vertices[start], shape.vertices[end], "LINE", onTerrain, terrainBin),
    )

    return placedLines
  }, [onTerrain, shape, terrainBin])

  return (
    <>
      <DistanceLabel vertices={[refPos, atPos]} color={colors.gray20} useImperialUnits={useImperialUnits} />
      <CalculateMousePosition
        moveMode={moveMode}
        onTerrain={onTerrain}
        onChange={newPos}
        currentShapeSnappingLines={currentShapeSnappingLines}
        startPoint={refPos}
        useDerivedSnappingLines={useContextualLines}
        commitCurrentPreview={onComplete}
        guide={guide}
        ignoreTerrainSnappingLines={ignoreTerrainSnappingLines}
        enableSnappingPicker={enableSnappingPicker}
        discreteLength={discreteLength}
      />
    </>
  )
}
