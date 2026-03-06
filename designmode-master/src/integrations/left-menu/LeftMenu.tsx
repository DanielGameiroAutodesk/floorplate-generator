import "./Grid.css"
import { Suspense, useCallback } from "preact/compat"
import NavigatorTab, { NavigatorTabSkeleton } from "src/integrations/NavigatorTab/NavigatorTab"
import { atom, selector, useRecoilState, useRecoilValue } from "recoil"
import { sessionStorageEffectString } from "src/lib/storageEffect"
import { Library, LibraryTabSkeleton } from "src/integrations/library/Library"
import type { FormaAppStoreElement } from "src/integrations/extensions/Extensions"
import { Extensions } from "src/integrations/extensions/Extensions"
import { useEffect, useRef } from "preact/hooks"
import ProjectSettings from "./ProjectSettings"
import { Analytics } from "src/core/analytics"
import GlobeIcon_16 from "src/lib/components/icons/GlobeIcon_16"
import { ExpandedTooltip } from "src/lib/components/ExpandedTooltip"
import ContextualDataTooltipImage from "./contextual_data_help_image.png"
import { EventName, FeatureCategory, legacyTrack } from "@spacemakerai/webapp-analytics"
import useFeatureFlag, { URLFlag } from "src/lib/featureToggling"

const SIDEBAR_TAB_KEY = "sidebar-tab"

const TABS = ["navigator", "library", "upload", "extensions", "contextual-data", "space"] as const
export type Tab = (typeof TABS)[number]

const getInitialTab = (): Tab => {
  const url = new URL(window.location.href)
  const tabFromQuery = url.searchParams.get(SIDEBAR_TAB_KEY)
  const selectedTab = TABS.find((tab) => tab === tabFromQuery)
  if (tabFromQuery) {
    url.searchParams.delete(SIDEBAR_TAB_KEY)
    window.history.replaceState({}, document.title, url)
  }
  if (selectedTab) {
    sessionStorage.setItem(SIDEBAR_TAB_KEY, selectedTab)
    return selectedTab
  }
  if (url.searchParams.has("app-store-extension")) {
    return "extensions"
  }
  return "navigator"
}

export const leftMenuTabState = atom<Tab>({
  key: "left-menu-tab-state",
  default: getInitialTab(),
  effects: [sessionStorageEffectString(SIDEBAR_TAB_KEY)],
})

const mutableVisitedState: { [key: string]: boolean } = { library: true, navigator: true }
const visitedState = selector<{ [key: string]: boolean }>({
  key: "visited-state",
  get: ({ get }) => {
    const currentTab = get(leftMenuTabState)
    mutableVisitedState[currentTab] = true
    return mutableVisitedState
  },
  dangerouslyAllowMutability: true,
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export const useOpenAppStore = () => {
  const appStore = useRef<FormaAppStoreElement | null>(null)
  const shouldOpen = useRef(false)

  const [tab, setTab] = useRecoilState(leftMenuTabState)

  const onClickOpenAppStore = useCallback(
    (event: WindowEventMap["forma/app-store/open"]) => {
      legacyTrack("Extensions: Open app store", { source: event.detail?.source })
      if (appStore.current) {
        appStore.current.openModal()
      } else {
        shouldOpen.current = true
      }
      if (tab !== "extensions") {
        setTab("extensions")
      }
    },
    [setTab, tab],
  )

  useEffect(() => {
    window.addEventListener("forma/app-store/open", onClickOpenAppStore)
    return () => window.removeEventListener("forma/app-store/open", onClickOpenAppStore)
  }, [onClickOpenAppStore])

  return {
    appStoreRef: (value: FormaAppStoreElement | null) => {
      appStore.current = value
      if (value && shouldOpen.current) {
        value.openModal()
        shouldOpen.current = false
      }
    },
  }
}

function LeftMenu({ initialized }: { initialized: boolean }) {
  const [tab, setTab] = useRecoilState(leftMenuTabState)
  const visited = useRecoilValue(visitedState)
  const isTutorialEnabled = useFeatureFlag(URLFlag.SelectTutorials)

  const { appStoreRef } = useOpenAppStore()

  const onTabChanged = useCallback(
    (e: CustomEvent<string>) => {
      setTab(e.detail as Tab)
      Analytics.track(
        EventName.Select,
        {
          feature_category: FeatureCategory.UserInterface,
          feature: "navigator",
          sub_feature: "tab",
        },
        {
          value: e.detail,
        },
      )
    },
    [setTab],
  )

  // Add data-tutorial-target to library and navigator tabs in forma-sidebar web component
  useEffect(() => {
    if (!isTutorialEnabled) return

    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null

    const addTutorialTargets = (isRetry = false) => {
      const sidebar = document.querySelector("forma-sidebar")
      const libraryButton = sidebar?.querySelector('[data-tab="library"]')
      const navigatorButton = sidebar?.querySelector('[data-tab="navigator"]')

      if (libraryButton) {
        libraryButton.setAttribute("data-tutorial-target", "library-tab")
      }

      if (navigatorButton) {
        navigatorButton.setAttribute("data-tutorial-target", "navigator-tab")
      }

      // If any button is missing and this isn't a retry, try again
      if ((!libraryButton || !navigatorButton) && !isRetry) {
        retryTimeoutId = setTimeout(() => addTutorialTargets(true), 100)
      }
    }

    addTutorialTargets()

    // Cleanup: clear pending timeout if component unmounts or isTutorialEnabled changes
    return () => {
      if (retryTimeoutId !== null) {
        clearTimeout(retryTimeoutId)
      }
    }
  }, [isTutorialEnabled])

  return (
    <>
      <forma-sidebar tab={tab} ontabchanged={onTabChanged} showextensions hide-tabs="project-members">
        <>
          <>
            <forma-sidebar-button
              data-tab="contextual-data"
              id="contextual-data-button"
              data-tutorial-target="contextual-tab"
            >
              <GlobeIcon_16 />
            </forma-sidebar-button>
            <ExpandedTooltip
              title={(t) => t(($) => $.contextualData.title)}
              icon={<img src={ContextualDataTooltipImage} alt="Contextual Data Tooltip Image" style="width: 100%;" />}
              bodyText={(t) => t(($) => $.contextualData.description)}
              target="contextual-data-button"
              position="right"
            />
          </>
        </>
        <ProjectSettings />
      </forma-sidebar>
      <div className={"TabContent"}>
        {initialized && (
          <Suspense fallback={null}>
            <div style={{ display: tab === "navigator" ? "block" : "none", height: "100%", minHeight: "0" }}>
              {visited["navigator"] && <NavigatorTab />}
            </div>
            <>
              <div style={{ display: tab === "library" ? "block" : "none", overflow: "auto" }}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  {visited["library"] && (
                    <Library contextualData={false} addMenuFeature={true} siteConceptFeature={true} />
                  )}
                </div>
              </div>
              <div style={{ display: tab === "contextual-data" ? "block" : "none", overflow: "auto" }}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  {visited["contextual-data"] && (
                    <Library contextualData={true} addMenuFeature={true} siteConceptFeature={true} />
                  )}
                </div>
              </div>
            </>
            <div style={{ display: tab === "extensions" ? "block" : "none", overflow: "auto", flexGrow: "1" }}>
              {visited["extensions"] && <Extensions appStoreRef={appStoreRef} />}
            </div>
          </Suspense>
        )}
        {!initialized && (
          <>
            <div style={{ display: tab === "navigator" ? "block" : "none", height: "100%", minHeight: "0" }}>
              {visited["navigator"] && <NavigatorTabSkeleton />}
            </div>
            <div style={{ display: tab === "library" ? "block" : "none", overflow: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                {visited["library"] && <LibraryTabSkeleton />}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default LeftMenu
