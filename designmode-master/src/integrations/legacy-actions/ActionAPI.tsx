import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import { updateElementsInState_INTERNAL } from "./internal/updateElementsInState"
import type { Action } from "src/core/legacy-actions"
import { contextRootSignal, setSelectionSetSignalValue } from "src/core/selection/selectionState"
import { newChildKey } from "src/lib/element/urn"
import type { InternalPath } from "src/lib/element/path"
import {
  expandPathSetToIncludeDescendants,
  getLeafKey,
  getParentPath,
  getPathToUrn,
  ROOT_KEY,
} from "src/lib/element/path"
import { validateState } from "src/core/elements/validation/element-validation/validate"
import { createAddActionsRecursively, getPath, getUpdateSubtreeActions } from "./utils"
import type { TrackingData } from "src/core/analytics"
import {
  resetPreviewElementsSignal,
  resetPreviewSetSignal,
  setPreviewElementsSignalValue,
  setPreviewSetSignalValue,
} from "src/core/preview-element-state"
import { addData, getRepresentationOfKey } from "./internal/dependentState"
import { downloadAllElementData } from "src/core/elements-loading/downloadAllElementData"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"
import { findBasePath } from "src/lib/element/base"

import { assertNever } from "src/lib/assertNever"

import { analyticsAndBreadcrumbsForActions } from "src/core/analytics"
import { captureException } from "@sentry/browser"
import { elementContainerTreeFromObjects } from "src/core/elements/elementContainersFromObjects"
import type { RootContext } from "src/core/elements/ChildNodeContainer"
import { FormaElementBox } from "src/lib/element/statebox"
import { bindFormaElementLookupForBoxMap, bindFormaElementLookupForMap } from "src/lib/element/lookup"
import { isDebugEnabled } from "src/lib/debug"
import type { KnownRepresentations, RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { representationsByUrnAddEntry } from "src/core/elements/ElementRepresentations"
import { batch } from "@preact/signals"
import { getInMapOrThrow } from "src/lib/map"
import { isTerrainElement } from "src/core/terrain/terrain-types"
import { loadTerrainDataAndCreateElementContainer } from "src/core/terrain/terrain-container"
import type { UrnUpdate } from "./types"

export { type Action }

export interface ActionAPI {
  delete: {
    one(this: void, path: InternalPath): Action[]
    multiple(this: void, paths: InternalPath[]): Action[]
  }
  add: {
    /**
     * Adds a single element to the state
     * @param element
     * @param persisted
     * @param options
     */
    one(
      element: FormaElement,
      persisted: boolean,
      options?: {
        /** Defaults to current context path */
        parentPath?: InternalPath
        /** Will generate child key if omitted. Urn is omitted as the urn from the element is used */
        child?: Omit<Child, "urn">
        /** Representations for the element */
        representations?: KnownRepresentations
      },
    ): Action[]

    subTreeByRootUrn(
      this: void,
      urn: Urn,
      options?: {
        /** Defaults to current context path */
        parentPath?: InternalPath
        /** Will generate child key if omitted. Urn is omitted as the urn from the element is used */
        child?: Omit<Child, "urn">
      },
    ): Promise<Action[]>

    multiple(elements: FormaElement[], persisted: boolean): Action[]

    /**
     * Adds a whole subtree to state.
     * This function assumes that all child references within the subtree references provided elements.
     * @param subTreeRootUrn    Root of the subtree you want to add
     * @param elements          An object containing all the elements
     */
    subTree_UNSTABLE(
      subTreeRootUrn: Urn,
      elements: Map<Urn, FormaElement>,
      persisted: Set<Urn>,
      representations: RepresentationsByUrn,
      options?: {
        parentPath?: InternalPath
        child: Omit<Child, "urn">
      },
    ): Action[]
  }
  update: {
    one(
      path: InternalPath,
      element: FormaElement,
      persisted: boolean,
      options?: {
        child?: Omit<Child, "urn">
        representations?: KnownRepresentations
        cloneGeometry?: boolean
      },
    ): Action[]

    oneByUrn(
      this: void,
      path: InternalPath,
      urn: Urn,
      options?: {
        child: Omit<Child, "urn" | "key">
      },
    ): Promise<Action[]>

    subTree(
      path: InternalPath,
      rootUrn: Urn,
      elements: Map<Urn, FormaElement>,
      persisted: Set<Urn>,
      representations: RepresentationsByUrn,
      options?: {
        child?: Omit<Child, "urn" | "key">
        containers?: Map<Urn, ElementContainer>
      },
    ): Action[]
  }

  apply(
    this: void,
    name: string,
    actions: Action[],
    trackingData?: TrackingData,
    selectionUpdate?: Set<InternalPath> | ((t: Set<InternalPath>) => Set<InternalPath>),
    // An additional "terrain" parameter existed here previously.
  ): void

  preview_UNSTABLE(this: void, actions: Action[]): void
  resetPreview_UNSTABLE(this: void): void
  utils: {
    getPathOfAction: (this: void, action: Action) => InternalPath
    generateNewChildKey: (this: void) => string
  }
}

function toFormaElementBoxMap(elements: Map<Urn, FormaElement>, persisted: Set<Urn>) {
  const result = new Map<Urn, FormaElementBox>()
  for (const element of elements.values()) {
    result.set(
      element.urn,
      persisted.has(element.urn) ? FormaElementBox.fromServer(element) : FormaElementBox.fromDraft(element),
    )
  }
  return result
}

export function fromFormaElementBoxMap(value: Map<Urn, FormaElementBox>) {
  const elements = new Map<Urn, FormaElement>()
  const persisted = new Set<Urn>()

  for (const [urn, box] of value.entries()) {
    elements.set(urn, box.element)
    if (box.isServerState) persisted.add(urn)
  }

  return [elements, persisted] as const
}

function getContextForParentPath(parentPath: InternalPath): RootContext | undefined {
  const isProposal = parentPath === "root"
  const proposal = elementState.currentSnapshot.peek().rootNode.elementContainer.element
  const isBase = parentPath === findBasePath(proposal)
  return isProposal ? "proposal" : isBase ? "base" : undefined
}

function getAllElementObjectsForActions(actions: Action[], snapshot: ElementSnapshot) {
  const elements = new Map<Urn, FormaElementBox>()
  const representations: RepresentationsByUrn = {
    volumeMesh: new Map(),
    footprint: new Map(),
    terrainShape: new Map(),
    terrainTexture: new Map(),
    buildingFloors3DSketch_UNSTABLE: new Map(),
  }

  const copyRepresentationsFrom: Record<Urn, ElementContainer> = {}
  actions.forEach((action) => {
    if (action.type == "delete") return
    const urn = action.element.urn
    elements.set(
      urn,
      action.persisted ? FormaElementBox.fromServer(action.element) : FormaElementBox.fromDraft(action.element),
    )

    if (action.representations) {
      representationsByUrnAddEntry(representations, urn, action.representations)
    }

    if (action.type == "update" && action.cloneGeometry) {
      const sourceElementContainer = snapshot.getNode(action.path)?.elementContainer
      if (sourceElementContainer) copyRepresentationsFrom[urn] = sourceElementContainer
    }
  })

  return { elements, representations, copyRepresentationsFrom }
}

export function applyActionsUsingEdit(actions: Action[], snapshot: ElementSnapshot, edit: typeof elementState.edit) {
  const objects = getAllElementObjectsForActions(actions, snapshot)
  const containersAlreadyInSnapshot = snapshot.elements
  const newContainersCreatedNow: Record<Urn, ElementContainer> = {}

  for (const action of actions) {
    if ("container" in action && action["container"]) {
      const container = action["container"]
      newContainersCreatedNow[container.element.urn] = container
    }
  }

  if (isDebugEnabled) {
    console.log("Apply actions in element state", actions)
  }

  edit(({ addElement, updateElement, removeElement }) => {
    actions.forEach((action) => {
      switch (action.type) {
        case "create":
        case "add": {
          const container = elementContainerTreeFromObjects(
            action.element.urn,
            objects.elements,
            objects.representations,
            containersAlreadyInSnapshot,
            newContainersCreatedNow,
            objects.copyRepresentationsFrom,
          )

          const context = getContextForParentPath(action.parentPath)
          if (context) {
            addElement(context, { ...action.child, urn: action.element.urn }, container)
          }

          break
        }
        case "delete": {
          const parentPath = getParentPath(action.path)
          if (!parentPath) {
            console.error("Invalid parent path for new state", action.path)
            captureException(new Error(`Invalid parent path for new state: ${action.path}`))
            break
          }
          const context = getContextForParentPath(parentPath)
          if (!context) {
            console.error("Invalid context for new state", action)
            captureException(new Error(`Invalid context for new state: ${action.path}`))
            break
          }
          removeElement(context, getLeafKey(action.path))
          break
        }
        case "update": {
          if (action.path === ROOT_KEY) {
            captureException(new Error("Cannot update proposal directly"))
            console.error("Cannot update proposal directly")
            break
          }
          const parentPath = getParentPath(action.path)
          if (!parentPath) {
            console.error("Invalid parent path for new state", action.path)
            captureException(new Error(`Invalid parent path for new state: ${action.path}`))
            break
          }

          const prevContainer = snapshot.getNode(action.path)?.elementContainer
          if (!prevContainer) {
            console.error("Element not found for update", action)
            captureException(new Error(`Element not found for update: ${action.path}`))
            break
          }

          const container = elementContainerTreeFromObjects(
            action.element.urn,
            objects.elements,
            objects.representations,
            containersAlreadyInSnapshot,
            newContainersCreatedNow,
            objects.copyRepresentationsFrom,
          )

          const childKey = getLeafKey(action.path)
          const prevChild = snapshot.getNode(action.path)?.child

          const context = getContextForParentPath(parentPath)
          if (context) {
            updateElement(
              context,
              { ...(action.child ? action.child : prevChild), urn: action.element.urn, key: childKey },
              container,
            )
          }

          return
        }
        default:
          return assertNever(action)
      }
    })
  })
}

const deleteOne: ActionAPI["delete"]["one"] = (path: InternalPath) => {
  const action: Action<"delete"> = {
    type: "delete",
    path,
  }

  return [action]
}

const deleteMultiple: ActionAPI["delete"]["multiple"] = (paths: InternalPath[]) => {
  const actions: Action<"delete">[] = paths.map((path) => ({
    type: "delete",
    path,
  }))

  return actions
}

const addOne: ActionAPI["add"]["one"] = (
  element: FormaElement,
  persisted,
  options?: {
    parentPath?: string
    child: Omit<Child, "urn">
    representations?: KnownRepresentations
  },
) => {
  const action: Action<"add"> = {
    type: "add",
    parentPath: options?.parentPath ?? contextRootSignal.peek(),
    element: element,
    child: options?.child ?? { key: newChildKey() },
    representations: options?.representations,
    persisted,
  }
  return [action]
}

const addSubTree: ActionAPI["add"]["subTree_UNSTABLE"] = (
  subTreeRootUrn: Urn,
  elements: Map<Urn, FormaElement>,
  persisted: Set<Urn>,
  representations: RepresentationsByUrn,
  options?: { parentPath?: InternalPath; child: Omit<Child, "urn"> },
) => {
  const errors = validateState(subTreeRootUrn, bindFormaElementLookupForMap(elements))
  if (errors.length > 0) {
    console.warn(errors)
  }

  const parentPath = options?.parentPath ?? contextRootSignal.peek()
  return createAddActionsRecursively(
    parentPath,
    subTreeRootUrn,
    options?.child ?? { key: newChildKey() },
    toFormaElementBoxMap(elements, persisted),
    representations,
  )
}

const subTreeByRootUrn: ActionAPI["add"]["subTreeByRootUrn"] = async (
  urn: Urn,
  options?: { parentPath?: string; child?: Omit<Child, "urn"> },
) => {
  const { elements, representations } = await downloadAllElementData(new Set([urn]))
  const parentPath = options?.parentPath || "root"
  const child = { key: newChildKey(), ...options?.child, urn }

  return addSubTree(urn, ...fromFormaElementBoxMap(elements), representations, {
    parentPath,
    child,
  })
}

const addMultiple: ActionAPI["add"]["multiple"] = () => {
  throw new Error("Not implemented")
}

const updateOne: ActionAPI["update"]["one"] = (
  path: InternalPath,
  element: FormaElement,
  persisted,
  options?: { child?: Omit<Child, "urn">; representations?: KnownRepresentations; cloneGeometry?: boolean },
) => {
  const action: Action<"update"> = {
    type: "update",
    path: path,
    element: element,
    child: options?.child,
    cloneGeometry: options?.cloneGeometry,
    representations: options?.representations,
    persisted,
  }
  return [action]
}

const updateSubTree: ActionAPI["update"]["subTree"] = (
  path: InternalPath,
  rootUrn: Urn,
  elements: Map<Urn, FormaElement>,
  persisted: Set<Urn>,
  representations: RepresentationsByUrn,
  options?: {
    child?: Omit<Child, "urn" | "key">
    containers?: Map<Urn, ElementContainer>
  },
) => {
  return getUpdateSubtreeActions(
    path,
    rootUrn,
    options?.child,
    toFormaElementBoxMap(elements, persisted),
    representations,
    options?.containers ?? new Map([]),
  )
}

const updateSubtreeByUrn: ActionAPI["update"]["oneByUrn"] = async (
  path: InternalPath,
  rootUrn: Urn,
  options?: { child: Omit<Child, "urn" | "key"> },
) => {
  const { elements, representations } = await downloadAllElementData(new Set([rootUrn]))
  const containers = new Map<Urn, ElementContainer>()

  const rootElement = getInMapOrThrow(elements, rootUrn)
  if (getParentPath(path) === ROOT_KEY && isTerrainElement(rootElement.element)) {
    const container = await loadTerrainDataAndCreateElementContainer(rootElement.element)
    containers.set(container.element.urn, container)
  }

  return updateSubTree(path, rootUrn, ...fromFormaElementBoxMap(elements), representations, {
    ...options,
    containers,
  })
}

const apply = (
  name: string,
  actions: Action[],
  trackingData?: TrackingData,
  selectionUpdate?: Set<InternalPath> | ((t: Set<InternalPath>) => Set<InternalPath>),
) => {
  // In new tracking we track these in the apis for the different elements
  analyticsAndBreadcrumbsForActions(name, trackingData)
  batch(() => {
    applyActionsUsingEdit(actions, elementState.currentSnapshot.peek(), elementState.edit.bind(elementState))
    if (selectionUpdate) {
      setSelectionSetSignalValue(selectionUpdate)
    }
  })
  resetPreviewSetSignal()
  resetPreviewElementsSignal()
}

const preview = (actions: Action[]) => {
  const snapshot = elementState.currentSnapshot.peek()

  const prevState_rootUrn = snapshot.rootUrn
  const prevState_elements = snapshot.getFormaElementBoxes()

  const [appliedActions, newCoreState] = updateElementsInState_INTERNAL(
    actions,
    prevState_rootUrn,
    prevState_elements,
    (path) => snapshot.getNode(path)?.elementContainer.element.urn,
  )

  const updates: UrnUpdate[] = appliedActions
    .filter((a): a is Action<"update"> => a.type === "update" && a.cloneGeometry === true)
    .map((a) => ({
      oldUrn: snapshot.getNodeOrThrow(a.path).elementContainer.element.urn,
      newUrn: a.element.urn,
    }))

  const previewPathToUrn = getPathToUrn(bindFormaElementLookupForBoxMap(newCoreState.elements), newCoreState.rootUrn)

  const allExistingOrPreviewPaths = new Set([...snapshot.nodes.keys(), ...previewPathToUrn.keys()])
  const expandedPreviewSet = expandPathSetToIncludeDescendants(new Set(actions.map(getPath)), allExistingOrPreviewPaths)

  batch(() => {
    setPreviewSetSignalValue(expandedPreviewSet)

    const currentSnapshot = elementState.currentSnapshot.peek()

    setPreviewElementsSignalValue({
      rootUrn: newCoreState.rootUrn,
      elements: bindFormaElementLookupForBoxMap(newCoreState.elements),
      footprints: addData(
        updates,
        getRepresentationOfKey("footprint", actions),
        (urn) => currentSnapshot.getElementContainerOrThrow(urn).representations.footprint,
      ),
      volumeMeshes: addData(
        updates,
        getRepresentationOfKey("volumeMesh", actions),
        (urn) => currentSnapshot.getElementContainerOrThrow(urn).representations.volumeMesh,
      ),
      terrainShapes: addData(
        updates,
        getRepresentationOfKey("terrainShape", actions),
        (urn) => currentSnapshot.getElementContainerOrThrow(urn).representations.terrainShape,
      ),
      pathToUrn: previewPathToUrn,
    })
  })
}

const resetPreview = () => {
  resetPreviewSetSignal()
  resetPreviewElementsSignal()
}

export const actionApi: ActionAPI = {
  delete: {
    one: deleteOne,
    multiple: deleteMultiple,
  },
  add: {
    one: addOne,
    subTreeByRootUrn,
    multiple: addMultiple,
    subTree_UNSTABLE: addSubTree,
  },
  update: {
    one: updateOne,
    oneByUrn: updateSubtreeByUrn,
    subTree: updateSubTree,
  },
  apply,
  preview_UNSTABLE: preview,
  resetPreview_UNSTABLE: resetPreview,
  utils: {
    getPathOfAction: getPath,
    generateNewChildKey: newChildKey,
  },
}

export function useActionAPI(): ActionAPI {
  return actionApi
}
