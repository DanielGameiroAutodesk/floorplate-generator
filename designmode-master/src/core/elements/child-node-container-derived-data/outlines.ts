import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { BufferAttribute, BufferGeometry, Vector3 } from "three"
import type { Renderable } from "src/integrations/renderables/renderable"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

const reusableVec = new Vector3()

export const outlinesController = createDerivedDataController(computeOutlines)
export const renderableForOutlinesController = createDerivedDataController(computeRenderableForOutlines)

function computeOutlines(node: ChildNodeContainer): Float32Array | undefined {
  const outlines = node.elementContainer.outlines.getOrCompute()
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

function computeRenderableForOutlines(node: ChildNodeContainer): Renderable[] {
  const outlines = node.outlines.getOrCompute()
  if (!outlines) return []
  const spec: Renderable["spec"] =
    node.elementContainer.element.properties?.category === "constraints" ? "constraintOutline" : "basicLines"

  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(outlines, 3))

  return [
    {
      id: node.path,
      spec,
      geometry: geo,
    },
  ]
}
