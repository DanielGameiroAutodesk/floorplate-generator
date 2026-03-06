import { computed, type ReadonlySignal } from "@preact/signals"
import { type BufferGeometry, Mesh, PlaneGeometry } from "three"
import { elementState } from "src/core/elements/ElementState"
import { explicitSignal } from "src/lib/signal"
import type { TerrainSamplerData } from "./terrain-types"
import { prepass, raycast } from "./2d-raytracer"
// eslint-disable-next-line import/no-restricted-paths
import { isInScenarioSignal } from "src/integrations/Scenarios/scenarioSelectors"
import { projectGeoLocationSignal } from "src/core/project/project"
import featureFlags from "src/lib/featureTogglingV2"

function calculateTerrainSamplerData(geometry: BufferGeometry): TerrainSamplerData {
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const index = geometry.index!.array as Uint32Array
  const bbox = geometry.boundingBox!
  const position = geometry.attributes.position.array as Float32Array
  return prepass(index, position, bbox)
}

const terrainFromProposalSignal: ReadonlySignal<Mesh | undefined> = computed(
  () => elementState.currentTerrainSignal.value?.mesh,
)

export const [externalTerrainSignal, setExternalTerrainSignalValue] = explicitSignal<Mesh | undefined>(undefined)

const flatTerrainSignal: ReadonlySignal<Mesh> = computed(() => new Mesh(new PlaneGeometry(1000, 1000)))

type ActiveTerrain = { mesh: Mesh; source: "proposal" | "external" | "flat" }

const activeTerrainSignal: ReadonlySignal<ActiveTerrain> = computed(() => {
  if (!isInScenarioSignal.value) {
    if (!terrainFromProposalSignal.value) {
      throw new Error("No terrain element in proposal")
    }
    return { mesh: terrainFromProposalSignal.value, source: "proposal" }
  }

  // If we are in a scenario, and we have an external terrain signal use it
  if (isInScenarioSignal.value && externalTerrainSignal.value) {
    return { mesh: externalTerrainSignal.value, source: "external" }
  }

  // Always use the proposal terrain if it exists, otherwise external terrain. Flat as fallback
  if (terrainFromProposalSignal.value) {
    return { mesh: terrainFromProposalSignal.value, source: "proposal" }
  }

  if (externalTerrainSignal.value) {
    return { mesh: externalTerrainSignal.value, source: "external" }
  }

  return { mesh: flatTerrainSignal.value, source: "flat" }
})

export type NewTerrainState = {
  mesh: Mesh
  source: "proposal" | "external" | "flat"
  terrainSamplerData: TerrainSamplerData
  elevationAt: (x: number, y: number) => number
}

export const terrainSignal: ReadonlySignal<NewTerrainState> = computed(() => {
  const { mesh, source } = activeTerrainSignal.value
  const terrainSamplerData = calculateTerrainSamplerData(mesh.geometry)
  const elevationAt = (x: number, y: number) => raycast(x, y, terrainSamplerData)

  return { mesh, source, terrainSamplerData, elevationAt }
})

export const terrainBboxSignal = computed<[[number, number], [number, number]] | undefined>(() => {
  if (!featureFlags.scenarios.value) return undefined

  const geoLocation = projectGeoLocationSignal.value
  if (!geoLocation) return undefined

  const terrain = terrainSignal.value
  const geometry = terrain.mesh.geometry
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const bb = geometry.boundingBox
  if (!bb) return undefined

  const [rx, ry] = geoLocation.point
  return [
    [bb.min.x + rx, bb.min.y + ry],
    [bb.max.x + rx, bb.max.y + ry],
  ]
})
