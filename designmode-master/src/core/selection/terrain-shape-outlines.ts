import type { Feature, Position } from "geojson"
import type { Matrix4 } from "three"
import { Vector2, Vector3 } from "three"
import type { TerrainShape } from "src/lib/element/types"
import { isDefined } from "src/lib/array"
import { simplify } from "src/lib/geometry/simplify"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { raycast } from "src/core/terrain/2d-raytracer"

function transformCoordinates(coordinates: Position[][], transform: Matrix4): Position[][] {
  const v = new Vector3()
  return coordinates.map((ring) =>
    ring.map((p) => {
      v.set(p[0], p[1], 0)
      v.applyMatrix4(transform)
      return [v.x, v.y]
    }),
  )
}

function fillPoints(coordinates: Position[][], closeRings: boolean, fillDistance = 1) {
  const vec = new Vector2()
  function fillSegment(p1: number[], p2: number[]): Position[] {
    vec.set(p2[0] - p1[0], p2[1] - p1[1])
    const length = vec.length()
    const nFill = Math.floor(length / fillDistance)
    vec.multiplyScalar(1 / (nFill + 1))
    const filledSegment = [p1]
    for (let i = 0; i < nFill; i++) {
      filledSegment.push([p1[0] + (i + 1) * vec.x, p1[1] + (i + 1) * vec.y])
    }
    filledSegment.push(p2)
    return filledSegment
  }
  return coordinates.map((ring) =>
    ring.flatMap((p1, i, l) => {
      const p2 = !closeRings && i === l.length - 1 ? p1 : l[(i + 1) % l.length]
      if (p1[0] === p2[0] && p1[1] === p2[1]) {
        return [] as Position[]
      }
      return fillSegment(p1, p2)
    }),
  )
}

function sampleTerrainPoints(coordinates: Position[][], terrainSamplerData: TerrainSamplerData) {
  return coordinates.map((ring) => ring.map((p) => [p[0], p[1], raycast(p[0], p[1], terrainSamplerData)]))
}

function buildSelectionEdgesFromCoordinates(lines3d: number[][][]) {
  let nPoints = 0
  for (let i = 0; i < lines3d.length; i++) {
    nPoints += lines3d[i].length
  }

  if (nPoints === 0) {
    return new Float32Array(0)
  }

  const nVals = (nPoints - 1) * 2 * 3
  const position = new Float32Array(nVals)
  let c = 0
  for (let i = 0; i < lines3d.length; i++) {
    for (let j = 0; j < lines3d[i].length - 1; j++) {
      position[c++] = lines3d[i][j][0]
      position[c++] = lines3d[i][j][1]
      position[c++] = lines3d[i][j][2]
      position[c++] = lines3d[i][j + 1][0]
      position[c++] = lines3d[i][j + 1][1]
      position[c++] = lines3d[i][j + 1][2]
    }
  }
  return position
}

function selectionLinesFromFeature(feature: Feature): Position[][] | undefined {
  const geometry = feature.geometry
  let lines

  if (geometry.type === "Polygon") {
    lines = geometry.coordinates.map((coords): Position[] => {
      if (coords.length < 10) return coords

      const coordsOnCorrectFormat = coords.map(([x, y]) => ({ x, y })).slice(0, -1)

      const simplified = simplify(coordsOnCorrectFormat, 0.1, false).map(({ x, y }: { x: number; y: number }) => {
        return [x, y]
      })

      return [...simplified, simplified[0]]
    })
  }
  if (geometry.type === "LineString") {
    lines = [geometry.coordinates]
  }
  return lines
}

export function getOutlinesFromTerrainShape(
  terrainShape: TerrainShape,
  transform: Matrix4 | undefined,
  terrainSamplerData: TerrainSamplerData,
): Float32Array {
  const assumedUniformScaling = transform ? new Vector3().setFromMatrixScale(transform).x : 1
  const localMetersPerGlobalMeter = 1 / assumedUniformScaling

  const selectionLines = terrainShape.features.map(selectionLinesFromFeature).filter(isDefined)

  const selectionLinesOnTerrain = selectionLines.map((line) => {
    const filledLine = fillPoints(line, false, 2 * localMetersPerGlobalMeter)
    const transformedLine = transform ? transformCoordinates(filledLine, transform) : filledLine
    return sampleTerrainPoints(transformedLine, terrainSamplerData)
  })

  const outlineArrays = selectionLinesOnTerrain.map(buildSelectionEdgesFromCoordinates)
  return combineFloat32s(outlineArrays)
}

function combineFloat32s(arrays: Float32Array[]): Float32Array {
  const length = arrays.reduce((sum, curr) => sum + curr.length, 0)
  const combined = new Float32Array(length)
  let offset = 0
  for (const a of arrays) {
    combined.set(a, offset)
    offset += a.length
  }
  return combined
}
