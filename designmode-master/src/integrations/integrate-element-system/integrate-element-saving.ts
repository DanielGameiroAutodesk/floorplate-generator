import type { Representation, Representations, Properties, Urn, LinkedRepresentation } from "forma-elements"
import type {
  IntegrateElementCreateOperation,
  IntegrateElementOperation,
  IntegrateElementUpdateOperation,
} from "./IntegrateElementClient"
import { INTEGRATE_BATCH_INGEST_LIMIT } from "./IntegrateElementClient"
import { IntegrateElementClient } from "./IntegrateElementClient"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { isErr, isOk, ok } from "src/core/elements-saving/result"
import { genericSaveError } from "src/core/elements-saving/result"
import { extractIntegrateElementContainerCustomData } from "./IntegrateElementSystem"
import type { PreparedLinkedRepresentation } from "./IntegrateElementSystem"
import { objectKeys } from "src/lib/record"
import { request } from "src/lib/request"
import type { SavingError, NotPersistedContainers, Result } from "src/core/elements-saving/result"
import { parseUrn } from "src/lib/element/urn"
import { getInMapOrThrow } from "src/lib/map"
import pMap from "p-map"

export type PreparedLinkedRepresentationUploaded = {
  urn: Urn
  representationKey: string
  preparedLinkedRepresentation: PreparedLinkedRepresentation
  linkedRepresentation: LinkedRepresentation
}

export type PreparedLinkedRepresentationUploadResult = Result<PreparedLinkedRepresentationUploaded, SavingError>
export type PreparedLinkedRepresentationUploadJob = () => Promise<
  Result<PreparedLinkedRepresentationUploaded, SavingError>
>

type UniquePreparedLinkedRepresentationsUploaded = Map<() => unknown, LinkedRepresentation>

export async function* saveElementsBatched(
  elementContainers: NotPersistedContainers[],
  authcontext: string,
): AsyncGenerator<Array<Result<Urn, SavingError>>> {
  // A batch should not contain a parent and a later batch contain its child because that would cause
  // an element that temporarily points to a non existent child.
  // Simpler would be to use NotPersistedContainer.dependenciesPersisted and only save the ones where
  // that is false, but with this extra complexity we get the benefit of getting more done at once,
  // which makes saving overall faster.
  const childFirstContainers = getChildFirstContainersFromNotPersistedContainers(elementContainers)

  // Prepared linked representations should only upload once, even across batches
  const uploadedRepresentationsStore: UniquePreparedLinkedRepresentationsUploaded = new Map()

  // Batch the elements by integrate-api operation limit because there is one operation per element
  for (const containersBatch of batch(childFirstContainers, INTEGRATE_BATCH_INGEST_LIMIT)) {
    // Each operation may have multiple uploads, and some may be redundant, so prepare the unique jobs
    const representationDataUploads = createUniquePreparedLinkedRepresentationUploadJobs(
      containersBatch,
      uploadedRepresentationsStore,
      authcontext,
    )

    // Perform the upload jobs concurrently and sort the results by getData ref
    const uploadedPreparedLinkedRepresentations: PreparedLinkedRepresentationUploaded[] = []
    await pMap(
      representationDataUploads,
      async (job: PreparedLinkedRepresentationUploadJob) => {
        const uploadJobResult = await job()
        if (isOk(uploadJobResult)) {
          uploadedPreparedLinkedRepresentations.push(uploadJobResult.data)
        }
      },
      { concurrency: 5 },
    )

    // For each element in the operation batch, assemble the operation
    const elementOperations = containersBatch.map((container: ElementContainer) =>
      prepareIntegrateElementOperation(container, uploadedRepresentationsStore, uploadedPreparedLinkedRepresentations),
    )

    // Perform the batch operation and assemble the results
    const operationsResponse = await IntegrateElementClient.sendBatchOperations(elementOperations, authcontext)

    if (isErr(operationsResponse)) {
      return operationsResponse
    }

    const persistedUrns: Array<Result<Urn, SavingError>> = []
    for (const operationResponseItem of operationsResponse.data.items) {
      if (operationResponseItem.status === "failed") {
        persistedUrns.push(genericSaveError("saving operation failed for element"))
      } else {
        persistedUrns.push(ok(operationResponseItem.urn))
      }
    }

    yield persistedUrns
  }
}

function createUniquePreparedLinkedRepresentationUploadJobs(
  elementContainers: ElementContainer[],
  uploadedRepresentationsStore: UniquePreparedLinkedRepresentationsUploaded,
  authcontext: string,
): PreparedLinkedRepresentationUploadJob[] {
  const uploadJobs: PreparedLinkedRepresentationUploadJob[] = []
  const includedPreparedData: Set<() => unknown> = new Set()

  for (const elementContainer of elementContainers) {
    const preparedLinkedRepresentations =
      extractIntegrateElementContainerCustomData(elementContainer)?.preparedLinkedRepresentations

    for (const [repKey, preparedLinkedRep] of Object.entries(preparedLinkedRepresentations ?? {})) {
      if (
        !includedPreparedData.has(preparedLinkedRep.getData) &&
        !uploadedRepresentationsStore.has(preparedLinkedRep.getData)
      ) {
        includedPreparedData.add(preparedLinkedRep.getData)
        uploadJobs.push(async () => {
          const linkedRepresentationResult = await uploadPreparedLinkedRepresentationIntegrate(
            preparedLinkedRep,
            authcontext,
          )

          if (isErr(linkedRepresentationResult)) {
            return linkedRepresentationResult
          }

          uploadedRepresentationsStore.set(preparedLinkedRep.getData, linkedRepresentationResult.data)

          return ok({
            urn: elementContainer.element.urn,
            representationKey: repKey,
            preparedLinkedRepresentation: preparedLinkedRep,
            linkedRepresentation: linkedRepresentationResult.data,
          })
        })
      }

      // Temporarily here until officially depricated.
      if (repKey === "axm") {
        uploadJobs.push(async () => {
          const linkedRepresentationResult = await uploadPreparedLinkedRepresentationSos(preparedLinkedRep, authcontext)

          if (isErr(linkedRepresentationResult)) {
            return linkedRepresentationResult
          }

          return ok({
            urn: elementContainer.element.urn,
            representationKey: "__axm_depricated_sos",
            preparedLinkedRepresentation: preparedLinkedRep,
            linkedRepresentation: linkedRepresentationResult.data,
          })
        })
      }
    }
  }

  return uploadJobs
}

async function uploadPreparedLinkedRepresentationIntegrate(
  preparedLinkedRepresentation: PreparedLinkedRepresentation,
  authcontext: string,
): Promise<Result<LinkedRepresentation, SavingError>> {
  const data = await preparedLinkedRepresentation.getData()
  const uploadResult = await IntegrateElementClient.uploadData(data, authcontext)
  if (isErr(uploadResult)) {
    return uploadResult
  }

  return ok({
    type: "linked",
    selection: preparedLinkedRepresentation.selection,
    properties: preparedLinkedRepresentation.properties,
    blobId: uploadResult.data.blobId,
  })
}

// Temporary until storing in spacemaker object storage is officially depricated
async function uploadPreparedLinkedRepresentationSos(
  preparedLinkedRepresentation: PreparedLinkedRepresentation,
  authcontext: string,
): Promise<Result<LinkedRepresentation, SavingError>> {
  const file = (await preparedLinkedRepresentation.getData()) as File
  const sosS3IdResult = await uploadToSOS(file, authcontext)
  if (isErr(sosS3IdResult)) {
    return sosS3IdResult
  }

  return ok({
    type: "linked",
    selection: preparedLinkedRepresentation.selection,
    properties: preparedLinkedRepresentation.properties,
    blobId: sosS3IdResult.data,
  })
}

// Assemble integrate element persistance operations
function prepareIntegrateElementOperation(
  elementContainer: ElementContainer,
  uploadedRepresentations: UniquePreparedLinkedRepresentationsUploaded,
  uploadedPreparedLinkedRepresentations: PreparedLinkedRepresentationUploaded[], // NOTE we can remove this once we remove axm via sos
): IntegrateElementOperation {
  const element = elementContainer.element
  const customData = extractIntegrateElementContainerCustomData(elementContainer)
  const elementPreparedLinkedReps = customData?.preparedLinkedRepresentations
  const representationsToDelete = customData?.representationsToDelete

  let additionalProperties: Properties = {}
  let additionalRepresentations: Record<string, null | Representation> = {}

  for (const [representationKey, preparedLinkedRepresentation] of Object.entries(elementPreparedLinkedReps ?? {})) {
    // Special case for the __axm_depricated_sos, it must go into properties.
    // This is temporary until all consumers switch to using the 'axm' LinkedRepresentation
    if (representationKey === "axm") {
      const axmSosUploaded = uploadedPreparedLinkedRepresentations.find(
        (uploadedRep) => uploadedRep.representationKey === "__axm_depricated_sos" && uploadedRep.urn === element.urn,
      )
      additionalProperties.spacemakerObjectStorageReferences = [axmSosUploaded!.linkedRepresentation.blobId]
      additionalProperties.spacemakerObjectStorageReferenceFormats = ["axm"]
      additionalProperties.internalRepresentationHeightOffset =
        axmSosUploaded!.linkedRepresentation.properties?.internalRepresentationHeightOffset
    }

    if (uploadedRepresentations.has(preparedLinkedRepresentation.getData)) {
      additionalRepresentations[representationKey] = {
        type: "linked",
        properties: preparedLinkedRepresentation.properties,
        selection: preparedLinkedRepresentation.selection,
        blobId: uploadedRepresentations.get(preparedLinkedRepresentation.getData)!.blobId,
      }
    }
  }

  const predecessorUrn = element.metadata?.predecessor
  const predecessorSystem = predecessorUrn ? parseUrn(predecessorUrn).system : null
  if (predecessorUrn && predecessorSystem === "integrate") {
    // Only delete representations if it is an update
    for (const repName of representationsToDelete ?? []) {
      additionalRepresentations[repName] = null
    }

    const updateOperation: IntegrateElementUpdateOperation = {
      operation: "update",
      urn: predecessorUrn,
      nextUrn: element.urn,
      properties: {
        ...(element.properties ?? {}),
        ...additionalProperties,
      },
      representations: {
        ...(element.representations ?? {}),
        ...(additionalRepresentations ?? {}),
      },
      children: element.children ?? [],
    }

    return updateOperation
  }

  const createOperation: IntegrateElementCreateOperation = {
    operation: "create",
    urn: element.urn,
    properties: {
      ...(element.properties ?? {}),
      ...additionalProperties,
    },
    representations: {
      ...(element.representations ?? {}),
      ...((additionalRepresentations as Representations) ?? {}),
    },
    children: element.children ?? [],
  }

  return createOperation
}

// The plan is to depricate SOS in favor of integrate-api. This is here temporarily
async function uploadToSOS(file: File, projectId: string): Promise<Result<string, SavingError>> {
  const payload = JSON.stringify({
    projectId,
  })

  const res = await request(`/api/spacemaker-object-storage/v1/`, {
    method: "POST",
    body: payload,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "true",
    },
  })

  if (res.ok) {
    const { id, url, fields } = await res.json()
    const formData = new FormData()

    objectKeys<Record<string, any>>(fields).forEach((key) => {
      formData.append(key, fields[key])
    })

    formData.append("file", file)

    const formRes = await request(url, {
      method: "POST",
      body: formData,
      headers: {
        "Set-Cookie": "true",
      },
    })

    if (formRes.ok) {
      return ok(id)
    }
  }

  return genericSaveError("failed to upload sos file")
}

function* batch<T>(items: T[], batchSize: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    yield batch
  }
}

// NOTE: The below is recreating a graph we already have but got flattened as elementsToSave.
//       There is potential to reorganize some things so that the below is a little easier.

type UrnParentChildrenGraphNode = { urn: Urn; children?: Set<UrnParentChildrenGraphNode> }
type UrnParentChildrenGraph = Set<UrnParentChildrenGraphNode>
function buildNotPersistedContainersParentChildrenGraph(
  notPersistedItems: NotPersistedContainers[],
): UrnParentChildrenGraph {
  const graphNodes = new Map<Urn, UrnParentChildrenGraphNode>()
  const mentionedUrns = new Set<Urn>()

  for (const notPersistedItem of notPersistedItems) {
    mentionedUrns.add(notPersistedItem.urn)

    if (!graphNodes.has(notPersistedItem.urn)) {
      graphNodes.set(notPersistedItem.urn, { urn: notPersistedItem.urn, children: new Set() })
    }

    if (notPersistedItem.parentUrn) {
      if (!graphNodes.has(notPersistedItem.parentUrn)) {
        graphNodes.set(notPersistedItem.parentUrn, { urn: notPersistedItem.parentUrn, children: new Set() })
      }
      const parent = graphNodes.get(notPersistedItem.parentUrn)
      const child = graphNodes.get(notPersistedItem.urn)
      parent?.children?.add(child!)
    }
  }

  // Remove nodes that are only mentioned as parentUrns but never appear as urns
  for (const graphNodeUrn of graphNodes.keys()) {
    if (!mentionedUrns.has(graphNodeUrn)) {
      graphNodes.delete(graphNodeUrn)
    }
  }

  for (const node of graphNodes.values()) {
    if (node.children && node.children.size === 0) {
      delete node.children
    }
  }

  return new Set([...graphNodes.values()])
}

function getContainerGraphNodesSortedChildrenFirst(
  graph: UrnParentChildrenGraph,
  byUrn: Map<Urn, ElementContainer>,
): ElementContainer[] {
  const result: ElementContainer[] = []
  const visited = new Set<UrnParentChildrenGraphNode>()

  function dfs(node: UrnParentChildrenGraphNode) {
    if (visited.has(node)) {
      return
    }
    visited.add(node)

    if (node.children) {
      for (const child of node.children) {
        dfs(child)
      }
    }

    result.push(getInMapOrThrow(byUrn, node.urn))
  }

  for (const rootNode of graph) {
    if (!visited.has(rootNode)) {
      dfs(rootNode)
    }
  }

  return result.reverse()
}

function getChildFirstContainersFromNotPersistedContainers(
  notPersistedContainers: NotPersistedContainers[],
): ElementContainer[] {
  const graph = buildNotPersistedContainersParentChildrenGraph(notPersistedContainers)
  const byUrn = new Map(notPersistedContainers.map((item) => [item.urn, item.container]))
  return getContainerGraphNodesSortedChildrenFirst(graph, byUrn)
}
