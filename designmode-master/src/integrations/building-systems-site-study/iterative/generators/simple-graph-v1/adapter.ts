import { generateVoronoiGraph } from "src/integrations/building-systems-site-study/generator/sketchStuff/partitions/generateVoronoiPartitions"
import { getConvexRefinedPartition } from "src/integrations/building-systems-site-study/generator/sketchStuff/partitions/convexPartitionGenerator"
import { generateGridGraph } from "src/integrations/building-systems-site-study/generator/sketchStuff/partitions/generateGrids"

import { generateGridSimple } from "./grid"
import type { GenerateCellGraphParameters, SimpleGraph } from "./types"

export function generateCellGraph(parameters: GenerateCellGraphParameters): SimpleGraph {
  switch (parameters.technique) {
    case "grid2":
      return generateGridSimple(parameters.polygons, parameters.params)
    case "grid":
      return generateGridGraph(parameters.polygons, 0)
    case "voronoi":
      return generateVoronoiGraph(parameters.polygons, 0)
    case "convex":
      return getConvexRefinedPartition(parameters.polygons, 0)
    case "blank":
      // TODO: This is a hack to end up with an empty graph to be used in a SiteExploreArea element generator config
      // but maybe this should not be a "generator" at all, as it's not generating anything
      return { vertices: {}, edges: {} } // empty graph
  }
}
