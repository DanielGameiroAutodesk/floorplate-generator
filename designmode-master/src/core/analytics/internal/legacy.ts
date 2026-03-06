import { addBreadcrumb } from "@sentry/browser"
import { PROJECT_ID } from "src/core/project/project"
import { CurrentLocation } from "src/lib/location"
import { Analytics } from "./analytics"
import { EventName, FeatureCategory, legacyTrack, page } from "@spacemakerai/webapp-analytics"

export const APPNAME = "DesignMode"

/**
 * @deprecated Use Analytics instead
 */
export const AnalyticsLegacy = {
  page: () => {
    page({
      page_name: APPNAME,
      projectId: PROJECT_ID,
      app: APPNAME,
      proposalId: CurrentLocation.getProposalId(),
      toolbarVariation: "horizontal",
    })
  },
  track: (event: string, eventProps?: Record<string, string | string[] | number | boolean>) => {
    legacyTrack(`${APPNAME}: ${event}`, {
      projectId: PROJECT_ID,
      app: APPNAME,
      proposalId: CurrentLocation.getProposalId(),
      ...eventProps,
    })
  },
  trackSelectTool(
    tool: AnalyticsTools,
    method: "toolbar" | "hotkey" | "area_metrics",
    eventProps?: Omit<Record<string, string | string[] | number | boolean>, "tool" | "method">,
  ) {
    // New tracking schema is added where this function is called
    AnalyticsLegacy.track("Select tool", { tool, ...(method ? { method } : {}), ...eventProps })
  },
}

export function triggerAnalyticsPageLoad() {
  Analytics.track(EventName.LoadedAPage, {
    feature_category: FeatureCategory.DesignTool,
    feature: "design_mode",
  })
  AnalyticsLegacy.page()
}

export function analyticsAndBreadcrumbsForActions(name: string, trackingData?: TrackingData) {
  AnalyticsLegacy.track(name, trackingData)
  addBreadcrumb({
    type: "user",
    message: `Action - ${name}`,
    category: "EditHistory.execute",
    level: "log",
    data: trackingData,
  })
}

export enum AnalyticsKey {
  DesignMode_App = "DesignMode",
  FloorPlanSketcher_SubApp = "Floor Plans",
  Sketch3D = "3D Sketch",
  ElementType_3DSBuilding = "3D Sketch Building",
  ElementType_3DSGeneric = "3D Sketch Generic",
  ElementType_BasicBuilding = "Basic Building",
  ElementType_Constraint = "Constraint",
  ElementType_Volume = "Volume",
  ElementType_Import = "Import",
  ElementType_Dynamo = "Dynamo",
  ElementType_Rhino = "Rhino",
  ElementType_ContextualLOD100 = "Contextual Building LOD100",
  ElementType_ContextualLOD200 = "Contextual Building LOD200",
  ElementType_Unknown = "Unknown",
  EventSource_Toolbar = "Toolbar",
  EventSource_EditStateToolbar = "Edit State Toolbar",
  EventSource_Click = "Click",
  EventSource_EnterAsClick = "Enter-as-click",
  EventSource_DoubleClick = "Double-click",
  EventSource_ContextMenu = "Context Menu",
  EventSource_RightPanel = "Right Panel",
  EventSource_Hotkey = "Hotkey",
  EventSource_Implicit = "Implicit",
  Tool_Started = "tool started",
  ExitTool = "Exit tool",
}

export enum AnalyticsTools {
  Explore = "Explore",
  LineBuilding = "Line Building",
  BasicBuilding = "Basic Building",
  MeasureDistance = "Measure Distance",
  House = "House",
  HouseComposition = "House Composition",
  Label = "Label",
  SiteLimit = "Site Limit",
  Zone = "Zone",
  Constraints = "Constraints",
  Road = "road",
  Rails = "rails",
  Vegetation = "Vegetation",
  GenericVolume = "Generic Volume",
  GenericLine = "Generic Line",
  GenericSurface = "Generic Surface",
  ExtensionGenerator = "Extension: Generator",
  PreciseMove = "Precise Move",
  Rotate = "Rotate",
  BooleanOperation = "Boolean Operation",
  ThreeDSketch = "3D Sketch",
  PlaceModeAffine = "Place Mode Affine",
  PlaceModeGeoref = "Place Mode Georef",
  PlaceModeTerrain = "Place Mode Terrain",
  EditPolygon = "Edit Polygon",
}

type EventType = "add" | "delete" | "update" | "replace" | string

export type TrackingData = {
  [otherKey: string]: string | number | boolean
} & {
  eventType: EventType
  elementCategory: string
  numElements: number
  tool?: string
  inScenario?: "yes" | "no" | "mixed"
}

export const AnalyticsUtils = {
  trackedElementCategory(categories: (string | undefined)[]): TrackingData["elementCategory"] {
    return (
      categories.reduce((previousValue, currentValue, currentIndex) => {
        if (currentIndex === 0) return currentValue
        return currentValue === previousValue ? previousValue : "mixed"
      }, undefined) || ""
    )
  },
  trackedInScenarioFlag(inScenario: boolean[]): "yes" | "no" | "mixed" {
    return inScenario.length > 1 ? "mixed" : inScenario[0] ? "yes" : "no"
  },
}
