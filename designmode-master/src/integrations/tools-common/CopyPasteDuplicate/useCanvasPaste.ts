import { canEditProposalSignal } from "src/core/edit-access-state"
import { contextRootSignal, scenarioModeSignal } from "src/core/selection/selectionState"
import { captureException } from "@sentry/browser"
import { copyPastePermissionErrorToast, pasteMalformedContentToast } from "./copyPasteErrorToasts"
import type { ClipboardValue, ElementClipboardValue, TerrainPadClipboardValue } from "./types"
import { isTerrainPad, isElement } from "./types"
import { getDuplicateActions } from "./actions"
import { isDefined } from "src/lib/array"
import { useCallback, useEffect, useState } from "preact/compat"
import { defaultCursor, loadingCursor } from "src/integrations/cursors/setCursor"

import { mergePath } from "src/lib/element/path"
import { AnalyticsUtils } from "src/core/analytics"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { elementState } from "src/core/elements/ElementState"
import { AffineCanvasPaste } from "./AffineCanvasPaste"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import { CurrentLocation } from "src/lib/location"
import { toolAPI } from "src/core/toolsState"

function pasteTerrainPads(terrainPads: TerrainPadClipboardValue[]) {
  const operations = terrainPads.map((pad) => pad.operation)
  terrainApi.appendTerrainOperationsToElementState(operations)
}

export function useCanvasPaste() {
  const canEdit = canEditProposalSignal.value
  const actionAPI = useActionAPI()

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (loading) {
      loadingCursor()
    }
    return () => {
      defaultCursor()
    }
  }, [loading])

  return useCallback(
    async (inPlace: boolean = false) => {
      if (loading) return
      if (!canEdit) {
        console.warn("Pasting elements while in view-only mode - pasting is ignored.")
        return
      }

      try {
        setLoading(true)

        let scenarioMode = scenarioModeSignal.peek()

        const clipboardText = await navigator.clipboard.readText()

        let clipboardValues: ClipboardValue[]
        let terrainPads: TerrainPadClipboardValue[]
        let regularElements: ElementClipboardValue[]
        try {
          const parsed = JSON.parse(clipboardText)
          clipboardValues = parsed.candidates
          const sourceProposalId = parsed.proposalId

          // Separate terrain pads from regular elements BEFORE checking same proposal
          terrainPads = clipboardValues.filter(isTerrainPad)
          regularElements = clipboardValues.filter(isElement)

          // If only terrain pads, paste them directly (regardless of proposal)
          if (terrainPads.length > 0 && regularElements.length === 0) {
            pasteTerrainPads(terrainPads)
            setLoading(false)
            return
          }

          if (sourceProposalId === CurrentLocation.getProposalId() && !inPlace) {
            // Pasting elements from the same proposal - use affine paste
            setLoading(false)
            toolAPI.setTool({
              id: "affinePaste",
              toolbar: () => null,
              tool: AffineCanvasPaste,
              propertyPanel: "default",
            })
            return
          }
        } catch {
          pasteMalformedContentToast(clipboardText)
          return
        }

        // TODO: Add better/stricter checking, e.g. use zod or some other library to check our parsed values
        if (!Array.isArray(clipboardValues)) {
          pasteMalformedContentToast(clipboardText)
          return
        }

        // Validate regular elements have URNs
        if (
          regularElements.length > 0 &&
          !regularElements.every(({ urn }) => urn && urn.startsWith("urn:adsk-forma-elements"))
        ) {
          // not URNS
          pasteMalformedContentToast(clipboardText)
          return
        }

        // If we have regular elements, paste them (and terrain pads will be handled by affine paste completion)
        if (regularElements.length > 0) {
          const pastedUrns = regularElements.map((cv) => cv.urn)

          const toplevel = elementState.currentProposalSignal.peek().getToplevelElements()
          const categories = toplevel
            .filter((element) => pastedUrns.includes(element.urn))
            .map((element) => element.properties?.category)
          const elementCategory = AnalyticsUtils.trackedElementCategory(categories)
          const inScenario = AnalyticsUtils.trackedInScenarioFlag([scenarioMode])

          const contextRoot = contextRootSignal.peek()

          const actions = await getDuplicateActions(
            regularElements,
            actionAPI,
            elementState.currentProposalSignal.peek(),
            contextRoot,
          )

          const newSelection = new Set(
            actions
              .map((a) => {
                if ((a.type === "create" || a.type === "add") && a.parentPath === contextRoot) {
                  return mergePath(a.parentPath, a.child.key)
                }
                return undefined
              })
              .filter(isDefined),
          )
          actionAPI.apply(
            "paste",
            actions,
            {
              tool: "paste",
              eventType: "add",
              numElements: regularElements.length,
              elementCategory,
              inScenario,
            },
            newSelection,
          )

          // Apply terrain pads after regular elements are placed
          if (terrainPads.length > 0) {
            pasteTerrainPads(terrainPads)
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "NotAllowedError") {
          /* Do nothing */
        } else {
          captureException(new Error("Error while pasting clipboard contents", { cause: e }))
        }
        copyPastePermissionErrorToast("paste", e)
      } finally {
        setLoading(false)
      }
    },
    [actionAPI, canEdit, loading],
  )
}
