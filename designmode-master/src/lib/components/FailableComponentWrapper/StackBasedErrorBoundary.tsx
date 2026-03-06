import { useEffect, useState } from "preact/compat"
import type { VNode } from "preact"
import styles from "./FailableComponent.module.pcss"
import { useTranslator } from "src/i18n"

export class ComponentFailedEvent extends CustomEvent<{ labels: string[] }> {
  constructor(labels: string[]) {
    super("component-failed", { detail: { labels }, cancelable: true })
  }
}

/**
 * Parses an error and emits a ComponentFailedEvent based on the stack of the error
 * @param error
 * @return true if the error was preventDefault-ed anywhere
 */
export function emitGlobalError(error: PromiseRejectionEvent | ErrorEvent | any): boolean {
  const stack: string = error.error?.stack || error.reason?.stack
  if (!stack) return false

  const pathRegEx = new RegExp(".*at.*https://([^)]*),*")
  const regexMatch = pathRegEx.exec(stack)
  if (!regexMatch) return false
  const path = regexMatch[1]

  const module = path.split("/").slice(1, 3)
  const componentFailedEvent = new ComponentFailedEvent(module)
  window.dispatchEvent(componentFailedEvent)
  return componentFailedEvent.defaultPrevented
}

/**
 * Creates an error boundary that triggers on errors based on their stacktrace.
 * This can be used to shut down parts of a page based on failures in certain parts of the code.
 * Specifically, this can capture unhandled exceptions, which don't bubble up through the DOM.
 * Used to remove web-components that don't correctly isolate their errors.
 * @param errorLabel component will render fallback whenever a ComponentFailedEvent with this label is emitted on window.
 * @param children will be rendered as long as relevant error has not been emitted
 */
export const StackBasedErrorBoundary = ({
  stackPath,
  children,
  className,
  darkMode,
}: {
  stackPath: string
  children: VNode
  className?: string
  darkMode?: boolean
}) => {
  const t = useTranslator()
  const [failing, setFailing] = useState(false)

  useEffect(() => {
    const fail = (e: Event) => {
      if (e instanceof ComponentFailedEvent && e.detail.labels.includes(stackPath)) {
        console.log(e.detail.labels)
        e.preventDefault()
        setFailing(true)
      }
    }
    window.addEventListener("component-failed", fail)

    return () => window.removeEventListener("component-failed", fail)
  }, [stackPath])

  if (!failing) return <>{children}</>

  return (
    <div className={className}>
      <div
        className={[styles.failedComponent, darkMode ? styles.darkMode : ""].join(" ")}
        style={`--text-color-medium-default: ${darkMode ? "#ffffff" : "#3c3c3c"}`}
      >
        <Icon />
        {t(($) => $.errorBoundary.componentCrashed)}
        <weave-button variant="outlined" onClick={() => setFailing(false)}>
          {t(($) => $.errorBoundary.retryButton)}
        </weave-button>
      </div>
    </div>
  )
}

const Icon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 1C5.02944 1 1 5.02944 1 10C1 14.9706 5.02944 19 10 19C14.9706 19 19 14.9706 19 10C19 5.02944 14.9706 1 10 1ZM0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10ZM10.75 14.75C10.75 15.1642 10.4142 15.5 10 15.5C9.58579 15.5 9.25 15.1642 9.25 14.75C9.25 14.3358 9.58579 14 10 14C10.4142 14 10.75 14.3358 10.75 14.75ZM9.5 4V12.5H10.5V4H9.5Z"
      fill="currentColor"
    />
  </svg>
)
