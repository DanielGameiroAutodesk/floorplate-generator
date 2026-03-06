import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { BufferGeometry } from "three"

import type { SimpleBuilding } from "src/integrations/building-systems-simple-buildings/simpleBuilding"

export type GeneratorResponse = {
  generatorElements: Record<Urn, FormaElement>
  rootUrn: Urn
  geometry: BufferGeometry
  [key: string]: any
}

export type ParameterDescription =
  | NumberParameterDescription
  | MultiSelectParameterDescription
  | OptionParameterDescription
  | TextParameterDescription
  | BooleanParameterDescription

export type NumberParameterDescription = {
  name: string
  valueType: "number"
  value: number
  min: number
  max: number
  step: number
  unit: "length" | "count" | "angle"
  inputInteraction: "inputField" | "slider" | "none"
}

export type OptionParameterDescription = RadioParameterDescription | SelectParameterDescription

export type RadioParameterDescription = {
  name: string
  valueType: "select"
  options: string[]
  value: OptionParameterDescription["options"][number] //aka "one of options"
  inputInteraction: "radio" | "none"
}

export type MultiSelectParameterDescription = {
  name: string
  valueType: "multiSelect"
  options: Record<string, { value: boolean; icon: JSX.Element }>

  value: Record<string, boolean>
  inputInteraction: "select" | "none"
}

export type SelectParameterDescription = {
  name: string
  valueType: "select"
  options: { value: string; icon: JSX.Element }[]
  value: string
  inputInteraction: "select" | "none"
}

export type TextParameterDescription = {
  name: string
  valueType: "text"
  value?: string
  inputInteraction: "inputField" | "none"
}

export type BooleanParameterDescription = {
  name: string
  valueType: "boolean"
  value: boolean
  inputInteraction: "select" | "radio" | "none"
}

export interface GeneratorInterface {
  run: (parameters: any, transform?: any) => GeneratorResponse | undefined
  getParametersSchema: () => Record<string, ParameterDescription>
  getBakeToFloorStackData?: (parameters: any, transform?: any) => SimpleBuilding[]
}
