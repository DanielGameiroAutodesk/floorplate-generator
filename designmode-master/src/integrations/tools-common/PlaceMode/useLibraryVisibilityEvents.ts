import { useCallback, useEffect } from "preact/compat"
import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import { useRecoilState, useSetRecoilState } from "recoil"
import { useActivatePlaceMode, useExitPlaceMode } from "./resourcesHooks"
import { Matrix4 } from "three"
import type { LibraryElementData, LibraryElementInfo } from "./library"
import { fetchLibraryItems, Status } from "src/integrations/library/api"
import type { ProjectGeoLocation } from "src/core/project/project"
import { missingProjectGeoLocationToast, projectGeoLocationSignal } from "src/core/project/project"
import { leftMenuTabState } from "src/integrations/left-menu/LeftMenu"
import { convertToTerrain } from "./terrain-convert-library-item"
import { captureException, captureMessage } from "@sentry/browser"
import { newChildKey } from "src/lib/element/urn"
import { downloadAllElementData } from "src/core/elements-loading/downloadAllElementData"
import { libraryItemsState } from "src/integrations/library/state"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { buildLibraryElementInfo } from "./placeModeTopLevel"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"
import { getInMapOrThrow } from "src/lib/map"
import { PROJECT_ID } from "src/core/project/project"
import { createNewElements, getTransform, hasBuildingsThatNeedsToBeModified, isGroup } from "./utils"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { FormaElementBox } from "src/lib/element/statebox"
import type { NewTerrainState } from "src/core/terrain/new-terrain-state"
import { getTranslator } from "src/i18n"

async function maybeCreateNewElements(
  rootElement: FormaElement,
  elements: Map<`urn:adsk-forma-elements:${string}:${string}:${string}:${string}`, FormaElementBox<FormaElement>>,
  representations: RepresentationsByUrn,
) {
  if (isGroup(rootElement)) {
    const children = rootElement.children!.map((c) => elements.get(c.urn)!.element)
    if (hasBuildingsThatNeedsToBeModified(children)) {
      const newUrns = await createNewElements(children, representations)
      const { elements: newElements, representations: newRepresentations } = await downloadAllElementData(
        new Set(newUrns),
      )
      const newRootElement = {
        ...rootElement,
        children: newUrns.map((urn) => ({ urn, key: newChildKey() })),
      }
      newElements.set(newRootElement.urn, FormaElementBox.fromServer(newRootElement))
      return { rootElement: newRootElement, elements: newElements, representations: newRepresentations }
    }
  }
  return { rootElement, elements, representations }
}

export async function downloadAndComputeLibraryElementData(
  urn: Urn,
  terrainSamplerData: TerrainSamplerData,
  terrain: NewTerrainState,
  projectGeoRef?: ProjectGeoLocation,
): Promise<LibraryElementData> {
  const { elements: initialElements, representations: initialRepresentations } = await downloadAllElementData(
    new Set([urn]),
  )
  const initialRootElement = getInMapOrThrow(initialElements, urn).element
  const { rootElement, elements, representations } = await maybeCreateNewElements(
    initialRootElement,
    initialElements,
    initialRepresentations,
  )
  const rootMatrix = makeRootMatrixForGeoreferencedObject(rootElement, projectGeoRef!)
  const rootKey = newChildKey()
  const topLevelObjects: { child: Child; parentPath: string }[] = []
  if (isGroup(rootElement)) {
    for (let child of rootElement.children ?? []) {
      const childElement = getInMapOrThrow(elements, child.urn).element
      const transform = getTransform(child, childElement, representations, terrain, rootMatrix)
      topLevelObjects.push({ child: { ...child, transform: transform }, parentPath: rootKey })
    }
  } else {
    const childKey = newChildKey()
    topLevelObjects.push({
      child: { key: childKey, urn: rootElement.urn, transform: rootMatrix.toArray() },
      parentPath: rootKey,
    })
  }

  const toplevel: LibraryElementInfo[] = topLevelObjects.flatMap(({ child, parentPath }) =>
    buildLibraryElementInfo(
      child,
      parentPath,
      false,
      bindFormaElementLookupForBoxMap(elements),
      rootElement.urn,
      { proposal: { locked: new Set(), hidden: new Set() }, scenario: { locked: new Set(), hidden: new Set() } },
      { proposal: { locked: new Set(), hidden: new Set() }, scenario: { locked: new Set(), hidden: new Set() } },
      representations,
      {},
      terrainSamplerData,
      false,
    ),
  )

  toplevel.forEach((tl) => {
    tl.geometry.renderables2d.forEach((r) => {
      r.mode = "placeMode"
    })
  })

  return {
    toplevel,
    state: {
      rootUrn: rootElement.urn,
      elements: bindFormaElementLookupForBoxMap(elements),
      representations,
    },
  }
}

type Georeference = {
  srid: number
  refPoint: [number, number] | [number, number, number]
}

export function makeRootMatrixForGeoreferencedObject(element: FormaElement, projectGeoRef: ProjectGeoLocation) {
  const rootMatrix = new Matrix4()
  if (projectGeoRef.srid && element.properties?.geoReference) {
    const geoReference = element.properties.geoReference as Georeference
    if (geoReference.srid === projectGeoRef.srid) {
      const offsetX = projectGeoRef.point[0] - geoReference.refPoint[0]
      const offsetY = projectGeoRef.point[1] - geoReference.refPoint[1]
      const offsetZ = geoReference.refPoint[2] ?? 0
      rootMatrix.makeTranslation(-offsetX, -offsetY, offsetZ)
    }
  }
  return rootMatrix
}

export const useLibraryVisibilityEvents = () => {
  const [libraryItems, setLibraryItems] = useRecoilState(libraryItemsState)
  const setTab = useSetRecoilState(leftMenuTabState)

  const activatePlaceMode = useActivatePlaceMode()
  const exitPlaceMode = useExitPlaceMode()

  const handler = useCallback(
    (e: WindowEventMap["sm-library/item-selected"]) => {
      async function run() {
        if (e.detail.source === "designmode") return
        if (!e.detail.libraryItemId) {
          exitPlaceMode() // When "unselecting" library element
          return
        }

        let li = libraryItems.find((li) => li.id === e.detail.libraryItemId)
        if (!li || (li.status === Status.SUCCESS && li.urn !== e.detail.libraryItemUrn)) {
          const newLibraryItems = await fetchLibraryItems(PROJECT_ID)
          setLibraryItems(newLibraryItems)
          li = newLibraryItems.find((li) => li.id === e.detail.libraryItemId)
        }
        if (!li) {
          const t = getTranslator()
          window.forma_toasts.push({
            content: t(($) => $.errors.library.couldNotFindElement),
            status: "warning",
          })
          captureMessage("Could not find library element", { level: "warning", extra: { libraryItem: li } })
          exitPlaceMode()
          return
        }
        if (li.status === Status.FAILED) {
          const t = getTranslator()
          window.forma_toasts.push({
            content: t(($) => $.errors.library.elementNotAvailable),
            status: "error",
          })
          return
        }
        return li.status === Status.SUCCESS && activatePlaceMode(li)
      }
      void run()
    },
    [activatePlaceMode, exitPlaceMode, libraryItems, setLibraryItems],
  )

  const showLibraryHandler = useCallback(() => {
    setTab("library")
  }, [setTab])

  const convertToTerrainCallback = useCallback((event: WindowEventMap["sm-library/convert-to-terrain"]) => {
    const projectGeoLocation = projectGeoLocationSignal.peek()
    if (!projectGeoLocation) {
      missingProjectGeoLocationToast()
      return
    }
    convertToTerrain(event, projectGeoLocation).catch((err) => {
      const t = getTranslator()
      window.forma_toasts.push({
        content: t(($) => $.errors.library.failedToConvertTerrain),
        status: "warning",
      })
      captureException(err)
    })
  }, [])

  useEffect(() => {
    window.addEventListener("sm-library/item-selected", handler)
    window.addEventListener("sm-library/convert-to-terrain", convertToTerrainCallback)
    window.addEventListener("forma/marketplace/order-placed", showLibraryHandler)
    return () => {
      window.removeEventListener("sm-library/item-selected", handler)
      window.removeEventListener("sm-library/convert-to-terrain", convertToTerrainCallback)
      window.removeEventListener("forma/marketplace/order-placed", showLibraryHandler)
    }
  }, [convertToTerrainCallback, handler, showLibraryHandler])
}
