import type { Ref } from "preact"
import useLazyLoadScript from "src/lib/useLazyLoadScript"
import { useCallback, useEffect } from "preact/hooks"
import { PROJECT_ID } from "src/core/project/project"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useSignal } from "@preact/signals"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-app-store": JSX.HTMLAttributes<HTMLElement> & {
        projectid: string
        canEdit: boolean
      }
      "adsk-app-store-wrapper": JSX.HTMLAttributes<HTMLElement> & {
        projectid: string
        extensionId?: string
        canEdit: boolean
        onmodalvisibilitychange: (event: CustomEvent<{ visible: boolean }>) => void
      }
    }
  }
}

declare global {
  interface WindowEventMap {
    "forma/app-store/open-with-id": CustomEvent<{ extensionId: string }>
  }
}

export type FormaAppStoreElement = HTMLElement & {
  openModal(): void
  closeModal(): void
}

export function Extensions({ appStoreRef }: { appStoreRef: Ref<FormaAppStoreElement> }) {
  const isLoaded = useLazyLoadScript("/web-components/forma-app-store/forma-app-store.js", "ecosystem")
  if (isLoaded) {
    return (
      <forma-app-store
        ref={appStoreRef as Ref<HTMLElement>}
        projectid={PROJECT_ID}
        canEdit={canEditProposalSignal.value}
      />
    )
  } else {
    return null
  }
}

export function AdskAppStore() {
  const extensionIdSignal = useSignal<string | undefined>()
  const appStoreElementSignal = useSignal<FormaAppStoreElement>()
  const shouldOpenSignal = useSignal(false)

  const open = useCallback(() => {
    const appStoreElement = appStoreElementSignal.peek()
    if (appStoreElement) {
      appStoreElement.openModal()
    } else {
      shouldOpenSignal.value = true
    }
  }, [appStoreElementSignal, shouldOpenSignal])

  useEffect(() => {
    const handleOpenEvent = (event: CustomEvent<{ extensionId: string }>) => {
      if (event?.detail?.extensionId) {
        const extensionId = event.detail.extensionId
        const url = new URL(window.location.href)
        url.searchParams.set("app-store-extension", extensionId)
        history.pushState(history.state, "", url.toString())

        extensionIdSignal.value = extensionId
        open()
      }
    }
    window.addEventListener("forma/app-store/open-with-id", handleOpenEvent)
    return () => window.removeEventListener("forma/app-store/open-with-id", handleOpenEvent)
  }, [extensionIdSignal, open])

  useEffect(() => {
    function check() {
      const searchParams = new URLSearchParams(window.location.search)
      const extensionId = searchParams.get("app-store-extension")
      if (extensionId) {
        extensionIdSignal.value = extensionId
        open()
      } else if (extensionIdSignal.peek() != null) {
        appStoreElementSignal.peek()?.closeModal()
        extensionIdSignal.value = undefined
      }
    }

    // Initial page load check.
    check()

    const cleanup = new AbortController()

    // History navigation check.
    // This only covers explicit user navigation and is needed for browsers
    // that do not support the newer Navigation API.
    window.addEventListener("popstate", check, { signal: cleanup.signal })

    // Navigation API has not landed in all browsers yet.
    window.navigation?.addEventListener(
      "navigate",
      () => {
        // Use setTimeout to ensure it runs after the navigation completes.
        setTimeout(check, 0)
      },
      { signal: cleanup.signal },
    )

    return () => {
      cleanup.abort()
    }
  }, [appStoreElementSignal, extensionIdSignal, open])

  const isLoaded = useLazyLoadScript("/web-components/forma-app-store/forma-app-store.js", "ecosystem")
  if (!isLoaded) {
    return null
  }

  return (
    <adsk-app-store-wrapper
      ref={(value) => {
        appStoreElementSignal.value = value as FormaAppStoreElement
        if (value && shouldOpenSignal.peek()) {
          appStoreElementSignal.peek()?.openModal()
          shouldOpenSignal.value = false
        }
      }}
      onmodalvisibilitychange={(event) => {
        if (!event.detail.visible && new URLSearchParams(window.location.search).has("app-store-extension")) {
          const url = new URL(window.location.href)
          url.searchParams.delete("app-store-extension")
          history.pushState(history.state, "", url.toString())
        }
      }}
      projectid={PROJECT_ID}
      extensionId={extensionIdSignal.value}
      canEdit={canEditProposalSignal.value}
    />
  )
}
