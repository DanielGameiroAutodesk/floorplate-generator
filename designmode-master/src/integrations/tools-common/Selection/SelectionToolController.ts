import { SelectionBox2 } from "./SelectionBox2"
import sceneManager from "src/core/three/sceneManager"
import * as THREE from "three"
import type { Object3D } from "three"
import { Raycaster, Vector2 } from "three"
import { addEventHandler, Priority, Propagate, removeEventHandler } from "src/lib/eventManager"
import { Set_shallowEquals } from "src/lib/set"
import { SelectionBoxOverlay } from "./SelectionBoxOverlay"
import { getTargetPath, type RaycastData } from "src/core/selection/raycasting"
import { isDefined } from "src/lib/array"
import type { SelectionPath } from "src/core/selection/selectionTypes"

const overlayRaycaster = new Raycaster()

overlayRaycaster.params.Line = { threshold: 5 }
overlayRaycaster.params.Line2 = { threshold: 5 }
overlayRaycaster.params.Points = { threshold: 3 }

const MINIMUM_ACTIVATION_SIZE = 250

function getNewSelectionList(targetPath: string | undefined, shiftIsPressed: boolean, currentlySelected: string[]) {
  if (!targetPath) {
    return currentlySelected.length ? [] : currentlySelected
  }
  if (shiftIsPressed) {
    const index = currentlySelected.findIndex((s) => s === targetPath)
    if (index !== -1) {
      const copy = [...currentlySelected]
      copy.splice(index, 1)
      return copy
    } else {
      const alreadySelected = currentlySelected.some((path) => path === targetPath)
      const updatedSelection = alreadySelected
        ? [...currentlySelected.filter((path) => !(path === targetPath))]
        : [...currentlySelected, targetPath]
      return updatedSelection
    }
  } else {
    return currentlySelected.length === 1 && currentlySelected[0] === targetPath ? currentlySelected : [targetPath]
  }
}

function getPositionFromMouseEvent(event: MouseEvent) {
  return [(event.offsetX / window.innerWidth) * 2 - 1, -(event.offsetY / window.innerHeight) * 2 + 1]
}

export class SelectionToolController<T extends SelectionPath = SelectionPath, TData extends RaycastData = RaycastData> {
  private selectionBox: SelectionBox2
  private selectionHelper: SelectionBoxOverlay

  private selectionOnDown: Set<T>

  private tabIndex: number = 0

  private mouseUp1 = { time: 0, position: new Vector2() }
  private mouseUp2 = { time: 0, position: new Vector2() }

  //private raycastTargets: RaycastTargets = { targets3d: [], targets2dAs3d: [], overlayTargets: [] }

  private targets: Map<Object3D, TData>

  private currentSelection: Set<T> = new Set<T>()
  private currentHover: Set<T> = new Set<T>()

  private onHover: (hover: Set<T>) => void
  private onSelect: (selection: Set<T>) => void
  private onDoubleClick: (clickedPath: T | undefined) => void

  constructor(
    onHover: (hover: Set<T>) => void,
    onSelect: (selection: Set<T>) => void,
    onDoubleClick: (clickedPath: T | undefined) => void,
  ) {
    this.selectionBox = new SelectionBox2(sceneManager.camera)
    this.selectionHelper = new SelectionBoxOverlay(sceneManager.renderer.domElement.parentElement, "select-box")

    this.selectionOnDown = new Set<T>()
    this.onHover = onHover
    this.onSelect = onSelect
    this.onDoubleClick = onDoubleClick

    this.targets = new Map()
  }

  start() {
    addEventHandler("mousedown", this.mousedown.bind(this), Priority.SELECTION, sceneManager.canvas)
    addEventHandler("mousemove", this.mousemove.bind(this), Priority.SELECTION, sceneManager.canvas)
    addEventHandler("mouseup", this.mouseup.bind(this), Priority.SELECTION, sceneManager.canvas)
    addEventHandler("dblclick", this.doubleclick.bind(this), Priority.SELECTION, sceneManager.canvas)
    addEventHandler("keydown", this.cycleTargets.bind(this), Priority.SELECTION)
    addEventHandler("mouseout", this.mouseout.bind(this), Priority.SELECTION, sceneManager.canvas)
  }

  exit() {
    removeEventHandler("mousedown", Priority.SELECTION)
    removeEventHandler("mousemove", Priority.SELECTION)
    removeEventHandler("mouseup", Priority.SELECTION)
    removeEventHandler("dblclick", Priority.SELECTION)
    removeEventHandler("keydown", Priority.SELECTION)
    removeEventHandler("mouseout", Priority.SELECTION)
  }

  updateCallbacks(
    onHover: (hover: Set<T>) => void,
    onSelect: (selection: Set<T>) => void,
    onDoubleClick: (clickedPath: T | undefined) => void,
  ) {
    this.onHover = onHover
    this.onSelect = onSelect
    this.onDoubleClick = onDoubleClick
  }

  updateRaycastTargets(targets: Map<Object3D, TData>) {
    this.targets = targets
  }

  updateCurrentSelection(selection: Set<T>) {
    this.currentSelection = new Set(selection)
  }

  updateCurrectHover(hover: Set<T>) {
    this.currentHover = new Set(hover)
  }

  private mouseout() {
    this.onHover(new Set())
    return Propagate.YES
  }

  private mousedown(event: MouseEvent) {
    if (event.button !== THREE.MOUSE.LEFT) return Propagate.YES
    const start = getPositionFromMouseEvent(event)
    this.selectionBox.setCamera(sceneManager.camera)
    this.selectionBox.startPoint.set(start[0], start[1], 0.5)

    const objects = [...this.targets.entries()]
      .filter(([, data]) => data.raycastType === "3d")
      .map(([object]) => object)

    this.selectionBox.setObjects(objects)
    this.selectionHelper.onSelectStart(event)
    this.selectionOnDown = this.currentSelection
    return Propagate.NO
  }

  private mousemove(event: MouseEvent) {
    if (event.button !== THREE.MOUSE.LEFT) return Propagate.YES
    this.tabIndex = 0
    this.selectionHelper.onSelectMove(event)
    if (
      this.selectionHelper.isReady &&
      !this.selectionHelper.isSelectionActive &&
      this.selectionHelper.getSizeOfBox() > MINIMUM_ACTIVATION_SIZE
    ) {
      this.selectionHelper.activate()
    }
    if (this.selectionHelper.isSelectionActive) {
      const end = getPositionFromMouseEvent(event)
      this.selectionBox.endPoint.set(end[0], end[1], 0.5)
      const hoveredTargetIds: Set<T> = new Set(
        this.selectionBox
          .select()
          .map((object) => this.targets.get(object)?.selection as T | undefined)
          .filter(isDefined),
      )
      if (!Set_shallowEquals(hoveredTargetIds, this.currentHover)) {
        this.currentHover = hoveredTargetIds
        this.onHover(this.currentHover)
      }
      return Propagate.YES
    }
    const data = getTargetPath(event, sceneManager.camera, this.targets, 0)
    const targetPath = data?.selection as T | undefined

    if (targetPath && !(this.currentHover.size === 1 && Array.from(this.currentHover)[0] === targetPath)) {
      this.currentHover = new Set([targetPath])
      this.onHover(this.currentHover)
    } else if (this.currentHover.size > 0 && targetPath == null) {
      this.currentHover = new Set()
      this.onHover(this.currentHover)
    }
    return Propagate.NO
  }

  private mouseup(event: MouseEvent) {
    this.mouseUp2.time = this.mouseUp1.time
    this.mouseUp2.position.set(this.mouseUp1.position.x, this.mouseUp1.position.y)
    this.mouseUp1.time = new Date().getTime()
    this.mouseUp1.position.set(event.clientX, event.clientY)
    if (this.selectionHelper.isSelectionActive) {
      const dragEnd = getPositionFromMouseEvent(event)
      this.selectionBox.endPoint.set(dragEnd[0], dragEnd[1], 0.5)
      const selectTargetPaths = new Set(
        this.selectionBox
          .select()
          .map((object) => this.targets.get(object)?.selection as T | undefined)
          .filter(isDefined),
      )

      let newSelection = selectTargetPaths
      if (event.shiftKey) {
        newSelection = new Set<T>(
          Array.from(this.selectionOnDown)
            .filter((s) => !selectTargetPaths.has(s))
            .concat(Array.from(selectTargetPaths).filter((s) => !this.selectionOnDown.has(s))),
        )
      }
      if (!Set_shallowEquals(newSelection, this.currentSelection)) this.onSelect(newSelection)
    } else {
      const data = getTargetPath(event, sceneManager.camera, this.targets, this.tabIndex)
      if (event.button === 2 && this.currentSelection.size !== 0) return Propagate.YES
      const newSelectionList = getNewSelectionList(
        data?.selection,
        event.shiftKey,
        Array.from(this.currentSelection),
      ) as T[]
      this.onSelect(new Set(newSelectionList))
    }

    this.selectionHelper.onSelectOver()

    return Propagate.NO
  }

  private doubleclick() {
    if (
      this.mouseUp1.time - this.mouseUp2.time > 500 ||
      this.mouseUp1.position.distanceTo(this.mouseUp2.position) > 5
    ) {
      // only fire if the selection mouse up has been fired twice within reasonable time and with no movement
      return Propagate.YES
    }
    //TODO insert more logics here
    const targetPath = Array.from(this.currentHover)[0]
    this.onDoubleClick(targetPath)
    return Propagate.NO
  }

  private cycleTargets(event: KeyboardEvent) {
    if (event.key !== "Tab") return Propagate.YES
    if (event.target === sceneManager.canvas) {
      event.preventDefault()
    }

    this.tabIndex = this.tabIndex + 1

    const data = getTargetPath(undefined, sceneManager.camera, this.targets, this.tabIndex)
    const targetPath = data?.selection as T | undefined
    if (targetPath && !(this.currentHover.size === 1 && Array.from(this.currentHover)[0] === targetPath)) {
      this.currentHover = new Set([targetPath])
      this.onHover(this.currentHover)
    } else if (this.currentHover.size > 0 && targetPath == null) {
      this.currentHover = new Set()
      this.onHover(this.currentHover)
    }
    return Propagate.YES
  }
}
