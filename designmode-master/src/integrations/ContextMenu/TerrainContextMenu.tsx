import { PROJECT_ID } from "src/core/project/project"
import { request } from "src/lib/request"
import { Analytics, AnalyticsLegacy } from "src/core/analytics"
import { ContextMenuUndoRedo } from "./ContextMenuUndoRedo"
import { elementState } from "src/core/elements/ElementState"
import {
  exportTerrain,
  isTerrainExportable,
} from "src/integrations/terrainPadsExperimental/terrainExport/terrainExport"
import { IfEditAccess } from "src/integrations/EditGuard/IfEditAccess"
import { useCallback } from "preact/hooks"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { getTranslator, useTranslator } from "src/i18n"

function AddToLibraryPanel() {
  const element = elementState.currentTerrainSignal.value?.element
  const handleAddToLibrary = async () => {
    if (!element) return
    const urn = element.urn
    const name = "Custom terrain" // let users set this while adding?
    try {
      await request(`/api/forma-library/?authcontext=${PROJECT_ID}`, {
        method: "POST",
        body: JSON.stringify({ urn, name }),
      }).then(() => {
        const trackingdata = {
          numElements: 1,
          elementCategory: element.properties?.category || "",
          tool: "addToLibrary",
        }
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Add element to library", trackingdata)
        const t = getTranslator()
        window.forma_toasts.push({
          content: t(($) => $.library.addedToLibrary, { name }),
          status: "success",
        })
      })
    } catch (err) {
      console.log("error adding to library", err)
    } finally {
      window.dispatchEvent(new CustomEvent("sm-library/refresh"))
    }
  }

  const t = useTranslator()

  return (
    <>
      <forma-context-menu-item
        text={t(($) => $.library.addToLibraryButton)}
        onClick={() => void handleAddToLibrary()}
      />
      <forma-context-menu-divider />
    </>
  )
}

export default function TerrainContextMenu() {
  const t = useTranslator()
  const isTerrainPadsActive = true
  const onClickExportTerrain = useCallback(async () => {
    await exportTerrain("OBJ")
    Analytics.track(EventName.Export, {
      feature_category: FeatureCategory.DesignTool,
      feature: "terrain",
      sub_feature: "terrain_pad",
    })
  }, [])
  return (
    <forma-context-menu>
      {isTerrainExportable() && isTerrainPadsActive && (
        <IfEditAccess>
          <forma-context-menu-item
            text={t(($) => $.contextMenu.exportTerrainAsObj)}
            onClick={() => void onClickExportTerrain()}
          />
        </IfEditAccess>
      )}
      <AddToLibraryPanel />

      {/* add context menu here just for consistency, we always show this in the regular context menu */}
      <ContextMenuUndoRedo />
    </forma-context-menu>
  )
}
