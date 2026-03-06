import type { ValidationError } from "./errors"
import { validationErrorTexts } from "./errors"
import { validateDuplicateElements } from "./rules/validateDuplicateElement"
import { validateOutOfBounds } from "./rules/validateOutOfBounds"
import { computed, useSignalEffect } from "@preact/signals"
import { getLeafKey } from "src/lib/element/path"
import { GeometryAlertsAPI } from "src/core/geometry-alerts"
import Notifications_16 from "src/lib/components/icons/Notifications_16"
import { AnalyticsLegacy } from "src/core/analytics"
import { isLoadingNewProposalSignal } from "src/core/proposal-refresh"
import { elementState } from "src/core/elements/ElementState"
import {
  resetHighlightedFillSignal,
  setHighlightedFillSignalValue,
  setSelectionSignalValue,
} from "src/core/selection/selectionState"
import type { Proposal } from "src/core/elements/Proposal"
// eslint-disable-next-line import/no-restricted-paths
import { wsmValidationErrorsSignal } from "src/integrations/wsm-tools/wsr/integrated/state"
// eslint-disable-next-line import/no-restricted-paths
import Sketch3DIcon from "src/integrations/wsm-tools/assets/Sketch3DIcon"
// eslint-disable-next-line import/no-restricted-paths
import { flattenLowestNonHorizontalFaces } from "src/integrations/wsm-tools/wsr/tools/toolUtils"
import { type NewTerrainState, terrainSignal } from "src/core/terrain/new-terrain-state"
import { getTranslator } from "src/i18n"

const VALIDATE_RULES = [validateDuplicateElements, validateOutOfBounds] satisfies ((
  proposal: Proposal,
  terrain: NewTerrainState,
) => ValidationError[])[]

function validateProposal(proposal: Proposal, terrain: NewTerrainState): ValidationError[] {
  return VALIDATE_RULES.flatMap((validate) => validate(proposal, terrain))
}

const validationErrorsSignal = computed(() => {
  const start = performance.now()
  const errors = [
    ...validateProposal(elementState.currentProposalSignal.value, terrainSignal.value),
    ...wsmValidationErrorsSignal.value,
  ]
  performance.measure("validation", { start })
  return errors
})

export const groupedValidationErrorsSignal = computed(() => {
  return validationErrorsSignal.value.reduce<Map<ValidationError["type"], ValidationError[]>>((acc, error) => {
    if (!acc.has(error.type)) acc.set(error.type, [])
    acc.get(error.type)?.push(error)
    return acc
  }, new Map())
})

function deleteElementsFromErrors(errors: ValidationError[]) {
  elementState.edit(({ removeElement }) => {
    for (const e of errors) {
      const node = elementState.currentSnapshot.peek().getNode(e.path)
      if (!node) continue
      removeElement(node.context, getLeafKey(e.path))
    }
  })
}

export function useElementValidation() {
  useSignalEffect(() => {
    if (!elementState.isInitializedSignal.value) return

    if (isLoadingNewProposalSignal.value) return

    const groupedErrors = groupedValidationErrorsSignal.value

    const addedIds: string[] = []

    for (const [key, errors] of groupedErrors.entries()) {
      GeometryAlertsAPI.add({
        ...{
          id: key,
          title: validationErrorTexts[key].title,
          subTitle: validationErrorTexts[key].subTitle,
          count: errors.length,
          icon: key.startsWith("wsm-") ? (
            <Sketch3DIcon
              showFloorLine={key === "wsm-bottom-floor-no-area"}
              showRedFace={key.includes("non-manifold")}
            />
          ) : (
            <Notifications_16 />
          ),
          style: "error",
        },
        ...(key.startsWith("wsm-")
          ? {}
          : {
              onHover: () => {
                setHighlightedFillSignalValue(new Set(errors.map((e) => e.path)))
                return () => {
                  resetHighlightedFillSignal()
                }
              },
              onClick: () => {
                const t = getTranslator()
                // Don't track this with new tracking schema
                AnalyticsLegacy.track("Geometry alerts: Select elements", {
                  type: t.getText(validationErrorTexts[key].title),
                })
                setSelectionSignalValue(errors.map((e) => e.path))
              },
              actions: [
                {
                  name: (t) => t(($) => $.ui.remove),
                  onClick: () => {
                    const t = getTranslator()
                    // Don't track this with new tracking schema
                    AnalyticsLegacy.track("Geometry alerts: Delete elements", {
                      type: t.getText(validationErrorTexts[key].title),
                    })
                    deleteElementsFromErrors(errors)
                  },
                },
              ],
            }),
        ...(key === "wsm-bottom-floor-no-area"
          ? {
              actions: [
                {
                  name: (t) => t(($) => $.ui.repair),
                  onClick: () => {
                    //alert("Repairing WSM element zero floor area")
                    const path = FormIt.GroupEdit.GetInContextEditingPathRequiredPrefix()
                    if (WSM.GroupInstancePath.IsValid(path)) {
                      const objectHistory = WSM.GroupInstancePath.GetTopObjectHistoryID(path)
                      flattenLowestNonHorizontalFaces(objectHistory.History, objectHistory.Object)
                    }
                    const t = getTranslator()
                    // Don't track this with new tracking schema
                    AnalyticsLegacy.track("Geometry alerts: Repair WSM elements", {
                      type: t.getText(validationErrorTexts[key].title),
                    })
                  },
                },
              ],
            }
          : {}),
      })
      addedIds.push(key)
    }

    return () => {
      addedIds.forEach((id) => GeometryAlertsAPI.remove(id))
    }
  })
}
