import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { BufferAttribute, BufferGeometry, Matrix4, Mesh } from "three"
import Delaunator from "delaunator"
import { request } from "src/lib/request"
import { gzip } from "pako"
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js"
import { parseUrn } from "src/lib/element/urn"
import type { ProjectGeoLocation } from "src/core/project/project"
import { makeRootMatrixForGeoreferencedObject } from "./useLibraryVisibilityEvents"

import { downloadAllElementData } from "src/core/elements-loading/downloadAllElementData"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"
import { validateIsUrn } from "src/lib/elementFormatUtils"
import { getInMapOrThrow } from "src/lib/map"
import { PROJECT_ID } from "src/core/project/project"
import { getTranslator } from "src/i18n"

async function save(
  geometry: BufferGeometry,
  importedElement: FormaElement,
  projectGeoLocation: ProjectGeoLocation,
): Promise<Urn> {
  try {
    const glb: ArrayBuffer = await new Promise((resolve, reject) => {
      const exportmesh = new Mesh(geometry.clone())
      exportmesh.geometry.rotateX(-Math.PI / 2)
      new GLTFExporter().parse(exportmesh, (res) => resolve(res as ArrayBuffer), reject, { binary: true })
    })
    const glbGz = gzip(glb, { level: 1 })
    const prepareUrl = `/api/terrain/elements/prepare_create?authcontext=${PROJECT_ID}`
    // TODO: Fail if other srid than project, translate according to projectrefpoint - elementrefpoint
    // For now we're using geometry that has all of this applied, so ignore it
    // const { srid, refPoint } = importedElement.properties!.geoReference
    const srid = projectGeoLocation.srid
    const refPoint = projectGeoLocation.point
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox!
    const bbox = [
      [refPoint[0] + min.x, refPoint[1] + min.y],
      [refPoint[0] + max.x, refPoint[1] + max.y],
    ]
    const prepareRes = await request(prepareUrl, {
      method: "POST",
      body: JSON.stringify({
        project_id: PROJECT_ID,
        srid,
        bbox,
        ref_point: refPoint,
        operations: [],
        licensing: {
          exportable: true,
          attributions: [],
          licenseUrl: "",
          providerDescriptionUrl: "",
        },
      }),
    })
    const links = await prepareRes.json()
    const urn = validateIsUrn(links.urn)
    await request(links.presigned_put_glb, {
      method: "PUT",
      headers: { "Content-Type": "model/gltf-binary", "Content-Encoding": "gzip" },
      body: glbGz,
    })

    const { id, revision, authcontext } = parseUrn(urn)
    await request(`/api/terrain/elements/${id}/revisions/${revision}/create?authcontext=${authcontext}`, {
      method: "PATCH",
      body: JSON.stringify({
        projectId: PROJECT_ID,
        elementId: id,
        revision: revision,
      }),
    }).then((r) => r.json())
    return urn
  } catch (e: any) {
    console.error(e)
    window.forma_toasts.push({ content: `Terrain upload failed: ${e.message}`, status: "error" })
    throw e
  }
}

type LibraryState = {
  rootUrn: Urn
  elements: FormaElementLookup
  volumeMeshes: Map<Urn, BufferGeometry>
}

function extractRecursively(
  node: { urn: Urn; transform?: number[] },
  parentTransform: Matrix4,
  state: LibraryState,
  results: { position: Float32Array; normal: Float32Array }[],
) {
  const element = state.elements.getOrThrow(node.urn)
  const geometry = state.volumeMeshes.get(node.urn)

  let transform = parentTransform
  if (node.transform) {
    transform = parentTransform.clone()
    transform.multiply(new Matrix4().fromArray(node.transform))
  }

  let nofVertices = 0
  if (geometry) {
    let result = geometry.clone()
    result.boundingBox = null
    result.boundingSphere = null
    result.applyMatrix4(transform)
    if (geometry.index) {
      result = geometry.toNonIndexed()
    }
    if (!result.getAttribute("normal")) {
      result.computeVertexNormals()
    }
    const position = (result.getAttribute("position") as BufferAttribute).array as Float32Array
    const normal = (result.getAttribute("normal") as BufferAttribute).array as Float32Array
    results.push({ position, normal })
    nofVertices += position.length / 3
  }

  for (const child of element.children || []) {
    nofVertices += extractRecursively(child, transform, state, results)
  }
  return nofVertices
}

function extractAndMergeAllVolumeMeshes(state: LibraryState, projectGeoLocation: ProjectGeoLocation) {
  const root = state.elements.getOrThrow(state.rootUrn)
  const rootTransform = makeRootMatrixForGeoreferencedObject(root, projectGeoLocation)

  const results: { position: Float32Array; normal: Float32Array }[] = []
  const nofVertices = extractRecursively({ urn: state.rootUrn }, rootTransform, state, results)

  let positions = new Float32Array(nofVertices * 3)
  let normals = new Float32Array(nofVertices * 3)
  let ptr = 0
  for (const result of results) {
    positions.set(result.position, ptr)
    normals.set(result.normal, ptr)
    ptr += result.position.length
  }
  return { positions, normals }
}

const TERRAIN_MAX_BBOX_AREA = 4e6 // 4 square km

function createTerrainGeometry(state: LibraryState, projectGeoLocation: ProjectGeoLocation) {
  const { positions: originalPosition } = extractAndMergeAllVolumeMeshes(state, projectGeoLocation)

  const positions = []
  for (let i = 0; i < originalPosition.length; i += 3) {
    // Keep vertices where normals point upwards
    positions.push(originalPosition[i], originalPosition[i + 1], originalPosition[i + 2])
  }
  const position3d = new Float32Array(positions)

  const position2d = new Float32Array((position3d.length * 2) / 3)
  for (let i = 0; i < position3d.length / 3; i++) {
    position2d[i * 2] = position3d[i * 3]
    position2d[i * 2 + 1] = position3d[i * 3 + 1]
  }
  const indices = new Delaunator(position2d).triangles
  for (let i = 0; i < indices.length; i += 3) {
    const tmp = indices[i + 1]
    indices[i + 1] = indices[i + 2]
    indices[i + 2] = tmp
  }
  const terrainGeometry = new BufferGeometry()
  terrainGeometry.setAttribute("position", new BufferAttribute(position3d, 3))
  terrainGeometry.setIndex(new BufferAttribute(indices, 1))
  terrainGeometry.computeVertexNormals()
  terrainGeometry.computeBoundingBox()
  const { min, max } = terrainGeometry.boundingBox!
  const bboxArea = (max.x - min.x) * (max.y - min.y)
  if (bboxArea > TERRAIN_MAX_BBOX_AREA) {
    const insqkm = (bboxArea / 1e6).toFixed(2)
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.errors.terrain.boundingBoxTooLarge, { size: insqkm }),
      status: "warning",
    })
    return
  }
  const w = 1 / (max.x - min.x)
  const h = 1 / (max.y - min.y)
  const uv = new Float32Array(position2d.length)
  for (let i = 0; i < position2d.length; i += 2) {
    uv[i] = (position2d[i] - min.x) * w
    uv[i + 1] = (max.y - position2d[i + 1]) * h
  }

  terrainGeometry.setAttribute("uv", new BufferAttribute(uv, 2))
  return terrainGeometry
}

export async function convertToTerrain(
  event: WindowEventMap["sm-library/convert-to-terrain"],
  projectGeoLocation: ProjectGeoLocation,
) {
  const item = event.detail.item
  await request(`/api/forma-library/${item.id}/?authcontext=${item.authContext}`, {
    method: "PUT",
    body: JSON.stringify({ name: item.name, status: "pending", urn: item.urn }),
  })
  let resultingLibraryUrn = item.urn
  window.dispatchEvent(new CustomEvent("sm-library/refresh"))
  try {
    const { elements, representations } = await downloadAllElementData(new Set([item.urn]))
    const newGeometry = createTerrainGeometry(
      {
        rootUrn: item.urn,
        elements: bindFormaElementLookupForBoxMap(elements),
        volumeMeshes: representations.volumeMesh,
      },
      projectGeoLocation,
    )
    if (!newGeometry) return
    const rootElement = getInMapOrThrow(elements, item.urn).element
    resultingLibraryUrn = await save(newGeometry, rootElement, projectGeoLocation)
  } finally {
    await request(`/api/forma-library/${item.id}/?authcontext=${item.authContext}`, {
      method: "PUT",
      body: JSON.stringify({ name: item.name, status: "success", urn: resultingLibraryUrn }),
    })
  }
}
