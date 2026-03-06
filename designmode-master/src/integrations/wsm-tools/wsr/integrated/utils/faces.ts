// Verify that a face has at least one smooth edge
function faceHasSmoothEdge(faceId: number, historyId: number) {
  const edges = WSM.APIGetObjectsByTypeReadOnly(historyId, faceId, WSM.nEdgeType)
  const faceHasSmoothEdge = edges.some((edge) => WSM.APIGetEdgeOrVertexMarkedSmoothReadOnly(historyId, edge))

  return faceHasSmoothEdge
}

// This function verifies if there is at least one face in the selection that has at least one smooth edge
export function areFaceWithSmoothEdgeInSelection(selections: WSM.GroupInstancePathInterface[]) {
  let findOneFaceThatHasSmoothEdge = false
  let i = 0

  // Stops if it finds a face that has a smooth edge or reaches the end
  while (i < selections.length && !findOneFaceThatHasSmoothEdge) {
    const { ids } = selections[i]

    // Verify that there are no elements and move on to the next iteration.
    if (ids.length === 0) {
      i++
      continue
    }

    const { Object: objectId, History } = ids[ids.length - 1]

    if (!WSM.APIIsHistoryLiveReadOnly(History) || !WSM.APIIsObjectLiveReadOnly(History, objectId)) {
      // Don't report sentry errors when the selection is bad.
      i++
      continue
    }

    const hasSmoothEdge = faceHasSmoothEdge(objectId, History)
    if (hasSmoothEdge) {
      findOneFaceThatHasSmoothEdge = true
    }

    i++
  }

  return findOneFaceThatHasSmoothEdge
}
