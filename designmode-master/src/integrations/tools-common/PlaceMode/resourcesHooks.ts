import type { CallbackInterface } from "recoil"
import { useRecoilCallback } from "recoil"
import type { SuccessLibraryItem } from "src/integrations/library/api"
import type { LibraryTerrainElement } from "./library"
import { libraryElementsState, libraryTerrainElementState } from "./library"
import { downloadAndComputeLibraryElementData } from "./useLibraryVisibilityEvents"
import { setShowTerrainSignalValue } from "src/core/terrain/terrain-state"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import {
  resetContextRootSignal,
  resetFadeAllSignal,
  resetHoveredIdsSignal,
  resetSelectionSetSignal,
  setFadeAllSignalValue,
} from "src/core/selection/selectionState"
import SelectFromLibraryItemsToolWrapper, {
  hoveredLibraryElementsState,
  selectedLibraryElementsState,
} from "./PlaceModeGeorefTool"
import { AnalyticsLegacy } from "src/core/analytics"
import { isDefined } from "src/lib/array"
import { placeModeVisualsActiveState } from "./placeModeVisualHook"
import { captureException, captureMessage } from "@sentry/browser"
import {
  missingProjectGeoLocationToast,
  missingTerrainElementToast,
  projectGeoLocationSignal,
} from "src/core/project/project"
import { fetchRawTerrainData } from "src/core/terrain/terrain-download"
import { parseUrn } from "src/lib/element/urn"
import type { Urn } from "@spacemakerai/element-types"
import notifyLargeScaledGeometries from "./notifyLargeScaledGeometries"
import PlaceModeAffineTool from "./PlaceModeAffineTool"
import { getTranslator } from "src/i18n"
import PlaceModeTerrainTool from "./PlaceModeTerrainTool"
import { getElementsClient } from "src/core/elements-loading/loading"
import { buildBasicBuildingFromFloorPlan } from "src/integrations/building-systems-basic-building/basicBuildingFloorPlans"
import { Mesh, MeshLambertMaterial } from "three"
import { acceleratedRaycast } from "three-mesh-bvh"
import type { TerrainElement } from "src/core/terrain/terrain-types"
import { elementState } from "src/core/elements/ElementState"
import { setLibraryVisibility } from "src/integrations/library-window-events/dispatchers"
import { useIsImperial } from "src/lib/unitSettings"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const toolConfigs: Record<string, ToolCfg> = {
  terrain: {
    id: "placeMode:terrain",
    toolbar: () => null,
    tool: PlaceModeTerrainTool,
    propertyPanel: "default",
  },
  georef: {
    id: "placeMode:georef",
    toolbar: () => null,
    tool: SelectFromLibraryItemsToolWrapper,
    propertyPanel: "default",
  },
  manual: {
    id: "placeMode:manual",
    toolbar: () => null,
    tool: PlaceModeAffineTool,
    propertyPanel: "default",
  },
}

export async function downloadLibraryTerrainElement(urn: Urn): Promise<LibraryTerrainElement> {
  const { element } = await getElementsClient().getElementAutoBatched(urn)
  const terrainElement = element as TerrainElement
  const terrainData = await fetchRawTerrainData(terrainElement, false)
  const previewMesh = new Mesh(terrainData.geometry, new MeshLambertMaterial({ color: "#ccc" }))
  previewMesh.raycast = acceleratedRaycast
  previewMesh.receiveShadow = true
  previewMesh.castShadow = true
  previewMesh.name = "Terrain"
  return { element: terrainElement, terrainData, previewMesh }
}

export const useActivatePlaceMode = () => {
  const isImperial = useIsImperial()

  return useRecoilCallback(
    ({ set, reset }) =>
      async (li: SuccessLibraryItem) => {
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Place mode (activate)", { libraryItemId: li.id })
        if (!li.urn) {
          // This should not happen, as only status === "success" should be passed into this function from `useLibraryVisibilityEvents`
          const t = getTranslator()
          window.forma_toasts.push({
            content: t(($) => $.errors.library.couldNotFindElement),
            status: "warning",
          })
          captureMessage("Library element does not have urn", { level: "warning", extra: { libraryItem: li } })
          return
        }
        const terrainSamplerData = terrainSignal.peek().terrainSamplerData
        const terrainElement = elementState.currentTerrainSignal.peek()?.element

        const projectGeoLocation = projectGeoLocationSignal.peek()

        if (!projectGeoLocation) {
          missingProjectGeoLocationToast()
          return
        }

        if (!terrainElement) {
          missingTerrainElementToast()
          return
        }

        resetSelectionSetSignal()
        resetHoveredIdsSignal()

        // Special handling of terrain, as we can't use the same toplevel/renderable loop for that
        if (parseUrn(li.urn).system === "terrain") {
          try {
            window.globalSpinner.start()
            const libraryTerrainElement = await downloadLibraryTerrainElement(li.urn)
            set(libraryTerrainElementState, libraryTerrainElement)
            toolAPI.setTool(toolConfigs.terrain)
            set(placeModeVisualsActiveState, true)
            setFadeAllSignalValue(true)
            setShowTerrainSignalValue(false)
          } catch (error) {
            window.forma_toasts.push({
              content: "Failed to download library item. Please try again later",
              status: "error",
            })
            reset(libraryTerrainElementState)
            exitCurrentTool()
            set(placeModeVisualsActiveState, false)
            setFadeAllSignalValue(false)
            setShowTerrainSignalValue(true)
            console.error(error)
            captureException(error, { level: "warning" })
            setLibraryVisibility(undefined, undefined)
          } finally {
            window.globalSpinner.stop()
          }
        } else {
          try {
            let urn = li.urn
            let id = li.id

            window.globalSpinner.start()
            if (parseUrn(urn).system === "floor-plan-store") {
              const ref = await buildBasicBuildingFromFloorPlan(urn, isImperial)
              urn = ref.urn
              id = ref.id
              // Don't track this with new tracking schema
              AnalyticsLegacy.track("FloorPlans - Add floor plan from library to 3d scene")
            }
            const elementName = li.name ?? "Image"
            const libElementData = await downloadAndComputeLibraryElementData(
              urn,
              terrainSamplerData,
              terrainSignal.peek(),
              projectGeoLocation,
            )
            const libElement = { ...libElementData, name: elementName }
            notifyLargeScaledGeometries(libElement, isImperial)
            set(placeModeVisualsActiveState, true)
            setFadeAllSignalValue(true)
            setLibraryVisibility(id, urn)
            if (
              isDefined(libElement.state.elements.getOrThrow(libElement.state.rootUrn).properties?.geoReference) &&
              isDefined(projectGeoLocation)
            ) {
              toolAPI.setTool(toolConfigs.georef)
            } else {
              toolAPI.setTool(toolConfigs.manual)
            }

            set(libraryElementsState, libElement)
          } catch (error) {
            window.forma_toasts.push({
              content: "Failed to download library item. Please try again later",
              status: "error",
            })
            setFadeAllSignalValue(false)
            set(placeModeVisualsActiveState, false)
            console.error(error)
            captureException(error, { level: "warning" })
            setLibraryVisibility(undefined, undefined)
          } finally {
            window.globalSpinner.stop()
          }
        }
      },
    [isImperial],
  )
}

export function exitPlaceMode({ reset }: CallbackInterface) {
  // Don't track this with new tracking schema
  AnalyticsLegacy.track("Place mode (exit)")
  resetContextRootSignal()
  reset(hoveredLibraryElementsState)
  reset(selectedLibraryElementsState)
  reset(libraryElementsState)
  resetFadeAllSignal()
  reset(placeModeVisualsActiveState)
  setShowTerrainSignalValue(true)
  setLibraryVisibility(undefined, undefined)
}

export const useExitPlaceMode = () => {
  return useRecoilCallback(
    (i) => () => {
      exitCurrentTool()
      exitPlaceMode(i)
    },
    [],
  )
}
