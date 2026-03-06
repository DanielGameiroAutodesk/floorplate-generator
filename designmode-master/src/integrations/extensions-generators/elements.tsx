import type { FormaElement } from "@spacemakerai/element-types"

export type GeneratorProperty = {
  generatorId: string
}

export type GeneratorProperties = {
  generator: GeneratorProperty
}

export type GeneratedElement = FormaElement & {
  properties: GeneratorProperties
}

export function isGeneratedElement(element: FormaElement): element is GeneratedElement {
  return !!(
    element.properties &&
    element.properties.generator &&
    // can't check simply on generatorId, as that overlaps with
    // existing elements from building systems
    "schemaVersion" in element.properties.generator
  )
}
