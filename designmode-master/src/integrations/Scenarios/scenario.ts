import {
  type GeographicPoint3D,
  type Geolocation,
  getScenario,
  type GetScenarioResponse,
  type ModelResponse,
  type Representation,
  type RepresentationViewable3D,
  type TerrainSurfaceRepresentation,
} from "src/integrations/spaces/spaceClient/spaceClientv4"
import {
  getGeolocationForSiteDesignSpaceModel,
  getGeolocationTransform,
  getProjectGeolocationFromRefPoint,
  getRefPointFromScenarioModels,
} from "src/integrations/spaces/geolocation"
import { type BufferGeometry, Matrix4, Mesh } from "three"
import { mergeScenarioGeometries } from "./internal/mergeScenarioGeometries"
import { setExternalTerrainSignalValue } from "src/core/terrain/new-terrain-state"
import { setProjectGeoLocationSignalValue } from "src/core/project/project"
import { getTranslator } from "src/i18n"
import { explicitSignal } from "src/lib/signal"
import { proposalScenarioInfoSignal } from "./scenarioSelectors"
import { loadScenarioRenderables } from "./loadScenarioRenderables"
import { downloadTerrainFromScenario } from "./scenarioTerrain"

type ScenarioState = {
  scenario: GetScenarioResponse
  refPoint: GeographicPoint3D | undefined
  siteDesignGeolocation: Geolocation | undefined
}

export const [scenarioStateSignal, setScenarioStateSignalValue] = explicitSignal<ScenarioState | undefined>(undefined)
export const [scenarioRenderablesSignal, setScenarioRenderablesSignal] = explicitSignal<BufferGeometry[] | undefined>(
  undefined,
)

export type ModelRepresentation<T extends Representation> = {
  model: ModelResponse
  representation: T
}

export const SITE_DESIGN_AUTHORING_ENGINE = "SITE_DESIGN"
export const CONTEXTUAL_DATA_AUTHORING_ENGINE = "CONTEXTUAL_SERVICE"
export const BUILDING_DESIGN_AUTHORING_ENGINE = "BUILDING_DESIGN"
export const SITE_DESIGN_SCENARIO_BASE_MODEL_NAME = "Forma Design model"
export const SITE_DESIGN_SCENARIO_TERRAIN_MODEL_NAME = `${SITE_DESIGN_SCENARIO_BASE_MODEL_NAME} - Terrain`

export const INTERNAL_MODEL_REFERENCE_SITE_DESIGN = "SITE_DESIGN"
export const INTERNAL_MODEL_REFERENCE_SITE_DESIGN_TERRAIN = "SITE_DESIGN_TERRAIN"

const TERRAIN_REPRESENTATION_NAME = "terrainRepresentation"

/**
 * Extract terrain representations from a scenario
 */
export const getTerrainFromScenario = (
  scenario: GetScenarioResponse,
): ModelRepresentation<TerrainSurfaceRepresentation | RepresentationViewable3D>[] => {
  const terrainRepresentations: ModelRepresentation<TerrainSurfaceRepresentation | RepresentationViewable3D>[] = []

  // Go through all models and collect terrain representations
  scenario.models
    .filter((model) => model.authoringEngine !== SITE_DESIGN_AUTHORING_ENGINE)
    .forEach((model: ModelResponse) => {
      const representations = model.representations || []
      representations.forEach((representation) => {
        if (representation.typeid === "autodesk.aec:component.terrainSurface-1.0.0") {
          terrainRepresentations.push({ model, representation })
        } else if (
          // Keeping this to support legacy models, but should be possible to remove soon
          representation.name === TERRAIN_REPRESENTATION_NAME &&
          representation.typeid === "autodesk.aec.forma:representation-viewable-3d-1.0.0"
        ) {
          terrainRepresentations.push({ model, representation })
        }
      })
    })

  return terrainRepresentations
}

/**
 * Get all the viewables from a scenario that are not terrain
 */
export const getNonTerrainViewablesFromScenario = (
  scenario: GetScenarioResponse,
): ModelRepresentation<RepresentationViewable3D>[] => {
  const nonTerrainViewables: ModelRepresentation<RepresentationViewable3D>[] = []

  // Go through all models and collect viewables that are not terrain
  scenario.models.forEach((model: ModelResponse) => {
    if (model.authoringEngine === SITE_DESIGN_AUTHORING_ENGINE) {
      return
    }
    const representations = model.representations || []
    representations.forEach((representation) => {
      if (
        representation.name !== TERRAIN_REPRESENTATION_NAME &&
        representation.typeid === "autodesk.aec.forma:representation-viewable-3d-1.0.0"
      ) {
        nonTerrainViewables.push({ model, representation })
      }
    })
  })

  return nonTerrainViewables
}

async function loadTerrainSurface(terrainSurface: TerrainSurfaceRepresentation): Promise<BufferGeometry | null> {
  const geometries = await Promise.all(terrainSurface.tiles.map((tile) => downloadTerrainFromScenario(tile.location)))
  const geometriesWithoutNull = geometries.filter((g) => g !== null) // shouldn't be necessary, but wanted to satisfy
  geometriesWithoutNull.forEach((geometry, index) => {
    const tile = terrainSurface.tiles[index]
    const translateX = terrainSurface.gridDimensions.x * (tile.gridIndexX + 0.5) + terrainSurface.gridOffset.x
    const translateY = terrainSurface.gridDimensions.y * (0.5 + tile.gridIndexY) + terrainSurface.gridOffset.y
    const translateZ = tile.elevationOffset + terrainSurface.gridOffset.z
    geometry.translate(translateX, translateY, translateZ)
  })
  if (geometries.length == 0) {
    return null
  }
  return mergeScenarioGeometries(geometriesWithoutNull, false)
}

export const loadScenario = async () => {
  const scenarioInfo = proposalScenarioInfoSignal.peek()

  if (!scenarioInfo) {
    return
  }

  const scenario = await getScenario({
    projectId: scenarioInfo.accProjectId,
    fileUrn: scenarioInfo.fileUrn,
    scenarioId: scenarioInfo.scenarioId,
  })

  // Set scenario model data early
  setScenarioStateSignalValue({
    scenario: scenario,
    refPoint: undefined,
    siteDesignGeolocation: undefined,
  })

  const refPoint = await getRefPointFromScenarioModels(scenario)
  const siteDesignGeolocation = refPoint ? await getGeolocationForSiteDesignSpaceModel(refPoint) : undefined

  const terrainModels = getTerrainFromScenario(scenario)

  const terrains = await Promise.all(
    terrainModels.map(async ({ model, representation }) => {
      const geometry =
        representation.typeid === "autodesk.aec:component.terrainSurface-1.0.0"
          ? await loadTerrainSurface(representation)
          : await downloadTerrainFromScenario(representation.url || representation.location)
      if (geometry == null) {
        return null
      }
      if (model.geolocation != null && siteDesignGeolocation != null) {
        const transform = await getGeolocationTransform(model.geolocation, siteDesignGeolocation)
        geometry.applyMatrix4(new Matrix4(...transform))
      }
      return geometry
    }),
  ).then((t) => t.filter((t) => t !== null))

  if (terrains.length > 0) {
    const terrainGeometry = mergeScenarioGeometries(terrains, false)

    if (terrainGeometry) {
      setExternalTerrainSignalValue(new Mesh(terrainGeometry))
    } else {
      console.warn("No terrain geometry found in GLB file")
    }
  }

  const [renderables] = await Promise.all([loadScenarioRenderables(scenario, siteDesignGeolocation)])
  setScenarioStateSignalValue({
    scenario,
    refPoint,
    siteDesignGeolocation,
  })
  setScenarioRenderablesSignal(renderables)

  if (refPoint) {
    const projectGeoLocation = await getProjectGeolocationFromRefPoint(refPoint)
    // eslint-disable-next-line local/restrict-internal-tag
    setProjectGeoLocationSignalValue(projectGeoLocation)
  } else {
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.errors.modelNotGeolocated),
      status: "warning",
      autoDismiss: false,
    })
  }
}
