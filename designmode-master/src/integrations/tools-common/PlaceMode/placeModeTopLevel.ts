import type { InternalPath } from "src/lib/element/path"
import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import type { Feature } from "geojson"
import type { TerrainShape } from "src/lib/element/types"
import { Box3, BufferAttribute, BufferGeometry, Color, Matrix4, Mesh, Triangle, Vector3 } from "three"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import type { VisualizationSettings } from "src/lib/visualizationSettings"
import type { SnapInfo, SnappingLine } from "src/integrations/snapping/snapping"
import { getAffineSnapFromSnappingLines } from "src/integrations/snapping/snapping"
import type { LibraryElementInfo, LibrarySelectionOutline } from "./library"
import type { PathState } from "src/core/paths"
import type { CategoryState } from "src/core/categories"
import { getMappedCategory } from "src/core/categories"
import { captureException } from "@sentry/browser"
import { BBoxOctree } from "src/lib/three/BBoxOctree/BBoxOctree"
import { isDefined } from "src/lib/array"
import { parseUrn } from "src/lib/element/urn"
import { snappingLineFromEndpoints } from "src/integrations/snapping/snappingEngineHelpers"
import { snappingLinesForShapeOnTerrain } from "src/integrations/snapping/snappingLines"
import {
  calculateEdgesGeometry,
  edgesPositionFromBox3,
  generateColorArray,
  GeometryConstants,
} from "src/lib/three/geometryUtils"
import { getOutlinesFromTerrainShape } from "src/core/selection/terrain-shape-outlines"
import { conceptualElementsApi } from "src/integrations/conceptual-squad/conceptualElementsApi"
import type { Renderable } from "src/integrations/renderables/renderable"
import { getRenderingSpecForElement } from "src/integrations/renderables/renderable"
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh"
import type { RaycastObject, RaycastData } from "src/core/selection/raycasting"
import { screenResolutionVector } from "src/core/three/sceneManager"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { renderableFromTerrainShape } from "src/integrations/renderables/terrainShape"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { Line2 } from "three/addons/lines/Line2.js"
import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import type { FormaElementLookup } from "src/lib/element/lookup"
import type { TerrainTexture } from "src/core/elements-loading/loading"
import { renderableFromTerrainTexture } from "src/integrations/renderables/raster"
import { addToMap } from "src/lib/map"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { getRegisteredElementSystem } from "src/core/element-systems"
import { internalPathToSelectionPath } from "src/core/selection/selectionTypes"

type BaseInfo = {
  key: InternalPath
  fullpath: InternalPath
  element: FormaElement
  transform: Matrix4
  footprint?: Feature
  terrainShape?: TerrainShape
  terrainTexture?: TerrainTexture
  geometry3d?: { geometry: BufferGeometry; geometryWorld: BufferGeometry }
  hitbox?: BufferGeometry
  _selectionOutline?: Float32Array
  outlines?: Float32Array
  isSubSelectionElement?: boolean
}

export function buildLibraryElementInfo(
  child: Child,
  parentPath: InternalPath,
  scenario: boolean,
  elements: FormaElementLookup,
  rootUrn: Urn,
  categoryState: CategoryState,
  pathState: PathState,
  representations: RepresentationsByUrn,
  hitboxes: Record<Urn, BufferGeometry[]>,
  terrainSamplerData: TerrainSamplerData,
  scenarioHidden: boolean,
  visualizationSettings?: VisualizationSettings,
): LibraryElementInfo[] {
  const element = elements.get(child.urn)
  if (!element) {
    captureException(new Error(`child reference to element that isn't in state: ${child.urn}`))
    return []
  }

  const path = parentPath + "/" + child.key
  const category = getMappedCategory(element)

  if (category === "terrain") return []
  const categories = scenario ? categoryState.scenario : categoryState.proposal
  const paths = scenario ? pathState.scenario : pathState.proposal
  const worldTransform = child.transform ? new Matrix4().fromArray(child.transform) : child.transform

  const geometry = extractGeometry(
    path,
    child,
    parentPath,
    elements,
    representations,
    hitboxes,
    terrainSamplerData,
    visualizationSettings,
  )

  return [
    {
      path,
      element,
      category,
      scenario,
      urn: child.urn,
      locked: categoryState[scenario ? "scenario" : "proposal"].locked.has(category) || paths?.locked?.has(path),
      hidden: (scenario && scenarioHidden) || categories.hidden.has(category) || paths?.hidden?.has(path),
      geometry,
      worldTransform,
    },
  ]
}

const _cache: Record<
  InternalPath,
  {
    urn: Urn
    transform: number[] | undefined
    geometry: LibraryElementInfo["geometry"]
    hitboxes: BufferGeometry[]
    selectionOutlines: LibrarySelectionOutline[]
    terrainSamplerData: TerrainSamplerData
    visualizationSettings: { relevant: boolean; settings: VisualizationSettings | undefined }
  }
> = {}

function extractGeometry(
  path: InternalPath,
  child: Child,
  parentPath: InternalPath,
  elements: FormaElementLookup,
  representations: RepresentationsByUrn,
  hitboxes: Record<Urn, BufferGeometry[]>,
  terrainSamplerData: TerrainSamplerData,
  visualizationSettings?: VisualizationSettings,
): LibraryElementInfo["geometry"] {
  const cached = _cache[path]
  const urnCached = cached?.urn === child.urn
  const hitboxesCached = cached?.hitboxes === hitboxes[child.urn]
  const terrainCached = cached?.terrainSamplerData === terrainSamplerData
  const transformCached =
    (!cached?.transform && !child.transform) || cached?.transform?.every((v, i) => v === child.transform?.[i])
  const visualizationUnchangedOrIrrelevant =
    !cached?.visualizationSettings.relevant || cached?.visualizationSettings.settings === visualizationSettings
  if (urnCached && hitboxesCached && terrainCached && transformCached && visualizationUnchangedOrIrrelevant) {
    return cached.geometry
  }

  const { basedata, isVisualizationSettingsRelevant } = extractBaseGeometry(
    parentPath,
    child,
    elements,
    representations,
    hitboxes,
    terrainSamplerData,
    visualizationSettings,
  )
  const selectionOutlines = buildSelectionOutlines(basedata)
  const renderables2d = buildRenderables2d(basedata)
  const renderables3d = buildRenderables3d(basedata)
  const snapping = computeSnappingLinesFromBaseInfo(path, basedata, terrainSamplerData)

  const geometry: LibraryElementInfo["geometry"] = {
    renderables2d,
    renderables3d,
    selectionOutlines,
    raycastTargets: [
      ...buildRaycastTargets3d(basedata),
      ...buildOverlayTargets(renderables2d),
      ...buildTargets2dAs3d(basedata),
    ],
    snapping,
  }
  _cache[path] = {
    urn: child.urn,
    transform: child.transform,
    geometry,
    hitboxes: hitboxes[child.urn],
    selectionOutlines,
    terrainSamplerData,
    visualizationSettings: { relevant: isVisualizationSettingsRelevant, settings: visualizationSettings },
  }

  return geometry
}

function computeSnappingLinesFromBaseInfo(
  path: InternalPath,
  basedata: BaseInfo[],
  terrainData: TerrainSamplerData,
): SnapInfo {
  const roofAndFloorTriangles = getRoofAndFloorTrianglesFromGeometry(basedata)
  const lines = getSnappingLines(basedata, terrainData)
  const affineSnapInfo = getAffineSnapFromSnappingLines(lines, path)
  const octree = new BBoxOctree<SnappingLine>()
  lines.forEach((l) => {
    l.segments.forEach((seg) => octree.set(seg.bbox, l))
  })
  return {
    lines,
    affineSnapInfo,
    roofAndFloorTriangles,
    octree,
  }
}

const SNAPPING_LINES_THRESHOLD = 10_000
function getSnappingLines(basedata: BaseInfo[], terrainData: TerrainSamplerData): SnappingLine[] {
  if (
    basedata.some((base) =>
      isDefined(getRegisteredElementSystem(parseUrn(base.element.urn).system)?.generateSnappingLines),
    )
  ) {
    const customSnapping = basedata.flatMap((base): SnappingLine[] => {
      const system = getRegisteredElementSystem(parseUrn(base.element.urn).system)
      if (!system || !system.generateSnappingLines) return []
      const snappingLines = system.generateSnappingLines(base.element)

      return (
        snappingLines?.map(({ start, end, onTerrain }) =>
          snappingLineFromEndpoints(
            new Vector3(...start).applyMatrix4(base.transform),
            new Vector3(...end).applyMatrix4(base.transform),
            "LINE",
            onTerrain,
            terrainData,
            base.fullpath,
          ),
        ) ?? []
      )
    })
    if (customSnapping.length > 0) {
      return customSnapping
    }
    // If none of the elements provided custom snapping, fall through and continue with the default snapping logic below
  }

  // assume that if a top level element has some 2d geometry, then that's all it consists of (i.e. no mixed terrain and non-terrain stuff)
  if (basedata.some((base) => base.footprint && !base.geometry3d)) {
    return basedata.flatMap((base): SnappingLine[] => {
      if (!(base.footprint && !base.geometry3d)) return []
      return snappingLinesForShapeOnTerrain(base.footprint, base.transform, base.fullpath, terrainData)
    })
  }

  if (basedata.some((base) => isDefined(base.outlines))) {
    const sumOutlines = basedata.reduce((prev, { outlines }) => prev + (outlines?.length || 0), 0)
    if (sumOutlines < SNAPPING_LINES_THRESHOLD) {
      let lines: SnappingLine[] = []
      for (let { outlines, fullpath } of basedata) {
        if (outlines) {
          lines = lines.concat(snappingLinesFromEdges(outlines).map((sl) => ({ ...sl, shapeId: fullpath })))
        }
      }
      return lines
    }
  }

  let bbox: Box3 | undefined
  if (basedata.length === 1) {
    bbox = getBboxOfBasedata(basedata[0])
  } else {
    for (let base of basedata) {
      const box = getBboxOfBasedata(base)
      if (box) {
        if (!bbox) bbox = new Box3()
        bbox.expandByPoint(box.min)
        bbox.expandByPoint(box.max)
      }
    }
  }
  if (bbox && basedata.length >= 1) {
    const edges = edgesPositionFromBox3(bbox)
    return snappingLinesFromEdges(edges).map((sl) => ({ ...sl, shapeId: basedata[0].fullpath }))
  }

  return []
}

// TODO: cache triangles per buffergeometry so we can just transform those if only the geometry changes but not the transform
const errorMargin = 0.01

function getRoofAndFloorTrianglesFromGeometry(baseData: BaseInfo[]): Triangle[] {
  const triangles: Triangle[] = []

  function createAndTransformTriangleIfHorizontal(
    geometry: BufferGeometry,
    v1: number,
    v2: number,
    v3: number,
    transform: Matrix4,
  ) {
    const normal = geometry.attributes.normal.array
    const isHorizontal = Math.abs(Math.abs(normal[v1 * 3 + 2]) - 1) < errorMargin
    if (isHorizontal) {
      const position = geometry.attributes.position.array
      return new Triangle(
        new Vector3(position[v1 * 3], position[v1 * 3 + 1], position[v1 * 3 + 2]).applyMatrix4(transform),
        new Vector3(position[v2 * 3], position[v2 * 3 + 1], position[v2 * 3 + 2]).applyMatrix4(transform),
        new Vector3(position[v3 * 3], position[v3 * 3 + 1], position[v3 * 3 + 2]).applyMatrix4(transform),
      )
    }
  }

  for (const info of baseData) {
    const { geometry3d, transform } = info
    if (!geometry3d) continue
    const geometry = geometry3d.geometry
    const positionsAttr = geometry3d.geometry.attributes.position
    if (positionsAttr.count > 10_000) continue
    if (!geometry.index) {
      for (let i = 0; i < positionsAttr.count; i += 3) {
        const triangle = createAndTransformTriangleIfHorizontal(geometry, i, i + 1, i + 2, transform)
        if (triangle) triangles.push(triangle)
      }
    } else {
      const indexes = geometry.index.array
      for (let i = 0; i < indexes.length; i += 3) {
        const triangle = createAndTransformTriangleIfHorizontal(
          geometry,
          indexes[i],
          indexes[i + 1],
          indexes[i + 2],
          transform,
        )
        if (triangle) triangles.push(triangle)
      }
    }
  }

  return triangles
}

function getBboxOfBasedata(basedata: BaseInfo): Box3 | undefined {
  if (!basedata.geometry3d?.geometry) return undefined
  if (!basedata.geometry3d.geometry.boundingBox) basedata.geometry3d.geometry.computeBoundingBox()
  const bbox = basedata.geometry3d.geometry.boundingBox!.clone()
  bbox.applyMatrix4(basedata.transform)
  return bbox
}

const ENABLE_SSAO = new URLSearchParams(window.location.search).has("ssao")
function extractBaseGeometry(
  parentPath: InternalPath,
  node: Child,
  elements: FormaElementLookup,
  representations: RepresentationsByUrn,
  hitboxes: Record<Urn, BufferGeometry[]>,
  terrainSamplerData: TerrainSamplerData,
  visualizationSettings?: VisualizationSettings,
): { basedata: BaseInfo[]; isVisualizationSettingsRelevant: boolean } {
  const basedata: BaseInfo[] = []

  const appliedVisualizationGeometries = new Map<Urn, BufferGeometry>()

  function extract(key: InternalPath, fullpath: InternalPath, node: Child, parentTransform: Matrix4) {
    const element = elements.getOrThrow(node.urn)
    const elementSystem = getRegisteredElementSystem(parseUrn(element.urn).system)
    const visualizationGeometries =
      (visualizationSettings &&
        elementSystem?.applyVisualizationSettings_DEPRECATED?.(element, visualizationSettings)) ??
      new Map<Urn, BufferGeometry>()

    addToMap(appliedVisualizationGeometries, visualizationGeometries)

    const geometry = appliedVisualizationGeometries.get(node.urn) ?? representations.volumeMesh.get(node.urn)
    const hitbox = hitboxes[node.urn]?.[0] as BufferGeometry | undefined // TODO: Do we ever need more than 1?

    const terrainShape: TerrainShape | undefined = representations.terrainShape.get(node.urn)
    const terrainTexture: TerrainTexture | undefined = representations.terrainTexture.get(node.urn)
    const footprint: Feature | undefined = representations.footprint.get(node.urn)

    let transform = parentTransform
    if (node.transform) {
      transform = parentTransform.clone()
      transform.multiply(new Matrix4().fromArray(node.transform))
    }
    const isIdentityTransform = GeometryConstants.IDENTITY.equals(transform)

    function getGeometry(): BaseInfo["geometry3d"] | undefined {
      if (!geometry || geometry.attributes.position.count === 0) return undefined

      let actualGeometry = geometry

      if (element.properties?.color) {
        actualGeometry = geometry.clone()
        const color = generateColorArray(new Color(element.properties.color), geometry.attributes.position.count)
        actualGeometry.setAttribute("color", new BufferAttribute(color, 3, true))
      }

      let worldGeom = actualGeometry
      if (!isIdentityTransform) {
        worldGeom = actualGeometry.clone()
        worldGeom.applyMatrix4(transform)
      }

      return {
        geometry: actualGeometry,
        geometryWorld: worldGeom,
      }
    }

    function getOutlines(): Pick<BaseInfo, "_selectionOutline" | "outlines"> {
      let outlines: Float32Array | undefined
      if (geometry) {
        if (ENABLE_SSAO) {
          // NOTE we want to identify contextual buildings - this logic is *not* ideal, but we currently don't have a better way
          if (
            element.properties?.category === "building" &&
            (parseUrn(element.urn).system === "basic" || parseUrn(element.urn).system === "integrate")
          ) {
            return {}
          }
        }
        outlines = calculateEdgesGeometry(geometry, transform)
        return { outlines: outlines && outlines.length > 0 ? outlines : undefined }
      }
      if (terrainShape) {
        return { _selectionOutline: getOutlinesFromTerrainShape(terrainShape, transform, terrainSamplerData) }
      }
      return {}
    }

    const { outlines, _selectionOutline } = getOutlines()

    function getHitbox(): BaseInfo["hitbox"] {
      return hitbox ?? geometry
    }

    basedata.push({
      key,
      fullpath,
      element,
      transform,
      geometry3d: getGeometry(),
      footprint: footprint,
      terrainShape: terrainShape,
      terrainTexture: terrainTexture,
      outlines: outlines,
      hitbox: getHitbox(),
      _selectionOutline: _selectionOutline,
      isSubSelectionElement: Boolean(elementSystem?.isSubSelectionElement?.(element)),
    })

    for (const child of element.children || []) {
      extract(key, `${fullpath}/${child.key}`, child, transform)
    }
  }

  extract(`${parentPath}/${node.key}`, `${parentPath}/${node.key}`, node, new Matrix4())

  return { basedata, isVisualizationSettingsRelevant: Object.values(appliedVisualizationGeometries).length !== 0 }
}

function snappingLinesFromEdges(edgesPositions: Float32Array): Omit<SnappingLine, "shapeId">[] {
  const snappingLines: Omit<SnappingLine, "shapeId">[] = []
  const numbersPerEdge = 6 // 3 numbers per vertex * 2 vertexes per edge
  let lowestZ = Infinity
  for (let i = 0; i < edgesPositions.length; i += numbersPerEdge) {
    const start = new Vector3(edgesPositions[i], edgesPositions[i + 1], edgesPositions[i + 2])
    const end = new Vector3(edgesPositions[i + 3], edgesPositions[i + 4], edgesPositions[i + 5])
    lowestZ = Math.min(lowestZ, start.z, end.z)
    const bbox = new Box3().expandByPoint(start).expandByPoint(end).expandByScalar(0.1)
    const segments = [{ start, end, bbox }]
    snappingLines.push({
      type: "LINE",
      start,
      end,
      onTerrain: false,
      segments,
      center: start.clone().add(end).divideScalar(2),
    })
  }
  return snappingLines
}

function buildRenderables3d(basedata: BaseInfo[]) {
  const result: Renderable[] = []
  for (const data of basedata) {
    const { fullpath, geometry3d, outlines, element } = data
    if (geometry3d) {
      const geometry = geometry3d.geometryWorld
      const spec = getRenderingSpecForElement(geometry, element)
      result.push({
        id: fullpath,
        toplevel: data.key,
        spec: spec,
        geometry,
        urn: element.urn,
      })
    }
    if (outlines) {
      const outlinegeo = new BufferGeometry()
      outlinegeo.setAttribute("position", new BufferAttribute(outlines, 3))
      let spec: Renderable["spec"] =
        data.element.properties?.category === "constraints" ? "constraintOutline" : "basicLines"
      result.push({
        id: fullpath,
        toplevel: data.key,
        spec,
        geometry: outlinegeo,
      })
    }
  }
  return result
}

function buildSelectionOutlines(basedata: BaseInfo[]): LibrarySelectionOutline[] {
  return basedata.flatMap((baseInfo) => {
    let idOverride: string | undefined = baseInfo.isSubSelectionElement ? baseInfo.fullpath : undefined

    if (isDefined(baseInfo._selectionOutline)) {
      return { fullpath: baseInfo.fullpath, position: baseInfo._selectionOutline, idOverride }
    }
    if (isDefined(baseInfo.outlines)) {
      return { fullpath: baseInfo.fullpath, position: baseInfo.outlines, idOverride }
    }
    let array: Float32Array | undefined
    const geometry = baseInfo.geometry3d?.geometry
    if (geometry) {
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      array = edgesPositionFromBox3(geometry.boundingBox)
      new BufferAttribute(array, 3).applyMatrix4(baseInfo.transform)
    }
    if (!array) return []
    return { fullpath: baseInfo.fullpath, position: array, idOverride }
  })
}

function buildRenderables2d(basedata: BaseInfo[]): Renderable[] {
  const result: Renderable[] = []
  for (const data of basedata) {
    if (data.terrainTexture) {
      result.push(...renderableFromTerrainTexture(data.terrainTexture, data.key, data.transform))
    } else if (data.terrainShape) {
      result.push(...renderableFromTerrainShape(data.terrainShape, data.key, data.transform))
    }
  }

  return result
}

function buildOverlayTargets(renderables2d: Renderable[]): RaycastObject<Mesh, RaycastData>[] {
  const result: RaycastObject<Mesh, RaycastData>[] = []
  let z = 200
  for (const r of renderables2d) {
    if (!r.toplevel) continue
    const mesh = new Mesh(r.geometry)
    mesh.position.setZ(z)
    result.push({ object: mesh, data: { raycastType: "2d", selection: internalPathToSelectionPath(r.toplevel) } })
    z -= 0.05
  }
  return result
}
// World units is needed to be able to raycast with a Raycaster which does not have camera (as linewidth is dependent on camera)
const ELEMENT_SHAPE_AS_3D_LINES_MATERIAL = new LineMaterial({ resolution: screenResolutionVector, worldUnits: true })

function buildTargets2dAs3d(basedata: BaseInfo[]): RaycastObject<Line2, RaycastData>[] {
  const result: RaycastObject<Line2, RaycastData>[] = []
  for (const data of basedata) {
    if (!isDefined(data._selectionOutline)) continue
    if (data._selectionOutline.length <= 0) continue
    const geometry = new LineGeometry().setPositions(data._selectionOutline)
    const object = new Line2(geometry, ELEMENT_SHAPE_AS_3D_LINES_MATERIAL)
    result.push({
      object,
      data: { raycastType: "3d", selection: internalPathToSelectionPath(getSelectionPath(data)) },
    })
  }
  return result
}
function getSelectionPath(data: BaseInfo) {
  const { system } = parseUrn(data.element.urn)
  return [BasicBuildingAPI.SYSTEM_NAME].includes(system) || conceptualElementsApi.is3dSketchFloor(data.element)
    ? data.fullpath
    : data.key
}

function buildRaycastTargets3d(basedata: BaseInfo[]): RaycastObject<Mesh, RaycastData>[] {
  const result: RaycastObject<Mesh, RaycastData>[] = []
  for (const data of basedata) {
    if (!data.geometry3d && !data.hitbox) continue
    let geometry = data.hitbox || data.geometry3d!.geometry
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    if (!geometry.boundingSphere) geometry.computeBoundingSphere()
    if (!geometry.computeBoundsTree) geometry.computeBoundsTree = computeBoundsTree
    if (!geometry.disposeBoundsTree) geometry.disposeBoundsTree = disposeBoundsTree
    if (!geometry.boundsTree) geometry.computeBoundsTree()
    const mesh = new Mesh(geometry)
    mesh.applyMatrix4(data.transform)
    mesh.updateMatrixWorld()
    mesh.raycast = acceleratedRaycast
    mesh.userData = { id: getSelectionPath(data) }

    result.push({
      object: mesh,
      data: { raycastType: "3d", selection: internalPathToSelectionPath(getSelectionPath(data)) },
    })
  }
  return result
}
