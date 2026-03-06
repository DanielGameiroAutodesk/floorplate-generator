import type { Buffer, Document } from "@gltf-transform/core"
import { Accessor } from "@gltf-transform/core"
import { Matrix4 } from "three"
export const zUpToYUp = new Matrix4().makeRotationX(-Math.PI / 2)
export const buildNodeVertexColors = (
  doc: Document,
  buffer: Buffer,
  name: string,
  positions: Float32Array,
  colors: Float32Array,
) => {
  const position = doc.createAccessor().setArray(positions).setType(Accessor.Type.VEC3).setBuffer(buffer)
  const material = doc.createMaterial()
  const primitive = doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute("POSITION", position)
    .setAttribute("COLOR_0", doc.createAccessor().setArray(colors).setType(Accessor.Type.VEC3).setBuffer(buffer))

  const mesh = doc.createMesh(name).addPrimitive(primitive)

  const node = doc.createNode(name).setMesh(mesh)
  return node
}
