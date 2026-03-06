import type { Feature, LineString, Polygon } from "geojson"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { categoryToDefaultLineWidth } from "src/lib/three/Shape/shapeUtils"
import { BuiltInSurfaceFunctions, type Surface, type SurfaceFunction } from "src/integrations/area-stats/surface"
import type { FormaElement } from "forma-elements"
import { parseUrn } from "src/lib/element/urn"
import { Vector2 } from "three"
import PolygonBoolean from "polygon-clipping"
import ArrayUtils from "src/lib/array"

export type FormaElementWithSurfaceFunctionsInternalProperty = FormaElement & {
  properties: {
    surfaceFunctions_INTERNAL: { surfaceFunctionId: string }[]
  }
}

export function hasSurfaceFunctionsInternalProperty(
  element: FormaElement,
): element is FormaElementWithSurfaceFunctionsInternalProperty {
  const surfaceFunctions = element.properties?.surfaceFunctions_INTERNAL
  if (!surfaceFunctions || !Array.isArray(surfaceFunctions)) return false
  if (surfaceFunctions.length == 0) return false
  for (const val of surfaceFunctions) {
    if (typeof val !== "object" || !val || !("surfaceFunctionId" in val)) {
      return false
    }
  }
  return true
}

export function basicElementSupportsSurfaceFunctions(container: ElementContainer) {
  return (
    parseUrn(container.element.urn).system === "basic" &&
    container.element.properties?.category === "generic" &&
    !container.representations.volumeMesh &&
    !!container.representations.footprint
  )
}

const basicElementCategoryToAreaStatsSurfaceFunction: Record<string, SurfaceFunction[]> = {
  building: [{ id: BuiltInSurfaceFunctions.Building }],
  vegetation: [{ id: BuiltInSurfaceFunctions.Vegetation }],
  tree_line: [{ id: BuiltInSurfaceFunctions.Vegetation }],
  tree_area: [{ id: BuiltInSurfaceFunctions.Vegetation }],
  rails: [{ id: BuiltInSurfaceFunctions.RailRoad }],
  road: [{ id: BuiltInSurfaceFunctions.Road }],
}

function surfaceFunctionsForElement(element: FormaElement): SurfaceFunction[] {
  const category = element.properties?.category
  if (!category) return []

  if (category === "generic" && hasSurfaceFunctionsInternalProperty(element)) {
    return element.properties.surfaceFunctions_INTERNAL.map(({ surfaceFunctionId }) => ({ id: surfaceFunctionId }))
  }

  return basicElementCategoryToAreaStatsSurfaceFunction[category] ?? []
}

const isPolygonFeature = (f: Feature): f is Feature<Polygon> => f.geometry.type === "Polygon"
const isLineStringFeature = (f: Feature): f is Feature<LineString> => f.geometry.type === "LineString"

type PolygonWithHoles = [number, number][][]

function getGeometryCoordinates(polygon: Polygon): PolygonWithHoles {
  return polygon.coordinates as PolygonWithHoles
}

export function getBasicElementAreaStatsSurfaces(container: ElementContainer): Surface[] {
  const footprint = container.representations.footprint
  const volumeMesh = container.representations.volumeMesh
  if (!footprint || volumeMesh) return []

  const elevation = typeof footprint.properties?.elevation === "number" ? footprint.properties?.elevation : undefined

  if (isPolygonFeature(footprint)) {
    return [
      {
        polygon: getGeometryCoordinates(footprint.geometry),
        functions: surfaceFunctionsForElement(container.element),
        horizontalProjection: elevation == null ? { type: "onGround" } : { type: "atElevation", elevation },
      },
    ]
  }

  if (isLineStringFeature(footprint)) {
    const lineWidth =
      typeof footprint.properties?.lineWidth === "number"
        ? footprint.properties.lineWidth
        : categoryToDefaultLineWidth(false, container.element.properties?.category)
    const polygon = lineStringToPolygonExpensive(footprint.geometry.coordinates as [number, number][], lineWidth)
    return [
      {
        polygon,
        functions: surfaceFunctionsForElement(container.element),
        horizontalProjection: elevation == null ? { type: "onGround" } : { type: "atElevation", elevation },
      },
    ]
  }

  return []
}

function lineStringToPolygonExpensive(lineString: [number, number][], lineWidth: number): [number, number][][] {
  const points = lineString.map(([x, y]) => new Vector2(x, y))
  const mainPolygons: PolygonBoolean.Polygon[] = ArrayUtils.sliding2(points).map(([a, b]) => {
    const ab = b.clone().sub(a).normalize()
    const perp = new Vector2(ab.y, -ab.x)
    const ll = a.clone().addScaledVector(perp, lineWidth / 2)
    const lr = a.clone().addScaledVector(perp, -lineWidth / 2)
    const ul = b.clone().addScaledVector(perp, lineWidth / 2)
    const ur = b.clone().addScaledVector(perp, -lineWidth / 2)
    const mainBlock = [lr.toArray(), ur.toArray(), ul.toArray(), ll.toArray()]
    return [mainBlock]
  })
  const samePoint = (a: [number, number], b: [number, number]): boolean => a[0] === b[0] && a[1] === b[1]
  const cornerPolyongs: PolygonBoolean.Polygon[] = ArrayUtils.sliding2(mainPolygons).flatMap(([[A], [B]]) => {
    const Aul = A[2]
    const Aur = A[1]
    const Bll = B[3]
    const Blr = B[0]
    if (samePoint(Aul, Bll) && samePoint(Aur, Blr)) return []
    const cornerBlock = [Aur, Aul, Bll, Blr]
    return [[cornerBlock]]
  })
  const polygons = [...mainPolygons, ...cornerPolyongs]
  if (polygons.length < 2) return polygons[0] ?? []
  try {
    const polygonUnion = PolygonBoolean.union(polygons[0], ...polygons.slice(1))
    return polygonUnion[0] ?? []
  } catch {
    return []
  }
}
