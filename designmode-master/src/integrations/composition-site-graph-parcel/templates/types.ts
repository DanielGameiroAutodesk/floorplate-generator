import type { ParcelCompositionElement } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { PrivateOutdoorSpaceElement } from "src/integrations/composition-site-graph-parcel/privateOutdoorSpace/privateOutdoorSpaceGenerator"
import type { RowhouseElement } from "src/integrations/composition-row-house-generator/api"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"

export type ParcelTemplate = {
  id: string
  name: string
  rowHouseElement: RowhouseElement
  element: ParcelCompositionElement
  privateOutdoorSpaceElement: PrivateOutdoorSpaceElement
  representations: RepresentationsByUrn
}
