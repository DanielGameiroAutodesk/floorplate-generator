import { defaultTreeAreaConfig, defaultTreeLineConfig } from "./trees/defaults"
import type { BasicElementProperties } from "./BasicElementProperties"
import { getTranslator } from "src/i18n"

// TODO(l10n): This does not currently react to locale changes.
const t = getTranslator()

export const basicElementPresets = {
  constraints: {
    category: "constraints",
    name: t(($) => $.limits.constraint.name),
    color: "#b899b8",
    opacity: 0.3,
    virtual: true,
  },
  vegetation: {
    category: "vegetation",
    name: "Vegetation",
    color: "#4B8B67",
  },
  site_limit: {
    category: "site_limit",
    name: "Site Limit",
    color: "#C4313D",
  },
  zone: {
    category: "zone",
    name: "Zone",
    color: "#505050",
    opacity: 0.0,
    stroke: {
      color: "#656565",
      dashed: false,
    },
  },
  building: {
    category: "building",
    name: "Building",
    color: "#E6E8EA",
  },
  tree_area: {
    category: "tree_area",
    name: t(($) => $.vegetation.areaWithTrees.name),
    color: "#4B8B67",
    treePlacerGenerator: { ...defaultTreeAreaConfig(), id: "treePlacerGenerator" },
    virtual: true,
  },
  tree_line: {
    category: "tree_line",
    name: t(($) => $.vegetation.treeLine.name),
    color: "#4B8B67",
    treeLineGenerator: { ...defaultTreeLineConfig(), id: "treeLineGenerator" },
    virtual: true,
  },
  road: {
    category: "road",
    name: "Roads",
    color: "#999999",
    opacity: 1,
  },
  rails: {
    category: "rails",
    name: t(($) => $.transportation.railroads.name),
    color: "#676767",
    opacity: 1,
    stroke: {
      color: "#676767",
      dashed: true,
    },
  },
  property_boundary: {
    category: "property_boundary",
    name: "Property Boundaries",
    opacity: 0.2,
    color: "#666666",
    stroke: {
      dashed: true,
      color: "#666666",
    },
  },
  generic25D: {
    category: "generic",
    name: "Volume",
    color: "#efefef",
  },
  generic2D: {
    category: "generic",
    name: "Shape",
    color: "#666666",
    opacity: 0.5,
  },
  generic2DLine: {
    category: undefined,
    name: "Line",
    color: "#666666",
    opacity: 0.5,
    stroke: {
      color: "#666666",
      dashed: false,
    },
  },
} satisfies { [presetName: string]: BasicElementProperties }

export type BasicPresetMap = typeof basicElementPresets
export type BasicPresetKey = keyof BasicPresetMap
export type BasicPreset = BasicPresetMap[BasicPresetKey]

export function updateElementPropertyPreset<Key extends BasicPresetKey, Property extends keyof BasicPresetMap[Key]>({
  presetName,
  presetProperty,
  value,
}: {
  presetName: Key
  presetProperty: Property
  value: BasicPresetMap[Key][Property]
}) {
  basicElementPresets[presetName][presetProperty] = value
}
