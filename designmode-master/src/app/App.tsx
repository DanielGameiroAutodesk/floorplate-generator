import { useRecoilState } from "recoil"
import { useUpdateRaycastingTargetsList } from "./appHooks/useRaycastingTargetsList"
import { submodeSignal } from "src/core/submode-state"
import useShowHintToEdit from "src/integrations/3dsketch/useShowHintToEdit"
import { triggerAnalyticsPageLoad } from "src/core/analytics"
import { useAutoSave } from "src/core/elements-saving/auto-save"
import { useLibraryVisibilityEvents } from "src/integrations/tools-common/PlaceMode/useLibraryVisibilityEvents"
import { useDeselectUnselectableElements } from "./appHooks/useDeselectUnselectable"
import { isDefined } from "src/lib/array"
import { SIDEBAR_DEFAULT_STATE, sidebarsCollapsedState } from "src/integrations/sidebar/sidebarsState"
import { useFetchBuildingFunctions } from "src/integrations/building-systems-common/useFetchBuildingFunctions"
import { useLogBasicBatches } from "src/integrations/basic-elements/api/batching"
import useOnCompletePayment from "./appHooks/useOnCompletePayment"
import { checklyDesignModeInitialized, checklyDesignModeLoaded } from "./checklyDesignMode"
import { useUpdatePropertyElementPresets } from "./appHooks/useUpdatePropertyElementPresets"
import { basicElementSystem } from "src/integrations/basic-elements/BasicSystemInterface"
import { Priority, useEventHandler } from "src/lib/eventManager"
import { groupElementSystem } from "src/integrations/group-element-system/client"
import { IntegrateElementSystem } from "src/integrations/integrate-element-system/IntegrateElementSystem"
import { parametricElementSystem } from "src/integrations/parametric-element-system/ParametricSystemInterface"
import MainMode from "./modes/MainMode/MainMode"
import { proposalElementSystem } from "src/core/proposal-element-system/proposalSaving"
import useBackForwardLocationChanged from "./appHooks/useBackForwardLocationChanged"
import ViewAnalysisMode from "./modes/ViewAnalysis/ViewAnalysisMode"
import { useCameraSync } from "src/integrations/camsync/cameraWindowSync"
import { setupEventToasts } from "src/core/events/apponly/EventsDebug"
import BasicBuildingElementSystem from "src/integrations/building-systems-basic-building/BasicBuildingElementSystem"
import { useInitializeCamera } from "src/integrations/camera/CameraIntegration"
import { useCallback, useEffect } from "preact/compat"
import { useCalculateExpensiveData } from "src/core/elements/expensive-data"
import { useElementValidation } from "src/core/elements/validation/geometry-validation"
import { rasterElementSystem } from "src/integrations/raster-element-system/rasterElement"
import { hotkeyAPI } from "src/core/hotkeys"
import { canEditProposalSignal } from "src/core/edit-access-state"
import "src/integrations/extensions/EmbeddedViews/extensionsEmbeddedViewContextProvider"
import type { Urn } from "forma-elements"
import { elementState } from "src/core/elements/ElementState"
import type { BufferGeometry } from "three"
import type { Feature } from "geojson"
import { useModelChangedEventTrigger } from "src/core/events/apponly/useModelChangedEventTrigger"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { useInitFormaUnits } from "src/lib/forma-units"
import useInitializeProposal from "./initialize"
import { registerElementSystem } from "src/core/element-systems"
import { useProjectLoading } from "src/core/project/apponly/project-loading"
import { useProjectRolesLoading } from "src/core/project/apponly/roles-loading"
import { useProjectGeoLocationLoading } from "src/core/project/apponly/geo-location-loading"
import { useAppTitle } from "./title"
import useAutoPlaceDataOrders from "./appHooks/useAutoPlaceDataOrders"
import { toolAPI } from "src/core/toolsState"
import { SelectionToolCfg } from "src/integrations/tools-common/Selection/SelectionTool"
import { terrainElementSystem } from "src/integrations/terrainPadsExperimental/terrainElemenSystemInterface"
import CompareScreenshot from "./modes/Compare/CompareScreenshot"
import LightMode from "./modes/Light/LightMode"
import LightModeScreenshot from "./modes/Light/LightModeScreenshot"
import { useUpdateWSMFromAllPreviouslySyncedPaths } from "src/integrations/wsm-tools/wsr/api/useUpdateWSMFromAllPreviouslySyncedPaths"
import { BuildingDesignElementSystem } from "src/integrations/building-design-detailedbuilding/BuildingDesignElementSystem"

triggerAnalyticsPageLoad()
setupEventToasts()

toolAPI.setDefaultTool_INTERNAL(SelectionToolCfg)

const PROPOSAL_SYSTEM = "proposal"
const GROUP_SYSTEM = "group"
const BASIC_SYSTEM = "basic"
const RASTER_SYSTEM = "raster"
const BASIC_BUILDING_SYSTEM = "basicbuilding"
const PARAMETRIC_SYSTEM = "parametric"
const INTEGRATE_SYSTEM = "integrate"
const TERRAIN_SYSTEM = "terrain"

function getFootprint(urn: Urn): Feature | undefined {
  return elementState.currentSnapshot.peek().getElementContainerOrThrow(urn).representations.footprint
}

function getVolumeMeshByUrn(urn: Urn): BufferGeometry | undefined {
  return elementState.currentSnapshot.peek().getElementContainerOrThrow(urn).representations.volumeMesh
}

registerElementSystem(BASIC_SYSTEM, basicElementSystem(getFootprint))
registerElementSystem(RASTER_SYSTEM, rasterElementSystem)
registerElementSystem(GROUP_SYSTEM, groupElementSystem)
registerElementSystem(PARAMETRIC_SYSTEM, parametricElementSystem(getVolumeMeshByUrn))
registerElementSystem(PROPOSAL_SYSTEM, proposalElementSystem)
registerElementSystem(INTEGRATE_SYSTEM, new IntegrateElementSystem())
registerElementSystem(BASIC_BUILDING_SYSTEM, new BasicBuildingElementSystem())
registerElementSystem(TERRAIN_SYSTEM, terrainElementSystem)
registerElementSystem("building-design", BuildingDesignElementSystem)

/**
 * The purpose of this component is to isolate all the calls to hooks that are used to initialize the app from the App
 * component itself. This is to ensure that re-renders caused by hook updates do not cause the App component and its
 * children to re-render.
 *
 * Ideally, the hooks called here should rarely update to avoid having to call all the hooks again.
 */
function InitHooks() {
  const canEditProposal = canEditProposalSignal.value
  const executeHotkey = useCallback(
    (e: KeyboardEvent) => {
      return hotkeyAPI.executeHotkey(e, canEditProposal)
    },
    [canEditProposal],
  )
  useProjectLoading()
  useProjectRolesLoading()
  useProjectGeoLocationLoading()
  useAppTitle()
  useInitializeProposal()
  useShowHintToEdit()
  useAutoSave()

  useLibraryVisibilityEvents()
  useDeselectUnselectableElements()
  useUpdateRaycastingTargetsList()
  useFetchBuildingFunctions()
  useLogBasicBatches()
  useOnCompletePayment()
  useUpdatePropertyElementPresets()
  useEventHandler("keydown", executeHotkey, Priority.HOTKEYS)
  useInitFormaUnits()
  useBackForwardLocationChanged()
  useCalculateExpensiveData()
  useElementValidation()
  useModelChangedEventTrigger()
  useAutoPlaceDataOrders()
  useUpdateWSMFromAllPreviouslySyncedPaths()

  const cameraIsInitializedSignal = useInitializeCamera()
  useCameraSync(cameraIsInitializedSignal)

  const initialized = isAppInitializedSignal.value

  const [sidebarsCollapsed, setSidebarCollapsed] = useRecoilState(sidebarsCollapsedState)

  useEffect(() => {
    checklyDesignModeInitialized()
  }, [])

  useEffect(() => {
    if (initialized) {
      checklyDesignModeLoaded()
      if (!isDefined(sidebarsCollapsed)) {
        setSidebarCollapsed(SIDEBAR_DEFAULT_STATE)
      }
    }
  }, [initialized, setSidebarCollapsed, sidebarsCollapsed])

  return null
}

export default function App() {
  const submode = submodeSignal.value

  switch (submode) {
    case "compare":
      return (
        <>
          <InitHooks />
          <ViewAnalysisMode mode={submode} />
          <CompareScreenshot />
        </>
      )
    case "viewAnalysis":
      return (
        <>
          <InitHooks />
          <ViewAnalysisMode mode={submode} />
        </>
      )
    case "lightMode":
      return (
        <>
          <InitHooks />
          <LightMode />
          <LightModeScreenshot />
        </>
      )
    case undefined:
      return (
        <>
          <InitHooks />
          <MainMode />
        </>
      )
  }
}
