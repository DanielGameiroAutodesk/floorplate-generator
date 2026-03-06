import type { FormaElement } from "forma-elements"
import { parseUrn } from "src/lib/element/urn"
import type { ProposalElement } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/types"
import { request } from "src/integrations/Scenarios/proposal-list/proposal-list-component/utils/http"

export async function fetchScenarios(projectId: string) {
  const res = await request(`/api/group/elements/components?tag=scenario&authcontext=${projectId}`)
  return res?.json() || []
}

export function getScenario(proposal: ProposalElement, scenarios: FormaElement[]) {
  const child = proposal.children?.filter(
    ({ key }) =>
      Object.entries(proposal.properties?.flags || {})
        .filter(([, flag]) => flag.scenario)
        .map(([key]) => key)[0] === key,
  )[0]
  if (child) {
    return scenarios.filter(({ urn }) => parseUrn(urn).id === parseUrn(child.urn).id)[0]
  }
}
