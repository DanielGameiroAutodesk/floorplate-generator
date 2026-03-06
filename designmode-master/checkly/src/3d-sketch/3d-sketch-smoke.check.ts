import { BrowserCheck, Frequency } from "checkly/constructs"
import { targets } from "./3d-sketch-core"

for (const target of targets) {
  new BrowserCheck(`3d-sketch-smoke-${target.logicalIdPart}`, {
    ...target.checkProps,
    name: `3d sketch smoke (${target.title})`,
    frequency: Frequency.EVERY_10M,
    code: {
      entrypoint: "./3d-sketch-smoke.spec.ts",
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
