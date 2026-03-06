import type { Urn, Properties, Representations, Representation, Child } from "forma-elements"
import type { Result, SavingError } from "src/core/elements-saving/result"
import { genericSaveError, ok, isErr } from "src/core/elements-saving/result"
import { request } from "src/lib/request"

export const INTEGRATE_BATCH_INGEST_LIMIT = 1000

const BATCH_OPERATION_API_PATH = "/api/integrate/v2/elements/batch-ingest"

export type IntegrateElementOperation = IntegrateElementCreateOperation | IntegrateElementUpdateOperation

export type IntegrateElementCreateOperation = {
  operation: "create"
  urn: Urn
  properties: Properties
  representations: Representations
  children: Child[]
}

export type IntegrateElementUpdateOperation = {
  operation: "update"
  urn: Urn
  nextUrn: Urn
  properties: Properties
  representations: Record<string, Representation | null | undefined>
  children: Child[]
}

export type IntegrateBatchIngestResponse = {
  items: IntegrateIngestResponseItem[]
}

export type IntegrateIngestResponseItem = IntegrateIngestResponseItemOk | IntegrateIngestResponseItemError

export type IntegrateIngestResponseItemOk = {
  status: "ok"
  urn: Urn
}

export type IntegrateIngestResponseItemError = {
  status: "failed"
  error: {
    title: string
    detail: string
    errors: unknown[]
  }
}

export type IntegrateUploadLinkResponse = {
  id: string
  url: string
  blobId: string
}

export namespace IntegrateElementClient {
  export async function uploadData(
    data: BodyInit,
    authcontext: string,
  ): Promise<Result<IntegrateUploadLinkResponse, SavingError>> {
    const uploadDetailsResult = await getUploadDetails(authcontext)
    if (isErr(uploadDetailsResult)) {
      return uploadDetailsResult
    }

    const uploadResponse = await request(uploadDetailsResult.data.url, { method: "PUT", body: data })
    if (!uploadResponse.ok) {
      return genericSaveError("failed to upload representation data")
    }

    return uploadDetailsResult
  }

  export async function getUploadDetails(
    authcontext: string,
  ): Promise<Result<IntegrateUploadLinkResponse, SavingError>> {
    const res = await request(`/api/integrate/upload_link?authcontext=${authcontext}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "true",
      },
    })

    if (!res.ok) {
      return genericSaveError("failed to get upload link")
    }

    return ok(await res.json())
  }

  export function shouldUploadPayload(data: string) {
    // Lambda can accept a maximum of 6 MB.
    // Using a limit of 4 MB to be safe, and to allow it to be base64 encoded
    // without overshooting the 6 MB.
    return data.length >= 4 * 1024 * 1024
  }

  export async function sendBatchOperations(
    operations: IntegrateElementOperation[],
    authcontext: string,
  ): Promise<Result<IntegrateBatchIngestResponse, SavingError>> {
    const operationsPayload = JSON.stringify({ items: operations })

    let batchOperationsAPIPath = `${BATCH_OPERATION_API_PATH}?authcontext=${encodeURIComponent(authcontext)}`
    let operationsFetchParams: { url: string; body?: string }

    if (shouldUploadPayload(operationsPayload)) {
      const uploadDetailsResult = await uploadData(operationsPayload, authcontext)

      if (isErr(uploadDetailsResult)) {
        return uploadDetailsResult
      }

      operationsFetchParams = {
        url: batchOperationsAPIPath + `&s3Id=${encodeURIComponent(uploadDetailsResult.data.id)}`,
      }
    } else {
      operationsFetchParams = {
        url: batchOperationsAPIPath,
        body: operationsPayload,
      }
    }

    const batchOperationResponse = await request(operationsFetchParams.url, {
      method: "POST",
      body: operationsFetchParams.body,
    })

    if (!batchOperationResponse.ok) {
      return genericSaveError("failed to save integrate element operations")
    }

    return ok(await batchOperationResponse.json())
  }
}
