import { Vector3 } from "three"
import type { LibraryElementData } from "./library"
import { getTranslator } from "src/i18n"

/* When creating a project, you can maximum select a 2x2km tile. These Thresholds are twice the length/width to
   give some slack. Also using same value for heights/z */
export const TERRAIN_LENGTH_THRESHOLD = 2000 * 2 // 4km
const target = new Vector3()

/* Notify user (by a toast) when opening _very_ large geometries */
export default function notifyLargeScaledGeometries(libElement: LibraryElementData, isImperial: boolean) {
  // TODO: This should also deal with e.g. a large terrain shape.
  const allGeos = Array.from(libElement.state.representations.volumeMesh.values())
  const geoSizes = allGeos.map((geo) => {
    geo.boundingBox?.getSize(target)
    const { x, y, z } = target
    return { x, y, z }
  })

  const longestX = Math.max(...geoSizes.map((geoSize) => geoSize.x))
  const longestY = Math.max(...geoSizes.map((geoSize) => geoSize.y))
  const longestZ = Math.max(...geoSizes.map((geoSize) => geoSize.z))

  if (
    longestX > TERRAIN_LENGTH_THRESHOLD ||
    longestY > TERRAIN_LENGTH_THRESHOLD ||
    longestX > TERRAIN_LENGTH_THRESHOLD
  ) {
    const sizeStr = formatSize(longestX, longestY, longestZ, isImperial)
    const t = getTranslator()

    window.forma_toasts.push({
      content: t(($) => $.errors.import.largeScale, { size: sizeStr }),
      status: "warning",
      autoDismiss: false,
    })
  }
}

function formatSize(longestX: number, longestY: number, longestZ: number, isImperial: boolean): string {
  const milesConverter = 0.621371

  const longestXkm = longestX / 1000
  const longestYkm = longestY / 1000
  const longestZkm = longestZ / 1000

  if (isImperial) {
    return `${(longestXkm * milesConverter).toFixed(1)} x ${(longestYkm * milesConverter).toFixed(1)} x ${(
      longestZkm * milesConverter
    ).toFixed(1)}mi`
  }

  return `${longestXkm.toFixed(1)} x ${longestYkm.toFixed(1)} x ${longestZkm.toFixed(1)}km`
}
