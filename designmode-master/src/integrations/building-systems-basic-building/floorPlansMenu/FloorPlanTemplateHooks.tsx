import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { parseUrn } from "src/lib/element/urn"
import { request } from "src/lib/request"
import { PROJECT_ID } from "src/core/project/project"
import { captureException } from "@sentry/browser"
import { useEffect, useMemo } from "preact/hooks"
import { getElementsClient } from "src/core/elements-loading/loading"
import { isDefined } from "src/lib/array"
import { signal } from "@preact/signals"
import { getTranslator } from "src/i18n"

type Point = [number, number]
type Polygon = Point[]
type PolygonWithHoles = { polygon: Polygon; holes: Polygon[] }
type OuterShape = PolygonWithHoles[]
type TemplateUnit = { type: string; id: string; geo: PolygonWithHoles }
export type FloorPlanTemplate = {
  id: string
  name: string
  outerGeo: OuterShape
  units: TemplateUnit[]
  isEmptyTemplate?: boolean
}
export type FloorPlanTemplates = Record<string, FloorPlanTemplate>

const addFloorPlanToLibrary = async (element: FormaElement) => {
  const { id, revision } = parseUrn(element.urn)
  const floorPlanResponse = await request(
    `/api/floor-plan-store/elements/${id}/revisions/${revision}?authcontext=${PROJECT_ID}&newRepresentations`,
    {
      method: "PUT",
      body: JSON.stringify(element),
    },
  ).then((r) => {
    return r.json()
  })
  const floorPlanElement = Object.values(floorPlanResponse)[0] as FormaElement
  const name = floorPlanElement.properties?.name
  return request(`/api/forma-library/?authcontext=${PROJECT_ID}`, {
    method: "POST",
    body: JSON.stringify({ urn: floorPlanElement.urn, name, id }),
  })
    .then((r) => {
      return r.json()
    })
    .then((r) => {
      const t = getTranslator()
      window.forma_toasts.push({
        content: t(($) => $.library.addedToLibrary, { name: name || "element" }),
        status: "success",
      })
      return r.id as string
    })
}

function getCustomerId() {
  const ss = window.sessionStorage.getItem("forma-projectdata")
  try {
    const parsed = JSON.parse(ss || "")
    return parsed.customerId
  } catch {
    return undefined
  }
}

function fetchLibraryContentFromAuthContext(cus: string) {
  return request(`/api/forma-library/?authcontext=${cus}`).then(
    (r) => r.json(),
    (e) => {
      if (e?.responseCode === 401 || e?.responseCode === 403) return []
      throw e
    },
  )
}

function fetchFloorPlanTemplates(): Promise<Record<string, FloorPlanTemplate>> {
  const cus = getCustomerId()
  const promises = [fetchLibraryContentFromAuthContext(PROJECT_ID)]
  if (cus) {
    promises.push(fetchLibraryContentFromAuthContext(cus))
  }
  return Promise.all(promises)
    .then((r: { urn: Urn; name?: string; id: string }[][]) =>
      Promise.all(
        r
          .flat()
          .filter((e) => e?.urn && parseUrn(e.urn).system === "floor-plan-store")
          .map(async ({ name, urn, id }) => {
            const { element } = await getElementsClient().getElementAutoBatched(urn)
            const template: FloorPlanTemplate = element.properties?.floorPlanTemplate
            if (!template) return undefined
            return { ...template, id, name: name ?? template.name }
          }),
      ),
    )
    .then((responses) =>
      responses
        .flat()
        .filter(isDefined)
        .reduce(
          (acc, curr) => {
            acc[curr.id] = curr
            return acc
          },
          {} as Record<string, FloorPlanTemplate>,
        ),
    )
    .catch((e) => {
      captureException(e, { tags: { owner: "building-systems" } })
      const t = getTranslator()
      window.forma_toasts.push({
        content: t(($) => $.errors.library.failedToDownloadFloorPlans),
        status: "warning",
      })
      return {}
    })
}

export const floorPlansSignal = signal<Record<string, FloorPlanTemplate>>({})

export const useLibraryFloorPlanTemplates = () => {
  useEffect(() => {
    const updateLibrary = (e?: CustomEvent) => {
      if (e?.detail?.updatedFromFloorPlanTemplateHooks) {
        return
      }
      void fetchFloorPlanTemplates().then((floorPlanTemplates) => {
        Object.keys(floorPlanTemplates).forEach((id, i) => {
          const name = floorPlanTemplates[id].name || "Name " + i
          floorPlanTemplates[id] = { ...floorPlanTemplates[id], id: id, name }
        })
        floorPlansSignal.value = floorPlanTemplates
      })
    }
    updateLibrary()
    window.addEventListener("sm-library/refresh", updateLibrary)
    return () => window.removeEventListener("sm-library/refresh", updateLibrary)
  }, [])
}

function updateLibraryItem(templateId: string, method: string, body?: string) {
  request(`/api/forma-library/${templateId}?authcontext=${PROJECT_ID}`, {
    method,
    body,
  })
    .then((r) => {
      window.dispatchEvent(
        new CustomEvent("sm-library/refresh", { detail: { updatedFromFloorPlanTemplateHooks: true } }),
      )
      return r
    })
    .catch((e) => {
      captureException(e, { tags: { owner: "building-systems" } })
      const t = getTranslator()
      window.forma_toasts.push({
        content: t(($) => $.errors.library.failedToUpdateLibrary),
        status: "warning",
      })
    })
}

function saveFloorPlanTemplates(_newTemplates: FloorPlanTemplate[]) {
  // set generator (parking) units to unassigned as we don't have parameters for them
  const newTemplates = _newTemplates.map((template) => ({
    ...template,
    units: template.units.map((unit) => ({
      ...unit,
      type: unit.type === "GENERATOR" || unit.type === "PARKING" ? "UNASSIGNED" : unit.type,
    })),
  }))

  const revision = Date.now().toString()
  const templateElements: FormaElement[] = newTemplates.map((t) => {
    return {
      urn: `urn:adsk-forma-elements:floor-plans:${PROJECT_ID}:${t.id}:${revision}`,
      properties: {
        floorPlanTemplate: t,
        name: t.name,
      },
    }
  })
  const libraryIds: Record<string, string> = {}
  void Promise.all(
    templateElements.map(async (e) => {
      libraryIds[e.properties!.floorPlanTemplate.id as string] = await addFloorPlanToLibrary(e)
    }),
  ).then(() => {
    window.dispatchEvent(new CustomEvent("sm-library/refresh", { detail: { updatedFromFloorPlanTemplateHooks: true } }))
    const curr = floorPlansSignal.peek()
    const updatedTemplates = { ...curr }
    newTemplates.forEach((template) => {
      const withLibraryId = { ...template, id: libraryIds[template.id] }
      updatedTemplates[withLibraryId.id] = withLibraryId
    })
    floorPlansSignal.value = updatedTemplates
  })
}

function deleteFloorPlanTemplate(templateId: string) {
  const updatedTemplates = { ...floorPlansSignal.peek() }
  delete updatedTemplates[templateId]
  floorPlansSignal.value = updatedTemplates
  updateLibraryItem(templateId, "DELETE")
}

function renameFloorPlanTemplate(templateId: string, newName: string) {
  const floorPlanTemplates = floorPlansSignal.peek()
  if (floorPlanTemplates[templateId] === undefined) return

  const updatedTemplate = { ...floorPlanTemplates[templateId], name: newName }
  floorPlansSignal.value = { ...floorPlanTemplates, [templateId]: updatedTemplate }
  updateLibraryItem(templateId, "PUT", JSON.stringify({ name: newName }))
}

export const useFloorPlanTemplates = (): {
  templates: FloorPlanTemplates
  saveFloorPlanTemplates: (templates: FloorPlanTemplate[]) => void
  deleteFloorPlanTemplate: (templateId: string) => void
  renameFloorPlanTemplate: (templateId: string, name: string) => void
} => {
  const floorPlanTemplates = floorPlansSignal.value

  return useMemo(
    () => ({
      templates: floorPlanTemplates,
      saveFloorPlanTemplates,
      deleteFloorPlanTemplate,
      renameFloorPlanTemplate,
    }),
    [floorPlanTemplates],
  )
}
