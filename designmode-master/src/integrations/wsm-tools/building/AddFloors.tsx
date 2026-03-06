import { AddButton } from "src/lib/components/icons/AddButton"
import { captureException } from "@sentry/browser"
import { useCallback } from "react"
import { useErrorBoundary } from "preact/hooks"
import { addLevelsToInstance, canAddLevelsToInstance } from "./buildingFloorUtils"
import { wsmChangedSelector, wsmDefaultFloorHeightInFeet } from "src/integrations/wsm-tools/wsr/integrated/state"
import { useRecoilValue } from "recoil"
import { getFirstObjectAndHistoryIdFromGIP } from "src/integrations/wsm-tools/wsr/integrated/utils"
import { Analytics } from "src/core/analytics"
import { save3dSketch } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"
import { useTranslator } from "src/i18n"

import { RightMenuPanel } from "src/lib/components/RightMenu/RightMenuPanel"
import { useIsImperial } from "src/lib/unitSettings"

function AddFloorsInner() {
  const t = useTranslator()
  const isImperial = useIsImperial()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isChanged = useRecoilValue(wsmChangedSelector)
  const groupInstancePath = FormIt.GroupEdit.GetInContextEditingPath()
  const defaultFloorHeightInFeet = wsmDefaultFloorHeightInFeet(isImperial)

  const { historyId, objectId: instanceId } = getFirstObjectAndHistoryIdFromGIP(groupInstancePath)
  const canAddLevelsToWSMObject = canAddLevelsToInstance(historyId, instanceId, defaultFloorHeightInFeet)

  const convert = useCallback(() => {
    if (canAddLevelsToWSMObject) {
      addLevelsToInstance(historyId, instanceId, defaultFloorHeightInFeet)
      Analytics.trackSelectTool("3dSketch", "Add Floors", "right_panel", "design-tool")

      // Save 3DS so that the user can edit floor plan immediately if they so choose
      save3dSketch()
    }
  }, [canAddLevelsToWSMObject, defaultFloorHeightInFeet, historyId, instanceId])

  if (!canAddLevelsToWSMObject) return null

  return (
    <>
      <hr style={{ border: "none", height: "1px", backgroundColor: "var(--border-color-divider-light)" }} />
      <RightMenuPanel id="AddFloors">
        <span style={{ font: "var(--12-medium)" }}>{t(($) => $.wsm.floors.addFloors)}</span>
        <AddButton onClick={convert} />
      </RightMenuPanel>
    </>
  )
}

export default function AddFloors3dSketch() {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("AddFloors error: ", error)
    console.warn(errorInfo)
    captureException(error, {
      tags: { owner: "conceptual", errorPoint: "Add floors", "integration-type": "integrated" },
    })
  })
  if (error) return null
  return <AddFloorsInner />
}
