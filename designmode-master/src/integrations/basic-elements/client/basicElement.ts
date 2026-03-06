import type { Urn } from "@spacemakerai/element-types"
import type { Feature } from "geojson"
import type { PutElement } from "./lambda-types"
import { BasicElementsClient } from "./client"
import type { NotPersistedContainers, SavingResult, SavingSuccess } from "src/core/elements-saving/result"
import { catchSavingError } from "src/core/elements-saving/result"
import { parseUrn } from "src/lib/element/urn"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import { objectKeys } from "src/lib/record"
import { assertIsDefined } from "src/lib/assertions"
import type { ElementContainer } from "src/core/elements/ElementContainer"

function makeRequestProperties(oldProps: any): any {
  if (oldProps) {
    const properties = { ...oldProps }
    objectKeys(properties).forEach((key) => {
      const val = properties[key]
      properties[key] = val === undefined ? null : val
    })
    return properties
  } else {
    return null
  }
}

export async function saveBasic(
  items: NotPersistedContainers[],
  getFootprint: (urn: Urn) => Feature | undefined,
  authContext: string,
): Promise<SavingResult[]> {
  // TODO: Probably check if dependencies are persisted, however, basic elements don't have any dependecies when writing this
  const groupedByBatch = items.reduce<Record<string, ElementContainer[]>>((prev, { container }) => {
    const { id, revision } = parseUrn(container.element.urn)
    const batchId = id.split("+")[0]

    const key = `${batchId}_${revision}`
    if (!prev[key]) {
      prev[key] = []
    }
    prev[key].push(container)
    return prev
  }, {})

  return Promise.all(
    Object.entries(groupedByBatch).map(([key, groupItems]) => {
      const [batchId, revision] = key.split("_")

      const body: PutElement[] = groupItems.map((groupItem): PutElement => {
        const element = groupItem.element
        const urn = element.urn
        const properties = makeRequestProperties(element.properties)
        return {
          id: parseUrn(urn).id.split("+")[1],
          properties,
          geojson: assertIsDefined(`Expected a footprint for ${urn}`, getFootprint(urn)) as BasicFeature,
          children: element.children,
          metadata: element.metadata,
        }
      })
      return catchSavingError<SavingSuccess>(() =>
        BasicElementsClient.put(batchId, revision, body, authContext).then((it) => ({
          updatedElementsFromSystem: it,
        })),
      )
    }),
  )
}
