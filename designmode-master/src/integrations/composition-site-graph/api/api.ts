import type { CoEdgeProperties, EdgeProperties } from "src/integrations/composition-site-graph/state"

type PointXY = {
  x: number
  y: number
}
export type Parcel = {
  start: PointXY
  end: PointXY
  incomingAngle: number
  outgoingAngle: number
  incomingParcelDepth: number
  outgoingParcelDepth: number
  properties: (CoEdgeProperties & EdgeProperties) | undefined
}
