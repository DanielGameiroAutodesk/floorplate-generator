import type { FormaElement, Urn } from "forma-elements"
import type { VolumeMesh } from "src/core/volume-mesh"
import { parseUrn } from "src/lib/element/urn"

export function buildScenarioMeshMocks(
  proposalUrn: Urn,
  volumeMesh: VolumeMesh | undefined,
  rootId: string,
): { scenarioElement?: FormaElement; rootElement?: FormaElement; rootUrn?: Urn } {
  if (!volumeMesh) return {}

  const { system, authcontext, id, revision } = parseUrn(proposalUrn)
  const scenarioElementUrn =
    `urn:adsk-forma-elements:${system}:${authcontext}:${id}-scenario-element:${revision}` as Urn

  const scenarioElement: FormaElement = {
    urn: scenarioElementUrn,
    properties: { scenariosElement: "true" },
    representations: {
      volumeMesh: { type: "linked" as const, blobId: "mock-blob-id" },
    },
  }

  const rootUrn = `urn:adsk-forma-elements:${system}:${authcontext}:${id}-${rootId}:${revision}` as Urn

  const rootElement: FormaElement = {
    urn: rootUrn,
    children: [
      { urn: proposalUrn, key: "proposal" },
      { urn: scenarioElement.urn, key: "scenario" },
    ],
  }

  return { scenarioElement, rootElement, rootUrn }
}
