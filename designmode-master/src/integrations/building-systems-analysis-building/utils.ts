import type { SimpleBuilding } from "src/integrations/building-systems-simple-buildings/simpleBuilding"
import type { AnalysisBuilding, AnalysisFloor, Surface } from "./types"
import polygonClipping from "polygon-clipping"
import earcut from "earcut"
import { Float32Concat, Uint8Concat } from "src/integrations/building-systems-line-buildings/helpers/arrayHelpers"
import { BufferAttribute, BufferGeometry } from "three"

type PolygonWithHoles = {
  polygon: [number, number][]
  holes: [number, number][][]
}

function _dot(v1: number[], v2: number[]) {
  return v1[0] * v2[0] + v1[1] * v2[1]
}

export function pointsOnLine(p0: number[], p1: number[], all_points: number[][], snapDistance = 0.0001) {
  const xmin = Math.min(p0[0], p1[0]) - snapDistance,
    xmax = Math.max(p0[0], p1[0]) + snapDistance,
    ymin = Math.min(p0[1], p1[1]) - snapDistance,
    ymax = Math.max(p0[1], p1[1]) + snapDistance

  const s_vec = [p1[0] - p0[0], p1[1] - p0[1]],
    t_vec = [s_vec[1], -s_vec[0]]
  const t_base = _dot(t_vec, p0),
    s_min = _dot(s_vec, p0),
    s_max = _dot(s_vec, p1),
    t_length = Math.pow(Math.pow(t_vec[0], 2) + Math.pow(t_vec[1], 2), 0.5),
    t_max = snapDistance * t_length

  const sorted_points_on_line: [number, number][] = []
  all_points.forEach((point) => {
    if (xmin <= point[0] && point[0] <= xmax && ymin <= point[1] && point[1] <= ymax) {
      const s_val = _dot(point, s_vec),
        t_val = _dot(point, t_vec) - t_base
      if (Math.abs(t_val) < t_max && s_min < s_val && s_val < s_max) {
        let insertIndex = 0
        for (let i = 0; i < sorted_points_on_line.length; i++) {
          if (s_val > _dot(sorted_points_on_line[i], s_vec)) insertIndex++
          else break
        }
        sorted_points_on_line.splice(insertIndex, 0, point as [number, number])
      }
    }
  })

  return sorted_points_on_line
}

function removeDuplicates(array: [number, number][]) {
  return array.filter((point, index) => {
    const next = array[(index + 1) % array.length]
    return point[0] !== next[0] || point[1] !== next[1]
  })
}

export function insertPointsOnLines(coordinates: [number, number][][], allPoints: [number, number][]) {
  return coordinates.map((ring) =>
    ring.flatMap((point, i, l) => [point, ...pointsOnLine(point, l[(i + 1) % l.length], allPoints)]),
  )
}

function toCoordinates(s: PolygonWithHoles): [number, number][][] {
  return [removeDuplicates(s.polygon), ...s.holes.map(removeDuplicates)]
}

function differenceOuterShapes(outerShapes: PolygonWithHoles[], outerShapes2: PolygonWithHoles[]): number[][][][] {
  const coordinates1 = outerShapes.map((s) => toCoordinates(s))
  const coordinates2 = outerShapes2.map((s) => toCoordinates(s))

  const allPoints = coordinates1.concat(coordinates2).flat(2)
  const withInserts1 = coordinates1.map((coordinates) => insertPointsOnLines(coordinates, allPoints))
  const withInserts2 = coordinates2.map((coordinates) => insertPointsOnLines(coordinates, allPoints))
  //todo error handling?
  //todo result filtering (small polygons, )
  return polygonClipping.difference(withInserts1, withInserts2)
}

function sameOuterShape(outerShapes: PolygonWithHoles[], outerShapes2: PolygonWithHoles[]) {
  return JSON.stringify(outerShapes) === JSON.stringify(outerShapes2)
}

function snapPointsMutable(points: number[][], snappingDistance: number) {
  const nPoints = points.length
  points.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))
  let k = 1
  for (let i = 0; i < nPoints - 1; i++) {
    const p1 = points[i]
    for (let j = k; j < nPoints - 1; j++) {
      const p2 = points[j]
      if (p2[0] > p1[0] + snappingDistance) {
        break
      }
      if (p2[0] < p1[0] - snappingDistance) {
        k = j
        continue
      }
      if ((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 < snappingDistance ** 2) {
        p1[0] = p2[0]
        p1[1] = p2[1]
      }
    }
  }
}

function snapBuilding(building: SimpleBuilding) {
  const snapped: SimpleBuilding = JSON.parse(JSON.stringify(building))
  const allPoints = snapped.floors
    .flatMap((f) => f.outerShapes.concat(f.content?.units?.map((u) => u) || []))
    .map(toCoordinates)
    .flat(2)
  snapPointsMutable(allPoints, 1e-6)
  return snapped
}

export function simpleBuildingToAnalysisBuilding(_building: SimpleBuilding) {
  const building = snapBuilding(_building)
  const floors: AnalysisFloor[] = building.floors.map((f) => {
    //todo add internal walls from units
    const walls = f.outerShapes.flatMap((s) => {
      const coordinates = toCoordinates(s)
      return coordinates.flatMap((ring) =>
        ring.map((point, i, l) => {
          const startPoint = point
          const endPoint = l[(i + 1) % l.length]
          return {
            external: true,
            startPoint,
            endPoint,
          }
        }),
      )
    })
    return {
      id: f.id!,
      height: f.height,
      walls,
    }
  })
  const bottoms: Surface[] = building.floors[0].outerShapes.map((s) => {
    return {
      coordinates: [s.polygon, ...s.holes],
      elevation: 0,
    }
  })
  const roofs: Surface[] = building.floors[building.floors.length - 1].outerShapes.map((s) => {
    const height = building.floors.reduce((acc, f) => acc + f.height, 0)
    return {
      coordinates: [s.polygon, ...s.holes],
      elevation: height,
    }
  })
  let height = 0
  for (let floorIndex = 0; floorIndex < building.floors.length - 1; floorIndex++) {
    const lower = building.floors[floorIndex]
    const upper = building.floors[floorIndex + 1]
    height += lower.height
    if (!sameOuterShape(lower.outerShapes, upper.outerShapes)) {
      const lowerDiffUpper: number[][][][] = differenceOuterShapes(lower.outerShapes, upper.outerShapes)
      lowerDiffUpper.forEach((roofCoordinates) => {
        roofs.push({
          coordinates: roofCoordinates,
          elevation: height,
        })
      })
      const upperDiffLower: number[][][][] = differenceOuterShapes(upper.outerShapes, lower.outerShapes)
      upperDiffLower.forEach((bottomCoordinates) => {
        bottoms.push({
          coordinates: bottomCoordinates,
          elevation: height,
        })
      })
    }
  }
  const analysisBuilding: AnalysisBuilding = {
    floors,
    roofs,
    bottoms,
  }
  return analysisBuilding
}

export function createSurfacePosition(surface: Surface) {
  const coordinates = surface.coordinates
  const elevation = surface.elevation
  const holeIndexes = []
  let index = 0
  for (let i = 0; i < coordinates.length - 1; i++) {
    index += coordinates[i].length
    holeIndexes.push(index)
  }

  const points = coordinates.flat()
  const flatPoints: number[] = points.flat()
  const indices = earcut(flatPoints, holeIndexes)

  const position = new Float32Array(indices.length * 3)
  for (let i = 0; i < indices.length; i++) {
    position[i * 3] = points[indices[i]][0]
    position[i * 3 + 1] = points[indices[i]][1]
    position[i * 3 + 2] = elevation
  }
  return position
}

function getUnitNormalVector(p0: number[], p1: number[]) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const length = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
  return [(y0 - y1) / length, (x1 - x0) / length]
}

function concatTypedArrays(arrays: any[]) {
  const totalLength = arrays.reduce((acc, array) => acc + array.length, 0)
  const result = new Float32Array(totalLength)
  let offset = 0
  arrays.forEach((array) => {
    result.set(array, offset)
    offset += array.length
  })
  return result
}

export function buildAnalysisBuildingGeo(analysisBuildings: AnalysisBuilding[]) {
  const positionsList: Float32Array[] = []
  const normalsList: Float32Array[] = []
  const colorsList: Uint8Array[] = []
  analysisBuildings.forEach((building) => {
    building.bottoms.forEach((bottom) => {
      const positionReverse = createSurfacePosition(bottom)
      const position = new Float32Array(positionReverse.length)
      for (let i = 0; i < positionReverse.length / 3; i++) {
        const j = positionReverse.length / 3 - i - 1
        position[i * 3] = positionReverse[j * 3]
        position[i * 3 + 1] = positionReverse[j * 3 + 1]
        position[i * 3 + 2] = positionReverse[j * 3 + 2]
      }
      positionsList.push(position)
      const normal = new Float32Array(position.length)
      for (let i = 0; i < position.length / 3; i++) {
        normal[i * 3] = 0
        normal[i * 3 + 1] = 0
        normal[i * 3 + 2] = -1
      }
      normalsList.push(normal)
      const color = new Uint8Array(position.length)
      for (let i = 0; i < position.length / 3; i++) {
        color[i * 3] = 255
        color[i * 3 + 1] = 0
        color[i * 3 + 2] = 0
      }
      colorsList.push(color)
    })

    building.roofs.forEach((roof) => {
      const position = createSurfacePosition(roof)
      positionsList.push(position)
      const normal = new Float32Array(position.length)
      for (let i = 0; i < position.length / 3; i++) {
        normal[i * 3] = 0
        normal[i * 3 + 1] = 0
        normal[i * 3 + 2] = 1
      }
      normalsList.push(normal)
      const color = new Uint8Array(position.length)
      for (let i = 0; i < position.length / 3; i++) {
        color[i * 3] = 0
        color[i * 3 + 1] = 255
        color[i * 3 + 2] = 0
      }
      colorsList.push(color)
    })
    const wallPosition: number[] = []
    const wallNormal: number[] = []
    let height = 0
    building.floors.forEach((floor) => {
      floor.walls.forEach((wall) => {
        wallPosition.push(
          ...wall.startPoint,
          height,
          ...wall.endPoint,
          height + floor.height,
          ...wall.startPoint,
          height + floor.height,

          ...wall.startPoint,
          height,
          ...wall.endPoint,
          height,
          ...wall.endPoint,
          height + floor.height,
        )
        const normal = getUnitNormalVector(wall.startPoint, wall.endPoint)
        wallNormal.push(
          ...normal,
          0,
          ...normal,
          0,
          ...normal,
          0,

          ...normal,
          0,
          ...normal,
          0,
          ...normal,
          0,
        )
      })
      height += floor.height
    })
    positionsList.push(new Float32Array(wallPosition))
    normalsList.push(new Float32Array(wallNormal))
    const color = new Uint8Array(wallPosition.length)
    for (let i = 0; i < wallPosition.length / 3; i++) {
      color[i * 3] = 0
      color[i * 3 + 1] = 0
      color[i * 3 + 2] = 255
    }
    colorsList.push(color)
  })

  concatTypedArrays(positionsList)
  const position = Float32Concat(positionsList)
  const normal = Float32Concat(normalsList)
  const color = Uint8Concat(colorsList)

  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(position, 3))
  geometry.setAttribute("normal", new BufferAttribute(normal, 3, false))
  geometry.setAttribute("color", new BufferAttribute(color, 3, true))
  return geometry
}
