import type { FormaElement } from "@spacemakerai/element-types"
import type { Feature, LineString } from "geojson"
import type { TerrainShape, TerrainShapeFeaturePropertiesWithExtensions } from "src/lib/element/types"
import { isDefined } from "src/lib/array"

export function featureToTerrainShape(feature: Feature, element: FormaElement): TerrainShape {
  const category = element.properties?.category ?? "generic"

  const lineWidth = feature.properties && "lineWidth" in feature.properties ? feature.properties.lineWidth : undefined
  const color = element.properties?.color
  const opacity = element.properties?.opacity

  if (category === "rails" && feature.geometry.type === "LineString") {
    return railroadToTies(feature as Feature<LineString>, lineWidth ?? 4)
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        ...feature,
        properties: categoryToProperties(category, {
          lineWidth,
          color,
          opacity,
          imgUrl: element.properties?.referenceImageLink?.url,
        }),
      },
    ],
  }
}

function categoryToProperties(
  category: string,
  override: {
    lineWidth?: number
    color?: string
    opacity?: number
    imgUrl?: string
  },
): TerrainShapeFeaturePropertiesWithExtensions {
  switch (category) {
    case "site_limit":
      return { fill: { color: "#C4313D" } }
    case "vegetation":
      return { fill: { color: "#4B8B67" } }
    case "zone":
      return { fill: { opacity: 0, color: "#505050" }, stroke: { color: "#656565" } }
    case "tree_area":
      return { fill: { color: "#4B8B67" } }
    case "tree_line":
      return { stroke: { color: "#4B8B67", lineWidth: override.lineWidth ?? 1 } }
    case "road":
      return { stroke: { lineWidth: override.lineWidth ?? 6, color: "#999999" } }
    case "rails":
      return { stroke: { lineWidth: override.lineWidth ?? 6, color: "#676767" } }
    case "property_boundary":
    case "property_boundaries":
    case "property-boundaries":
      return { fill: { color: "#666666", opacity: 0.2 }, stroke: { color: "#666666", lineWidth: 1, dashed: true } }
    case "reference_image":
    case "referenceImage":
      return {
        fill: { imgUrl: override.imgUrl, opacity: override.opacity, color: override.color ?? "#ffffff" },
      }
    default:
      return {
        fill: { color: override.color ?? "#000000", opacity: isDefined(override.opacity) ? override.opacity : 0.5 },
        stroke: { color: override.color ?? "#000000", lineWidth: override.lineWidth ?? 1 },
      }
  }
}

// These constants match the legacy dashed line renderer the best
const TIE_SPACING = 2.1
const TIE_WIDTH = 1.8
function railroadToTies(feature: Feature<LineString>, lineWidth: number): TerrainShape {
  const features: TerrainShape["features"] = []

  for (let i = 0; i <= feature.geometry.coordinates.length - 2; i++) {
    const from = feature.geometry.coordinates[i]
    const to = feature.geometry.coordinates[i + 1]

    const vec = [to[0] - from[0], to[1] - from[1]]
    const dist = Math.sqrt(vec[0] ** 2 + vec[1] ** 2)
    const norm_vec = [vec[0] / dist, vec[1] / dist]
    const offset = [(norm_vec[1] * lineWidth) / 2, (-norm_vec[0] * lineWidth) / 2]

    for (let distAlongLine = 0; distAlongLine < dist; distAlongLine += TIE_SPACING) {
      const midpoint = [from[0] + norm_vec[0] * distAlongLine, from[1] + norm_vec[1] * distAlongLine]

      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [midpoint[0] + offset[0], midpoint[1] + offset[1]],
            [midpoint[0] - offset[0], midpoint[1] - offset[1]],
          ],
        },
        properties: { stroke: { lineWidth: TIE_WIDTH, color: "#676767" } },
        id: `${feature.id}-${i}-${distAlongLine}`,
      })
    }

    // This is only for raycasting
    features.push({
      type: "Feature",
      id: `${feature.id}-${i}-outline`,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [from[0] + offset[0], from[1] + offset[1]],
            [from[0] - offset[0], from[1] - offset[1]],
            [to[0] - offset[0], to[1] - offset[1]],
            [to[0] + offset[0], to[1] + offset[1]],
            [from[0] + offset[0], from[1] + offset[1]],
          ],
        ],
      },
      properties: {
        fill: { opacity: 0 },
      },
    })
  }

  return { type: "FeatureCollection", features }
}
