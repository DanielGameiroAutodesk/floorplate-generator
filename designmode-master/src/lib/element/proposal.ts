import type { Child, FormaElement } from "@spacemakerai/element-types"
import { replaceRevision } from "./urn"

export function createNewProposalFromNewBase(proposal: FormaElement, baseChild: Child, existingBaseKey: string) {
  const proposalChildrenWithoutExistingBase = proposal.children?.filter((c) => c.key !== existingBaseKey) ?? []

  const newProposalChildren = [...proposalChildrenWithoutExistingBase, baseChild]

  const newProposal: FormaElement = {
    ...proposal,
    urn: replaceRevision(proposal.urn),
    properties: {
      ...proposal.properties,
      flags: {
        [baseChild.key]: {
          base: true,
          scenario: true,
          fixed: true,
          lock: true,
        },
      },
    },
    children: newProposalChildren,
  }
  return newProposal
}
