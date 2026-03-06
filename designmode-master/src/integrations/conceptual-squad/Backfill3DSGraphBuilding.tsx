import { scenarioModeSignal, selectedPathsInCurrentProposalSignal } from "src/core/selection/selectionState"
import { conceptualElementsApi } from "./conceptualElementsApi"
import { usePrepareWSRSaveActions } from "src/integrations/wsm-tools/wsr/api/usePrepareWSRSaveActions"
import { useCallback, useEffect, useState } from "preact/hooks"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { elementState } from "src/core/elements/ElementState"
import { setWSMGeoBottomToZero } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import { syncPath } from "src/integrations/element-state-side-effects-adapter/syncPath"
import {
  wsmSideEffectAdapter,
  type WSMDetailsForElementPath,
} from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import {
  lookupWSMObject,
  wsmTopInstanceToGeometryData,
  wsmObjectToAXMStringForSave,
} from "src/integrations/wsm-tools/wsr/api/mapping"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import Spinner from "src/lib/components/icons/Spinner"
import { useTranslator } from "src/i18n"

export function Backfill3DSGraphBuildings() {
  const buildRepsAndSaveElement = usePrepareWSRSaveActions(scenarioModeSignal.value ? "base" : "proposal")

  const [nodeToBackfill, setNodeToBackfill] = useState<ChildNodeContainer | null>(null)

  const selectedBuildingPath =
    selectedPathsInCurrentProposalSignal.value.size === 1 ? [...selectedPathsInCurrentProposalSignal.value][0] : null

  const backfill3DSGraphBuilding = useCallback(
    async (node: ChildNodeContainer) => {
      setNodeToBackfill(node)

      const isWSMLoaded = formitInitializedSignal.peek()
      if (!isWSMLoaded) {
        await new Promise<void>((resolve) =>
          setInterval(() => {
            if (formitInitializedSignal.peek()) {
              resolve()
            }
          }, 500),
        )
      }

      const proposal = elementState.currentProposalSignal.peek()
      await new Promise<void>((resolve) => syncPath(wsmSideEffectAdapter, node.path, proposal, resolve))

      const wsmDetailsForElementPath: WSMDetailsForElementPath | undefined = lookupWSMObject(node.path)
      const groupInstancePath = wsmDetailsForElementPath?.groupInstancePath
      if (!groupInstancePath || groupInstancePath.ids.length !== 1) {
        console.error("failed to backfill graphBuilding for 3DS building: ", node.element)
        return
      }

      setWSMGeoBottomToZero(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object)
      const geoData = wsmTopInstanceToGeometryData(groupInstancePath)
      geoData.axmRepresentation = wsmObjectToAXMStringForSave(groupInstancePath)

      buildRepsAndSaveElement(geoData, groupInstancePath, node.path)

      setTimeout(() => {
        setNodeToBackfill(null)
      }, 2000)
    },
    [setNodeToBackfill, buildRepsAndSaveElement],
  )

  useEffect(() => {
    // don't backfill in historical proposals
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.has("revision")) {
      return
    }

    if (!selectedBuildingPath) {
      return
    }

    const selectedBuildingNode = elementState.currentSnapshot.peek().getNode(selectedBuildingPath)
    if (!selectedBuildingNode) {
      return
    }

    // if not persisted then means just edited it so no backfill required
    if (!selectedBuildingNode.elementContainer.isServerState) {
      return
    }

    if (
      conceptualElementsApi.is3dSketchBuilding(selectedBuildingNode.element) &&
      conceptualElementsApi.does3DSBuildingRequireGraphBuildingBackfill(selectedBuildingNode.elementContainer)
    ) {
      void backfill3DSGraphBuilding(selectedBuildingNode)
    }
  }, [selectedBuildingPath, backfill3DSGraphBuilding])

  const t = useTranslator()

  if (!nodeToBackfill) {
    return null
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "all",
        zIndex: 9999999,
        backgroundColor: `rgba(0, 0, 0, 0.3)`,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "fit-content",
          margin: "auto",
          top: "40%",
          padding: "8px 15px 8px 10px",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          borderRadius: "5px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            padding: "4px 8px 0px 2px",
          }}
        >
          <Spinner />
        </div>
        <h3>{t(($) => $.building.upgradingFor3DSketchBuilding)}</h3>
      </div>
    </div>
  )
}
