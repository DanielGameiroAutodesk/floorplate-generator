import { useRecoilValue } from "recoil"
import { areFaceWithSmoothEdgeInSelection } from "src/integrations/wsm-tools/wsr/integrated/utils/faces"
import { isSelectionChangedState } from "src/integrations/wsm-tools/wsr/integrated/state"
import { hasMeshesInSelection as areMeshesInSelection } from "src/integrations/wsm-tools/wsr/integrated/utils"
import { useMemo } from "preact/hooks"

function useCheckSelection() {
  const isSelectionChanged = useRecoilValue(isSelectionChangedState)

  const result = useMemo(() => {
    const selections: WSM.GroupInstancePathInterface[] = FormIt.Selection.GetSelections()
    const propertiesForSelected = FormIt.Model.GetPropertiesForSelected()

    const areSmoothEdgeInSelection = areFaceWithSmoothEdgeInSelection(selections)
    const hasSelectedSomething = selections.length > 0
    const hasSelectedFaces = propertiesForSelected.numFacesSelected > 0
    const hasOneFaceSelected = propertiesForSelected.numFacesSelected === 1
    const hasMultipleFacesSelected = propertiesForSelected.numFacesSelected > 1
    const hasSelectedEdges = propertiesForSelected.numEdgesSelected > 0
    const hasMeshesInSelection = areMeshesInSelection()
    const hasInstancesInSelection = propertiesForSelected.numInstancesSelected > 0

    return {
      hasSelectedFaces,
      hasSelectedSomething,
      hasOneFaceSelected,
      hasMultipleFacesSelected,
      areSmoothEdgeInSelection,
      hasSelectedEdges,
      hasMeshesInSelection,
      hasInstancesInSelection,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectionChanged])

  return result
}

export default useCheckSelection
