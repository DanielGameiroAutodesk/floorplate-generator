import type { ParkingParams } from "./lib-generators/parkingGenerator/parking"

type PolygonXY = { x: number; y: number }[]
export type BufferGeometryData = {
  position: Float32Array
  normal: Float32Array
  uv?: Float32Array
  index?: Uint32Array
  boundsTreeRoot?: ArrayBuffer
  boundingSphere?: { center: [number, number, number]; radius: number }
}

export enum UnitType {
  Core = "CORE",
  LivingUnit = "LIVING_UNIT",
  Unassigned = "UNASSIGNED",
  Parking = "PARKING",
}

export type Coord2D = {
  x: number
  y: number
}
export type Unit = {
  type: UnitType
  polygon: Coord2D[]
  holes: Coord2D[][]
  generator?: {
    generatorId: string
    params?: any
  }
  id: string
}
type Floor = {
  id: string
  units: Unit[]
  elevation: number
  height: number
}
export type Stack = {
  floors: Floor[]
  selectedFloors: number[]
  id: string
}
type OutputUnits = { [id: string]: Unit }
export type OutputFloor = {
  id: string
  elevation: number
  height: number
  units: OutputUnits
  outerShape: OuterShape
  copyPropertiesFromId?: string
}
export type OutputData = {
  updatedStacks: {
    [stackId: string]: {
      newFloors: OutputFloor[]
    }
  }
  cameraData?: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }
  selectionData?: { stackId: string; selectedFloors: number[] }
}
type GlobalPoint = { x: number; y: number }
export type InputUnitPolygon = GlobalPoint[]
export type InputUnit = {
  id: string
  polygon: InputUnitPolygon
  holes: InputUnitPolygon[]
  name: string
  type: string
  generator?: {
    generatorId: string
    params?: any
  }
}
export type InputUnits = { [id: string]: InputUnit }
export type OuterShape = { polygon: InputUnitPolygon; holes: InputUnitPolygon[]; units: InputUnits }[]
export type InputFloor = {
  id: string
  elevation: number
  height: number
  units: InputUnits
  contentType: FloorContentTypes
  outerShape: OuterShape
}
type FloorContentTypes = "PARKING" | "FLOOR_PLAN" | "EMPTY" | any
type GenerateParking = (polygon: PolygonXY[], parameters?: ParkingParams) => PolygonXY[]
export type GeneratorFunctions = {
  parking: GenerateParking
}
