import { getTargetByNameOrThrow } from "@spacemakerai/deploy-targets"
import type { RuntimeCheckProps } from "checkly/constructs"
import {
  AlertEscalationBuilder,
  CheckGroupV2,
  PagerdutyAlertChannel,
  RetryStrategyBuilder,
  SlackAlertChannel,
} from "checkly/constructs"
import { groupDefaults } from "../core"

// Manually defined in Checkly account.
// https://app.checklyhq.com/alerts/settings/channels/edit/slack/241133
const slackAlertChannel = SlackAlertChannel.fromId(241133)

// Manually defined in Checkly account.
// https://app.checklyhq.com/alerts/settings/channels/edit/pagerduty/242369
const pagerdutyAlertChannel = PagerdutyAlertChannel.fromId(242369)

const group = new CheckGroupV2("check-group-prd-3d-sketch", {
  ...groupDefaults,
  name: `designmode (prd) - 3d sketch`,
  tags: [...groupDefaults.tags, "prd"],
  alertChannels: [slackAlertChannel, pagerdutyAlertChannel],
})

const groupSlackOnly = new CheckGroupV2("check-group-prd-3d-sketch-slack-only", {
  ...groupDefaults,
  name: `designmode (prd) - 3d sketch (Slack only)`,
  tags: [...groupDefaults.tags, "prd"],
  alertChannels: [slackAlertChannel],
  alertEscalationPolicy: AlertEscalationBuilder.runBasedEscalation(3, {
    // No reminder for this.
    amount: 0,
    interval: 15,
  }),
  // Override group defaults to limit retries to maximum of 1 (2 total attempts)
  retryStrategy: RetryStrategyBuilder.linearStrategy({
    baseBackoffSeconds: 10,
    maxRetries: 1,
    sameRegion: false,
  }),
})

const target = getTargetByNameOrThrow("prd-irl")

export const targets = [
  {
    logicalIdPart: target.name,
    title: target.name,
    baseUrl: target.baseUrl,
    projectId: "pro_z97z4jqlcd",
    proposalId: "0596cf51-8acd-4707-839c-e492e101631a",
    checkProps: {
      group,
      tags: [...groupDefaults.tags, ...target.tags, target.name],
      runtimeId: "2024.09",
    } satisfies Partial<RuntimeCheckProps>,
  },
]

export const targetsSlackOnly = [
  {
    logicalIdPart: target.name,
    title: target.name,
    baseUrl: target.baseUrl,
    projectId: "pro_z97z4jqlcd",
    proposalId: "0596cf51-8acd-4707-839c-e492e101631a",
    checkProps: {
      group: groupSlackOnly,
      tags: [...groupDefaults.tags, ...target.tags, target.name, "ci-check"],
      runtimeId: "2024.09",
    } satisfies Partial<RuntimeCheckProps>,
  },
]
