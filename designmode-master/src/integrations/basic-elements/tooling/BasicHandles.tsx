import type { Feature } from "geojson"
import { useCallback, useMemo } from "preact/hooks"
import { Matrix4 } from "three"
import { RoofHandle, WallHandles } from "src/integrations/tools-common/PushPull/ExtrudedPolygonHandles"
import { HiddenPaths } from "src/core/hidden"
import type { Properties } from "@spacemakerai/element-types"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import type { InternalPath } from "src/lib/element/path"
import { isBasicElementUrn } from "src/lib/element/urn"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { urlFlags } from "src/lib/featureToggling"
import { isDefined } from "src/lib/array"
import { elementState } from "src/core/elements/ElementState"
import { selectedPathsInCurrentProposalAsArraySignal } from "src/core/selection/selectionState"

type VolumeData = {
  path: InternalPath
  geojson: ExtrudedPolygonFeature
  worldTransform?: Matrix4
  properties?: Properties
}

function isExtrudedPolygon(feature: Feature): feature is ExtrudedPolygonFeature {
  return feature.geometry.type === "Polygon" && !!feature.properties?.height
}

function useSelectedVolumeSelector(): VolumeData[] {
  const snapshot = elementState.currentSnapshot.value
  const selection = selectedPathsInCurrentProposalAsArraySignal.value

  return useMemo((): VolumeData[] => {
    return selection
      .map((path): VolumeData | undefined => {
        const node = snapshot.getNode(path)
        if (!node || !isBasicElementUrn(node.urn)) return

        const element = node.element
        if (urlFlags.wsr && element.properties?.category === "constraints") return

        const geojson = node.elementContainer.representations.footprint
        if (!geojson || !isExtrudedPolygon(geojson)) return
        return {
          path: path,
          geojson,
          worldTransform: node.globalMatrix,
          properties: element.properties,
        }
      })
      .filter(isDefined)
  }, [selection, snapshot])
}

const identity = new Matrix4()

export function BasicHandles() {
  const selectedVolumes = useSelectedVolumeSelector()

  const actionAPI = useActionAPI()

  const hide = useCallback((path: string) => {
    HiddenPaths.setPathHidden(path, true)
  }, [])

  const unhide = useCallback((path: string) => {
    HiddenPaths.setPathHidden(path, false)
  }, [])

  const onComplete = useCallback(
    (path: string, newGeoJson: ExtrudedPolygonFeature) => {
      const actions = BasicElementAPI.basicActionsToCoreActions([BasicElementAPI.updateFeature(path, newGeoJson)])
      actionAPI.apply("Push pull", actions)
      unhide(path)
    },
    [actionAPI, unhide],
  )

  if (selectedVolumes.length !== 1) return null
  const { path, geojson, worldTransform, properties } = selectedVolumes[0]
  return (
    <>
      <WallHandles
        id={path}
        feature={geojson}
        worldTransform={worldTransform ?? identity}
        onComplete={(id, geojson) => onComplete(id, geojson)}
        onStart={hide}
        onCancel={unhide}
        elementProperties={properties}
      />
      <RoofHandle
        id={path}
        feature={geojson}
        worldTransform={worldTransform ?? identity}
        onComplete={(id, geojson) => onComplete(id, geojson)}
        onStart={hide}
        onCancel={unhide}
        elementProperties={properties}
      />
    </>
  )
}
