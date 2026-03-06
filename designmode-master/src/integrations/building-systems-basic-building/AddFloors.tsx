import { useMemo } from "preact/compat"
import { parseUrn } from "src/lib/element/urn"
import type { Transform } from "@spacemakerai/element-types"
import { Matrix4, type Matrix4Tuple } from "three"
import { AddButton } from "src/lib/components/icons/AddButton"
import { isExtrudedPolygon, type ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import type { Polygon } from "./lib/geometry/geometry"
import BasicBuildingAPI from "./BasicBuildingAPI"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { toMetersIfImperial } from "src/lib/measurementSystem"
import { captureException } from "@sentry/browser"
import { isDefined } from "src/lib/array"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"
import { EventName } from "@spacemakerai/webapp-analytics"
import { useCallback } from "react"
import { useErrorBoundary } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { contextRootSignal, selectionArraySignal } from "src/core/selection/selectionState"
import { RightMenuPanel } from "src/lib/components/RightMenu/RightMenuPanel"
import { contextualDataApi } from "src/integrations/contextual-data/api"
import { useIntegrated3DSketchAPI } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import { METER_TO_FEET } from "@spacemakerai/forma-units"
import { useSyncPath } from "src/integrations/wsm-tools/wsr/api/useSync"
import { useInitializeFormitCoreCallback } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { canAddLevelsToInstance } from "src/integrations/wsm-tools/building/buildingFloorUtils"
import { isPathSyncUpToDate, lookupWSMObject } from "src/integrations/wsm-tools/wsr/api/mapping"
import { signal } from "@preact/signals"
import { useIsImperial } from "src/lib/unitSettings"
import { getTranslator, useTranslator } from "src/i18n"

// Signal that is changed when a path is synced to tigger a re-render when
// a sync happens.
const wsmSyncCountSignal = signal<number>(0)

function AddFloorsInner() {
  const snapshot = elementState.currentSnapshot.value
  const selected = selectionArraySignal.value
  const actionApi = useActionAPI()
  const imperialUnits = useIsImperial()
  const i3dsAPI = useIntegrated3DSketchAPI()
  const wsmSyncCount = wsmSyncCountSignal.value
  const sync = useSyncPath()
  const initialize = useInitializeFormitCoreCallback()

  // Find elements that should be converted to basic buildings or 3d sketch buildings.
  const boxes = useMemo(() => {
    if (selected.length > 100) {
      // Loading many elements into WSM can be slow, but this isn't a common use-case, so we simply abort early
      return []
    }
    return selected
      .map((path) => {
        const node = snapshot.getNode(path)
        if (!node) return null

        // Look for elements to convert to basic buildings first.
        if (parseUrn(node.urn).system === "basic") {
          let geojsonElement = node.elementContainer.representations.footprint
          if (geojsonElement && isExtrudedPolygon(geojsonElement)) {
            if (
              node.element.properties?.category === undefined ||
              ["unspecified", "building", "generic"].includes(node.element.properties.category)
            ) {
              return {
                id: path,
                data: geojsonElement,
                transform: node.globalMatrix.toArray(),
                urn: node.urn,
              }
            }
          }
        }

        // only used for triggering a re-render when the model changes
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const reRenderOnSyncPathFinishes = wsmSyncCount

        // If we returned above, we found an element to convert to a basic building. Since we
        // have not returned, look for an element to convert to a 3d sketch building.
        const formats: string[] =
          node.elementContainer.element.properties?.spacemakerObjectStorageReferenceFormats || []
        const isWSMOrAXM = formats.includes("wsm") || formats.includes("axm")

        const isLoD2ContextualBuilding = contextualDataApi.isLoD2Building(node.elementContainer.element)
        let convertTo3dSBuilding = false
        if (isLoD2ContextualBuilding && !isWSMOrAXM) {
          // Note since we do not have an axm backing the element, it must be a contextual building.
          convertTo3dSBuilding = true
        }

        if (!isLoD2ContextualBuilding && isWSMOrAXM) {
          if (
            node.elementContainer.element.properties?.category === undefined ||
            node.elementContainer.element.properties?.category === "generic"
          ) {
            // The check above rules out 3d sketch buildings.
            convertTo3dSBuilding = true
          }
        }

        if (convertTo3dSBuilding) {
          const isReady = isPathSyncUpToDate(path, node.urn, node.globalMatrix.toArray())
          if (!isReady) {
            // sync the path so we can check.
            initialize()
              .then(() => {
                sync(
                  path,
                  () => {
                    // Signal to indicate that a sync happened. Useful when waiting for
                    // multiple syncs to complete.
                    wsmSyncCountSignal.value += 1
                  },
                  true /*forBrep*/,
                )
              })
              .catch((e) => {
                console.error("Failed to sync path for add floors code", e)
              })
          } else {
            // We get here once the model is synced. So now check if it can have floors.
            const wsmDetailsForElementPath = lookupWSMObject(path)
            if (wsmDetailsForElementPath) {
              const groupInstancePath = wsmDetailsForElementPath.groupInstancePath
              if (groupInstancePath) {
                let bIgnoreLevels = false
                if (
                  node.elementContainer.element.properties?.category === "building" &&
                  (node.elementContainer.element.children === undefined ||
                    node.elementContainer.element.children.length === 0) &&
                  node.elementContainer.element.representations?.gfaUnits !== undefined
                ) {
                  bIgnoreLevels = true
                }

                const storyHeight = imperialUnits ? 10 : 3 * METER_TO_FEET
                if (
                  canAddLevelsToInstance(
                    groupInstancePath.ids[0].History,
                    groupInstancePath.ids[0].Object,
                    storyHeight,
                    bIgnoreLevels,
                  )
                ) {
                  return { id: path, gfaUnitLevels: bIgnoreLevels }
                }
              }
            }
          }
        }
      })
      .filter(isDefined)
  }, [imperialUnits, initialize, selected, snapshot, sync, wsmSyncCount])

  const convert = useCallback(() => {
    if (boxes.length === 0) return
    const to3dSketchBuilding: { id: string; gfaUnitLevels: boolean }[] = []
    const toBasicBuilding: {
      id: string
      data: ExtrudedPolygonFeature
      transform: Matrix4Tuple
      urn: `urn:adsk-forma-elements:${string}:${string}:${string}:${string}`
    }[] = []
    boxes.forEach((box) => {
      if (box.data === undefined) {
        to3dSketchBuilding.push(box)
      } else {
        toBasicBuilding.push(box)
      }
    })

    if (to3dSketchBuilding.length > 0) {
      const storyHeight = imperialUnits ? 10 : 3 * METER_TO_FEET
      to3dSketchBuilding.forEach((box) => {
        i3dsAPI.addOrRemoveFloorsByPath(box.id, storyHeight, box.gfaUnitLevels)
      })
    }

    if (toBasicBuilding.length === 0) return

    // Capture category information BEFORE elements are deleted by actionApi.apply()
    const elementCategories = toBasicBuilding.map((box) => {
      const node = snapshot.getNode(box.id)
      return node?.element.properties?.category
    })

    const actions = toBasicBuilding.map((box) => {
      const transform: Transform = box.transform ? [...box.transform] : new Matrix4().toArray()
      const geojson = box.data
      transform[14] += geojson.properties.elevation

      const height = geojson.properties.height * transform[10]

      // Set z-scale to 1 after applying it to transform height to avoid double scaling
      transform[8] = 0
      transform[9] = 0
      transform[10] = 1

      const storyHeight = imperialUnits ? toMetersIfImperial(10, imperialUnits) : 3
      const polygon = geojson.geometry.coordinates[0] as Polygon
      const basicBuilding = BasicBuildingAPI.createBasicBuildingFromPolygon(polygon, height, storyHeight)
      const { key, actions: addActions } = BasicBuildingAPI.actions.createAddActions(
        basicBuilding,
        transform,
        actionApi,
      )
      const basicBuildingPath = contextRootSignal.peek() + "/" + key

      const volumePath = box.id
      const deleteActions: Action[] = [{ type: "delete", path: volumePath }]
      return { actions: [...addActions, ...deleteActions], removePath: volumePath, addPath: basicBuildingPath }
    })
    try {
      actionApi.apply(
        "Replace volumes with basic building",
        actions.flatMap((a) => a.actions),
        undefined,
        (current) => {
          const newSelection = new Set(current)
          for (const { removePath, addPath } of actions) {
            newSelection.delete(removePath)
            newSelection.add(addPath)
          }
          return newSelection
        },
      )

      for (let i = 0; i < toBasicBuilding.length; i++) {
        const category = elementCategories[i]

        // Contextual data buildings are distinguished by having category "building"
        // (vs user-drawn volumes which have category undefined/generic)
        const isContextualData = category === "building"
        const creationMethod = isContextualData ? "contextual_data" : "volume_conversion"
        dispatchBuildingEvent("basic_building", EventName.Add, creationMethod)
      }
    } catch (e) {
      console.error("Failed to convert volumes to basic building", e)
      console.log(
        "Failed volumes:",
        toBasicBuilding.map((b) => b.urn),
      )
      captureException(e, { tags: { owner: "building-systems" } })
      const t = getTranslator()
      window.forma_toasts.push({
        content: t(($) => $.errors.building.failedToConvertVolumes),
        status: "error",
      })
    }
  }, [boxes, imperialUnits, i3dsAPI, actionApi, snapshot])

  const t = useTranslator()

  if (boxes.length === 0) return null
  return (
    <>
      <hr style={{ border: "none", height: "1px", backgroundColor: "var(--border-color-divider-light)" }} />
      <RightMenuPanel>
        <span style={{ font: "var(--12-medium)" }}>{t(($) => $.building.addFloorsAction)}</span>
        <AddButton onClick={convert} />
      </RightMenuPanel>
    </>
  )
}

export default function AddFloors() {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("AddFloors error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "building-systems" } })
  })
  if (error) return null
  return <AddFloorsInner />
}
