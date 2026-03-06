export function getUpdatedSelectedEdgesIDs(oldSelection: string[] | undefined, edgeId: string, shiftSelect: boolean) {
  if (!shiftSelect) {
    if (oldSelection?.length === 1 && oldSelection[0] === edgeId) return []
    return [edgeId]
  }
  if (oldSelection === undefined) return [edgeId]
  if (oldSelection.some((id) => id === edgeId)) {
    return oldSelection.filter((id) => id !== edgeId)
  }
  return [...oldSelection, edgeId]
}
