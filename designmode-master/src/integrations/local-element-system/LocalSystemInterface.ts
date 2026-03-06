import type { ElementSystem } from "src/core/element-systems"
import type { ElementResponse, FormaElement, Urn } from "@spacemakerai/element-types"
import { isDefined } from "src/lib/array"
import type { NotPersistedContainers, SavingResult, SavingSuccess } from "src/core/elements-saving/result"
import { ok } from "src/core/elements-saving/result"
import { elementResponseToMap } from "@spacemakerai/elements-client"
import { mapOfFormaElements } from "src/lib/element/utils"
import { getInMapOrThrow } from "src/lib/map"

class ElementsSessionStorage {
  constructor(public sessionStorageName: string) {}

  load(): Map<Urn, FormaElement> {
    return elementResponseToMap(JSON.parse(sessionStorage.getItem(this.sessionStorageName) || "{}") as ElementResponse)
  }

  save(elements: Map<Urn, FormaElement>) {
    sessionStorage.setItem(this.sessionStorageName, JSON.stringify(Object.fromEntries(elements)))
  }
}

class LocalSystem implements ElementSystem {
  name: string
  customFetchVolumeMesh?: ElementSystem["customFetchVolumeMesh"]
  customFetchFootprint?: ElementSystem["customFetchFootprint"]
  customFetchTerrainShape?: ElementSystem["customFetchTerrainShape"]
  generateEdgeOutlines?: ElementSystem["generateEdgeOutlines"]
  generateSelectionOutlines2d?: ElementSystem["generateSelectionOutlines2d"]
  generateEmptyElement?: (urn: Urn) => FormaElement
  ignoreFailingLoads = true
  store: ElementsSessionStorage

  constructor(
    name: string,
    customFetchVolumeMesh?: ElementSystem["customFetchVolumeMesh"],
    generateOutlines?: ElementSystem["generateEdgeOutlines"],
    generateEmptyElement?: (urn: Urn) => FormaElement,
    customFetchFootprint?: ElementSystem["customFetchFootprint"],
    customFetchTerrainShape?: ElementSystem["customFetchTerrainShape"],
    generateOutlines2d?: ElementSystem["generateSelectionOutlines2d"],
  ) {
    this.name = name
    this.customFetchVolumeMesh = customFetchVolumeMesh
    this.customFetchFootprint = customFetchFootprint
    this.customFetchTerrainShape = customFetchTerrainShape
    this.generateEdgeOutlines = generateOutlines
    this.generateEmptyElement = generateEmptyElement
    this.generateSelectionOutlines2d = generateOutlines2d
    this.store = new ElementsSessionStorage(this.name + "-element-system")
  }

  elementsClientElementsBypass = (urns: Urn[]): Promise<Map<Urn, FormaElement>>[] => {
    const elements = this.store.load()
    return urns
      .map((urn: Urn): Promise<Map<Urn, FormaElement>> | undefined => {
        if (elements.has(urn)) {
          return Promise.resolve(mapOfFormaElements(getInMapOrThrow(elements, urn)))
        } else if (this.generateEmptyElement) {
          return Promise.resolve(mapOfFormaElements(this.generateEmptyElement(urn)))
        } else {
          return undefined
        }
      })
      .filter(isDefined)
  }

  elementsClientBlobsBypass = () => {
    throw new Error("Not implemented")
  }

  saveHandler = (elementsToSave: NotPersistedContainers[]): Promise<SavingResult[]> => {
    const newElements = new Map(elementsToSave.map(({ urn, container }) => [urn, container.element]))

    this.store.save(new Map([...this.store.load(), ...newElements]))

    return Promise.resolve([
      ok<SavingSuccess>({
        updatedElementsFromSystem: newElements,
      }),
    ])
  }
}

export function localElementSystem(
  name: string,
  customFetchVolumeMesh?: ElementSystem["customFetchVolumeMesh"],
  generateOutlines?: ElementSystem["generateEdgeOutlines"],
  generateEmptyElement?: (urn: Urn) => FormaElement,
  customFetchFootprint?: ElementSystem["customFetchFootprint"],
  customFetchTerrainShape?: ElementSystem["customFetchTerrainShape"],
  generateOutlines2d?: ElementSystem["generateSelectionOutlines2d"],
): ElementSystem {
  return new LocalSystem(
    name,
    customFetchVolumeMesh,
    generateOutlines,
    generateEmptyElement,
    customFetchFootprint,
    customFetchTerrainShape,
    generateOutlines2d,
  )
}
