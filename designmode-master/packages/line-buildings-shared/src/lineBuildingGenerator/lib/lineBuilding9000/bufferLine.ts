type PointXY = { x: number; y: number }
type LineXY = PointXY[]

function getUnitVectorXY(startPoint: PointXY, endPoint: PointXY) {
  const distance = ((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2) ** 0.5
  if (distance === 0) return { x: 0, y: 0 }
  const dx = (endPoint.x - startPoint.x) / distance
  const dy = (endPoint.y - startPoint.y) / distance
  return { x: dx, y: dy }
}

function getUnitNormalVectorXY(startPoint: PointXY, endPoint: PointXY) {
  const unitVector = getUnitVectorXY(startPoint, endPoint)
  const dx = -unitVector.y
  const dy = unitVector.x
  return { x: dx, y: dy }
}

function getUnitNormalVectors(line: LineXY) {
  const unitNormals = []
  const n = line.length
  for (let i = 0; i < n - 1; i++) {
    const p0 = line[i]
    const p1 = line[(i + 1) % n]
    const normal = getUnitNormalVectorXY(p0, p1)
    unitNormals.push(normal)
  }
  return unitNormals
}

function getCornerShiftsOpen(line: LineXY) {
  const unitNormals = getUnitNormalVectors(line)
  const n = line.length
  const cornerShifts = [unitNormals[0]]
  for (let i = 0; i < n - 2; i++) {
    const normalOne = unitNormals[i]
    const normalTwo = unitNormals[i + 1]
    let x = normalOne.x + normalTwo.x
    let y = normalOne.y + normalTwo.y
    const l = x * normalOne.x + y * normalOne.y
    x = x / l
    y = y / l
    cornerShifts.push({ x, y })
  }
  cornerShifts.push(unitNormals[n - 2])
  return cornerShifts
}

function getCornerShiftsClosed(line: LineXY) {
  const unitNormals = getUnitNormalVectors(line)
  const n = line.length
  const cornerShifts = []
  const m = unitNormals.length
  for (let i = -1; i < n - 1; i++) {
    const normalOne = unitNormals[(i + m) % m]
    const normalTwo = unitNormals[(i + 1) % m]
    let x = normalOne.x + normalTwo.x
    let y = normalOne.y + normalTwo.y
    const l = x * normalOne.x + y * normalOne.y
    x = x / l
    y = y / l
    cornerShifts.push({ x, y })
  }
  return cornerShifts
}

function bufferOpenLine(line: LineXY, bufferDist: number) {
  const cornerShifts = getCornerShiftsOpen(line)
  return line.map((point, i) => {
    const x = point.x + cornerShifts[i].x * bufferDist
    const y = point.y + cornerShifts[i].y * bufferDist
    return { x, y }
  })
}

function bufferClosedLine(line: LineXY, bufferDist: number) {
  const cornerShifts = getCornerShiftsClosed(line)
  const bufferedLine = line.map((point, i) => {
    const x = point.x + cornerShifts[i].x * bufferDist
    const y = point.y + cornerShifts[i].y * bufferDist
    return { x, y }
  })
  bufferedLine[bufferedLine.length - 1] = bufferedLine[0]

  return bufferedLine
}

function closeLine(line: PointXY[]) {
  const first = line[0]
  const last = line[line.length - 1]
  if (first.x !== last.x || first.y !== last.y) return [...line, line[0]]
  return line
}

export function bufferLine(line: LineXY, bufferDist: number, lineClosed: boolean = false) {
  if (line.length <= 1) return line
  if (lineClosed) {
    const bufferedLine = bufferClosedLine(closeLine(line), bufferDist)
    return bufferedLine.slice(0, bufferedLine.length - 1)
  }
  return bufferOpenLine(line, bufferDist)
}
