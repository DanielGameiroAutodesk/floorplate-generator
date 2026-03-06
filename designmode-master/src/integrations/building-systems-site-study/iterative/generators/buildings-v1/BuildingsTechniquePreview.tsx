import { memo } from "preact/compat"

import { PolygonWithHoles } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/FloorIcons/simpleSvgComponents"
import { ensurePolygonIsXY, getBoundingBoxOfPolygon } from "src/integrations/building-systems-common/geoHelpers"

import { type Polygon, type Technique } from "./adapter"
import { fillPolygonWithExploreBuildings } from "./generator"

type PolygonXY = { x: number; y: number }[]

function calculateCenterPointAndScaleFromSite(sitePolygon: PolygonXY, viewBoxWidth: number, viewBoxHeight: number) {
  const { minX, maxX, minY, maxY } = getBoundingBoxOfPolygon(sitePolygon)
  const centerX = (maxX + minX) / 2
  const centerY = (maxY + minY) / 2
  const centerPoint = { x: centerX, y: centerY }
  const xLength = maxX - minX
  const yLength = maxY - minY

  const scaleX = viewBoxWidth / xLength
  const scaleY = viewBoxHeight / yLength
  const scale = Math.min(scaleX, scaleY)

  return { centerPoint, scale }
}

export const BuildingsTechniquePreview = memo(_BuildingsTechniquePreview)

const WIDTH = 50
const HEIGHT = 50

type BuildingTechniquePreviewProps = {
  polygon: Polygon
  technique: Technique
  buildingWidth: number
  towerWidth: number
}
function _BuildingsTechniquePreview(parameters: BuildingTechniquePreviewProps) {
  const sitePolygon = parameters.polygon
  const buildings = fillPolygonWithExploreBuildings({ ...parameters, floors: 4, floorHeight: 3 })
  const buildingFootprints = buildings.flatMap((building) => building.polygons)

  const { centerPoint, scale } = calculateCenterPointAndScaleFromSite(ensurePolygonIsXY(sitePolygon), WIDTH, HEIGHT)

  return (
    <svg style={{ width: WIDTH, height: HEIGHT }} viewBox={`-${WIDTH / 2} -${HEIGHT / 2} ${WIDTH} ${HEIGHT}`}>
      <PolygonWithHoles
        spacePolygon={ensurePolygonIsXY(sitePolygon)}
        centerPosition={centerPoint}
        scale={scale}
        fill={"#D9D9D9"}
        fillOpacity={undefined}
        stroke={"#808080"}
        strokeWidth={0.5}
      />
      {buildingFootprints.map((polygon, i) => (
        <PolygonWithHoles
          key={`thumbnail-building-${i}`}
          spacePolygon={ensurePolygonIsXY(polygon)}
          spaceHoles={[]}
          centerPosition={centerPoint}
          scale={scale}
          fill={"white"}
          stroke={"gray"}
          strokeWidth={0.5}
        />
      ))}
    </svg>
  )
}
