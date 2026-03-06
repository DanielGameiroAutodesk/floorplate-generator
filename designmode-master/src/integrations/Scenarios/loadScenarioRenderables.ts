import { type BufferGeometry, Matrix4, type Mesh } from "three"
import { type GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { isDefined } from "src/lib/array"
import { yUpToZUp } from "src/lib/download-helpers"
import type {
  Geolocation,
  GetScenarioResponse,
  ModelResponse,
  RepresentationViewable3D,
} from "src/integrations/spaces/spaceClient/spaceClientv4"
import { BUILDING_DESIGN_AUTHORING_ENGINE, type ModelRepresentation, SITE_DESIGN_AUTHORING_ENGINE } from "./scenario"
import { getGeolocationTransform } from "src/integrations/spaces/geolocation"
import { mergeScenarioGeometries } from "./internal/mergeScenarioGeometries"
import { pollForRepresentation } from "./scenariosClient"

const TERRAIN_REPRESENTATION_NAME = "terrainRepresentation"

// Helper for space model - converts service endpoint to relative URL
export function getRelativeUrl(serviceEndpoint: string): string {
  if (!serviceEndpoint || typeof serviceEndpoint !== "string") {
    return ""
  }

  // Check if it's already a relative URL (starts with / or doesn't contain protocol)
  if (serviceEndpoint.startsWith("/") || (!serviceEndpoint.includes("://") && !serviceEndpoint.startsWith("http"))) {
    return serviceEndpoint
  }

  // Try to parse as absolute URL and extract relative part
  try {
    const url = new URL(serviceEndpoint)
    // Return pathname + search + hash (everything after the domain)
    return url.pathname + url.search + url.hash
  } catch {
    // If URL parsing fails but it looks like an absolute URL, try regex extraction
    const match = serviceEndpoint.match(/^https?:\/\/[^/]+(.*)$/)
    if (match && match[1]) {
      return match[1]
    }

    // Fallback: return as-is (treat as relative)
    return serviceEndpoint
  }
}

const getGeometriesFromGlb = (glb: GLTF): BufferGeometry[] => {
  const geometries: BufferGeometry[] = []
  glb.scene.updateMatrixWorld()
  glb.scene.traverse((child) => {
    if (child.type === "Mesh") {
      const geo = (child as Mesh).geometry.clone()
      geo.applyMatrix4(child.matrixWorld)
      geometries.push(geo)
    }
  })

  return geometries
}

/**
 * Get all the viewables from a scenario that are not terrain
 */
export const getViewablesFromScenario = (
  scenario: GetScenarioResponse,
): ModelRepresentation<RepresentationViewable3D>[] => {
  const scenarioViewables: ModelRepresentation<RepresentationViewable3D>[] = []

  // Go through all models and collect viewables that are not terrain
  scenario.models.forEach((model: ModelResponse) => {
    if (model.authoringEngine === SITE_DESIGN_AUTHORING_ENGINE) {
      return
    }
    if (model.authoringEngine === BUILDING_DESIGN_AUTHORING_ENGINE) {
      return
    }
    const representations = model.representations || []
    representations.forEach((representation) => {
      if (
        representation.name !== TERRAIN_REPRESENTATION_NAME &&
        representation.typeid === "autodesk.aec.forma:representation-viewable-3d-1.0.0"
      ) {
        scenarioViewables.push({ model, representation })
      }
    })
  })

  return scenarioViewables
}

// V4 version using representations grouped by authoring engine
export const loadScenarioRenderables = async (
  scenario: GetScenarioResponse,
  siteDesignGeolocation: Geolocation | undefined,
) => {
  const scenarioViewables = getViewablesFromScenario(scenario)
  const glbs = await Promise.all(
    scenarioViewables.map(async ({ model, representation }) => {
      let buffer
      try {
        // Anything having a URL should use the polling strategy
        if (representation.url) {
          const url = getRelativeUrl(representation.url)
          buffer = await pollForRepresentation(url)
        } else {
          // This code path will/should eventually be deprecated
          const url = getRelativeUrl(representation.serviceEndpoint || representation.location)
          const res = await fetch(url)
          buffer = await res.arrayBuffer()
        }
      } catch (error) {
        console.error("Error downloading GLB:", error)
        return
      }

      const glb = await new GLTFLoader().parseAsync(buffer, "")
      const transform =
        model.geolocation != null && siteDesignGeolocation != null
          ? await getGeolocationTransform(model.geolocation, siteDesignGeolocation)
          : null

      const compositeId = `${model.id}::${representation.id || representation.name}::${model.revision}`
      return { glb, transform, modelRepId: compositeId }
    }),
  )

  const perModelGeometries = glbs.filter(isDefined).map(({ glb, transform, modelRepId }) => {
    const geometries = getGeometriesFromGlb(glb)
    const transformed = geometries.map((geometry) => {
      geometry.applyMatrix4(yUpToZUp)
      if (transform != null) {
        geometry.applyMatrix4(new Matrix4(...transform))
      }
      return geometry
    })
    const merged = mergeScenarioGeometries(transformed, true) ?? undefined
    if (merged) {
      merged.userData = { modelRepId }
    }
    return merged
  })

  return perModelGeometries.filter(isDefined)
}
