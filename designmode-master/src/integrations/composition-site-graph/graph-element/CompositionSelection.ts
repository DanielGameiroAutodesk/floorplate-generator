import type { CompositionElement } from "./types"
import type { InternalPath } from "src/lib/element/path"
import { mergePath } from "src/lib/element/path"
import { traverseDepthFirstIterableWithCallback } from "src/lib/element/traverseUtils"
import type { VolumeMesh } from "src/core/volume-mesh"
import { getVolumeMeshWithTerrainFallback } from "src/core/volume-mesh"
import type { Object3D } from "three"
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from "three"
import sceneManager from "src/core/three/sceneManager"
import { signal } from "@preact/signals"
import { calculateEdgesGeometry } from "src/lib/three/geometryUtils"
import { isDefined } from "src/lib/array"
import SelectionOutlines from "./SelectionOutlines"
import { dispose } from "src/core/three/useObjectLifecycle"
import { SelectionToolController } from "src/integrations/tools-common/Selection/SelectionToolController"
import type { ParcelCompositionElement } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { isParcelComposition } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { getOutlinesFromTerrainShape } from "src/core/selection/terrain-shape-outlines"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import type { RaycastData } from "src/core/selection/raycasting"
import type { Proposal } from "src/core/elements/Proposal"
import type { Urn } from "forma-elements"
import { internalPathToSelectionPath, type SelectionPath } from "src/core/selection/selectionTypes"

const RAYCAST_MATERIAL = new MeshBasicMaterial({ color: "red", visible: false })

function volumeMeshToHitbox(volumeMesh: VolumeMesh) {
  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(volumeMesh.position, 3))
  if (volumeMesh.index) geo.setAttribute("index", new BufferAttribute(volumeMesh.index, 3))

  return new Mesh(geo, RAYCAST_MATERIAL)
}

function getHitMeshes(element: CompositionElement, path: InternalPath, proposal: Proposal) {
  return (
    element.children?.reduce<Record<SelectionPath, Object3D[]>>((prev, curr) => {
      // ParcelComposition
      let objects: Object3D[] = []
      const childPath = mergePath(path, curr.key)

      for (let [, path, element] of traverseDepthFirstIterableWithCallback(
        curr.urn,
        (urn: Urn) => proposal.snapshot.getFormaElement(urn),
        childPath,
      )) {
        const node = proposal.snapshot.getNodeOrThrow(path)
        const volumeMesh = getVolumeMeshWithTerrainFallback(proposal, element.urn)

        if (!volumeMesh) continue
        const object = volumeMeshToHitbox(volumeMesh)

        object.applyMatrix4(node.globalMatrix)
        objects.push(object)
      }

      prev[internalPathToSelectionPath(curr.key)] = objects
      return prev
    }, {}) ?? {}
  )
}

function getOutlinesForParcel(
  element: ParcelCompositionElement,
  path: InternalPath,
  proposal: Proposal,
  terrainSamplerData: TerrainSamplerData,
): Float32Array | undefined {
  const allArrays = (element.children ?? [])
    .flatMap<Float32Array | undefined>((child) => {
      const childPath = mergePath(path, child.key)
      const childNode = proposal.snapshot.getNode(childPath)
      if (!childNode) return undefined
      const terrainShape = childNode.elementContainer.representations.terrainShape
      const transform = childNode.globalMatrix
      return terrainShape ? getOutlinesFromTerrainShape(terrainShape, transform, terrainSamplerData) : undefined
    })
    .filter(isDefined)

  const length = allArrays.reduce((sum, curr) => sum + curr.length, 0)

  if (length === 0) return undefined

  const combined = new Float32Array(length)
  let offset = 0
  for (const a of allArrays) {
    combined.set(a, offset)
    offset += a.length
  }
  return combined
}

function outlinesFromMeshes(meshes: Record<SelectionPath, Object3D[]>): Record<SelectionPath, Float32Array> {
  return Object.fromEntries(
    Object.entries(meshes)
      .map(([id, objects]) => {
        const firstObject = objects[0]
        if (!(firstObject instanceof Mesh)) return undefined
        const edges = calculateEdgesGeometry(firstObject.geometry, firstObject.matrix)
        if (!edges) return undefined
        return [id, edges]
      })
      .filter(isDefined),
  )
}

const outlines = SelectionOutlines.createOutlines()
const outlinesGroup = new Group()
outlinesGroup.name = "rowhouses-outlines"

//TODO: remove hitmesh entirely
const hitMeshGroup = new Group()
hitMeshGroup.name = "rowhouses-hitmesh"

const meshesSignal = signal<Record<SelectionPath, Object3D[]>>({})
const selectionSignal = signal<Set<SelectionPath>>(new Set())
const hoverSignal = signal<Set<SelectionPath>>(new Set())

const doubleClickOutsideCallbackSignal = signal<(() => void) | undefined>(undefined)

function onHover(ids: Set<SelectionPath>) {
  hoverSignal.value = new Set(ids)
  outlines.setSelection(selectionSignal.peek(), hoverSignal.peek())
}

function onSelect(ids: Set<SelectionPath>) {
  selectionSignal.value = new Set(ids)
  outlines.setSelection(selectionSignal.peek(), hoverSignal.peek())
}

function onDoubleClick(id: string | undefined) {
  if (!isDefined(id) && doubleClickOutsideCallbackSignal.peek()) {
    doubleClickOutsideCallbackSignal.peek()!()
  }
}

const selectionTool = new SelectionToolController(onHover, onSelect, onDoubleClick)

selectionSignal.subscribe((val) => selectionTool.updateCurrentSelection(val))
hoverSignal.subscribe((val) => selectionTool.updateCurrectHover(val))

function start(onDoubleClickOutside: () => void) {
  selectionSignal.value = new Set()
  hoverSignal.value = new Set()
  doubleClickOutsideCallbackSignal.value = onDoubleClickOutside

  sceneManager.scene.add(outlinesGroup)
  sceneManager.scene.add(hitMeshGroup)

  outlinesGroup.add(outlines.meshSignal.peek())

  selectionTool.start()
}

function update(
  element: CompositionElement,
  path: InternalPath,
  proposal: Proposal,
  terrainSamplerData: TerrainSamplerData,
) {
  meshesSignal.value = getHitMeshes(element, path, proposal)

  const meshOutlines = outlinesFromMeshes(meshesSignal.peek())

  const allOutlines = Object.fromEntries(
    Object.entries(meshOutlines).map(([key, array]) => {
      const child = element.children?.find((child) => child.key === key)
      if (!child) return [key, array]
      const childElement = proposal.snapshot.getNode(child.urn)?.element
      if (!isParcelComposition(childElement)) return [key, array]

      const parcelOutlines = getOutlinesForParcel(
        childElement,
        mergePath(path, child.key),
        proposal,
        terrainSamplerData,
      )
      if (!parcelOutlines) return [key, array]

      const length = array.length + parcelOutlines.length
      const combined = new Float32Array(length)
      combined.set(array)
      combined.set(parcelOutlines, array.length)

      return [key, combined]
    }),
  )

  outlines.setGeometry(allOutlines)
  outlines.setSelection(selectionSignal.peek(), hoverSignal.peek())

  for (let i = hitMeshGroup.children.length - 1; i >= 0; i--) {
    const child = hitMeshGroup.children.pop()
    if (child) {
      dispose(child)
    }
  }

  hitMeshGroup.add(...Object.values(meshesSignal.peek()).flat())

  selectionTool.updateRaycastTargets(
    new Map(
      Object.entries(meshesSignal.peek()).flatMap(([selectionPath, objects]) =>
        objects.map((object): [Object3D, RaycastData] => [
          object,
          { raycastType: "3d", selection: selectionPath as SelectionPath },
        ]),
      ),
    ),
  )
}

function setActive(active: boolean) {
  outlinesGroup.visible = active
}

function exit() {
  sceneManager.scene.remove(outlinesGroup)
  dispose(outlinesGroup)
  selectionTool.exit()
  selectionSignal.value = new Set()
  hoverSignal.value = new Set()
}

export default {
  start,
  exit,
  update,
  setActive,
  selectionSignal,
  hoverSignal,
}
