/**
 * Standalone Terrain Ordering Utility
 *
 * This file contains all the types and functions needed to order terrain data
 * from the Atlas API. It's designed to be portable to other projects.
 *
 * Usage:
 * ```typescript
 * import { orderTerrain, exampleData } from './orderTerrain';
 *
 * const result = await orderTerrain(
 *   exampleData.nyc.polygon,
 *   exampleData.nyc.srid,
 *   exampleData.nyc.provider_id,
 *   'your-project-id',
 *   exampleData.nyc.country_code,
 *   exampleData.nyc.refPoint
 * );
 * ```
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Order context determines which providers are available
 * - PROD: Production-ready providers only
 * - ALL: All providers including experimental ones
 */
export enum OrderContext {
  PROD = "prod",
  ALL = "all",
}

/**
 * Optional configuration for terrain orders
 */
export type OrderOptions = {
  /** Reference point for the order [longitude, latitude] */
  ref_point?: [number, number]
}

/**
 * Complete specification for a terrain order
 */
export type OrderSpec = {
  /** Closed polygon defining the area (first point must equal last point) */
  polygon?: number[][]
  /** Spatial Reference System Identifier (e.g., 4326 for WGS84, 32633 for UTM) */
  srid: number
  /** Provider identifier (e.g., "esri", "flat-terrain", "aster-terrain-provider") */
  provider_id: string
  /** Context for the order (typically PROD) */
  order_context: OrderContext
  /** Optional order configuration */
  order_options?: OrderOptions
  /** ISO country code (e.g., "US", "SE", "GB") */
  country_code: string
}

/**
 * Result returned after successfully creating an order
 */
export type OrderResult = {
  /** Provider name/identifier */
  name: string
  /** Unique order ID */
  id: string
  /** Origin/source of the data */
  origin: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a closed polygon from bounding box coordinates
 *
 * A closed polygon requires 5 coordinates where the first and last points are identical.
 * This function takes min/max coordinates and creates the required polygon format.
 *
 * @param minLng - Minimum longitude
 * @param minLat - Minimum latitude
 * @param maxLng - Maximum longitude
 * @param maxLat - Maximum latitude
 * @returns Array of [lng, lat] coordinate pairs forming a closed polygon
 *
 * @example
 * const polygon = createPolygonFromBounds(-74.0, 40.7, -73.9, 40.8);
 * // Returns: [[-74.0, 40.7], [-73.9, 40.7], [-73.9, 40.8], [-74.0, 40.8], [-74.0, 40.7]]
 */
export function createPolygonFromBounds(minLng: number, minLat: number, maxLng: number, maxLat: number): number[][] {
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat], // Close the polygon
  ]
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Orders terrain data from the Atlas API
 *
 * This function creates a terrain order for a specified area. The order is processed
 * asynchronously by the Atlas service, and you'll need to poll the order status to
 * know when it's complete.
 *
 * @param polygon - Closed polygon defining the area (first point = last point, 5 coordinates)
 * @param srid - Spatial Reference System ID (e.g., 4326 for WGS84)
 * @param provider_id - Provider identifier (e.g., "esri", "flat-terrain")
 * @param project_id - Your Forma project ID
 * @param country_code - ISO country code (e.g., "US", "SE")
 * @param refPoint - Optional reference point [longitude, latitude]
 * @returns Promise resolving to order result with order ID
 *
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * const polygon = createPolygonFromBounds(-74.0, 40.7, -73.9, 40.8);
 * const result = await orderTerrain(
 *   polygon,
 *   4326,
 *   "esri",
 *   "my-project-id",
 *   "US",
 *   [-73.95, 40.75]
 * );
 * console.log(`Order created: ${result.id}`);
 * ```
 */
export async function orderTerrain(
  polygon: number[][],
  srid: number,
  provider_id: string,
  project_id: string,
  country_code: string,
  refPoint?: [number, number],
): Promise<OrderResult> {
  const body: OrderSpec = {
    polygon,
    srid,
    provider_id,
    order_context: OrderContext.PROD,
    order_options: refPoint ? { ref_point: refPoint } : undefined,
    country_code,
  }

  console.log(
    `[orderTerrain] Submitting order to Atlas API - Provider: ${provider_id}, SRID: ${srid}, Country: ${country_code}`,
  )
  console.log(`[orderTerrain] Polygon:`, polygon)

  try {
    const response = await fetch(`/api/atlas/orders?projectId=${project_id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.error(`[orderTerrain] Request failed: ${response.status} ${response.statusText}`)
      throw new Error(`Terrain order failed: ${response.status} ${response.statusText}`)
    }

    const result: OrderResult = await response.json()
    console.log(`[orderTerrain] Order created successfully:`, result)

    return {
      name: provider_id,
      id: result.id,
      origin: result.origin,
    }
  } catch (error) {
    console.error(`[orderTerrain] Error:`, error)
    throw error
  }
}

// ============================================================================
// Example Data
// ============================================================================

/**
 * Example datasets for different regions and configurations
 *
 * These examples demonstrate various combinations of:
 * - Different geographic locations
 * - Different SRIDs (coordinate systems)
 * - Different terrain providers
 * - With and without reference points
 */
export const exampleData = {
  /**
   * New York City area using WGS84 (SRID 4326)
   * Provider: ESRI (high-quality global terrain)
   */
  nyc: {
    polygon: createPolygonFromBounds(-74.01, 40.7, -73.99, 40.72),
    srid: 4326,
    provider_id: "esri",
    country_code: "US",
    refPoint: [-74.0, 40.71] as [number, number],
  },

  /**
   * Stockholm area using UTM Zone 33N (SRID 32633)
   * Provider: EU-DEM (European Digital Elevation Model)
   */
  stockholm: {
    polygon: createPolygonFromBounds(18.05, 59.32, 18.07, 59.34),
    srid: 32633,
    provider_id: "eudem-terrain-provider",
    country_code: "SE",
    refPoint: [18.06, 59.33] as [number, number],
  },

  /**
   * London area using UTM Zone 30N (SRID 32630)
   * Provider: ASTER Global Digital Elevation Model
   */
  london: {
    polygon: createPolygonFromBounds(-0.13, 51.5, -0.11, 51.52),
    srid: 32630,
    provider_id: "aster-terrain-provider",
    country_code: "GB",
    refPoint: [-0.12, 51.51] as [number, number],
  },

  /**
   * Berlin area using UTM Zone 33N (SRID 32633)
   * Provider: Flat terrain (no elevation data, useful for testing or flat areas)
   */
  berlinFlat: {
    polygon: createPolygonFromBounds(13.37, 52.51, 13.39, 52.53),
    srid: 32633,
    provider_id: "flat-terrain",
    country_code: "DE",
    refPoint: [13.38, 52.52] as [number, number],
  },

  /**
   * Generic example with no reference point
   * Provider: ESRI
   */
  generic: {
    polygon: createPolygonFromBounds(-122.5, 37.7, -122.3, 37.9),
    srid: 4326,
    provider_id: "esri",
    country_code: "US",
    refPoint: undefined,
  },
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example usage patterns:
 *
 * 1. Basic usage with example data:
 * ```typescript
 * import { orderTerrain, exampleData } from './orderTerrain';
 *
 * const result = await orderTerrain(
 *   exampleData.nyc.polygon,
 *   exampleData.nyc.srid,
 *   exampleData.nyc.provider_id,
 *   'my-project-id',
 *   exampleData.nyc.country_code,
 *   exampleData.nyc.refPoint
 * );
 * ```
 *
 * 2. Custom polygon:
 * ```typescript
 * import { orderTerrain, createPolygonFromBounds } from './orderTerrain';
 *
 * const polygon = createPolygonFromBounds(-74.0, 40.7, -73.9, 40.8);
 * const result = await orderTerrain(
 *   polygon,
 *   4326,
 *   "esri",
 *   'my-project-id',
 *   "US"
 * );
 * ```
 *
 * 3. Without reference point:
 * ```typescript
 * import { orderTerrain, exampleData } from './orderTerrain';
 *
 * const result = await orderTerrain(
 *   exampleData.generic.polygon,
 *   exampleData.generic.srid,
 *   exampleData.generic.provider_id,
 *   'my-project-id',
 *   exampleData.generic.country_code
 * );
 * ```
 */

// ============================================================================
// Provider Reference
// ============================================================================

/**
 * Common terrain providers:
 *
 * - "esri": High-quality global terrain from ESRI
 * - "flat-terrain": Flat surface with no elevation (useful for testing)
 * - "aster-terrain-provider": ASTER Global Digital Elevation Model
 * - "eudem-terrain-provider": European Digital Elevation Model (EU only)
 *
 * Provider availability depends on:
 * - Geographic location (country_code)
 * - Bounding box coordinates (polygon)
 * - Order context (PROD vs ALL)
 */

// ============================================================================
// SRID Reference
// ============================================================================

/**
 * Common Spatial Reference System Identifiers:
 *
 * - 4326: WGS84 (global, lat/lng coordinates)
 * - 32633: UTM Zone 33N (Central Europe: Norway, Sweden, Germany)
 * - 32634: UTM Zone 34N (Eastern Europe: Finland, Baltic states)
 * - 32635: UTM Zone 35N (Eastern Europe: Russia, Ukraine)
 * - 32636: UTM Zone 36N (Middle East: Turkey, Cyprus)
 * - 32637: UTM Zone 37N (Middle East: Syria, Lebanon)
 * - 32638: UTM Zone 38N (Middle East: Iraq, Iran)
 * - 32630: UTM Zone 30N (Western Europe: UK, Spain, France)
 * - 32631: UTM Zone 31N (Western/Central Europe: France, Italy)
 * - 32632: UTM Zone 32N (Central Europe: Germany, Austria, Denmark)
 *
 * UTM zones are typically used for regional projects with higher accuracy.
 */
