import { Mesh } from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { BufferGeometryUtils } from "three/examples/jsm/Addons.js"
import { v4 as uuidv4 } from "uuid"
import type { Urn } from "forma-elements"
import { createUrn, parseUrn } from "src/lib/element/urn"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"
import { scenarioRenderablesSignal } from "./scenario"

/**
 * Create an element for all scenario models in integrate API
 */
export async function createScenarioElement(authContext: string): Promise<Urn> {
  const geometries = scenarioRenderablesSignal.peek() ?? []
  const uploadLink = await fetch(`/api/integrate/upload-link?authcontext=${authContext}`).then((res) => res.json())
  const { blobId, url } = uploadLink

  const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries)
  const glb: ArrayBuffer = await new Promise((resolve, reject) => {
    const exportMesh = new Mesh(mergedGeometry.clone())
    exportMesh.geometry.rotateX(-Math.PI / 2) // Convert Z-up to Y-up
    new GLTFExporter().parse(exportMesh, (res) => resolve(res as ArrayBuffer), reject, { binary: true })
  })

  const uploadResponse = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "model/gltf-binary" },
    body: glb,
  })
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload GLB: ${uploadResponse.status} ${uploadResponse.statusText}`)
  }

  const elementSaveUrl = `/api/integrate/v2/elements?authcontext=${authContext}`
  const elementBody = {
    properties: {
      scenariosElement: "true",
    },
    representations: {
      volumeMesh: {
        type: "linked",
        blobId: blobId,
      },
    },
  }
  const { urn } = await fetch(elementSaveUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(elementBody),
  }).then((res) => res.json())

  return urn
}

/**
 * Create analysable proposal element containing models from the given Scenario
 */
export async function createAnalysableProposal(scenarioElementUrn: Urn, authContext: string): Promise<Urn> {
  const currentProposalElement = elementState.currentProposalSignal.peek().element
  const newProposalBody = {
    ...currentProposalElement,
    properties: {
      ...currentProposalElement.properties,
      analysisOnly: "true",
    },
    children: currentProposalElement.children?.concat({ urn: scenarioElementUrn, key: uuidv4() }) ?? [
      { urn: scenarioElementUrn, key: uuidv4() },
    ],
  }

  const { id: proposalId, revision: currentRevision } = parseUrn(currentProposalElement.urn)
  const nextRevision = String(Date.now())

  const putProposalResponse = await fetch(
    `/api/proposal/elements/${proposalId}/revisions/${currentRevision}?version=2&authcontext=${authContext}&nextRevision=${nextRevision}&skipLatest=true`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProposalBody),
    },
  )
  if (!putProposalResponse.ok) {
    throw new Error(`Failed to update proposal: ${putProposalResponse.status} ${putProposalResponse.statusText}`)
  }
  await putProposalResponse.json()

  return createUrn("proposal", authContext, proposalId, nextRevision)
}

type SunAnalysisParams = {
  rootElementUrn: string
  selectedElementPaths: string[]
  geoLocation: [number, number]
  dates: Array<{ month: number; date: number }>
  tags: string[]
}

/**
 * Trigger sun analysis for the proposal element
 */
export async function triggerSunAnalysis(params: SunAnalysisParams, authContext: string): Promise<unknown> {
  const analysisBody = {
    rootElementUrn: params.rootElementUrn,
    params: {
      selectedElementPaths: params.selectedElementPaths,
      geoLocation: params.geoLocation,
    },
    dates: params.dates,
    tags: params.tags,
  }

  const analysisTriggerUrl = `/api/sun-analysis/trigger_batch?authcontext=${authContext}`
  const analysisTriggerResponse = await fetch(analysisTriggerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(analysisBody),
  })
  if (!analysisTriggerResponse.ok) {
    throw new Error(
      `Failed to trigger analysis: ${analysisTriggerResponse.status} ${analysisTriggerResponse.statusText}`,
    )
  }

  return analysisTriggerResponse.json()
}

export async function createAnalysableProposalFromScenario(): Promise<Urn> {
  const authContext = PROJECT_ID
  const scenarioElementUrn = await createScenarioElement(authContext)
  const rootElementUrn = await createAnalysableProposal(scenarioElementUrn, authContext)
  return rootElementUrn
}
