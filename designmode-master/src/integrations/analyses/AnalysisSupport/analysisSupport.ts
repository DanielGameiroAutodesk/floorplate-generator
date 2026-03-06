import { computed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { groupedValidationErrorsSignal } from "src/core/elements/validation/geometry-validation"
import type { ValidationError } from "src/core/elements/validation/geometry-validation/errors"
import { isDefined } from "src/lib/array"
import { NODE_PREDICATES } from "src/core/elements/predicates"

export type SupportLevel = "none" | "partial" | "full"

export const analysisTriggerDisabledSignal = computed(() => {
  const snapshot = elementState.currentSnapshot.value
  if (!snapshot.isPersisted) return { code: "snapshot_not_persisted" } as const

  const groupedErrors = groupedValidationErrorsSignal.value
  // The analyses currently using this check (sun, daylight, solar panel, microclimate)
  // only care about geometry alerts affecting "physical" volume meshes
  const relevantAlerts: ValidationError["type"][] = []
  for (const [key, errors] of groupedErrors) {
    if (key === "out-of-bounds-element") continue
    const paths = errors.map((e) => e.path)
    const nodes = paths.map((path) => snapshot.getNode(path)).filter(isDefined)
    const nodesWithAllDescendants = snapshot.getNodesWithAllDescendants(nodes)
    const withVolumeMeshes = nodesWithAllDescendants.filter((node) => node.elementContainer.representations.volumeMesh)
    const nonVirtual = withVolumeMeshes.filter(NODE_PREDICATES.isNotVirtual())
    if (nonVirtual.length > 0) relevantAlerts.push(key)
  }
  if (relevantAlerts.length > 0) return { code: "geometry_alerts", messageIds: relevantAlerts } as const
})
