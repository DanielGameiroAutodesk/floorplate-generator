export const DEFAULT_COLOR_2D = "#666666"
export const DEFAULT_OPACITY_2D = 0.5
export const DEFAULT_COLOR_3D = "#efefef"

export type RenderingProperties = {
  color?: string
  opacity?: number
  stroke?: {
    color: string
    dashed: boolean
  }
}

// Typically this information should live on element.properties. This function serves as a default lookup based on
// category if rendering properties is not set
export function getDefaultRenderingPropertiesByCategory(
  category: string | undefined,
  isVolume: boolean,
): RenderingProperties {
  switch (category) {
    case "property-boundaries":
    case "property_boundary":
      return {
        opacity: 0.2,
        color: "#666666",
        stroke: {
          dashed: true,
          color: "#666666",
        },
      }
    case "site_limit":
      return { color: "#C4313D" }
    case "zone":
      return {
        color: "#505050",
        opacity: 0.0,
        stroke: {
          color: "#656565",
          dashed: false,
        },
      }
    case "road":
      return {
        color: "#999999",
        opacity: 1,
      }
    case "rails":
      return {
        color: "#676767",
        opacity: 1,
        stroke: {
          color: "#676767",
          dashed: true,
        },
      }
  }
  if (isVolume) {
    return { color: DEFAULT_COLOR_3D }
  }
  return {
    color: DEFAULT_COLOR_2D,
    opacity: DEFAULT_OPACITY_2D,
  }
}
