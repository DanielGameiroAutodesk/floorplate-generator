import type { EmbeddedViewHost, FloatingPanelOptions } from "src/integrations/extensions/EmbeddedViews/EmbeddedViewHost"
import { openFloatingPanel } from "src/integrations/extensions/EmbeddedViews/EmbeddedViewHost"
import type { Extension, Installation } from "src/integrations/extensions/extension-service"
import type { Entrypoint } from "./types"

type RegisteredHandlers = Record<
  string,
  { id: string; host: EmbeddedViewHost; invoke: <T = unknown, O = unknown>(input?: T) => Promise<O> }
>

/**
 * This function is used to initialize the embedded view handlers.
 * @returns A list of the registered handlers.
 */
export async function ensureEmbeddedViewHandlersAreInitialized(
  extension: Extension,
  installation: Installation,
  projectId: string,
  entrypoint: Entrypoint,
): Promise<RegisteredHandlers> {
  const viewOptions: FloatingPanelOptions = {
    extension: extension,
    installation: installation,
    projectId: projectId,
    label: extension.name,
    url: entrypoint.action.url,
    embeddedViewId: `extension:${extension.id}:${entrypoint.action.url}`,
    preferredSize: entrypoint.action.viewOptions?.preferredSize,
    placement: entrypoint.action.viewOptions?.placement,
  }
  const embeddedViewHost = await openFloatingPanel(viewOptions)
  await embeddedViewHost.connectedPromise()
  const registered = await embeddedViewHost.sendRequest<undefined, { handlers: string[] }>("init")
  return registered.handlers.reduce((acc: RegisteredHandlers, id: string) => {
    acc[id] = {
      id,
      host: embeddedViewHost,
      invoke: async <T, O>(input: T) => {
        return await embeddedViewHost.sendRequest<T, O>(id, input)
      },
    }
    return acc
  }, {})
}

export async function invokeExtensionHandler(
  extension: Extension,
  installation: Installation,
  projectId: string,
  entrypoint: Entrypoint,
) {
  if (entrypoint.action.type === "INVOKE_HANDLER") {
    const handlers = await ensureEmbeddedViewHandlersAreInitialized(extension, installation, projectId, entrypoint)
    const handler = handlers[entrypoint.action.handler]
    if (handler) {
      try {
        await handler.invoke()
      } catch (e) {
        throw new Error(
          `Failed to invoke handler ${entrypoint.action.handler} for extension ${extension.id}: ${String(e)}`,
          {
            cause: e,
          },
        )
      }
    }
  }
}

export async function OpenFloatingPanelFromEntrypoint(
  extension: Extension,
  installation: Installation,
  projectId: string,
  entrypoint: Entrypoint,
) {
  const viewOptions: FloatingPanelOptions = {
    extension: extension,
    installation: installation,
    projectId: projectId,
    label: extension.name,
    url: entrypoint.action.url,
    embeddedViewId:
      entrypoint.action.viewOptions?.embeddedViewId ?? `extension:${extension.id}:${entrypoint.action.url}`,
    preferredSize: entrypoint.action.viewOptions?.preferredSize,
    placement: entrypoint.action.viewOptions?.placement,
  }
  await openFloatingPanel(viewOptions)
}
