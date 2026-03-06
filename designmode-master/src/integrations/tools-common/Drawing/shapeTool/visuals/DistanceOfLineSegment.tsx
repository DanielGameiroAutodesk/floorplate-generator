import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { DistanceLabel } from "./labels/DistanceLabel/DistanceLabel"
import type { Object3D } from "three"
import { Vector3 } from "three"

import { colors } from "src/lib/colors"
import { useIsImperial } from "src/lib/unitSettings"

export const DistanceOfLineSegment: LineSegmentRenderer<{ labelInstance?: (label: Object3D | null) => any }> = ({
  lineSegment,
  labelInstance: setLabel,
}) => {
  const useImperialUnits = useIsImperial()

  return (
    <>
      {lineSegment && (
        <DistanceLabel
          vertices={lineSegment.map((c) => new Vector3().fromArray(c)) as [Vector3, Vector3]}
          color={colors.gray20}
          useImperialUnits={useImperialUnits}
          ref={setLabel}
          horizontal={true}
        />
      )}
    </>
  )
}
