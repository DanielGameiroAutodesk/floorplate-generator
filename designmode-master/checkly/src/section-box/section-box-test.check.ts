import { BrowserCheck, Frequency } from "checkly/constructs"
import { targets } from "./section-box-core"

for (const target of targets) {
  new BrowserCheck(`section-box-test-${target.logicalIdPart}`, {
    ...target.checkProps,
    name: `Section box (${target.title})`,
    frequency: Frequency.EVERY_10M,
    code: {
      entrypoint: "./section-box-test.spec.ts",
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
