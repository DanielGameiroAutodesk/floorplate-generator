import { useRef } from "preact/hooks"
import { atom, selector, selectorFamily, useRecoilValueLoadable, waitForAll } from "recoil"
import { PROJECT_ID } from "src/core/project/project"
import type { I18nStringProvider } from "src/i18n"
import * as uuid from "uuid"

export type OpenFloatingPanelAction = {
  type: "OPEN_FLOATING_PANEL"
  url: string
  preferredSize?:
    | {
        width: number
        height: number
      }
    | undefined
  placement?: FloatingPanelPlacement | undefined
}

export type Button = {
  category: string
  label: string
  actions: {
    click:
      | OpenFloatingPanelAction
      // Force us to handle this as a union, to avoid strict
      // coupling to the only one that currently exists.
      | { __dummy: "dummy" }
  }
}

export type ExtensionFeatureBase = {
  id: string
  type: "DEPRECATED_GENERATOR" | "FLOATING_PANEL" | "RIGHT_SIDE_ANCHORED_PANEL"
}

export type ExtensionFeature = Omit<OpenFloatingPanelAction, "type"> & {
  id: string
  type: "FLOATING_PANEL"
  label?: I18nStringProvider
}

export type ExtensionAddMenuTile = {
  type: "ADD_MENU_TILE"
  approximateSection: string
  approximateCategory: string
  size: "half-width" | "full-width" | "slim"
  name: I18nStringProvider
  description?: I18nStringProvider | undefined
  image: string | undefined
}

export type ExtensionEntryPoint = {
  id: string
  interaction: ExtensionAddMenuTile
  action: { type: "ActivateFeature"; featureId: string }
}

export type Extension = {
  type: "install" | "download"
  id: string
  provider?: string | undefined
  name: string
  description?: string | undefined
  resources: {
    logo?: string | undefined
    heroImage?: string | undefined
    embeddedViews?: EmbeddedView[] | undefined
    leftMenuFallbackText?: string | undefined
    downloadUrl?: string
  }
  descriptionUrls?:
    | {
        url: string
        label: string
      }[]
    | undefined
  legalDocuments?:
    | {
        url: string
        label: string
      }[]
    | undefined
  licensing?:
    | {
        mode: "required" | "optional"
        userConfigurationRedirectUrl: string
        knownLicenseTypes: {
          name: string
          label: string
        }[]
      }
    | undefined
  buttons?: Button[] | undefined
  feedbackUri?: string | undefined
  helpUri?: string | undefined
}

export type ExtensionWithFeatureAndEntryPoint = Extension & {
  features?: ExtensionFeature[]
  entryPoints?: ExtensionEntryPoint[]
}

export type Installation = {
  extensionId: string
  authcontext: string
  role: "editor" | "viewer"
  installedAt: string
}

export enum EmbeddedViewPlacement {
  LEFT_MENU_PANEL = "LEFT_MENU_PANEL",
  RIGHT_MENU_ANALYSIS_PANEL = "RIGHT_MENU_ANALYSIS_PANEL",
  FLOATING_PANEL = "FLOATING_PANEL",
}

export type FloatingPanelPreferredSize = {
  height: number
  width: number
}

export type FloatingPanelPlacement =
  | {
      type: "right"
      offsetTop: number
      offsetRight?: number
    }
  | {
      type: "fullscreen"
    }
  | {
      type: "center"
    }

export type EmbeddedView = {
  url: string
  placement: EmbeddedViewPlacement | string
}

type ExtensionAndInstallation = {
  extension: ExtensionWithFeatureAndEntryPoint
  installation: Installation
}

function migrateExtensionToEntryPointFeatureModel(extension: Extension): ExtensionWithFeatureAndEntryPoint {
  const entryPoints: ExtensionEntryPoint[] = []
  const features: ExtensionFeature[] = []

  for (const button of extension.buttons ?? []) {
    if ("type" in button.actions.click && button.actions.click.type === "OPEN_FLOATING_PANEL") {
      const featureId = uuid.v4()
      features.push({
        id: featureId,
        type: "FLOATING_PANEL",
        url: button.actions.click.url,
        preferredSize: button.actions.click.preferredSize,
        placement: button.actions.click.placement,
        label: () => button.label,
      })
      entryPoints.push({
        id: uuid.v4(),
        interaction: {
          type: "ADD_MENU_TILE",
          approximateSection: "create",
          approximateCategory: "other",
          name: () => extension.name,
          size: "slim",
          description: extension.description ? () => extension.description! : undefined,
          image: extension.resources.logo,
        },
        action: {
          type: "ActivateFeature",
          featureId,
        },
      })
    }
  }

  for (const embeddedView of extension.resources?.embeddedViews ?? []) {
    if (embeddedView.placement === "LEFT_MENU_PANEL") {
      const featureId = uuid.v4()
      features.push({
        id: featureId,
        type: "FLOATING_PANEL",
        url: embeddedView.url,
        preferredSize: { width: 260, height: 3000 }, // TODO: Need to figure what is a right size
        placement: { type: "right", offsetTop: 0, offsetRight: 12 },
      })
      entryPoints.push({
        id: uuid.v4(),
        interaction: {
          type: "ADD_MENU_TILE",
          approximateSection: "create",
          approximateCategory: "other",
          name: () => extension.name,
          size: "slim",
          description: extension.description ? () => extension.description! : undefined,
          image: extension.resources.logo,
        },
        action: {
          type: "ActivateFeature",
          featureId,
        },
      })
    }
  }

  return { ...extension, features, entryPoints }
}

export function extensionSorter(a: Extension, b: Extension) {
  const cmp = a.name.localeCompare(b.name)
  return cmp === 0 ? a.id.localeCompare(b.id) : cmp
}

export function extensionAndInstallationSorter(a: ExtensionAndInstallation, b: ExtensionAndInstallation) {
  return extensionSorter(a.extension, b.extension)
}

export const extensionState = selectorFamily<ExtensionWithFeatureAndEntryPoint | undefined, { extensionId: string }>({
  key: "extension",
  get:
    ({ extensionId }) =>
    async () => {
      const res = await fetch(
        `/api/extension-service/extensions/${encodeURIComponent(extensionId)}?authcontext=${PROJECT_ID}`,
      )
      if (!res.ok) return undefined
      const extension = (await res.json()) as Extension
      return migrateExtensionToEntryPointFeatureModel(extension)
    },
  // Disabled to avoid problems with async queries.
  // See https://spacemakercore.slack.com/archives/C07LAM6A734/p1736175343465239
  // cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

const installationsRefreshState = atom<symbol>({
  key: "extensionInstallationsRefreshSymbol",
  default: Symbol(),
  effects: [
    ({ trigger, setSelf }) => {
      if (trigger === "get") {
        const listener = () => {
          setSelf(Symbol())
        }

        // This event is at least dispatched in forma-app-store.
        window.addEventListener("forma/extension-installations/updated", listener)
        return () => {
          window.removeEventListener("forma/extension-installations/updated", listener)
        }
      }
    },
  ],
})

export const installationsState = selector<Installation[]>({
  key: "extensionInstallations",
  get: async ({ get }) => {
    // Trigger refetch on updates.
    get(installationsRefreshState)
    const res = await fetch(`/api/extension-service/installations?authcontext=${PROJECT_ID}&source=designmode`)
    if (!res.ok) return []
    return (await res.json()) as Installation[]
  },
  // Disabled to avoid problems with async queries.
  // See https://spacemakercore.slack.com/archives/C07LAM6A734/p1736175343465239
  // cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export const installationsWithExtensionState = selector<ExtensionAndInstallation[]>({
  key: "installationsWithExtension",
  get: ({ get }) => {
    const installations = get(installationsState)
    const extensionIds = installations.map((it) => it.extensionId)
    const extensions = get(waitForAll(extensionIds.map((extensionId) => extensionState({ extensionId }))))

    const extensionsById = new Map<string, ExtensionWithFeatureAndEntryPoint>()
    for (const extension of extensions) {
      if (extension) {
        extensionsById.set(extension.id, extension)
      }
    }

    return installations
      .flatMap<ExtensionAndInstallation>((installation) => {
        const extension = extensionsById.get(installation.extensionId)
        if (extension == null) return []
        return [{ extension, installation }]
      })
      .sort(extensionAndInstallationSorter)
  },
  // Disabled to avoid problems with async queries.
  // See https://spacemakercore.slack.com/archives/C07LAM6A734/p1736175343465239
  // cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export function useInstallationsWithExtension() {
  // recoil does not support giving stale values
  // while doing a new loading, so this is a workaround
  // to achieve this.

  const loadable = useRecoilValueLoadable(installationsWithExtensionState)
  const updated = loadable.valueMaybe()

  const installationsWithExtension = useRef<ExtensionAndInstallation[] | undefined>(updated)
  if (updated != null) {
    installationsWithExtension.current = updated
  }

  return installationsWithExtension.current
}

export const extensionsHavingInstallationState = selector<Extension[]>({
  key: "extensionsHavingInstallation",
  get: ({ get }) => {
    const result = new Map<string, Extension>()

    const items = get(installationsWithExtensionState)
    for (const item of items) {
      result.set(item.extension.id, item.extension)
    }

    return Array.from(result.values()).sort(extensionSorter)
  },
  // Disabled to avoid problems with async queries.
  // See https://spacemakercore.slack.com/archives/C07LAM6A734/p1736175343465239
  // cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export function useExtensionsHavingInstallation() {
  // recoil does not support giving stale values
  // while doing a new loading, so this is a workaround
  // to achieve this.

  const loadable = useRecoilValueLoadable(extensionsHavingInstallationState)
  const updated = loadable.valueMaybe()

  const extensionsHavingInstallation = useRef<Extension[] | undefined>(updated)
  if (updated != null) {
    extensionsHavingInstallation.current = updated
  }

  return extensionsHavingInstallation.current
}
