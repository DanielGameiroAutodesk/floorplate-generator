import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import { useCallback, useEffect, useRef } from "preact/hooks"
import { Mesh, Object3D } from "three"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import { actionApi } from "src/integrations/legacy-actions/ActionAPI"

import type { InternalPath } from "src/lib/element/path"
import { getLeafKey, getParentPath, mergePath } from "src/lib/element/path"
import { getRepresentationsByUrn } from "src/core/elements-loading/loading"
import type { TrackingData } from "src/core/analytics"
import type { ElementAndPath } from "./GeneratorAdapter"
import { getObjectTransformOnTerrain } from "./terrain"
import { getElementsWithChildren } from "src/core/elements-loading/elementFetching"
import type { FormaElementBox } from "src/lib/element/statebox"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"
import { getInMapOrThrow } from "src/lib/map"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { representationsByUrnToKnownRepresentations } from "src/core/elements/ElementRepresentations"
import { setSelectionSignalValue } from "src/core/selection/selectionState"
import { batch } from "@preact/signals"
import { setGeneratorIdSignalValue } from "src/integrations/Toolbars/CoreToolbar/domain/generators/GeneratorsToolbar"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type DataCache = {
  elements: Map<Urn, FormaElementBox>
  representations: RepresentationsByUrn
}

function buildActionsForChildren(cache: DataCache, path: string, element: FormaElement): Action[] {
  return (element.children ?? []).flatMap((child) => {
    const childElementBox = getInMapOrThrow(cache.elements, child.urn)
    const childPath = mergePath(path, child.key)

    let result: Action[] = []
    result.push({
      type: "add",
      parentPath: path,
      element: childElementBox.element,
      child,
      representations: representationsByUrnToKnownRepresentations(cache.representations, child.urn),
      persisted: childElementBox.isServerState,
    })
    result = result.concat(buildActionsForChildren(cache, childPath, childElementBox.element))
    return result
  })
}

function buildActionsForUpdate(cache: DataCache, path: InternalPath, urn: Urn) {
  const elementBox = getInMapOrThrow(cache.elements, urn)

  let result: Action[] = []
  result.push({
    type: "update",
    path,
    element: elementBox.element,
    representations: representationsByUrnToKnownRepresentations(cache.representations, urn),
    persisted: elementBox.isServerState,
  })
  result = result.concat(buildActionsForChildren(cache, path, elementBox.element))
  return result
}

function buildActionsForAdd(cache: DataCache, parentPath: InternalPath, child: Child) {
  const urn = child.urn
  const path = mergePath(parentPath, child.key)
  const elementBox = getInMapOrThrow(cache.elements, urn)

  let result: Action[] = []
  result.push({
    type: "add",
    parentPath,
    element: elementBox.element,
    child,
    representations: representationsByUrnToKnownRepresentations(cache.representations, urn),
    persisted: elementBox.isServerState,
  })
  result = result.concat(buildActionsForChildren(cache, path, elementBox.element))
  return result
}

async function getElementsDataCache(elements: Map<Urn, FormaElementBox>): Promise<DataCache> {
  return {
    elements,
    representations: await getRepresentationsByUrn(bindFormaElementLookupForBoxMap(elements)),
  }
}

export type PersistSpec = { path: string; elementAndPath: ElementAndPath | undefined }

export function usePersist(
  spec: PersistSpec,
  setEditedElementPath: (
    editedElementPath: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void,
  extensionId: string,
) {
  let mounted = useRef(true)
  useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])

  const path = spec.path
  const latestPersist = useRef<symbol>()

  const latestPath = useRef(path)
  latestPath.current = path

  const isAddedToProposal = useRef(spec.elementAndPath != null)
  isAddedToProposal.current = spec.elementAndPath != null

  return useCallback(
    (newUrn: Urn) => {
      async function run() {
        const thisPersist = Symbol()
        latestPersist.current = thisPersist

        const elements = await getElementsWithChildren([newUrn])
        const element = getInMapOrThrow(elements, newUrn).element
        const cache = await getElementsDataCache(elements)

        // Avoid update after we've closed stuff.
        if (!mounted.current) {
          console.log("No longer mounted - aborting update")
          return
        }

        // If selection has changed (so no unmount) the path will
        // have changed and currently that means the isAddedToProposal
        // logic don't work. Ignore these as otherwise we risk
        // getting duplicate element creations.
        // This ignores the persist operation similarly as if unmounted.
        // We should rework how the methods and state is passed around
        // to clean up these states as it's become more complex than necessary.
        if (path !== latestPath.current) {
          console.log("Path changed - ignoring update")
          return
        }

        if (latestPersist.current !== thisPersist) {
          return
        }

        const isUpdate = isAddedToProposal.current

        const trackingData: TrackingData = {
          eventType: isUpdate ? "update" : "add",
          numElements: 1,
          tool: "generator",
          elementCategory: element?.properties?.category || "",
          extensionId: extensionId,
        }

        if (isUpdate) {
          actionApi.apply("Update generator element", buildActionsForUpdate(cache, path, newUrn), trackingData)
        } else {
          const parentPath = getParentPath(path)
          if (!parentPath) {
            throw new Error("Missing parent path")
          }

          const child: Child = {
            urn: newUrn,
            key: getLeafKey(path),
          }

          const object3D = new Object3D()
          Array.from(cache.representations.volumeMesh.values()).forEach((g) => {
            object3D.add(new Mesh(g))
          })
          const transform = getObjectTransformOnTerrain(object3D, terrainSignal.peek().elevationAt)

          const childWithTransform: Child = {
            ...child,
            transform: transform?.toArray(),
          }

          batch(() => {
            actionApi.apply(
              "Add generator element",
              buildActionsForAdd(cache, parentPath, childWithTransform),
              trackingData,
            )
            isAddedToProposal.current = true

            // Switch from "create element" to "select element".
            setSelectionSignalValue([path])
            setEditedElementPath(path)
            setGeneratorIdSignalValue(undefined)
          })
        }
      }
      void run()
    },
    [path, extensionId, setEditedElementPath],
  )
}
