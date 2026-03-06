import { Analytics } from "src/core/analytics"
import { TRIANGLE_LIMIT_ABSOLUTE_MAX, TRIANGLE_LIMIT_FLATTEN, TRIANGLE_LIMIT_MESH_TO_BODY } from "./limits"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

// Cosine of angle for Edge smoothness.  Currently 0.5 degrees.
const WSM_TIGHT_SMOOTH_COSINE_ANGLE = 0.999961923064

/** Check if instance has meshes, if so convert to brep */
export function prepareDataForEdit(
  groupInstancePath: WSM.GroupInstancePathInterface,
  setShowDisplayTriangleCountWarning: () => void,
): void {
  let meshesToConvert: number[] = []
  let objectsToDelete: number[] = []

  const finalObjectHistoryId = WSM.Utils.GetGroupInstancePathFinalObjectHistoryID(groupInstancePath)
  const refHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(
    finalObjectHistoryId.History,
    finalObjectHistoryId.Object,
  )
  if (refHistoryId === WSM.INVALID_ID) {
    throw new Error("invalid history")
  }

  const modelStats = FormIt.Utils.ModelStatisticsSummary(refHistoryId)
  const triangleCount = modelStats?.totalTriangles ?? 0
  // record triangle count in analytics
  Analytics.track(
    EventName.Use,
    {
      feature_category: FeatureCategory.DesignTool,
      feature: "3dSketch",
      sub_feature: "Triangle count (WSM)",
    },
    {
      num_triangles: triangleCount,
    },
  )

  // Special handling for large triangle counts. If we
  // hit the limit, we don't convert from mesh to brep
  let shouldConvert = true
  let flatten = true
  if (triangleCount >= TRIANGLE_LIMIT_ABSOLUTE_MAX) {
    // should show up in sentry breadcrumbs if this fails for some reason
    console.warn("Very large triangle count")
    setShowDisplayTriangleCountWarning()
    shouldConvert = false
  } else if (triangleCount >= TRIANGLE_LIMIT_MESH_TO_BODY) {
    shouldConvert = false
    setShowDisplayTriangleCountWarning()
  } else if (triangleCount >= TRIANGLE_LIMIT_FLATTEN) {
    // TODO?: Haven't found any messaging for the flatten case, so no warning here
    flatten = false
  }

  if (shouldConvert) {
    const allUnownedObjects = WSM.APIGetAllNonOwnedReadOnly(refHistoryId)

    for (const objectId of allUnownedObjects) {
      const type = WSM.APIGetObjectTypeReadOnly(refHistoryId, objectId)
      if (type === WSM.nObjectType.nMeshType) {
        if (flatten) {
          // Make sure meshes have edges for the conversion.
          WSM.APISetMeshEdgesComputed(refHistoryId, objectId, true)
        }
        meshesToConvert.push(objectId)
      } else if (type === WSM.nObjectType.nLineMeshType) {
        // We assume the line meshes correspond to the meshes and are not needed on conversion.
        objectsToDelete.push(objectId)
      }
    }

    if (meshesToConvert.length > 0) {
      FormIt.UndoManagement.BeginState()
      const bodyIds = WSM.APIConvertMeshesToObjects(
        refHistoryId,
        meshesToConvert,
        WSM_TIGHT_SMOOTH_COSINE_ANGLE,
        flatten,
      )

      // Make sure each body has one lump.
      bodyIds.forEach((bodyId) => {
        if (WSM.APIGetObjectTypeReadOnly(refHistoryId, bodyId) === WSM.nObjectType.nBodyType) {
          WSM.APISeparate(refHistoryId, bodyId)
        }
      })

      if (objectsToDelete.length > 0) {
        WSM.APIDeleteObjects(refHistoryId, objectsToDelete)
      }

      FormIt.UndoManagement.EndState("Prepare Data")
    }

    // Prevent undoing before the current State for refHistoryId
    const currentState = FormIt.UndoManagement.GetCurrentState(refHistoryId)
    FormIt.UndoManagement.SetMinimumHistoryStateID(refHistoryId, currentState)
  }
}
