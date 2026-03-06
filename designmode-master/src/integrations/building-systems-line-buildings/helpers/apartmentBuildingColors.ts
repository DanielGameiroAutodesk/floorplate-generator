const ColorMap: Record<string, string> = {
  CORE: "#EEEEEE",
  LIVING_UNIT: "#FFFFFF",
  GENERIC: "#aba",
  CORRIDOR: "#EEEEEE",
  UNASSIGNED: "#FFFFFF",
  GENERATOR: "#c7c7c7",
}

export function defaultColorFunction(structureType: string) {
  const color = ColorMap[structureType]
  return color ? color : "#FFFFFF"
}
