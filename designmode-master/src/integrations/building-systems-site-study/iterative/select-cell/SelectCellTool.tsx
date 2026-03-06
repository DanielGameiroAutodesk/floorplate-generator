import { useCallback } from "preact/hooks"
import { Color, type Object3D, Vector2, Vector3 } from "three"
import { type ReadonlySignal, useComputed, useSignal } from "@preact/signals"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"
import { LineSegments2, LineSegmentsGeometry } from "three/examples/jsm/Addons.js"

import type { RaycastData } from "src/core/selection/raycasting"
import { type InternalPath, mergePath } from "src/lib/element/path"
import { elementState } from "src/core/elements/ElementState"
import {
  type ChildNodeSelectable,
  getSelectablesForToplevelNode,
} from "src/core/elements/child-node-container-derived-data/selectables"
import { useReadonlySignal } from "src/lib/signal"
import ArrayUtils, { isDefined } from "src/lib/array"
import { RenderSurfaces } from "src/core/three/stencil/RenderSurfaces"
import { screenResolutionVector } from "src/core/three/sceneManager"
import { sampleSegment2d } from "src/lib/geometry/sampleSegment2d"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import {
  elementSelectionPathToInternalPath,
  isElementSelectionPath,
  type SelectionPath,
} from "src/core/selection/selectionTypes"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

import { SelectionToolComponent } from "src/integrations/tools-common/Selection/SelectionToolComponent"
import { isSiteExploreAreaChildrenGeneratorElement } from "src/integrations/building-systems-site-study/iterative/site-explore-area"

type Props = {
  nodePath: InternalPath
  selectedCellsSignal: ReadonlySignal<Set<SelectionPath>>
  onSelectedCellsChange: (newVal: Set<SelectionPath>) => void
}

const SELECTED_CELL_OUTLINE_MATERIAL = new LineMaterial({
  depthTest: false,
  linewidth: 1.5,
  resolution: screenResolutionVector,
  color: new Color("#85FDDD"),
})

export function SelectCellTool({ nodePath, selectedCellsSignal, onSelectedCellsChange }: Props) {
  const hoveredPathsSignal = useSignal<Set<SelectionPath>>(new Set())

  const nodePathSignal = useReadonlySignal(nodePath)

  const raycastTargetsSignal = useComputed(() => {
    const snapshot = elementState.currentSnapshot.value
    const proposal = elementState.currentProposalSignal.value
    const terrain = terrainSignal.value
    const node = snapshot.getNode(nodePathSignal.value)
    if (!node) return new Map()
    return new Map(
      (node.element.children ?? [])
        .map((child) => snapshot.getNode(mergePath(node.path, child.key)))
        .filter(isDefined)
        .flatMap((node) => getSelectablesForToplevelNode(node, proposal, terrain).flatMap(selectableToRaycastTargets)),
    )
  })

  const doubleClickCallback = useCallback(() => {}, [])

  const surfacesToRenderSignal = useComputed(() => {
    return [...hoveredPathsSignal.value]
      .filter((selectionPath) => isElementSelectionPath(selectionPath))
      .map(elementSelectionPathToInternalPath)
      .map((path) => elementState.currentSnapshot.value.getNode(path))
      .filter(isDefined)
      .map((node) => {
        if (!isSiteExploreAreaChildrenGeneratorElement(node.element)) return undefined
        return {
          polygons: [[node.element.properties.generator.parameters.polygon]],
          color: "#01FFEA",
          opacity: 0.2,
        }
      })
      .filter(isDefined)
  })

  const lineMeshSignal = useComputed(() => {
    let positions: number[] = [...selectedCellsSignal.value]
      .map((path) => elementState.currentSnapshot.value.getNode(path))
      .filter(isDefined)
      .map((node): [Vector2, Vector2][] | undefined => {
        if (!isSiteExploreAreaChildrenGeneratorElement(node.element)) return undefined
        return ArrayUtils.sliding2(node.element.properties.generator.parameters.polygon).flatMap(([from, to]) =>
          sampleSegment2d(new Vector2(from[0], from[1]), new Vector2(to[0], to[1])),
        )
      })
      .filter(isDefined)
      .flat(2)
      .map((vec2) => new Vector3(vec2.x, vec2.y, terrainSignal.peek().elevationAt(vec2.x, vec2.y)))
      .flatMap((v) => v.toArray())

    const lineMesh = new LineSegments2(new LineSegmentsGeometry(), SELECTED_CELL_OUTLINE_MATERIAL)
    lineMesh.geometry.setPositions(positions)
    return lineMesh
  })

  useObjectLifecycle(lineMeshSignal.value, true)

  return (
    <>
      <RenderSurfaces surfacesSignal={surfacesToRenderSignal} />
      <SelectionToolComponent
        raycastTargets={raycastTargetsSignal.value}
        currentSelectionPaths={selectedCellsSignal.value}
        hoveredPaths={hoveredPathsSignal.value}
        selectPaths={onSelectedCellsChange}
        setCurrentHoverPaths={(newPaths) => {
          hoveredPathsSignal.value = newPaths
        }}
        doubleClickCallback={doubleClickCallback}
      />
    </>
  )
}

const selectableToRaycastTargets = (selectable: ChildNodeSelectable): [Object3D, RaycastData][] =>
  selectable.raycastTargets.map(({ object3d, type: raycastType }) => [
    object3d,
    {
      type: "element",
      raycastType,
      selection: selectable.selectionPath,
    },
  ])
