import type { Child, FormaElement, Transform, Urn } from "@spacemakerai/element-types"
import type { Polygon, PolygonWithHoles } from "./lib/geometry/geometry"
import {
  calculateUnionOfPolygonsWithHoles,
  isPolygonClosed,
  makePolygonCounterClockwise,
  polygonWithHolesFromXY,
  removeLastPointInPolygonIfEqualsFirst,
} from "./lib/geometry/geometry"
import { BufferAttribute, BufferGeometry, EdgesGeometry, Matrix4 } from "three"
import { newChildKey, parseUrn } from "src/lib/element/urn"
import type { Volume } from "src/lib/three/build-25d-volume-boxes"
import { makeBufferGeometryFromVolumes } from "src/lib/three/build-25d-volume-boxes"
import {
  buildAnalysisBuildingGeo,
  insertPointsOnLines,
  simpleBuildingToAnalysisBuilding,
} from "src/integrations/building-systems-analysis-building/utils"
import type { SimpleBuilding } from "src/integrations/building-systems-simple-buildings/simpleBuilding"
import { makeBuildingHitboxes } from "./build-geometry"
import { type Action, actionApi, type ActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { fromFormaElementBoxMap } from "src/integrations/legacy-actions/ActionAPI"
import type { Shape } from "src/lib/three/Shape/types"
import { PROJECT_ID } from "src/core/project/project"
import type { RenderedObject } from "src/integrations/render-api/RenderAPI"
import { getElementsClient } from "src/core/elements-loading/loading"
import { cleanupDeadUnitRefs, getPolygonWithHolesFromSpace, getUnitLookup, randomId } from "./lib/utils"
import type { BasicBuilding, BasicBuildingElement, Floor, Space, Spaces, Unit } from "./lib/types"
import { constructFloorUrnId, extractGrossFloorAreaPolygons, toElements } from "./lib/convert"
import type { Edges, Graph, Vertex, Vertices } from "./lib/graph/graph"
import { getParentPath } from "src/lib/element/path"
import { isDefined } from "src/lib/array"
import type { SeverityLevel } from "@sentry/browser"
import { captureException } from "@sentry/browser"
import type { BuildingPieceMesh, VisualizationSettings } from "src/lib/visualizationSettings"
import { getUnitColor } from "src/lib/visualizationSettings"
import type { PolygonWithHolesXY, PolygonXY } from "src/lib/geometry/polygonXY"
import { buildGeometryForVolume } from "src/integrations/building-systems-common/buildGeoWithHoles"
import { areaOfPolygonWithHoles } from "src/lib/geometry/areaOfPolygon"
import { createElementBoxMapFromDraftElements } from "src/lib/element/statebox"
import type { FormaElementLookup } from "src/lib/element/lookup"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"
import { EventName } from "@spacemakerai/webapp-analytics"

function roundingNumber(value: number, base: number) {
  return Math.round(value * 10 ** base) / 10 ** base
}
function createBasicBuilding(polygon: PolygonXY, height: number, storyHeight: number): BasicBuilding {
  const floors: Floor[] = []
  const units: Unit[] = []
  const heightDividedByStoryHeight = roundingNumber(height / storyHeight, 5)
  const nofFloors = height < storyHeight ? 1 : Math.floor(heightDividedByStoryHeight)
  const vertexPolygon: Vertex[] = polygon.map((point) => {
    const id = randomId()
    return { ...point, id }
  })
  const space: Space = { id: randomId(), polygon: vertexPolygon.map((v) => v.id), holes: [], program: undefined }
  const spaces: Spaces = { [space.id]: space }
  const edges: Edges = {}
  const vertices: Vertices = {}
  const n = vertexPolygon.length
  for (let i = 0; i < vertexPolygon.length; i++) {
    if (i === n - 1 && isPolygonClosed(vertexPolygon)) break
    const edgeId = randomId()
    edges[edgeId] = { start: vertexPolygon[i].id, end: vertexPolygon[(i + 1) % n].id, id: edgeId }
    vertices[vertexPolygon[i].id] = vertexPolygon[i]
  }
  const graph: Graph = { vertices, edges }
  for (let i = 0; i < nofFloors; i++) {
    const floorHeight = i > 0 ? storyHeight : roundingNumber(height - storyHeight * (nofFloors - 1), 5)
    const floorId = randomId()
    const floor: Floor = { id: floorId, graph, spaces, height: floorHeight }
    const unit: Unit = { id: randomId(), spaces: [{ spaceId: space.id, floorId: floor.id }], program: undefined }
    floors.push(floor)
    units.push(unit)
  }
  return { floors, units }
}

// export const UNIT_PROGRAM_COLORS: Record<string, string> = {
//   livingunit: "#e3ddaa",
//   office: "#c2a3ce",
//   restaurant: "#aef6af",
//   circulation: "#cceee6",
//   __default__: "#ffffff",
// }

function createBufferGeometryFromBlocks(blocks: Volume[]) {
  const { position, normal, color } = makeBufferGeometryFromVolumes(blocks)
  const bufferGeometry = new BufferGeometry()
  bufferGeometry.setAttribute("position", new BufferAttribute(position, 3))
  bufferGeometry.setAttribute("normal", new BufferAttribute(normal, 3))
  bufferGeometry.setAttribute("color", new BufferAttribute(color, 3, true))
  return bufferGeometry
}

function makeFloorGeometry(
  floor: Floor,
  unitLookup: (floorId: string, spaceId: string) => Unit | undefined,
  currentElevation: number,
  visualizationSettings?: VisualizationSettings,
) {
  const blocks: Volume[] = []
  for (const space of Object.values(floor.spaces)) {
    const unit = unitLookup(floor.id, space.id)
    if (!unit) console.warn("missing unit for space!", floor.id, space.id)
    const coordinates: [number, number][][] = [
      space.polygon.map((s) => floor.graph.vertices[s]).map(({ x, y }) => [x, y]),
      ...space.holes.map((hole) =>
        hole.map((s) => floor.graph.vertices[s]).map(({ x, y }) => [x, y] as [number, number]),
      ),
    ]
    space.program
    blocks.push({
      coordinates,
      height: floor.height,
      elevation: currentElevation,
      color: getUnitColor(unit!, [getPolygonWithHolesFromSpace(space, floor.graph)], visualizationSettings),
    })
  }
  return createBufferGeometryFromBlocks(blocks)
}

function makeBufferGeometries(building: BasicBuilding, excludeFloorIndices?: number[]) {
  const unitLookup = getUnitLookup(building.units)
  let currentElevation = 0
  const floorsGeometries: BufferGeometry[] = []
  for (let floorIndex = 0; floorIndex < building.floors.length; floorIndex++) {
    const floor = building.floors[floorIndex]
    if (!excludeFloorIndices?.includes(floorIndex)) {
      floorsGeometries.push(makeFloorGeometry(floor, unitLookup, currentElevation))
    }
    currentElevation += floor.height
  }
  return floorsGeometries
}

function makeUnitMeshes(element: BasicBuildingElement): BuildingPieceMesh[] {
  const building = element.representations.__INTERNAL__.data
  const unitLookup = getUnitLookup(building.units)
  let currentElevation = 0

  const unitMeshes: BuildingPieceMesh[] = []

  for (let floorIndex = 0; floorIndex < building.floors.length; floorIndex++) {
    const floor = building.floors[floorIndex]
    for (const space of Object.values(floor.spaces)) {
      const unit = unitLookup(floor.id, space.id)
      const coordinates: [number, number][][] = [
        space.polygon.map((s) => floor.graph.vertices[s]).map(({ x, y }) => [x, y]),
        ...space.holes.map((hole) =>
          hole.map((s) => floor.graph.vertices[s]).map(({ x, y }) => [x, y] as [number, number]),
        ),
      ]
      const volume = {
        coordinates,
        height: floor.height,
        elevation: currentElevation,
      }

      const { position, normal } = buildGeometryForVolume(volume)

      const polygonWithHoles: PolygonWithHolesXY = {
        polygon: space.polygon.map((s) => floor.graph.vertices[s]),
        holes: space.holes.map((polygon) => polygon.map((s) => floor.graph.vertices[s])),
      }

      unitMeshes.push({
        info: {
          functionName: unit?.function,
          functionId: unit?.functionId,
          areaType: unit?.program,
          area: areaOfPolygonWithHoles(polygonWithHoles),
        },
        geo: { position, normal },
      })
    }
    currentElevation += floor.height
  }

  return unitMeshes
}

export function makeBufferGeometryMap(element: BasicBuildingElement, visualizationSettings?: VisualizationSettings) {
  const results = new Map<Urn, BufferGeometry>()
  const parsedUrn = parseUrn(element.urn)
  const building = element.representations.__INTERNAL__.data
  const unitLookup = getUnitLookup(building.units)
  let currentElevation = 0
  for (let floorIndex = 0; floorIndex < building.floors.length; floorIndex++) {
    const floor = building.floors[floorIndex]
    const geo = makeFloorGeometry(floor, unitLookup, currentElevation, visualizationSettings)
    const id = constructFloorUrnId(parsedUrn.id, floorIndex)
    const urn: Urn = `urn:adsk-forma-elements:basicbuilding:${parsedUrn.authcontext}:${id}:${parsedUrn.revision}`
    results.set(urn, geo)
    currentElevation += floor.height
  }
  return results
}

function deconstructFloorUrnId(id: string) {
  const [buildingId, floorIndex] = id.split("_")
  return { buildingId, floorIndex: Number(floorIndex) }
}

function createBasicBuildingFromPolygon(polygon: Polygon, height: number, storyHeight: number) {
  const polygonXY = removeLastPointInPolygonIfEqualsFirst(
    makePolygonCounterClockwise(polygon.map(([x, y]) => ({ x, y }))),
  )
  return createBasicBuilding(polygonXY, Math.round(height * 10 ** 5) / 10 ** 5, storyHeight)
}
function createBasicBuildingFromShape(
  shape: { x: number; y: number; z: number }[],
  height: number,
  storyHeight: number,
) {
  const ccw = makePolygonCounterClockwise(shape)
  const position = { x: ccw[0].x, y: ccw[0].y, z: shape[0].z }
  const polygon = ccw.map(({ x, y }) => ({ x: x - position.x, y: y - position.y }))

  const transform = new Matrix4().makeTranslation(position.x, position.y, position.z).elements as Transform
  return { basicBuilding: createBasicBuilding(polygon, Math.round(height * 10 ** 5) / 10 ** 5, storyHeight), transform }
}

function isBasicBuildingUrn(urn: Urn) {
  const { system, id } = parseUrn(urn)
  return system === "basicbuilding" && !id.includes("_")
}
function isBasicBuilding(element: FormaElement): element is BasicBuildingElement {
  return isBasicBuildingUrn(element.urn)
}

function isBasicFloorUrn(urn: Urn) {
  const { system, id } = parseUrn(urn)
  return system === "basicbuilding" && id.includes("_")
}

function isBasicFloor(element: FormaElement) {
  return isBasicFloorUrn(element.urn)
}

function updateNumberOfFloors(element: BasicBuildingElement, numberOfFloors: number) {
  const building = { ...element.representations.__INTERNAL__.data }
  if (building.floors.length === numberOfFloors) {
    return building
  } else if (numberOfFloors < building.floors.length) {
    building.floors = building.floors.slice(0, numberOfFloors)
    building.units = cleanupDeadUnitRefs(building.units, building.floors)
  } else {
    const newFloors = [...building.floors]
    const topFloor = building.floors[building.floors.length - 1]
    const unitLookup = getUnitLookup(building.units)
    const unitsToDuplicate = Array.from(
      new Set(
        Object.values(topFloor.spaces)
          .map((space) => unitLookup(topFloor.id, space.id))
          .filter(isDefined),
      ),
    )
      .map((u) => ({
        ...u,
        spaces: u.spaces.filter((s) => s.floorId === topFloor.id),
      }))
      .filter((u) => u.spaces.length > 0)
    const newUnits = [...building.units]
    for (let i = 0; i < numberOfFloors - building.floors.length; i++) {
      const floor = { ...topFloor, id: randomId() }
      newFloors.push(floor)
      for (const unit of unitsToDuplicate) {
        newUnits.push({
          ...unit,
          id: randomId(),
          spaces: unit.spaces.map(({ spaceId }) => ({ spaceId, floorId: floor.id })),
        })
      }
    }
    building.floors = newFloors
    building.units = newUnits
  }
  return building
}

function duplicateFloors(element: BasicBuildingElement, floorsToDuplicate: number[]): BasicBuilding {
  const building = { ...element.representations.__INTERNAL__.data }
  const newFloors: Floor[] = []
  const newUnits = [...building.units]
  for (let i = 0; i < building.floors.length; i++) {
    const floor = building.floors[i]
    newFloors.push(floor)
    if (floorsToDuplicate.includes(i)) {
      const newFloorId = randomId()
      for (const unit of building.units) {
        if (unit.spaces.some((space) => space.floorId === floor.id)) {
          const newUnit = {
            ...unit,
            id: randomId(),
            spaces: unit.spaces.filter((s) => s.floorId === floor.id).map((s) => ({ ...s, floorId: newFloorId })),
          }
          newUnits.push(newUnit)
        }
      }
      newFloors.push({ ...floor, id: newFloorId })
    }
  }
  return { floors: newFloors, units: newUnits }
}

function updateStoryHeight(building: BasicBuilding, floorIndices: number[], height: number): BasicBuilding {
  return {
    ...building,
    floors: building.floors.map((floor, i) => (floorIndices.includes(i) ? { ...floor, height } : floor)),
  }
}

function removePointsAlongLine(input: [number, number][]) {
  const result: [number, number][] = []
  result.push(input[0])
  for (let i = 1; i < input.length - 1; i++) {
    const prev = input[i - 1]
    const curr = input[i]
    const next = input[i + 1]
    const v1 = [prev[0] - curr[0], prev[1] - curr[1]]
    const v2 = [next[0] - curr[0], next[1] - curr[1]]
    const lv1 = Math.sqrt(Math.pow(v1[0], 2) + Math.pow(v1[1], 2))
    const lv2 = Math.sqrt(Math.pow(v2[0], 2) + Math.pow(v2[1], 2))
    const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (lv1 * lv2)
    const angle = Math.acos(Math.max(-1, Math.min(cos, 1)))
    if (Math.abs(Math.PI - angle) > 0.01) {
      result.push(curr)
    }
  }
  result.push(input[input.length - 1])
  return result
}

function calculateFloorPolygon(floor: Floor): PolygonWithHoles[] {
  return calculateUnionOfPolygonsWithHoles(
    Object.values(floor.spaces).map((space) => getPolygonWithHolesFromSpace(space, floor.graph)),
  ).map((polygonWithHolesXY) => {
    const polygonWithHoles = polygonWithHolesFromXY(polygonWithHolesXY)
    const polygon = removePointsAlongLine(polygonWithHoles.polygon)
    const holes = polygonWithHoles.holes.map((hole) => removePointsAlongLine(hole))
    return { polygon, holes }
  })
}

function _addOutlinesFromFloorGraph(outlines: number[], graph: Graph, currentElevation: number, height: number): void {
  for (const edge of Object.values(graph.edges)) {
    const v0 = graph.vertices[edge.start]
    const v1 = graph.vertices[edge.end]
    // FloorLines
    outlines.push(v0.x, v0.y, currentElevation)
    outlines.push(v1.x, v1.y, currentElevation)
    // RoofLines
    outlines.push(v0.x, v0.y, currentElevation + height)
    outlines.push(v1.x, v1.y, currentElevation + height)
  }
  for (const vertex of Object.values(graph.vertices)) {
    // VerticalLines
    outlines.push(vertex.x, vertex.y, currentElevation)
    outlines.push(vertex.x, vertex.y, currentElevation + height)
  }
}

function makeOutlines(
  building: BasicBuilding,
  urn: string,
): { outlines: Float32Array; selectionOutlines: Float32Array } {
  const outlines: number[] = []
  const floorOutlines = building.floors.map((floor) => calculateFloorPolygon(floor))

  let currentElevation = 0
  for (let i = 0; i < building.floors.length; i++) {
    const floor = building.floors[i]
    const graph = floor.graph
    _addOutlinesFromFloorGraph(outlines, graph, currentElevation, floor.height)
    currentElevation += floor.height
  }

  // TODO: Don't blindly insert all points in all floors
  const allPoints: [number, number][] = floorOutlines.flatMap((outline) =>
    outline.flatMap((polygonWithHoles) => {
      const { polygon, holes } = polygonWithHoles
      return [...polygon, ...holes.flat()]
    }),
  )
  const simple: SimpleBuilding = {
    floors: floorOutlines.map((floorOutline, i) => {
      const outerShapes: PolygonWithHoles[] = floorOutline.map((polygonWithHoles) => {
        const polygon = insertPointsOnLines([polygonWithHoles.polygon], allPoints)[0]
        return { polygon: polygon, holes: polygonWithHoles.holes }
      })
      return {
        outerShapes,
        height: building.floors[i].height,
      }
    }),
  }

  try {
    const analysis = simpleBuildingToAnalysisBuilding(simple)
    const geo = buildAnalysisBuildingGeo([analysis])
    const selectionOutlines = new EdgesGeometry(geo).getAttribute("position").array as Float32Array

    return { outlines: new Float32Array(outlines), selectionOutlines }
  } catch {
    console.warn("BasicBuilding: Outline generation failed")
    const meta = { tags: { owner: "building-systems", data: urn }, level: "warning" as SeverityLevel }
    captureException(new Error("BasicBuilding: Outline generation failed"), meta)
    return { outlines: new Float32Array(outlines), selectionOutlines: new Float32Array(outlines) }
  }
}

async function duplicate(
  pointers: { urn: Urn; transform?: Child["transform"] }[],
  elements: FormaElementLookup,
  actionApi: ActionAPI,
) {
  const elementsClient = getElementsClient()

  const buildings = await Promise.all(
    pointers
      .filter((d) => isBasicBuildingUrn(d.urn))
      .map(async ({ urn, transform }) => {
        const existing =
          (elements.get(urn) as BasicBuildingElement | undefined) ||
          ((await elementsClient.getElements({ urns: [urn] }).then((r) => r.elements.get(urn))) as BasicBuildingElement)
        return { building: existing.representations.__INTERNAL__.data, transform }
      }),
  )

  for (let i = 0; i < buildings.length; i++) {
    dispatchBuildingEvent("basic_building", EventName.Add, "copy")
  }

  return buildings.flatMap(({ building, transform }) => {
    return createAddActions(building, transform, actionApi).actions
  })
}

function createUpdateActions(
  path: string,
  current: BasicBuildingElement,
  updatedBuilding: BasicBuilding,
  actionAPI: ActionAPI,
): Action[] {
  const { authcontext, id } = parseUrn(current.urn)
  const { buildingUrn, elements } = toElements(updatedBuilding, authcontext, id, String(Date.now()))
  const element = elements[buildingUrn] as BasicBuildingElement
  const geometries = makeBufferGeometryMap(element)
  return actionAPI.update.subTree(
    path,
    buildingUrn,
    ...fromFormaElementBoxMap(createElementBoxMapFromDraftElements(elements)),
    {
      volumeMesh: geometries,
      footprint: new Map(),
      terrainShape: new Map(),
      terrainTexture: new Map(),
      buildingFloors3DSketch_UNSTABLE: new Map(),
    },
  )
}

function executeUpdate(
  actionName: string,
  path: string,
  current: BasicBuildingElement,
  updatedBuilding: BasicBuilding,
  actionAPI: ActionAPI,
) {
  actionAPI.apply(actionName, createUpdateActions(path, current, updatedBuilding, actionAPI))
}

function createAddActions(basicBuilding: BasicBuilding, transform: Transform | undefined, actionAPI: ActionAPI) {
  const { buildingUrn, elements } = toElements(basicBuilding, PROJECT_ID, randomId(), String(Date.now()))
  const building = elements[buildingUrn] as BasicBuildingElement
  const geometries = makeBufferGeometryMap(building)
  const key = newChildKey()
  const options = { child: { key, transform } }
  const actions = actionAPI.add.subTree_UNSTABLE(
    buildingUrn,
    ...fromFormaElementBoxMap(createElementBoxMapFromDraftElements(elements)),
    {
      volumeMesh: geometries,
      footprint: new Map(),
      terrainShape: new Map(),
      terrainTexture: new Map(),
      buildingFloors3DSketch_UNSTABLE: new Map(),
    },
    options,
  )
  return { key, actions }
}

function createFromShape(shape: Shape, height: number, storyHeight: number, contextRoot: string, actionAPI: ActionAPI) {
  const { basicBuilding, transform } = createBasicBuildingFromShape(shape.vertices, height, storyHeight)
  const { key, actions } = createAddActions(basicBuilding, transform, actionAPI)
  actionAPI.apply("Add basic building", actions, undefined, new Set([contextRoot + "/" + key]))
  dispatchBuildingEvent("basic_building", EventName.Add, "draw")
}

function makePreviewObjects(
  building: BasicBuilding,
  transform: Transform,
  excludeFloorIndices?: number[],
): RenderedObject[] {
  const floorGeometries = makeBufferGeometries(building, excludeFloorIndices)
  let edgesTotal = 0
  const edges: Float32Array[] = []
  for (const bufferGeometry of floorGeometries) {
    const array = new EdgesGeometry(bufferGeometry).getAttribute("position").array as Float32Array
    edges.push(array)
    edgesTotal += array.length
  }
  const edgesPosition = new Float32Array(edgesTotal)
  let ptr = 0
  for (const edge of edges) {
    edgesPosition.set(edge, ptr)
    ptr += edge.length
  }

  let geoTotal = floorGeometries.reduce((a, v) => a + v.getAttribute("position").array.length, 0)
  const position = new Float32Array(geoTotal)
  const normal = new Float32Array(geoTotal)
  const color = new Uint8Array(geoTotal)
  ptr = 0
  for (const geo of floorGeometries) {
    position.set(geo.getAttribute("position").array as Float32Array, ptr)
    normal.set(geo.getAttribute("normal").array as Float32Array, ptr)
    color.set(geo.getAttribute("color").array as Uint8Array, ptr)
    ptr += geo.getAttribute("position").array.length
  }

  return [
    {
      id: "geo",
      spec: "vertexColors",
      mode: "normal",
      geometryData: { position, normal, color },
      transform,
    },
    {
      id: "lines",
      spec: "basicLines",
      mode: "normal",
      geometryData: { position: edgesPosition },
      transform,
    },
  ]
}

function deleteFloorsFromBuilding(building: BasicBuilding, floorIndices: number[]) {
  const newFloors = building.floors.filter((_, i) => !floorIndices.includes(i))
  if (newFloors.length === 0) return undefined
  const newUnits = cleanupDeadUnitRefs(building.units, newFloors)
  return { units: newUnits, floors: newFloors }
}

function createDeleteActions(paths: string[], snapshot: ElementSnapshot): Action[] {
  const floorIndicesByBuilding = {} as Record<string, number[]>
  const buildingPaths = []
  for (const path of paths) {
    const element = snapshot.getNode(path)?.element
    if (!element) continue
    if (isBasicBuilding(element)) buildingPaths.push(path)
    else if (isBasicFloor(element)) {
      const buildingPath = getParentPath(path)!
      if (!floorIndicesByBuilding[buildingPath]) {
        floorIndicesByBuilding[buildingPath] = []
      }
      const floorUrn = element.urn
      const floorIndex = deconstructFloorUrnId(parseUrn(floorUrn).id).floorIndex
      floorIndicesByBuilding[buildingPath].push(floorIndex)
    }
  }

  const actions: Action[] = buildingPaths.map((path) => ({ type: "delete", path }))

  for (const [buildingPath, floorIndices] of Object.entries(floorIndicesByBuilding)) {
    if (buildingPaths.includes(buildingPath)) {
      // building is already deleted
      continue
    }
    const buildingElement = snapshot.getNodeOrThrow(buildingPath).element as BasicBuildingElement
    const building = buildingElement.representations.__INTERNAL__.data
    const updatedBuilding = deleteFloorsFromBuilding(building, floorIndices)
    if (updatedBuilding) actions.push(...createUpdateActions(buildingPath, buildingElement, updatedBuilding, actionApi))
    else {
      actions.push({ type: "delete", path: buildingPath })
    }
  }

  return actions
}

export default {
  SYSTEM_NAME: "basicbuilding",
  createBasicBuildingFromShape: createBasicBuildingFromShape,
  createBasicBuildingFromPolygon: createBasicBuildingFromPolygon,
  toElements: toElements,
  isBasicBuilding: isBasicBuilding,
  isBasicBuildingUrn: isBasicBuildingUrn,
  isBasicFloor: isBasicFloor,
  updateStoryHeight: updateStoryHeight,
  updateNumberOfFloors: updateNumberOfFloors,
  duplicateFloors: duplicateFloors,
  calculateFloorPolygon: calculateFloorPolygon,
  makeBufferGeometryMap: makeBufferGeometryMap,
  makeUnitMeshes: makeUnitMeshes,
  makeBuildingHitboxes: makeBuildingHitboxes,
  makeOutlines: makeOutlines,
  makePreviewObjects: makePreviewObjects,
  deconstructFloorId: deconstructFloorUrnId,
  extractGrossFloorAreaPolygons: extractGrossFloorAreaPolygons,
  actions: {
    executeUpdate: executeUpdate,
    createUpdateActions: createUpdateActions,
    createAddActions: createAddActions,
    createFromShape: createFromShape,
    duplicate: duplicate,
    createDeleteActions: createDeleteActions,
  },
}
