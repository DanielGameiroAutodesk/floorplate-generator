import { useMemo } from "preact/compat"
import type { Vector3 } from "three"
import { getAngleXY } from "./geoHelpers"
import type { ControlContextValue } from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import FloatingToolInputs from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import { exitCurrentTool } from "src/core/toolsState"

function pointPointDistanceXY(pointOne: { x: number; y: number }, pointTwo: { x: number; y: number }) {
  return ((pointOne.x - pointTwo.x) ** 2 + (pointOne.y - pointTwo.y) ** 2) ** 0.5
}

function getEdgeLength(line: Line, position: Vector3): number {
  if (line.length < 1) return -1
  const n = line.length
  const p0 = line[n - 1]
  return pointPointDistanceXY(p0, position)
}

function getCornerAngle(line: Line, position: Vector3): number {
  if (line.length < 2) return -1
  const n = line.length
  const p0 = line[n - 2]
  const p1 = line[n - 1]
  return getAngleXY(p0, p1, position)
}

export type DrawLineFixedInputs = {
  fixedLength?: number
  fixedAngle?: number
}

type Line = Vector3[]

export const DrawLineBuildingInputBox = ({
  fixedInputs,
  updateFixedInputs,
  line,
  position,
}: {
  fixedInputs: DrawLineFixedInputs
  updateFixedInputs: (fixedInputs: DrawLineFixedInputs) => void
  line: Line
  position: Vector3
}) => {
  const showLength = useMemo(() => {
    return line.length >= 1
  }, [line])
  const showAngle = useMemo(() => {
    return line.length >= 2
  }, [line])

  const { fixedLength, fixedAngle } = fixedInputs

  const edgeLengthLocal = useMemo(() => {
    let edgeLength
    if (fixedLength !== undefined) edgeLength = fixedLength
    else edgeLength = getEdgeLength(line, position)
    return edgeLength
  }, [fixedLength, line, position])

  const cornerAngleLocal = useMemo(() => {
    let cornerAngle
    if (fixedAngle !== undefined) cornerAngle = fixedAngle
    else cornerAngle = getCornerAngle(line, position)
    return (cornerAngle / Math.PI) * 180
  }, [fixedAngle, line, position])

  const inputFields = useMemo(() => {
    const fields: ControlContextValue[] = []

    if (showLength) {
      fields.push({
        type: "horizontal",
        value: edgeLengthLocal,
        change: (fixedLength: number | undefined) => {
          updateFixedInputs({
            fixedLength: fixedLength,
            fixedAngle: fixedAngle,
          })
        },
      })
    }

    if (showAngle) {
      fields.push({
        type: "angle",
        value: cornerAngleLocal,
        change: (fixedAngleLocal: number | undefined) => {
          let fixedAngle
          if (fixedAngleLocal !== undefined) {
            fixedAngle = (fixedAngleLocal / 180) * Math.PI
          }
          updateFixedInputs({
            fixedLength: fixedLength,
            fixedAngle: fixedAngle,
          })
        },
      })
    }

    return fields
  }, [cornerAngleLocal, edgeLengthLocal, fixedAngle, fixedLength, showAngle, showLength, updateFixedInputs])

  return <FloatingToolInputs fields={inputFields} cancel={exitCurrentTool} />
}
