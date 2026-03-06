export function getHistoryAndObjectFromInstancePath(instancePath: WSM.GroupInstancePathInterface) {
  const finalObjectHistoryId = WSM.Utils.GetGroupInstancePathFinalObjectHistoryID(instancePath)
  const refHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(
    finalObjectHistoryId.History,
    finalObjectHistoryId.Object,
  )
  if (refHistoryId === WSM.INVALID_ID) {
    throw new Error("invalid history")
  }
  const toplevelObjects = WSM.APIGetAllNonOwnedReadOnly(refHistoryId)

  return {
    historyId: refHistoryId,
    objectIds: toplevelObjects,
  }
}
