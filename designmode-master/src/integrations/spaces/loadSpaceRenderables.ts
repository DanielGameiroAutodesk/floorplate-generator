import { Matrix4, type BufferGeometry, type Mesh } from "three"
import { type Geolocation, type GetScenarioResponse } from "./spaceClient/spaceClientv4"
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js"
import { isDefined } from "src/lib/array"
import { yUpToZUp } from "src/lib/download-helpers"
import { getNonTerrainViewablesFromScenario } from "src/integrations/Scenarios/scenario"
import { getGeolocationTransform } from "./geolocation"
import { mergeSpaceGeometries } from "./internal/mergeSpaceGeometries"

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

// V4 version using representations grouped by authoring engine
export const loadSpaceRenderablesV4 = async (
  scenario: GetScenarioResponse,
  siteDesignGeolocation: Geolocation | undefined,
) => {
  const nonTerrainViewables = getNonTerrainViewablesFromScenario(scenario)
  const glbs = await Promise.all(
    nonTerrainViewables.map(async ({ model, representation }) => {
      const url = getRelativeUrl(representation.serviceEndpoint || representation.location)
      try {
        const res = await fetch(url)
        const glbArrayBuffer = await res.arrayBuffer()
        const glb = await new GLTFLoader().parseAsync(glbArrayBuffer, "")
        const transform =
          model.geolocation != null && siteDesignGeolocation != null
            ? await getGeolocationTransform(model.geolocation, siteDesignGeolocation)
            : null
        return { glb, transform }
      } catch (error) {
        console.error("Error downloading GLB:", error)
        return
      }
    }),
  )

  const geometries = glbs.filter(isDefined).flatMap(({ glb, transform }) => {
    const geometries = getGeometriesFromGlb(glb)
    return geometries.map((geometry) => {
      geometry.applyMatrix4(yUpToZUp)
      if (transform != null) {
        geometry.applyMatrix4(new Matrix4(...transform))
      }
      return geometry
    })
  })

  // Merge all non-terrain geometries with flat normals
  const mergedGeometry = mergeSpaceGeometries(geometries, true)
  return mergedGeometry ? [mergedGeometry] : []
}
