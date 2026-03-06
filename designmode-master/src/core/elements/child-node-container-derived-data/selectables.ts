import type { BufferGeometry, Matrix4 } from "three"
import { BufferAttribute, DoubleSide, Mesh, MeshBasicMaterial } from "three"
import type { RaycastTarget, RaycastTarget2d, RaycastTarget3d } from "src/core/selection/raycasting"
import { edgesPositionFromBox3 } from "src/lib/three/geometryUtils"
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh"
import type { Selectable, SelectionMode } from "src/core/elements/element-container-derived-data/selectables"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { screenResolutionVector } from "src/core/three/sceneManager"
import type { TerrainShape } from "src/lib/element/types"
import { getOutlinesFromTerrainShape } from "src/core/selection/terrain-shape-outlines"
import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import { Line2 } from "three/addons/lines/Line2.js"
import { renderableFromTerrainShape } from "src/integrations/renderables/terrainShape"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { createParameterizedDerivedDataController } from "src/core/elements/derived-data/derived-data"
import type { Proposal } from "src/core/elements/Proposal"
import { getRegisteredElementSystem } from "src/core/element-systems"
import { parseUrn } from "src/lib/element/urn"
import {
  customSelectionTargetToSelectionPath,
  internalPathToSelectionPath,
  type SelectionPath,
} from "src/core/selection/selectionTypes"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import type { NewTerrainState } from "src/core/terrain/new-terrain-state"

export const selectablesController = createParameterizedDerivedDataController(selectablesForChildNode)

export type ChildNodeSelectable = {
  raycastTargets: RaycastTarget[]
  selectionOutlines: Float32Array[]

  selectionPath: SelectionPath
  context: "proposal" | "base"
}

// This is to make backfaces pickable.
const raycastMaterial = new MeshBasicMaterial({
  side: DoubleSide,
})

function buildRaycastTarget3dForGeometry(geometry: BufferGeometry, transform: Matrix4): RaycastTarget3d[] {
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  if (!geometry.computeBoundsTree) geometry.computeBoundsTree = computeBoundsTree
  if (!geometry.disposeBoundsTree) geometry.disposeBoundsTree = disposeBoundsTree
  if (!geometry.boundsTree) geometry.computeBoundsTree()
  const mesh = new Mesh(geometry, raycastMaterial)
  mesh.applyMatrix4(transform)
  mesh.updateMatrixWorld()
  mesh.raycast = acceleratedRaycast
  return [{ object3d: mesh, type: "3d" }]
}

export function buildOverlayTargetsForTerrainShape(terrainShape: TerrainShape, transform: Matrix4): RaycastTarget2d[] {
  const minimumRenderable2d = renderableFromTerrainShape(terrainShape, ROOT_KEY, transform)
  const result: RaycastTarget2d[] = []
  let z = 200
  for (const r of minimumRenderable2d) {
    const mesh = new Mesh(r.geometry)
    mesh.position.setZ(z)
    result.push({ object3d: mesh, type: "2d" })
    z -= 0.05
  }
  return result
}

// World units is needed to be able to raycast with a Raycaster which does not have camera (as linewidth is dependent on camera)
const ELEMENT_SHAPE_AS_3D_LINES_MATERIAL = new LineMaterial({ resolution: screenResolutionVector, worldUnits: true })

function buildTargets2dAs3dForOutlines(selectionOutlines2d: Float32Array): RaycastTarget3d[] {
  if (selectionOutlines2d.length <= 0) return []
  const geometry = new LineGeometry().setPositions(selectionOutlines2d)
  const object = new Line2(geometry, ELEMENT_SHAPE_AS_3D_LINES_MATERIAL)
  return [{ object3d: object, type: "3d" }]
}

function transformOutlineCoordinates(array: Float32Array, matrix: Matrix4): Float32Array {
  const clone = new Float32Array(array)
  new BufferAttribute(clone, 3).applyMatrix4(matrix)
  return clone
}

function selectableTargetToSelectionPath(target: Selectable["target"], node: ChildNodeContainer): SelectionPath {
  switch (target.type) {
    case "element":
      return internalPathToSelectionPath(target.subPath ? mergePath(node.path, target.subPath) : node.path)
    case "custom":
      return customSelectionTargetToSelectionPath(target.customSelection)
  }
}

function selectablesForChildNode(terrainSamplerData: TerrainSamplerData) {
  return function (node: ChildNodeContainer): {
    selectionMode: SelectionMode
    selectables: ChildNodeSelectable[]
  } {
    const { selectionMode, selectables: elementSelectables } = node.elementContainer.selectables.getOrCompute()
    const selectables = elementSelectables.map(({ target, selectable3d, selectable2d }): ChildNodeSelectable => {
      const selectionPath = selectableTargetToSelectionPath(target, node)
      const context = node.context
      const raycastTargets: RaycastTarget[] = []
      const selectionOutlines: Float32Array[] = []

      if (selectable3d) {
        const { hitbox, outlines } = selectable3d
        raycastTargets.push(...buildRaycastTarget3dForGeometry(hitbox, node.globalMatrix))
        if (outlines) {
          selectionOutlines.push(transformOutlineCoordinates(outlines, node.globalMatrix))
        } else {
          const bbox = node.bbox(terrainSamplerData).getOrCompute()
          if (bbox) selectionOutlines.push(edgesPositionFromBox3(bbox))
        }
      }
      if (selectable2d) {
        const { terrainShape } = selectable2d
        const { system } = parseUrn(node.elementContainer.element.urn)
        const elementSystem = getRegisteredElementSystem(system)

        const terrainShapeOutlines = getOutlinesFromTerrainShape(terrainShape, node.globalMatrix, terrainSamplerData)

        const customOutlines =
          elementSystem?.generateSelectionOutlines2d &&
          elementSystem?.generateSelectionOutlines2d(node.elementContainer, node.globalMatrix, terrainSamplerData)
        selectionOutlines.push(customOutlines || terrainShapeOutlines)

        raycastTargets.push(...buildOverlayTargetsForTerrainShape(terrainShape, node.globalMatrix))
        raycastTargets.push(...buildTargets2dAs3dForOutlines(terrainShapeOutlines))
      }

      return { selectionPath, context, raycastTargets, selectionOutlines }
    })

    return { selectionMode, selectables }
  }
}

export function getSelectablesForToplevelNode(
  node: ChildNodeContainer,
  proposal: Proposal,
  terrain: NewTerrainState,
): ChildNodeSelectable[] {
  const { selectionMode, selectables } = node.selectables(terrain.terrainSamplerData).getOrCompute()
  if (selectionMode == "custom-selectables-only") return selectables

  const wholeSubtreeSelectable: ChildNodeSelectable = {
    raycastTargets: [],
    selectionOutlines: [],

    selectionPath: internalPathToSelectionPath(node.path),
    context: node.context,
  }

  function recursivelyPopulateWholeSubtreeSelectable(childNode: ChildNodeContainer) {
    const { selectables } = childNode.selectables(terrain.terrainSamplerData).getOrCompute()
    wholeSubtreeSelectable.raycastTargets.push(...selectables.flatMap((s) => s.raycastTargets))
    wholeSubtreeSelectable.selectionOutlines.push(...selectables.flatMap((s) => s.selectionOutlines))
    proposal.snapshot.getChildrenOfNode(childNode).forEach(recursivelyPopulateWholeSubtreeSelectable)
  }

  recursivelyPopulateWholeSubtreeSelectable(node)

  return [wholeSubtreeSelectable]
}
