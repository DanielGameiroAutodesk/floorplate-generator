import type { Object3D, Raycaster } from "three"
import { Line3, Vector3 } from "three"
import type { SnapInfo } from "./snappingEngine"
import { snap, snapToLockedLine } from "./snappingEngine"
import {
  currentSnapInfoSignal,
  lockedSnapLineSignal,
  selectedDerivedSnappingLinesSignal,
  setCurrentSnapInfoSignalValue,
  userDefinedSnapToGuidesSignal,
} from "./snappingPicker.state"
import type { SnappingLine } from "./snapping"
import { HiddenPaths } from "src/core/hidden"
import { BBoxOctree } from "src/lib/three/BBoxOctree/BBoxOctree"
import { SnappingIndicator } from "./SnappingIndicator"
import SnappingPicker from "./snapping-picker/SnappingPicker"
import { snappingLineFromEndpoints } from "./snappingEngineHelpers"
import { previewSetSignal } from "src/core/preview-element-state"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import { bboxOctreeSnappingLinesSignal } from "./bboxOctreeSnappingLines"
import { getRaycastableMeshesForVisibleNodesSignal } from "src/core/elements/child-node-container-derived-data/volumeMeshWithAcceleratedRaycast"
import { makeParallelAndOrthogonalSnappingLines } from "./makeParallelAndOrthogonalSnappingLines"
import type { InternalPath } from "src/lib/element/path"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

/**
 * Early attempt at extracting the snapping logic from the shape tool
 */
export interface SnappingAPI {
  /**
   * Given an input mousePosition, snap to:
   *  1. Snapping lines passed in
   *  2. Snapping lines from all elements in scene
   *  3. Derived snapping lines (parallel, orthogonal, etc)
   * @param mousePosition A raycaster describing the mouse position
   * @param derivedLinesStartReferencePoint If creating a tool where you place multiple points, pass in the last placed point to get derived snapping lines based on that point and the current position.
   * @param additionalSnappingLines Consumer-provided snapping lines to snap to
   * @param extraSnappingTargets Additional targets to raycast against, such as 3D objects not in the element tree
   * @param ignorePaths
   */
  snap(
    mousePosition: Raycaster,
    derivedLinesStartReferencePoint?: Vector3,
    additionalSnappingLines?: SnappingLine[],
    extraSnappingTargets?: Object3D[],
    ignorePaths?: InternalPath[],
  ): SnapInfo | undefined

  /**
   * Set the current snap info. This is used to visualize current snapping context and let you pick snapping lines
   * @param snapInfo
   */
  setSnapInfo(snapInfo: SnapInfo): void

  clearSnapInfo(): void

  /**
   * Visuals component to render snapping lines and points
   * @param snapInfo Output from `snap`
   */
  visualsComponent: () => JSX.Element

  snappingPicker: () => JSX.Element | null

  /**
   * Helper function to create a snapping line from a line segment. Can be used to create the snapping lines for the `additionalSnappingLines` parameter in `snapWithDerivedSnappingLines`
   * @param start Line segment start
   * @param end Line segment end
   * @param onTerrain Is this line meant to be on the terrain?
   */
  createSnappingLineFromLine(start: Vector3, end: Vector3, onTerrain?: boolean): SnappingLine
}

function calculateOctreeFromSnappingLines(currentShapeSnappingLines?: SnappingLine[]) {
  const currentShapeOctree = new BBoxOctree<SnappingLine>()
  currentShapeSnappingLines?.forEach((l) => {
    if (l.type !== "LINE") return
    l.segments.forEach((seg) => currentShapeOctree.set(seg.bbox, l))
  })
  return currentShapeOctree
}

//declared here to not memory leak
const line = new Line3()

function snapTerrainPositionToLockedLine(
  terrainPosition: Vector3,
  lockedSnapLine: SnappingLine,
): Omit<SnapInfo, "candidateLines"> {
  const vector = new Vector3()
  const lockedLinePos = line
    .set(lockedSnapLine.start, lockedSnapLine.end)
    .closestPointToPoint(terrainPosition, false, vector)
  return {
    position: lockedLinePos,
    orgSnappingPos: terrainPosition,
    type: lockedSnapLine.type,
    data: lockedSnapLine,
  }
}

export const snappingAPIStateful: SnappingAPI = {
  //TODO: Add other snapping lines that are added by tools such as DrawLine, either here or in the usage
  snap(
    mousePosition: Raycaster,
    derivedLinesStartReferencePoint?: Vector3,
    additionalSnappingLines?: SnappingLine[],
    extraSnappingTargets?: Object3D[],
    ignorePaths: InternalPath[] = [],
  ): SnapInfo | undefined {
    const terrainSamplerData = terrainSignal.peek().terrainSamplerData
    const hiddenPaths = HiddenPaths.hiddenPathsSignal.peek()
    const previewFilter = previewSetSignal.peek()
    const parallellAndOrthogonalLines: SnappingLine[] = derivedLinesStartReferencePoint
      ? makeParallelAndOrthogonalSnappingLines(
          selectedDerivedSnappingLinesSignal.peek(),
          derivedLinesStartReferencePoint,
          terrainSamplerData,
        )
      : []
    const currentShapeOctree = calculateOctreeFromSnappingLines(additionalSnappingLines)
    const lockedSnapLine = lockedSnapLineSignal.peek()
    const snapInfo = snap(
      mousePosition,
      getRaycastableMeshesForVisibleNodesSignal
        .peek()({ ignoreVirtualNodes: true })
        .concat(extraSnappingTargets || []),
      userDefinedSnapToGuidesSignal.peek()
        ? bboxOctreeSnappingLinesSignal.peek().concat([currentShapeOctree])
        : bboxOctreeSnappingLinesSignal.peek(),
      selectedDerivedSnappingLinesSignal.peek().concat(parallellAndOrthogonalLines),
      lockedSnapLine,
      undefined,
      terrainSamplerData,
      new Set([...hiddenPaths, ...previewFilter, ...ignorePaths]),
    )
    if (!lockedSnapLine) return snapInfo
    if (!snapInfo) {
      const terrainPos = raycastApi.raycastTerrain()?.position
      if (!terrainPos) return
      const terrainVector = new Vector3(terrainPos.x, terrainPos.y, terrainPos.z)
      const newSnapInfo = snapTerrainPositionToLockedLine(terrainVector, lockedSnapLine)
      return {
        ...newSnapInfo,
        candidateLines: [],
      }
    }
    return snapToLockedLine(snapInfo, lockedSnapLine, true)
  },
  visualsComponent: () => <SnappingIndicator snapInfo={currentSnapInfoSignal.value} showSnappingPoints={true} />,
  snappingPicker: () => {
    const currentSnapInfo = currentSnapInfoSignal.peek()
    return currentSnapInfo ? <SnappingPicker candidateLines={currentSnapInfo.candidateLines} /> : null
  },
  setSnapInfo(snapInfo: SnapInfo) {
    setCurrentSnapInfoSignalValue(snapInfo)
  },
  clearSnapInfo() {
    setCurrentSnapInfoSignalValue(undefined)
  },
  createSnappingLineFromLine(start: Vector3, end: Vector3, onTerrain?: boolean): SnappingLine {
    const terrainSamplerData = terrainSignal.peek().terrainSamplerData
    return snappingLineFromEndpoints(start, end, "LINE", onTerrain, terrainSamplerData)
  },
}
