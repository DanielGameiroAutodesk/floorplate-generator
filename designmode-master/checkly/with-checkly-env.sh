#!/bin/bash
set -eu

# Retrieve login credentials via Checkly environment config.
pnpm checkly env ls | grep ^ADSK_PAT > .env.checkly

cleanup() {
  rm -f .env.checkly
}

trap cleanup EXIT

$@
