import type { ParametricElementFormaElement } from "src/integrations/parametric-element-system/parametricElementClient"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"

export const lineBuildingGeneratorId = "quick-draw-apartment-building-v0"

export type LineBuildingFormaElement = ParametricElementFormaElement & {
  properties: {
    generator: {
      generatorId: typeof lineBuildingGeneratorId
      parameters: LineBuildingParameters
    }
    hasSemanticMesh?: boolean | undefined
    hasStableSemanticMesh?: boolean
  }
}
