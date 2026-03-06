import { Document, NodeIO, VertexLayout } from "@gltf-transform/core"
import type { RowHouseParameters } from "./api"
import { rowHouseApi } from "./api"
import { PROJECT_ID } from "src/core/project/project"

const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE)
export const generateSemanticMesh = async (rowHouseParameters: RowHouseParameters) => {
  const { surfaces } = rowHouseApi.generateRowHouse(rowHouseParameters, PROJECT_ID)
  const doc = new Document()
  const buffer = doc.createBuffer()
  const buildingNode = doc.createNode("building")
  const roofNode = doc.createNode("roofs")
  const wallNode = doc.createNode("walls")
  for (let i = 0; i < surfaces.roofs.length; i++) {
    const roofSurface = surfaces.roofs[i]
    const positionAccessor = doc.createAccessor().setType("VEC3").setArray(roofSurface.position).setBuffer(buffer)
    const normalAccessor = doc.createAccessor().setType("VEC3").setArray(roofSurface.normal).setBuffer(buffer)
    const mesh = doc.createMesh()
    const primitive = doc
      .createPrimitive()
      .setAttribute("POSITION", positionAccessor)
      .setAttribute("NORMAL", normalAccessor)
    mesh.addPrimitive(primitive)
    const node = doc.createNode(`roof${i}`).setMesh(mesh)
    node.setExtras({ geometryType: "roof" })
    node.setMatrix([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]) // Z-up to Y-up
    roofNode.addChild(node)
  }

  for (let i = 0; i < surfaces.walls.length; i++) {
    const wallSurface = surfaces.walls[i]
    const positionAccessor = doc.createAccessor().setType("VEC3").setArray(wallSurface.position).setBuffer(buffer)
    const normalAccessor = doc.createAccessor().setType("VEC3").setArray(wallSurface.normal).setBuffer(buffer)
    const mesh = doc.createMesh()
    const primitive = doc
      .createPrimitive()
      .setAttribute("POSITION", positionAccessor)
      .setAttribute("NORMAL", normalAccessor)
    mesh.addPrimitive(primitive)
    const node = doc.createNode(`wall${i}`).setMesh(mesh)
    node.setExtras({ geometryType: "wall" })
    node.setMatrix([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]) // Z-up to Y-up
    wallNode.addChild(node)
  }
  const scene = doc.createScene("defaultScene")
  buildingNode.addChild(roofNode)
  buildingNode.addChild(wallNode)
  scene.addChild(buildingNode)

  return io.writeBinary(doc)
}
