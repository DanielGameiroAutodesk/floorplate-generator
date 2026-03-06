import useLazyLoadScript from "src/lib/useLazyLoadScript"
import type {
  EmbeddedViewPlacement,
  Extension,
  FloatingPanelPlacement,
  FloatingPanelPreferredSize,
  Installation,
} from "src/integrations/extensions/extension-service"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-embedded-view-host": JSX.HTMLAttributes<HTMLElement> & {
        src: string
        extension: Extension
        installation: Installation
        projectId: string
        placement: EmbeddedViewPlacement
        adjustHeightToContent: boolean
        visibility?: "visible" | "hidden"
        close?: () => void
      }
    }
  }
}

export function EmbeddedViewHost({
  src,
  extension,
  installation,
  projectId,
  placement,
  visibility,
  close,
}: {
  src: string
  extension: Extension
  installation: Installation
  projectId: string
  placement: EmbeddedViewPlacement
  visibility?: "visible" | "hidden"
  close?: () => void
}) {
  const isLoaded = useLazyLoadScript(
    "/web-components/forma-embedded-view-host/forma-embedded-view-host.js",
    "ecosystem",
  )

  if (!isLoaded) return <></>
  return (
    <forma-embedded-view-host
      // Ensure there is no element reuse when switching active embedded view.
      key={`${extension.id}:${src}:${placement}`}
      src={src}
      extension={extension}
      installation={installation}
      projectId={projectId}
      placement={placement}
      adjustHeightToContent={true}
      visibility={visibility}
      close={close}
    />
  )
}

export type FloatingPanelOptions = {
  extension: Extension
  installation: Installation
  projectId: string
  embeddedViewId: string
  label: string
  icon?: string | undefined
  url: string
  preferredSize?: FloatingPanelPreferredSize | undefined
  placement?: FloatingPanelPlacement | undefined
  isUrlOverridden?: boolean | undefined
}

export type EmbeddedViewHostStatic = {
  openFloatingPanel: (options: FloatingPanelOptions) => EmbeddedViewHost
  deriveEmbeddedViewUrlOverride: (options: { extensionId: string; embeddedViewId: string; url: string }) => {
    isOverride: boolean
    storageKey: string
    url: string
  }
}

export type EmbeddedViewHost = EmbeddedViewHostStatic & {
  connectedPromise: () => Promise<void>
  sendRequest: <T, R>(action: string, payload?: T, transfer?: Transferable[]) => Promise<R>
  sendEvent: <T>(action: string, payload?: T, transfer?: Transferable[]) => void
  createSubscription: <T, O extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    handler: (event: T) => void,
    options?: O,
  ) => Promise<{
    unsubscribe: () => void
  }>
}

async function loadModule(src: string): Promise<void> {
  await new Promise((resolve, reject) => {
    const scripts = Array.from(document.querySelectorAll("script"))
    if (scripts.some((script) => script.src.endsWith(src))) {
      resolve(undefined)
      return
    }

    const script = document.createElement("script")
    script.type = "module"
    script.src = src
    script.onload = () => {
      resolve(undefined)
    }
    script.onerror = (message) => {
      reject(new Error(`Loading ${src} failed`, { cause: message }))
    }
    document.head.append(script)
  })
}

const path = "/web-components/forma-embedded-view-host/forma-embedded-view-host.js"

export async function openFloatingPanel(options: FloatingPanelOptions): Promise<EmbeddedViewHost> {
  await loadModule(path)
  const embeddedViewStatic = customElements.get("forma-embedded-view-host") as unknown as EmbeddedViewHostStatic

  const { url, isOverride } = embeddedViewStatic.deriveEmbeddedViewUrlOverride({
    extensionId: options.extension.id,
    embeddedViewId: options.embeddedViewId,
    url: options.url,
  })

  if (isOverride) {
    window.forma_toasts.push({
      status: "warning",
      content: `Embedded view source overridden to ${url}`,
      autoDismiss: true,
    })
  }

  return embeddedViewStatic.openFloatingPanel({
    ...options,
    url,
    isUrlOverridden: isOverride,
  })
}
