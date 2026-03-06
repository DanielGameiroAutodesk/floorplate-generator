import type { BuildingBlock } from "./helpers/apartmentBuildingsGeo"
import { buildGeoFromBuildingBlocks, makeGeoFromBlocks, makeLinesFromBlocks } from "./helpers/apartmentBuildingsGeo"
import type { BufferGeometry } from "three"
import type { FormaElement, Urn, Volume25DCollection } from "@spacemakerai/element-types"

import type { InternalPath } from "src/lib/element/path"
import { newId, newRevision, parseUrn } from "src/lib/element/urn"
import type { SimpleBuilding } from "src/integrations/building-systems-simple-buildings/simpleBuilding"
import { simpleBuildingsToVolume25DCollection } from "src/integrations/building-systems-simple-buildings/simpleBuildingToVolumes25DCollection"
import {
  getGrossFloorUnitsRepr,
  simpleBuildingToGrossFloorPolygons,
} from "src/integrations/building-systems-simple-buildings/toGrossFloorReps"
import { getSelectionOutlineForLineBuilding } from "./selectionOutline/selectionOutline"
import { captureException } from "@sentry/browser"
import {
  buildAnalysisBuildingGeo,
  simpleBuildingToAnalysisBuilding,
} from "src/integrations/building-systems-analysis-building/utils"
import type { BuildingPieceMesh, VisualizationSettings } from "src/lib/visualizationSettings"
import { getUnitColor } from "src/lib/visualizationSettings"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"
import { buildGeometryForVolume } from "src/integrations/building-systems-common/buildGeoWithHoles"
import { areaOfPolygonWithHoles } from "src/lib/geometry/areaOfPolygon"
import type { FormaElementLookup } from "src/lib/element/lookup"
import type { LineBuildingFormaElement } from "./lineBuildingFormaElement"
import { lineBuildingGeneratorId } from "./lineBuildingFormaElement"
import { createAnalysisBuildingsSemanticMeshGlb } from "src/integrations/building-systems-analysis-building/semanticMesh"
import { PROJECT_ID } from "src/core/project/project"

import type { Action } from "src/core/legacy-actions"
import { getBakeToSimpleBuildings as sharedGetBakeToSimpleBuildings } from "@spacemakerai/line-buildings-shared/lineBuildingSharedApi"
import { getCCWPolygon } from "src/integrations/building-systems-common/geoHelpers"
import { getCWPolygon } from "@spacemakerai/line-buildings-shared/helpers/geoHelpers"
import { lineBuildingGenerator } from "@spacemakerai/line-buildings-shared/lineBuilding"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { Graph } from "@spacemakerai/line-buildings-shared/shapeHelpers"

// HitBoxes
export type HitBox = {
  geometry: BufferGeometry
  linesGeometry: Float32Array
  sectionNumber: number
  hitBoxID: string
  id: string
}

function makeApartmentBuildingSectionHitBoxes(parameters: LineBuildingParameters) {
  const graph = parameters.graph
  const hitBoxes: Record<string, HitBox> = {}
  const { floorHeight, sectionToggle } = parameters

  const { simpleBuildings, sections, sectionProps } = lineBuildingGenerator.generate(graph, parameters, [])
  if (!sectionToggle) {
    const buildingId = "wholeBuilding::" + Object.keys(graph.vertices).concat(Object.keys(graph.edges)).join("")
    const volumes = simpleBuildings.flatMap((b) =>
      b.floors[0].outerShapes.map((polyWithHoles) => ({
        coordinates: [polyWithHoles.polygon, ...polyWithHoles.holes],
        elevation: 0,
        height: b.floors.reduce((acc, f) => acc + f.height, 0),
      })),
    )
    const linesGeometry = makeLinesFromBlocks(volumes)
    const geometry = makeGeoFromBlocks(volumes)
    hitBoxes[buildingId] = {
      geometry,
      linesGeometry,
      sectionNumber: 0,
      hitBoxID: buildingId,
      id: buildingId,
    }
    return hitBoxes
  }

  Object.keys(sections).forEach((sectionID) => {
    const vertexEdgeID = sectionID.split("::")[0]
    const sectionNumber = parseInt(sectionID.split("::")[1])
    const section = sections[sectionID]
    const numberOfFloors = sectionProps[sectionID].numberOfFloors
    const polygon = section.footPrint
    const coordinates = [polygon]
    const volume = {
      coordinates,
      elevation: 0,
      height: floorHeight * numberOfFloors,
    }
    const linesGeometry = makeLinesFromBlocks([volume])
    const geometry = makeGeoFromBlocks([volume])
    hitBoxes[sectionID] = {
      geometry,
      linesGeometry,
      sectionNumber: sectionNumber,
      hitBoxID: sectionID,
      id: vertexEdgeID,
    }
  })

  return hitBoxes
}

/////
//
///

function simpleBuildingsToBuildingBlocks(simpleBuildings: SimpleBuilding[]): BuildingBlock[] {
  const blocks: BuildingBlock[] = []
  simpleBuildings.forEach((simpleBuilding) => {
    const floors = simpleBuilding.floors
    let elevation = 0
    floors.forEach((floor) => {
      const height = floor.height
      if (floor.content?.type === "floorPlan") {
        const units = floor.content.units
        units.forEach((unit) => {
          const polygon = getCCWPolygon(unit.polygon)
          const holes = unit.holes.map((hole) => getCWPolygon(hole))
          const coordinates = [polygon, ...holes]
          const block: BuildingBlock = { coordinates, elevation, height, structureType: unit.type || "LIVING_UNIT" }
          blocks.push(block)
        })
      } else {
        const outerShapes = floor.outerShapes
        outerShapes.forEach((outerShape) => {
          const polygon = getCCWPolygon(outerShape.polygon)
          const holes = outerShape.holes.map((hole) => getCWPolygon(hole))
          const coordinates = [polygon, ...holes]
          const block: BuildingBlock = { coordinates, elevation, height, structureType: "LIVING_UNIT" }
          blocks.push(block)
        })
      }
      elevation += height
    })
  })
  return blocks
}

function buildBuildingBlocksLineGeo(buildingBlocks: BuildingBlock[]) {
  const lines: number[] = []
  for (let block of buildingBlocks) {
    const { elevation, height, coordinates } = block
    for (const polygon of coordinates) {
      const n = polygon.length
      for (let i = 0; i < n; i++) {
        const [x0, y0] = polygon[i]
        const [x1, y1] = polygon[(i + 1) % n]
        const zLow = elevation
        const zHigh = elevation + height
        const lowLine = [x0, y0, zLow, x1, y1, zLow]
        const highLine = [x0, y0, zHigh, x1, y1, zHigh]
        const sideLine = [x1, y1, zLow, x1, y1, zHigh]
        lines.push(...lowLine, ...highLine, ...sideLine)
      }
    }
  }
  const positions = new Float32Array(lines)
  return { attributes: { positions }, uniforms: { color: "#222", lineWidth: 1 } }
}

function makeApartmentBuildingsWithGeo({
  graph,
  parameters,
  customLayouts,
}: {
  graph: Graph
  parameters: LineBuildingParameters
  customLayouts: CustomLayout[]
}) {
  const { sectionProps, sections, simpleBuildings } = lineBuildingGenerator.generate(graph, parameters, customLayouts)

  const buildingBlocks = simpleBuildingsToBuildingBlocks(simpleBuildings)

  const useAnalysisBuilding = window.location.search.includes("analysisBuilding")
  const analysisBuildings = useAnalysisBuilding ? simpleBuildings.map(simpleBuildingToAnalysisBuilding) : undefined
  const geometry = analysisBuildings
    ? buildAnalysisBuildingGeo(analysisBuildings)
    : buildGeoFromBuildingBlocks(buildingBlocks)

  const lineGeometry = buildBuildingBlocksLineGeo(buildingBlocks)

  const updatedParametersWithGraph = { ...parameters, sectionProps, sections, graph }
  return { geometry, lineGeometry, updatedParametersWithGraph, simpleBuildings, analysisBuildings }
}

function makeApartmentBuildingGeoWithElement(
  graph: Graph,
  parameters: LineBuildingParameters,
  customLayouts: CustomLayout[],
  existingElement?: FormaElement,
) {
  const { geometry, lineGeometry, updatedParametersWithGraph, simpleBuildings, analysisBuildings } =
    makeApartmentBuildingsWithGeo({
      graph,
      parameters,
      customLayouts,
    })
  const SYSTEM_NAME = "parametric"
  const authContext = PROJECT_ID
  const elementId = existingElement ? parseUrn(existingElement.urn).id : newId()
  const revision = newRevision()
  const gfaUnits = getGrossFloorUnitsRepr(simpleBuildings, updatedParametersWithGraph.functionId as string)
  const generatorElement: LineBuildingFormaElement = {
    urn: `urn:adsk-forma-elements:${SYSTEM_NAME}:${authContext}:${elementId}:${revision}`,
    volume25DCollection_INTERNAL:
      simpleBuildings.length > 0 ? simpleBuildingsToVolume25DCollection(simpleBuildings, elementId) : undefined,
    gfaUnits_INTERNAL: gfaUnits,
    properties: {
      ...existingElement?.properties,
      areaStatsReps: {
        grossFloorPolygonsV2: simpleBuildings.flatMap(simpleBuildingToGrossFloorPolygons),
      },
      functionId: updatedParametersWithGraph.functionId,
      generator: { generatorId: "quick-draw-apartment-building-v0", parameters: updatedParametersWithGraph },
      category: "building",
      hasSemanticMesh: true,
      hasStableSemanticMesh: true,
    },
    representations: {
      gfaUnits: {
        type: "embedded-json",
        data: getGrossFloorUnitsRepr(simpleBuildings, updatedParametersWithGraph.functionId as string),
      },
    },
  }
  if (analysisBuildings) {
    generatorElement.properties.analysisBuildings = analysisBuildings
  }
  return {
    geometry,
    lineGeometry,
    element: generatorElement,
  }
}

async function createSemanticMeshGlbForParameters(parameters: LineBuildingParameters) {
  const { graph, customLayouts } = parameters

  const { simpleBuildings } = lineBuildingGenerator.generate(graph, parameters, customLayouts)
  const analysisBuildings = simpleBuildings.map(simpleBuildingToAnalysisBuilding)

  return createAnalysisBuildingsSemanticMeshGlb(analysisBuildings)
}

//////////
// API
///

export namespace lineBuildingApi {
  export const SYSTEM_NAME = "parametric"
  export const GENERATOR_ID = lineBuildingGeneratorId

  export function isLineBuildingFormaElement(element: FormaElement | undefined): element is LineBuildingFormaElement {
    return element?.properties?.generator?.generatorId === GENERATOR_ID
  }

  export const runLive = (parameters: LineBuildingParameters, customLayouts: CustomLayout[] = []) => {
    const graph = parameters.graph
    const { geometry, lineGeometry, updatedParametersWithGraph } = makeApartmentBuildingsWithGeo({
      graph,
      parameters,
      customLayouts,
    })
    return {
      geometry,
      lineGeometry,
      liveParameters: updatedParametersWithGraph,
    }
  }
  export const run = (parameters: LineBuildingParameters) => {
    return makeApartmentBuildingGeoWithElement(parameters.graph, parameters, parameters.customLayouts)
  }

  export const update = (parameters: LineBuildingParameters, existingElement: FormaElement) => {
    return makeApartmentBuildingGeoWithElement(parameters.graph, parameters, parameters.customLayouts, existingElement)
  }

  export const getBakeToSimpleBuildings = sharedGetBakeToSimpleBuildings

  export const getSectionHitBoxes = (parameters: LineBuildingParameters): Record<string, HitBox> => {
    return makeApartmentBuildingSectionHitBoxes(parameters)
  }
  export const setFunctionId = (
    elements: { path: InternalPath; element: FormaElement }[],
    functionId: string,
  ): Action[] => {
    return elements.map(({ path, element }) => {
      const parameters = element.properties?.generator.parameters
      const updatedParameters = { ...parameters, functionId }
      const { element: updatedElement } = lineBuildingApi.run(updatedParameters)
      return {
        type: "update",
        element: updatedElement,
        path: path,
        cloneGeometry: true,
        persisted: false,
      }
    })
  }

  export const getFunctionIds = (urn: Urn, elements: FormaElementLookup) => {
    const functionId = elements.get(urn)?.properties?.functionId || "unspecified"
    return [functionId]
  }

  export const getSelectionOutline = (element: any): Float32Array | undefined => {
    const parameters = element.properties.generator.parameters
    if (parameters?.properties?.generator?.generatorId !== lineBuildingApi.GENERATOR_ID) return undefined
    try {
      return getSelectionOutlineForLineBuilding({ graph: parameters.graph, parameters, lowestZ: 0 })
    } catch (e) {
      console.error("Line Buildings error: ", e)
      captureException(e, { tags: { owner: "squad-composition" } })
    }
    return undefined
  }
  export const generateVolume25D = (element: FormaElement): Volume25DCollection | undefined => {
    const lineBuildingParameters = element?.properties?.generator.parameters as LineBuildingParameters
    const customLayouts = lineBuildingParameters.customLayouts || []
    const simpleBuilding = lineBuildingApi.getBakeToSimpleBuildings(lineBuildingParameters, customLayouts)
    const elementId = parseUrn(element.urn).id
    return simpleBuildingsToVolume25DCollection(simpleBuilding, elementId)
  }

  export function generateUnitVisualization(element: FormaElement): BuildingPieceMesh[] {
    const lineBuildingParameters = element?.properties?.generator.parameters as LineBuildingParameters
    const customLayouts = lineBuildingParameters.customLayouts || []
    const simpleBuildings = lineBuildingApi.getBakeToSimpleBuildings(lineBuildingParameters, customLayouts)
    const buildingBlocks = simpleBuildingsToBuildingBlocks(simpleBuildings)
    return buildingBlocks.map((block): BuildingPieceMesh => {
      const [outer, ...holes] = block.coordinates
      const polygonWithHoles: PolygonWithHolesXY = {
        polygon: outer.map(([x, y]) => ({ x, y })),
        holes: holes.map((hole) => hole.map(([x, y]) => ({ x, y }))),
      }
      const { position, normal } = buildGeometryForVolume(block)

      return {
        info: {
          functionId: element.properties?.functionId,
          areaType: block.structureType,
          area: areaOfPolygonWithHoles(polygonWithHoles),
        },
        geo: { position, normal },
      }
    })
  }

  export function generateVisualizationMesh(element: FormaElement, visualizationSettings: VisualizationSettings) {
    const lineBuildingParameters = element?.properties?.generator.parameters as LineBuildingParameters
    const customLayouts = lineBuildingParameters.customLayouts || []
    const simpleBuildings = lineBuildingApi.getBakeToSimpleBuildings(lineBuildingParameters, customLayouts)
    const buildingBlocks = simpleBuildingsToBuildingBlocks(simpleBuildings)
    function getColorForBlock(program: string, unitGroundPolygon: PolygonWithHolesXY) {
      return getUnitColor(
        { functionId: element.properties?.functionId, program },
        [unitGroundPolygon],
        visualizationSettings,
      )
    }
    return buildGeoFromBuildingBlocks(buildingBlocks, getColorForBlock)
  }

  export async function createSemanticMeshGlb(element: LineBuildingFormaElement) {
    return createSemanticMeshGlbForParameters(element.properties.generator.parameters)
  }

  export function generateSimpleBuildings(element: FormaElement): SimpleBuilding[] {
    if (!isLineBuildingFormaElement(element)) throw new Error("lineBuildingApi used on non-line building element")
    const lineBuildingParameters = element.properties.generator.parameters
    const customLayouts = lineBuildingParameters.customLayouts || []
    return lineBuildingApi.getBakeToSimpleBuildings(lineBuildingParameters, customLayouts)
  }
}
