import type { ProjectGeoLocation } from "src/core/project/project"
import type {
  GetScenarioResponse,
  ModelResponse,
  Geolocation,
  GeolocationInfo,
  GeographicPoint3D,
} from "./spaceClient/spaceClientv4"
import { CONTEXTUAL_DATA_AUTHORING_ENGINE } from "src/integrations/Scenarios/scenario"
import type { Transform } from "forma-elements"

const GeolocationBackendApis = {
  wgs84ToUtm: async (lat: number, lon: number): Promise<{ srid: number; point: [number, number] }> => {
    const response = await fetch(
      `/api/wgs84-to-utm?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`,
    )
    if (!response.ok) {
      throw new Error("Error getting UTM coordinates")
    }
    return response.json()
  },

  refPointToGeolocation: async (refPoint: GeographicPoint3D): Promise<Geolocation> => {
    const response = await fetch("/api/geolocation/create-basic-geolocation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "site-design",
        unit: "METER",
        geographicReferencePoint: refPoint,
        extentRadius: 2000, // TODO: Set radius from models bbox
      }),
    })
    if (!response.ok) {
      throw new Error("Error getting geolocation for new model")
    }
    const responseBody = await response.json()
    return responseBody.geolocation
  },

  geolocationInfo: async (geolocations: Geolocation[]): Promise<GeolocationInfo[]> => {
    const response = await fetch("/api/geolocation/get-geolocation-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geolocations }),
    })
    if (!response.ok) {
      throw new Error("Error getting geolocation info")
    }
    const responseBody = await response.json()
    return responseBody.geolocations
  },

  transformToGeolocation: async (fromGeolocation: Geolocation, toGeolocation: Geolocation): Promise<Transform> => {
    const response = await fetch("/api/geolocation/transform-to-geolocation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromGeolocation, toGeolocation, fromUnitOverride: "METER" }),
    })
    if (!response.ok) {
      throw new Error("Error transforming between geolocations")
    }
    const responseBody = await response.json()
    return responseBody.transform
  },
}

function isSiteDesignModel(model: ModelResponse): boolean {
  return model.authoringEngine === "SITE_DESIGN"
}

function isContextualDataModel(model: ModelResponse): boolean {
  return model.authoringEngine === CONTEXTUAL_DATA_AUTHORING_ENGINE
}

// TODO: Reintroduce a way to identify terrain models

// function hasRepresentationWithPurposeTerrain(model: ModelResponse): boolean {
//   const representations = model.representations || []
//   // TODO: Is 'purpose' the right way to identify terrain?
//   return representations.some((representation) => representation.purpose === "TERRAIN")
// }

// function isContextualTerrainModel(model: ModelResponse): boolean {
//   return isContextualDataModel(model) && hasRepresentationWithPurposeTerrain(model)
// }

export async function getRefPointFromScenarioModels(
  scenario: GetScenarioResponse,
): Promise<GeographicPoint3D | undefined> {
  const modelsWithGeolocation = scenario.models.flatMap((model) => {
    const geolocation = model.geolocation
    if (geolocation != null) {
      return [{ ...model, geolocation }]
    }
    return []
  })
  const geolocationInfos = await GeolocationBackendApis.geolocationInfo(
    modelsWithGeolocation.map((model) => model.geolocation),
  )
  const modelsWithGeolocationInfo = modelsWithGeolocation.map((model, index) => ({
    model,
    geolocationInfo: geolocationInfos[index],
  }))

  // First, try to find an existing Site Design model in the scenario with a valid ref point
  const siteDesignModel = modelsWithGeolocationInfo.find((x) => isSiteDesignModel(x.model))
  if (siteDesignModel?.geolocationInfo.refPointWgs84) {
    return siteDesignModel.geolocationInfo.refPointWgs84
  }

  // Next, look for any contextual data model in the scenario with a valid ref point
  const contextualDataModel = modelsWithGeolocationInfo.find((x) => isContextualDataModel(x.model))
  if (contextualDataModel?.geolocationInfo.refPointWgs84) {
    return contextualDataModel.geolocationInfo.refPointWgs84
  }

  // Next, look for ANY model with a valid ref point in the scenario
  const firstModelWithGeolocationInfo = modelsWithGeolocationInfo[0]
  if (firstModelWithGeolocationInfo?.geolocationInfo.refPointWgs84) {
    return firstModelWithGeolocationInfo.geolocationInfo.refPointWgs84
  }

  // If no model with a valid ref point is found, return undefined
  return undefined
}

export async function getGeolocationForSiteDesignSpaceModel(refPoint: GeographicPoint3D): Promise<Geolocation> {
  return await GeolocationBackendApis.refPointToGeolocation(refPoint)
}

export async function getProjectGeolocationFromRefPoint(refPoint: GeographicPoint3D): Promise<ProjectGeoLocation> {
  const { srid, point } = await GeolocationBackendApis.wgs84ToUtm(refPoint.latitude, refPoint.longitude)
  const projString = "" // TODO: Populate this. Only used for extension API, otherwise not used
  return { srid, point, projString }
}

export async function getGeolocationTransform(
  fromGeolocation: Geolocation,
  toGeolocation: Geolocation,
): Promise<Transform> {
  return await GeolocationBackendApis.transformToGeolocation(fromGeolocation, toGeolocation)
}
