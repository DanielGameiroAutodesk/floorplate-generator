import { BufferAttribute, BufferGeometry, Color, Matrix4 } from "three"
import type { FormaElement } from "@spacemakerai/element-types"
import { calculateEdgesGeometry, setGeometryColor } from "src/lib/three/geometryUtils"
import { newId, newRevision, replaceRevision } from "src/lib/element/urn"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { Point, Polygon } from "./types"
import type { PointXYZ } from "./roofs"
import { createGableRoof, generateFlatRoof, generateRoofByPolygon } from "./roofs"
import type { Volume } from "src/lib/three/build-25d-volume-boxes"
import { Float32Concat, makeBufferGeometryFromVolumes } from "src/lib/three/build-25d-volume-boxes"
import {
  applyRotationToPositions,
  buildBufferGeometry,
  calculateNormals,
  getWallBlocksFromPolygons,
} from "./geoBuilders"
import earcut from "earcut"
import type { GFAUnit, GrossFloorArea } from "src/lib/element/types"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"
import type { BuildingPieceMesh, VisualizationSettings } from "src/lib/visualizationSettings"
import { getUnitColor } from "src/lib/visualizationSettings"
import { areaOfPolygonWithHoles } from "src/lib/geometry/areaOfPolygon"
import { getRepresentationJsonUnsafe } from "@spacemakerai/elements-client"
import { transformNormal, transformPosition } from "src/lib/three/transform"
import { PROJECT_ID } from "src/core/project/project"

const rowHouseColors = {
  walls: "#ffffff",
  floor: "#ffffff",
  roof: "#f5f5f5",
  outline: "#808080",
}

export const defaultRowHouseParameters: RowHouseParameters = {
  buildingWidth: 6,
  buildingDepth: 9,
  numberOfStories: 2,
  storyHeight: 3,
  floorThickness: 0.2,
  roofThickness: 0.1,
  roofShape: "gable",
  roofRidgeDirection: 0,
  parkingOnParcel: false,
  roofAngle: 15,
  outerWallThickness: 0.2,
  typeName: "Default",
}

export type RowHouseParameters = {
  buildingWidth: number
  buildingDepth: number
  roofShape: "flat" | "shed" | "gable"
  roofRidgeDirection?: 0 | 90 | 180 | 270
  parkingOnParcel: boolean
  numberOfStories: number
  storyHeight: number
  roofThickness: number
  outerWallThickness: number
  floorThickness: number
  roofAngle: number
  typeName: string
  functionId?: string
}

function triangulateRectangularFacade(
  lowerLeft: [number, number],
  lowerRight: [number, number],
  wallToRoofHeight: number,
  elevation = 0,
) {
  const position = new Float32Array(18)
  position[0] = lowerLeft[0]
  position[1] = lowerLeft[1]
  position[2] = elevation
  position[3] = lowerRight[0]
  position[4] = lowerRight[1]
  position[5] = elevation
  position[6] = lowerRight[0]
  position[7] = lowerRight[1]
  position[8] = wallToRoofHeight + elevation

  position[9] = lowerRight[0]
  position[10] = lowerRight[1]
  position[11] = wallToRoofHeight + elevation
  position[12] = lowerLeft[0]
  position[13] = lowerLeft[1]
  position[14] = wallToRoofHeight + elevation
  position[15] = lowerLeft[0]
  position[16] = lowerLeft[1]
  position[17] = elevation

  return position
}

function buildSideWallsForGableRoof(width: number, depth: number, roofAngle: number, elevation: number) {
  const roofHeight = (depth / 2) * Math.tan(roofAngle * (Math.PI / 180))
  const lowerLeft: Point = [-width / 2, -depth / 2]
  const lowerRight: Point = [width / 2, -depth / 2]
  const upperRight: Point = [width / 2, depth / 2]
  const upperLeft: Point = [-width / 2, depth / 2]
  const leftSide = new Float32Array(9)
  leftSide[0] = lowerLeft[0]
  leftSide[1] = lowerLeft[1]
  leftSide[2] = elevation
  leftSide[3] = lowerLeft[0]
  leftSide[4] = 0
  leftSide[5] = roofHeight + elevation

  leftSide[6] = upperLeft[0]
  leftSide[7] = upperRight[1]
  leftSide[8] = elevation

  const rightSide = new Float32Array(9)

  rightSide[0] = lowerRight[0]
  rightSide[1] = lowerRight[1]
  rightSide[2] = elevation
  rightSide[3] = upperRight[0]
  rightSide[4] = upperRight[1]
  rightSide[5] = elevation

  rightSide[6] = lowerRight[0]
  rightSide[7] = 0
  rightSide[8] = roofHeight + elevation
  return { sideWallRight: rightSide, sideWallLeft: leftSide }
}

function buildSideWallsShedRoof(width: number, depth: number, wallToRoofHeight: number, wallsHeight: number) {
  const lowerLeft: Point = [-width / 2, -depth / 2]
  const lowerRight: Point = [width / 2, -depth / 2]
  const upperRight: Point = [width / 2, depth / 2]
  const upperLeft: Point = [-width / 2, depth / 2]
  const frontWall = triangulateRectangularFacade(lowerLeft, lowerRight, wallToRoofHeight, wallsHeight)
  const leftWall = new Float32Array(9)
  leftWall[0] = lowerLeft[0]
  leftWall[1] = lowerLeft[1]
  leftWall[2] = wallsHeight
  leftWall[3] = lowerLeft[0]
  leftWall[4] = lowerLeft[1]
  leftWall[5] = wallToRoofHeight + wallsHeight

  leftWall[6] = upperLeft[0]
  leftWall[7] = upperRight[1]
  leftWall[8] = wallsHeight
  const rightWall = new Float32Array(9)

  rightWall[0] = lowerRight[0]
  rightWall[1] = lowerRight[1]
  rightWall[2] = wallsHeight
  rightWall[3] = upperRight[0]
  rightWall[4] = upperRight[1]
  rightWall[5] = wallsHeight

  rightWall[6] = lowerRight[0]
  rightWall[7] = lowerRight[1]
  rightWall[8] = wallToRoofHeight + wallsHeight
  return { extraRightWall: rightWall, extraLeftWall: leftWall, extraFrontWall: frontWall }
}

export function buildGeometryFromPositionWithNormal(
  position: Float32Array,
  normal: Float32Array,
  elevation: number,
  color: string,
) {
  const roofGeometry = new BufferGeometry()
  roofGeometry.setAttribute("position", new BufferAttribute(position, 3))
  roofGeometry.setAttribute("normal", new BufferAttribute(normal, 3, false))
  setGeometryColor(new Color(color), roofGeometry)
  roofGeometry.applyMatrix4(new Matrix4().makeTranslation(0, 0, elevation))
  roofGeometry.computeBoundingBox()
  roofGeometry.computeBoundingSphere()
  return roofGeometry
}

export type RowhouseUrn = `urn:adsk-forma-elements:${typeof SYSTEM_NAME}:${string}:${string}:${string}`

export type RowhouseElement = {
  urn: RowhouseUrn
  gfaUnits_INTERNAL: GFAUnit[]
  properties: {
    generator: {
      generatorId: typeof generatorId
      parameters: RowHouseParameters
      templateUrn?: RowhouseUrn
    }
    functionId: string
    hasSemanticMesh?: boolean
    hasStableSemanticMesh?: boolean
    category: "building"
    rowHouseStats?: {
      rowHouseType: string
    }
  }
} & FormaElement

type GeneratedRowhouse = {
  outlines: Float32Array
  element: RowhouseElement
  geometry: BufferGeometry
  surfaces: {
    walls: { position: Float32Array; normal: Float32Array }[]
    roofs: { position: Float32Array; normal: Float32Array }[]
  }
}

//TODO find a real way to do this. Just for demos now
const typeColors: string[] = ["#FFF1C9", "#F7B7A3", "#EA5F89", "#9B3192", "#37505C", "#2C2C54"]

export const getRowHouseTypeColor = (rowHouseType: string) => {
  return typeColors[
    rowHouseType
      .split("")
      .map((c) => c.charCodeAt(0))
      .reduce((a, b) => a + b) % typeColors.length
  ]
}
const buildOutLines = (element: RowhouseElement) => {
  const { outlines } = generateRowHouse(element.properties.generator.parameters, PROJECT_ID)
  return outlines
}

function buildLinePositionsFromLines(lines3d: number[][][]) {
  let nPoints = 0
  for (let i = 0; i < lines3d.length; i++) {
    nPoints += lines3d[i].length
  }

  if (nPoints === 0) {
    return new Float32Array(0)
  }

  const nVals = (nPoints - 1) * 2 * 3
  const position = new Float32Array(nVals)
  let c = 0
  for (let i = 0; i < lines3d.length; i++) {
    for (let j = 0; j < lines3d[i].length - 1; j++) {
      position[c++] = lines3d[i][j][0]
      position[c++] = lines3d[i][j][1]
      position[c++] = lines3d[i][j][2]
      position[c++] = lines3d[i][j + 1][0]
      position[c++] = lines3d[i][j + 1][1]
      position[c++] = lines3d[i][j + 1][2]
    }
  }
  return position
}

function createRowHouseUrn(authContext: string, elementId?: string): RowhouseUrn {
  const tr00elementId = elementId || newId()
  const revision = newRevision()
  return `urn:adsk-forma-elements:${SYSTEM_NAME}:${authContext}:${tr00elementId}:${revision}`
}

function setFunctionId(rowHouseElement: RowhouseElement, functionId: string) {
  return {
    ...rowHouseElement,
    urn: replaceRevision(rowHouseElement.urn) as RowhouseUrn,
    properties: {
      ...rowHouseElement.properties,
      generator: {
        ...rowHouseElement.properties.generator,
        parameters: { ...rowHouseElement.properties.generator.parameters, functionId },
      },
      functionId,
    },
  }
}

// This is duplicated into parametric-element-api.
function getBuildingPolygonsFromParameters(buildingWidth: number, buildingDepth: number) {
  const lowerLeft: Point = [-buildingWidth / 2, -buildingDepth / 2]
  const lowerRight: Point = [buildingWidth / 2, -buildingDepth / 2]
  const upperRight: Point = [buildingWidth / 2, buildingDepth / 2]
  const upperLeft: Point = [-buildingWidth / 2, buildingDepth / 2]
  const outerWallsPolygon: Polygon = [lowerLeft, lowerRight, upperRight, upperLeft, lowerLeft]

  return { outerWallsPolygon }
}

const getBufferedPolygonByOuterWallThickness = (
  buildingWidth: number,
  buildingDepth: number,
  outerWallThickness: number,
): [number, number][] => {
  const { lowerLeft, lowerRight, upperRight, upperLeft } = getFootPrintPoints(buildingWidth, buildingDepth)
  return [
    [lowerLeft[0] + outerWallThickness, lowerLeft[1] + outerWallThickness],
    [lowerRight[0] - outerWallThickness, lowerLeft[1] + outerWallThickness],
    [upperRight[0] - outerWallThickness, upperRight[1] - outerWallThickness],
    [upperLeft[0] + outerWallThickness, upperLeft[1] - outerWallThickness],
    [lowerLeft[0] + outerWallThickness, lowerLeft[1] + outerWallThickness],
  ]
}

function buildOutlinesWalls(outerWallsPolygon: Point[], numberOfStories: number, storyHeight: number) {
  let cumElevation = storyHeight
  const lines3d: number[][][] = []
  for (let i = 0; i < numberOfStories; i++) {
    for (let i = 0; i < outerWallsPolygon.length - 1; i++) {
      lines3d.push([
        [outerWallsPolygon[i][0], outerWallsPolygon[i][1], cumElevation],
        [outerWallsPolygon[i + 1][0], outerWallsPolygon[i + 1][1], cumElevation],
      ])
    }
    cumElevation += storyHeight
  }

  for (let i = 0; i < outerWallsPolygon.length - 1; i++) {
    lines3d.push([
      [outerWallsPolygon[i][0], outerWallsPolygon[i][1], 0],
      [outerWallsPolygon[i][0], outerWallsPolygon[i][1], numberOfStories * storyHeight],
    ])
  }
  return buildLinePositionsFromLines(lines3d)
}

function getFootPrintPoints(buildingWidth: number, buildingDepth: number) {
  const lowerLeft: Point = [-buildingWidth / 2, -buildingDepth / 2]
  const lowerRight: Point = [buildingWidth / 2, -buildingDepth / 2]
  const upperRight: Point = [buildingWidth / 2, buildingDepth / 2]
  const upperLeft: Point = [-buildingWidth / 2, buildingDepth / 2]
  return { lowerLeft, lowerRight, upperRight, upperLeft }
}

type FootPrintPoints = {
  lowerLeft: Point
  lowerRight: Point
  upperRight: Point
  upperLeft: Point
}

function generateThinWalls(footPrintPoints: FootPrintPoints, wallsHeight: number) {
  const { lowerLeft, lowerRight, upperRight, upperLeft } = footPrintPoints
  const frontWall = triangulateRectangularFacade(lowerLeft, lowerRight, wallsHeight)
  const rightWall = triangulateRectangularFacade(lowerRight, upperRight, wallsHeight)
  const backWall = triangulateRectangularFacade(upperRight, upperLeft, wallsHeight)
  const leftWall = triangulateRectangularFacade(upperLeft, lowerLeft, wallsHeight)
  return { frontWall, rightWall, backWall, leftWall }
}

function buildWallsGeo(walls: Float32Array[], color: string) {
  const wallsPosition = Float32Concat(walls)
  const wallsGeo = new BufferGeometry()
  wallsGeo.setAttribute("position", new BufferAttribute(wallsPosition, 3))
  wallsGeo.setAttribute("normal", new BufferAttribute(calculateNormals(wallsPosition), 3, false))
  setGeometryColor(new Color(color), wallsGeo)
  wallsGeo.computeBoundingBox()
  wallsGeo.computeBoundingSphere()
  return wallsGeo
}

function buildWallsGeometry(
  outerWallsPolygon: Point[],
  outerWallThickness: number,
  numberOfStories: number,
  storyHeight: number,
  color: string,
) {
  let cumElevation = 0
  const wallsGeometry: BufferGeometry[] = []
  for (let i = 0; i < numberOfStories; i++) {
    getWallBlocksFromPolygons(
      [outerWallsPolygon],
      outerWallThickness,
      cumElevation,
      storyHeight,
      new Color(color),
    ).forEach((block) => {
      const buildingGeometry = buildBufferGeometry(block).clone()
      wallsGeometry.push(buildingGeometry)
    })
    cumElevation += storyHeight
  }
  return wallsGeometry
}

const flatRoofWalls = (parameters: RowHouseParameters, color: string) => {
  const { storyHeight, numberOfStories, outerWallThickness } = parameters
  const { roofDepth, roofWidth } = mapToHousingGeometryParameters(parameters)
  const footPrintPoints = getFootPrintPoints(roofWidth, roofDepth)
  const wallsHeight = storyHeight * numberOfStories
  const { outerWallsPolygon } = getBuildingPolygonsFromParameters(roofWidth, roofDepth)
  const wallsGeometry = buildWallsGeometry(outerWallsPolygon, outerWallThickness, numberOfStories, storyHeight, color)
  const { frontWall, rightWall, backWall, leftWall } = generateThinWalls(footPrintPoints, wallsHeight)

  return {
    wallsSurfaces: [
      { position: frontWall, normal: calculateNormals(frontWall) },
      { position: rightWall, normal: calculateNormals(rightWall) },
      { position: backWall, normal: calculateNormals(backWall) },
      { position: leftWall, normal: calculateNormals(leftWall) },
    ],
    wallsGeometry,
  }
}

// This is duplicated into parametric-element-api.
function extractGrossFloorUnitsRepresenation(
  numberOfStories: number,
  outerWallsPolygon: Point[],
  storyHeight: number,
  functionId?: string,
): GFAUnit[] {
  let cumElevation = 0
  const areas: GrossFloorArea[] = []

  for (let i = 0; i < numberOfStories; i++) {
    areas.push({
      elevation: cumElevation,
      coordinates: [outerWallsPolygon],
    })
    cumElevation += storyHeight
  }
  return [{ areas, areaType: "LIVING_UNIT", functionId }]
}

const buildFlatRoofRowHouse = (
  parameters: RowHouseParameters,
  color: (part: "roof" | "walls" | "floor", footprint: PolygonWithHolesXY[]) => string,
) => {
  const { roofThickness, storyHeight, numberOfStories, outerWallThickness } = parameters
  const { roofDepth, roofWidth } = mapToHousingGeometryParameters(parameters)

  const wallsHeight = storyHeight * numberOfStories
  const { outerWallsPolygon } = getBuildingPolygonsFromParameters(roofWidth, roofDepth)
  const footprintPolygon = { polygon: outerWallsPolygon.map(([x, y]) => ({ x, y })), holes: [] }
  //Build roof
  const { roofGeo, roofSurfaces } = generateFlatRoof({
    width: roofWidth,
    depth: roofDepth,
    roofThickness,
    outerWallThickness,
    elevation: wallsHeight,
    offsetRoof: -0.7,
    color: color("roof", Array(numberOfStories).fill(footprintPolygon)),
  })

  const wallColor = color("walls", Array(numberOfStories).fill(footprintPolygon))

  //Build floors
  const floorPolygon = getBufferedPolygonByOuterWallThickness(roofWidth, roofDepth, outerWallThickness)
  const floorsGeometry: BufferGeometry[] = []
  let cumElevation = 0
  for (let i = 0; i < numberOfStories; i++) {
    const block: Volume = {
      coordinates: [floorPolygon],
      elevation: cumElevation,
      height: parameters.floorThickness,
      color: wallColor,
    }
    const { position, normal } = makeBufferGeometryFromVolumes([block])
    const buildingGeometry = buildGeometryFromPositionWithNormal(position, normal, 0, wallColor)
    floorsGeometry.push(buildingGeometry)
    cumElevation += storyHeight
  }

  //Build Walls
  const { wallsSurfaces, wallsGeometry } = flatRoofWalls(parameters, wallColor)

  const roofRidgeDirection = parameters.roofRidgeDirection || 0
  const theta = (roofRidgeDirection * Math.PI) / 180
  const rotateMatrix = new Matrix4().makeRotationZ(theta)

  const buildingGeometry = mergeGeometries([...wallsGeometry, roofGeo, ...floorsGeometry]).applyMatrix4(rotateMatrix)
  const calculatedOutlines = calculateEdgesGeometry(buildingGeometry.clone())!

  return {
    buildingGeometry: buildingGeometry,
    surfaces: {
      roofs: roofSurfaces.map(({ position, normal }) => ({
        position: transformPosition(position, rotateMatrix),
        normal: transformNormal(normal, rotateMatrix),
      })),
      walls: wallsSurfaces.map(({ position, normal }) => ({
        position: transformPosition(position, rotateMatrix),
        normal: transformNormal(normal, rotateMatrix),
      })),
    },
    outlines: calculatedOutlines,
  }
}

const buildShedRoofRowHouse = (
  parameters: RowHouseParameters,
  color: (part: "roof" | "walls" | "floor", footprint: PolygonWithHolesXY[]) => string,
) => {
  const { roofThickness, roofAngle, storyHeight, numberOfStories } = parameters
  const { roofDepth, roofWidth, roofSideOffset, roofBackOffset, roofFrontOffSet } =
    mapToHousingGeometryParameters(parameters)

  const wallsHeight = storyHeight * numberOfStories
  const { outerWallsPolygon } = getBuildingPolygonsFromParameters(roofWidth, roofDepth)

  const footprintPolygon = { polygon: outerWallsPolygon.map(([x, y]) => ({ x, y })), holes: [] }
  // Build roof
  const height = (roofFrontOffSet + roofDepth) * Math.tan(roofAngle * (Math.PI / 180))
  const offSetHeight = roofBackOffset * Math.tan(roofAngle * (Math.PI / 180)) * -1

  const roofLowerLeft: Point = [-roofWidth / 2, -roofDepth / 2]
  const roofLowerRight: Point = [roofWidth / 2, -roofDepth / 2]
  const roofUpperRight: Point = [roofWidth / 2, roofDepth / 2]
  const roofUpperLeft: Point = [-roofWidth / 2, roofDepth / 2]

  //define roof as PointXYZ
  const roofPolygon: PointXYZ[] = [
    { x: roofLowerLeft[0] - roofSideOffset, y: roofLowerLeft[1] - roofFrontOffSet, z: height },
    { x: roofLowerRight[0] + roofSideOffset, y: roofLowerRight[1] - roofFrontOffSet, z: height },
    { x: roofUpperRight[0] + roofSideOffset, y: roofUpperRight[1] + roofBackOffset, z: offSetHeight },
    { x: roofUpperLeft[0] - roofSideOffset, y: roofUpperLeft[1] + roofBackOffset, z: offSetHeight },
  ]
  const { volume: roofVolumePosition, topside: roofTopsidePosition } = generateRoofByPolygon(roofPolygon, roofThickness)
  const roofVolumeNormal = calculateNormals(roofVolumePosition)
  const roofTopsideNormal = calculateNormals(roofTopsidePosition)
  const roofGeometry = buildGeometryFromPositionWithNormal(
    roofVolumePosition,
    roofVolumeNormal,
    wallsHeight,
    color("roof", Array(numberOfStories).fill(footprintPolygon)),
  )
  const roofOutlines = calculateEdgesGeometry(roofGeometry)!

  // Build floors
  const { position } = buildFloorGeometry(outerWallsPolygon, storyHeight, numberOfStories)
  const floorGeometry = buildGeometryFromPositionWithNormal(
    position,
    calculateNormals(position),
    0,
    color("floor", Array(numberOfStories).fill(footprintPolygon)),
  )
  // Build walls
  const footPrintPoints = getFootPrintPoints(roofWidth, roofDepth)
  const { frontWall, rightWall, backWall, leftWall } = generateThinWalls(footPrintPoints, wallsHeight)

  const roofHeight = roofDepth * Math.tan(roofAngle * (Math.PI / 180))
  const { extraFrontWall, extraLeftWall, extraRightWall } = buildSideWallsShedRoof(
    roofWidth,
    roofDepth,
    roofHeight,
    wallsHeight,
  )

  // adjust walls to fit roof
  const rightWallAdjusted = Float32Concat([leftWall, extraLeftWall])
  const leftWallAdjusted = Float32Concat([rightWall, extraRightWall])
  const frontWallAdjusted = Float32Concat([frontWall, extraFrontWall])
  const walls: Float32Array[] = [frontWallAdjusted, rightWallAdjusted, backWall, leftWallAdjusted]

  const wallsGeometry = buildWallsGeo(walls, color("walls", Array(numberOfStories).fill(footprintPolygon)))
  // Build outlines
  const wallOutlines = buildOutlinesWalls(outerWallsPolygon, numberOfStories, storyHeight)
  const extraShedWallOutlines = calculateEdgesGeometry(
    buildGeometryFromPositionWithNormal(
      frontWallAdjusted,
      calculateNormals(frontWallAdjusted),
      0,
      rowHouseColors.outline,
    ),
  )!

  const roofRidgeDirection = parameters.roofRidgeDirection || 0
  const theta = (roofRidgeDirection * Math.PI) / 180
  const rotateMatrix = new Matrix4().makeRotationZ(theta)
  const rotateAndLiftRooftopSurface = rotateMatrix.clone().multiply(new Matrix4().makeTranslation(0, 0, wallsHeight))

  const outlines = applyRotationToPositions(Float32Concat([wallOutlines, roofOutlines, extraShedWallOutlines]), theta)

  return {
    buildingGeometry: mergeGeometries([wallsGeometry, roofGeometry, floorGeometry]).applyMatrix4(rotateMatrix),
    surfaces: {
      walls: walls
        .map((position) => ({ position, normal: calculateNormals(position) }))
        .map(({ position, normal }) => ({
          position: transformPosition(position, rotateMatrix),
          normal: transformNormal(normal, rotateMatrix),
        })),
      roofs: [
        {
          position: transformPosition(roofTopsidePosition, rotateAndLiftRooftopSurface),
          normal: transformNormal(roofTopsideNormal, rotateAndLiftRooftopSurface),
        },
      ],
    },
    outlines,
  }
}

function buildFloorGeometry(outerWallsPolygon: Point[], storyHeight: number, numberOfStories: number) {
  let idx = 0
  const flatPoints: number[] = outerWallsPolygon.flat()
  const indices = earcut(flatPoints)
  const position = new Float32Array(indices.length * 3 * (numberOfStories + 1))
  //first floor
  for (let i = indices.length - 1; i >= 0; i--) {
    const index = indices[i]
    const point = outerWallsPolygon[index]
    position[idx] = point[0]
    position[idx + 1] = point[1]
    position[idx + 2] = 0
    // normal[idx] = 0
    // normal[idx + 1] = 0
    // normal[idx + 2] = -1
    idx += 3
  }
  let cumElevation = storyHeight
  for (let i = 0; i < numberOfStories; i++) {
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i]
      const point = outerWallsPolygon[index]
      position[idx] = point[0]
      position[idx + 1] = point[1]
      position[idx + 2] = cumElevation
      // normal[idx] = 0
      // normal[idx + 1] = 0
      // normal[idx + 2] = 1
      idx += 3
    }
    cumElevation += storyHeight
  }

  return { position }
}

function defaultColor(part: "roof" | "walls" | "floor"): string {
  return rowHouseColors[part]
}

const buildGableRoofRowHouse = (
  parameters: RowHouseParameters,
  color: (part: "roof" | "walls" | "floor", footprint: PolygonWithHolesXY[]) => string,
): BuildingGeometry => {
  const { roofThickness, roofAngle, storyHeight, numberOfStories } = parameters
  const { roofDepth, roofWidth, roofSideOffset, roofBackOffset } = mapToHousingGeometryParameters(parameters)

  const wallsHeight = storyHeight * numberOfStories
  const { outerWallsPolygon } = getBuildingPolygonsFromParameters(roofWidth, roofDepth)
  const footprintPolygon = { polygon: outerWallsPolygon.map(([x, y]) => ({ x, y })), holes: [] }

  // Build roof
  const { roofGeometry, roofSurfaces } = createGableRoof({
    width: roofWidth,
    depth: roofDepth,
    roofAngle,
    roofThickness,
    offsetBack: roofBackOffset,
    offsetSide: roofSideOffset,
    color: color("roof", Array(numberOfStories).fill(footprintPolygon)),
    elevation: wallsHeight,
  })

  const roofOutlines = calculateEdgesGeometry(roofGeometry)!
  // Build floors
  const { position } = buildFloorGeometry(outerWallsPolygon, storyHeight, numberOfStories)
  const floorGeometry = buildGeometryFromPositionWithNormal(
    position,
    calculateNormals(position),
    0,
    color("walls", Array(numberOfStories).fill(footprintPolygon)),
  )
  // Build walls
  const footPrintPoints = getFootPrintPoints(roofWidth, roofDepth)
  const { frontWall, rightWall, backWall, leftWall } = generateThinWalls(footPrintPoints, wallsHeight)
  const { sideWallRight, sideWallLeft } = buildSideWallsForGableRoof(roofWidth, roofDepth, roofAngle, wallsHeight)
  // Adjust walls to fit roof
  const rightWallAdjusted = Float32Concat([rightWall, sideWallRight])
  const leftWallAdjusted = Float32Concat([leftWall, sideWallLeft])
  const walls: Float32Array[] = [frontWall, rightWallAdjusted, leftWallAdjusted, backWall]
  const wallsGeo = buildWallsGeo(walls, color("walls", Array(numberOfStories).fill(footprintPolygon)))

  const roofRidgeDirection = parameters.roofRidgeDirection ?? 0
  const theta = (roofRidgeDirection * Math.PI) / 180
  const rotateMatrix = new Matrix4().makeRotationZ(theta)

  // Build outlines
  const buildingGeometry = mergeGeometries([wallsGeo, roofGeometry, floorGeometry]).applyMatrix4(rotateMatrix)

  const wallOutlines = buildOutlinesWalls(outerWallsPolygon, numberOfStories, storyHeight)
  const outlines = applyRotationToPositions(Float32Concat([wallOutlines, roofOutlines]), theta)

  const rotatedWallsSurfaces = walls
    .map((pos) => ({ position: pos, normal: calculateNormals(pos) }))
    .map(({ position, normal }) => ({
      position: transformPosition(position, rotateMatrix),
      normal: transformNormal(normal, rotateMatrix),
    }))

  const rotatedRoofSurfaces = roofSurfaces.map(({ position, normal }) => ({
    position: transformPosition(position, rotateMatrix),
    normal: transformNormal(normal, rotateMatrix),
  }))

  return {
    buildingGeometry,
    surfaces: {
      walls: rotatedWallsSurfaces,
      roofs: rotatedRoofSurfaces,
    },
    outlines,
  }
}

const getDefaultOffsetsByRoofShape = (roofAcross: boolean, roofShape: string) => {
  if (roofShape === "shed") {
    const roofFrontOffSet = roofAcross ? 0 : 0.3
    const roofBackOffset = roofAcross ? 0 : 0.5
    const roofSideOffset = roofAcross ? 0.2 : 0
    return { roofFrontOffSet, roofBackOffset, roofSideOffset }
  }
  if (roofShape === "gable") {
    const roofBackOffset = roofAcross ? 0 : 0.2
    const roofSideOffset = roofAcross ? 0.2 : 0
    return {
      roofBackOffset,
      roofFrontOffSet: roofBackOffset,
      roofSideOffset,
    }
  }
  if (roofShape === "flat") {
    return {
      roofBackOffset: 0,
      roofFrontOffSet: 0,
      roofSideOffset: 0,
    }
  }
  throw new Error("roof shape not supported")
}

type HousingGeometryParameters = {
  roofWidth: number
  roofDepth: number
  roofShape: "flat" | "shed" | "gable"
  numberOfStories: number
  storyHeight: number
  roofThickness: number
  outerWallThickness: number
  floorThickness: number
  roofAngle: number
  roofSideOffset: number
  roofBackOffset: number
  roofFrontOffSet: number
}

const mapToHousingGeometryParameters = (rowHouseParameters: RowHouseParameters): HousingGeometryParameters => {
  const { buildingWidth, buildingDepth, roofRidgeDirection, roofShape } = rowHouseParameters
  const roofAcross = roofRidgeDirection === 90 || roofRidgeDirection == 270
  const roofWidth = roofAcross ? buildingDepth : buildingWidth
  const roofDepth = roofAcross ? buildingWidth : buildingDepth
  const { roofFrontOffSet, roofBackOffset, roofSideOffset } = getDefaultOffsetsByRoofShape(roofAcross, roofShape)
  return {
    ...rowHouseParameters,
    roofWidth,
    roofDepth,
    roofSideOffset,
    roofFrontOffSet,
    roofBackOffset,
  }
}

type BuildingGeometry = {
  surfaces: {
    roofs: { position: Float32Array; normal: Float32Array }[]
    walls: { position: Float32Array; normal: Float32Array }[]
  }
  outlines: Float32Array
  buildingGeometry: BufferGeometry
}

const buildHousingGeometry = (
  parameters: RowHouseParameters,
  color: (part: "roof" | "walls" | "floor", footprint: PolygonWithHolesXY[]) => string = defaultColor,
): BuildingGeometry => {
  const roofShape = parameters.roofShape
  if (roofShape === "gable") {
    return buildGableRoofRowHouse(parameters, color)
  }
  if (roofShape === "shed") {
    return buildShedRoofRowHouse(parameters, color)
  }
  if (roofShape === "flat") {
    return buildFlatRoofRowHouse(parameters, color)
  }
  throw new Error("roof shape not supported")
}

function createVisualizationMesh(
  rowhouseElement: RowhouseElement,
  visualizationSettings: VisualizationSettings,
): BufferGeometry {
  function color(part: "walls" | "roof" | "floor", polygon: PolygonWithHolesXY[]) {
    return getUnitColor(
      { functionId: rowhouseElement.properties.functionId, program: "LIVING_UNIT" },
      polygon,
      visualizationSettings,
    )
  }
  return buildHousingGeometry(rowhouseElement.properties.generator.parameters, color).buildingGeometry
}

function generateUnitVisualization(element: RowhouseElement): BuildingPieceMesh[] {
  const parameters = element.properties.generator.parameters
  const geo = buildHousingGeometry(parameters).buildingGeometry
  geo.computeVertexNormals()

  const gfaUnits = element.representations?.gfaUnits
    ? getRepresentationJsonUnsafe(element.representations.gfaUnits)
    : undefined

  return (
    gfaUnits?.map(
      (gfaUnit): BuildingPieceMesh => ({
        info: {
          functionId: gfaUnit.functionId,
          areaType: gfaUnit.areaType,
          area: gfaUnit.areas.reduce(
            (prev, polygons) =>
              prev +
              areaOfPolygonWithHoles({
                polygon: polygons.coordinates[0].map(([x, y]) => ({ x, y })),
                holes: polygons.coordinates.slice(1).map((poly) => poly.map(([x, y]) => ({ x, y }))),
              }),
            0,
          ),
        },
        geo: {
          position: geo.getAttribute("position").array as Float32Array,
          normal: geo.getAttribute("normal").array as Float32Array,
        },
      }),
    ) ?? []
  )
}

const generateRowHouse = (parameters: RowHouseParameters, authContext: string): GeneratedRowhouse => {
  const { numberOfStories, storyHeight } = parameters

  const { buildingGeometry, surfaces, outlines } = buildHousingGeometry(parameters)

  const elementId = newId()
  const urn: RowhouseUrn = createRowHouseUrn(authContext, elementId)
  const gfaPolygon = getBuildingPolygonsFromParameters(
    parameters.buildingWidth,
    parameters.buildingDepth,
  ).outerWallsPolygon

  const gfaUnits = extractGrossFloorUnitsRepresenation(numberOfStories, gfaPolygon, storyHeight, parameters.functionId)

  const element: RowhouseElement = {
    urn: urn,
    gfaUnits_INTERNAL: gfaUnits,
    properties: {
      generator: { generatorId, parameters },
      category: "building",
      //TODO this should be unnecessary when we have backend support for generators
      hasSemanticMesh: true,
      hasStableSemanticMesh: true,
      functionId: parameters.functionId || "unspecified",
      rowHouseStats: {
        rowHouseType: parameters.typeName,
      },
    },
    representations: {
      gfaUnits: {
        type: "embedded-json",
        data: gfaUnits,
      },
    },
  }
  return {
    outlines,
    surfaces,
    element,
    geometry: buildingGeometry,
  }
}

const generatorId = "row-house-v0.2"

const setRowHouseTypeName = (rowHouseElement: RowhouseElement, typeName: string): RowhouseElement => {
  return {
    ...rowHouseElement,
    urn: replaceRevision(rowHouseElement.urn) as RowhouseUrn,
    properties: {
      ...rowHouseElement.properties,
      generator: {
        ...rowHouseElement.properties.generator,
        parameters: { ...rowHouseElement.properties.generator.parameters, typeName },
      },
    },
  }
}
const isRowHouseElement = (element?: FormaElement): element is RowhouseElement => {
  return element?.properties?.generator?.generatorId === generatorId
}

const getRowHouseType = (element: RowhouseElement) => {
  //TODO find a better place for this?
  return element.properties.generator.parameters.typeName || "custom"
}

const SYSTEM_NAME = "parametric"

export interface RowHouseApi {
  generateRowHouse: (parameters: RowHouseParameters, authContext: string) => GeneratedRowhouse
  getTemplateName: (element: RowhouseElement) => string
  setRowHouseType: (element: RowhouseElement, typeName: string) => RowhouseElement
  setFunctionId: (element: RowhouseElement, functionId: string) => RowhouseElement
  buildOutLines: (element: RowhouseElement) => Float32Array
  generatorId: string
  isRowHouseElement: (element?: FormaElement) => element is RowhouseElement
  elementSystemName: typeof SYSTEM_NAME
  createRowHouseUrn: (authContext: string, elementId?: string) => RowhouseUrn
  createVisualizationMesh: (
    rowhouseElement: RowhouseElement,
    visualizationSettings: VisualizationSettings,
  ) => BufferGeometry
  generateUnitVisualization: (element: RowhouseElement) => BuildingPieceMesh[]
}

export const rowHouseApi: RowHouseApi = {
  generateRowHouse,
  buildOutLines,
  setFunctionId,
  setRowHouseType: setRowHouseTypeName,
  getTemplateName: getRowHouseType,
  isRowHouseElement,
  generatorId,
  elementSystemName: SYSTEM_NAME,
  createRowHouseUrn,
  createVisualizationMesh,
  generateUnitVisualization,
}
