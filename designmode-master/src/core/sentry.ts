import * as Sentry from "@sentry/browser"
import type { EventHint } from "@sentry/browser"
import {
  BrowserClient,
  browserTracingIntegration,
  captureException,
  dedupeIntegration,
  defaultStackParser,
  extraErrorDataIntegration,
  functionToStringIntegration,
  httpContextIntegration,
  inboundFiltersIntegration,
  linkedErrorsIntegration,
  makeFetchTransport,
  makeMultiplexedTransport,
  moduleMetadataIntegration,
  Scope,
} from "@sentry/browser"
import { PROJECT_ID } from "./project/project"
import { scriptHostOwners, scriptOwners } from "src/lib/useLazyLoadScript"
import { FetchError } from "src/lib/request"
import { getUserinfo } from "src/lib/userInfo"

interface ModuleMetadata {
  dsn: string
  release: string
}

interface Extras {
  [key: string]: unknown
  ROUTE_TO?: ModuleMetadata[]
}

Sentry.init({
  release: __SENTRY_RELEASE__,
  environment: window.location.host,
  dsn: "https://5a26b016e1b04be5b02d53ebde8cf432@o163647.ingest.sentry.io/4504077924499456",
  ignoreErrors: [
    "PROPOSAL_NOT_FOUND",
    "NO_ACCESS",
    "TOO_MANY_REQUESTS",
    "The user aborted a request.",
    /TypeError: Failed to fetch/,
    "TypeError: Failed to fetch",
  ],
  // Disabling here avoids Sentry hooking into console.log etc locally, which makes
  // using the developer console harder since stack traces point back to Sentry code.
  enabled: !window.location.host.includes("local"),
  maxBreadcrumbs: 100,
  integrations: [
    browserTracingIntegration({
      beforeStartSpan: (context) => {
        return {
          ...context,
          // You could use your UI's routing library to find the matching
          // route template here. We don't have one right now, so do some basic
          // parameter replacements.
          name: "designmode pageload",
        }
      },
    }),
    moduleMetadataIntegration(),
  ],
  // returns fraction of transactions sent to sentry. 1.0 = 100%. Should probably be <= 0.1 unless we are testing for something
  tracesSampler: () => {
    try {
      if (window.location.host.includes("local")) {
        return 0
      }
      if (window.location.search.includes("designmode-sentry-rate=")) {
        return parseFloat(window.location.search.split("designmode-sentry-rate=")[1].split("&")[0])
      }
    } catch {
      console.log("Failed to decide sentry sampling rate, using default")
    }
    return 0.005
  },
  beforeSendTransaction: (event) => {
    if (window.navigator.userAgent?.includes("HeadlessChrome")) return null
    if (window.location.host.includes("local")) return null
    event.breadcrumbs = []
    return event
  },
  beforeSend: (event, hint) => {
    //Intercepting of WASM exceptions for 3d sketch integration to gather and set additional info for Sentry
    //WASM exceptions are exposed to console with the error being a pointer to location in memory (integer)
    if (window.FormItModule && Number.isInteger(event.message)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        event.message = window.FormItModule.UTF8ToString(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          window.FormItModule._GetExceptionMessageFromPointer(event.message),
        )
      } catch {
        event.message = "Failed to get message from GetExceptionMessageFromPointer"

        //Currently this error is being sent to Sentry many times per second, accounting for hundreds of errors when it occurs.
        //For now, prevent sending this same error to Sentry over and over
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        window.FormItModule._errorCounts = window.FormItModule._errorCounts || {
          GetExceptionMessageFromPointer: 0,
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        window.FormItModule._errorCounts.GetExceptionMessageFromPointer++

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (window.FormItModule._errorCounts.GetExceptionMessageFromPointer > 1) {
          return null
        }
      }

      event.tags = event.tags || {}
      event.tags["owner"] = "conceptual"
      event.tags["isWASMError"] = true
      event.tags["integration-type"] = "integrated"
    }

    if (window.navigator.userAgent?.includes("HeadlessChrome")) return null
    if (hint?.originalException instanceof FetchError && hint.originalException.responseCode === 0) {
      // ResponseCode = 0 means network error. We don't want to report those.
      return null
    }
    if (hint?.originalException) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const e = hint.originalException as any
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (e.error?.code === "other" && e.error?.message === "Fetch failed") {
        // element-client throws these on network errors, ignore for now.
        return null
      }
    }
    event.tags = event.tags || {}

    if (hint?.originalException instanceof FetchError) {
      // Make sure the full URL is set since message only contains canonical url
      event.tags.data = hint.originalException.url
      event.tags.responseCode = hint.originalException.responseCode
    }

    const stackframes = event.exception?.values?.at(-1)?.stacktrace?.frames || []
    const frame = stackframes.find((_) => _.filename?.includes("https") && !_.filename.includes("/designmode/"))
    if (frame?.filename) {
      try {
        const url = new URL(frame.filename)
        const owner = scriptOwners[url.pathname] || scriptHostOwners[url.host]
        event.tags.filename = url.pathname

        if (!event.tags.owner && owner) {
          event.tags.owner = owner
        }
      } catch {
        // Just report like normal
      }
    }

    // If the error originates from a third party module such as a web component module with its own Sentry details
    // declared in its Sentry module metadata, route the error to its Sentry project by overriding the ROUTE_TO extra
    // field, which is used by the multiplexed transport to determine the destination Sentry project(s).
    if (event.exception?.values?.[0].stacktrace?.frames) {
      const frames = event.exception.values[0].stacktrace.frames
      const routeTo = frames
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        .map(({ module_metadata }) => module_metadata)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        .filter((module_metadata): module_metadata is ModuleMetadata => module_metadata?.dsn)
        .slice(-1) // using top frame with metadata only
      if (routeTo.length > 0) {
        event.extra = {
          ...event.extra,
          ROUTE_TO: routeTo,
        } satisfies Extras
      }
    }

    if (window.location.host.includes("local")) {
      console.error("Ignoring Sentry event on localhost", event)
      return null
    }
    return event
  },
  // https://docs.sentry.io/platforms/javascript/configuration/filtering/
  beforeBreadcrumb: (breadcrumb) => {
    if (breadcrumb.category === "console") {
      if (breadcrumb.message?.includes("[LaunchDarkly]")) {
        return null
      }
    }
    if (breadcrumb.category === "fetch") {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      if (breadcrumb.data?.url?.startsWith("https://api.segment.io")) {
        return null
      }
    }

    return breadcrumb
  },
  transport: makeMultiplexedTransport(makeFetchTransport, (args) => {
    const extra = args.getEvent()?.extra as Extras | undefined
    return extra?.ROUTE_TO ?? []
  }),
})

/** GLOBAL SENTRY LIB */

const scopes: { [dsn: string]: Scope } = {}

function globalConfigureScope(options: { dsn: string; release?: string }) {
  const client = new BrowserClient({
    dsn: options.dsn,
    release: options.release,
    enabled: !window.location.host.includes("local"),
    integrations: [
      dedupeIntegration(),
      functionToStringIntegration(),
      httpContextIntegration(),
      inboundFiltersIntegration(),
      linkedErrorsIntegration(),
      extraErrorDataIntegration(),
    ],
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
  })
  const scope = new Scope()
  scope.setClient(client)
  client.init()
  scopes[options.dsn] = scope
  if (userinfo) scopes[options.dsn].setUser(userinfo)
}

function globalAddBreadcrumb(breadcrumb: Breadcrumb, meta?: { dsn: string; release?: string }) {
  if (!meta?.dsn) return Sentry.addBreadcrumb(breadcrumb)
  if (!scopes[meta.dsn]) globalConfigureScope({ dsn: meta.dsn, release: meta.release })
  return scopes[meta.dsn].addBreadcrumb(breadcrumb)
}

function globalCaptureException(e: any, meta?: { dsn: string; release?: string }, hint?: EventHint) {
  if (!meta?.dsn) return Sentry.captureException(e)
  if (!scopes[meta.dsn]) globalConfigureScope({ dsn: meta.dsn, release: meta.release })
  return scopes[meta.dsn].captureException(e, hint)
}

export type Breadcrumb = {
  category?: "xhr" | "ui.click" | "error" | string
  level?: "fatal" | "error" | "warning" | "log" | "info" | "debug"
  message: string
}

declare global {
  interface Window {
    SENTRY: {
      captureException: typeof globalCaptureException
      configureHub: typeof globalConfigureScope
      addBreadcrumb: typeof globalAddBreadcrumb
    }
  }
}

window.SENTRY = {
  configureHub: globalConfigureScope,
  addBreadcrumb: globalAddBreadcrumb,
  captureException: globalCaptureException,
}

let userinfo: { id: string; email?: string }

getUserinfo()
  .then((res) => {
    const employee = res.email.endsWith("@autodesk.com")
    userinfo = { id: res.sub, ...(employee ? { email: res.email } : {}) }
    Sentry.setUser(userinfo)
    Sentry.setTags({
      identity: employee ? res.email : res.sub,
      project: PROJECT_ID,
      session: Math.random().toString(16).substring(2),
    })
    for (const scope of Object.values(scopes)) {
      scope.setUser(userinfo)
    }
  })
  .catch((err) => Sentry.captureException(err))

export function captureLogAndToast(exception: any, toast: string) {
  console.error(exception)
  captureException(exception)
  window.forma_toasts.push({ content: toast, status: "error" })
}
