import type { FormaElement, Representation } from "forma-elements"
import { objectEntries } from "src/lib/record"
import { captureException } from "@sentry/browser"
import { explodeElementUrn } from "@spacemakerai/elements-client"

function isNewStyleRepresentation<T>(representation: unknown): representation is Representation<T> {
  return (
    representation != null &&
    typeof representation === "object" &&
    "type" in representation &&
    typeof representation.type === "string" &&
    ["embedded-json", "embedded-binary", "linked"].includes(representation.type)
  )
}

// Report at most one issue for now to avoid potential flood of issues.
let hasReportedAnyIssues = false

function reportIssue(error: Error, element: FormaElement, extra?: Record<string, unknown>) {
  if (!hasReportedAnyIssues) {
    const { system } = explodeElementUrn(element.urn)
    hasReportedAnyIssues = true
    captureException(error, {
      extra: {
        ...extra,
        elementSystemName: system,
      },
    })
    console.error(error)
  }
}

export function reportObservedElementIssues(element: FormaElement, isServerState: boolean): void {
  // Let us know in case we unexpectedly see a FormaElement v1 structure.
  for (const [representationName, representation] of objectEntries(element.representations ?? {})) {
    if (!isNewStyleRepresentation(representation)) {
      const err = new Error(
        `Representation '${representationName}' on element '${element.urn}' seems to be FormaElement v1 and not v2 [isServerState=${isServerState}]`,
      )

      reportIssue(err, element, {
        representationName,
        isServerState,
      })

      console.error(err, {
        representation,
        element,
      })

      // Stop on first issue.
      return
    }
  }
}
