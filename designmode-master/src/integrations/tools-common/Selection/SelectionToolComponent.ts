import { useState } from "preact/hooks"
import { SelectionToolController } from "./SelectionToolController"
import { useLayoutEffect } from "preact/compat"
import type { RaycastData } from "src/core/selection/raycasting"
import type { Object3D } from "three"
import type { SelectionPath } from "src/core/selection/selectionTypes"

type Props = {
  raycastTargets: Map<Object3D, RaycastData>
  currentSelectionPaths: Set<SelectionPath>
  selectPaths: (paths: Set<SelectionPath>) => void
  hoveredPaths: Set<SelectionPath>
  setCurrentHoverPaths: (paths: Set<SelectionPath>) => void
  doubleClickCallback: (clickedPath: SelectionPath | undefined) => void
}

export function SelectionToolComponent({
  raycastTargets,
  currentSelectionPaths,
  selectPaths,
  hoveredPaths,
  setCurrentHoverPaths,
  doubleClickCallback,
}: Props) {
  const [selectionTool] = useState(new SelectionToolController(setCurrentHoverPaths, selectPaths, doubleClickCallback))

  useLayoutEffect(() => {
    selectionTool.updateCallbacks(setCurrentHoverPaths, selectPaths, doubleClickCallback)
  }, [doubleClickCallback, selectPaths, selectionTool, setCurrentHoverPaths])

  useLayoutEffect(() => {
    selectionTool.updateRaycastTargets(raycastTargets)
  }, [raycastTargets, selectionTool])

  useLayoutEffect(
    () => selectionTool.updateCurrentSelection(currentSelectionPaths),
    [currentSelectionPaths, selectionTool],
  )
  useLayoutEffect(() => selectionTool.updateCurrectHover(hoveredPaths), [hoveredPaths, selectionTool])

  useLayoutEffect(() => {
    selectionTool.start()
    return () => {
      selectionTool.exit()
    }
  }, [selectionTool])

  return null
}
