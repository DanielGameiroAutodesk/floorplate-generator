import { objectMap } from "src/lib/objectMap"
import type { BufferGeometry, BufferGeometryJSON } from "three"
import { BufferGeometryLoader, Mesh } from "three"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { elementState } from "src/core/elements/ElementState"
import type { Proposal } from "src/core/elements/Proposal"

export type FixtureData = {
  rootUrn: Urn
  elements: Record<Urn, FormaElement>
  geometries: Record<Urn, BufferGeometry>
  meshTerrain?: Mesh
}

type SerializedFixtureDataShape = {
  rootUrn: Urn
  elements: Record<string, FormaElement>
  // Each geometry is placed in an array with one entry for backwards compatibility
  // for previously persisted fixture data.
  geometries: Record<string, BufferGeometryJSON[]>
  meshTerrain: BufferGeometryJSON | undefined
}

export function stringifyFixtureData(data: FixtureData): string {
  const json = {
    rootUrn: data.rootUrn,
    elements: data.elements,
    geometries: objectMap(data.geometries, (g) => [g.toJSON()]),
    meshTerrain: data.meshTerrain?.geometry.toJSON(),
  } satisfies SerializedFixtureDataShape

  return JSON.stringify(json)
}

const loader = new BufferGeometryLoader()

export function parseFixtureData(data: any): FixtureData {
  const json = JSON.parse(data) as SerializedFixtureDataShape
  return {
    rootUrn: json.rootUrn,
    elements: json.elements,
    geometries: objectMap(json.geometries, (geometries: any[]) =>
      geometries.length === 1 ? loader.parse(geometries[0]) : undefined,
    ),
    meshTerrain: json.meshTerrain ? new Mesh(loader.parse(json.meshTerrain)) : undefined,
  }
}

function getGeometries(proposal: Proposal) {
  const result: Record<Urn, BufferGeometry> = {}
  for (const [urn, elementC] of proposal.snapshot.elements) {
    const geo = elementC.representations.volumeMesh
    if (geo) result[urn] = geo
  }
  return result
}

export function logFixtureData(ignoreTerrain: boolean) {
  const proposal = elementState.currentProposalSignal.peek()
  const rootUrn = proposal.urn
  const elements = proposal.snapshot.getFormaElementLookup().toRecord()
  const geometries = getGeometries(proposal)
  const meshTerrain = ignoreTerrain ? undefined : proposal.terrain?.mesh

  console.log(
    stringifyFixtureData({
      rootUrn,
      elements,
      geometries,
      meshTerrain,
    }),
  )
}
