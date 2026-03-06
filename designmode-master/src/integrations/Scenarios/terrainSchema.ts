type TerrainTile = {
  typeid: "autodesk.aec:component.terrainTile-1.0.0"
  gridIndexX: number
  gridIndexY: number
  numTriangles?: number
  numVertices?: number
  elevationOffset: number
  boundaryIndicesTop?: number[]
  boundaryIndicesBottom?: number[]
  boundaryIndicesLeft?: number[]
  boundaryIndicesRight?: number[]
  location: string
  [key: string]: unknown
}

export type RepresentationTerrainSurface = {
  typeid: "autodesk.aec:component.terrainSurface-1.0.0"
  id: string
  name: string
  inventoryIds: string[]
  gridOffset: {
    x: number
    y: number
    z: number
  }
  gridDimensions: {
    x: number
    y: number
  }
  tiles: TerrainTile[]
  jobRepresentationUrl?: string
  [key: string]: unknown
}
