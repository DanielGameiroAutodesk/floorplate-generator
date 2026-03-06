import { BufferAttribute, BufferGeometry, EdgesGeometry } from "three"
import { parseUrn } from "src/lib/element/urn"
import type { FormaElement } from "@spacemakerai/element-types"
import type { ElementContainer } from "src/core/elements/ElementContainer"

const isLoD2Building = (element: FormaElement): boolean => {
  return parseUrn(element.urn).system === "integrate" && element.properties?.category === "building"
}

// This is a WeakMap to allow BufferGeometry to be garbage collected (which will also GC the corresponding Float32Array)
const _edgeCache = new WeakMap<BufferGeometry, Float32Array>()

const calculateEdges = (geometry: BufferGeometry): Float32Array | undefined => {
  let edgeGeo: BufferGeometry
  const cached = _edgeCache.get(geometry)
  if (cached) {
    edgeGeo = new BufferGeometry()
    edgeGeo.setAttribute("position", new BufferAttribute(new Float32Array(cached), 3))
  } else {
    edgeGeo = new EdgesGeometry(geometry, 20)
    _edgeCache.set(geometry, new Float32Array(edgeGeo.attributes.position.array as Float32Array))
  }

  return edgeGeo.attributes.position.array as Float32Array
}

const generateOutlines = (container: ElementContainer): Float32Array | undefined => {
  const volumeMesh = container.representations.volumeMesh
  if (volumeMesh) {
    const outlines = calculateEdges(volumeMesh)
    if (outlines && outlines.length > 0) return outlines
  }
  return undefined
}

export interface ContextualDataApi {
  isLoD2Building(element: FormaElement): boolean
  generateOutlines(container: ElementContainer): Float32Array | undefined
}

export const contextualDataApi: ContextualDataApi = {
  isLoD2Building,
  generateOutlines,
}
