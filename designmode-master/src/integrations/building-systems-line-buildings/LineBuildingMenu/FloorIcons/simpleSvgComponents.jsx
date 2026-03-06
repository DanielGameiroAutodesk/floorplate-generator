import { memo } from "preact/compat"

const spaceToViewBoxCoordinate = (spacePosition, centerPosition, scale) => {
  const x = (spacePosition.x - centerPosition.x) * scale
  const y = -(spacePosition.y - centerPosition.y) * scale

  return { x, y }
}

const spaceToViewBoxCoordinates = (spacePositions, centerPosition, scale) => {
  return spacePositions.map((spacePosition) => spaceToViewBoxCoordinate(spacePosition, centerPosition, scale))
}

const _Polyline = ({
  points,
  centerPosition,
  scale,
  stroke = "black",
  fill = "none",
  strokeWidth = 0.1,
  strokeOpacity = 1.0,
}) => {
  if (points.length === 0) return <></>
  const viewLine = spaceToViewBoxCoordinates(points, centerPosition, scale)
  return (
    <polyline
      points={viewLine.map((point) => [point.x, point.y])}
      stroke={stroke}
      fill={fill}
      strokeWidth={strokeWidth}
      strokeOpacity={strokeOpacity}
    />
  )
}

/**
 * @param {{x: number, y: number}[]} points
 * @param {{x: number, y: number}} centerPosition
 * @param {number} scale
 * @param {string} stroke
 * @param {number} strokeWidth
 * @param {number} strokeOpacity
 * @param {string} fill
 * @return {JSX.Element}
 * @type {FunctionComponent<{}>}
 */
export const PolyLine = memo(_Polyline)

const _PolygonWithHoles = ({
  spacePolygon,
  spaceHoles = [],
  centerPosition,
  scale,
  fill = "lime",
  fillOpacity = 1.0,
  strokeOpacity = 1.0,
  stroke = "gray",
  strokeWidth = 0.2,
  onClick = () => {},
  onDoubleClick = () => {},
  onMouseDown = () => {},
  onMouseUp = () => {},
  className = "",
}) => {
  if (spacePolygon.length === 0) return <></>
  if (spaceHoles.length === 0) {
    return (
      <Polygon
        spacePolygon={spacePolygon}
        centerPosition={centerPosition}
        scale={scale}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        className={className === "" ? undefined : className}
      />
    )
  }
  const viewPolygon = spaceToViewBoxCoordinates(spacePolygon, centerPosition, scale)
  viewPolygon.push(viewPolygon[0])
  const points = viewPolygon.map((point) => [point.x, point.y])
  const holes = spaceHoles.map((spaceHole) => {
    const viewHole = spaceToViewBoxCoordinates(spaceHole, centerPosition, scale)
    const points = viewHole.map((point) => [point.x, point.y])
    points.push(points[0])
    return points
  })
  const clipper = [...points]
  holes.forEach((hole) => {
    clipper.push(...hole)
    clipper.push(points[0])
  })
  return (
    <>
      <polygon
        points={clipper}
        fillRule={"evenodd"}
        fill={fill}
        fillOpacity={fillOpacity}
        strokeOpacity={strokeOpacity}
        stroke={"none"}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        className={className}
      />
      <polyline points={points} stroke={stroke} strokeWidth={strokeWidth} fill={"none"} />
      {holes.map((hole, i) => {
        return <polyline key={i} points={hole} stroke={stroke} strokeWidth={strokeWidth} fill={"none"} />
      })}
    </>
  )
}

export const PolygonWithHoles = memo(_PolygonWithHoles)

export const Polygon = ({
  spacePolygon,
  centerPosition,
  scale,
  fill = "lime",
  fillOpacity = 1.0,
  stroke = "gray",
  strokeWidth = 0.2,
  strokeOpacity = 1,
  onClick = () => {},
  onDoubleClick = () => {},
  onMouseDown = () => {},
  onMouseUp = () => {},
  className = undefined,
}) => {
  const viewPolygon = spaceToViewBoxCoordinates(spacePolygon, centerPosition, scale)
  const points = viewPolygon.map((point) => [point.x, point.y])

  return (
    <polygon
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fillOpacity={fillOpacity}
      strokeOpacity={strokeOpacity}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      className={className}
    />
  )
}

export const Line = ({
  spaceLine,
  centerPosition,
  scale,
  stroke = "black",
  strokeWidth = "0.1",
  strokeDasharray = "",
  strokeOpacity = "1.0",
  style = "",
}) => {
  const viewLine = spaceToViewBoxCoordinates(spaceLine, centerPosition, scale)
  const [p1, p2] = viewLine

  return (
    <line
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      strokeOpacity={strokeOpacity}
      style={style}
    />
  )
}

export const Point = ({
  spacePoint,
  centerPosition,
  scale,
  fill = "lime",
  stroke = "gray",
  strokeWidth = 0.2,
  radius = 1,
  style = "",
}) => {
  const [{ x, y }] = spaceToViewBoxCoordinates([spacePoint], centerPosition, scale)
  return <circle cx={x} cy={y} r={radius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} style={style} />
}
