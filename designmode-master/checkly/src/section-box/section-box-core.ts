import { getTargetByNameOrThrow } from "@spacemakerai/deploy-targets"
import type { RuntimeCheckProps } from "checkly/constructs"
import { CheckGroupV2, SlackAlertChannel } from "checkly/constructs"
import { groupDefaults } from "../core"

// Manually defined in Checkly account.
// https://app.checklyhq.com/alerts/settings/channels/edit/slack/211413
const slackAlertChannel = SlackAlertChannel.fromId(211413)

const group = new CheckGroupV2("check-group-prd-section-box", {
  ...groupDefaults,
  name: `designmode (prd) - section box`,
  tags: [...groupDefaults.tags, "prd"],
  alertChannels: [slackAlertChannel], // TODO: Add pagerduty channel once tests have been verified
})

const target = getTargetByNameOrThrow("prd-irl")

export const targets = [
  {
    logicalIdPart: target.name,
    title: target.name,
    baseUrl: target.baseUrl,
    projectId: "pro_yo64kwpi86",
    proposalId: "ab8c04e3-7d67-4cca-b620-914f77470528",
    checkProps: {
      group,
      tags: [...groupDefaults.tags, ...target.tags, target.name, "ci-check"],
      runtimeId: "2024.09",
    } satisfies Partial<RuntimeCheckProps>,
  },
]
