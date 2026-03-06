import { defineConfig } from "checkly"

// See https://www.checklyhq.com/docs/cli/project-structure/

const config = defineConfig({
  projectName: "Designmode",
  logicalId: "designmode",
  repoUrl: "https://github.com/spacemakerai/designmode",
  checks: {
    checkMatch: "src/**/*.check.ts",
  },
  cli: {
    runLocation: "eu-west-1",
  },
})

export default config
