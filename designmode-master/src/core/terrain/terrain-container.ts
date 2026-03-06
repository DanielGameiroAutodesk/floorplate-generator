import { ElementContainer } from "src/core/elements/ElementContainer"
import { createTerrainCustomData, TerrainData, type BaseTerrainData } from "src/core/elements/terrain-data"
import { createTerrainMesh, fetchRawTerrainData, fetchTerrainGeometry, type RawTerrainData } from "./terrain-download"
import type { TerrainElement } from "./terrain-types"
import type { BufferGeometry } from "three"
import { getElementsClient } from "src/core/elements-loading/loading"

export async function loadTerrainDataAndCreateElementContainer(
  terrainElement: TerrainElement,
  options?: {
    prefetchedTerrainData?: RawTerrainData
  },
): Promise<ElementContainer> {
  const terrainData = options?.prefetchedTerrainData ?? (await fetchRawTerrainData(terrainElement))

  const { mesh, mapTexture } = await createTerrainMesh(terrainData)
  const baseTerrainData = await loadBaseTerrainData(terrainElement, mesh.geometry)

  return ElementContainer.fromServerElement(
    terrainElement,
    undefined,
    undefined,
    createTerrainCustomData(
      new TerrainData(
        mesh,
        {
          terrainTexture: mapTexture,
          attributionTag: terrainData.texture?.attributionTag || "",
        },
        baseTerrainData,
      ),
    ),
  )
}

/**
 * Extract BaseTerrainData needed for editing terrain pads. If the terrain element doesn't have the
 * baseUrn property, it means this is an unedited terrain element and we can just return the current
 * geometry. However, if the terrain does have the baseUrn property, it has previously been edited
 * with pads, and we need to separately fetch the original/base terrain element and its geometry.
 */
async function loadBaseTerrainData(
  terrainElement: TerrainElement,
  terrainGeometry: BufferGeometry,
): Promise<BaseTerrainData | undefined> {
  //if (!featureFlagSignalFamily(LDFlag.TerrainPads).peek()) return

  const baseTerrainUrn = terrainElement.properties.baseUrn
  if (!baseTerrainUrn) {
    return {
      baseTerrainUrn: terrainElement.urn,
      baseTerrainGeometry: terrainGeometry.clone(),
    }
  }

  const elementsClient = getElementsClient()
  const baseTerrainElement = (await elementsClient.getElementAutoBatched(baseTerrainUrn)).element as TerrainElement
  const baseTerrainGeometry = await fetchTerrainGeometry(baseTerrainElement)
  return { baseTerrainUrn, baseTerrainGeometry }
}
