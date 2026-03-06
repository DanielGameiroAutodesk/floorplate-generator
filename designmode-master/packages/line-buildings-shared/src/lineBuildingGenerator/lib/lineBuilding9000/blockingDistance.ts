import type { GraphVertex } from "../../../shapeHelpers.js"
import { getLineAngles, getLineSegmentLengths } from "./lineHelpers.js"

export function getBlockDistanceForSimpleCorner(width: number, angle: number) {
  const absAngle = Math.abs(angle)
  if (absAngle >= Math.PI / 2) {
    const dist1 = (0.5 * width) / Math.cos(absAngle - Math.PI / 2)
    const dist2 = (0.5 * width) / Math.tan(Math.PI - absAngle)
    return dist1 + dist2
  }
  const shift = (0.5 * width - 0.5 * width * Math.cos(absAngle)) / Math.sin(absAngle)
  return Math.abs(shift)
}

export function getBlockingDistances(line: GraphVertex[], width: number, closedLine: boolean) {
  const angles = getLineAngles(line as [GraphVertex, GraphVertex], closedLine)
  const blockingDistances = []
  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i]
    if (angle === undefined || angle === 0) {
      blockingDistances.push(0)
    } else {
      const blockingDistance = getBlockDistanceForSimpleCorner(width, angle)
      blockingDistances.push(blockingDistance)
    }
  }
  return blockingDistances
}

const NPD = 1e-8
const AngleThreshold = (5 / 6) * Math.PI

export function getCollapsedCorners(line: GraphVertex[], width: number, closedLine: boolean): Record<number, boolean> {
  const edgeLengths = getLineSegmentLengths(line as [GraphVertex, GraphVertex], closedLine)
  const blockingDistances = getBlockingDistances(line, width, closedLine)
  const angles = getLineAngles(line as [GraphVertex, GraphVertex], closedLine)

  const collapsedCorners: Record<number, boolean> = {}
  const n = line.length
  for (let i = 0; i < line.length; i++) {
    if (!closedLine && i === n - 1) break

    const edgeLength = edgeLengths[i]
    const startBlock = blockingDistances[i]
    const endBlock = blockingDistances[(i + 1) % n]
    if (endBlock + startBlock > edgeLength + NPD) {
      collapsedCorners[i] = true
      collapsedCorners[(i + 1) % n] = true
    }
  }

  for (let i = 0; i < line.length; i++) {
    const angle = angles[i]
    if (Math.abs(angle) > AngleThreshold) collapsedCorners[i] = true
  }

  return collapsedCorners
}

export function splitLineInNonCollapsedLines(line: GraphVertex[], width: number, closedLine: boolean) {
  const collapsedCorners = getCollapsedCorners(line, width, closedLine)
  if (Object.values(collapsedCorners).length === 0) return [{ line, closed: closedLine }]
  const startIndex = (closedLine ? Object.keys(collapsedCorners)[0] : 0) as number
  const lines = []
  let semiLine: GraphVertex[] = []
  const n = line.length
  const m = closedLine ? line.length + 1 : line.length
  for (let i = 0; i < m; i++) {
    const index = startIndex + i
    semiLine.push(line[index % n])
    if (collapsedCorners[index % n] && semiLine.length > 1) {
      lines.push({ line: semiLine, closed: false })
      semiLine = [line[index % n]]
    }
  }
  if (semiLine.length > 1) {
    lines.push({ line: semiLine, closed: false })
  }
  return lines
}
