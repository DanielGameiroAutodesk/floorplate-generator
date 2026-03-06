import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { Renderable } from "src/integrations/renderables/renderable"
import { Vector3 } from "three"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const renderables2dController = createDerivedDataController(computeRenderables2d)

function computeRenderables2d(node: ChildNodeContainer): Renderable[] | undefined {
  // When creating renderables2d in ElementContainer, in untransformed space, we still need to know
  // which _scale_ the renderables are going to end up at after applying the transform (because line
  // widths in terrain shapes are specified in world units). We thus need to provide info "upstream"
  // to the ElementContainer about this. This is done using DerivedDataWithAdditionalState, where
  // data computed in ElementContainer can use "additional state" provided externally, and the
  // result will be memoized per unique value for the additional state (in our case the scale)
  const matrix = node.globalMatrix.clone()
  matrix.elements[14] = 0 // Assumes we're not rotating X/Y. Just set all to Z=0 for now.
  const scaleVector = new Vector3().setFromMatrixScale(matrix)
  const assumedUniformScale = scaleVector.x

  // Convert scale values (numbers) into stable object references that can be used as keys in the
  // WeakMap used internally by DerivedDataWithAdditionalState
  const scaleWrappedAsObject = getScaleValueWrappedAsObject(assumedUniformScale)
  const minimumRenderable = node.elementContainer.renderable2d(scaleWrappedAsObject).getOrCompute()

  return minimumRenderable.map(({ geometry, spec, imgUrl }) => ({
    geometry: geometry.clone().applyMatrix4(matrix),
    spec,
    imgUrl,
    id: node.path,
    toplevel: node.path,
  }))
}

const scaleValuesWrappedAsObjects: Record<number, { scale: number }> = {}
function getScaleValueWrappedAsObject(scale: number): { scale: number } {
  if (!scaleValuesWrappedAsObjects[scale]) {
    scaleValuesWrappedAsObjects[scale] = { scale: scale }
  }
  return scaleValuesWrappedAsObjects[scale]
}
