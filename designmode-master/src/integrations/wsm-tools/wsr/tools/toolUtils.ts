import { cameraApi } from "src/integrations/camera/CameraAPI"
import { EasingFunctions } from "src/lib/easing"
import { WSMPoint3dFeetToVector3Meter } from "src/integrations/wsm-tools/wsr/integrated/utils"
import { feetToMeter } from "src/lib/measurementSystem"
import { minGFAUnitAreaInFeetSquared } from "src/integrations/wsm-tools/building/buildingFloorUtils"
import { WSM_DISTANCE_TOL, WSM_MACHINE_TOL } from "src/integrations/wsm-tools/wsr/api/types"
import { getTranslator, type I18nStringProvider } from "src/i18n"

function prettify(str: string) {
  const words = str.split("_")
  return words.map((x) => x[0] + x.slice(1).toLocaleLowerCase()).join(" ")
}

export function formItToolTypeToString(tt: FormIt.ToolType) {
  return prettify(formItToolTypeToEnumString(tt))
}

export const pathStartsWith = (path: WSM.GroupInstancePathInterface, startsWith: WSM.GroupInstancePathInterface) => {
  if (startsWith.ids.length > path.ids.length) {
    return false
  }

  for (let i = 0; i < startsWith.ids.length; i++) {
    if (path.ids[i].Object !== startsWith.ids[i].Object || path.ids[i].History !== startsWith.ids[i].History) {
      return false
    }
  }
  return true
}

export function formItToolTypeToEnumString(tt: FormIt.ToolType) {
  switch (tt) {
    case FormIt.ToolType.NONE:
      return "NONE"
    case FormIt.ToolType.CAMERA_ORBIT:
      return "CAMERA_ORBIT"
    case FormIt.ToolType.CAMERA_PAN:
      return "CAMERA_PAN"
    case FormIt.ToolType.CAMERA_ZOOM:
      return "CAMERA_ZOOM"
    case FormIt.ToolType.KEYBOARD_SHORTCUTS:
      return "KEYBOARD_SHORTCUTS"
    case FormIt.ToolType.SELECTION:
      return "SELECTION"
    case FormIt.ToolType.CREATE_CUBE:
      return "CREATE_CUBE"
    case FormIt.ToolType.CREATE_PYRAMID:
      return "CREATE_PYRAMID"
    case FormIt.ToolType.CREATE_DOME:
      return "CREATE_DOME"
    case FormIt.ToolType.CREATE_ROOF:
      return "CREATE_ROOF"
    case FormIt.ToolType.CREATE_CYLINDER:
      return "CREATE_CYLINDER"
    case FormIt.ToolType.DRAG_FACE:
      return "DRAG_FACE"
    case FormIt.ToolType.POLYLINE:
      return "POLYLINE"
    case FormIt.ToolType.RECTANGLE:
      return "RECTANGLE"
    case FormIt.ToolType.CIRCLE:
      return "CIRCLE"
    case FormIt.ToolType.SET_AXES:
      return "SET_AXES"
    case FormIt.ToolType.TRANSLATION:
      return "TRANSLATION"
    case FormIt.ToolType.ARC:
      return "ARC"
    case FormIt.ToolType.SCALE_FACE:
      return "SCALE_FACE"
    case FormIt.ToolType.ROTATE_FACE:
      return "ROTATE_FACE"
    case FormIt.ToolType.SPLINE:
      return "SPLINE"
    case FormIt.ToolType.ROTATION:
      return "ROTATION"
    case FormIt.ToolType.PASTE:
      return "PASTE"
    case FormIt.ToolType.SCALE_OBJECTS:
      return "SCALE_OBJECTS"
    case FormIt.ToolType.OFFSET_FACE:
      return "OFFSET_FACE"
    case FormIt.ToolType.TAPER_FACE:
      return "TAPER_FACE"
    case FormIt.ToolType.PAINTBRUSH:
      return "PAINTBRUSH"
    case FormIt.ToolType.AREA_SELECTION:
      return "AREA_SELECTION"
    case FormIt.ToolType.MERGE:
      return "MERGE"
    case FormIt.ToolType.REVERSE_FACE:
      return "REVERSE_FACE"
    case FormIt.ToolType.GROUP:
      return "GROUP"
    case FormIt.ToolType.GROUP_CONTEXTMENU:
      return "GROUP_CONTEXTMENU"
    case FormIt.ToolType.UNGROUP:
      return "UNGROUP"
    case FormIt.ToolType.UNGROUP_CONTEXTMENU:
      return "UNGROUP_CONTEXTMENU"
    case FormIt.ToolType.UNGROUP_ALL:
      return "UNGROUP_ALL"
    case FormIt.ToolType.UNGROUP_ALL_CONTEXTMENU:
      return "UNGROUP_ALL_CONTEXTMENU"
    case FormIt.ToolType.GROUP_FLATTEN:
      return "GROUP_FLATTEN"
    case FormIt.ToolType.GROUP_MAKE_UNIQUE:
      return "GROUP_MAKE_UNIQUE"
    case FormIt.ToolType.GROUP_MAKE_UNIQUE_CONTEXTMENU:
      return "GROUP_MAKE_UNIQUE_CONTEXTMENU"
    case FormIt.ToolType.GROUP_EDIT_IN_CONTEXT:
      return "GROUP_EDIT_IN_CONTEXT"
    case FormIt.ToolType.GROUP_EDIT_IN_CONTEXT_CONTEXTMENU:
      return "GROUP_EDIT_IN_CONTEXT_CONTEXTMENU"
    case FormIt.ToolType.FILTERED_SELECTION:
      return "FILTERED_SELECTION"
    case FormIt.ToolType.FIRST_PERSON_CAMERA:
      return "FIRST_PERSON_CAMERA"
    case FormIt.ToolType.HISTORY_PLACEMENT:
      return "HISTORY_PLACEMENT"
    case FormIt.ToolType.SOLAR_RADIATION_SELECTION:
      return "SOLAR_RADIATION_SELECTION"
    case FormIt.ToolType.SOLAR_RADIATION_AREA_SELECTION:
      return "SOLAR_RADIATION_AREA_SELECTION"
    case FormIt.ToolType.JOIN:
      return "JOIN"
    case FormIt.ToolType.CUT:
      return "CUT"
    case FormIt.ToolType.SWEEP:
      return "SWEEP"
    case FormIt.ToolType.OFFSET_BODY:
      return "OFFSET_BODY"
    case FormIt.ToolType.COVER_EDGES:
      return "COVER_EDGES"
    case FormIt.ToolType.JOIN_CONTEXTMENU:
      return "JOIN_CONTEXTMENU"
    case FormIt.ToolType.CUT_CONTEXTMENU:
      return "CUT_CONTEXTMENU"
    case FormIt.ToolType.LOFT_EDGES:
      return "LOFT_EDGES"
    case FormIt.ToolType.SOLAR_RADIATION_MEASURE:
      return "SOLAR_RADIATION_MEASURE"
    case FormIt.ToolType.EXTRUDE_EDGES:
      return "EXTRUDE_EDGES"
    case FormIt.ToolType.OFFSET_EDGES:
      return "OFFSET_EDGES"
    case FormIt.ToolType.PLACE_LCS:
      return "PLACE_LCS"
    case FormIt.ToolType.SHELL_BODY:
      return "SHELL_BODY"
    case FormIt.ToolType.MIRROR:
      return "MIRROR"
    case FormIt.ToolType.BLEND:
      return "BLEND"
    case FormIt.ToolType.LINEAR_MEASURE:
      return "LINEAR_MEASURE"
    case FormIt.ToolType.ANGULAR_MEASURE:
      return "ANGULAR_MEASURE"
    case FormIt.ToolType.QUICK_SWIPE_DELETE:
      return "QUICK_SWIPE_DELETE"
    case FormIt.ToolType.CAMERA_SWIVEL:
      return "CAMERA_SWIVEL"
    case FormIt.ToolType.EDIT_CIRCLE:
      return "EDIT_CIRCLE"
    case FormIt.ToolType.EDIT_SPLINE:
      return "EDIT_SPLINE"
    case FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS:
      return "NON_UNIFORM_SCALE_OBJECTS"
    case FormIt.ToolType.ARCCENTERRADIUS:
      return "ARCCENTERRADIUS"
    case FormIt.ToolType.MATERIALPICKER:
      return "MATERIALPICKER"
    case FormIt.ToolType.SECTION_PLANE:
      return "SECTION_PLANE"
    case FormIt.ToolType.ARRAY:
      return "ARRAY"
    case FormIt.ToolType.MOVE:
      return "MOVE"
    case FormIt.ToolType.COPY:
      return "COPY"
    case FormIt.ToolType.DELETE_OBJECT:
      return "DELETE_OBJECT"
    case FormIt.ToolType.UNSMOOTH_EDGES:
      return "UNSMOOTH_EDGES"
    case FormIt.ToolType.SMOOTH_EDGES:
      return "SMOOTH_EDGES"
    case FormIt.ToolType.RESET_AXES:
      return "RESET_AXES"
    case FormIt.ToolType.EXIT_TO_PARENT:
      return "EXIT_TO_PARENT"
    case FormIt.ToolType.LASSO_SELECTION:
      return "LASSO_SELECTION"
    case FormIt.ToolType.TRANSLATION_IMPLICIT:
      return "TRANSLATION_IMPLICIT"
    case FormIt.ToolType.FLATTEN_FACES:
      return "FLATTEN_FACES"
    case FormIt.ToolType.OBJECTS_TO_MESHES:
      return "OBJECTS_TO_MESHES"
    case FormIt.ToolType.MESHES_TO_OBJECTS:
      return "MESHES_TO_OBJECTS"
    case FormIt.ToolType.EDIT_TEXTURES:
      return "EDIT_TEXTURES"
    case FormIt.ToolType.ALIGN_WITH_FACE:
      return "ALIGN_WITH_FACE"
    case FormIt.ToolType.DYNAMOSELECTION:
      return "DYNAMOSELECTION"
    case FormIt.ToolType.POLYGON:
      return "POLYGON"
    case FormIt.ToolType.OFFSET_LINE:
      return "OFFSET_LINE"
    case FormIt.ToolType.CONFIRM_ACTION:
      return "CONFIRM_ACTION"
    case FormIt.ToolType.VERTEX:
      return "VERTEX"
    case FormIt.ToolType.INTERSECT_CONTEXTMENU:
      return "INTERSECT_CONTEXTMENU"
    case FormIt.ToolType.INTERSECT:
      return "INTERSECT"
    case FormIt.ToolType.GROUP_EDIT_END_IN_CONTEXT:
      return "GROUP_EDIT_END_IN_CONTEXT"
  }
  return `${tt}`
}

// Determine whether the drag face tool should default to extrude instead
// of taper. Returns true if any of the faces adjacent to each of the selected
// faces are coplanar
export function dragFaceDefaultToExtrude(): boolean {
  // Get selection. Should be all faces
  const selectedFaces = FormIt.Selection.GetSelections()

  for (let facePath of selectedFaces) {
    const finalObjectHistory = WSM.GroupInstancePath.GetFinalObjectHistoryID(facePath)
    const historyId = finalObjectHistory.History
    const faceId = finalObjectHistory.Object

    if (WSM.Utils.IsObjectType(finalObjectHistory, WSM.nFaceType)) {
      // Get the selected face's plane and bounding edges
      const facePlane = WSM.APIGetFacePlaneReadOnly(historyId, faceId)
      const edgeIds = WSM.APIGetObjectsByTypeReadOnly(historyId, faceId, WSM.nEdgeType)

      // Collect all faces connected to the bounding edges. i.e. all faces connected to the face
      const adjacentFaceIds = new Set<number>()
      edgeIds.forEach((edgeId) => {
        const faceIds = WSM.APIGetObjectsByTypeReadOnly(historyId, edgeId, WSM.nFaceType, true)

        faceIds.forEach((faceId) => {
          adjacentFaceIds.add(faceId)
        })
      })
      // Remove the face itself
      adjacentFaceIds.delete(faceId)

      // Check if any of the adjacent faces are coplanar. If that's the
      // case return true (i.e. execute extrude)
      for (let adjacentFaceId of adjacentFaceIds) {
        const adjacentFacePlane = WSM.APIGetFacePlaneReadOnly(historyId, adjacentFaceId)
        if (WSM.Plane.AreEqual(facePlane, adjacentFacePlane)) {
          return true
        }
      }
    }
  }

  // Execute taper move
  return false
}

// Determine whether the move tool with a single edge selected should default to
// straight instead of taper. Returns true if the faces adjacent to the
// selected edge are coplanar
export function moveEdgesDefaultToStraight(): boolean {
  // Get selection. Should be one edge
  const selectedEdges = FormIt.Selection.GetSelections()
  if (selectedEdges.length !== 1) {
    return false
  }

  const edgePath = selectedEdges[0]
  const finalObjectHistory = WSM.GroupInstancePath.GetFinalObjectHistoryID(edgePath)
  const historyId = finalObjectHistory.History
  const edgeId = finalObjectHistory.Object

  if (!WSM.Utils.IsObjectType(finalObjectHistory, WSM.nEdgeType)) {
    return false
  }

  // Collect all faces connected to the edge
  const adjacentFaceIds = new Set<number>()
  const faceIds = WSM.APIGetObjectsByTypeReadOnly(historyId, edgeId, WSM.nFaceType, true)

  // Less than 2 faces. Execute straight
  if (faceIds.length < 2) {
    return true
  }

  for (let i = 1; i < faceIds.length; i++) {
    adjacentFaceIds.add(faceIds[i])
  }
  const facePlane = WSM.APIGetFacePlaneReadOnly(historyId, faceIds[0])

  // Check if the adjacent faces are coplanar. If that's the
  // case return true (i.e. execute straight)
  for (let adjacentFaceId of adjacentFaceIds) {
    const adjacentFacePlane = WSM.APIGetFacePlaneReadOnly(historyId, adjacentFaceId)
    if (WSM.Plane.AreEqual(facePlane, adjacentFacePlane)) {
      return true
    }
  }

  // Execute taper move
  return false
}

// Check whether the current FormIt tool is a move tool
// and whether the selection is a single edge
export function IsSingleEdgeMoveTool(): boolean {
  let moveSingleEdge = false
  const toolType = FormIt.Tools.GetActiveToolType()
  if (toolType == FormIt.ToolType.TRANSLATION || toolType == FormIt.ToolType.TRANSLATION_IMPLICIT) {
    const selections = FormIt.Selection.GetSelections()
    if (selections.length == 1) {
      const finalObjectHistory = WSM.GroupInstancePath.GetFinalObjectHistoryID(selections[0])

      if (WSM.Utils.IsObjectType(finalObjectHistory, WSM.nEdgeType)) {
        moveSingleEdge = true
      }
    }
  }
  return moveSingleEdge
}

// Given the current input mode and move mode, return the next input mode and move mode
// if the user were to hit the tab key to toggle modes
export function GetSingleEdgeMoveNextInputAndMoveMode(
  currentInputMode: WSM.Tools.InputMode,
  currentMoveMode: "sMove" | "tMove",
): { nextInputMode: WSM.Tools.InputMode; nextMoveMode: "sMove" | "tMove" } {
  let nextInputMode = currentInputMode
  let nextMoveMode = currentMoveMode

  if (currentMoveMode == "tMove" && currentInputMode == WSM.Tools.InputMode.Free) {
    // Switch to inputMode = WSM.Tools.InputMode.Horizontal
    nextInputMode = WSM.Tools.InputMode.Horizontal
  } else if (currentMoveMode == "tMove" && currentInputMode == WSM.Tools.InputMode.Horizontal) {
    // Switch to moveMode = "sMove" and inputMode = WSM.Tools.InputMode.Free
    nextMoveMode = "sMove"
    nextInputMode = WSM.Tools.InputMode.Free
  } else if (currentMoveMode == "sMove" && currentInputMode == WSM.Tools.InputMode.Free) {
    // Switch to inputMode = WSM.Tools.InputMode.Horizontal
    nextInputMode = WSM.Tools.InputMode.Horizontal
  } else {
    /* (moveMode == "sMove" && inputMode == WSM.Tools.InputMode.Horizontal) */
    // Switch to moveMode = "tMove" and inputMode = WSM.Tools.InputMode.Free
    nextMoveMode = "tMove"
    nextInputMode = WSM.Tools.InputMode.Free
  }

  return { nextInputMode: nextInputMode, nextMoveMode: nextMoveMode }
}

// Check whether the current FormIt tool allows for switching the tool input mode (free vs horizontal).
// Currently those tools are :
// - all the shape drawing tools
// - the translation tool
// - the set axes tool
export function AllowInputModeSwitch(): boolean {
  let allowSwitch = true

  const toolType = FormIt.Tools.GetActiveToolType()
  if (
    toolType != FormIt.ToolType.ARC &&
    toolType != FormIt.ToolType.ARCCENTERRADIUS &&
    toolType != FormIt.ToolType.CIRCLE &&
    toolType != FormIt.ToolType.POLYLINE &&
    toolType != FormIt.ToolType.RECTANGLE &&
    toolType != FormIt.ToolType.SPLINE &&
    toolType != FormIt.ToolType.POLYGON &&
    toolType != FormIt.ToolType.TRANSLATION &&
    toolType != FormIt.ToolType.TRANSLATION_IMPLICIT &&
    toolType != FormIt.ToolType.SET_AXES
  ) {
    allowSwitch = false
  }

  return allowSwitch
}

// Toggles the tool input mode between free and horizontal.
// checkIfAllowed is true, it checks whether the toogle is allowed based on the
// the current FormIt tool. If false, it always toggles (used by the Design Mode measure tool)
export function HandleInputModeSwitch(checkIfAllowed: boolean) {
  if (cameraApi.getCameraSettings().type == "perspective") {
    if (!checkIfAllowed || AllowInputModeSwitch()) {
      let inputMode = FormIt.Tools.GetInputMode()

      if (inputMode == WSM.Tools.InputMode.Free) {
        inputMode = WSM.Tools.InputMode.Horizontal
      } else {
        inputMode = WSM.Tools.InputMode.Free
      }
      FormIt.Tools.SetInputMode(inputMode)
    }
  }
}

// Returns the correct string for the given input mode and camera type
export function GetInputModeGuideText(
  isOrthoTopViewCamera: boolean,
  inputMode: WSM.Tools.InputMode,
): I18nStringProvider {
  if (isOrthoTopViewCamera) {
    return (t) => t(($) => $.guideText.mode2D)
  } else if (inputMode == WSM.Tools.InputMode.Free) {
    return (t) => t(($) => $.guideText.freeMode)
  } else {
    return (t) => t(($) => $.guideText.horizontalMode)
  }
}

// Update the Forma camera when the formit camera changed
export function handleFormItCameraChange() {
  const newPos = FormIt.Cameras.GetCameraWorldPosition()
  const newDir = FormIt.Cameras.GetCameraWorldForward()
  const cameraData = FormIt.Cameras.GetCameraData()
  let formaCameraSettings = cameraApi.getCameraSettings()

  // Handle the case where formit switched from ortho to perspective, such as
  // AlignWithFace when a non horizontal face was picked
  if (
    cameraData.projectionType === WSM.Utils.CameraProjectionType.PERSPECTIVE &&
    formaCameraSettings.type === "orthographic"
  ) {
    void cameraApi.switchPerspective(0)
    formaCameraSettings = cameraApi.getCameraSettings()
  }

  let zoom = 1.0
  if (formaCameraSettings.type === "orthographic") {
    const formItfrustumHeight = feetToMeter(Math.tan(cameraData.FOV) * cameraData.distanceToTarget * 2.0)
    const formaFrustumHeight = cameraApi.getCurrentCameraState().orthoFrustumHeight
    zoom = formaFrustumHeight / formItfrustumHeight
  }
  const newTarget = WSM.Point3d.AddVector(newPos, newDir)

  // Set the new design mode camera, using a 2 second animation
  const duration = 1000
  const from = WSMPoint3dFeetToVector3Meter(newPos)
  const to = WSMPoint3dFeetToVector3Meter(newTarget)
  void cameraApi.moveCamera(from, to, zoom, duration, EasingFunctions.easeInOutQuart)
}

type MinFaceIdsPerHistory = Record<
  number,
  {
    historyId: number
    tform: WSM.Transf3dInterface
    faceIds: Set<number>
    minZ: number
  }
>

// Gathers the lowest non-horizontal faces in the given history and instance.
// Recursively traverses all child instances in the instance's reference history.
// Faces with an area smaller than minGFAUnitAreaInFeetSquared are ignored.
function getLowestNonHorizontalFaces(topLevelHistoryId: number, topLevelInstanceId: number): MinFaceIdsPerHistory {
  let minZ = Number.MAX_VALUE
  let minCosAngle = 0.0

  // Tolerance for the face normal angle to the horizontal plane normal (neg z axis).
  // For now this is set to 45 degrees but could be set to a lower angle to only
  // flatten faces that have a smaller angle
  const angleTolerance = Math.cos((45 * Math.PI) / 180)

  let minFaceIdsPerHistory: MinFaceIdsPerHistory = {}

  const zAxisNegative = WSM.Vector3d.Vector3d(0, 0, -1)

  // Recursive function to gather the face(s) with the lowest Z and smallest angle
  // to the horizontal plane. Considers faces and instances in the given history
  function getMinFaceIdsPerInstance(historyId: number, instanceId: number, tform: WSM.Transf3dInterface) {
    const tformInverse = WSM.Transf3d.Invert(tform)
    const referenceHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(historyId, instanceId)
    let firstFace = true

    // All faces for the given history
    const faceIds = WSM.APIGetAllObjectsByTypeReadOnly(referenceHistoryId, WSM.nFaceType)
    faceIds.forEach((faceId) => {
      const faceBox = WSM.APIGetBoxReadOnly(referenceHistoryId, faceId, tform)
      if (faceBox.lower.z < minZ - WSM_DISTANCE_TOL) {
        minZ = faceBox.lower.z
        // Only fix the lowest faces across histories. We found something lower than everything before it
        // so clear all the faces that were found before
        minFaceIdsPerHistory = {}
        firstFace = true
        minCosAngle = 0.0
      } else if (faceBox.lower.z > minZ + WSM_DISTANCE_TOL) {
        // If the face is above the current minimum Z, skip it
        return
      }

      const faceArea = WSM.APIComputeAreaReadOnly(referenceHistoryId, faceId, tform)
      const facePlane = WSM.APIGetFacePlaneReadOnly(referenceHistoryId, faceId)
      const normal = WSM.Vector3d.GetNormalized(WSM.Transf3d.Multiply(tform, facePlane.normal))
      const cosAngle = WSM.Vector3d.DotProduct(normal, zAxisNegative)

      // Consider only faces with an area larger than the minimum GFA unit area
      // and with an angle to the horizontal plane smaller than the angle tolerance
      if (faceArea > minGFAUnitAreaInFeetSquared && cosAngle > angleTolerance && cosAngle < 1.0 - WSM_MACHINE_TOL) {
        const sameLowerZ = Math.abs(faceBox.lower.z - minZ) < WSM_DISTANCE_TOL
        const sameAngle = Math.abs(cosAngle - minCosAngle) < WSM.ANGLE_TOL
        const same = sameLowerZ && sameAngle

        // Create a new list of faces to be flattened for this history if:
        // 1. The face has the same lower z and same angle, but is the first face from a new instance - or
        // 2. The face has the same lower Z but a smaller angle to the horizontal plane
        // Note a face with a lower z already reset minZ above.
        if (
          (same && firstFace) || // Same lower Z and same angle but first face from a new instance
          (sameLowerZ && cosAngle > minCosAngle) // Same lower Z but smaller angle to horizontal plane
        ) {
          minZ = faceBox.lower.z
          minCosAngle = cosAngle
          minFaceIdsPerHistory[referenceHistoryId] = {
            historyId: referenceHistoryId,
            faceIds: new Set([faceId]),
            tform: tformInverse,
            minZ: minZ,
          }
          firstFace = false
        }
        // Same lower Z and same angle: Add face to list of faces to be flattened
        else if (same) {
          minFaceIdsPerHistory[referenceHistoryId].faceIds.add(faceId)
          minFaceIdsPerHistory[referenceHistoryId].tform = tformInverse
          minFaceIdsPerHistory[referenceHistoryId].minZ = minZ
          firstFace = false
        }
      }
    })

    // Recursively process all instances in the current history
    const instanceIds = WSM.APIGetAllObjectsByTypeReadOnly(referenceHistoryId, WSM.nInstanceType)

    instanceIds.forEach((childInstanceId) => {
      let childTform = WSM.APIGetInstanceTransf3dReadOnly(referenceHistoryId, childInstanceId)
      childTform = WSM.Transf3d.Multiply(tform, childTform)
      getMinFaceIdsPerInstance(referenceHistoryId, childInstanceId, childTform)
    })
  }

  // Start the recursive function with the top level history and instance
  const tform = WSM.APIGetInstanceTransf3dReadOnly(topLevelHistoryId, topLevelInstanceId)
  getMinFaceIdsPerInstance(topLevelHistoryId, topLevelInstanceId, tform)

  return minFaceIdsPerHistory
}

// Flattens the lowest non-horizontal faces in the given history and instance.
// Recursively traverses all child instances in the instance's reference history.
// Faces with an area smaller than minGFAUnitAreaInFeetSquared are ignored.
export function flattenLowestNonHorizontalFaces(topLevelHistoryId: number, topLevelInstanceId: number) {
  const minFaceIdsPerHistory = getLowestNonHorizontalFaces(topLevelHistoryId, topLevelInstanceId)

  // Flatten the found face(s)
  if (Object.keys(minFaceIdsPerHistory).length > 0) {
    FormIt.UndoManagement.BeginState()

    const zAxisNegative = WSM.Vector3d.Vector3d(0, 0, -1)
    Object.values(minFaceIdsPerHistory).forEach((data) => {
      const minFacePlane = WSM.Transf3d.Multiply(
        data.tform,
        WSM.Plane.Plane(WSM.Point3d.Point3d(0, 0, data.minZ), zAxisNegative),
      )

      const faceIds = [...data.faceIds]
      const minFacePlanes = faceIds.map(() => {
        return minFacePlane
      })
      WSM.APITweak(data.historyId, faceIds, minFacePlanes)
    })

    const t = getTranslator()
    FormIt.UndoManagement.EndState(t(($) => $.wsm.undoStates.flattenLowestNonHorizontalFaces))
  }
}

// Perform the check whether the given history and instance have any
// non-horizontal faces with the lowest Z. Returns true if there are any such faces.
export function hasLowestNonHorizontalFaces(topLevelHistoryId: number, topLevelInstanceId: number): boolean {
  const minFaceIdsPerHistory = getLowestNonHorizontalFaces(topLevelHistoryId, topLevelInstanceId)
  return Object.keys(minFaceIdsPerHistory).length > 0
}
