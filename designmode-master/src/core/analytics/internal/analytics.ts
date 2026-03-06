import { PROJECT_ID } from "src/core/project/project"
import {
  type AdditionalEventProperties,
  type ContextProperties,
  EventName,
  type EventProperties,
  ExperienceName,
  FeatureCategory,
  PageName,
  track as libTrack,
} from "@spacemakerai/webapp-analytics"

const DESIGN_MODE_CONTEXT_PROPERTIES = {
  page_name: PageName.DesignMode,
  experience_name: ExperienceName.SiteDesign,
  project_id: PROJECT_ID,
  tracking_schema_version: "v1.3",
} satisfies Omit<ContextProperties, "user_id">

function track(name: EventName, properties: EventProperties, additionalProperties?: AdditionalEventProperties) {
  libTrack(name, properties, DESIGN_MODE_CONTEXT_PROPERTIES, additionalProperties)
}

function trackAddElement(
  name: EventName.Add,
  properties: EventProperties & { feature_category: FeatureCategory.DesignTool; feature: Tool; object_type: "element" },
  additionalProperties: { category: string; shape_type?: string } & AdditionalEventProperties,
) {
  libTrack(name, properties, DESIGN_MODE_CONTEXT_PROPERTIES, additionalProperties)
}

function trackEditElement(
  name: EventName.Edit,
  properties: EventProperties & { feature_category: FeatureCategory.DesignTool; feature: Tool; object_type: "element" },
  additionalProperties: { category: string; shape_type?: string } & AdditionalEventProperties,
) {
  libTrack(name, properties, DESIGN_MODE_CONTEXT_PROPERTIES, additionalProperties)
}

export type Tool =
  | "draw"
  | "affine"
  | "move"
  | "rotate"
  | "generator"
  | "boolean"
  | "measure_distance"
  | "add_label"
  | "explore"
  | "3dSketch"
  | "place_mode"
  | "line_building"
  | "basic_building"
  | "row_house"
  | "iterative_explore"
  | "transportation"

export type Method =
  | "toolbar"
  | "hotkey"
  | "context_menu"
  | "right_panel"
  | "double_click"
  | "area_metrics"
  | "building_toolbar"

type DrawSubTool = "polygon" | "line" | "volume25d" | "line_building" | "row_house" | "curve"

function trackSelectTool(tool: "draw", subTool: DrawSubTool, method: Method, category: string): void
function trackSelectTool(tool: "move", subTool: "precise" | "quick", method: Method, category?: string): void
function trackSelectTool(
  tool: "boolean",
  subTool: "union" | "intersect" | "subtract" | "offset" | "split",
  method: Method,
  category?: string,
): void
function trackSelectTool(
  tool: Exclude<Tool, "draw" | "move" | "boolean">,
  subTool: string | undefined,
  method: Method,
  category?: string,
): void
function trackSelectTool(tool: Tool, subTool: string | undefined, method: Method, category?: string): void {
  libTrack(
    EventName.Select,
    {
      feature_category: FeatureCategory.DesignTool,
      feature: tool,
      sub_feature: subTool,
    },
    DESIGN_MODE_CONTEXT_PROPERTIES,
    { method, category },
  )
}

export const Analytics = {
  track,
  trackAddElement,
  trackEditElement,
  trackSelectTool: trackSelectTool,
}
