import { LineSegmentsGeometry, LineSegments2 } from "three/examples/jsm/Addons.js"
import { extractMeshCutLines, extractMeshHorizontalCutLines } from "./utilities/extractCutGeometries"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import { CENTER, MeshBVH } from "three-mesh-bvh"
import * as THREE from "three"
import { cutElementMaterial } from "./utilities/cutMaterials"
import { computed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { Matrix3, Matrix4 } from "three"
import { sectionBoxRenderAPI } from "./utilities/sectionBoxRenderer"
import { HiddenPaths } from "src/core/hidden"

export type ElementWithBVH = {
  bvh: MeshBVH
  globalTransform: THREE.Matrix4
  path: string
}
const PRECISION = 0.000001

type Path = string
type MeshBVHMap = Map<Path, ElementWithBVH>

/**
 * This signal returns a map of elements with their BVH and global transform.
 * Note that this includes computationally expensive operations as a new bvh is created for each element.
 * If a given element is particularly large, this will block the thread for a noticeable amount of time.
 * Only use this signal within a callback that is not time-sensitive and do not subscribe to it in a render component.
 */
export const elementsBVHSignal = computed<MeshBVHMap>(() => {
  const currentSnapshot = elementState.currentSnapshot.value
  const elementsWithBvh: MeshBVHMap = new Map<Path, ElementWithBVH>()
  currentSnapshot.nodes.forEach((node) => {
    if (!node) return
    let bvh = node.elementContainer.representations.volumeMesh?.boundsTree
    let globalTransform = node.globalMatrix.clone()
    const rotationOnly = new Matrix3(
      globalTransform.elements[0],
      globalTransform.elements[4],
      globalTransform.elements[8],
      globalTransform.elements[1],
      globalTransform.elements[5],
      globalTransform.elements[9],
      globalTransform.elements[2],
      globalTransform.elements[6],
      globalTransform.elements[10],
    )
    const transformsZAxis =
      new THREE.Vector3(0, 0, 1)
        .applyMatrix3(rotationOnly)
        .sub(new THREE.Vector3(0, 0, 1))
        .length() > PRECISION
    if (transformsZAxis || !bvh) {
      const bufferGeo = node.elementContainer.representations.volumeMesh?.clone()
      if (!bufferGeo) return
      if (transformsZAxis) {
        bufferGeo?.applyMatrix4(globalTransform)
        globalTransform = new Matrix4() // Pass the identity matrix because we have actually transformed into world coordinates
      }
      bvh = new MeshBVH(bufferGeo, { maxLeafTris: 10, maxDepth: 40, strategy: CENTER })
    }
    const elementWithBvh = { bvh, globalTransform, path: node.path }
    elementsWithBvh.set(node.path, elementWithBvh)
  })

  return elementsWithBvh
})

export const createSectionCutLineForMeshes = (
  sectionBoxAsFeature: ExtrudedPolygonFeature | undefined,
  elementsWithBVH: ElementWithBVH[],
  hiddenPaths?: Set<string>,
) => {
  if (!sectionBoxAsFeature) return
  const [x1, y1] = sectionBoxAsFeature.geometry.coordinates[0][0]
  const [x2, y2] = sectionBoxAsFeature.geometry.coordinates[0][1]
  const [x3, y3] = sectionBoxAsFeature.geometry.coordinates[0][2]
  const [x4, y4] = sectionBoxAsFeature.geometry.coordinates[0][3]
  const topElevation = sectionBoxAsFeature.properties.elevation + sectionBoxAsFeature.properties.height
  const lineSegments: THREE.Vector3[] = []
  elementsWithBVH.forEach((element) => {
    if (hiddenPaths && hiddenPaths.has(element.path)) return
    const inverseTransform = element.globalTransform.clone().invert()
    const transformedVec1 = new THREE.Vector3(x1, y1, sectionBoxAsFeature.properties.elevation).applyMatrix4(
      inverseTransform,
    )
    const transformedVec2 = new THREE.Vector3(x2, y2, sectionBoxAsFeature.properties.elevation).applyMatrix4(
      inverseTransform,
    )
    const transformedVec3 = new THREE.Vector3(x3, y3, sectionBoxAsFeature.properties.elevation).applyMatrix4(
      inverseTransform,
    )
    const transformedVec4 = new THREE.Vector3(x4, y4, sectionBoxAsFeature.properties.elevation).applyMatrix4(
      inverseTransform,
    )
    const transformedTop = new THREE.Vector3(0, 0, topElevation).applyMatrix4(inverseTransform).z
    const sideA = extractMeshCutLines(element.bvh, transformedVec1, transformedVec2, transformedTop, transformedVec1.z)
    const sideB = extractMeshCutLines(element.bvh, transformedVec2, transformedVec3, transformedTop, transformedVec1.z)
    const sideC = extractMeshCutLines(element.bvh, transformedVec3, transformedVec4, transformedTop, transformedVec1.z)
    const sideD = extractMeshCutLines(element.bvh, transformedVec4, transformedVec1, transformedTop, transformedVec1.z)
    const top = extractMeshHorizontalCutLines(element.bvh, transformedTop, [
      transformedVec1,
      transformedVec2,
      transformedVec3,
      transformedVec4,
    ])
    const transformedLineSegments = [...sideA, ...sideB, ...sideC, ...sideD, ...top]
      .flat()
      .map((vec) => vec.applyMatrix4(element.globalTransform))
    lineSegments.push(...transformedLineSegments)
  })

  const positionsArray: Float32Array = new Float32Array(lineSegments.map((point) => [point.x, point.y, point.z]).flat())
  const linesGeo = new LineSegmentsGeometry().setPositions(positionsArray)
  const mesh = new LineSegments2(linesGeo, cutElementMaterial)

  return { mesh, positionsArray }
}

export function SectionBoxMeshCutLine({ sectionBoxAsFeature }: { sectionBoxAsFeature: ExtrudedPolygonFeature }) {
  const elementsWithBVH = elementsBVHSignal.value

  const bvhs = Array.from(elementsWithBVH.values())
  const hiddenPaths = HiddenPaths.allHiddenPathsExpandedSignal.value
  const cutResult = createSectionCutLineForMeshes(sectionBoxAsFeature, bvhs, hiddenPaths)
  const lineSegments = cutResult?.mesh
  sectionBoxRenderAPI.useObjectLifecycle_TEMPORARY_FIX(lineSegments)

  return null
}
