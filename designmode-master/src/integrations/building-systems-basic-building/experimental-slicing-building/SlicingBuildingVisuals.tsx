import type { BasicBuilding, Floor } from "src/integrations/building-systems-basic-building/lib/types"
import type { Matrix4 } from "three"
import { useMemo } from "preact/hooks"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import type { Transform } from "@spacemakerai/element-types"
import type { RenderedObject } from "src/integrations/render-api/RenderAPI"
import type { Volume } from "src/lib/three/build-25d-volume-boxes"
import { makeBufferGeometryFromVolumes } from "src/lib/three/build-25d-volume-boxes"
import { calculateDifference } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import { getWallFootprints } from "./footprinting/makeWallFootPrints"
import type { PointXY, PolygonWithHolesXY, PolygonXY } from "src/lib/geometry/polygonXY"
import { addVectorToPointXY } from "src/integrations/building-systems-common/geometryHelpers"

function getCutPolygon(polygon: PolygonWithHolesXY, cuttingS: number, cuttingDirection: { x: number; y: number }) {
  const origin: PointXY = { x: 0, y: 0 }
  const cuttingNormal = { x: -cuttingDirection.y, y: cuttingDirection.x }
  const pCenterFront = addVectorToPointXY(origin, cuttingDirection, cuttingS)
  const pCenterBack = addVectorToPointXY(pCenterFront, cuttingDirection, -1000)

  const pLeftFront = addVectorToPointXY(pCenterFront, cuttingNormal, 500)
  const pRightFront = addVectorToPointXY(pCenterFront, cuttingNormal, -500)
  const pLeftBack = addVectorToPointXY(pCenterBack, cuttingNormal, 500)
  const pRightBack = addVectorToPointXY(pCenterBack, cuttingNormal, -500)

  const cuttingPolygon = { polygon: [pLeftFront, pLeftBack, pRightBack, pRightFront], holes: [] }

  return calculateDifference([polygon], [cuttingPolygon])
}

function makeWallsGeo(
  floorFootPrints: { id: string; footPrint: PolygonXY }[],
  wallElevation: number,
  wallHeight: number,
  cuttingS: number,
  verticalCuttingDirection: { x: number; y: number },
) {
  const blocks: Volume[] = []

  for (const footPrint of floorFootPrints) {
    const polygon = footPrint.footPrint
    const polygonWithHoles = { polygon, holes: [] }
    const cutSpacePolygons = getCutPolygon(polygonWithHoles, cuttingS, verticalCuttingDirection)
    for (const cutSpacePolygon of cutSpacePolygons) {
      const coordinates: [number, number][][] = [
        cutSpacePolygon.polygon.map(({ x, y }) => [x, y]),
        ...cutSpacePolygon.holes.map((hole) => hole.map(({ x, y }) => [x, y] as [number, number])),
      ]

      blocks.push({
        coordinates,
        height: wallHeight,
        elevation: wallElevation,
        color: "#fff",
      })
    }
  }
  return blocks
}

function makeFloorGeo(
  floor: Floor,
  elevation: number,
  thickness: number,
  cuttingS: number,
  cuttingDirection: { x: number; y: number },
): Volume[] {
  const blocks: Volume[] = []
  for (const space of Object.values(floor.spaces)) {
    const polygon = space.polygon.map((vertexId) => floor.graph.vertices[vertexId])
    const holes = space.holes.map((hole) => hole.map((vertexId) => floor.graph.vertices[vertexId]))
    const spacePolygon = { polygon, holes }
    const cutSpacePolygons = getCutPolygon(spacePolygon, cuttingS, cuttingDirection)
    for (const cutSpacePolygon of cutSpacePolygons) {
      const coordinates: [number, number][][] = [
        cutSpacePolygon.polygon.map(({ x, y }) => [x, y]),
        ...cutSpacePolygon.holes.map((hole) => hole.map(({ x, y }) => [x, y] as [number, number])),
      ]

      blocks.push({
        coordinates,
        height: thickness,
        elevation: elevation,
        color: "#e2e2e2",
      })
    }
  }
  return blocks
}

function makePreviewObjects(
  building: BasicBuilding,
  transform: Transform,
  floorSlice: number,
  cuttingS: number,
  verticalCuttingDirection: { x: number; y: number },
  footPrintsByFloor: { id: string; footPrint: PolygonXY }[][],
): RenderedObject[] {
  const volumes: Volume[] = []
  const FloorThickness = 0.4

  let elevation = 0
  for (let i = 0; i < building.floors.length; i++) {
    if (i >= floorSlice) break
    const floor = building.floors[i]

    const cutHeight = floorSlice < i + 1 ? floor.height * (floorSlice - i) : floor.height
    const thickness = Math.min(FloorThickness, cutHeight)

    volumes.push(...makeFloorGeo(floor, elevation, thickness, cuttingS, verticalCuttingDirection))

    const wallElevation = elevation + FloorThickness
    const wallHeight = Math.min(floor.height - FloorThickness, cutHeight - FloorThickness)
    if (wallHeight > 1e-4) {
      volumes.push(...makeWallsGeo(footPrintsByFloor[i], wallElevation, wallHeight, cuttingS, verticalCuttingDirection))
    }

    elevation += floor.height
  }

  const geometryData = makeBufferGeometryFromVolumes(volumes)
  return [
    {
      id: "geo",
      spec: "vertexColors",
      mode: "normal",
      geometryData: geometryData,
      transform,
    },
  ]
}

export const SlicingBuildingVisuals = ({
  basicBuilding,
  worldTransform,
  floorSlice,
  verticalDirectionAngle,
  verticalSlicingDistance,
}: {
  basicBuilding: BasicBuilding
  worldTransform: Matrix4
  floorSlice: number
  verticalDirectionAngle: number
  verticalSlicingDistance: number
}) => {
  const direction = useMemo(() => {
    const x = Math.cos(verticalDirectionAngle)
    const y = Math.sin(verticalDirectionAngle)
    return { x, y }
  }, [verticalDirectionAngle])

  const cuttingS = useMemo(() => {
    const points = basicBuilding.floors.flatMap((floor) => Object.values(floor.graph.vertices))
    let minS = Infinity
    let maxS = -Infinity
    points.forEach((point) => {
      const s = point.x * direction.x + point.y * direction.y
      minS = Math.min(minS, s)
      maxS = Math.max(maxS, s)
    })
    return minS + (maxS - minS) * verticalSlicingDistance - 1e-4
  }, [basicBuilding.floors, verticalSlicingDistance, direction.x, direction.y])

  const footPrintsByFloor = useMemo(() => {
    return basicBuilding.floors.map((floor) => getWallFootprints(floor))
  }, [basicBuilding])

  const renderAPI = useRenderAPI("basic-preview")

  useMemo(() => {
    const transform = worldTransform.toArray()
    for (const object of makePreviewObjects(
      basicBuilding,
      transform,
      floorSlice,
      cuttingS,
      direction,
      footPrintsByFloor,
    )) {
      renderAPI.upsert(object)
    }
  }, [basicBuilding, cuttingS, direction, floorSlice, footPrintsByFloor, renderAPI, worldTransform])

  return <></>
}
