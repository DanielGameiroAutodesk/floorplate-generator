import { useCallback, useEffect, useState } from "preact/compat"
import { atom, useRecoilState, useSetRecoilState } from "recoil"
import { Analytics, AnalyticsLegacy } from "src/core/analytics"
import combineClasses from "src/lib/combineClasses"
import { StackBasedErrorBoundary } from "src/lib/components/FailableComponentWrapper/StackBasedErrorBoundary"
import { setDeepLink, useDeepLinks } from "src/lib/deepLinking"
import useLazyLoadScript from "src/lib/useLazyLoadScript"
import type { LibraryItem } from "src/integrations/library/api"
import { fetchLibraryItem } from "src/integrations/library/api"
import styles from "./ResourcesModal.module.css"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"
import { computed, useSignal, useSignalEffect } from "@preact/signals"
import { terrainBboxSignal } from "src/core/terrain/new-terrain-state"
import type { TerrainGeometryData } from "src/core/terrain/terrain-cache"
import type { Urn } from "forma-elements"
import { leftMenuTabState } from "src/integrations/left-menu/LeftMenu"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { useTranslator } from "src/i18n"
import { setResourcesModalStateSignal } from "src/integrations/tutorial/state/hasClosedResourcesModal"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "order-sidebar": JSX.HTMLAttributes<HTMLElement> & {
        projectid: string
        proposalurn?: Urn
        orderstep?: string
        terrainData?: TerrainData | undefined
        navigationStack: { displayName: string; value: string }[]
        onnavigate?: (e: CustomEvent<{ displayName: string; value: string }>) => void
        onresetnavigation?: (e: CustomEvent) => void
        onsetnavigationstack: (e: CustomEvent<{ displayName: string; value: string }[]>) => void
        terrainBbox?: [[number, number], [number, number]]
        showpaiddata?: boolean
      }
    }
  }
}
type ResourceModalTabs = "order" | "import" | "docs"

type ResourcesModalState =
  | {
      open: false
    }
  | {
      open: true
      tab: ResourceModalTabs
    }

type ImportContext = { libraryItem?: LibraryItem }

export const resourcesModalState = atom<ResourcesModalState>({
  key: "resources-modal-open",
  default: { open: false },
})

export default function ResourcesModalWrapper() {
  const [resourcesModal, setResourcesModalState] = useRecoilState(resourcesModalState)
  const deepLink = useDeepLinks()
  const [importContext, setImportContext] = useState<ImportContext | undefined>(undefined)
  function resetModalView() {
    setImportContext(undefined)
  }

  useEffect(() => {
    let cancelled = false
    if (deepLink?.resource === "imports" && deepLink?.resourceId) {
      void fetchLibraryItem(deepLink.resourceId, PROJECT_ID).then((libraryItem) => {
        if (cancelled) return
        setImportContext({ libraryItem })
        setResourcesModalState({ open: true, tab: "import" })
      })
    } else if (deepLink?.resource === "imports") {
      setImportContext({ libraryItem: undefined })
      setResourcesModalState({ open: true, tab: "import" })
    } else {
      setImportContext(undefined)
    }
    return () => {
      cancelled = true
    }
  }, [deepLink, setResourcesModalState])

  useEffect(() => {
    function escapeHandler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Resource modal (exit)")
        resetModalView()
        setResourcesModalState({ open: false })
        setResourcesModalStateSignal(false)
      }
    }

    function marketPlaceHandler(event: WindowEventMap["forma/marketplace/open"]) {
      // Don't track this with new tracking schema
      AnalyticsLegacy.track("Resource modal (open)")
      setResourcesModalState({ open: true, tab: event.detail.tab })
    }

    function editImportHandler(event: WindowEventMap["forma/imports/edit"]) {
      setImportContext({ libraryItem: event.detail?.libraryItem })
      setResourcesModalState({ open: true, tab: "import" })
    }

    resourcesModal.open && window.addEventListener("keydown", escapeHandler)
    window.addEventListener("forma/imports/edit", editImportHandler)
    window.addEventListener("forma/marketplace/open", marketPlaceHandler)
    return () => {
      resourcesModal.open && window.removeEventListener("keydown", escapeHandler)
      window.removeEventListener("forma/imports/edit", editImportHandler)
      window.removeEventListener("forma/marketplace/open", marketPlaceHandler)
    }
  }, [resourcesModal.open, setResourcesModalState])

  useEffect(() => {
    setResourcesModalStateSignal(resourcesModal.open)
  }, [resourcesModal.open])

  if (resourcesModal.open) {
    return (
      <ResourcesModal
        importContext={importContext}
        resetModalView={() => resetModalView()}
        tab={resourcesModal.tab}
        close={() => {
          resetModalView()
          setResourcesModalState({ open: false })
          setResourcesModalStateSignal(false)
        }}
      />
    )
  }
  return null
}

type NavigationItem = {
  displayName: string
  value: string
}

type Props = {
  navigationHistory: NavigationItem[]
  navigate: (e: CustomEvent<NavigationItem>) => void
  resetNavigation: (e: CustomEvent) => void
  setNavigationHistory: (e: CustomEvent<NavigationItem[]>) => void
}

type TerrainData = {
  geometry: TerrainGeometryData
  texturePromise: Promise<
    | {
        arraybuffer: ArrayBuffer
        attributionTag: string
      }
    | ArrayBuffer
    | undefined
  >
}

const terrainDataSignal = computed<TerrainData | undefined>(() => {
  const proposal = elementState.currentProposalSignal.value
  const terrain = proposal.terrain
  if (!terrain) return undefined

  return {
    geometry: terrain.getTerrainGeometryData(),
    texturePromise: terrain.getTerrainBackgroundTexture().then((t) => t?.arraybuffer),
  }
})

function OrderTab({ navigationHistory, navigate, resetNavigation, setNavigationHistory }: Props) {
  const isLoaded = useLazyLoadScript("/web-components/order-sidebar/order-sidebar.js?v=1", "atlas")

  const lastPersistedProposalUrnSignal = useSignal<Urn>()
  useSignalEffect(() => {
    const proposal = elementState.currentProposalSignal.value
    if (proposal.container.isServerState) {
      lastPersistedProposalUrnSignal.value = proposal.urn
    }
  })

  if (
    !isLoaded ||
    !lastPersistedProposalUrnSignal.value ||
    !lastPersistedProposalUrnSignal.value.includes(":proposal:")
  )
    return null

  const orderStep =
    navigationHistory.length > 0 ? navigationHistory[navigationHistory.length - 1].value : "LIST_PROVIDERS"

  return (
    <StackBasedErrorBoundary stackPath="order-sidebar">
      <order-sidebar
        projectid={PROJECT_ID}
        terrainData={terrainDataSignal.value}
        proposalurn={lastPersistedProposalUrnSignal.value}
        orderstep={orderStep}
        onnavigate={navigate}
        onresetnavigation={resetNavigation}
        navigationStack={navigationHistory}
        onsetnavigationstack={setNavigationHistory}
        terrainBbox={terrainBboxSignal.value}
        showpaiddata={terrainBboxSignal.value !== undefined ? false : undefined}
      />
    </StackBasedErrorBoundary>
  )
}

function LocalImportTab({
  importContext: editImportContext,
  setImportMode,
  importMode,
  close,
}: {
  importContext: ImportContext | undefined
  setImportMode: (value: "tabs" | "single") => void
  importMode: "tabs" | "single"
  close: () => void
}) {
  const t = useTranslator()
  const setTab = useSetRecoilState(leftMenuTabState)
  const isLoaded = useLazyLoadScript("/web-components/forma-file-import/forma-file-import.js", "atlas")

  const proposalUrn = elementState.currentProposalSignal.value.urn

  useEffect(() => {
    setDeepLink({ resource: "imports", resourceId: editImportContext?.libraryItem?.id })
    return () => setDeepLink({})
  }, [editImportContext?.libraryItem?.id])

  const setLibraryTab = useCallback(() => {
    setTab("library")
  }, [setTab])

  if (!isLoaded) return null

  return (
    <StackBasedErrorBoundary stackPath={"forma-file-import"}>
      <>
        <forma-file-import
          projectId={PROJECT_ID}
          proposalUrn={proposalUrn}
          libraryItem={editImportContext?.libraryItem}
          closeModal={() => {
            close()
            setLibraryTab()
          }}
          setHeadingType={setImportMode}
          setActiveItem={(id?: LibraryItem["id"]) => {
            setDeepLink({ resource: "imports", resourceId: id })
          }}
          style={importMode === "tabs" ? { border: "dashed 1px #3C3C3C40", borderRadius: "6px", margin: "24px" } : {}}
        />
        {importMode === "tabs" && (
          <>
            <div className={styles.Separator}>
              <span className={styles.SeparatorText}>or</span>
            </div>
            <div className={styles.ImportExtensionContent}>
              <p className={styles.ImportExtensionTitle}>{t(($) => $.extensions.importModelTitle)}</p>
              <p className={styles.ImportExtensionDescription}>
                <weave-linkbutton
                  variant="flat"
                  className={styles.ImportExtensionLink}
                  onClick={() => {
                    close()
                    window.dispatchEvent(new CustomEvent("forma/app-store/open"))
                    Analytics.track(
                      EventName.Open,
                      {
                        feature: "app_store",
                        feature_category: FeatureCategory.Extension,
                      },
                      {
                        method: "import_modal",
                      },
                    )
                  }}
                >
                  {t(($) => $.extensions.downloadButton)}
                </weave-linkbutton>{" "}
                {t(($) => $.extensions.downloadDescription)}
              </p>
            </div>
          </>
        )}
      </>
    </StackBasedErrorBoundary>
  )
}

function CloseButton({ close }: { close: () => void }) {
  return (
    <weave-icon-button
      onClick={() => {
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Resource modal (exit)")
        close()
      }}
    >
      <weave-close slot="icon" />
    </weave-icon-button>
  )
}

function ResourcesModal({
  importContext,
  resetModalView,
  tab,
  close,
}: {
  importContext: ImportContext | undefined
  resetModalView: () => void
  tab: ResourceModalTabs
  close: () => void
}) {
  const [importMode, setImportMode] = useState<"tabs" | "single">("tabs")
  const isInImportEditMode = tab === "import" && importMode === "single"
  const [marketPlaceResetEventCancelled, setMarketPlaceResetEventCancelled] = useState(false)

  const [navigationHistory, setNavigationHistory] = useState<{ displayName: string; value: string }[]>([])
  const goBack = useCallback(() => {
    setNavigationHistory((prev) => prev.slice(0, prev.length - 1))
  }, [])

  const navigate = useCallback((e: CustomEvent<{ displayName: string; value: string }>) => {
    setNavigationHistory((prev) => [...prev, e.detail])
  }, [])

  const onSetNavigationHistory = useCallback((e: CustomEvent<NavigationItem[]>) => {
    setNavigationHistory(e.detail)
  }, [])

  const resetOrderModal = useCallback(
    (e: CustomEvent) => {
      if (marketPlaceResetEventCancelled) {
        e.preventDefault()
      } else {
        setNavigationHistory([])
        resetModalView()
      }
    },
    [marketPlaceResetEventCancelled, resetModalView],
  )

  const getHeader = () => {
    const isInEditContext = isInImportEditMode || navigationHistory.length > 0

    if (isInEditContext) {
      let labelName = ""
      if (tab === "import") labelName = "Import"
      else if (navigationHistory.length > 0) labelName = navigationHistory[navigationHistory.length - 1].displayName
      return (
        <div className={combineClasses([styles.Header, styles.HeaderSingle])}>
          <div className={styles.TabContainer}>
            <weave-icon-button
              onClick={() => {
                if (navigationHistory.length > 0) {
                  goBack()
                  return
                }
                setMarketPlaceResetEventCancelled(true)
                resetModalView()
              }}
            >
              <svg
                slot="icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M4.37687 7.64L11.3078 1L11.9996 1.7221L5.44552 8.00105L11.9996 14.28L11.3078 15.0021L4.37687 8.3621L4 8.00105L4.37687 7.64Z"
                  fill="#808080"
                />
              </svg>
            </weave-icon-button>
            <span className={styles.TabSingle}>{labelName}</span>
          </div>
          <CloseButton close={close} />
        </div>
      )
    } else {
      return (
        <div className={styles.Header}>
          <div className={styles.TabContainer}>
            <span className={combineClasses([styles.Tab], { [styles.TabActive]: true })}>
              {tab === "order" ? "Order data" : "Import"}
            </span>
          </div>
          <CloseButton close={close} />
        </div>
      )
    }
  }

  return (
    <div className={styles.ModalBackdrop} onClick={close}>
      <div className={styles.Modal} onClick={(e) => e.stopPropagation()}>
        {getHeader()}
        <div className={styles.Content} id="resourcesModal">
          {tab === "order" && (
            <OrderTab
              navigate={navigate}
              navigationHistory={navigationHistory}
              resetNavigation={resetOrderModal}
              setNavigationHistory={onSetNavigationHistory}
            />
          )}
          {tab === "import" && (
            <LocalImportTab
              importContext={importContext}
              setImportMode={setImportMode}
              importMode={importMode}
              close={close}
            />
          )}
        </div>
      </div>
    </div>
  )
}
