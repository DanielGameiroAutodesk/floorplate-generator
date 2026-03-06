import { selectionSetSignal } from "src/core/selection/selectionState"
import { isBasicElementUrn } from "src/lib/element/urn"
import { isReferenceImage } from "src/integrations/tools-common/Transform2D/EditReferenceImage"
import { computedFamily } from "src/lib/signal"
import { elementState } from "src/core/elements/ElementState"

export const selectionOnlyContainsPolygonsSignalFamily = computedFamily((minNumSelected: number) => {
  const selectedPaths = selectionSetSignal.value
  const snapshot = elementState.currentSnapshot.value

  return (
    selectedPaths.size >= minNumSelected &&
    Array.from(selectedPaths).every((path) => {
      const node = snapshot.getNode(path)
      if (!node) return false

      const element = node.elementContainer.element

      const geojson = node.elementContainer.representations.footprint
      const geoJsonIsPolygon = geojson && geojson.geometry.type === "Polygon"

      return isBasicElementUrn(element.urn) && !isReferenceImage(element) && geoJsonIsPolygon
    })
  )
})
