import { feetToMeter, meterToFeet } from "@spacemakerai/forma-units"
import type { LevelData } from "./types"
import { addWSMLevelDataToWSMInstance } from "src/integrations/wsm-tools/building/buildingFloorUtils"
import type { InternalPath } from "src/lib/element/path"
import { isDefined } from "src/lib/array"
import { AnalyticsKey } from "src/core/analytics"
import { Vector3 } from "three"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"

const getCurveTypesFromSelections = () => {
  const selection = FormIt.Selection.GetSelections()

  return selection.map((selection) => {
    const finalInstance = window.WSM.Utils.GetGroupInstancePathFinalObjectHistoryID(selection)
    const { History: HistoryID, Object: edgeID } = finalInstance
    const { type } = window.WSM.Utils.GetEdgeCurveType(FormIt.GroupEdit.GetEditingHistoryID() || HistoryID, edgeID)
    return type
  })
}

export const getCurveType = () => {
  const curveTypes = getCurveTypesFromSelections()

  if (curveTypes.every((curveType) => curveType === window.WSM.Utils.CurveType.Circle))
    return window.WSM.Utils.CurveType.Circle

  if (curveTypes.every((curveType) => curveType === window.WSM.Utils.CurveType.Spline))
    return window.WSM.Utils.CurveType.Spline

  return null
}

// Function to get level data from a group instance path
const getLevelData = (
  snapshot: ElementSnapshot,
  groupInstancePath: WSM.GroupInstancePathInterface,
  isImperial: boolean,
  buildingHeightInFeet: number,
  editPath?: InternalPath,
): LevelData[] => {
  const { historyId, objectId } = getFirstObjectAndHistoryIdFromGIP(groupInstancePath)
  const levelsIds = WSM.APIGetObjectLevelsReadOnly(historyId, objectId)
  const mainHistoryId = FormIt.Model.GetHistoryID()
  const { childrenElements, childrenPaths } = getChildrenElementsOfPath(snapshot, editPath)

  const currentLevelData: LevelData[] = levelsIds
    .map((levelId, index) => {
      // Get level data
      const levelData = WSM.APIGetLevelDataReadOnly(mainHistoryId, levelId, false)
      const { sLevelName: first, dElevation: second } = levelData
      const wsmLevelData: LevelData = { first, second }
      // Get function type from element
      wsmLevelData.floorFunction = childrenElements[index]?.properties?.functionId
      if (childrenPaths[index]) wsmLevelData.elementPath = childrenPaths[index]
      return wsmLevelData
    })
    .map((l, i, ls) =>
      // Calc floor heights based on each level's elevation
      ({
        ...l,
        floorHeight: convertFeetToDMUnits(
          ls[i + 1] ? ls[i + 1]?.second - l.second : buildingHeightInFeet - l.second,
          isImperial,
        ),
      }),
    )

  return currentLevelData
}

// This function updates the level data based on the building height
const updateLevelData = (
  initialLevelData: LevelData[],
  buildingHeightInFeet: number,
  isImperial: boolean,
  defaultFloorHeightInFeet: number,
  historyId: number,
  objectId: number,
): LevelData[] => {
  const levelData = initialLevelData.filter(
    // Filter levels against overall building height. use a large tolerance here to catch
    // floating point error for example in the dynamo case where a mesh is stored in floats.
    // The tolerance below is 1/64th of an inch.
    (l, i) => i == 0 || l.second <= buildingHeightInFeet - defaultFloorHeightInFeet + 0.001302,
  )

  // Recalculate top level after filtering only if there is building height
  if (initialLevelData.length != levelData.length && levelData.length && buildingHeightInFeet > 0) {
    const lastLevel = levelData[levelData.length - 1]
    lastLevel.floorHeight = convertFeetToDMUnits(buildingHeightInFeet - lastLevel.second, isImperial)

    // After floor height calculation, determine if new levels need to be saved back to wsm
    if (!FormIt.Tools.IsInContinuousAction()) {
      addWSMLevelDataToWSMInstance(historyId, objectId, levelData)
    }
  }

  return levelData
}

// This returns a collection of LevelData that includes name, elevation and floor function
export const fetchAndUpdateLevelDataFromGIP = (
  snapshot: ElementSnapshot,
  groupInstancePath: WSM.GroupInstancePathInterface,
  isImperial: boolean,
  buildingHeightInFeet: number,
  defaultFloorHeightInFeet: number,
  editPath?: InternalPath,
): LevelData[] => {
  const { historyId, objectId } = getFirstObjectAndHistoryIdFromGIP(groupInstancePath)
  const initialLevelData = getLevelData(snapshot, groupInstancePath, isImperial, buildingHeightInFeet, editPath)
  return updateLevelData(
    initialLevelData,
    buildingHeightInFeet,
    isImperial,
    defaultFloorHeightInFeet,
    historyId,
    objectId,
  )
}

// Returns level index and height to use as next levels to add
export const getParamsToGenerateWSMLevelsData = (
  param: "height" | "quantity",
  defaultFloorHeightInFeet: number,
  wsmLevelsData: LevelData[],
) => {
  const height = defaultFloorHeightInFeet

  if (param === "height") {
    return { level: 1, nextFloorElevationInFeet: 0 }
  }

  return {
    level: wsmLevelsData.length + 1,
    nextFloorElevationInFeet: wsmLevelsData[wsmLevelsData.length - 1].second + height,
  }
}

export const getFirstObjectAndHistoryIdFromGIP = (groupInstancePath: WSM.GroupInstancePathInterface) => {
  const objHistoryId = WSM.GroupInstancePath.GetTopObjectHistoryID(groupInstancePath)
  if (!objHistoryId || typeof objHistoryId.Object == "undefined" || typeof objHistoryId.History == "undefined")
    return { objectId: WSM.INVALID_ID, historyId: WSM.INVALID_ID }
  const { Object: objectId, History: historyId } = objHistoryId
  return { objectId, historyId }
}

export const convertFeetToDMUnits = (value: number, isImperial: boolean): number => {
  return isImperial ? value : feetToMeter(value)
}

export const convertDMUnitsToFeet = (value: number, isImperial: boolean): number => {
  return isImperial ? value : meterToFeet(value)
}

/* selection and context menu utils */

export const hasMeshesInSelection = () => {
  const selections = FormIt.Selection.GetSelections()

  for (const selection of selections) {
    const { Object: objectId, History: historyId } = WSM.GroupInstancePath.GetFinalObjectHistoryID(selection)

    if (!objectId || !historyId || objectId === WSM.INVALID_ID || historyId === WSM.INVALID_ID) continue

    const objectType = WSM.APIGetObjectTypeReadOnly(historyId, objectId)
    if (objectType === WSM.nObjectType.nMeshType) {
      return true
    }
  }

  return false
}

// from the FormIt context menu,
// returns the available Group tools based on the current selection
// but filters out tools that would be undesirable in Forma
export const getAvailableGroupTools = (toolInfos: FormIt.ToolInfo[]): FormIt.ToolInfo[] => {
  return toolInfos.filter(
    (tool) =>
      tool.Name.includes("Group") &&
      tool.ToolTip !== "Ungroup All" &&
      tool.ToolTip !== "Edit group" &&
      tool.ToolTip !== "Finish group edit" &&
      tool.ToolTip !== "Exit to parent",
  )
}

export const getChildrenPathsOfParentPath = (snapshot: ElementSnapshot, parentPath?: InternalPath) => {
  if (!parentPath) return []
  const parentNode = snapshot.getNode(parentPath)?.elementContainer.element
  const childrenPaths = parentNode?.children?.map((c) => `${parentPath}/${c.key}`)
  if (!childrenPaths) return []
  return childrenPaths
}

export const getElementsOfPaths = (snapshot: ElementSnapshot, paths: InternalPath[] = []) => {
  return paths.map((p) => snapshot.getNode(p)?.elementContainer.element).filter(isDefined)
}

export const getChildrenElementsOfPath = (snapshot: ElementSnapshot, parentPath?: InternalPath) => {
  const childrenPaths = getChildrenPathsOfParentPath(snapshot, parentPath)
  const childrenElements = getElementsOfPaths(snapshot, childrenPaths)
  return { childrenElements, childrenPaths }
}

export const getCurrentDrawingMode = (inI3DSMode: boolean, inEditConstraintMode: boolean) => {
  if (inI3DSMode) {
    return AnalyticsKey.Sketch3D
  } else if (inEditConstraintMode) {
    return AnalyticsKey.ElementType_Constraint
  }
}

// Converts a WSM Point3d (whose coords are in feet) to a Vector3 with coords in meters
export function WSMPoint3dFeetToVector3Meter(wsmPoint: WSM.Point3dInterface): Vector3 {
  return new Vector3(feetToMeter(wsmPoint.x), feetToMeter(wsmPoint.y), feetToMeter(wsmPoint.z))
}
// Converts a WSM Vector3d (whose coords are in feet) to a Vector3 with coords in meters
export function WSMVector3dFeetToVector3Meter(wsmVector: WSM.Vector3dInterface): Vector3 {
  return new Vector3(feetToMeter(wsmVector.x), feetToMeter(wsmVector.y), feetToMeter(wsmVector.z))
}
// Converts a Vector3 (whose coords are in meter) to a WSM Point3d with coords in feet
export function Vector3MeterToWSMPoint3dFeet(point3: Vector3): WSM.Point3dInterface {
  return WSM.Point3d.Point3d(meterToFeet(point3.x), meterToFeet(point3.y), meterToFeet(point3.z))
}

// Converts a Vector3 (whose coords are in meter) to a WSM Vector3d with coords in feet
export function Vector3MeterToWSMVector3dFeet(point3: Vector3): WSM.Vector3dInterface {
  return WSM.Vector3d.Vector3d(meterToFeet(point3.x), meterToFeet(point3.y), meterToFeet(point3.z))
}
