import type { ComponentType } from "preact"
import { useEffect, useState } from "preact/hooks"

// Should match the alerting https://spacemaker-ai.sentry.io/alerts/rules/designmode/12692685/
export type Owner =
  | "conceptual"
  | "building-systems"
  | "atlas"
  | "squad-na-east"
  | "carbon-analysis"
  | "end-to-end-analysis"
  | "customer-journey"
  | "gamma"
  | "delta"
  | "shareable-content"
  | "ecosystem"
  | "growth"
  | "analyze-extensions"
  | "design-mode"
  | "collaboration"
  | "analyze-noise"
  | "forma-connected"
  | "site-analysis"
  | "site-design"
  | "aecgaia"

export const scriptOwners: Record<string, Owner> = {
  "/web-components/proposal-list-v2/proposal-list-v2.js": "collaboration",
  "/web-components/forma-analysis-catalog/forma-analysis-catalog.js": "gamma",
  "/web-components/help-panel/help-panel.es.js": "growth",
  "/web-components/license-banner/v1/forma-license-banner.js": "growth",
  "/web-components/sm-join-project-button/v1/sm-join-project-button.es.js": "growth",
}

export const scriptHostOwners: Record<string, Owner> = {
  "appstore.autodesk.com": "ecosystem",
}

async function loadScript(src: string, owner: Owner) {
  // Note that the special template literal is intentional and required.
  // It overrides logic in Vite dev mode that would otherwise cause the
  // URL to be modified to include `?import`. This again would cause the
  // same script to be loaded as different modules, if there is also another
  // import without the extra part.
  //
  // See https://spacemakercore.slack.com/archives/CAHV80VLP/p1719403857305149?thread_ts=1719395788.969999&cid=CAHV80VLP
  //
  // vite-ignore suppresses the warning that vite can't (as expected) analyze this import.
  await import(/* @vite-ignore */ `${src}`)

  if (owner) {
    const filenameWithoutCachebusters = src.split("?")[0]
    scriptOwners[filenameWithoutCachebusters] = owner
  }
}

export default function useLazyLoadScript(src: string, owner: Owner) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    void loadScript(src, owner).then(() => setIsLoaded(true))
  }, [src, owner])

  return isLoaded
}

export function withLazyLoadScriptPlaceholder(
  src: string,
  owner: Owner,
  placeholder: JSX.Element | (() => JSX.Element),
) {
  return function <P = Record<string, never>>(Component: ComponentType<P>) {
    return function LazyLoadScriptPlaceholder(props: P) {
      const isLoaded = useLazyLoadScript(src, owner)
      if (!isLoaded) return typeof placeholder === "function" ? placeholder() : placeholder
      return <Component {...(props as JSX.IntrinsicAttributes & P)} />
    }
  }
}

export function useLazyLoadCustomElementScriptWithError(src: string, owner: Owner, customElementName: string) {
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    loadScript(src, owner)
      .then(() => {
        if (!customElements.get(customElementName)) {
          console.error(`Failed to load custom element ${customElementName} from ${src}`)
          setFailed(true)
        }
      })
      .catch((err) => {
        console.error(err)
        setFailed(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [src, owner, customElementName])

  return { loading, failed }
}
