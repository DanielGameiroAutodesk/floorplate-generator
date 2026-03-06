import { useCallback, useEffect, useState } from "preact/hooks"
import { type Category, setCategoryPending } from "src/core/categories"
import { PROJECT_ID } from "src/core/project/project"
import { placeDataOrder } from "src/integrations/tools-common/PlaceMode/placeDataOrder"
import { request } from "src/lib/request"
import { useSetRecoilState } from "recoil"
import { resourcesModalState } from "src/integrations/resources-modal/ResourcesModal"
import { AnalyticsLegacy } from "src/core/analytics"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { getTranslator } from "src/i18n"
import { leftMenuTabState } from "src/integrations/left-menu/LeftMenu"
import { sidebarsCollapsedState } from "src/integrations/sidebar/sidebarsState"

const INITIALIZE_PROJECT_URL_PARAM = "initializeProject"

export enum Status {
  PENDING = "pending",
  FAILED = "failed",
  SUCCESS = "success",
}

export type LibraryItem = {
  authContext: string
  urn?: string
  name?: string
  updatedAt: number
  status: Status
  id: string
  properties: { [key: string]: string }
}

const SM_LIBRARY_REFRESH = "sm-library/refresh"

export async function fetchDataOrders(): Promise<LibraryItem[]> {
  const response = await request(`/api/forma-library/?authcontext=${PROJECT_ID}`)

  if (response === undefined) {
    return []
  }

  const items: LibraryItem[] = await response.json()
  const isDataOrder = (item: LibraryItem) => item.properties?.["orderId"] !== undefined
  const dataOrders = items.filter(isDataOrder)
  const sortedItems = dataOrders.sort((item1, item2) => item2.updatedAt - item1.updatedAt)
  return sortedItems
}

function processStateChange(
  prevState: LibraryItem[] | undefined,
  newState: LibraryItem[],
  openContextualDataTab: () => void,
  isInitializingProject?: boolean,
) {
  if (!prevState && !isInitializingProject) {
    return
  }

  for (const dataOrder of newState) {
    const prevDataOrderState = prevState?.find(({ id }) => dataOrder.id === id)
    const startedNow = !prevDataOrderState && dataOrder.status === Status.PENDING
    const completedNow =
      (prevDataOrderState?.status === Status.PENDING || !prevDataOrderState) && dataOrder.status === Status.SUCCESS
    const failedNow = prevDataOrderState?.status === Status.PENDING && dataOrder.status === Status.FAILED
    const dataType = dataOrder.properties?.["dataType"]
    const category = getCategoryFromDataType(dataType)
    if (isInitializingProject && dataType === "terrain") {
      //dont place existing terrain on project init, its already placed
      continue
    }
    if (startedNow) {
      if (!isInitializingProject) {
        // Only add order confirmation toasts for manually placed orders, not the ones processed during initialization
        const t = getTranslator()
        window.forma_toasts.push({
          content: {
            title: t(($) => $.dataOrders.statusTitle),
            text: t(($) => $.dataOrders.processing, { name: dataOrder.name ?? "" }),
          },
          autoDismiss: true,
          timeout: 10000,
        })
      }
      setCategoryPending(category, true)
    } else if (completedNow) {
      // Don't show individual completion toasts during project initialization
      // Code for consolidated toast below
      if (!isInitializingProject) {
        const t = getTranslator()
        window.forma_toasts.push({
          status: "success",
          content: t(($) => $.dataOrders.completed, { name: dataOrder.name ?? "" }),
        })
      }
      placeDataOrder(dataOrder.id)
        .then(() => setCategoryPending(category, false))
        .catch(() => {
          setCategoryPending(category, false)
          const t = getTranslator()
          window.forma_toasts.push({
            status: "error",
            content: t(($) => $.dataOrders.failedToAdd, { name: dataOrder.name ?? "" }),
            autoDismiss: false,
          })
        })
    } else if (failedNow) {
      // Failed orders only open the contextual data tab to see the failed order with the option to re-order
      // No errors toasts to not overload the users with errors
      openContextualDataTab?.()
    }
  }

  // Check if all non-terrain data orders are completed during project initialization
  if (isInitializingProject) {
    const nonTerrainDataOrders = newState.filter((order) => order.properties?.["dataType"] !== "terrain")

    // Check if we have more than just terrain and all non-terrain orders are completed
    if (nonTerrainDataOrders.length > 0) {
      const allNonTerrainCompleted = nonTerrainDataOrders.every((order) => order.status === Status.SUCCESS)

      const shouldShowToast = !prevState
        ? allNonTerrainCompleted // Initial load: only if all are already completed
        : prevState
            .filter((order) => order.properties?.["dataType"] !== "terrain")
            .some((order) => order.status === Status.PENDING) // Transition: had pending before

      if (allNonTerrainCompleted && shouldShowToast) {
        const completedOrderNames = nonTerrainDataOrders
          .map((order) => order.name)
          .filter(Boolean)
          .map((name) => name?.split(":")[0]) // remove data provider name
          .join(", ")
          .replace(/,([^,]*)$/, " and$1") // add "and" before last item
          .replace(/-/g, " ")
        const t = getTranslator()
        window.forma_toasts.push({
          status: "success",
          content: t(($) => $.dataOrders.completedAll, { names: completedOrderNames }),
          autoDismiss: true,
          timeout: 10000,
        })
      }
    }
  }
}

export default function useAutoPlaceDataOrders() {
  const [, setLibraryItems] = useState<LibraryItem[]>()
  const setResourcesModalOpen = useSetRecoilState(resourcesModalState)
  const setLeftMenuTab = useSetRecoilState(leftMenuTabState)
  const setSidebarsCollapsed = useSetRecoilState(sidebarsCollapsedState)
  const appInitialized = isAppInitializedSignal.value

  const openContextualDataTab = useCallback(() => {
    setLeftMenuTab("contextual-data")
    setSidebarsCollapsed((prev) => ({ ...prev, left: false }))
  }, [setLeftMenuTab, setSidebarsCollapsed])

  useEffect(() => {
    if (!appInitialized) {
      return
    }

    let timeoutId: NodeJS.Timeout | undefined
    const url = new URL(window.location.href)
    function checkOrderedDataStatus(isInitializingProject?: boolean) {
      fetchDataOrders()
        .then((newState) => {
          setLibraryItems((prevState) => {
            processStateChange(prevState, newState, openContextualDataTab, isInitializingProject)
            return newState
          })

          clearTimeout(timeoutId)
          if (newState.find(({ status }) => status === Status.PENDING)) {
            timeoutId = setTimeout(checkOrderedDataStatus, 5000)
          }
          // if there are no data orders except terrain, open the resources modal
          if (isInitializingProject && newState.length <= 1) {
            // don't track this with new tracking schema
            AnalyticsLegacy.track("Resource modal (open)", { source: "project-initialization" })
            setResourcesModalOpen({ open: true, tab: "order" })
          }
        })
        .catch(() => {})
    }
    const isInitializingProject = url.searchParams.has(INITIALIZE_PROJECT_URL_PARAM)
    url.searchParams.delete(INITIALIZE_PROJECT_URL_PARAM)
    window.history.replaceState({}, document.title, url)
    checkOrderedDataStatus(isInitializingProject)

    window.addEventListener(SM_LIBRARY_REFRESH, () => checkOrderedDataStatus())

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener(SM_LIBRARY_REFRESH, () => checkOrderedDataStatus())
    }
  }, [setLibraryItems, setResourcesModalOpen, appInitialized, openContextualDataTab])

  return
}

function getCategoryFromDataType(dataType: string): Category {
  switch (dataType) {
    case "property-boundaries":
      return "property_boundary"
    case "terrain":
      return "terrain"
    case "buildings":
    case "buildings-lod2":
      return "building"
    case "roads":
      return "road"
    case "texture":
      return "reference_image"
    case "vegetation":
      return "vegetation"
    default:
      return "generic"
  }
}
