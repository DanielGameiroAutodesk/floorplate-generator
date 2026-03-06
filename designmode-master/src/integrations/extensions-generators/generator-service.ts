import { captureException } from "@sentry/browser"
import { useRef } from "preact/hooks"
import { atom, selector, selectorFamily, useRecoilValueLoadable, waitForAll } from "recoil"

import type { Extension } from "src/integrations/extensions/extension-service"
import {
  extensionState,
  installationsState,
  extensionsHavingInstallationState,
} from "src/integrations/extensions/extension-service"
import { PROJECT_ID } from "src/core/project/project"

export type Generator = {
  id: string
  name: string
  icons?: { small: string; large: string } // not in service yet
  runners: (
    | { type: "extensionEndpoint"; extension: { extensionId: string } }
    | { type: "extensionScript"; extensionId: string }
  )[]
}

type GeneratorAndExtension = {
  generator: Generator
  extension: Extension
  entryPointId: string
  featureId: string
}

async function getGenerators(accessScope: string) {
  const res = await fetch(`/api/generator-service/generators?accessScope=${accessScope}`)
  if (res.ok) {
    const generators: Generator[] = await res.json()
    return generators
  } else {
    const err = new Error(
      `Could not fetch generators for accessScope ${accessScope} (${res.status}: ${res.statusText})`,
    )

    // Temporary: Don't capture errors if it's checkly.
    // See https://spacemakercore.slack.com/archives/C07LAM6A734/p1727446745198189
    // if (PROJECT_ID !== "pro_vxlqozvrdi") {
    //   captureException(err, {
    //     level: res.status === 401 ? "warning" : "error",
    //     tags: { owner: "ecosystem" },
    //   })
    // }

    // As we access generators from different regions, we have a lot of 401s and 403s.
    captureException(err, {
      level: "log",
      tags: { owner: "ecosystem" },
    })

    return []
  }
}

const refreshState = atom<symbol>({
  key: "generatorsRefreshSymbol",
  default: Symbol(),
  effects: [
    ({ trigger, setSelf }) => {
      if (trigger === "get") {
        const listener = () => {
          setSelf(Symbol())
        }

        // This event is at least dispatched in forma-embedded-view-host
        // when a generator is updated via the embedded view SDK.
        window.addEventListener("generators/refresh", listener)
        return () => {
          window.removeEventListener("generators/refresh", listener)
        }
      }
    },
  ],
})

const generatorsByAccessScopeState = selectorFamily<Generator[], { accessScope: string }>({
  key: "generatorsByAccessScopeState",
  get:
    ({ accessScope }) =>
    async ({ get }) => {
      // Trigger refetch on refresh request.
      get(refreshState)

      return await getGenerators(accessScope)
    },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

const generatorsForExtensionsState = selector<Generator[]>({
  key: "generatorsForExtensionsState",
  get: ({ get }) => {
    const extensions = get(extensionsHavingInstallationState)

    return get(
      waitForAll(
        extensions
          .map((extension) => generatorsByAccessScopeState({ accessScope: extension.id }))
          .concat([generatorsByAccessScopeState({ accessScope: PROJECT_ID })]),
      ),
    ).flat()
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

function getExtensionId(generator: Generator) {
  for (const runner of generator.runners) {
    switch (runner.type) {
      case "extensionEndpoint":
        return runner.extension.extensionId
      case "extensionScript":
        return runner.extensionId
    }
  }
  return undefined
}

export const generatorsAndExtensionState = selector<GeneratorAndExtension[]>({
  key: "generatorsAndExtensionState",
  get: ({ get }) => {
    const generators = get(generatorsForExtensionsState)
    const installations = get(installationsState)

    const extensionIds = new Set(
      generators
        .map((it) => getExtensionId(it))
        .filter((it): it is string => it != null)
        .filter((extensionId) => installations.some((installation) => installation.extensionId === extensionId)),
    )

    const extensions = get(waitForAll([...extensionIds].map((extensionId) => extensionState({ extensionId }))))

    return generators.flatMap((generator) => {
      const extensionId = getExtensionId(generator)
      const extension = extensions.find((it) => it != null && it?.id === extensionId)

      if (!extension) return []

      return [
        {
          generator,
          extension,
          // Note: The general behaviour we have is divided into feature and entryPoint,
          // but for simplicity I am avoiding that
          // we can implement this in future if needed
          featureId: generator.id,
          entryPointId: `${extension.id}-${generator.id}`,
        },
      ]
    })
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export function useGeneratorsAndExtension() {
  // recoil does not support giving stale values
  // while doing a new loading, so this is a workaround
  // to achieve this.

  const loadable = useRecoilValueLoadable(generatorsAndExtensionState)
  const updated = loadable.valueMaybe()

  const result = useRef<GeneratorAndExtension[] | undefined>(updated)
  if (updated != null) {
    result.current = updated
  }

  return result.current
}
