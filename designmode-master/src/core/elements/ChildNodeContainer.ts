import type { Child, Transform } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import { Matrix4 } from "three"
import type { ElementContainer } from "./ElementContainer"
import { bbox2Controller, bboxController } from "./child-node-container-derived-data/bbox"
import {
  bboxOctreeSnappingLinesController,
  snappingLinesController,
} from "./child-node-container-derived-data/snapping"
import { renderables3dController } from "./child-node-container-derived-data/renderables3d"
import { affineSnapInfoController } from "./child-node-container-derived-data/affineSnapInfo"
import { roofAndFloorTrianglesController } from "./child-node-container-derived-data/roofAndFloorTriangles"
import { renderables2dController } from "./child-node-container-derived-data/renderables2d"
import { selectablesController } from "./child-node-container-derived-data/selectables"
import { unitsController } from "./child-node-container-derived-data/units"
import { renderables3dForUnitsController } from "./child-node-container-derived-data/renderableUnits"
import { outlinesController, renderableForOutlinesController } from "./child-node-container-derived-data/outlines"
import { volumeMeshWithAcceleratedRaycastController } from "./child-node-container-derived-data/volumeMeshWithAcceleratedRaycast"
import { allRenderables3dController } from "./child-node-container-derived-data/renderables3d_V3"
import { scenarioHiddenSignal } from "src/core/hidden"
import { categoryStateSignal } from "src/core/categories"
import { pathStateSignal } from "src/core/paths"
import { NODE_PREDICATES } from "./predicates"
// eslint-disable-next-line import/no-restricted-paths
import { areaStatsSurfacesController } from "src/integrations/area-stats/derived-child-node-container"
import { DisposableStore } from "./derived-data/derived-data"
import { svgOutlinesController } from "./child-node-container-derived-data/svgOutlines"

export type RootContext = "proposal" | "base"

function childEquals(a: Child, b: Child): boolean {
  return a.urn === b.urn && a.key === b.key && a.name === b.name && transformEquals(a.transform, b.transform)
}

function transformEquals(a: Transform | undefined, b: Transform | undefined): boolean {
  if (a === b) return true
  if (!a && b) return false
  if (a && !b) return false
  if (a && b)
    return (
      a[0] === b[0] &&
      a[1] === b[1] &&
      a[2] === b[2] &&
      a[3] === b[3] &&
      a[4] === b[4] &&
      a[5] === b[5] &&
      a[6] === b[6] &&
      a[7] === b[7] &&
      a[8] === b[8] &&
      a[9] === b[9] &&
      a[10] === b[10] &&
      a[11] === b[11] &&
      a[12] === b[12] &&
      a[13] === b[13] &&
      a[14] === b[14] &&
      a[15] === b[15]
    )
  return true
}

export class ChildNodeContainer {
  readonly path: InternalPath
  readonly child: Child
  readonly elementContainer: ElementContainer
  readonly parentMatrix: Matrix4
  readonly context: RootContext

  readonly globalMatrix: Matrix4

  constructor(
    path: InternalPath,
    child: Child,
    container: ElementContainer,
    parentMatrix: Matrix4,
    context: RootContext,
  ) {
    this.path = path
    this.child = child
    this.elementContainer = container
    this.parentMatrix = parentMatrix
    this.context = context

    const localMatrixMutable = child.transform ? new Matrix4().fromArray(child.transform) : undefined
    this.globalMatrix = localMatrixMutable ? localMatrixMutable.premultiply(parentMatrix) : parentMatrix
  }

  canBeReused(
    path: InternalPath,
    child: Child,
    container: ElementContainer,
    parentMatrix: Matrix4,
    context: RootContext,
  ): boolean {
    const samePath = this.path === path
    const sameChild = childEquals(this.child, child)
    const sameElementContainers = this.elementContainer === container
    const sameParentMatrix = this.parentMatrix.equals(parentMatrix)
    const sameContext = this.context === context

    return samePath && sameChild && sameElementContainers && sameParentMatrix && sameContext
  }

  equals(other: ChildNodeContainer): boolean {
    return other.canBeReused(this.path, this.child, this.elementContainer, this.parentMatrix, this.context)
  }

  readonly derivedDataDisposables = new DisposableStore()

  readonly renderables3d = renderables3dController(this)
  readonly renderables2d = renderables2dController(this)
  readonly bbox = bboxController(this)
  readonly bbox2 = bbox2Controller(this)
  readonly snappingLines = snappingLinesController(this)
  readonly bboxOctreeSnappingLines = bboxOctreeSnappingLinesController(this)

  readonly affineSnapInfo = affineSnapInfoController(this)
  readonly roofAndFloorTriangles = roofAndFloorTrianglesController(this)
  readonly selectables = selectablesController(this)
  readonly units = unitsController(this)
  readonly renderables3dForUnits = renderables3dForUnitsController(this)

  readonly outlines = outlinesController(this)
  readonly renderableForOutlines = renderableForOutlinesController(this)
  readonly svgOutlines = svgOutlinesController(this)

  readonly volumeMeshWithAcceleratedRaycast = volumeMeshWithAcceleratedRaycastController(this)

  // New rendering
  readonly allRenderables3d = allRenderables3dController(this)

  readonly areaStatsSurfaces = areaStatsSurfacesController(this)

  get isInBase() {
    return this.context === "base"
  }

  get urn() {
    return this.elementContainer.element.urn
  }

  get element() {
    return this.elementContainer.element
  }

  getIsHiddenReactive() {
    return !NODE_PREDICATES.allOf(
      NODE_PREDICATES.isScenarioVisibleForScenarioNode(scenarioHiddenSignal.value),
      NODE_PREDICATES.isInVisibleCategory(categoryStateSignal.value),
      NODE_PREDICATES.isNotHiddenPath(pathStateSignal.value),
    )(this)
  }

  getIsHiddenPeek() {
    return !NODE_PREDICATES.allOf(
      NODE_PREDICATES.isScenarioVisibleForScenarioNode(scenarioHiddenSignal.peek()),
      NODE_PREDICATES.isInVisibleCategory(categoryStateSignal.peek()),
      NODE_PREDICATES.isNotHiddenPath(pathStateSignal.peek()),
    )(this)
  }

  getIsLockedReactive() {
    return !NODE_PREDICATES.allOf(
      NODE_PREDICATES.isNotLockedCategory(categoryStateSignal.value, false),
      NODE_PREDICATES.isNotLockedPath(pathStateSignal.value),
    )(this)
  }
}
