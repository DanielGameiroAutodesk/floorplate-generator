import type { Child, FormaElement, Urn } from "forma-elements"
import { downloadAllElementData } from "src/core/elements-loading/downloadAllElementData"
import { ElementContainer } from "src/core/elements/ElementContainer"
import type { KnownRepresentations, RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"
import { fetchLibraryItems } from "src/integrations/library/api"
import { newChildKey, parseUrn, replaceRevision } from "src/lib/element/urn"
import {
  hasBuildingsThatNeedsToBeModified,
  createNewElements,
  getTransform,
  isGroup,
  isChildWithinTerrain,
} from "./utils"
import type { FormaElementBox } from "src/lib/element/statebox"
import { actionApi } from "src/integrations/legacy-actions/ActionAPI"
import { terrainSignal } from "src/core/terrain/new-terrain-state"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { AnalyticsUtils } from "src/core/analytics"

function addToBase(
  childrenToAdd: Child[],
  elements: Map<string, FormaElementBox<FormaElement>>,
  representations: RepresentationsByUrn,
) {
  const base = elementState.currentBaseSignal.peek()
  const terrain = terrainSignal.peek()
  const childrenWithinTerrainLimits = childrenToAdd.filter((c) =>
    isChildWithinTerrain(c, elements.get(c.urn)!.element, representations, terrain),
  )
  const newChildContainers = childrenWithinTerrainLimits.map((c) => {
    const elementReps: KnownRepresentations = {
      footprint: representations.footprint.get(c.urn),
      terrainShape: representations.terrainShape.get(c.urn),
      terrainTexture: representations.terrainTexture.get(c.urn),
      volumeMesh: representations.volumeMesh.get(c.urn),
      buildingFloors3DSketch_UNSTABLE: undefined,
    }
    return ElementContainer.fromServerElement(elements.get(c.urn)!.element, undefined, elementReps)
  })
  const oldChildContainers = base.container.children
  const childContainers = oldChildContainers.concat(newChildContainers)
  const children = (base.element.children || []).concat(
    childrenWithinTerrainLimits.map((c) => ({
      urn: c.urn,
      key: c.key,
      transform: getTransform(c, elements.get(c.urn)!.element, representations, terrain),
    })),
  )

  const draftElement: FormaElement = {
    ...base.container.element,
    urn: replaceRevision(base.urn),
    children: children,
  }
  const newParentContainer = ElementContainer.fromDraftElement(draftElement, childContainers)
  elementState.updateBase(newParentContainer)
}

async function replaceTerrain(newTerrainUrn: Urn) {
  const terrainPath = elementState.currentTerrainSignal.peek()?.path.value
  if (!terrainPath) return
  const actions = await actionApi.update.oneByUrn(terrainPath, newTerrainUrn)
  actionApi.apply("Update terrain", actions)

  Analytics.track(
    EventName.Add,
    {
      feature_category: FeatureCategory.ContextualData,
      feature: "place_mode",
      sub_feature: "place_mode_auto",
    },
    {
      category: "terrain",
    },
  )
}

export async function placeDataOrder(libraryId: string) {
  const libraryItems = await fetchLibraryItems(PROJECT_ID)
  const libraryItem = libraryItems.find((item) => item.id === libraryId)
  if (libraryItem?.status !== "success") {
    console.log("Could not find library item")
    return
  }
  const elementUrn = libraryItem.urn
  if (parseUrn(elementUrn).system === "terrain") {
    return await replaceTerrain(elementUrn)
  }
  const { elements, representations } = await downloadAllElementData(new Set([elementUrn]))
  const rootElement = elements.get(elementUrn)!.element
  const childrenToAdd = isGroup(rootElement) ? rootElement.children! : [{ urn: rootElement.urn, key: newChildKey() }]
  const elementsToAdd = childrenToAdd.map((c) => elements.get(c.urn)!.element)
  const categories = elementsToAdd.map((el) => el.properties?.category).filter(Boolean) as string[]

  if (hasBuildingsThatNeedsToBeModified(elementsToAdd)) {
    const newUrns = await createNewElements(elementsToAdd, representations)
    const { elements: newElements, representations: newRepresentations } = await downloadAllElementData(
      new Set(newUrns),
    )
    const newChildrenToAdd = newUrns.map((urn) => ({ urn: urn, key: newChildKey() }))
    addToBase(newChildrenToAdd, newElements, newRepresentations)
  } else {
    addToBase(childrenToAdd, elements, representations)
  }

  Analytics.track(
    EventName.Add,
    {
      feature_category: FeatureCategory.ContextualData,
      feature: "place_mode",
      sub_feature: "place_mode_auto",
    },
    {
      category: AnalyticsUtils.trackedElementCategory(categories),
    },
  )
}
