import type { Urn } from "forma-elements"
import { fetchLibraryItems, Status, type LibraryItem } from "src/integrations/library/api"
import { create1kmPolygonUTM } from "./polygonUtils"
import { orderTerrain } from "./orderTerrain"
import { getProjectGeolocationFromRefPoint } from "src/integrations/spaces/geolocation"

type Geolocation = [number, number] // [lat, lng]

/**
 * Polls library API until terrain order completes
 * @param orderId - The order ID returned from orderTerrain()
 * @param projectId - The project/auth context ID
 * @returns The terrain URN when order succeeds
 * @throws Error if order fails or times out
 */
async function waitForTerrainOrder(orderId: string, projectId: string): Promise<Urn> {
  const maxAttempts = 60 // 60 attempts × 2s = 2 minute timeout
  const pollInterval = 2000 // 2 seconds

  console.log(`[Terrain] Polling for order ${orderId}, max wait: ${(maxAttempts * pollInterval) / 1000}s`)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const libraryItems = await fetchLibraryItems(projectId)

    // Find the library item by matching properties.orderId with our order ID
    const libraryItem = libraryItems.find((item: LibraryItem) => item.properties?.orderId === orderId)

    if (!libraryItem) {
      throw new Error(`Terrain order ${orderId} not found in library`)
    }

    if (libraryItem.status === Status.SUCCESS) {
      console.log(`[Terrain] Order completed successfully! URN: ${libraryItem.urn}`)
      return libraryItem.urn
    }

    if (libraryItem.status === Status.FAILED) {
      throw new Error(`Terrain order ${orderId} failed`)
    }

    // Status is PENDING, wait and try again
    if (attempt % 5 === 0) {
      // Log every 10 seconds
      console.log(`[Terrain] Still waiting... (attempt ${attempt + 1}/${maxAttempts}, status: ${libraryItem.status})`)
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  throw new Error(`Terrain order ${orderId} timed out after 2 minutes`)
}

/**
 * Orders terrain for a given geolocation and waits for it to complete
 * @param geoLocation - The location as [lat, lng] in WGS84
 * @param projectId - The project ID
 * @param countryCode - ISO country code
 * @returns The terrain URN when order completes
 */
export async function orderAndWaitForTerrain(
  geoLocation: Geolocation,
  projectId: string,
  countryCode: string,
): Promise<Urn> {
  const [lat, lng] = geoLocation
  console.log(`[Terrain] Converting WGS84 coordinates [${lat}, ${lng}] to UTM`)

  // Convert WGS84 to UTM coordinates
  const { srid, point } = await getProjectGeolocationFromRefPoint({
    latitude: lat,
    longitude: lng,
  })
  const [easting, northing] = point

  console.log(
    `[Terrain] UTM conversion complete - SRID: ${srid}, Point: [${easting.toFixed(2)}, ${northing.toFixed(2)}]`,
  )

  // Create 1km x 1km polygon in UTM coordinates
  const polygon = create1kmPolygonUTM(easting, northing)

  console.log(`[Terrain] Ordering terrain with provider: flat-terrain, SRID: ${srid}, country: ${countryCode}`)
  const terrainOrder = await orderTerrain(polygon, srid, "flat-terrain", projectId, countryCode, point)

  console.log(`[Terrain] Order created with ID: ${terrainOrder.id}`)
  const terrainUrn = await waitForTerrainOrder(terrainOrder.id, projectId)

  return terrainUrn
}
