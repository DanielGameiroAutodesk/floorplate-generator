import { useRecoilState, useResetRecoilState, useSetRecoilState } from "recoil"
import { useCallback, useEffect, useMemo, useReducer, useState } from "preact/compat"
import type { BufferGeometry, Raycaster } from "three"
import { Group, Matrix4, Mesh, Plane, Vector3 } from "three"
import { lineBuildingApi } from "./lineBuildingApi"
import { EditModeLineBuildingVisuals } from "./LineBuildingVisuals"
import { lineBuildingActiveToolAtom, quickDrawTemporaryDumpAtom } from "./quickDrawState"
import { graphToShapeWithIDs, transformGraph, transformShapeWithIDs } from "./helpers/shapeGraphHelpers"
import { isGraphValid, moveGraphToCenterLine, moveGraphToSideLine } from "./helpers/lineAlignment"
import { indexOfVerticesInHoverDistance } from "./shapeToolFragments"
import type { DragData } from "./helpers/snapPositionOnVertexDrag"
import { getSnappedVertexOnDragData } from "./helpers/snapPositionOnVertexDrag"
import { Set_shallowEquals } from "src/lib/set"
import { getVertexElevation } from "./helpers/getVertexElevation"
import { DragVertexSnappingVisual, GraphToolVisual, SelectionVisuals } from "./EditVisuals"
import type { AddPointData } from "./addPointToLine"
import { getAddPointToLinePoint, getUpdatedGraphOnAddingPoint } from "./addPointToLine"
import type { HoveredSectionCut } from "./helpers/sectionDragging"
import {
  getHoveredSection,
  getSnappedPositionOnSectionCutDrag,
  getUpdatedSectionPropsAfterSectionDrag,
} from "./helpers/sectionDragging"
import { SectionCutVisual } from "./SectionCutVisuals"
import { SectionDragLengthInputBox } from "./FloatingInputBox/SectionDragLengthInputBox"
import { AddSectionCutTool } from "./AddSectionCutTool"
import { useGetLineBuildingLiveVisuals } from "./getLineBuildingLiveVisuals"
import { useUpdateLineBuildingElement } from "./elementApiHooks"
import type { OtherBuildingDragSnapData } from "./dragToOtherBuilding"
import { useGetOtherLineBuildingDragSnapData } from "./dragToOtherBuilding"
import { getTranslator } from "src/i18n"
import { OtherBuildingDragSnapVisuals } from "./DragVertexVisuals"
import { EditOtherBuildingsVisuals } from "./EditOtherBuildingsVisuals"
import type { VertexDragInputData } from "./FloatingInputBox/VertexDragInputBox"
import { VertexDragInputBox } from "./FloatingInputBox/VertexDragInputBox"
import { getUpdatedGraphAfterVertexDrag } from "./helpers/updateGraphAfterVertexDrag"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool } from "src/core/toolsState"
import { LineBuildingToolBar } from "./LineBuildingToolBar"
import { elementState } from "src/core/elements/ElementState"
import { HiddenPaths } from "src/core/hidden"
import { useComputed } from "@preact/signals"
import { defaultCursor, setPointerCursor } from "src/integrations/cursors/setCursor"
import {
  resetFadeAllExceptSignal,
  resetHoveredIdsSignal,
  setFadeAllExceptSignalValue,
} from "src/core/selection/selectionState"
import sceneManager from "src/core/three/sceneManager"
import { SelectionBox2 } from "src/integrations/tools-common/Selection/SelectionBox2"
import { SelectionBoxOverlay } from "src/integrations/tools-common/Selection/SelectionBoxOverlay"
import { mousePosition } from "src/core/useMousePosition"
import { UndoRedoHotkeyBindings } from "src/integrations/tools-common/UndoRedoHotkeyBindings"
import type { GraphZ } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { useIsImperial } from "src/lib/unitSettings"

function updateSelectionIDs(oldIds: string[], clickedId: string | undefined, shift: boolean): string[] {
  if (clickedId === undefined) {
    return []
  }
  if (shift && oldIds.includes(clickedId)) return oldIds.filter((id) => id !== clickedId)
  if (shift && !oldIds.includes(clickedId)) return [...oldIds, clickedId]
  if (!shift && (!oldIds.includes(clickedId) || oldIds.length > 1)) return [clickedId]
  return []
}

const UP = new Vector3(0, 0, 1)
const lockPlane = new Plane()

function useGetUnSnappedPosition() {
  return useCallback((mousePosition: Raycaster, zValue: number): Vector3 | undefined => {
    lockPlane.set(UP, -zValue)
    return mousePosition.ray.intersectPlane(lockPlane, new Vector3()) || undefined
  }, [])
}

function getPositionFromMouseEvent(event: MouseEvent) {
  return [(event.offsetX / window.innerWidth) * 2 - 1, -(event.offsetY / window.innerHeight) * 2 + 1]
}

export const simpleReducer = (state: any, action: any) => {
  return { ...state, ...action }
}

const selectionBox = new SelectionBox2(sceneManager.camera)
const selectionHelper = new SelectionBoxOverlay(sceneManager.renderer.domElement.parentElement, "select-box")

type DragVertex = { x: number; y: number; z: number; id: string }
type DragVertexProps = {
  dragVertex: undefined | DragVertex
  hoveredVertexId: undefined | string
  dragVertexData: undefined | DragData
  isVertexMoved: boolean
  inputData: undefined | VertexDragInputData
}

type DragSectionProps = {
  hoveredSectionCut: undefined | HoveredSectionCut
  dragSectionCut: undefined | HoveredSectionCut
  isSectionMoved: boolean
}

function EditLineBuildingTool({
  parameters,
  worldMatrix,
  transSideGraph,
  initVertices,
  dbClickedElementId,
  otherBuildingsSnapData,
  disableSnapping,
}: {
  parameters: any
  worldMatrix: Matrix4
  transSideGraph: GraphZ
  initVertices: { x: number; y: number; z: number; id: string }[]
  dbClickedElementId: string
  otherBuildingsSnapData: OtherBuildingDragSnapData
  disableSnapping: boolean
}) {
  const imperialFlag = useIsImperial()
  const [temporaryDumpStat, setTemporaryDumpStat] = useRecoilState(quickDrawTemporaryDumpAtom)
  const resetTemporaryDumpStat = useResetRecoilState(quickDrawTemporaryDumpAtom)
  const [hoveredSectionIds, setHoveredSectionIds] = useState<string[]>([])

  const updateElement = useUpdateLineBuildingElement(dbClickedElementId, worldMatrix)
  const getUnSnappedPosition = useGetUnSnappedPosition()

  const [vertexDraggingData, updateVertexDraggingData] = useReducer<DragVertexProps, any>(simpleReducer, {
    hoveredVertexId: undefined,
    dragVertex: undefined,
    dragVertexData: undefined,
    isVertexMoved: false,
    inputData: undefined,
  })

  const [dragSectionCutData, updateSectionCutData] = useReducer<any, any>(simpleReducer, {})
  const [sectionDraggingData, updateSectionDraggingData] = useReducer<DragSectionProps, any>(simpleReducer, {
    hoveredSectionCut: undefined,
    dragSectionCut: undefined,
    isSectionMoved: false,
  })

  const [addingPoint, setAddingPoint] = useState<boolean>(false)
  const [addPointLiveData, setAddPointData] = useState<AddPointData | undefined>(undefined)

  useEffect(() => {
    return () => {
      selectionHelper.onSelectOver()
      resetTemporaryDumpStat()
    }
  }, [resetTemporaryDumpStat])

  const hitBoxes = useMemo(() => {
    return lineBuildingApi.getSectionHitBoxes(parameters)
  }, [parameters])

  const selectedSectionIds = useMemo(() => {
    if (temporaryDumpStat.selectedSectionIds?.length) return temporaryDumpStat.selectedSectionIds
    return Array.from(Object.values(hitBoxes).map((hb: any) => hb.hitBoxID as string))
  }, [hitBoxes, temporaryDumpStat.selectedSectionIds])

  const allSectionsSelected = useMemo(() => {
    const allSectionIds = Object.values(hitBoxes).map((hb: any) => hb.hitBoxID as string)
    const selected = new Set(selectedSectionIds)
    return allSectionIds.every((id) => selected.has(id))
  }, [hitBoxes, selectedSectionIds])

  const targetMeshes = useMemo(() => {
    const targetGroup = new Group()
    Object.values(hitBoxes).forEach((hitBox: any) => {
      const hitBoxGeo: BufferGeometry = hitBox.geometry.clone()
      hitBoxGeo.applyMatrix4(worldMatrix)
      const mesh = new Mesh(hitBoxGeo)
      mesh.name = hitBox.hitBoxID
      targetGroup.add(mesh)
    })
    return targetGroup
  }, [hitBoxes, worldMatrix])

  const moveVertexOnMouseMoveAndInputUpdate = useCallback(
    (mousePosition: Raycaster, dragVertex: DragVertex, fixedInputData: VertexDragInputData | undefined) => {
      const position = getUnSnappedPosition(mousePosition, dragVertex.z)
      const shapeToolLines = disableSnapping ? [] : raycastApi.snapping.getLinesAtMousePosition_UNSTABLE()
      if (!position) return
      const dragVertexData = getSnappedVertexOnDragData({
        position,
        dragVertex,
        fixedInputData: fixedInputData,
        transSideGraph,
        parameters,
        otherBuildingsSnapData,
        shapeToolLines,
      })
      updateVertexDraggingData({ dragVertexData, isVertexMoved: true })
      return
    },
    [getUnSnappedPosition, disableSnapping, transSideGraph, parameters, otherBuildingsSnapData],
  )

  useEffect(() => {
    const mousemove = (e: MouseEvent) => {
      const altKeyDown = e.altKey

      if (vertexDraggingData.dragVertex !== undefined) {
        moveVertexOnMouseMoveAndInputUpdate(mousePosition, vertexDraggingData.dragVertex, vertexDraggingData.inputData)
        return
      }
      if (sectionDraggingData.dragSectionCut !== undefined) {
        const dragSectionCut = sectionDraggingData.dragSectionCut
        const position = getUnSnappedPosition(mousePosition, dragSectionCut.roofZ)
        if (!position) return
        const dragSectionCutData = getSnappedPositionOnSectionCutDrag({
          position,
          dragSectionCut,
          transSideGraph,
          parameters,
          imperialFlag,
        })
        updateSectionCutData(dragSectionCutData)
        updateSectionDraggingData({ isSectionMoved: true })
        return
      }
      if (altKeyDown) {
        const hitTargets = mousePosition.intersectObjects([targetMeshes])
        const addPointToLinePoint = getAddPointToLinePoint(hitTargets, transSideGraph, parameters)
        setAddPointData(addPointToLinePoint)
        return
      }

      selectionHelper.onSelectMove(e)
      if (selectionHelper.isReady && !selectionHelper.isSelectionActive && selectionHelper.getSizeOfBox() > 250) {
        selectionHelper.activate()
      }

      const hoveredVertexIndex = indexOfVerticesInHoverDistance(mousePosition, initVertices)
      if (selectionHelper.isSelectionActive) {
        const end = getPositionFromMouseEvent(e)
        selectionBox.endPoint.set(end[0], end[1], 0.5)
        const hoveredTargetIds: Set<string> = new Set(selectionBox.select().map((t) => t.name))
        if (!Set_shallowEquals(hoveredTargetIds, new Set(hoveredSectionIds))) {
          setHoveredSectionIds(Array.from(hoveredTargetIds))
        }
      } else if (hoveredVertexIndex !== -1) {
        setHoveredSectionIds((current) => (current.length ? [] : current))
        const hoveredVertex = initVertices[hoveredVertexIndex]
        updateVertexDraggingData({ hoveredVertexId: hoveredVertex.id })
      } else {
        const hitTargets = mousePosition.intersectObjects([targetMeshes])

        const sectionCutHit = getHoveredSection(
          hitTargets,
          transSideGraph,
          parameters.sectionProps,
          parameters.floorHeight,
          parameters.width,
          parameters.lineAlignment,
        )
        if (sectionCutHit) {
          setHoveredSectionIds((current) => (current.length ? [] : current))
          updateVertexDraggingData({ hoveredVertexId: undefined })
          updateSectionDraggingData({ hoveredSectionCut: sectionCutHit })
          return
        }
        const sectionId = hitTargets[0]?.object?.name
        setHoveredSectionIds((current) => (current.length === 1 && current[0] === sectionId ? current : [sectionId]))
        updateVertexDraggingData({ hoveredVertexId: undefined })
        updateSectionDraggingData({ hoveredSectionCut: undefined })
      }
    }
    const mouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const altKeyDown = e.altKey
      if (vertexDraggingData.dragVertex || sectionDraggingData.dragSectionCut) {
        return
      }

      const hoveredVertexIndex = indexOfVerticesInHoverDistance(mousePosition, initVertices)
      if (hoveredVertexIndex !== -1) {
        updateSectionDraggingData({ hoveredSectionCut: undefined })
        setTemporaryDumpStat((oldState: any) => ({ ...oldState, selectedSectionIds: [] }))
        const dragVertex = initVertices[hoveredVertexIndex]
        const position = new Vector3(dragVertex.x, dragVertex.y, dragVertex.z)
        const shapeToolLines = disableSnapping ? [] : raycastApi.snapping.getLinesAtMousePosition_UNSTABLE()
        const dragVertexData = getSnappedVertexOnDragData({
          position,
          dragVertex,
          fixedInputData: vertexDraggingData.inputData,
          transSideGraph,
          parameters,
          otherBuildingsSnapData,
          shapeToolLines,
        })
        const inputData: VertexDragInputData = {
          fixedPrevCornerAngle: undefined,
          fixedNextCornerAngle: undefined,
          fixedNextEdgeLength: undefined,
          fixedPrevEdgeLength: undefined,
        }
        updateVertexDraggingData({ dragVertex, dragVertexData, inputData, isVertexMoved: false })
      } else if (altKeyDown) {
        setAddingPoint(true)
        const hitTargets = mousePosition.intersectObjects([targetMeshes])
        const addPointToLinePoint = getAddPointToLinePoint(hitTargets, transSideGraph, parameters)
        if (!addPointToLinePoint || addPointToLinePoint.snappedToVertex) return
        const updatedSideGraph = getUpdatedGraphOnAddingPoint(transSideGraph, addPointToLinePoint)
        const centerGraph = moveGraphToCenterLine(updatedSideGraph, parameters)
        updateElement(centerGraph, parameters)

        Analytics.trackEditElement(
          EventName.Edit,
          { feature_category: FeatureCategory.DesignTool, feature: "line_building", object_type: "element" },
          { category: "building", line_building_action_type: "add-vertex" },
        )
      } else {
        const hitTargets = mousePosition.intersectObjects([targetMeshes])
        const dragSectionCut = getHoveredSection(
          hitTargets,
          transSideGraph,
          parameters.sectionProps,
          parameters.floorHeight,
          parameters.width,
          parameters.lineAlignment,
        )
        if (dragSectionCut) {
          const position = getUnSnappedPosition(mousePosition, dragSectionCut.roofZ)
          if (!position) return
          const dragSectionCutData = getSnappedPositionOnSectionCutDrag({
            position,
            dragSectionCut,
            transSideGraph,
            parameters,
            imperialFlag,
          })
          updateSectionCutData({ ...dragSectionCutData, fixedBeforeLength: undefined, fixedAfterLength: undefined })
          updateSectionDraggingData({
            hoveredSectionCut: undefined,
            dragSectionCut,
            isSectionMoved: false,
          })

          return
        }
        const start = getPositionFromMouseEvent(e)
        selectionBox.setCamera(sceneManager.camera)
        selectionBox.startPoint.set(start[0], start[1], 0.5)
        selectionBox.setObjects(targetMeshes.children)
        selectionHelper.onSelectStart(e)
        selectionHelper.onSelectStart(e)
      }
    }
    const mouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      setAddingPoint(false)
      if (vertexDraggingData.dragVertex !== undefined) {
        if (!vertexDraggingData.isVertexMoved) return
        updateVertexDraggingData({ dragVertexData: undefined, dragVertex: undefined })
        const dragVertex = vertexDraggingData.dragVertex
        const position = getUnSnappedPosition(mousePosition, dragVertex.z)
        if (!position) return
        const shapeToolLines = disableSnapping ? [] : raycastApi.snapping.getLinesAtMousePosition_UNSTABLE()
        const dragVertexData = getSnappedVertexOnDragData({
          position,
          dragVertex,
          fixedInputData: vertexDraggingData.inputData,
          transSideGraph,
          parameters,
          otherBuildingsSnapData,
          shapeToolLines,
        })
        const { graph: updatedSideGraph, parameters: updatedParameters } = getUpdatedGraphAfterVertexDrag(
          transSideGraph,
          dragVertexData,
          !!dragVertex,
          otherBuildingsSnapData,
          parameters,
        )
        const validGraph = isGraphValid(updatedSideGraph, updatedParameters.width, updatedParameters.lineAlignment)
        if (!validGraph) return
        const centerGraph = moveGraphToCenterLine(updatedSideGraph, updatedParameters)
        const removeElement = dragVertexData?.otherBuildingSnapData?.path
        updateElement(centerGraph, updatedParameters, removeElement)
        Analytics.trackEditElement(
          EventName.Edit,
          { feature_category: FeatureCategory.DesignTool, feature: "line_building", object_type: "element" },
          { category: "building", line_building_action_type: "edit-graph" },
        )
        return
      }
      if (sectionDraggingData.dragSectionCut !== undefined) {
        if (!sectionDraggingData.isSectionMoved) return
        const dragSectionCut = sectionDraggingData.dragSectionCut
        const updatedSectionProps = getUpdatedSectionPropsAfterSectionDrag({
          sectionProps: parameters.sectionProps,
          dragSectionCut,
          dragSectionCutData,
          graph: transSideGraph,
        })
        const updatedParameters = { ...parameters, sectionProps: updatedSectionProps }
        const centerGraph = moveGraphToCenterLine(transSideGraph, parameters)
        updateElement(centerGraph, updatedParameters)
        updateSectionCutData(undefined)
        updateSectionDraggingData({
          hoveredSectionCut: undefined,
          dragSectionCut: undefined,
        })

        return
      }
      if (addingPoint) {
        return
      }
      if (selectionHelper.isSelectionActive) {
        const dragEnd = getPositionFromMouseEvent(e)
        selectionBox.endPoint.set(dragEnd[0], dragEnd[1], 0.5)
        const selectTargets = selectionBox.select()
        const selectTargetPaths = new Set(selectTargets.map((t) => t.name))

        let newSelection = selectTargetPaths
        if (e.shiftKey) {
          newSelection = new Set(
            selectedSectionIds
              .filter((s) => !selectTargetPaths.has(s))
              .concat(Array.from(selectTargetPaths).filter((s) => !selectedSectionIds?.includes(s))),
          )
        }
        if (!Set_shallowEquals(newSelection, new Set(selectedSectionIds))) {
          setTemporaryDumpStat((oldState: any) => ({ ...oldState, selectedSectionIds: Array.from(newSelection) }))
        }
      } else {
        const hitTargets = mousePosition.intersectObjects([targetMeshes])
        const sectionId = hitTargets[0]?.object?.name
        const updatedSelectionIds = updateSelectionIDs(selectedSectionIds, sectionId, e.shiftKey)
        setTemporaryDumpStat((oldState: any) => ({ ...oldState, selectedSectionIds: updatedSelectionIds }))
      }
      selectionHelper.onSelectOver()
    }

    const keyup = (e: KeyboardEvent) => {
      if (!e.altKey) setAddPointData(undefined)
    }

    document.addEventListener("mousemove", mousemove)
    document.addEventListener("mousedown", mouseDown)
    document.addEventListener("mouseup", mouseUp)
    document.addEventListener("keyup", keyup)
    return () => {
      document.removeEventListener("mousemove", mousemove)
      document.removeEventListener("mousedown", mouseDown)
      document.removeEventListener("mouseup", mouseUp)
      document.removeEventListener("keyup", keyup)
    }
  }, [
    targetMeshes,
    setTemporaryDumpStat,
    selectedSectionIds,
    initVertices,
    vertexDraggingData,
    updateVertexDraggingData,
    parameters,
    transSideGraph,
    getUnSnappedPosition,
    updateElement,
    hoveredSectionIds,
    addingPoint,
    imperialFlag,
    dragSectionCutData,
    otherBuildingsSnapData,
    sectionDraggingData,
    updateSectionDraggingData,
    moveVertexOnMouseMoveAndInputUpdate,
    disableSnapping,
  ])

  const liveVisuals = useGetLineBuildingLiveVisuals({
    parameters,
    transSideGraph,
    initVertices,
    dragVertex: vertexDraggingData.dragVertex,
    dragVertexData: vertexDraggingData.dragVertexData,
    dragSectionCut: sectionDraggingData.dragSectionCut,
    dragSectionCutData,
    otherBuildingsSnapData,
  })
  return (
    <>
      {liveVisuals && (
        <EditModeLineBuildingVisuals building={liveVisuals.building} transform={liveVisuals.buildingTranslation} />
      )}
      {otherBuildingsSnapData && (
        <EditOtherBuildingsVisuals
          otherBuildingsSnapData={otherBuildingsSnapData}
          dragVertexData={vertexDraggingData.dragVertexData}
        />
      )}
      {!vertexDraggingData.dragVertex &&
        !sectionDraggingData.dragSectionCut &&
        (selectedSectionIds || hoveredSectionIds) && (
          <SelectionVisuals
            hitBoxes={hitBoxes}
            selectedSectionIds={selectedSectionIds}
            hoveredSectionIds={hoveredSectionIds}
            worldMatrix={worldMatrix}
            allSectionsSelected={allSectionsSelected}
          />
        )}
      {parameters.sectionToggle && !vertexDraggingData.dragVertex && (
        <SectionCutVisual
          hoveredSectionCut={sectionDraggingData.hoveredSectionCut}
          dragSectionCut={sectionDraggingData.dragSectionCut}
          dragSectionCutData={dragSectionCutData}
          transSideGraph={transSideGraph}
          sectionProps={parameters.sectionProps}
          floorHeight={parameters.floorHeight}
          width={parameters.width}
          lineAlignment={parameters.lineAlignment}
        />
      )}
      <GraphToolVisual
        hoveredVertexId={vertexDraggingData.hoveredVertexId}
        roofLines={liveVisuals.roofLines}
        liveVertices={liveVisuals.liveVertices}
        addPointLiveData={addPointLiveData}
        validGraph={liveVisuals.validGraph}
        roofLineActive={allSectionsSelected}
      />
      {sectionDraggingData.dragSectionCut && dragSectionCutData && (
        <SectionDragLengthInputBox
          dragSectionCutData={dragSectionCutData}
          updateSectionCutData={updateSectionCutData}
        />
      )}
      {vertexDraggingData.dragVertex && vertexDraggingData.dragVertexData && vertexDraggingData.inputData && (
        <VertexDragInputBox
          vertexDragInputData={vertexDraggingData.inputData}
          dragVertexData={vertexDraggingData.dragVertexData}
          transSideGraph={transSideGraph}
          updateVertexDragInputData={(updatedInputData) => {
            if (vertexDraggingData.dragVertex !== undefined)
              moveVertexOnMouseMoveAndInputUpdate(mousePosition, vertexDraggingData.dragVertex, updatedInputData)
            updateVertexDraggingData({ inputData: updatedInputData })
          }}
        />
      )}
      {vertexDraggingData.dragVertex && otherBuildingsSnapData && vertexDraggingData.dragVertexData && (
        <OtherBuildingDragSnapVisuals
          otherBuildingsSnapData={otherBuildingsSnapData}
          dragVertexData={vertexDraggingData.dragVertexData}
        />
      )}
      {vertexDraggingData.dragVertex && (
        <DragVertexSnappingVisual snappingLines={vertexDraggingData?.dragVertexData?.snappedToLines} />
      )}
    </>
  )
}

export function getLineBuildingEditConfig(path: string): ToolCfg {
  return {
    id: "editLineBuilding",
    tool: () => <EditLineBuilding path={path} />,
    toolbar: () => <LineBuildingToolBar />,
    propertyPanel: "default",
  }
}

export function EditLineBuilding({ path }: { path: string }) {
  const element = elementState.currentSnapshot.value.getNode(path)?.element
  const resetEditUrn = exitCurrentTool
  const setTemporaryDumpStat = useSetRecoilState(quickDrawTemporaryDumpAtom)

  useErrorBoundary((error, errorInfo) => {
    console.error("Edit line building error: ", error)
    console.warn("errorInfo", errorInfo)
    console.log("The element with crash: ")
    console.log(JSON.stringify(element))
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.lineBuilding.failedToEdit), status: "warning" })
    captureException(error, { tags: { owner: "squad-composition" }, extra: { errorInfo } })
    setTemporaryDumpStat((current: any) => ({ ...current, selectedSectionIds: [] }))
    resetEditUrn()
  })

  // The user might Ctrl-Z (undo) and cause the element to be removed from the proposal while the tool
  // is active. We therefore force an exit of the tool if the element suddenly goes out of existence
  useEffect(() => {
    if (!element) exitCurrentTool()
  }, [element])

  return element ? <EditLineBuildingInner editElementPath={path} /> : null
}

function EditLineBuildingInner({ editElementPath }: { editElementPath: string }) {
  const resetEditUrn = exitCurrentTool
  const toplevel = useComputed(() =>
    elementState.currentProposalSignal.value.getToplevelNodes().map((node) => ({
      element: node.elementContainer.element,
      path: node.path,
      worldTransform: node.globalMatrix,
      isInBase: node.isInBase,
      hidden: node.getIsHiddenReactive(),
    })),
  ).value

  const setTemporaryDumpStat = useSetRecoilState(quickDrawTemporaryDumpAtom)
  const [activeToolLineBuildingTool, setActiveLineBuildingTool] = useRecoilState(lineBuildingActiveToolAtom)

  const [disableSnapping, setDisableSnapping] = useState(false)

  useEffect(() => {
    setFadeAllExceptSignalValue([editElementPath])
    return () => resetFadeAllExceptSignal()
  }, [editElementPath])

  const { element, parameters, worldMatrix } = useMemo(() => {
    if (!editElementPath) return {}
    const tlElement = toplevel.find((tl) => tl.path === editElementPath)

    const element = tlElement?.element
    const parameters = element?.properties?.generator?.parameters
    const worldMatrix = tlElement?.worldTransform

    if (parameters === null) return {}

    return { element, parameters, worldMatrix }
  }, [editElementPath, toplevel])
  const otherBuildingsSnapData = useGetOtherLineBuildingDragSnapData(parameters, editElementPath)

  const initialShapeWithIDs = useMemo(() => {
    if (parameters == null || editElementPath == null) return null
    const lowestZ = 0
    const sideGraph = moveGraphToSideLine(parameters.graph, parameters)
    return transformShapeWithIDs(graphToShapeWithIDs(sideGraph, lowestZ), worldMatrix || new Matrix4())
  }, [editElementPath, parameters, worldMatrix])

  useEffect(() => {
    setPointerCursor()
    HiddenPaths.setPathHidden(editElementPath, true)
    for (let ob of otherBuildingsSnapData.otherLineBuildings) {
      HiddenPaths.setPathHidden(ob.path, true)
    }
    return () => {
      defaultCursor()
      HiddenPaths.setPathHidden(editElementPath, false)
      for (let ob of otherBuildingsSnapData.otherLineBuildings) {
        HiddenPaths.setPathHidden(ob.path, false)
      }
    }
  }, [editElementPath, otherBuildingsSnapData.otherLineBuildings])

  const [keydown, dblclick] = useMemo(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        setTemporaryDumpStat((current: any) => ({ ...current, selectedSectionIds: [] }))
        resetEditUrn()
        HiddenPaths.resetHiddenPaths()
        return Propagate.NO
      }
      if (e.key.toLowerCase() === "a" && (e.ctrlKey || e.metaKey)) {
        setTemporaryDumpStat((current) => ({ ...current, selectedSectionIds: undefined }))
        return Propagate.NO
      }
      if (e.key === "Alt" || e.key === "Option") {
        setDisableSnapping(true)
      }

      return Propagate.YES
    }
    const dblclick = () => {
      resetHoveredIdsSignal() // hotfix for retriggering issue ?
      resetEditUrn()
      HiddenPaths.resetHiddenPaths()
      return Propagate.NO
    }
    return [keydown, dblclick]
  }, [resetEditUrn, setTemporaryDumpStat])
  const keyup = useCallback((e: KeyboardEvent) => {
    if (e.key === "Alt" || e.key === "Option") {
      setDisableSnapping(false)
    }
    return Propagate.YES
  }, [])
  useEventHandler("keydown", keydown, Priority.TOOL)
  useEventHandler("keyup", keyup, Priority.TOOL)
  useEventHandler("dblclick", dblclick, Priority.TOOL)

  const transSideGraph: GraphZ = useMemo(() => {
    const graph = parameters.graph
    const sideGraph = moveGraphToSideLine(graph, parameters)
    return transformGraph(sideGraph, worldMatrix)
  }, [parameters, worldMatrix])

  const initVertices = useMemo(() => {
    return Object.values(transSideGraph.vertices).map((vertex) => {
      const z = getVertexElevation(parameters, vertex) + vertex.z
      return { ...vertex, z }
    })
  }, [parameters, transSideGraph])

  if (element == null || initialShapeWithIDs == null) return null

  const showSectionCutTool = activeToolLineBuildingTool === "addSectionCut"
  return (
    <>
      {showSectionCutTool && worldMatrix && editElementPath && (
        <AddSectionCutTool
          parameters={parameters}
          worldMatrix={worldMatrix}
          transSideGraph={transSideGraph}
          initVertices={initVertices}
          dbClickedElementId={editElementPath}
          exitTool={() => {
            setActiveLineBuildingTool(undefined)
          }}
        />
      )}
      {showSectionCutTool && otherBuildingsSnapData && (
        <EditOtherBuildingsVisuals otherBuildingsSnapData={otherBuildingsSnapData} />
      )}
      {!showSectionCutTool && worldMatrix && editElementPath && (
        <EditLineBuildingTool
          parameters={parameters}
          worldMatrix={worldMatrix}
          transSideGraph={transSideGraph}
          initVertices={initVertices}
          dbClickedElementId={editElementPath}
          otherBuildingsSnapData={otherBuildingsSnapData}
          disableSnapping={disableSnapping}
        />
      )}
      <UndoRedoHotkeyBindings />
    </>
  )
}
