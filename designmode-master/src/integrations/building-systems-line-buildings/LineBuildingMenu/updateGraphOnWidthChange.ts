import { bufferGraphLine } from "src/integrations/building-systems-line-buildings/helpers/lineAlignment"
import type { Graph } from "@spacemakerai/line-buildings-shared/shapeHelpers"

export function updateGraphOnWidthChange(graph: Graph, oldWidth: number, newWidth: number, lineAlignment: string) {
  if (lineAlignment === "center") return graph
  if (lineAlignment === "left") {
    const bufferDist = (oldWidth - newWidth) * 0.5
    return bufferGraphLine(graph, bufferDist)
  }
  if (lineAlignment === "right") {
    const bufferDist = (newWidth - oldWidth) * 0.5
    return bufferGraphLine(graph, bufferDist)
  }
  return { ...graph }
}
