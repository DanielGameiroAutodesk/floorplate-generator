import type { BufferGeometry } from "three"
import type { TerrainShape } from "src/lib/element/types"
import type { Feature } from "geojson"
import { objectKeys } from "src/lib/record"
import type { TerrainTexture } from "src/core/elements-loading/loading"
import { mergeMaps } from "src/lib/map"
import type { Urn } from "forma-elements"
// eslint-disable-next-line import/no-restricted-paths
import type { Building3d } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingTypes"

export function representationsByUrnToKnownRepresentations(
  representations: RepresentationsByUrn,
  urn: Urn,
): KnownRepresentations {
  return {
    volumeMesh: representations.volumeMesh.get(urn),
    footprint: representations.footprint.get(urn),
    terrainShape: representations.terrainShape.get(urn),
    terrainTexture: representations.terrainTexture.get(urn),
    buildingFloors3DSketch_UNSTABLE: representations.buildingFloors3DSketch_UNSTABLE.get(urn),
    volumeMeshWithTransparencySupport: representations.volumeMeshWithTransparencySupport?.get(urn),
    outlinesGeometry: representations.outlinesGeometry?.get(urn),
  }
}

export function knownRepresentationsToRepresentationsByUrn(
  representations: KnownRepresentations,
  urn: Urn,
): RepresentationsByUrn {
  const result: RepresentationsByUrn = {
    footprint: new Map(),
    volumeMesh: new Map(),
    terrainShape: new Map(),
    terrainTexture: new Map(),
    buildingFloors3DSketch_UNSTABLE: new Map(),
    volumeMeshWithTransparencySupport: new Map(),
    outlinesGeometry: new Map(),
  }
  representationsByUrnAddEntry(result, urn, representations)
  return result
}

export type RepresentationsByUrn = {
  [K in keyof KnownRepresentations]: Map<Urn, NonNullable<KnownRepresentations[K]>>
}

export function mergeRepresentationsByUrn(...items: RepresentationsByUrn[]): RepresentationsByUrn {
  return {
    footprint: mergeMaps(...items.map((item) => item.footprint)),
    volumeMesh: mergeMaps(...items.map((item) => item.volumeMesh)),
    terrainShape: mergeMaps(...items.map((item) => item.terrainShape)),
    terrainTexture: mergeMaps(...items.map((item) => item.terrainTexture)),
    buildingFloors3DSketch_UNSTABLE: mergeMaps(...items.map((item) => item.buildingFloors3DSketch_UNSTABLE)),
  }
}

export function representationsByUrnAddEntry(
  representationsByUrn: RepresentationsByUrn,
  urn: Urn,
  representations: KnownRepresentations,
): void {
  for (const key of objectKeys(representations)) {
    if (representations[key] != null) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      representationsByUrn[key]?.set(urn, representations[key] as any)
    }
  }
}

export type KnownRepresentations = {
  volumeMesh: BufferGeometry | undefined
  terrainShape: TerrainShape | undefined
  footprint: Feature | undefined
  terrainTexture: TerrainTexture | undefined
  buildingFloors3DSketch_UNSTABLE: Building3d | undefined
  volumeMeshWithTransparencySupport?: {
    opaqueGeometry: BufferGeometry
    transparentGeometry: BufferGeometry
  }
  // Optional outlines geometry loaded from GLTF
  outlinesGeometry?: BufferGeometry
}

export type KnownRepresentationsKey = keyof KnownRepresentations
export type RepresentationType<K extends KnownRepresentationsKey> = NonNullable<KnownRepresentations[K]>
