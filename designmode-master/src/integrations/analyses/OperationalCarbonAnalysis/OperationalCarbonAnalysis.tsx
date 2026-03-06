import useLazyLoadScript from "src/lib/useLazyLoadScript"
import { StackBasedErrorBoundary } from "src/lib/components/FailableComponentWrapper/StackBasedErrorBoundary"
import { sharedCarbonAPI } from "src/integrations/analyses/SharedCarbonAPI/SharedCarbonAPIs"

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-operational-carbon-analysis": JSX.HTMLAttributes<HTMLElement> & {
        api: typeof sharedCarbonAPI
      }
    }
  }
}

export function OperationalCarbonAnalysis() {
  const isLoaded = useLazyLoadScript(
    "/web-components/forma-operational-carbon-analysis/forma-operational-carbon-analysis.js",
    "end-to-end-analysis",
  )

  if (!isLoaded) {
    return null
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <StackBasedErrorBoundary stackPath={"forma-operational-carbon-analysis"}>
        <forma-operational-carbon-analysis api={sharedCarbonAPI} />
      </StackBasedErrorBoundary>
    </div>
  )
}
