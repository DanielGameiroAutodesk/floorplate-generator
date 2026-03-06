import { Document, NodeIO, VertexLayout } from "@gltf-transform/core"
import { elementState } from "src/core/elements/ElementState"
import { type BufferGeometry, Matrix4, Mesh } from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { buildNodeVertexColors } from "src/integrations/parametric-element-system/gltf"
import type { InternalPath } from "src/lib/element/path"

// Inventory IDs cannot contain "/" as GLB tools and other systems may strip or reject this character.
// We use "|" as a delimiter instead, which is safe for inventory IDs across all representations.
const INVENTORY_PATH_DELIMITER = "|"

/**
 * Encodes an InternalPath for use as an inventory ID by replacing "/" with "|"
 */
export function encodePathForInventory(path: InternalPath): string {
  return path.replaceAll("/", INVENTORY_PATH_DELIMITER)
}

type NodeGeometry = {
  path: InternalPath
  geometry: BufferGeometry
}

async function generateGlb(nodeGeometries: NodeGeometry[]) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene()

  // Convert from Z-up to Y-up coordinate system
  // Rotate -90 degrees around X-axis to convert Z-up to Y-up
  const zUpToYUpMatrix = new Matrix4().makeRotationX(-Math.PI / 2)

  for (const { path, geometry } of nodeGeometries) {
    // Apply Y-up transformation to the geometry
    const transformedGeometry = geometry.clone()
    transformedGeometry.applyMatrix4(zUpToYUpMatrix)

    const positions = new Float32Array(transformedGeometry.attributes.position.array)
    const colors = new Float32Array(transformedGeometry.attributes.color.array)
    colors.forEach((value, index, array) => {
      array[index] = value / 255
    })

    // Use the encoded path as the node/mesh name for identification
    // "/" is replaced with "|" to avoid issues with GLB tools
    const nodeName = encodePathForInventory(path)
    const node = buildNodeVertexColors(doc, buffer, nodeName, positions, colors)
    scene.addChild(node)
  }

  return await new NodeIO().setVertexLayout(VertexLayout.SEPARATE).writeBinary(doc)
}

export type SiteDesignModelGlbResult = {
  glb: Uint8Array
  inventory: InternalPath[]
}

export const getSiteDesignModelGlb = async (): Promise<SiteDesignModelGlbResult | undefined> => {
  const currentSnapshot = elementState.currentSnapshot.peek()

  const nodeGeometries: NodeGeometry[] = []
  for (const [path, node] of currentSnapshot.nodes.entries()) {
    const matrix = node.globalMatrix
    const container = node.elementContainer

    const volumeMesh = container.representations.volumeMesh
    if (volumeMesh) {
      const geometry = volumeMesh.clone()
      geometry.applyMatrix4(matrix)
      nodeGeometries.push({ path, geometry })
    }
  }

  if (nodeGeometries.length === 0) {
    return undefined
  }

  const glb = await generateGlb(nodeGeometries)
  const inventory = nodeGeometries.map((ng) => ng.path)

  return { glb, inventory }
}

export async function generateTerrainGlb(bufferGeometry: BufferGeometry) {
  const glb: ArrayBuffer = await new Promise((resolve, reject) => {
    const exportmesh = new Mesh(bufferGeometry.clone())
    exportmesh.geometry.rotateX(-Math.PI / 2)
    new GLTFExporter().parse(exportmesh, (res) => resolve(res as ArrayBuffer), reject, { binary: true })
  })
  return glb
}
