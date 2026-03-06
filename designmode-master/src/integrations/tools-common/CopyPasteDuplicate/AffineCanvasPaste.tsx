import { useSignal, useSignalEffect } from "@preact/signals"
import { copyPastePermissionErrorToast, pasteMalformedContentToast } from "./copyPasteErrorToasts"
import type { ClipboardValue, ElementClipboardValue, TerrainPadClipboardValue } from "./types"
import { isTerrainPad, isElement } from "./types"
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import sceneManager from "src/core/three/sceneManager"
import { Matrix4 } from "three"
import { Box2, Box3, Vector2, Vector3 } from "three"
import { elementState } from "src/core/elements/ElementState"
import { Affine, type ToolState } from "src/integrations/tools-common/AffineTooling/Affine"
import { mergePath } from "src/lib/element/path"
import { isDefined } from "src/lib/array"
import { useCalculateAffineSnap } from "src/integrations/snapping/useAffineSnap"
import { exitCurrentTool } from "src/core/toolsState"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import {
  contextRootSignal,
  scenarioModeSignal,
  setHoveredIdsSignalValue,
  setSelectionVisibilitySignalValue,
} from "src/core/selection/selectionState"
import { captureException } from "@sentry/browser"
import { getDuplicateActions } from "./actions"
import { useActionAPI, type Action } from "src/integrations/legacy-actions/ActionAPI"
import { AnalyticsUtils } from "src/core/analytics"
import { capabilityScriptsRegistry } from "src/integrations/elements-capabilities/registry"
import { elementHasUpdateTransformCapability } from "src/integrations/elements-capabilities/updateTransform"
import { getPath } from "src/integrations/legacy-actions/utils"
import { useClipboardValuesPreviewData } from "./useClipboardPreviewData"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export const AffineCanvasPaste = () => {
  const calculateAffineSnap = useCalculateAffineSnap()
  const actionAPI = useActionAPI()

  const clipboardTextSignal = useSignal<string | null>(null)

  // Track if terrain operations have been applied to prevent duplicates
  const terrainOperationsAppliedRef = useRef(false)

  const exitPaste = useCallback(() => {
    clipboardTextSignal.value = null
    terrainOperationsAppliedRef.current = false // Reset flag for next paste operation
    exitCurrentTool()
    setSelectionVisibilitySignalValue(true)
  }, [clipboardTextSignal])
  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitPaste()
      }
      return Propagate.YES
    },
    [exitPaste],
  )
  useEventHandler("keydown", keydown, Priority.TOOL)

  useEffect(() => {
    navigator.clipboard
      .readText()
      .then((text) => {
        clipboardTextSignal.value = text
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "NotAllowedError") {
          /* Do nothing */
        } else {
          captureException(new Error("Error while pasting clipboard contents", { cause: e }))
        }
        copyPastePermissionErrorToast("paste", e)

        exitPaste()
      })
  }, [clipboardTextSignal, exitPaste])

  const clipboardValuesSignal = useSignal<ClipboardValue[] | null>(null)
  const elementClipboardValuesSignal = useSignal<ElementClipboardValue[] | null>(null)
  const terrainPadClipboardValuesSignal = useSignal<TerrainPadClipboardValue[] | null>(null)

  useSignalEffect(() => {
    const clipboardText = clipboardTextSignal.value
    if (!clipboardText) return

    let clipboardValues: ClipboardValue[]
    try {
      const clipboardParsed = JSON.parse(clipboardText)
      clipboardValues = clipboardParsed.candidates
    } catch {
      pasteMalformedContentToast(clipboardText)
      clipboardValuesSignal.value = []
      return
    }

    // TODO: Add better/stricter checking, e.g. use zod or some other library to check our parsed values
    if (!Array.isArray(clipboardValues)) {
      pasteMalformedContentToast(clipboardText)
      clipboardValuesSignal.value = []
      return
    }

    // Separate terrain pads from regular elements
    const terrainPads = clipboardValues.filter(isTerrainPad)
    const regularElements = clipboardValues.filter(isElement)

    // Validate regular elements have URNs
    if (
      regularElements.length > 0 &&
      !regularElements.every(({ urn }) => urn && urn.startsWith("urn:adsk-forma-elements"))
    ) {
      // not URNS
      pasteMalformedContentToast(clipboardText)
      clipboardValuesSignal.value = []
      return
    }

    clipboardValuesSignal.value = clipboardValues
    elementClipboardValuesSignal.value = regularElements
    terrainPadClipboardValuesSignal.value = terrainPads
  })

  // Only use element clipboard values for preview (exclude terrain pads)
  const { moveGroup3d, moveGroup2d, movingAffineSnap } = useClipboardValuesPreviewData(
    elementClipboardValuesSignal,
    exitPaste,
  )

  const renderAPI = useRenderAPI("paste")
  renderAPI.useObjectLifecycle_TEMPORARY_FIX(moveGroup3d, true)
  renderAPI.useObjectLifecycle_TEMPORARY_FIX(moveGroup2d, true, sceneManager.overlay.scene)

  const initialState: ToolState | null = useMemo(() => {
    if (!moveGroup3d || !moveGroup2d) return null
    const box = new Box3().setFromObject(moveGroup3d)
    if (box.isEmpty()) box.setFromObject(moveGroup2d)
    if (box.isEmpty()) return null
    const origin = box.getCenter(new Vector3())
    origin.z = box.min.z

    const terrainBBox = terrainSignal.peek().terrainSamplerData.bbox
    const bbox = new Box2(
      new Vector2(terrainBBox.min.x, terrainBBox.min.y),
      new Vector2(terrainBBox.max.x, terrainBBox.max.y),
    )
    const isOriginInsideTerrain = bbox.containsPoint(new Vector2(origin.x, origin.y))

    return {
      type: "move",
      origin,
      isOriginInsideTerrain,
      mouseDownPos: [0, 0],
      active: true,
      moveMode: "terrain",
    }
  }, [moveGroup3d, moveGroup2d])

  const targetSnapData = useMemo(() => calculateAffineSnap(), [calculateAffineSnap])
  const movingPaths = useMemo(() => new Set<string>([]), [])

  useEffect(() => {
    setSelectionVisibilitySignalValue(false)
    setHoveredIdsSignalValue(new Set())
  }, [])

  const elementClipboardValues = elementClipboardValuesSignal.value
  const terrainPadClipboardValues = terrainPadClipboardValuesSignal.value
  const movedDuplicateActions = useGetMovedDuplicateActions()
  const customUpdateTransformActions = useGetUpdateTransformActions()

  const applyTerrainOperations = useCallback((terrainPads: TerrainPadClipboardValue[]) => {
    if (terrainOperationsAppliedRef.current || !terrainPads || terrainPads.length === 0) {
      return
    }

    const operations = terrainPads.map((pad) => pad.operation)
    terrainApi.appendTerrainOperationsToElementState(operations)
    terrainOperationsAppliedRef.current = true
  }, [])

  const applyAffineWithDuplicate = useCallback(
    async (matrix: Matrix4) => {
      if (elementClipboardValues) {
        const contextRoot = contextRootSignal.peek()
        const actions = await movedDuplicateActions(matrix, elementClipboardValues)
        const elementCategory = AnalyticsUtils.trackedElementCategory(elementClipboardValues.map((cv) => cv.category))
        const inScenario = AnalyticsUtils.trackedInScenarioFlag([scenarioModeSignal.peek()])
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
          "Element - Affine paste",
          actions,
          {
            tool: "paste",
            eventType: "add",
            numElements: elementClipboardValues.length,
            elementCategory,
            inScenario,
          },
          newSelection,
        )

        const actionsToUpdateTransform = customUpdateTransformActions(actions)

        if (actionsToUpdateTransform.length > 0) {
          actionAPI.apply("Element - Affine paste postprocess", actionsToUpdateTransform, {
            tool: "paste",
            eventType: "update",
            numElements: actionsToUpdateTransform.length,
            elementCategory,
            inScenario,
          })
        }

        // Apply terrain pads after elements are placed
        if (terrainPadClipboardValues) {
          applyTerrainOperations(terrainPadClipboardValues)
        }
      }

      exitPaste()
    },
    [
      elementClipboardValues,
      exitPaste,
      movedDuplicateActions,
      actionAPI,
      customUpdateTransformActions,
      terrainPadClipboardValues,
      applyTerrainOperations,
    ],
  )

  useEffect(() => {
    if (
      (elementClipboardValues && elementClipboardValues.length === 0) ||
      (moveGroup3d && moveGroup2d && initialState === null)
    ) {
      // If we have terrain pads but no regular elements, apply them before exiting
      if (terrainPadClipboardValues && terrainPadClipboardValues.length > 0 && elementClipboardValues?.length === 0) {
        applyTerrainOperations(terrainPadClipboardValues)
      }
      exitPaste()
    }
  }, [
    elementClipboardValues,
    terrainPadClipboardValues,
    initialState,
    exitPaste,
    moveGroup3d,
    moveGroup2d,
    applyTerrainOperations,
  ])

  if (!initialState || !moveGroup3d || !moveGroup2d) return null
  return (
    <Affine
      moveGroup2D={moveGroup2d}
      moveGroup3D={moveGroup3d}
      movingSnapData={movingAffineSnap}
      targetSnapData={targetSnapData}
      apply={applyAffineWithDuplicate}
      movingPaths={movingPaths}
      initialState={initialState}
      showGuideText={false}
    />
  )
}

function useGetMovedDuplicateActions() {
  const actionAPI = useActionAPI()
  return useCallback(
    async (matrix: Matrix4, clipboardValues: ElementClipboardValue[]) => {
      const contextRoot = contextRootSignal.peek()
      const movedClipboardValues = clipboardValues.map((cv) => {
        const transform = cv.transform ? new Matrix4().fromArray(cv.transform) : new Matrix4()
        const newTransform = matrix.clone().multiply(transform)
        return { ...cv, transform: newTransform.toArray() }
      })

      const actions = await getDuplicateActions(
        movedClipboardValues,
        actionAPI,
        elementState.currentProposalSignal.peek(),
        contextRoot,
      )
      return actions
    },
    [actionAPI],
  )
}

function useGetUpdateTransformActions() {
  const actionAPI = useActionAPI()
  return useCallback(
    (actions: Action[]) => {
      const actionsToUpdateTransform = actions.flatMap((action) => {
        if (!("element" in action) || !("child" in action) || !action.child) return []
        const element = action.element
        if (!elementHasUpdateTransformCapability(element)) return []
        const updateTransformScript = element.properties?.capabilities.updateTransform.script
        const transform = action.child.transform ?? new Matrix4().identity().toArray()
        const request = {
          urn: element.urn,
          proposal: elementState.currentProposalSignal.peek(),
          terrain: terrainSignal.peek(),
          transform,
        }
        const script = capabilityScriptsRegistry.updateTransform[updateTransformScript.url]
        const functionToCall = script[updateTransformScript.function]
        const response = functionToCall(request)
        if (!response) return []
        if (!("parentPath" in action) || !("child" in action)) return []
        const path = getPath(action)
        return actionAPI.update.subTree(
          path,
          response.rootUrn,
          response.elements,
          new Set(),
          response.representations,
          {
            child: {
              transform: response.transform,
            },
          },
        )
      })
      return actionsToUpdateTransform
    },
    [actionAPI],
  )
}
