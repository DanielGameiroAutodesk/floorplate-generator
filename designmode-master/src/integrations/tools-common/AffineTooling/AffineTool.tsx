import type { Matrix4 } from "three"
import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import { Affine } from "./Affine"
import { HiddenPaths } from "src/core/hidden"
import { useMoveGroup } from "./utils"
import { useApplyAffine } from "./transformActions"
import { selectedTopLevelPathsWithDescendantsSignal, selectionSetSignal } from "src/core/selection/selectionState"
import { useCalculateAffineSnap } from "src/integrations/snapping/useAffineSnap"
import type { InternalPath } from "src/lib/element/path"

function useHiddenPaths(paths: Set<InternalPath>, hide: boolean = true) {
  useEffect(() => {
    if (!hide) return
    HiddenPaths.setPathsHidden(paths, true)
    return () => HiddenPaths.setPathsHidden(paths, false)
  }, [hide, paths])
}

export const AffineTool = () => {
  const [duplicateSelection, setDuplicateSelection] = useState(false)
  const [toolHasControl, setToolHasControl] = useState(false)
  const setControlOfVisuals = useCallback(
    (control: boolean) => {
      setToolHasControl(control)
      HiddenPaths.setSelectedContextRootDirectChildrenHidden(control && !duplicateSelection)
    },
    [duplicateSelection],
  )
  useHiddenPaths(selectionSetSignal.value, toolHasControl && !duplicateSelection)

  const { moveGroup3D, moveGroup2D } = useMoveGroup(toolHasControl)

  const expandedSelection = selectedTopLevelPathsWithDescendantsSignal.value

  const calculateAffineSnap = useCalculateAffineSnap()

  const { movingSnapData, targetSnapData } = useMemo(() => {
    if (duplicateSelection)
      return {
        movingSnapData: calculateAffineSnap().filter((m) => expandedSelection.has(m.id)),
        targetSnapData: calculateAffineSnap(),
      }
    const movingSnapLines = calculateAffineSnap().filter((m) => expandedSelection.has(m.id))
    const targetSnapLines = calculateAffineSnap().filter((m) => !expandedSelection.has(m.id))
    return { movingSnapData: movingSnapLines, targetSnapData: targetSnapLines }
  }, [duplicateSelection, calculateAffineSnap, expandedSelection])

  const applyAffine = useApplyAffine()

  const applyWithDuplicate = useCallback(
    async (matrix: Matrix4) => {
      await applyAffine(matrix, duplicateSelection)

      setDuplicateSelection(false)
    },
    [duplicateSelection, applyAffine],
  )

  return (
    <Affine
      setControlOfVisuals={setControlOfVisuals}
      moveGroup3D={moveGroup3D}
      moveGroup2D={moveGroup2D}
      movingSnapData={movingSnapData}
      targetSnapData={targetSnapData}
      apply={applyWithDuplicate}
      movingPaths={duplicateSelection ? new Set() : expandedSelection}
      setDuplicate={setDuplicateSelection}
    />
  )
}
