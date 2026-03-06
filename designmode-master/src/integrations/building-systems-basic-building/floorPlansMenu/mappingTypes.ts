////
// Mapping old structure types from FloorStacksBuildingV2 to unit program in Basic Building

import type { Unit } from "src/integrations/building-systems-basic-building/lib/types"

export function mapUnitProgramToStructureType(unitProgram: string | undefined) {
  if (unitProgram === "UNASSIGNED") return "UNASSIGNED"
  if (unitProgram === "LIVING_UNIT") return "LIVING_UNIT"
  if (unitProgram === "CORE") return "CORE"
  if (unitProgram === "CORRIDOR") return "CORRIDOR"
  if (unitProgram === "PARKING") return "PARKING"
  return "UNASSIGNED"
}

export function mapStructureTypeToUnitProgram(structureType: string | undefined): Unit["program"] {
  if (structureType === "UNASSIGNED") return undefined
  if (structureType === "LIVING_UNIT") return "LIVING_UNIT"
  if (structureType === "CORE") return "CORE"
  if (structureType === "CORRIDOR") return "CORRIDOR"
  if (structureType === "PARKING") return "PARKING"
  return undefined
}
