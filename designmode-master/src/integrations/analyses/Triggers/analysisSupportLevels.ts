import memoize from "lodash/memoize"
import type { Representations } from "@spacemakerai/element-types"
import type { SupportLevel } from "src/integrations/analyses/AnalysisSupport/analysisSupport"
import { objectAssign, objectFromEntries, objectKeys } from "src/lib/record"
import { getAllAnalyzeableElements } from "src/integrations/analyses/Selection/useSelectedElementPaths"
import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import type { AnalysisBuildingColors } from "src/integrations/analyses/useAnalysisBuildingColorApi"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { SELECTED_FOR_ANALYSIS_COLOR } from "./constants"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"

export const SUPPORT_LEVEL_COLORS: Record<SupportLevel, string> = {
  none: "#ff0000",
  partial: "#ADD8E6",
  full: SELECTED_FOR_ANALYSIS_COLOR,
} as const

const SUPPORT_LEVEL_ANALYSIS_TYPES = ["sun", "sky-component"] as const

function isAnalysisSupportLevelType(
  analysisType: AnalysisType,
): analysisType is (typeof SUPPORT_LEVEL_ANALYSIS_TYPES)[number] {
  return SUPPORT_LEVEL_ANALYSIS_TYPES.includes(analysisType as any)
}

function findRepresentationsRecursively(path: string, elementSnapshot: ElementSnapshot): (keyof Representations)[] {
  function findRepresentationsForElementAndAllDescendantsRecursive(
    path: string,
  ): Record<keyof Representations, boolean> {
    const element = elementSnapshot.getNode(path)?.elementContainer.element
    if (!element) {
      return {}
    }
    const elementRepresentations: Record<keyof Representations, boolean> = objectFromEntries(
      objectKeys(element.representations ?? {}).map((representationName) => [representationName, true]),
    )
    element.children?.forEach((child) =>
      objectAssign(
        elementRepresentations,
        findRepresentationsForElementAndAllDescendantsRecursive(`${path}/${child.key}`),
      ),
    )
    return elementRepresentations
  }
  return objectKeys(findRepresentationsForElementAndAllDescendantsRecursive(path))
}

export const getAnalysisSupportLevelColors = memoize(
  (
    analysisType: AnalysisType,
    selectedElementPaths: string[],
    elementSnapshot: ElementSnapshot,
    scenarioChildNodes?: ChildNodeContainer[],
  ): AnalysisBuildingColors => {
    if (!isAnalysisSupportLevelType(analysisType)) {
      return colorMapAllPaths(selectedElementPaths, SUPPORT_LEVEL_COLORS.full)
    }
    const scenarioChildPathsSet = new Set(scenarioChildNodes?.map((c) => c.path) ?? [])

    let paths = selectedElementPaths
    if (paths.length === 1 && paths[0] === "root") {
      paths = getAllAnalyzeableElements(elementSnapshot, scenarioChildNodes)
    }

    let excludeElement: (path: string) => boolean = () => false

    if (["sun", "sky-component"].includes(analysisType)) {
      excludeElement = (path: string) => {
        const element = elementSnapshot.getNode(path)?.elementContainer.element
        if (element?.properties?.virtual === true) return true
        if (["tree_area", "tree_line"].includes(element?.properties?.category || "")) return true
        return false
      }
    }

    const support = paths.reduce(
      (acc, path) => {
        const representations = findRepresentationsRecursively(path, elementSnapshot)
        if (excludeElement(path)) {
          acc.none.push(path)
          return acc
        }
        if (representations.includes("semanticMesh")) {
          acc.full.push(path)
        } else if (representations.includes("volumeMesh")) {
          acc.partial.push(path)
        } else if (scenarioChildPathsSet.has(path)) {
          acc.partial.push(path)
        } else {
          acc.none.push(path)
        }
        return acc
      },
      { full: [], partial: [], none: [] } as Record<SupportLevel, string[]>,
    )

    return {
      ...colorMapAllPaths(support.full, SUPPORT_LEVEL_COLORS.full),
      ...colorMapAllPaths(support.partial, SUPPORT_LEVEL_COLORS.partial),
    }
  },
  (analysisType, selectedElementPaths, elementSnapshot, scenarioChildNodes) =>
    analysisType +
    selectedElementPaths.join(",") +
    elementSnapshot.rootUrn +
    (scenarioChildNodes?.map((c) => c.path).join(",") || ""),
)

function colorMapAllPaths(paths: string[], color: string) {
  return Object.fromEntries(paths.map((path) => [path, color]))
}
