import { Float32Concat, Uint8Concat } from "./arrayHelpers"
import { BufferAttribute, BufferGeometry } from "three"
import { defaultColorFunction } from "./apartmentBuildingColors"
import {
  buildGeometryForVolume,
  buildGeometryForVolumes,
} from "src/integrations/building-systems-common/buildGeoWithHoles"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"
import { makeColorArray } from "src/lib/three/build-25d-volume-boxes"

type Coordinates = [number, number][][]

type Block = {
  coordinates: Coordinates
  elevation: number
  height: number
}

export type BuildingBlock = Block & {
  structureType: string
}

export function makeLinesFromBlocks(blocks: Block[]): Float32Array {
  const lines: number[] = []
  for (let block of blocks) {
    const { elevation, height, coordinates } = block
    for (const polygon of coordinates) {
      const n = polygon.length
      for (let i = 0; i < n; i++) {
        const [x0, y0] = polygon[i]
        const [x1, y1] = polygon[(i + 1) % n]
        const zLow = elevation
        const zHigh = elevation + height
        const lowLine = [x0, y0, zLow, x1, y1, zLow]
        const highLine = [x0, y0, zHigh, x1, y1, zHigh]
        const sideLine = [x1, y1, zLow, x1, y1, zHigh]
        lines.push(...lowLine, ...highLine, ...sideLine)
      }
    }
  }
  return new Float32Array(lines)
}

export function makeGeoFromBlocks(blocks: Block[]) {
  const geometry = buildGeometryForVolumes(blocks)
  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(geometry.position, 3))
  geo.setAttribute("normal", new BufferAttribute(geometry.normal, 3, false))
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

export function buildGeoFromBuildingBlocks(
  buildingBlocks: BuildingBlock[],
  colorFunction: (program: string, unitGroundPolygon: PolygonWithHolesXY) => string = defaultColorFunction,
) {
  const blocksByType: any = {}
  for (const buildingBlock of buildingBlocks) {
    const { elevation, height, structureType, coordinates } = buildingBlock

    const block = { coordinates: coordinates, elevation, height }
    if (!blocksByType[structureType]) blocksByType[structureType] = []
    blocksByType[structureType].push(block)
  }
  const positionsList: any = []
  const normalsList: any = []
  const colorsList: any = []
  buildingBlocks.forEach((block) => {
    const [outer, ...holes] = block.coordinates
    const polygonWithHoles: PolygonWithHolesXY = {
      polygon: outer.map(([x, y]) => ({ x, y })),
      holes: holes.map((hole) => hole.map(([x, y]) => ({ x, y }))),
    }
    const color = colorFunction(block.structureType, polygonWithHoles)
    const { position, normal } = buildGeometryForVolume(block)
    const colorArray = makeColorArray(position, color)
    positionsList.push(position)
    normalsList.push(normal)
    colorsList.push(colorArray)
  })

  const positions = Float32Concat(positionsList)
  const normals = Float32Concat(normalsList)
  const colors = Uint8Concat(colorsList)

  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(positions, 3))
  geo.setAttribute("normal", new BufferAttribute(normals, 3, false))
  geo.setAttribute("color", new BufferAttribute(colors, 3, true))
  return geo
}
