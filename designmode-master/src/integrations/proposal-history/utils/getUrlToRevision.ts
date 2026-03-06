import type { Revision } from "./identifyPeriodsAlgorithm"
import { REVISION_URL_PARAM } from "src/lib/location"
import { parseUrn } from "src/lib/element/urn"

export default function getUrlToRevision(revision: Revision): { url: string; time: string } {
  const url = new URL(window.location.href)
  url.searchParams.delete(REVISION_URL_PARAM)
  url.searchParams.append(REVISION_URL_PARAM, parseUrn(revision.urn).revision)

  if (!revision.time) {
    return {
      url: url.toString(),
      time: "revision",
    }
  }

  const day = new Date(revision?.time).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })
  const hour = new Date(revision.time).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return {
    url: url.toString(),
    time: `${day} - ${hour}`,
  }
}
