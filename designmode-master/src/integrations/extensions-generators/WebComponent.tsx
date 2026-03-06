import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { Handle } from "src/integrations/extensions/EditHandles"
import type { Extension } from "src/integrations/extensions/extension-service"
import type { Generator } from "./generator-service"
import type { InternalPath } from "src/lib/element/path"
import useLazyLoadScript from "src/lib/useLazyLoadScript"
import type { PreviewRequest } from "./preview"

export type RequestHandlesFn = (params: {
  handles: Handle[]
  onPreview: (value: Handle[]) => void
  onCommit: (value: Handle[]) => void
  onComplete: (value: Handle[]) => void
  onCancel: () => void
}) => { updateHandles: (handles: Handle[]) => void } | undefined

// Params can be expanded later with e.g. a cancel callback.
export type SetIsPendingFn = (params: Record<string, never> | undefined) => void

type Props = {
  projectId: string
  generator: Generator
  extension: Extension
  element?: FormaElement | undefined
  elementPath?: InternalPath
  preview: (preview: PreviewRequest | undefined) => void
  persist: (urn: Urn) => void
  isDrawing: boolean
  exitDrawing: () => void
  requestHandles: RequestHandlesFn
  setIsPending: SetIsPendingFn
}

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-generator-adapter-right-menu": Props
    }
  }
}

export function FormaGeneratorAdapterRightMenu(props: Props) {
  const isLoaded = useLazyLoadScript("/web-components/forma-generator-adapter/forma-generator-adapter.js", "ecosystem")

  if (!isLoaded) {
    return null
  }

  return <forma-generator-adapter-right-menu {...props} />
}
