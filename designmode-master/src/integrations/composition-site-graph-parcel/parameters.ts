export type ParcelGraphParameters = {
  width: number
  depth: number
  orientation: number
  relativeOrientation: boolean
  alignment: "left" | "center" | "right"
  buffer: number
  extraHouses: number
  priority: number
}

export const defaultParcelParameters: ParcelGraphParameters = {
  width: 6,
  depth: 16,
  orientation: 0,
  relativeOrientation: true,
  alignment: "center",
  extraHouses: 0,
  buffer: 0,
  priority: 0,
}
