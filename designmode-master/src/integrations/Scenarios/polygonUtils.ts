/**
 * Creates a 1km x 1km polygon in WGS84 coordinates centered on a point
 * @param centerLat - Center latitude
 * @param centerLng - Center longitude
 * @returns Closed polygon array [lng, lat] (5 points, first equals last)
 */
export function create1kmPolygonWGS84(centerLat: number, centerLng: number): number[][] {
  // 1km ≈ 0.009 degrees latitude (fairly constant)
  const latOffset = 0.009 / 2 // ±500m

  // Longitude varies by latitude: offset = degrees / cos(lat)
  const lngOffset = 0.009 / 2 / Math.cos((centerLat * Math.PI) / 180)

  const minLat = centerLat - latOffset
  const maxLat = centerLat + latOffset
  const minLng = centerLng - lngOffset
  const maxLng = centerLng + lngOffset

  const polygon = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat], // Close the polygon
  ]

  console.log(
    `[Polygon] Created 1km² polygon: lat [${minLat.toFixed(6)}, ${maxLat.toFixed(6)}], lng [${minLng.toFixed(6)}, ${maxLng.toFixed(6)}]`,
  )

  return polygon
}

/**
 * Creates a 1km x 1km polygon in UTM coordinates centered on a point
 * @param centerEasting - Center easting (X coordinate in meters)
 * @param centerNorthing - Center northing (Y coordinate in meters)
 * @returns Closed polygon array [easting, northing] (5 points, first equals last)
 */
export function create1kmPolygonUTM(centerEasting: number, centerNorthing: number): number[][] {
  // In UTM, coordinates are in meters, so 1km = 1000m
  const offset = 500 // ±500m for 1km total

  const minEasting = centerEasting - offset
  const maxEasting = centerEasting + offset
  const minNorthing = centerNorthing - offset
  const maxNorthing = centerNorthing + offset

  const polygon = [
    [minEasting, minNorthing],
    [maxEasting, minNorthing],
    [maxEasting, maxNorthing],
    [minEasting, maxNorthing],
    [minEasting, minNorthing], // Close the polygon
  ]

  console.log(
    `[Polygon] Created 1km² UTM polygon: easting [${minEasting.toFixed(2)}, ${maxEasting.toFixed(2)}], northing [${minNorthing.toFixed(2)}, ${maxNorthing.toFixed(2)}]`,
  )

  return polygon
}
