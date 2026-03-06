import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { request } from "src/lib/request"
import { parseUrn } from "src/lib/element/urn"
import type { NotPersistedContainers, SavingResult, SavingSuccess } from "src/core/elements-saving/result"
import { catchSavingError } from "src/core/elements-saving/result"
import { isDefined } from "src/lib/array"
import { validateIsElementResponse } from "src/lib/elementFormatUtils"
import { asRasterElement } from "./api"
import { elementResponseToMap } from "@spacemakerai/elements-client"

export type PutElement = {
  blob_id: string
  color?: string
  opacity?: number
}

export const RasterElementClient = {
  put: (
    elementId: string,
    nextRevision: string,
    body: PutElement,
    authcontext: string,
  ): Promise<Map<Urn, FormaElement>> => {
    const url = `/api/raster/elements/${elementId}/revisions/${nextRevision}?authcontext=${authcontext}&newRepresentations`

    return request(url, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then(validateIsElementResponse)
      .then(elementResponseToMap)
  },
}

export async function saveRasterElements(urns: NotPersistedContainers[], authContext: string): Promise<SavingResult[]> {
  const elementsToSave = urns
    .map(({ container, dependenciesPersisted, parentUrn }) =>
      dependenciesPersisted
        ? {
            element: container.element,
            parentUrn,
          }
        : undefined,
    )
    .filter(isDefined)

  return Promise.all(
    elementsToSave.map((toSave) => {
      const element = asRasterElement(toSave.element)
      const parsedUrn = parseUrn(element.urn)
      const body: PutElement = {
        blob_id: element.representations.terrainTexture.blobId,
        color: element.properties?.color,
        opacity: element.properties?.opacity,
      }

      return catchSavingError(() =>
        RasterElementClient.put(parsedUrn.id, parsedUrn.revision, body, authContext).then<SavingSuccess>((it) => ({
          updatedElementsFromSystem: it,
        })),
      )
    }),
  )
}
