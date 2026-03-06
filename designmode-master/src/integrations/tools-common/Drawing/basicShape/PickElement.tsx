import { useCallback, useEffect } from "preact/compat"
import { defaultCursor, setSelectCursor } from "src/integrations/cursors/setCursor"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import sceneManager from "src/core/three/sceneManager"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import { getTargetPath } from "src/core/selection/raycasting"
import {
  resetFadedElementsSignal,
  resetHoveredIdsSignal,
  scenarioModeSignal,
  setFadedElementsSignalValue,
  setHoveredIdsSignalValue,
} from "src/core/selection/selectionState"
import type { Feature, Position } from "geojson"
import type { Matrix4 } from "three"
import { Vector3 } from "three"
import { isDefined } from "src/lib/array"
import { projectPositionToTerrain } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/projection"
import { IgnoreContext } from "src/core/ignore-context"
import type { InternalPath } from "src/lib/element/path"
import type { Shape } from "src/lib/three/Shape/types"
import { raycastTargetsSignal } from "src/core/selection/raycast-targets"
import { elementState } from "src/core/elements/ElementState"
import shapeFromCoordinates = ShapeUtils.shapeFromCoordinates
import { elementSelectionPathToInternalPath, isElementSelectionPath } from "src/core/selection/selectionTypes"

type Props = {
  onPolygonPicked?: (shape: Shape, additionalProperties: { [key: string]: any }, path: InternalPath) => void
  onLinePicked?: (shape: Shape, additionalProperties: { [key: string]: any }, path: InternalPath) => void
  onExtrudedPolygonPicked?: (shape: Shape, additionalProperties: { [key: string]: any }, path: InternalPath) => void
  onCancel: () => void
}

const useSelectElement = () => {
  return useCallback((e: MouseEvent): InternalPath | undefined => {
    const data = getTargetPath(e, sceneManager.camera, raycastTargetsSignal.peek())
    const selectionPath = data?.selection
    if (!selectionPath || !isElementSelectionPath(selectionPath)) return undefined
    return elementSelectionPathToInternalPath(selectionPath)
  }, [])
}

function shapeFromFeature(feature: Feature, transform?: Matrix4): Shape | undefined {
  const elevation = feature.properties?.elevation

  function getElevation(coordinates: Position[]): number {
    const elevationVector = new Vector3()
    transform && elevationVector.applyMatrix4(transform)

    const vec = new Vector3()
    const lowestPoint = coordinates.reduce((previousValue, currentValue) => {
      vec.set(currentValue[0], currentValue[1], 10000)
      const currentZ = projectPositionToTerrain(vec, vec).z
      return Math.min(currentZ, previousValue)
    }, Number.MAX_SAFE_INTEGER)

    return lowestPoint - elevationVector.z
  }

  switch (feature.geometry.type) {
    case "Polygon":
      return shapeFromCoordinates(
        [feature.geometry.coordinates[0]],
        elevation || getElevation(feature.geometry.coordinates[0]),
        transform,
        true,
      )
    case "LineString":
      return shapeFromCoordinates(
        [feature.geometry.coordinates],
        elevation || getElevation(feature.geometry.coordinates),
        transform,
        false,
      )
    default:
      return undefined
  }
}

function getFeatureType(feature?: Feature): "polygon" | "line" | "extrudedPolygon" | undefined {
  switch (feature?.geometry?.type) {
    case "LineString":
      return "line"
    case "Polygon":
      if (isDefined(feature.properties?.height) && isDefined(feature.properties?.elevation)) {
        return "extrudedPolygon"
      } else {
        return "polygon"
      }
    default:
      return
  }
}

/**
 * Lets a user select a shape in the scene, honoring layer locks and visibility
 * @param onCancel triggered when user cancels by hitting esc
 * @param onExtrudedPolygonPicked defining this will let users select extruded polygons, and will fire this callback when they do so
 * @param onLinePicked defining this will let users select lines, and will fire this callback when they do so
 * @param onPolygonPicked defining this will let users select non-extruded polygons, and will fire this callback when they do so
 */
export const PickElement = ({ onCancel, onExtrudedPolygonPicked, onLinePicked, onPolygonPicked }: Props) => {
  const toplevel = elementState.currentProposalSignal.value.getToplevelNodes()
  const selectElementsAtMouse = useSelectElement()

  useEffect(() => {
    setSelectCursor()

    return () => {
      defaultCursor()
    }
  }, [])

  useEffect(() => {
    IgnoreContext.setIgnoreContext(true)

    return () => {
      IgnoreContext.setIgnoreContext(false)
    }
  }, [])

  const scenarioMode = scenarioModeSignal.value

  useEffect(() => {
    const nonSelectableElements = toplevel.filter((node) => {
      if (node.isInBase !== scenarioMode) return true

      const feature = node.elementContainer.representations.footprint
      const featureType = getFeatureType(feature)
      switch (featureType) {
        case "line":
          return !onLinePicked
        case "polygon":
          return !onPolygonPicked
        case "extrudedPolygon":
          return !onExtrudedPolygonPicked
      }
      return false
    })

    setFadedElementsSignalValue(new Set(nonSelectableElements.map((e) => e.path)))

    return () => {
      resetFadedElementsSignal()
    }
  }, [toplevel, onPolygonPicked, onLinePicked, onExtrudedPolygonPicked, scenarioMode])

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel()
        return Propagate.NO
      }
      return Propagate.YES
    },
    [onCancel],
  )
  useEventHandler("keydown", keydown, Priority.TOOL)

  const pick = useCallback(
    (e: MouseEvent) => {
      const selectedPath = selectElementsAtMouse(e)
      const selected = toplevel.find((tl) => tl.path === selectedPath)

      if (!selected) return
      let feature = selected.elementContainer.representations.footprint
      if (!feature) return
      return { selected, feature }
    },
    [selectElementsAtMouse, toplevel],
  )

  const mouseup = useCallback(
    (e: MouseEvent) => {
      const picked = pick(e)
      if (!picked) return Propagate.YES
      const { selected, feature } = picked

      const shape = shapeFromFeature(feature, selected.globalMatrix)
      if (!shape) {
        return Propagate.NO
      }
      const featureType = getFeatureType(feature)
      switch (featureType) {
        case "polygon":
          if (onPolygonPicked) {
            onPolygonPicked(shape, {}, selected.path)
            resetHoveredIdsSignal()
            return Propagate.NO
          }
          return Propagate.YES
        case "line":
          if (onLinePicked) {
            onLinePicked(shape, {}, selected.path)
            resetHoveredIdsSignal()
            return Propagate.NO
          }
          return Propagate.NO
        case "extrudedPolygon":
          if (onExtrudedPolygonPicked) {
            onExtrudedPolygonPicked(shape, feature.properties || {}, selected.path)
            resetHoveredIdsSignal()
            return Propagate.NO
          }
          return Propagate.YES
        default:
          return Propagate.YES
      }
    },
    [pick, onPolygonPicked, onLinePicked, onExtrudedPolygonPicked],
  )

  const mousemove = useCallback(
    (e: MouseEvent) => {
      const picked = pick(e)
      if (!picked) {
        resetHoveredIdsSignal()
        return Propagate.YES
      }

      const featureType = getFeatureType(picked.feature)
      switch (featureType) {
        case "line":
          if (!onLinePicked) return Propagate.YES
          break
        case "polygon":
          if (!onPolygonPicked) return Propagate.YES
          break
        case "extrudedPolygon":
          if (!onExtrudedPolygonPicked) return Propagate.YES
          break
      }
      const selectedPath = selectElementsAtMouse(e)
      if (!selectedPath) return Propagate.YES

      let hovered = new Set<string>([selectedPath])

      setHoveredIdsSignalValue(hovered)
      return Propagate.YES
    },
    [selectElementsAtMouse, pick, onPolygonPicked, onLinePicked, onExtrudedPolygonPicked],
  )

  useEventHandler("mouseup", mouseup, Priority.TOOL, sceneManager.canvas)
  useEventHandler("mousemove", mousemove, Priority.TOOL, sceneManager.canvas)
  return null
}
