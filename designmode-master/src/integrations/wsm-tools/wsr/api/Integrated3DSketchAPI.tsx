import type { InternalPath } from "src/lib/element/path"
import { getLeafKey } from "src/lib/element/path"
import { useCallback, useMemo } from "preact/hooks"
import { Integrated3DSketchEditModeType } from "./types"
import { lookupWSMObject, wsmObjectToAXMStringForSave, wsmTopInstanceToGeometryData } from "./mapping"
import {
  wsmSideEffectAdapter,
  type WSMDetailsForElementPath,
} from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import { prepareDataForEdit } from "./prepare"
import { displayTriangleCountWarningDialog, EditWSMElementTool, edited3DSPathSignal } from "./EditWSMElementTool"
import { useSyncPath } from "./useSync"
import { useInitializeFormitCoreCallback } from "./useInitialize"
import { Integrated3DSketchToolbar } from "src/integrations/wsm-tools/wsr/toolbars/Integrated3DSketchToolbar"
import { EditConstraintsProperties } from "src/integrations/wsm-tools/edit/EditConstraintsProperties"
import { atom, useRecoilState, useSetRecoilState } from "recoil"
import { captureException } from "@sentry/browser"
import Properties3dSketch from "src/integrations/wsm-tools/wsr/integrated/components/Properties3dSketch/Properties3dSketch"
import {
  addLevelsToInstance,
  addWSMLevelDataToWSMInstance,
  canAddLevelsToInstance,
  deleteFloorCollection,
  getPathOfWSMOrAXMBackedBuildingFromFloor,
  removeLevels,
  undoFloorCollectionDelete,
} from "src/integrations/wsm-tools/building/buildingFloorUtils"
import {
  scenarioModeSignal,
  setFadeAllExceptSignalValue,
  setSelectionSignalValue,
} from "src/core/selection/selectionState"
import {
  createInitialHistoryDeltaMapAndResetFormItModified,
  hasAnyInitalHistoryDeltaChanged,
} from "src/integrations/wsm-tools/wsm-integration/wsm-utils"
import { usePrepareWSRSaveActions } from "./usePrepareWSRSaveActions"
import { elementState } from "src/core/elements/ElementState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { FEET_TO_METER, METER_TO_FEET } from "@spacemakerai/forma-units"
import { HiddenPaths } from "src/core/hidden"
import {
  wsmDefaultFloorHeightInFeet,
  wsmLastSketchToolBuildingSignal,
  wsmLastSketchToolSignal,
  wsmToolIDSignal,
} from "src/integrations/wsm-tools/wsr/integrated/state"
import { getFirstObjectAndHistoryIdFromGIP } from "src/integrations/wsm-tools/wsr/integrated/utils"
import { generateCustomWSMLevelData } from "src/integrations/wsm-tools/wsr/integrated/utils/levelsData"
import { signal } from "@preact/signals"
import {
  recoveryExists,
  canRecoverSignal,
  recoveryConfirm,
  recoveryClear,
  recoveryConfirmedSignal,
  recoveryForCreate,
  recoverySave,
  saving3dSketchSignal,
  recoveryRespondedConfirmed,
} from "src/integrations/wsm-tools/wsr/recovery"
import { Analytics, type Method } from "src/core/analytics"
import { useIsImperial } from "src/lib/unitSettings"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

interface Integrated3DSketchAPI {
  // Adds or removes floors from a Forma element by path. This converts the
  // element to a 3d sketch element and adds it to the wsm-side-effect-adapter
  // for subsequent editing. This does NOT interactively edit the element.
  // Note floors are removed when the floorHeightInFeet is undefined.
  // If gfaUnitLevels is true, floors are created based on the gfaUnits on
  // the owning building element. If this is true, the conditions have been
  // previously checked.
  addOrRemoveFloorsByPath(path: InternalPath, floorHeightInFeet: number | undefined, gfaUnitLevels?: boolean): void

  // Boolean Union - unions 2 or more elements by path
  booleanUnionElementsByPaths(paths: InternalPath[]): void

  // Creates a new designmode element (when the mesh is not empty) and adds it to
  // the wsm-side-effect-adapter for subsequent editing.
  create3dMesh(mode: Integrated3DSketchEditModeType): void

  // Allows editing inside a WSM instance's reference history. Note if a designmode
  // element has not been synced (added to the wsm-side-effect-adapter), sync the
  // element first. In fact since sync is not expensive if the work has already
  // been done, it is good practice to always sync before calling this.
  edit3dMeshByPath(path: InternalPath, fromDoubleClick?: boolean): void

  // inI3DSMode: Set to true when in integrated 3d sketch mode
  inI3DSMode: boolean
  // Set to true if editing a constraint
  isEditingConstraint: boolean

  // Create new dm element with levels/floors pre-applied
  create3dBuilding(method: Method): void
}

function createEmptyGroupInstancePath(forCreate: boolean): WSM.GroupInstancePathInterface {
  const historyId = WSM.InferenceEngine.GetTopLevelHistory()
  if (historyId === WSM.INVALID_ID) {
    throw new Error("invalid history id")
  }

  // Get the elevation at (0, 0) of the terrain and model there.
  const elevationAtOrigin = terrainSignal.peek().elevationAt(0, 0)
  const translationTranf3d = WSM.Transf3d.MakeTranslationTransform(
    WSM.Geom.Vector3d(0, 0, elevationAtOrigin * METER_TO_FEET),
  )

  // Make an empty group in which all new objects are created
  const groupId = WSM.APICreateGroup(historyId, [], [translationTranf3d])

  // Make a base state in the group's reference history to which we can undo
  if (forCreate) {
    // Set the copy behavior to be like a group not a component.
    const refHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(historyId, groupId)
    WSM.APICreateStringAttribute(refHistoryId, FormIt.MAKE_UNIQUE_BEFORE_EDIT_KEY, "", [])

    const groupHistId = WSM.APIGetGroupReferencedHistoryReadOnly(historyId, groupId)
    FormIt.UndoManagement.NoteState("UndoBase", [{ objectName: "HistoryID", id: groupHistId }])
  }

  const instanceIds = WSM.APIGetObjectsByTypeReadOnly(historyId, groupId, WSM.nObjectType.nInstanceType)
  if (instanceIds.length !== 1) {
    throw new Error("wrong amount of instances")
  }
  const instanceId = instanceIds[0]

  return WSM.GroupInstancePath([WSM.ObjectHistoryID(historyId, instanceId)])
}

// Note centers instance geometry along the middle of the bounding box and adjusts the instance
// transform to compensate.
function centerInstanceGeometry(historyId: number, instanceId: number) {
  const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(historyId, instanceId)

  const allNonOwned = WSM.APIGetAllNonOwnedReadOnly(refHistId)
  const inverseMoveTransf3d = WSM.Utils.ComputeAlignAndCenterTransformation(refHistId, allNonOwned)
  if (WSM.Transf3d.IsIdentity(inverseMoveTransf3d)) return
  const moveToCenterAndAlignTransf3d = WSM.Transf3d.Invert(inverseMoveTransf3d)
  WSM.APITransformObjects(refHistId, allNonOwned, moveToCenterAndAlignTransf3d)

  // Originally the geometry was at T * G where T is the instance transform. Now the
  // geometry is at C * G so we need the instance transform to be T * C^-1. To get
  // the correct instance tranform, we need to move the instance by T * C^-1 * T^-1
  const instanceTransf3d = WSM.APIGetInstanceTransf3dReadOnly(historyId, instanceId)
  const inverseInstanceTransf3d = WSM.Transf3d.Invert(instanceTransf3d)
  const moveInstanceTransf3d = WSM.Transf3d.Multiply(
    instanceTransf3d,
    WSM.Transf3d.Multiply(inverseMoveTransf3d, inverseInstanceTransf3d),
  )
  WSM.APITransformObjects(historyId, [instanceId], moveInstanceTransf3d)
}

// This is used because current graphBuilding requires that the element transform references the
// bottom of the building.
export function setWSMGeoBottomToZero(historyId: number, instanceId: number) {
  const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(historyId, instanceId)

  const minZPos = WSM.APIGetBoxReadOnly(refHistId).lower.z

  const identityTransform = WSM.Transf3d.Transf3d()
  const instanceZeroingTransform = WSM.Geom.TranslateTransform(identityTransform, WSM.Vector3d.Vector3d(0, 0, minZPos))
  const objectAdjustingTransform = WSM.Geom.TranslateTransform(identityTransform, WSM.Vector3d.Vector3d(0, 0, -minZPos))

  WSM.APITransformObjects(historyId, [instanceId], instanceZeroingTransform)

  const allNonOwned = WSM.APIGetAllNonOwnedReadOnly(refHistId)
  WSM.APITransformObjects(refHistId, allNonOwned, objectAdjustingTransform)
}

// Get the transform array to use in designmode from a group instance path.
export function getElementTransformArrayFromWSMInstance(groupInstancePath: WSM.GroupInstancePathInterface) {
  const transposedData: number[] = []
  let transfT = WSM.Geom.Transf3d()
  if (groupInstancePath.ids.length === 1) {
    transfT = WSM.GroupInstancePath.GetObjectTransform(groupInstancePath)
  } else {
    console.error("Invalid transform from WSM instance")
  }

  transfT.data[3] = transfT.data[3] * FEET_TO_METER
  transfT.data[7] = transfT.data[7] * FEET_TO_METER
  transfT.data[11] = transfT.data[11] * FEET_TO_METER

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      // Copy the transposed matrix data.
      transposedData[4 * i + j] = transfT.data[4 * j + i]
    }
  }

  return transposedData
}

// recoil state carrying the payload when the WSM model is changed
// used for updating UI when the model changes, like for Constraint properties
export const wsmModelChangedPayload = atom<FormIt.Message.kModelChangedPayload>({
  key: "wsmModelChangedPayload",
  default: undefined,
})

// signal to show/hide the save button in area metrics
export const wsmNeedsSaveSignal = signal(false)

// recoil state carrying the payload when the FormIt level manager changes
// used for updating UI like the category header (Generic or Building)
export const wsmLevelChangedPayload = atom<any>({
  key: "wsmLevelChangedPayload",
  default: undefined,
})

// recoil state carrying the i3ds edit mode
export const wsmEditMode = atom<Integrated3DSketchEditModeType>({
  key: "wsmEditMode",
  default: undefined,
})

export function useIntegrated3DSketchAPI(): Integrated3DSketchAPI {
  const initialize = useInitializeFormitCoreCallback()
  const isImperial = useIsImperial()
  const sync = useSyncPath()

  const [editMode, setEditModeType] = useRecoilState(wsmEditMode)

  const setDisplayTriangleWarning = useSetRecoilState(displayTriangleCountWarningDialog)
  const onWSRComplete = usePrepareWSRSaveActions(scenarioModeSignal.value ? "base" : "proposal")

  // Used with "create3dBuilding" to initialize a 3d building element with floor/level data
  const defaultFloorHeightInFeet = wsmDefaultFloorHeightInFeet(isImperial)

  // Used as a common method between save and complete operations
  const saveInternal = useCallback(
    (
      groupInstancePath: WSM.GroupInstancePathInterface,
      mapHistoryIdToInitialDeltaId: Map<number, number>,
      path: InternalPath,
      bFloorCollectionDeleted: { value: boolean },
    ) => {
      let savePath = ""
      if (groupInstancePath && groupInstancePath.ids?.length === 1) {
        // Look for any wsm model changes and only save if found or recovery is confirmed
        if (
          hasAnyInitalHistoryDeltaChanged(groupInstancePath, mapHistoryIdToInitialDeltaId) === true ||
          recoveryConfirmedSignal.peek()
        ) {
          setWSMGeoBottomToZero(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object)
          const geoData = wsmTopInstanceToGeometryData(groupInstancePath)
          geoData.axmRepresentation = wsmObjectToAXMStringForSave(groupInstancePath)

          // note: exitCurrentTool is called by the EditWSRTool
          savePath = onWSRComplete(geoData, groupInstancePath, path) ?? ""
        } else {
          console.log("No wsm changes detected - skipping save.")
          if (bFloorCollectionDeleted.value) {
            console.log("Undo floor collection deletion.")
            undoFloorCollectionDelete(groupInstancePath)
          }
        }

        void recoveryClear(true, path)
      }
      return savePath
    },
    [onWSRComplete],
  )

  // Used within the edit and create modes when a 3d element is saved
  const onSaveAndResetForFurtherEditing = useCallback(
    (
      groupInstancePath: WSM.GroupInstancePathInterface,
      mapHistoryIdToInitialDeltaId: Map<number, number>,
      path: InternalPath,
      bFloorCollectionDeleted: { value: boolean },
    ) => {
      saving3dSketchSignal.value = true

      let savePath: string = ""
      const selectedGIPs = FormIt.Selection.GetSelections()
      try {
        // Do not update WSR for the save.
        FormIt.SuspendMessaging(true, 0, false)

        savePath = saveInternal(groupInstancePath, mapHistoryIdToInitialDeltaId, path, bFloorCollectionDeleted)
        mapHistoryIdToInitialDeltaId.clear()
        bFloorCollectionDeleted.value = deleteFloorCollection(groupInstancePath)
        createInitialHistoryDeltaMapAndResetFormItModified(groupInstancePath, mapHistoryIdToInitialDeltaId)
      } catch (e) {
        console.error(e)
      } finally {
        FormIt.ResumeMessaging()
      }

      if (selectedGIPs.length !== 0) {
        // Note resume messages will cause the selection to be cleared
        // due to a kLoadComplete message in core. Reset it.
        FormIt.Selection.SetSelections(selectedGIPs)
      }

      // Reset the save button visibility in area metrics
      wsmNeedsSaveSignal.value = false
      saving3dSketchSignal.value = false
      return savePath
    },
    [saveInternal],
  )

  const edit3dMeshByPath = useCallback(
    async (path: InternalPath) => {
      await initialize()

      const terrainPath = elementState.currentTerrainSignal.peek()?.path.value
      const proposal = elementState.currentProposalSignal.peek()
      const node = proposal.snapshot.getNodeOrThrow(path)
      const element = node.element
      const formats: string[] = element.properties?.spacemakerObjectStorageReferenceFormats || []
      let isWSMOrAXM = formats.includes("wsm") || formats.includes("axm")

      // If floor of wsm or axm backed building, edit parent path
      if (!isWSMOrAXM && element.properties?.category === "floor") {
        const wsmOrAXMBuildingPathFromFloor = getPathOfWSMOrAXMBackedBuildingFromFloor(
          path,
          element,
          (path) => proposal.snapshot.getNode(path)?.urn,
          (urn) => proposal.snapshot.getFormaElementOrThrow(urn),
        )
        if (wsmOrAXMBuildingPathFromFloor) {
          // We have a floor from a wsm or axm backed building. Use it for edit.
          isWSMOrAXM = true
          path = wsmOrAXMBuildingPathFromFloor
          setSelectionSignalValue([path])
        }
      }
      let mode = Integrated3DSketchEditModeType.Default
      // Added for data regression caused by https://github.com/spacemakerai/designmode/pull/2301
      if (element.properties?.category === "constraints" || element.properties?.name === "Constraint") {
        mode = Integrated3DSketchEditModeType.Constraints
      } else if (isWSMOrAXM) {
        mode = Integrated3DSketchEditModeType.WSM
      } else {
        mode = Integrated3DSketchEditModeType.Volumes
      }

      setEditModeType(mode)

      try {
        const onReadyCallback = () => {
          const wsmDetailsForElementPath: WSMDetailsForElementPath | undefined = lookupWSMObject(path)
          const groupInstancePath = wsmDetailsForElementPath?.groupInstancePath

          // Save all the delta ids at load time for each history. These ids will be used on save to know if the history is in
          // a different state and hence needs to be saved.
          const mapHistoryIdToInitialDeltaId: Map<number, number> = new Map<number, number>()

          // Boolean indicates if the floor collection group was deleted. Need to undo the delete if not saving.
          let bFloorCollectionDeleted = { value: false }

          if (groupInstancePath) {
            //If the incoming path is not geoJSON or WSM backed, we will have mesh(es) to convert.
            prepareDataForEdit(groupInstancePath, () => setDisplayTriangleWarning(true))

            // Note if the reference history is shared between multiple instances (for multiple
            // DM element paths), edit in context will make the instance unique. Make sure to
            // call make unique before deleting the floor group!
            FormIt.GroupEdit.SetInContextEditingPath(groupInstancePath)
            FormIt.GroupEdit.SetInContextEditingPathRequiredPrefix(groupInstancePath)

            // Delete floors only after making a shared reference history unique.
            bFloorCollectionDeleted.value = isWSMOrAXM && deleteFloorCollection(groupInstancePath)

            // If the element to be edited is building with no floors and gfa units, force a save by
            // skiiping the initialization of the delta map. The save will convert and fix the element.
            // Note we could check further here that the synced instance has levels.
            let bInitializeDeltaMap = true
            if (
              !isWSMOrAXM &&
              element.properties?.category === "building" &&
              (element.children === undefined || element.children.length === 0) &&
              element.representations?.gfaUnits !== undefined
            ) {
              bInitializeDeltaMap = false
            }

            if (bInitializeDeltaMap) {
              createInitialHistoryDeltaMapAndResetFormItModified(groupInstancePath, mapHistoryIdToInitialDeltaId)
            }
          }

          function onComplete() {
            saving3dSketchSignal.value = true
            saveInternal(groupInstancePath!, mapHistoryIdToInitialDeltaId, path, bFloorCollectionDeleted)
            HiddenPaths.setPathHidden(path, false)
            saving3dSketchSignal.value = false
          }

          if (groupInstancePath) {
            // Set the path for the edited 3d sketch element
            edited3DSPathSignal.value = path

            toolAPI.setTool({
              id: "WSRAPITool",
              tool: () => (
                <EditWSMElementTool
                  instancePath={groupInstancePath}
                  onComplete={onComplete}
                  onSave={() =>
                    onSaveAndResetForFurtherEditing(
                      groupInstancePath,
                      mapHistoryIdToInitialDeltaId,
                      path,
                      bFloorCollectionDeleted,
                    )
                  }
                  modeType={mode}
                  path={path} /* internal path */
                  elementProperties={element.properties as any}
                  recoverySave={() => recoverySave(groupInstancePath, path)}
                />
              ),
              toolbar: Integrated3DSketchToolbar,
              propertyPanel:
                mode == Integrated3DSketchEditModeType.Constraints
                  ? () => (
                      // Edit Constraints
                      <>
                        <EditConstraintsProperties groupInstancePath={groupInstancePath} />
                      </>
                    )
                  : // I3DS
                    () => (
                      <>
                        <EditConstraintsProperties groupInstancePath={groupInstancePath} />
                        <Properties3dSketch editPath={path} />
                      </>
                    ),
            })
          }
        }

        // Always sync terrain since we need it for all the editing tools.
        // Also sync the element we are modifying.
        if (terrainPath) sync(terrainPath)

        // Allow recovery
        canRecoverSignal.value = true

        // Check if recovery is available
        if (recoveryExists(path) && (await recoveryConfirm(path))) {
          // Clear wsm cache to use recovery instead
          wsmSideEffectAdapter.delete(path)
          wsmSideEffectAdapter.cache.delete(path)
        }

        sync(
          path,
          () => {
            // Reset the recovery allowance
            canRecoverSignal.value = false

            // Call the onReady callback
            onReadyCallback()
          },
          true /*forBrep*/,
        )
      } catch (err) {
        captureException(err, {
          tags: { owner: "conceptual", errorPoint: "Edit 3d Mesh By Path", "integration-type": "integrated" },
        })
      }

      setFadeAllExceptSignalValue([path])
    },
    [initialize, setEditModeType, sync, setDisplayTriangleWarning, saveInternal, onSaveAndResetForFurtherEditing],
  )

  const create3dMesh = useCallback(
    async (
      mode: Integrated3DSketchEditModeType,
      onReadyCallback?: (groupInstancePath: WSM.GroupInstancePathInterface) => void,
    ) => {
      try {
        setEditModeType(mode)

        await initialize()

        const terrainPath = elementState.currentTerrainSignal.peek()?.path.value

        // Always sync terrain since we need it for all the editing tools.
        if (terrainPath) sync(terrainPath)

        // When creating a new 3d mesh object, we automatically
        // create a new empty group and place our new data in here,
        // rather than in the main history
        const groupInstancePath = createEmptyGroupInstancePath(true /* forCreate */)
        FormIt.GroupEdit.SetInContextEditingPath(groupInstancePath)

        // Set the required prefix path so that the user can't exit group editing past this path
        FormIt.GroupEdit.SetInContextEditingPathRequiredPrefix(groupInstancePath)

        // Save all the delta ids at load time for each history. These ids will be used on save to know if the history is in
        // a different state and hence needs to be saved.
        const mapHistoryIdToInitialDeltaId: Map<number, number> = new Map<number, number>()
        createInitialHistoryDeltaMapAndResetFormItModified(groupInstancePath, mapHistoryIdToInitialDeltaId)

        // Used between the onCreateComplete and onCreateSaveAndResetForFurtherEditing callbacks
        // Sets the new path and transform if the save was successful
        const createSaveInternal = () => {
          // Look for any wsm model changes and only save if found.
          if (hasAnyInitalHistoryDeltaChanged(groupInstancePath, mapHistoryIdToInitialDeltaId) === false) {
            console.log("No wsm changes detected - skipping save.")
            return
          }

          //before we save anything, make sure there's actually data in our group
          const inst = groupInstancePath.ids[groupInstancePath.ids.length - 1]
          const refHistory = WSM.APIGetGroupReferencedHistoryReadOnly(inst.History, inst.Object)
          const nonOwned = WSM.APIGetAllNonOwnedReadOnly(refHistory)
          if (nonOwned.length === 0) {
            return
          }

          centerInstanceGeometry(inst.History, inst.Object)

          const geo = wsmTopInstanceToGeometryData(groupInstancePath)
          geo.axmRepresentation = wsmObjectToAXMStringForSave(groupInstancePath)

          newPath = onWSRComplete(geo, groupInstancePath, undefined) ?? ""

          // Set the path for the new 3d sketch element
          edited3DSPathSignal.value = newPath

          if (newPath) {
            setSelectionSignalValue([newPath])
            void recoveryClear(true)
          } else void recoveryClear()
        }

        // Boolean indicates if the floor collection group was deleted. Need to undo the delete if not saving.
        let bFloorCollectionDeleted = { value: false }
        // Stores created path
        let newPath = ""

        // Create an element or save an existing element
        const onCreateSaveAndResetForFurtherEditing = () => {
          if (newPath)
            return onSaveAndResetForFurtherEditing(
              groupInstancePath,
              mapHistoryIdToInitialDeltaId,
              newPath,
              bFloorCollectionDeleted,
            )
          saving3dSketchSignal.value = true
          const selectedGIPs = FormIt.Selection.GetSelections()
          try {
            // Do not update WSR for the save.
            FormIt.SuspendMessaging(true, 0, false)
            createSaveInternal()
            // Make the new element hidden in dm
            HiddenPaths.setPathHidden(newPath, true)
            // Clear the delta
            mapHistoryIdToInitialDeltaId.clear()
            // Delete floor volumes
            bFloorCollectionDeleted.value = deleteFloorCollection(groupInstancePath)
            createInitialHistoryDeltaMapAndResetFormItModified(groupInstancePath, mapHistoryIdToInitialDeltaId)
          } catch (e) {
            console.error(e)
          } finally {
            FormIt.ResumeMessaging()
          }

          if (selectedGIPs.length !== 0) {
            // Note resume messages will cause the selection to be cleared
            // due to a kLoadComplete message in core. Reset it.
            FormIt.Selection.SetSelections(selectedGIPs)
          }

          // Reset the save button visibility in area metrics
          wsmNeedsSaveSignal.value = false
          saving3dSketchSignal.value = false
        }

        // Clear any existing selection during element creation
        setSelectionSignalValue([])

        // Create or save an element then exit 3d sketch
        const onCreateComplete = () => {
          saving3dSketchSignal.value = true
          if (newPath) saveInternal(groupInstancePath, mapHistoryIdToInitialDeltaId, newPath, bFloorCollectionDeleted)
          else {
            createSaveInternal()
          }
          exitCurrentTool()
          saving3dSketchSignal.value = false

          // createSaveInternal sets the edited3DSPathSignal value
          edited3DSPathSignal.value = undefined
        }

        // Initialize the path for the to be 3d sketch element.
        // The actual path will be set in createSaveInternal
        edited3DSPathSignal.value = undefined

        toolAPI.setTool({
          id: "WSRAPITool",
          tool: () => (
            <EditWSMElementTool
              instancePath={groupInstancePath}
              onComplete={onCreateComplete}
              onSave={onCreateSaveAndResetForFurtherEditing}
              modeType={mode}
              recoverySave={() => recoverySave(groupInstancePath, newPath)}
            />
          ),
          toolbar: () => <Integrated3DSketchToolbar />,
          propertyPanel: () => <Properties3dSketch />,
        })

        // Attempt recovery if the user has unsaved changes and confirms they want to continue
        canRecoverSignal.value = true
        // Check and use recovery if available
        await recoveryForCreate(groupInstancePath)
        // Reset the recovery allowance
        canRecoverSignal.value = false

        // Start the last draw or default tool if user didn't use recovery
        if (!recoveryRespondedConfirmed()) {
          const lastDrawToolID = wsmLastSketchToolSignal.peek()
          const toolToStart = lastDrawToolID ? lastDrawToolID : FormIt.ToolType.POLYLINE
          FormIt.Tools.StartTool(toolToStart)
          // Setting this here as the message handler to do this in 3d sketch is not yet registered
          wsmToolIDSignal.value = toolToStart
        }

        onReadyCallback?.(groupInstancePath)

        setFadeAllExceptSignalValue(terrainPath ? [terrainPath] : [])
      } catch (err) {
        captureException(err, {
          tags: { owner: "conceptual", errorPoint: "Create 3D Mesh", "integration-type": "integrated" },
        })
      }
    },
    [setEditModeType, initialize, sync, onWSRComplete, onSaveAndResetForFurtherEditing, saveInternal],
  )

  // Start 3d sketch with initial set of levels applied
  const create3dBuilding = useCallback(
    (method: Method) => {
      // track that we're launching 3D Sketch
      Analytics.trackSelectTool("3dSketch", undefined, method)
      // and adding levels immediately
      Analytics.trackSelectTool("3dSketch", "Add Floors", method, "design-tool")

      void create3dMesh(Integrated3DSketchEditModeType.WSM, (groupInstancePath) => {
        // If recovery was used, then don't add levels or start a tool
        if (recoveryRespondedConfirmed()) return
        const { historyId, objectId } = getFirstObjectAndHistoryIdFromGIP(groupInstancePath)

        // Create initial level data (200 levels for now)
        const newWSMLevelsDataToAdd = generateCustomWSMLevelData(200, 1, 0, defaultFloorHeightInFeet)

        addWSMLevelDataToWSMInstance(historyId, objectId, newWSMLevelsDataToAdd)

        //Start the last draw or default tool for 3d buildings
        const lastDrawToolBuildingID = wsmLastSketchToolBuildingSignal.peek()
        const toolToStart = lastDrawToolBuildingID ? lastDrawToolBuildingID : FormIt.ToolType.POLYLINE
        FormIt.Tools.StartTool(toolToStart)
        // Setting this here as the message handler to do this in 3d sketch is not yet registered
        wsmToolIDSignal.value = toolToStart
      })
    },
    [create3dMesh, defaultFloorHeightInFeet],
  )

  const addOrRemoveFloorsByPath = useCallback(
    (path: InternalPath, floorHeightInFeet: number | undefined, gfaUnitLevels?: boolean) => {
      initialize()
        .then(() => {
          const onReadyCallback = () => {
            const wsmDetailsForElementPath: WSMDetailsForElementPath | undefined = lookupWSMObject(path)
            const groupInstancePath = wsmDetailsForElementPath?.groupInstancePath

            if (groupInstancePath && groupInstancePath.ids.length === 1) {
              //If the incoming path is not geoJSON or WSM backed, we will have mesh(es) to convert.
              //Do this before looking for non-zero volume in canAddLevelsToInstance since some
              //meshes will not have normals (which result in 0 volume).
              prepareDataForEdit(groupInstancePath, () => setDisplayTriangleWarning(true))

              if (
                floorHeightInFeet === undefined ||
                canAddLevelsToInstance(
                  groupInstancePath.ids[0].History,
                  groupInstancePath.ids[0].Object,
                  floorHeightInFeet,
                  gfaUnitLevels,
                )
              ) {
                // Boolean indicates if the floor collection group was deleted. Need to undo the delete if not saving.
                const bFloorCollectionDeleted = deleteFloorCollection(groupInstancePath)

                // Save all the delta ids at load time for each history. These ids will be used on save to know if the history is in
                // a different state and hence needs to be saved.
                const mapHistoryIdToInitialDeltaId: Map<number, number> = new Map<number, number>()

                // Note when gfaUnitLevels is true, we need to save to add the floors. Levels were previously
                // added on the sync. So skip making the delta map to force the save and do not add levels.
                if (gfaUnitLevels !== true) {
                  createInitialHistoryDeltaMapAndResetFormItModified(groupInstancePath, mapHistoryIdToInitialDeltaId)
                  // Remove existing floors if any.
                  removeLevels(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object)

                  if (floorHeightInFeet !== undefined) {
                    // Add floors based on the height.
                    addLevelsToInstance(
                      groupInstancePath.ids[0].History,
                      groupInstancePath.ids[0].Object,
                      floorHeightInFeet,
                    )
                  }
                }

                if (hasAnyInitalHistoryDeltaChanged(groupInstancePath, mapHistoryIdToInitialDeltaId) === true) {
                  setWSMGeoBottomToZero(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object)
                  const geoData = wsmTopInstanceToGeometryData(groupInstancePath)
                  geoData.axmRepresentation = wsmObjectToAXMStringForSave(groupInstancePath)
                  onWSRComplete(geoData, groupInstancePath, path)
                } else {
                  if (bFloorCollectionDeleted) {
                    console.log("Undo floor collection deletion.")
                    undoFloorCollectionDelete(groupInstancePath)
                  }
                }
                Analytics.trackSelectTool("3dSketch", "Add Floors", "right_panel", "design-tool")
              } else {
                console.error("Cannot add floors to element.")
              }
            }
          }

          sync(path, onReadyCallback, true /*forBrep*/)
        })
        .catch((err) => {
          captureException(err, {
            tags: { owner: "conceptual", errorPoint: "Add Floors By Path", "integration-type": "integrated" },
          })
        })
    },
    [initialize, onWSRComplete, setDisplayTriangleWarning, sync],
  )

  const booleanUnionElementsByPaths = useCallback(
    (paths: InternalPath[]) => {
      initialize()
        .then(() => {
          const gipSelections: WSM.GroupInstancePathInterface[] = []
          const mapHistoryIdToInitialDeltaIds: Map<number, number>[] = Array.from(new Array(paths.length))
          const pathGIPMap: Record<InternalPath, WSM.GroupInstancePathInterface> = {}
          paths.forEach((p) => void new Promise<void>((resolve) => sync(p, resolve, true)))
          paths.forEach((path, i) => {
            const wsmDetailsForElementPath: WSMDetailsForElementPath | undefined = lookupWSMObject(path)
            const groupInstancePath = wsmDetailsForElementPath?.groupInstancePath

            if (groupInstancePath && groupInstancePath.ids.length === 1) {
              //If the incoming path is not geoJSON or WSM backed, we will have mesh(es) to convert.
              //Do this before looking for non-zero volume in canAddLevelsToInstance since some
              //meshes will not have normals (which result in 0 volume).
              prepareDataForEdit(groupInstancePath, () => setDisplayTriangleWarning(true))
              gipSelections.push(groupInstancePath)
              mapHistoryIdToInitialDeltaIds[i] = new Map<number, number>()
              createInitialHistoryDeltaMapAndResetFormItModified(groupInstancePath, mapHistoryIdToInitialDeltaIds[i])
              pathGIPMap[path] = groupInstancePath
            }
          })

          // Get the geometric body objects. TODO: Make this recursively traverse instances if any
          const bodyRefIds = gipSelections.flatMap((gip) => {
            const finalObjectHistoryId = WSM.Utils.GetGroupInstancePathFinalObjectHistoryID(gip)
            const refHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(
              finalObjectHistoryId.History,
              finalObjectHistoryId.Object,
            )
            if (refHistoryId === WSM.INVALID_ID) {
              throw new Error("invalid history")
            }
            const bodyIds = WSM.APIGetAllObjectsByTypeReadOnly(refHistoryId, WSM.nObjectType.nBodyType)
            return bodyIds.map((b) => ({
              ids: [...gip.ids, { History: refHistoryId, Object: b, objectName: "ObjectHistoryID" }],
              objectName: "GroupInstancePath",
            }))
          })

          // Do the WSM Unite operation
          WSM.APIUniteNonDestructive(bodyRefIds?.[0], bodyRefIds.slice(1))

          // Delete the modifying/tool elements
          paths.slice(1).forEach((p) => {
            elementState.edit(({ removeElement }) => {
              removeElement(scenarioModeSignal.peek() ? "base" : "proposal", getLeafKey(p))
            })
          })

          // Save the first element where the union was applied
          const path = paths[0]
          const groupInstancePath = pathGIPMap[path]

          if (!groupInstancePath || groupInstancePath.ids?.length !== 1) return
          setWSMGeoBottomToZero(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object)
          const geoData = wsmTopInstanceToGeometryData(groupInstancePath)
          geoData.axmRepresentation = wsmObjectToAXMStringForSave(groupInstancePath)
          onWSRComplete(geoData, groupInstancePath, path)
        })
        .catch((err) => {
          captureException(err, {
            tags: { owner: "conceptual", errorPoint: "Add Floors By Path", "integration-type": "integrated" },
          })
        })
    },
    [initialize, onWSRComplete, setDisplayTriangleWarning, sync],
  )

  const inI3DSMode = toolAPI.currentToolSignal.value.id === "WSRAPITool"
  const isEditingConstraint = useMemo(() => editMode === Integrated3DSketchEditModeType.Constraints, [editMode])

  return useMemo(
    () => ({
      addOrRemoveFloorsByPath,
      booleanUnionElementsByPaths,
      edit3dMeshByPath,
      create3dMesh,
      inI3DSMode,
      isEditingConstraint,
      create3dBuilding,
    }),
    [
      addOrRemoveFloorsByPath,
      booleanUnionElementsByPaths,
      create3dMesh,
      edit3dMeshByPath,
      inI3DSMode,
      isEditingConstraint,
      create3dBuilding,
    ],
  )
}
