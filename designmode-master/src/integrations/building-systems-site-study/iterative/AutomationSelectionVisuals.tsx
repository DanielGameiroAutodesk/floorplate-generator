import { computed } from "@preact/signals"
import { Vector3 } from "three"
import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"

import { getTranslator } from "src/i18n/index"
import {
  highlightVisibilitySignal,
  hoveredIdsSignal,
  selectionSetSignal,
  selectionVisibilitySignal,
} from "src/core/selection/selectionState"
import { elementState } from "src/core/elements/ElementState"
import { isDefined } from "src/lib/array"
import { Set_union } from "src/lib/set"
import { HiddenPaths } from "src/core/hidden"
import type { InternalPath } from "src/lib/element/path"

import { isSiteExploreAreaGraphGeneratorElement } from "./site-explore-area"
import { useAutomationFillPattern } from "./AutomationFillPattern"
import type { Polygon } from "./generators"

const hoveredAutomationPolygonsSignal = computed(() => {
  const hoveredPaths = hoveredIdsSignal.value
  const selectedPaths = selectionSetSignal.value

  const hiddenPaths = HiddenPaths.hiddenPathsSignal.value
  const selectionVisible = selectionVisibilitySignal.value
  const highlightVisible = highlightVisibilitySignal.value

  let paths = new Set<InternalPath>()
  if (selectionVisible) {
    paths = Set_union(paths, selectedPaths)
  }
  if (highlightVisible) {
    paths = Set_union(paths, hoveredPaths)
  }

  return [...paths]
    .filter((item) => !hiddenPaths.has(item))
    .map((path) => elementState.currentSnapshot.value.getNode(path))
    .filter(isDefined)
    .flatMap((node) => {
      if (!isSiteExploreAreaGraphGeneratorElement(node.element)) return []
      // TODO: Move transform into lib
      return node.element.properties.generator.parameters.polygons.map((polygon) =>
        polygon
          .map(([x, y]) => new Vector3(x, y, 0).applyMatrix4(node.globalMatrix))
          .map((vec3): Polygon[number] => [vec3.x, vec3.y]),
      )
    })
})

export function AutomationSelectionVisuals() {
  useErrorBoundary((error, errorInfo) => {
    console.error("AutomationSelectionVisuals error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "site-design", feature: "iterative-explore" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.siteStudy.errorOccurred), status: "warning" })
  })

  useAutomationFillPattern(hoveredAutomationPolygonsSignal.value)

  return null
}
