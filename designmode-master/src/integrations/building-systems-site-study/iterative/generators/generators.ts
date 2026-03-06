import * as SimpleGraphV1 from "./simple-graph-v1"
import * as BuildingsV1 from "./buildings-v1"

export type SiteExploreAreaGeneratorConfig =
  | { generatorId: "site-explore-area-graph-v2"; parameters: SimpleGraphV1.SimpleGraphGeneratorParameters }
  | { generatorId: "site-explore-area-buildings-v1"; parameters: BuildingsV1.GeneratorParameters }

export type SiteExploreAreaGeneratorId = SiteExploreAreaGeneratorConfig["generatorId"]

type GeneratorParameters<K> = Extract<SiteExploreAreaGeneratorConfig, { generatorId: K }>["parameters"]

export const siteExploreAreaGenerators = {
  "site-explore-area-graph-v2": SimpleGraphV1.generateSimpleGraph,
  "site-explore-area-buildings-v1": BuildingsV1.generate,
} satisfies {
  [K in SiteExploreAreaGeneratorId]: (params: GeneratorParameters<K>, imperialFlag: boolean) => unknown
}
