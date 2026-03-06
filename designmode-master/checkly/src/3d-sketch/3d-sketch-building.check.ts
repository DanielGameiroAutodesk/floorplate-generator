import { BrowserCheck, Frequency, RetryStrategyBuilder } from "checkly/constructs"
import { targetsSlackOnly } from "./3d-sketch-core"

for (const target of targetsSlackOnly) {
  new BrowserCheck(`3d-sketch-building-${target.logicalIdPart}`, {
    ...target.checkProps,
    name: `3d sketch building (${target.title})`,
    frequency: Frequency.EVERY_3H,
    // No retries since proposal is duplicated
    retryStrategy: RetryStrategyBuilder.noRetries(),
    code: {
      entrypoint: "./3d-sketch-building.spec.ts",
    },
    environmentVariables: [
      { key: "PROJECT_ID", value: target.projectId },
      {
        key: "PROPOSAL_ID",
        value: target.proposalId,
      },
      {
        key: "APP_AUTH_BASE_URL",
        value: target.baseUrl,
      },
      {
        key: "APP_BASE_URL",
        value: target.baseUrl,
      },
    ],
    // Opt out of CI checking on this since the check mutates the proposal and cannot be run concurrently.
    tags: target.checkProps.tags.filter((it) => it !== "ci-check"),
  })
}
