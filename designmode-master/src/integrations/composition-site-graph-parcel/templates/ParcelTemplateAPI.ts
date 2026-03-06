import { parseUrn } from "src/lib/element/urn"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { SuccessLibraryItem } from "src/integrations/library/api"
import { fetchLibraryItems } from "src/integrations/library/api"
import { isDefined } from "src/lib/array"
import { request } from "src/lib/request"
import type { ParametricElementFormaElement } from "src/integrations/parametric-element-system/parametricElementClient"
import { parametricElementClient } from "src/integrations/parametric-element-system/parametricElementClient"
import type { BufferGeometry } from "three"
import { captureException } from "@sentry/browser"
import type { ParcelParameters } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import {
  createParcelElementWithRowHouse,
  defaultParcelParameters,
  isParcelComposition,
  toElements,
} from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { Result, SavingError } from "src/core/elements-saving/result"
import { getElementsWithChildren } from "src/core/elements-loading/elementFetching"
import { effect, signal } from "@preact/signals"
import type { ParcelTemplate } from "./types"
import { toReadonlySignal } from "./signalHelpers"
import { getElementsClient, getRepresentationsByUrn } from "src/core/elements-loading/loading"
import type { PrivateOutdoorSpaceElement } from "src/integrations/composition-site-graph-parcel/privateOutdoorSpace/privateOutdoorSpaceGenerator"
import { isPrivateOutdoorSpaceElement } from "src/integrations/composition-site-graph-parcel/privateOutdoorSpace/privateOutdoorSpaceGenerator"
import { defaultCursor, loadingCursor } from "src/integrations/cursors/setCursor"
import type { RowhouseElement, RowHouseParameters } from "src/integrations/composition-row-house-generator/api"
import { defaultRowHouseParameters, rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"
import { objectValues } from "src/lib/record"
import { objectKeys } from "src/lib/record"
import { PROJECT_ID } from "src/core/project/project"

type Id = string
const templatesSignal = signal<Record<Id, ParcelTemplate> | undefined>(undefined)

export function refreshTemplateState() {
  void fetchRowhouseTemplates().then((templates) => (templatesSignal.value = templates))
}

window.addEventListener("sm-library/refresh", refreshTemplateState)

export function setUpCreateDefaultTemplateEffect() {
  const creatingTemplateSignal = signal(false)
  // Create default template if no templates
  return effect(() => {
    if (creatingTemplateSignal.value) {
      return
    }
    // Template state is loaded, but there are not templates. We need to create one
    if (isDefined(templatesSignal.value) && objectKeys(templatesSignal.value).length === 0) {
      creatingTemplateSignal.value = true
      console.log("creating template")
      loadingCursor()
      void addTemplate("Default", defaultRowHouseParameters, defaultParcelParameters).then(() => {
        defaultCursor()
        creatingTemplateSignal.value = false
      })
    }
  })
}

function getNextUnusedTypeName() {
  const templates = templatesSignal.peek() ?? {}
  const typeNames = objectValues(templates).map((t) => t.name)
  const letterFrom = "A"
  const letterTo = "Z"
  const charCodeFrom = letterFrom.charCodeAt(0)
  const charCodeTo = letterTo.charCodeAt(0)
  const letterRange = charCodeTo - charCodeFrom + 1
  const indexToLetterString = (index: number): string => {
    const curLetter = String.fromCharCode((index % letterRange) + charCodeFrom)
    const remainingIndex = Math.floor(index / letterRange)
    const remainingString = remainingIndex >= 1 ? indexToLetterString(remainingIndex - 1) : ""
    return remainingString + curLetter
  }
  const indexToTypeName = (index: number) => "Type " + indexToLetterString(index)
  let i = 0
  while (typeNames.includes(indexToTypeName(i))) i += 1
  return indexToTypeName(i)
}

async function addTemplate(
  templateName: string,
  rowHouseParameters: RowHouseParameters = defaultRowHouseParameters,
  parcelParameters: ParcelParameters = defaultParcelParameters,
): Promise<ParcelTemplate> {
  if (!isDefined(templatesSignal.peek())) {
    throw new Error("Can't add before fetching state")
  }

  const _parameters: RowHouseParameters = { ...rowHouseParameters, typeName: templateName }
  const { parcelElement, elements, rootUrn, representations, privateOutdoorSpaceElement } =
    createParcelElementWithRowHouse(parcelParameters, _parameters)

  const id = await addRowhouseTemplateToLibrary(
    templateName,
    rootUrn,
    elements,
    // TODO: What about the other representations?
    representations.volumeMesh,
    PROJECT_ID,
  )

  //TODO this is temporary
  const rowHouseElement = Array.from(elements.values()).find((element) => rowHouseApi.isRowHouseElement(element))
  if (rowHouseElement == null) throw Error("we dont have a row house element")

  const newTemplate: ParcelTemplate = {
    id,
    name: templateName,
    element: parcelElement,
    representations,
    privateOutdoorSpaceElement: privateOutdoorSpaceElement,
    rowHouseElement: rowHouseElement,
  }
  templatesSignal.value = {
    ...templatesSignal.peek(),
    [newTemplate.id]: newTemplate,
  }

  return newTemplate
}

async function updateTemplate(newTemplate: ParcelTemplate) {
  const { elements, rootUrn } = toElements(newTemplate)
  // TODO: Only volumeMesh is passed along. Can be others too?
  await saveTemplateAndElements(elements, newTemplate.representations.volumeMesh, PROJECT_ID)
  const body = JSON.stringify({ urn: rootUrn, name: newTemplate.name, id: newTemplate.id })
  updateLibraryItem(newTemplate.id, "PUT", body)
  templatesSignal.value = {
    ...templatesSignal.peek(),
    [newTemplate.id]: newTemplate,
  }
  return newTemplate
}

function deleteTemplate(id: Id) {
  if (!isDefined(templatesSignal.peek())) {
    throw new Error("Can't delete before fetching state")
  }
  deleteRowhouseTemplateFromLibrary(id)

  const templates: Record<Id, ParcelTemplate> = { ...templatesSignal.peek() }
  delete templates[id]
  templatesSignal.value = templates

  return objectValues(templates)
}

async function fetchRowhouseTemplates(): Promise<Record<string, ParcelTemplate>> {
  const promises = [fetchLibraryItems(PROJECT_ID) /*, fetchFromCus */]

  const r = await Promise.all(promises).catch((err) => {
    if (err?.responseCode === 403) return []
    throw err
  })
  const responses: (ParcelTemplate | undefined)[] = await Promise.all(
    r
      .flat()
      .filter((le): le is SuccessLibraryItem => le.status === "success")
      .filter((le) => !!le.urn)
      .filter((e) => parseUrn(e.urn).system === rowHouseApi.elementSystemName)
      .map(async ({ name, urn, id }) => {
        const { element } = await getElementsClient().getElementAutoBatched(urn)

        if (!isParcelComposition(element)) {
          return undefined
        }

        const urns = new Set(element?.children?.map((child) => child.urn) || [])

        const elements = await getElementsWithChildren(urns)
        const representations = await getRepresentationsByUrn(bindFormaElementLookupForBoxMap(elements))

        let rowHouseElement: RowhouseElement | undefined = undefined
        let privateOutdoorSpaceElement: PrivateOutdoorSpaceElement | undefined = undefined

        for (const { element } of elements.values()) {
          if (rowHouseApi.isRowHouseElement(element)) {
            rowHouseElement = element
          }
          if (isPrivateOutdoorSpaceElement(element)) {
            privateOutdoorSpaceElement = element
          }
        }

        if (rowHouseElement == null || privateOutdoorSpaceElement == null) return undefined

        const template: ParcelTemplate = {
          id,
          name: name || "Unnamed",
          element,
          privateOutdoorSpaceElement: privateOutdoorSpaceElement,
          rowHouseElement: rowHouseElement,
          representations,
        }
        return template
      }),
  ).catch((err) => {
    console.error("Failed to fetch parcel templates")
    window.forma_toasts.push({
      content:
        "Failed to download housing templates. This might make the House feature not work according to expectations. ",
      status: "warning",
    })
    captureException(err, { tags: { owner: "squad-composition", responseCode: err.responseCode } })
    return []
  })
  return responses
    .filter(isDefined)
    .sort((a, b) => a.name.localeCompare(b.name))
    .reduce(
      (acc, curr) => {
        acc[curr.id] = curr
        return acc
      },
      {} as Record<string, ParcelTemplate>,
    )
}

async function saveTemplateAndElements(
  elements: Map<Urn, FormaElement>,
  geometries: Map<Urn, BufferGeometry>,
  authcontext: string,
) {
  const requests: Promise<Result<any, SavingError>>[] = []
  for (const element of elements.values()) {
    //TODO support elements that are not in parametric
    if (parseUrn(element.urn).system === "parametric") {
      const geometry = geometries.get(element.urn)
      if (geometry) {
        // TODO: What about e.g. surfaceMesh? Seems the saving logic is spread and inconsistently duplicated.
        const { glbRequest, jsonRequest } = parametricElementClient.saveParametricElement(
          element as ParametricElementFormaElement,
          geometry,
          authcontext,
        )
        requests.push(glbRequest)
        requests.push(jsonRequest)
      } else {
        requests.push(
          parametricElementClient.saveParametricElementWithoutGeo(
            element as ParametricElementFormaElement,
            authcontext,
          ),
        )
      }
    }
  }
  const responses = await Promise.all(requests)
  responses.forEach((res) => {
    if (res.type === "error") {
      throw new Error(`Template api could not save ${JSON.stringify(res.data)}`)
    }
  })
}

async function addRowhouseTemplateToLibrary(
  libraryName: string,
  libraryUrn: Urn,
  elements: Map<Urn, FormaElement>,
  geometries: Map<Urn, BufferGeometry>,
  authcontext: string,
): Promise<string> {
  await saveTemplateAndElements(elements, geometries, authcontext)
  console.log("library urn ", libraryUrn)
  const response = await request(`/api/forma-library/?authcontext=${PROJECT_ID}`, {
    method: "POST",
    body: JSON.stringify({ urn: libraryUrn, name: libraryName, id: parseUrn(libraryUrn).id }),
  })
  window.dispatchEvent(new CustomEvent("sm-library/refresh", { detail: { updatedFromRowhouseTemplates: true } }))
  const json = await response.json()
  return json.id as string
}

function updateLibraryItem(templateId: string, method: "PUT" | "DELETE", body?: string) {
  request(`/api/forma-library/${templateId}?authcontext=${PROJECT_ID}`, {
    method,
    body,
  })
    .then((r) => {
      //The 'updatedFromRowhouseTemplates' is added to avoid us listening to our own events, to avoid adding the same template twice
      window.dispatchEvent(new CustomEvent("sm-library/refresh", { detail: { updatedFromRowhouseTemplates: true } }))
      return r
    })
    .catch((e) => {
      captureException(e, { tags: { owner: "squad-composition" } })
      window.forma_toasts.push({ content: "Failed to update library", status: "warning" })
    })
}

function deleteRowhouseTemplateFromLibrary(id: Id) {
  updateLibraryItem(id, "DELETE")
}

export default {
  templatesSignal: toReadonlySignal(templatesSignal),
  addTemplate,
  updateTemplate,
  deleteTemplate,
  getNextUnusedTypeName,
}
