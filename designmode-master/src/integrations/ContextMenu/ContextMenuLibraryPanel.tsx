import { PROJECT_ID } from "src/core/project/project"
import { selectedTopLevelNodesSignal } from "src/core/selection/selectionState"
import { request } from "src/lib/request"
import { AnalyticsLegacy } from "src/core/analytics"

import { useAddBasicBuildingFloorPlansToLibrary } from "src/integrations/building-systems-basic-building/basicBuildingFloorPlans"
import { getTranslator, useTranslator } from "src/i18n"

export const ContextMenuLibraryPanel = () => {
  const t = useTranslator()
  const selected = selectedTopLevelNodesSignal.value
  const enabled =
    selected.length === 1 &&
    !selected[0].urn.includes(":building-design:") &&
    !selected[0].urn.includes(":detailedbuilding:")
  const handleAddToLibrary = async () => {
    const { element } = selected[0].elementContainer
    const { urn } = element
    const name = element.properties?.name

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
          content: t(($) => $.library.addedToLibrary, { name: name || "element" }),
          status: "success",
        })
      })
    } catch (err) {
      console.log("error adding to library", err)
    } finally {
      window.dispatchEvent(new CustomEvent("sm-library/refresh"))
    }
  }
  const addFloorPlanToLibrary = useAddBasicBuildingFloorPlansToLibrary()

  if (!selected.length && !addFloorPlanToLibrary.show) return null
  return (
    <>
      {!!selected.length && (
        <forma-context-menu-item
          text={t(($) => $.library.addToLibraryButton)}
          onClick={() => void handleAddToLibrary()}
          disabled={!enabled}
        />
      )}
      {addFloorPlanToLibrary.show && (
        <forma-context-menu-item
          text={addFloorPlanToLibrary.text}
          onClick={addFloorPlanToLibrary.onClick}
          disabled={addFloorPlanToLibrary.disabled}
        />
      )}
      <forma-context-menu-divider />
    </>
  )
}
