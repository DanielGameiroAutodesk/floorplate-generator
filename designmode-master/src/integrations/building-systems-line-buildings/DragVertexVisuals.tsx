import type { OtherBuildingDragSnapData } from "./dragToOtherBuilding"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import { Vector3 } from "three"

export function OtherBuildingDragSnapVisuals({
  otherBuildingsSnapData,
  dragVertexData,
}: {
  otherBuildingsSnapData: OtherBuildingDragSnapData
  dragVertexData: any
}) {
  let snappingPoints
  if (dragVertexData.dragVertexType === "startDrag") snappingPoints = otherBuildingsSnapData?.snappingPoints?.startDrag
  if (dragVertexData.dragVertexType === "endDrag") snappingPoints = otherBuildingsSnapData?.snappingPoints?.endDrag

  const snappedToId = dragVertexData.otherBuildingSnapData?.id

  return (
    <>
      {snappingPoints &&
        snappingPoints.map((snapPoint) => {
          const position = new Vector3(snapPoint.point.x, snapPoint.point.y, snapPoint.point.z + snapPoint.height)
          const hovered = snappedToId === snapPoint.id
          return (
            <>
              <Handle key={snapPoint.id + "high" + hovered} position={position} hovered={hovered} />
              <Handle key={snapPoint.id + "low" + hovered} position={snapPoint.point} hovered={hovered} />
            </>
          )
        })}
    </>
  )
}
