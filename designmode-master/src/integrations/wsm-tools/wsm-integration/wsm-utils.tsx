import type { Transform } from "@spacemakerai/element-types"
import { METER_TO_FEET } from "@spacemakerai/forma-units"
import type { InternalPath } from "src/lib/element/path"
import { getParentPath } from "src/lib/element/path"
import { Box3, Matrix4 } from "three"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"

/**
 * Check if a history Id is valid. IMPORTANT: This does not check if the history itself
 * is valid, only the form of the ID.
 * @param id
 * @returns
 */
export function isHistoryIdValid(id?: number): boolean {
  if (typeof id === "undefined") {
    return false
  }

  console.assert(typeof WSM?.INVALID_ID !== "undefined", "isHistoryIdValid called before WSM is initialized")

  if (id == WSM.INVALID_ID || id < 0) {
    return false
  }

  return true
}

export function transposeTransform(transform: Transform | undefined): WSM.Transf3dInterface {
  const transposed = WSM.Transf3d.Transf3d()
  if (transform) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        // Copy the transposed matrix data.
        transposed.data[4 * i + j] = transform[4 * j + i]
      }
    }
  }
  return transposed
}

// Suppose S is scale transformation so | s 0 0 0 |
//                                      | 0 s 0 0 |
//                                      | 0 0 s 0 |
//                                      | 0 0 0 1 |
//  W is the world transformation | a1 a2 a3 t1 |
//                                | a4 a5 a6 t2 |
//                                | a7 a8 a9 t3 |
//                                | 0  0  0  1  |
// where a is the affine part and t is the translation.
// Then S * W * S^-1 is | a1 a2 a3 (s * t1) |
//                      | a4 a5 a6 (s * t2) |
//                      | a7 a8 a9 (s * t3) |
//                      | 0  0  0  1        |
// S * W * S^-1 is the result of the function in addition to transposing the
// original data to match WSM transf3d. Note this always assumes the scale is
// meters to feet. We need this transform as part of the transform on an
// instance.
export function createScaledPositionWorldTransform(worldTransform: Transform) {
  const transposedTransform = transposeTransform(worldTransform)

  //Only want to apply scale to translation
  transposedTransform.data[3] = transposedTransform.data[3] * METER_TO_FEET
  transposedTransform.data[7] = transposedTransform.data[7] * METER_TO_FEET
  transposedTransform.data[11] = transposedTransform.data[11] * METER_TO_FEET

  return transposedTransform
}

export function applyWorldTransform(
  groupInstancePath: WSM.GroupInstancePathInterface,
  transformToApply: WSM.Transf3dInterface,
  transformToInverse?: WSM.Transf3dInterface,
) {
  const finalGroupInstancePath: WSM.ObjectHistoryID = WSM.GroupInstancePath.GetFinalObjectHistoryID(groupInstancePath)

  let finalTransf3d = WSM.Geom.Transf3d()
  if (transformToInverse) {
    finalTransf3d = WSM.Geom.InvertTransform(transformToInverse)
  }

  finalTransf3d = WSM.Transf3d.Multiply(transformToApply, finalTransf3d)

  if (!WSM.Transf3d.IsIdentity(finalTransf3d)) {
    WSM.APITransformObject(finalGroupInstancePath.History, finalGroupInstancePath.Object, finalTransf3d)
  }
}

//A more performant mesh creation API. Does not (currently) support all the arguments of WSM.APICreateMesh
export function createWSMMeshUsingPointers(
  historyId: number,
  position: Float32Array,
  index: number[],
  transform: WSM.Transf3dInterface,
  computeEdges: boolean,
): number {
  console.time("createWSMMesh")
  const module = window.FormItModule

  const typedIndexArray = new Int32Array(index)
  const typedPositionsArray = position
  const positionsPointer = module._malloc(typedPositionsArray.length * typedPositionsArray.BYTES_PER_ELEMENT)
  module.HEAPF32.set(typedPositionsArray, positionsPointer / typedPositionsArray.BYTES_PER_ELEMENT)

  const indexPointer = module._malloc(typedIndexArray.length * typedIndexArray.BYTES_PER_ELEMENT)
  module.HEAP32.set(typedIndexArray, indexPointer / typedIndexArray.BYTES_PER_ELEMENT)

  const meshId = module.ccall(
    "FormItCore_CreateMeshFromTrianglesWithMemoryPointers",
    "number",
    ["number", "number", "number", "number", "number", "boolean"],
    [historyId, positionsPointer, typedPositionsArray.length, indexPointer, typedIndexArray.length, computeEdges],
  )

  if (!module._emscripten_builtin_free) {
    module._free(positionsPointer)
    module._free(indexPointer)
  } else {
    module._emscripten_builtin_free(positionsPointer)
    module._emscripten_builtin_free(indexPointer)
  }
  console.timeEnd("createWSMMesh")

  if (!WSM.Transf3d.IsIdentity(transform)) {
    WSM.APITransformObject(historyId, meshId, transform)
  }

  return meshId
}

//Important: need to call module _free after invoking ccall
export function allocateStringToMemoryAvailableToWASM(val: string) {
  let length = val.length
  let pointer = 0
  const module = window.FormItModule

  pointer = module._malloc(length)

  for (let i = 0; i < length; i++) {
    module.HEAP8[pointer + i] = val.charCodeAt(i)
  }

  return { pointer, length }
}

// The original wsm model state is stored in the map from history ids (reachable from reference history that
// that is being edited in i3ds) to the delta ids of the current state for each history. If any history delta
// has changed from the initial state, the function returns true meaning the wsm model needs to be saved. Note
// new histories require a change in the delta of a parent history. So we do not need to specifically look for
// created histories. Further non-temporary histories are expected to remain alive but look for this to be
// safe.
export function hasAnyInitalHistoryDeltaChanged(
  groupInstancePath: WSM.GroupInstancePathInterface,
  mapHistoryIdToInitialDeltaId: Map<number, number>,
): boolean {
  if (FormIt.Model.IsModified() === false) {
    // Nothing to save and no reason to check histories below.
    return false
  }

  if (mapHistoryIdToInitialDeltaId.size === 0) {
    // We don't expect an empty map here. Save in this case.
    console.error("History delta map is empty!")
    return true
  }

  if (groupInstancePath.ids.length === 0) {
    // We don't expect a bad group instance path. Save in this case.
    console.error("History delta map is empty!")
    return true
  }

  for (const [nHistId, nDeltaId] of mapHistoryIdToInitialDeltaId.entries()) {
    if (!WSM.APIIsHistoryLiveReadOnly(nHistId)) {
      console.error("We don't expect a deleted history here.")
      return true
    }

    const newDeltaId = WSM.APIGetIdOfActiveDeltaReadOnly(nHistId)
    if (newDeltaId !== nDeltaId) {
      if (nHistId === groupInstancePath.ids[0].History) {
        // Look for changes to the instance that is being edited. Other changes do not require
        // saving.
        const instanceChangesFromDelta = WSM.APIGetCreatedChangedAndDeletedInDeltaRangeReadOnly(
          nHistId,
          nDeltaId,
          newDeltaId,
          [WSM.nObjectType.nInstanceType],
        )

        if (
          !instanceChangesFromDelta.changed.includes(groupInstancePath.ids[0].Object) &&
          !instanceChangesFromDelta.deleted.includes(groupInstancePath.ids[0].Object)
        ) {
          // We only need to save if the top instance has changed in the main history.
          continue
        }
      }
      return true
    }
  }

  return false
}

// Function creates a map of history ids that are reachable from refHistId to their current delta ids. This map
// represents the model state at the time the map is created. Here it is used to test if the wsm model reachable
// from the edited group instance path has changed and needs to be saved. Also resets the FormIt is modified
// which probably isn't too helpful but faster when it works.
export function createInitialHistoryDeltaMapAndResetFormItModified(
  groupInstancePath: WSM.GroupInstancePathInterface,
  mapHistoryIdToInitialDeltaId: Map<number, number>,
) {
  FormIt.Model.ResetModified()
  if (groupInstancePath.ids.length === 0) {
    return
  }
  const inst = groupInstancePath.ids[groupInstancePath.ids.length - 1]
  const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(inst.History, inst.Object)
  const reachableHistories: number[] = WSM.APIGetAllReachableHistoriesReadOnly(refHistId, false /*bGoUp*/)

  // Add the main history so that we can check it for changes to the instance that is being edited.
  reachableHistories.push(groupInstancePath.ids[0].History)

  reachableHistories.forEach((nHistId: number) => {
    const nDeltaId = WSM.APIGetIdOfActiveDeltaReadOnly(nHistId)
    mapHistoryIdToInitialDeltaId.set(nHistId, nDeltaId)
  })
}

// Gets the ThreeJS Box3 (or undefined) bounding box for an element given an internal path. If
// the element itself does not contain the geometery then it's children are combined/unioned into
// a single box and returned instead
export function getBoundingBox3For3DSElement(snapshot: ElementSnapshot, path: InternalPath) {
  const currentNodeForElement = snapshot.getNode(path)
  let bboxElement
  if (
    currentNodeForElement?.elementContainer.element.properties?.spacemakerObjectStorageReferenceFormats?.[0] ===
      "axm" ||
    (currentNodeForElement?.elementContainer.element.properties?.category === "floor" &&
      isParent3DSElement(snapshot, path))
  ) {
    bboxElement = currentNodeForElement.elementContainer.bbox.getOrCompute()
    if (bboxElement === undefined) {
      if (currentNodeForElement.elementContainer.element.children) {
        for (let i = 0; i < currentNodeForElement.elementContainer.element.children.length; i++) {
          const child = currentNodeForElement.elementContainer.element.children[i]
          const childContainer = snapshot.elements.get(child.urn)
          let bboxChild = childContainer?.bbox.getOrCompute()?.clone()
          if (bboxChild && bboxChild instanceof Box3) {
            if (child.transform) {
              const matrix4 = new Matrix4().fromArray(child.transform)
              bboxChild.applyMatrix4(matrix4)
            }

            if (bboxElement === undefined) {
              bboxElement = bboxChild
            } else {
              bboxElement.union(bboxChild)
            }
          }
        }
      }
    }
  }

  return bboxElement
}

// Checks if the parent of the path is a 3d Sketch element
export function isParent3DSElement(snapshot: ElementSnapshot, path: InternalPath) {
  const parentPath = getParentPath(path)
  const parentElement = parentPath ? snapshot.getNode(parentPath)?.elementContainer.element : undefined
  return parentElement?.properties?.spacemakerObjectStorageReferenceFormats?.[0] === "axm"
}

// Checks if the 3d sketch element's wsm instance is valid and live
// Needed in cases where the instance is deleted but calls are still originating
// from message handlers that were assuming the instance is valid
export function is3dSketchInstanceValid(instance: WSM.GroupInstancePathInterface) {
  if (!WSM.GroupInstancePath.IsValid(instance)) return false

  // Get the instance of the 3d sketch element
  const { Object: objectId, History: historyId } = instance.ids[0]
  return WSM.APIIsObjectLiveReadOnly(historyId, objectId)
}
