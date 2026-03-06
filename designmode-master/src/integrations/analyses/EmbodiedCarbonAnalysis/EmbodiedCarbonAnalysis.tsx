import useLazyLoadScript from "src/lib/useLazyLoadScript"
import { sharedCarbonAPI } from "src/integrations/analyses/SharedCarbonAPI/SharedCarbonAPIs"
import { StackBasedErrorBoundary } from "src/lib/components/FailableComponentWrapper/StackBasedErrorBoundary"
import { submodeSignal, type Submode } from "src/core/submode-state"
import { Backfill3DSGraphBuildings } from "src/integrations/conceptual-squad/Backfill3DSGraphBuilding"

type ViewContext =
  | {
      viewType: "viewAnalysis"
      analysisId: string
    }
  | {
      viewType: "compare"
      analysisId: string
    }
  | {
      viewType: "main"
    }

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-embodied-carbon-analysis": JSX.HTMLAttributes<HTMLElement> & {
        api: typeof sharedCarbonAPI
        viewContext?: ViewContext
      }
    }
  }
}

export function EmbodiedCarbonAnalysis() {
  const isLoaded = useLazyLoadScript(
    "/web-components/forma-embodied-carbon-analysis/forma-embodied-carbon-analysis.js",
    "carbon-analysis",
  )

  const searchParams = new URLSearchParams(window.location.search)
  const analysisId = searchParams.get("analysisId") ?? undefined

  const submode = submodeSignal.value

  if (submode !== undefined && analysisId === undefined) {
    console.error("Analysis ID is required for viewAnalysis and compare submodes")
    return null
  }

  if (!isLoaded) {
    return null
  }

  const viewContext = createViewContext(submode, analysisId)

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <Backfill3DSGraphBuildings />
      <StackBasedErrorBoundary stackPath={"forma-embodied-carbon-analysis"}>
        <forma-embodied-carbon-analysis api={sharedCarbonAPI} viewContext={viewContext} />
      </StackBasedErrorBoundary>
    </div>
  )
}

function createViewContext(submode: Submode | undefined, analysisId: string | undefined): ViewContext {
  switch (submode) {
    case "lightMode": {
      console.error("Programming error; analyses shouldn't load in light mode")
      /* falls through */
    }
    case undefined: {
      return { viewType: "main" as const }
    }
    default:
      return { viewType: submode, analysisId: analysisId! }
  }
}
