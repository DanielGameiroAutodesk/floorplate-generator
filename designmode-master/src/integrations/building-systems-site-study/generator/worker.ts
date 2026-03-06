import type { SiteStudyInput } from "./siteStudySpec"
import { hash } from "./filtering"
import { generateSiteStudy } from "./sketchStuff/generate"

self.onmessage = (e: MessageEvent<SiteStudyInput>) => {
  const siteStudy = generateSiteStudy(e.data)
  const siteStudyHash = hash(siteStudy.simpleBuildings)

  self.postMessage({ siteStudy, hash: siteStudyHash })
}

export {}
