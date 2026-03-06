locals {
  pagerduty = {
    escalation_policy_id = "PVM77NI" # https://spacemaker.pagerduty.com/escalation_policies/PVM77NI
  }
}

terraform {
  backend "s3" {
    bucket = "sm-terraform"
    key    = "designmode.tfstate"
    region = "eu-west-1"
  }
  required_providers {
    pagerduty = {
      source  = "pagerduty/pagerduty"
      version = "3.30.5"
    }
  }
}

ephemeral "aws_ssm_parameter" "pagerduty_token" {
  arn = "arn:aws:ssm:eu-west-1:741408923162:parameter/terraform/pagerduty/spacemaker/api-token"
}
provider "pagerduty" {
  token = ephemeral.aws_ssm_parameter.pagerduty_token.value
}

resource "pagerduty_service" "service" {
  # (Note that this currently uses the spacemakerai PagerDuty account. Naming will be different if moving to autodeskcloudops.)
  name                    = "Design Mode"
  auto_resolve_timeout    = "null"
  acknowledgement_timeout = "null"
  escalation_policy       = local.pagerduty.escalation_policy_id
}

data "pagerduty_vendor" "checkly" {
  name = "Checkly"
}

resource "pagerduty_service_integration" "checkly" {
  name    = "Checkly"
  vendor  = data.pagerduty_vendor.checkly.id
  service = pagerduty_service.service.id
}

output "checkly_pagerduty_service_integration" {
  value = {
    account_name = "autodeskcloudops"
    service_key  = pagerduty_service_integration.checkly.integration_key
    service_name = pagerduty_service.service.name
  }
  sensitive = true
}
