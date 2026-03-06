import { useMemo } from "react"
import { hoveredSelectionPathsSignal, selectionPathsSignal } from "src/core/selection/selectionState"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import { elementState } from "src/core/elements/ElementState"
import { useTranslator } from "src/i18n"

export const ReorderTerrainPads = () => {
  const t = useTranslator()
  const { hoveredPath, selectedCount } = useMemo(() => {
    const hoveredPath = Array.from(hoveredSelectionPathsSignal.peek().values())[0]
    const selectedCount = Array.from(selectionPathsSignal.peek().values()).length
    return { hoveredPath, selectedCount }
  }, [])

  if (!hoveredPath) return null

  const [, category, hoveredTerrainId] = hoveredPath.split(":")
  if (category !== "terrain_pads" || !hoveredTerrainId) return null

  const currentTerrain = elementState.currentTerrainSignal.value
  if (!currentTerrain) return null
  const terrainOperations = terrainApi.getTerrainOperations(currentTerrain.element)
  const hoveredTerrainOperation = terrainApi.getTerrainOperation(currentTerrain.element, hoveredTerrainId)

  if (!hoveredTerrainOperation) return null

  const moveToFront = () => {
    const reordered = [hoveredTerrainOperation, ...terrainOperations.filter((op) => op.id !== hoveredTerrainId)]
    terrainApi.applyTerrainOperationsToElementState(reordered)
  }

  const moveToBack = () => {
    const reordered = [...terrainOperations.filter((op) => op.id !== hoveredTerrainId), hoveredTerrainOperation]
    terrainApi.applyTerrainOperationsToElementState(reordered)
  }

  return (
    <>
      <forma-context-menu-item
        text={t(($) => $.contextMenu.terrainPad.moveToFront)}
        onClick={moveToFront}
        disabled={selectedCount > 1}
      />
      <forma-context-menu-item
        text={t(($) => $.contextMenu.terrainPad.moveToBack)}
        onClick={moveToBack}
        disabled={selectedCount > 1}
      />
      <forma-context-menu-divider />
    </>
  )
}
