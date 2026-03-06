export type Wall = {
  // right hand rule for normal
  external: boolean
  startPoint: [number, number]
  endPoint: [number, number]
}

export type Surface = {
  coordinates: number[][][] // ccw outer ring, cw inner rings geojson style
  elevation: number
}

export type AnalysisFloor = {
  id: string
  height: number
  walls: Wall[]
  // floor: number[][][][] // area metrics
}

export type AnalysisBuilding = {
  // footprint: number[][][] // area metrics
  floors: AnalysisFloor[] // first floor at elevation 0, then stacking upwards
  roofs: Surface[]
  bottoms: Surface[]
}
