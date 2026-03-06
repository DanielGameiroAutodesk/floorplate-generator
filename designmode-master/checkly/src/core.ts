import { parseTerraformOutput } from "@spacemakerai/checkly-lib"
import { getTargetByNameOrThrow } from "@spacemakerai/deploy-targets"
import type { CheckGroupProps, RuntimeCheckProps } from "checkly/constructs"
import {
  AlertEscalationBuilder,
  CheckGroupV2,
  PagerdutyAlertChannel,
  RetryStrategyBuilder,
  SlackAlertChannel,
} from "checkly/constructs"
import { resolve } from "node:path"

const terraform = parseTerraformOutput(resolve(__dirname, "../../ops/output.json"))
const pagerdutyIntegration = terraform.get<{
  account_name: string
  service_key: string
  service_name: string
}>("checkly_pagerduty_service_integration.value")

// Manually defined in Checkly account.
// https://app.checklyhq.com/alerts/settings/channels/edit/slack/163131
const slackAlertChannel = SlackAlertChannel.fromId(163131)

const pagerdutyAlertChannel = pagerdutyIntegration
  ? new PagerdutyAlertChannel("pagerduty-alert-channel", {
      account: pagerdutyIntegration.account_name,
      serviceKey: pagerdutyIntegration.service_key,
      serviceName: pagerdutyIntegration.service_name,
    })
  : undefined

const defaultTags = ["app:designmode", "repo:designmode", "checkly-cli"]

export const groupDefaults = {
  tags: defaultTags,
  locations: ["us-east-1", "eu-west-1", "ap-southeast-2"],
  alertEscalationPolicy: AlertEscalationBuilder.runBasedEscalation(2, {
    amount: 100000,
    interval: 15,
  }),
  retryStrategy: RetryStrategyBuilder.linearStrategy({
    baseBackoffSeconds: 10,
    maxRetries: 5,
    sameRegion: false,
  }),
} satisfies Partial<CheckGroupProps>

const stgGroup = new CheckGroupV2("check-group-stg", {
  ...groupDefaults,
  name: `designmode (stg)`,
  tags: [...defaultTags, "stg"],
  alertChannels: [slackAlertChannel],
})

const prdGroup = new CheckGroupV2("check-group-prd", {
  ...groupDefaults,
  name: `designmode (prd)`,
  tags: [...defaultTags, "prd"],
  alertChannels: [slackAlertChannel, ...(pagerdutyAlertChannel ? [pagerdutyAlertChannel] : [])],
})

const targetsConfig = {
  chaos: {
    projectId: "pro_l1qffh9vjj",
    proposalId: "d63f5941-3353-434e-afc2-a6668dbe229d",
  },
  "prd-irl": {
    projectId: "pro_eg5qj2fjpm",
    proposalId: "4849711e-eb40-45bc-8e9a-b2c0ded9a0e9",
  },
  "prd-usa": {
    projectId: "pro_vxlqozvrdi",
    proposalId: "30a409bb-2278-418d-90dd-48eaa71032f3",
  },
}

export const targets = Object.entries(targetsConfig).map(([name, config]) => {
  const target = getTargetByNameOrThrow(name)
  return {
    logicalIdPart: target.name,
    title: target.name,
    baseUrl: target.baseUrl,
    ...config,
    checkProps: {
      group: target.tags.includes("prd") ? prdGroup : stgGroup,
      tags: [...defaultTags, ...target.tags, target.name, "ci-check"],
      runtimeId: "2024.09",
    } satisfies Partial<RuntimeCheckProps>,
  }
})
