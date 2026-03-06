import type { PolygonXY } from "src/lib/geometry/polygonXY"

export type PolygonWithHolesSVGProps = {
  polygon: PolygonXY
  holes?: PolygonXY[]
  fill: string
  stroke?: string
  strokeWidth?: number
}

export function PolygonWithHolesSVG({
  polygon,
  holes = [],
  fill,
  stroke = "none",
  strokeWidth = 2,
}: PolygonWithHolesSVGProps) {
  let polygonString =
    polygon
      .map(({ x, y }, i) => {
        if (i === 0) return `M ${x} ${y}`
        return `L ${x} ${y}`
      })
      .join(" ") + " Z"

  const holeString = holes
    .map((hole) => {
      return (
        hole
          .map(({ x, y }, i) => {
            if (i === 0) return `M ${x} ${y}`
            return `L ${x} ${y}`
          })
          .join(" ") + " Z"
      )
    })
    .join(" ")
  const pathString = polygonString + holeString
  return (
    <path
      d={pathString}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fillRule="evenodd"
      vectorEffect="non-scaling-stroke"
    />
  )
}
