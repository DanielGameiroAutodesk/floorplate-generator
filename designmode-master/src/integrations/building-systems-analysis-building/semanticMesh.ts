import type { AnalysisBuilding, Wall } from "./types"
import type { Buffer } from "@gltf-transform/core"
import { Document, NodeIO, VertexLayout, Accessor } from "@gltf-transform/core"
import { createSurfacePosition } from "./utils"
import { getUnitNormalVector } from "src/integrations/building-systems-common/geometryHelpers"

function repeatNormal(position: Float32Array, normal: [number, number, number]) {
  const result = new Float32Array(position.length)
  for (let i = 0; i < position.length / 3; i++) {
    result[i * 3] = normal[0]
    result[i * 3 + 1] = normal[1]
    result[i * 3 + 2] = normal[2]
  }
  return result
}

function createNodeForAllRoofs(doc: Document, buffer: Buffer, buildingIdx: number, building: AnalysisBuilding) {
  const roofNode = doc.createNode(`building_${buildingIdx}_roofs`)

  for (const [roofIdx, roofSurface] of building.roofs.entries()) {
    const position = createSurfacePosition(roofSurface)
    const normal = repeatNormal(position, [0, 0, 1])

    const positionAccessor = doc.createAccessor().setType("VEC3").setArray(position).setBuffer(buffer)
    const normalAccessor = doc.createAccessor().setType("VEC3").setArray(normal).setBuffer(buffer)
    const primitive = doc
      .createPrimitive()
      .setAttribute("POSITION", positionAccessor)
      .setAttribute("NORMAL", normalAccessor)

    const mesh = doc.createMesh().addPrimitive(primitive)

    const node = doc
      .createNode(`building_${buildingIdx}_roof_${roofIdx}`)
      .setMesh(mesh)
      .setExtras({ geometryType: "roof" })
    roofNode.addChild(node)
  }

  return roofNode
}

function createWallPositionAndNormalArray(wall: Wall, floorHeight: number, elevation: number) {
  const position = [
    // First triangle.
    ...wall.startPoint,
    elevation,
    ...wall.endPoint,
    elevation + floorHeight,
    ...wall.startPoint,
    elevation + floorHeight,

    // Second triangle.
    ...wall.startPoint,
    elevation,
    ...wall.endPoint,
    elevation,
    ...wall.endPoint,
    elevation + floorHeight,
  ]

  const normalVector = getUnitNormalVector(wall.startPoint, wall.endPoint)
  const normal = [
    // First triangle.
    ...normalVector,
    0,
    ...normalVector,
    0,
    ...normalVector,
    0,

    // Second triangle.
    ...normalVector,
    0,
    ...normalVector,
    0,
    ...normalVector,
    0,
  ]

  return { position, normal }
}

function createNodeForAllWalls(doc: Document, buffer: Buffer, buildingIdx: number, building: AnalysisBuilding) {
  const floorsNode = doc.createNode(`building_${buildingIdx}_floors`)

  let elevation = 0

  for (const [floorIdx, floor] of building.floors.entries()) {
    const floorWallsNode = doc.createNode(`building_${buildingIdx}_floor_${floorIdx}_walls`)
    floorsNode.addChild(floorWallsNode)

    for (const [wallIdx, wall] of floor.walls.entries()) {
      const { position, normal } = createWallPositionAndNormalArray(wall, floor.height, elevation)

      const positionAccessor = doc
        .createAccessor()
        .setType(Accessor.Type.VEC3)
        .setArray(new Float32Array(position))
        .setBuffer(buffer)
      const normalAccessor = doc
        .createAccessor()
        .setType(Accessor.Type.VEC3)
        .setArray(new Float32Array(normal))
        .setBuffer(buffer)
      const primitive = doc
        .createPrimitive()
        .setAttribute("POSITION", positionAccessor)
        .setAttribute("NORMAL", normalAccessor)

      const mesh = doc.createMesh().addPrimitive(primitive)

      const node = doc
        .createNode(`building_${buildingIdx}_floor_${floorIdx}_wall_${wallIdx}`)
        .setMesh(mesh)
        .setExtras({ geometryType: "wall" })
      floorWallsNode.addChild(node)
    }

    elevation += floor.height
  }

  return floorsNode
}

export function createAnalysisBuildingsSemanticMeshGlb(analysisBuildings: AnalysisBuilding[]) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene("defaultScene")

  for (const [buildingIdx, building] of analysisBuildings.entries()) {
    const buildingNode = doc.createNode(`building_${buildingIdx}`)
    buildingNode.setMatrix([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]) // Z-up to Y-up
    buildingNode.addChild(createNodeForAllRoofs(doc, buffer, buildingIdx, building))
    buildingNode.addChild(createNodeForAllWalls(doc, buffer, buildingIdx, building))
    scene.addChild(buildingNode)
  }

  return new NodeIO().setVertexLayout(VertexLayout.SEPARATE).writeBinary(doc)
}
