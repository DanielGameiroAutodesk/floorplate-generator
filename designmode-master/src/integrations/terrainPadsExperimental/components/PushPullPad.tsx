import { elementState } from "src/core/elements/ElementState"
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "preact/compat"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import polylabel from "polylabel"
import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"
import type { Mesh } from "three"
import { EdgesGeometry, LineBasicMaterial, LineSegments, Vector3 } from "three"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { mousePosition } from "src/core/useMousePosition"
import sceneManager from "src/core/three/sceneManager"
import { defaultCursor, pushPullVerticalCursor } from "src/integrations/cursors/setCursor"
import { selectionPathsSignal, setSelectionPathsSignalValue } from "src/core/selection/selectionState"
import FloatingToolInputs, {
  type ControlContextValue,
} from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import {
  customSelectionTargetToSelectionPath,
  isCustomSelectionPath,
  parseCustomSelectionPath,
} from "src/core/selection/selectionTypes"
import { CUSTOM_INTEGRATION } from "src/integrations/terrainPadsExperimental/terrainElemenSystemInterface"
import { HiddenPaths } from "src/core/hidden"
import { getVisibleNodesSignal } from "src/core/elements/predicates"
import { isDefined } from "src/lib/array"
import debounce from "lodash/debounce"
import { terrainEditVisualizationSignal } from "src/integrations/terrainPadsExperimental/visuals/TerrainEditVisuals"
import type { Terrain } from "src/core/elements/Terrain"

const snappedElevationObjectMaterial = new LineBasicMaterial({ color: 0xffff00, depthTest: false })

export const PushPullPad = () => {
  const currentTerrain = elementState.currentTerrainSignal.value
  if (!currentTerrain) return null
  return <PushPullPadInner currentTerrain={currentTerrain} />
}

const PushPullPadInner = ({ currentTerrain }: { currentTerrain: Terrain }) => {
  const selectionPaths = selectionPathsSignal.value

  const selectedPadId = useMemo(() => {
    const selectedTerrainPads = Array.from(selectionPaths)
      .filter(isCustomSelectionPath)
      .map(parseCustomSelectionPath)
      .filter(({ integration }) => integration === "terrain_pads")
    return selectedTerrainPads.length === 1 && selectedTerrainPads[0]?.id
  }, [selectionPaths])

  const selectedPad = useMemo(() => {
    if (!selectedPadId) return
    return terrainApi.getTerrainOperation(currentTerrain.element, selectedPadId)
  }, [selectedPadId, currentTerrain])

  const [previewElevation, setPreviewElevation] = useState<number | undefined>(undefined)

  const previewOp = useMemo(() => {
    if (!selectedPad) return
    const elevation = previewElevation ?? selectedPad.elevation
    return { ...selectedPad, elevation }
  }, [selectedPad, previewElevation])

  useEffect(() => {
    // If dragging, hide all pads so we don't get selection outlines in the way
    if (!previewElevation) return
    const selectionPathsForAllPads = new Set(
      currentTerrain.element.properties.terrain_mode_operations?.map((pad) =>
        customSelectionTargetToSelectionPath({
          integration: CUSTOM_INTEGRATION,
          id: pad.id,
        }),
      ) ?? [],
    )
    HiddenPaths.setPathsHidden(selectionPathsForAllPads, true)
    return () => HiddenPaths.setPathsHidden(selectionPathsForAllPads, false)
  }, [currentTerrain, previewElevation])

  const startPosition = useMemo(() => {
    if (!selectedPad) return
    const footprint = selectedPad.coordinates.map((c) => [c.x, c.y])
    const centerHandlePos = polylabel([footprint])
    const z = selectedPad.elevation
    return new Vector3(centerHandlePos[0], centerHandlePos[1], z)
  }, [selectedPad])

  const onComplete = useCallback(
    (vector: Vector3) => {
      setPreviewElevation(undefined)
      if (!selectedPad) return
      if (!startPosition) return
      if (Math.abs(vector.z - startPosition.z) < 0.01) return
      const elevation = vector.z
      const newOp = { ...selectedPad, elevation }
      const currentTerrainOperations = terrainApi.getTerrainOperations(currentTerrain.element)
      const newOps = currentTerrainOperations.map((operation) => (operation.id === newOp.id ? newOp : operation))
      terrainApi.applyTerrainOperationsToElementState(newOps)
      setSelectionPathsSignalValue(
        new Set([
          customSelectionTargetToSelectionPath({
            integration: terrainApi.SELECTION_INTEGRATION_NAME,
            id: newOp.id,
          }),
        ]),
      )
    },
    [currentTerrain, selectedPad, startPosition],
  )
  const onPreview = useCallback((vector: Vector3) => setPreviewElevation(vector.z), [])
  const onCancel = useCallback(() => setPreviewElevation(undefined), [])

  useLayoutEffect(() => {
    terrainEditVisualizationSignal.value = { previewOp }
    return () => (terrainEditVisualizationSignal.value = {})
  }, [previewOp])

  return startPosition ? (
    <PushPullPadTool
      onComplete={onComplete}
      onPreview={onPreview}
      onCancel={onCancel}
      startPosition={startPosition}
      showHandle={true}
    />
  ) : null
}

export const PushPullPadTool = ({
  onPreview,
  onComplete,
  onCancel,
  startPosition,
  showHandle = true,
}: {
  onPreview: (vector: Vector3) => void
  onCancel: () => void
  onComplete: (vector: Vector3) => void
  startPosition: Vector3
  showHandle: boolean
}) => {
  const [pushPullHandle, setPushPullHandle] = useState<VertexHandle>(new VertexHandle(startPosition))
  const [isEditingElevation, setIsEditingElevation] = useState(false)
  const [snappedElevationObject, setSnappedElevationObject] = useState<LineSegments | undefined>(undefined)

  useEffect(() => {
    setPushPullHandle(new VertexHandle(startPosition))
  }, [startPosition])

  const debouncedOnComplete = useMemo(
    () =>
      debounce((val: number) => {
        const handlePos = pushPullHandle.position.clone()
        setIsEditingElevation(false)
        onComplete(new Vector3(handlePos.x, handlePos.y, val))
        defaultCursor()
      }, 500),
    [pushPullHandle.position, onComplete],
  )

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return Propagate.YES
      const hit = mousePosition.intersectObject(pushPullHandle)
      if (!isEditingElevation && hit.length !== 0) {
        setIsEditingElevation(true)
        pushPullVerticalCursor()
        return Propagate.NO
      }
      if (isEditingElevation) {
        const hasMoved = Math.abs(pushPullHandle.position.z - startPosition.z) > 0.01
        setIsEditingElevation(false)
        defaultCursor()
        if (hasMoved) {
          onComplete(pushPullHandle.position.clone())
        }
        return Propagate.NO
      }

      return Propagate.YES
    },
    [pushPullHandle, isEditingElevation, startPosition.z, onComplete],
  )

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return Propagate.YES

      const isClick = Math.abs(pushPullHandle.position.z - startPosition.z) < 2 // if mouseUp is not close to mouseDown -> drag and drop mode

      if (!isClick && isEditingElevation) {
        setIsEditingElevation(false)
        onComplete(pushPullHandle.position.clone())
        defaultCursor()
        return Propagate.NO
      }

      return Propagate.YES
    },
    [isEditingElevation, onComplete, pushPullHandle.position, startPosition.z],
  )

  const mouseMove = useCallback(() => {
    const hit = mousePosition.intersectObject(pushPullHandle)
    if (hit.length > 0 || isEditingElevation) {
      pushPullVerticalCursor()
    } else {
      defaultCursor()
    }
    if (isEditingElevation) {
      const position = new Vector3()
      mousePosition.ray.distanceSqToSegment(
        startPosition.clone().setZ(-1000),
        startPosition.clone().setZ(10000),
        undefined,
        position,
      )

      const proposal = elementState.currentProposalSignal.peek()
      const rayCastingTargets = getVisibleNodesSignal
        .peek()(proposal, { ignoreVirtualNodes: true })
        .map((node) => node.volumeMeshWithAcceleratedRaycast.getOrCompute())
        .filter(isDefined)

      const intersections = mousePosition.intersectObjects(rayCastingTargets)
      const intersectedObject = intersections.length > 0 ? (intersections[0].object as Mesh) : undefined
      const isElevationSnappingPossible =
        intersectedObject && intersectedObject.position && intersectedObject.position.z !== 0
      if (isElevationSnappingPossible) {
        const edges = new EdgesGeometry(intersectedObject.geometry)
        const edgeLines = new LineSegments(edges, snappedElevationObjectMaterial)
        edgeLines.position.set(intersectedObject.position.x, intersectedObject.position.y, intersectedObject.position.z)
        setSnappedElevationObject(edgeLines)
      } else {
        setSnappedElevationObject(undefined)
      }
      const newPos = isElevationSnappingPossible ? intersectedObject.position.clone() : position.clone()
      const updatedHandle = new VertexHandle(pushPullHandle.position.clone().setZ(newPos.z))
      setPushPullHandle(updatedHandle)
      onPreview(newPos)
      return Propagate.NO
    }
    return Propagate.YES
  }, [pushPullHandle, isEditingElevation, startPosition, onPreview])

  const commitOnEnter = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Enter") return Propagate.YES
      setIsEditingElevation(false)
      defaultCursor()
      onComplete(pushPullHandle.position.clone())
      return Propagate.NO
    },
    [onComplete, pushPullHandle.position],
  )

  const cancel = useCallback(() => {
    setIsEditingElevation(false)
    defaultCursor()
    setPushPullHandle(new VertexHandle(startPosition))
    onCancel()
  }, [onCancel, startPosition])

  useEventHandler("mousemove", mouseMove, Priority.PUSH_PULL, sceneManager.renderer.domElement)
  useEventHandler("mousedown", onMouseDown, Priority.PUSH_PULL, sceneManager.renderer.domElement)
  useEventHandler("mouseup", onMouseUp, Priority.PUSH_PULL)
  useEventHandler("keydown", commitOnEnter, Priority.PUSH_PULL)
  useObjectLifecycle(pushPullHandle, showHandle)
  useObjectLifecycle(snappedElevationObject)

  const field: ControlContextValue = {
    value: pushPullHandle.position.z,
    type: "masl",
    change: (val) => {
      if (val) debouncedOnComplete(val)
    },
  }
  return <>{isEditingElevation && <FloatingToolInputs focus={() => {}} fields={[field]} cancel={cancel} />}</>
}
