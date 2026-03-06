import type { CornerSection, EdgeSection, Section } from "../buildPolygons.js"
import type { Section as SectionGraphBuilding3000 } from "../../../lineBuildingGenerator/lib/graphBuilding3000.js"
import type { LineBuildingParameters } from "../../../lineBuildingParameters.js"

export type ExtendedEdgeSection = Section & {
  footPrint: [number, number][]
  edgeID: string
  index: number
  leftLine: number[][]
  centerLine: number[][]
  rightLine: number[][]
}

export type SectionOutlinesCorner = {
  width: number
  footPrint: [number, number][]
  blockDist: number
  startLeg: number
  endLeg: number
  angle: number
  type: "Corner"
  vertexID: string
  updated: boolean
}

function isPointSame(pointOne: [number, number], pointTwo: [number, number], npd: number) {
  const dist = ((pointOne[0] - pointTwo[0]) ** 2 + (pointOne[1] - pointTwo[1]) ** 2) ** 0.5
  return dist < npd
}

function isFootPrintUpdated(newFootPrint: [number, number][], oldFootPrint: [number, number][]) {
  if (!oldFootPrint) return true
  if (oldFootPrint.length !== newFootPrint.length) return true

  for (let i = 0; i < oldFootPrint.length; i++) {
    const p0 = oldFootPrint[i]
    const p1 = newFootPrint[i]
    if (!isPointSame(p0, p1, 1e-4)) return true
  }

  return false
}

function getSectionLines(startWall: [number, number][], endWall: [number, number][]) {
  const leftLine = [startWall[0], endWall[0]]
  const rightLine = [startWall[1], endWall[1]]
  const cx0 = 0.5 * (startWall[0][0] + startWall[1][0])
  const cy0 = 0.5 * (startWall[0][1] + startWall[1][1])
  const cx1 = 0.5 * (endWall[0][0] + endWall[1][0])
  const cy1 = 0.5 * (endWall[0][1] + endWall[1][1])
  const centerLine = [
    [cx0, cy0],
    [cx1, cy1],
  ]
  return { leftLine, rightLine, centerLine }
}

export function getSectionOutlines(
  edgeSections: EdgeSection[],
  cornerSections: CornerSection[],
  settings: LineBuildingParameters,
) {
  const oldSections = settings.sections || {}
  const sections: Record<string, SectionGraphBuilding3000> = {}
  const edges: Record<string, ExtendedEdgeSection[]> = {}
  for (let i = 0; i < edgeSections.length; i++) {
    const edgeData = edgeSections[i]
    const edgeID = edgeData.edge.id
    edges[edgeID] = []
    edgeData.sections.forEach((edgeSection, index) => {
      const { startWall, endWall } = edgeSection
      const footPrint = [...startWall, endWall[1], endWall[0], startWall[0]] as [number, number][]
      const sectionID = edgeID + "::" + index
      const { leftLine, centerLine, rightLine } = getSectionLines(
        startWall as [number, number][],
        endWall as [number, number][],
      )
      sections[sectionID] = { footPrint, length: edgeSection.length ?? 0, sectionType: edgeSection.type }
      edges[edgeID].push({
        ...edgeSection,
        footPrint,
        edgeID,
        index,
        leftLine,
        centerLine,
        rightLine,
      } as ExtendedEdgeSection)
    })
  }

  const corners: Record<string, SectionOutlinesCorner> = {}
  for (let i = 0; i < cornerSections.length; i++) {
    const cornerSection = cornerSections[i]
    const { startLeg, endLeg, blockDist, angle } = cornerSection
    const vertexID = cornerSection.vertex.id
    const footPrint = [...cornerSection.exteriorPolygon, cornerSection.exteriorPolygon[0]] as [number, number][]

    const oldSectionData = oldSections?.corners?.[vertexID] || {}
    const oldFootPrint = oldSectionData?.footPrint as [number, number][]
    const updated = isFootPrintUpdated(footPrint, oldFootPrint)
    const sectionID = vertexID + "::" + 0
    corners[vertexID] = {
      footPrint,
      blockDist,
      startLeg,
      endLeg,
      angle,
      type: "Corner",
      vertexID,
      updated,
    } as SectionOutlinesCorner
    sections[sectionID] = {
      footPrint,
      blockDist,
      startLeg,
      endLeg,
      angle,
      sectionType: "Corner",
    } as SectionGraphBuilding3000
  }

  return { sections, sectionDividedByEdgesAndCorners: { edges, corners } }
}
