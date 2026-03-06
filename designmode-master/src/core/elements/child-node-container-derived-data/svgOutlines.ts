import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { Vector3 } from "three"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

const reusableVec = new Vector3()

export const svgOutlinesController = createDerivedDataController(computeSvgOutlines)

function computeSvgOutlines(node: ChildNodeContainer): Float32Array | undefined {
  const outlines = node.elementContainer.svgOutlines.getOrCompute()
  if (!outlines) return undefined
  const matrix = node.globalMatrix

  const transformedOutlines = new Float32Array(outlines.length)
  for (let i = 0; i < outlines.length; i += 3) {
    reusableVec.set(outlines[i], outlines[i + 1], outlines[i + 2])
    reusableVec.applyMatrix4(matrix)
    transformedOutlines[i] = reusableVec.x
    transformedOutlines[i + 1] = reusableVec.y
    transformedOutlines[i + 2] = reusableVec.z
  }
  return transformedOutlines
}
