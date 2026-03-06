import type { Matrix4 } from "three"
import { BufferGeometry, Color, Mesh, MeshLambertMaterial } from "three"
import { isDefined } from "src/lib/array"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { InternalPath } from "src/lib/element/path"
import { expandPathSetToIncludeDescendants } from "src/lib/element/path"
import type { Urn } from "@spacemakerai/element-types"
import { getWorldMatrix } from "src/lib/element/transform"
import sceneManager from "src/core/three/sceneManager"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { assertIsDefined } from "src/lib/assertions"

const material = new MeshLambertMaterial({
  color: new Color("#0696D7"),
  polygonOffset: true,
  transparent: true,
  opacity: 0.2,
  polygonOffsetFactor: -0.5,
  polygonOffsetUnits: 0,
  depthWrite: false,
  premultipliedAlpha: true,
})

export class HighlightMesh extends Mesh {
  constructor() {
    const geo = new BufferGeometry()
    super(geo, material)
  }

  update(geos: { geo: BufferGeometry; matrix: Matrix4 | undefined }[]) {
    if (geos.length === 0) {
      this.geometry.dispose()
      this.geometry = new BufferGeometry()
      sceneManager.render()
      return
    }
    const applied = geos.map(({ geo, matrix }) => (isDefined(matrix) ? geo.clone().applyMatrix4(matrix) : geo))
    const merged = mergeGeometries(applied)
    this.geometry.copy(merged)
    sceneManager.render()
  }
}

export function getHighlightFillForPaths(
  paths: Set<InternalPath>,
  rootUrn: Urn,
  elements: FormaElementLookup,
  geometries: Map<Urn, BufferGeometry>,
  pathToUrn: Map<InternalPath, Urn>,
  options?: { ignore: Set<InternalPath> } | { include: Set<InternalPath> },
): { geo: BufferGeometry; matrix: Matrix4 | undefined }[] {
  const geos: { geo: BufferGeometry; matrix: Matrix4 | undefined }[] = []
  const allRelevantPaths =
    paths.size === 0 ? paths : expandPathSetToIncludeDescendants(paths, new Set(pathToUrn.keys()))
  allRelevantPaths.forEach((path) => {
    if (options && "ignore" in options && options.ignore.has(path)) return
    if (options && "include" in options && !options.include.has(path)) return
    const urn = assertIsDefined("Path should exist", pathToUrn.get(path))
    const volumeMesh = geometries.get(urn)
    if (!volumeMesh) return
    const matrix = getWorldMatrix(path, rootUrn, elements)
    geos.push({ geo: volumeMesh, matrix })
  })
  return geos
}
