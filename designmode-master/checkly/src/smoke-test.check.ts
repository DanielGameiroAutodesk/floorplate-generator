import { BrowserCheck, Frequency } from "checkly/constructs"
import { targets } from "./core"

for (const target of targets) {
  new BrowserCheck(`smoke-test-${target.logicalIdPart}`, {
    ...target.checkProps,
    name: `Smoke test (${target.title})`,
    frequency: Frequency.EVERY_10M,
    code: {
      entrypoint: "./smoke-test.spec.ts",
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
  })
}
