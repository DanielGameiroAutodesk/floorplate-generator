import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { PutElement } from "./lambda-types"
import { request } from "src/lib/request"
import { validateIsElementResponse } from "src/lib/elementFormatUtils"
import { elementResponseToMap } from "@spacemakerai/elements-client"

export const BasicElementsClient = {
  put: (
    batchId: string,
    nextRevision: string,
    body: PutElement[],
    authcontext: string,
  ): Promise<Map<Urn, FormaElement>> => {
    const url = `/api/basic/elements/${batchId}/revisions/${nextRevision}?authcontext=${authcontext}&newRepresentations`

    return request(url, { method: "PUT", body: JSON.stringify(body) })
      .then((res) => res.json())
      .then(validateIsElementResponse)
      .then(elementResponseToMap)
  },

  putV2: (body: PutElement[], authcontext: string): Promise<Map<Urn, FormaElement>> => {
    const url = `/api/basic/elements?authcontext=${authcontext}&newRepresentations`
    return request(url, { method: "PUT", body: JSON.stringify(body) })
      .then((res) => res.json())
      .then(validateIsElementResponse)
      .then(elementResponseToMap)
  },
}
