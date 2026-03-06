import { Vector3 } from "three"
import { seededRandomNumberGenerator } from "src/integrations/basic-elements/trees/math"
import { geometry } from "@turf/helpers"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import type { Polygon } from "geojson"

const jitter = new Vector3()

function jitteredGrid(sizeX: number, sizeY: number, avgSpacing: number): [number, number, number][] {
  const treeIndexGenerator = seededRandomNumberGenerator(0x9e3779b9, 0x243f6a88, 0xb7e15162, 1337)
  const nextTreeIndex = () => Math.floor(treeIndexGenerator() * 1000)

  const distanceBetweenPoints = avgSpacing

  const jitterDistance = distanceBetweenPoints * 0.2
  let points: [number, number, number][] = []
  for (let x = 0; x < sizeX; x += distanceBetweenPoints) {
    for (let y = 0; y < sizeY; y += distanceBetweenPoints) {
      let offsetAngleRadians = (Math.sin(0.1 * (x + y) * (x / sizeX) + 0.1 * (x + y) * (y / sizeY)) * Math.PI) / 2
      jitter.setFromCylindricalCoords(jitterDistance, offsetAngleRadians, 0)
      points.push([x + jitter.x, y + jitter.z, nextTreeIndex()])
    }
  }
  return points
}

export function makeAreaPositionField(verts: { x: number; y: number }[], avgSpacing: number) {
  const minX = Math.min(...verts.map((v) => v.x))
  const minY = Math.min(...verts.map((v) => v.y))
  const maxX = Math.max(...verts.map((v) => v.x))
  const maxY = Math.max(...verts.map((v) => v.y))

  const vertices: [number, number][] = verts.map((v) => [v.x, v.y] as [number, number])
  if (vertices[0][0] !== vertices[vertices.length - 1][0] || vertices[0][1] !== vertices[vertices.length - 1][1]) {
    vertices.push(vertices[0])
  }
  const polygon = geometry("Polygon", [vertices]) as Polygon

  let generatedPoints = jitteredGrid(Math.ceil(maxX - minX), Math.ceil(maxY - minY), avgSpacing)

  return generatedPoints
    .map(([x, y, treeSeed]) => [x + minX, y + minY, treeSeed])
    .filter(([x, y]) => booleanPointInPolygon([x, y], polygon))
    .map(([x, y, treeSeed]) => ({
      x,
      y,
      treeSeed,
    }))
}
