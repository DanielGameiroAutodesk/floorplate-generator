export type SectionDistanceDict = Record<
  string,
  { sectionDistances: number[]; defaultDistance: number; startCornerLeg: number; endCornerLeg: number }
>

export function getCustomSectionDistanceDict(parameters: any) {
  const { graph, sectionProps, minSubBuildingLength } = parameters
  const sectionDistanceDict: SectionDistanceDict = {}
  if (!sectionProps) return sectionDistanceDict
  const sectionIDs = Object.keys(sectionProps)
  const edgeIDs = Object.keys(graph.edges)

  for (let edgeID of edgeIDs) {
    const sectionIDsOnEdge = sectionIDs.filter((sectionID) => {
      const sectionEdgeID = sectionID.split("::")[0]
      return edgeID === sectionEdgeID
    })
    let maxIndex = -1
    sectionIDsOnEdge.forEach((sectionID) => {
      const index = parseInt(sectionID.split("::")[1])
      maxIndex = Math.max(index, maxIndex)
    })
    const sectionDistances = []
    let prevSectionDist
    for (let i = 0; i <= maxIndex; i++) {
      const sectionID = edgeID + "::" + i
      const sectionDistance: number =
        sectionProps[sectionID]?.minSubBuildingLength || prevSectionDist || minSubBuildingLength
      sectionDistances.push(sectionDistance)
      prevSectionDist = sectionDistance
    }
    const defaultDistance = sectionDistances[sectionDistances.length - 1] || prevSectionDist || minSubBuildingLength

    const edge = graph.edges[edgeID]
    const startVertex = graph.vertices[edge.start]
    const startCornerSectionId = startVertex.id + "::" + 0
    const endVertex = graph.vertices[edge.end]
    const endCornerSectionId = endVertex.id + "::" + 0

    const startCornerLeg = sectionProps[startCornerSectionId]?.endLeg || 0
    const endCornerLeg = sectionProps[endCornerSectionId]?.startLeg || 0

    sectionDistanceDict[edgeID] = { sectionDistances, defaultDistance, startCornerLeg, endCornerLeg }
  }
  return sectionDistanceDict
}
