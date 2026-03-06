import { useRecoilValue } from "recoil"
import SubMode from "src/lib/components/SubMode/SubMode"
import { libraryTerrainElementState } from "./library"
import styles from "./PlaceModeGeorefTool.module.css"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { useExitPlaceMode } from "./resourcesHooks"
import type { RawTerrainData } from "src/core/terrain/terrain-download"
import { elementState } from "src/core/elements/ElementState"
import { useCallback } from "preact/compat"
import type { TerrainElement } from "src/core/terrain/terrain-types"
import { analyticsAndBreadcrumbsForActions, Analytics } from "src/core/analytics"
import { loadTerrainDataAndCreateElementContainer } from "src/core/terrain/terrain-container"
import type { Terrain } from "src/core/elements/Terrain"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { useTranslator } from "src/i18n"

async function onPlaceTerrainInElementState(
  existingTerrain: Terrain,
  element: TerrainElement,
  terrainData: RawTerrainData,
) {
  const existingTerrainNode = existingTerrain.node

  const newContainer = await loadTerrainDataAndCreateElementContainer(element, {
    prefetchedTerrainData: terrainData,
  })

  analyticsAndBreadcrumbsForActions("Replace terrain")
  elementState.edit(({ updateElement }) => {
    updateElement("proposal", { ...existingTerrainNode.child, urn: newContainer.element.urn }, newContainer)
  })
  Analytics.track(
    EventName.Add,
    {
      feature_category: FeatureCategory.ContextualData,
      feature: "place_mode",
      sub_feature: "place_mode_terrain",
      object_type: "element",
    },
    { category: "terrain" },
  )
}

export default function PlaceModeTerrainTool() {
  const t = useTranslator()
  const libTerrainElement = useRecoilValue(libraryTerrainElementState)
  const exit = useExitPlaceMode()

  useObjectLifecycle(libTerrainElement?.previewMesh)

  const onPlaceTerrain = useCallback(async () => {
    if (!libTerrainElement) return
    const terrain = elementState.currentTerrainSignal.peek()
    if (!terrain) return
    return onPlaceTerrainInElementState(terrain, libTerrainElement.element, libTerrainElement.terrainData)
  }, [libTerrainElement])

  if (!libTerrainElement) return null

  return (
    <SubMode mode={"add"}>
      <div className={styles.BorderHeader}>
        <span>{t(($) => $.placeMode.updateTerrainDescription)}</span>
        <weave-button
          className={styles.CancelButton}
          onClick={() => {
            exit()
          }}
          variant={"flat"}
        >
          {t(($) => $.ui.cancel)}
        </weave-button>
        <weave-button
          className={styles.WhiteButton}
          onClick={() => {
            void onPlaceTerrain().then(() => exit())
          }}
          variant={"white"}
        >
          {t(($) => $.placeMode.updateTerrainAction)}
        </weave-button>
      </div>
    </SubMode>
  )
}
