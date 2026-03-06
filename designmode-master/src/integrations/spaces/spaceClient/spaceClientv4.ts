import { computeSha1Hex } from "./utils"
import type { Geolocation } from "src/integrations/Scenarios/geolocationSchema"

export type { Geolocation }

// Re-exported geolocation types for consumers
export type GeographicPoint3D = {
  latitude: number
  longitude: number
  ellipsoidHeight?: number
}

export type GeolocationInfo = {
  refPointWgs84?: GeographicPoint3D
}

// ============================================================================
// V4 API Types - Based on OpenAPI spec
// ============================================================================

export const baseUrl = "/api/scenario-service"

// ============================================================================
// Scenario Types
// ============================================================================

export type ModelReference = {
  fileUrn: string
  id: string
  revision: string
  referenceId?: string
  nameOverride?: string
  geolocationOverride?: Geolocation
  sourceReference?: string
  authoringEngine: string
}

export type ScenarioResponse = {
  fileId: string
  name: string
  predecessor?: {
    id: string
    revision: string
  }
  accProjectId: string
  fileUrn: string
  elementGroupId?: string
  id: string
  revision: string
  updatedAt: string
  updatedBy: string
  hubId: string
  folderUrn: string
  models?: ModelReference[]
  modelCount?: number
}

export type GetScenarioResponse = {
  scenario: ScenarioResponse
  models: ModelResponse[]
}

// ============================================================================
// Model Types
// ============================================================================

export type TerrainTile = {
  typeid: "autodesk.aec:component.terrainTile-1.0.0"
  elevationOffset: number
  gridIndexX: number
  gridIndexY: number
  location: string
  boundaryIndicesTop?: number[]
  boundaryIndicesBottom?: number[]
  boundaryIndicesLeft?: number[]
  boundaryIndicesRight?: number[]
  numTriangles?: number
  numVertices?: number
}

export type TerrainSurfaceRepresentation = {
  typeid: "autodesk.aec:component.terrainSurface-1.0.0"
  name: string
  id: string
  gridDimensions: {
    x: number
    y: number
  }
  gridOffset: {
    x: number
    y: number
    z: number
  }
  tiles: TerrainTile[]
  inventoryIds: string[]
}

export type RepresentationViewable3D = {
  typeid: "autodesk.aec.forma:representation-viewable-3d-1.0.0"
  id?: string
  name: string
  inventoryIds: string[]
  location: string
  serviceEndpoint?: string
  url?: string
}

export type RepresentationBinary = {
  typeid: "autodesk.aec.forma:representation-binary-1.0.0"
  id?: string
  name: string
  inventoryIds: string[]
  purpose?: string
  serviceEndpoint?: string
  format?: string
}

export type Representation = RepresentationViewable3D | RepresentationBinary | TerrainSurfaceRepresentation

export type Custom = {
  siteDesign: {
    internalModelReference: string
  }
}

export type ModelResponse = {
  accProjectId: string
  fileUrn: string
  elementGroupId?: string
  id: string
  revision: string
  name: string
  authoringEngine: string
  sourceReference?: string
  inventory?: string[]
  representations?: Representation[]
  predecessor?: {
    id: string
    revision: string
  }
  custom?: Custom
  geolocation?: Geolocation
  updatedAt: string
  updatedBy: string
}

// ============================================================================
// File+ Types
// ============================================================================

export type CreateFilePlusResponse = {
  fileUrn: string
  tipVersionUrn: string
  elementGroupId: string | null
  projectId: string
  folderId: string
  name: string
  contentType: string
  updatedAt: string
  updatedBy: string
}

// ============================================================================
// Binary Upload Types
// ============================================================================

export type InitiateBinaryUploadResponse = {
  location: string
  uploadUrls?: Array<{
    partNumber: number
    url: string
  }>
}

export type CompleteBinaryUploadResponse = {
  binaryElementId: string
  location: string
  status: string
}

// ============================================================================
// Scenario API Methods
// ============================================================================

/**
 * Get a scenario with all its models
 */
export async function getScenario(params: {
  projectId: string
  fileUrn: string
  scenarioId: string
}): Promise<GetScenarioResponse> {
  const { projectId, fileUrn, scenarioId } = params

  const url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` +
    `/files/${encodeURIComponent(fileUrn)}` +
    `/scenarios/${encodeURIComponent(scenarioId)}`

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "content-type": "application/json",
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`getScenario failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`)
  }

  return (await res.json()) as GetScenarioResponse
}

/**
 * Create a new scenario
 */
export async function createScenario(params: {
  projectId: string
  fileUrn: string
  name: string
  models?: ModelReference[]
}): Promise<ScenarioResponse> {
  const { projectId, fileUrn, name, models } = params

  const url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` + `/files/${encodeURIComponent(fileUrn)}` + `/scenarios`

  const body: any = { name }
  if (models && models.length > 0) {
    body.models = models
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`createScenario failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`)
  }

  return (await res.json()) as ScenarioResponse
}

/**
 * Update an existing scenario
 */
export async function updateScenario(params: {
  projectId: string
  fileUrn: string
  scenarioId: string
  id: string
  revision: string
  name: string
  models?: ModelReference[]
}): Promise<ScenarioResponse> {
  const { projectId, fileUrn, scenarioId, id, revision, name, models } = params

  const url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` +
    `/files/${encodeURIComponent(fileUrn)}` +
    `/scenarios/${encodeURIComponent(scenarioId)}`

  const body: any = { id, revision, name }
  if (models) {
    body.models = models
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`updateScenario failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`)
  }
  return (await res.json()) as ScenarioResponse
}

/**
 * Delete a model reference from a scenario
 */
export async function deleteScenarioModel(params: {
  projectId: string
  fileUrn: string
  scenarioId: string
  referenceId: string
}): Promise<void> {
  const { projectId, fileUrn, scenarioId, referenceId } = params

  const url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` +
    `/files/${encodeURIComponent(fileUrn)}` +
    `/scenarios/${encodeURIComponent(scenarioId)}` +
    `/models/${encodeURIComponent(referenceId)}`

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`deleteScenarioModel failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`)
  }
}

/**
 * List all scenarios in a project
 */
export async function listScenariosInProject(params: { projectId: string }): Promise<ScenarioResponse[]> {
  const { projectId } = params

  const url = `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}`

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "content-type": "application/json",
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`listScenariosInProject failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""} `)
  }

  return (await res.json()) as ScenarioResponse[]
}

// ============================================================================
// Model API Methods
// ============================================================================

/**
 * Create a new model
 */
export async function createModel(params: {
  projectId: string
  fileUrn: string
  name: string
  authoringEngine: string
  sourceReference?: string
  inventory?: string[]
  representations?: Representation[]
  geolocation?: Geolocation
  custom?: Custom
}): Promise<ModelResponse> {
  const {
    projectId,
    fileUrn,
    name,
    authoringEngine,
    sourceReference,
    inventory,
    representations,
    geolocation,
    custom,
  } = params

  const url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` + `/files/${encodeURIComponent(fileUrn)}` + `/models`

  const body: any = {
    name,
    authoringEngine,
  }

  if (sourceReference) body.sourceReference = sourceReference
  if (inventory) body.inventory = inventory
  if (representations) body.representations = representations
  if (geolocation) body.geolocation = geolocation
  if (custom) body.custom = custom

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`createModel failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""} `)
  }

  return (await res.json()) as ModelResponse
}

/**
 * Update an existing model
 */
export async function updateModel(params: {
  projectId: string
  fileUrn: string
  modelId: string
  revision: string
  name: string
  authoringEngine: string
  sourceReference?: string
  inventory?: string[]
  representations?: Representation[]
  geolocation?: Geolocation
  custom?: Custom
}): Promise<ModelResponse> {
  const {
    projectId,
    fileUrn,
    modelId,
    revision,
    name,
    authoringEngine,
    sourceReference,
    inventory,
    representations,
    geolocation,
    custom,
  } = params

  const url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` +
    `/files/${encodeURIComponent(fileUrn)}` +
    `/models/${encodeURIComponent(modelId)}`

  const body: any = {
    revision,
    name,
    authoringEngine,
  }
  if (sourceReference) body.sourceReference = sourceReference
  if (inventory) body.inventory = inventory
  if (representations) body.representations = representations
  if (geolocation) body.geolocation = geolocation
  if (custom) body.custom = custom

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`updateModel failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""} `)
  }

  return (await res.json()) as ModelResponse
}

/**
 * Get a model by ID
 */
export async function getModel(params: {
  projectId: string
  fileUrn: string
  modelId: string
  revision?: string
}): Promise<ModelResponse> {
  const { projectId, fileUrn, modelId, revision } = params

  let url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` +
    `/files/${encodeURIComponent(fileUrn)}` +
    `/models/${encodeURIComponent(modelId)}`

  if (revision) {
    url += `?revision=${encodeURIComponent(revision)}`
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "content-type": "application/json",
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`getModel failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""} `)
  }

  return (await res.json()) as ModelResponse
}

// ============================================================================
// File+ API Methods
// ============================================================================

/**
 * Create a File+ document
 */
export async function createFilePlus(params: {
  projectId: string
  folderId: string
  name: string
  contentType: string
}): Promise<CreateFilePlusResponse> {
  const { projectId, folderId, name, contentType } = params

  const url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` + `/folders/${encodeURIComponent(folderId)}` + `/fileplus`

  const body = {
    name,
    contentType,
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`createFilePlus failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""} `)
  }

  return (await res.json()) as CreateFilePlusResponse
}

// ============================================================================
// Binary Upload Methods
// ============================================================================

/**
 * Initiate a binary upload
 */
async function initiateBinaryUpload(params: {
  projectId: string
  fileUrn: string
  sha1Hex: string
}): Promise<InitiateBinaryUploadResponse> {
  const { projectId, fileUrn, sha1Hex } = params

  const url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` +
    `/files/${encodeURIComponent(fileUrn)}` +
    `/binary-uploads`

  const body = {
    partList: [{ partNumber: 1, sha1: sha1Hex }],
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`initiateBinaryUpload failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""} `)
  }

  return (await res.json()) as InitiateBinaryUploadResponse
}

/**
 * Upload binary data to signed URL
 */
async function uploadToSignedUrl(params: {
  uploadUrls: Array<{ partNumber: number; url: string }>
  data: Blob | ArrayBuffer | Uint8Array
  contentType?: string
}): Promise<void> {
  const { uploadUrls, data, contentType = "application/octet-stream" } = params
  const firstPart = uploadUrls[0]
  if (!firstPart) throw new Error("uploadUrls is empty")

  const res = await fetch(firstPart.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: data as any,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`uploadToSignedUrl failed: ${res.status} ${text} `)
  }
}

/**
 * Complete a binary upload
 */
async function completeBinaryUpload(params: {
  projectId: string
  fileUrn: string
  sha1Hex: string
  location: string
  fileExtension: string
  id?: string
}): Promise<CompleteBinaryUploadResponse> {
  const { projectId, fileUrn, sha1Hex, location, fileExtension, id } = params

  const url =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` +
    `/files/${encodeURIComponent(fileUrn)}` +
    `/binary-uploads/complete`

  const appMimeType = fileExtension === "glb" ? "application/vnd.autodesk.glb" : "application/json"

  const body = {
    id: id ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    location,
    sha1: sha1Hex,
    appMimeType,
    fileType: fileExtension,
    formatVersion: "1.0.0",
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`completeBinaryUpload failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""} `)
  }

  return (await res.json()) as CompleteBinaryUploadResponse
}

/**
 * Upload a GLB file to binary store - complete workflow
 */
export async function uploadToBinaryStore(
  glb: Uint8Array<ArrayBufferLike>,
  projectId: string,
  fileUrn: string,
): Promise<string> {
  const sha1Hex = await computeSha1Hex(glb)

  // Step 1: Initiate upload
  const { uploadUrls, location } = await initiateBinaryUpload({ projectId, fileUrn, sha1Hex })

  // Step 2: Upload to S3
  if (uploadUrls && uploadUrls.length > 0) {
    await uploadToSignedUrl({ uploadUrls, data: glb, contentType: "application/vnd.autodesk.glb" })
  }

  // Step 3: Complete upload
  const { binaryElementId } = await completeBinaryUpload({
    projectId,
    fileUrn,
    sha1Hex,
    location,
    fileExtension: "glb",
  })

  // Return the service endpoint URL
  const serviceEndpoint =
    `${baseUrl}/v4/projects/${encodeURIComponent(projectId)}` +
    `/files/${encodeURIComponent(fileUrn)}` +
    `/binary-elements/${encodeURIComponent(binaryElementId)}` +
    `?location=${encodeURIComponent(location)}`

  return serviceEndpoint
}
