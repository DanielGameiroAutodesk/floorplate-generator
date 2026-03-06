import styles from "./PropertiesHeader.module.pcss"
import { ConvertToSiteLimitButton } from "./ConvertToSiteLimitButton"
import CategoryHeaderName from "./CategoryHeaderName"
import { useEffect, useMemo, useState } from "preact/hooks"
import { selectedBasePathsInProposalContextSignal, selectedNodesSignal } from "src/core/selection/selectionState"
import { parseUrn } from "src/lib/element/urn"
import ConvertBuildingTo3DSketchButton from "./ConvertBuildingTo3DSketchButton"
import ConvertExternalTo3DSketchButton from "./ConvertExternalTo3DSketchButton"
import { getMappedCategory } from "src/core/categories"
import { isConvertibleImportElementSelectedSignal } from "src/integrations/3dsketch/3dsketch-selection-state"
import {
  useIntegrated3DSketchAPI,
  wsmLevelChangedPayload,
  wsmNeedsSaveSignal,
} from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { toolAPI } from "src/core/toolsState"
import Save3DSketchButton from "./Save3DSketchButton"
import { createPortal } from "preact/compat"
import { useRecoilValue } from "recoil"
import { isCurrentI3DSPathBuilding } from "src/integrations/wsm-tools/building/buildingFloorUtils"

function elementSystemHasProps(elementSystem: string) {
  return elementSystem !== "parametric"
}

export const PropertiesHeader = () => {
  const selectedNodes = selectedNodesSignal.value
  const singleSelectedElement = selectedNodes.length === 1 ? selectedNodes[0].elementContainer.element : undefined
  const isOneBuildingSelected = singleSelectedElement && BasicBuildingAPI.isBasicBuildingUrn(singleSelectedElement.urn)
  const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.value
  const isConvertibleImportElementSelected = isConvertibleImportElementSelectedSignal.value
  const i3dsAPI = useIntegrated3DSketchAPI()

  const [save3DSketchButtonPortalTarget, setSave3DSketchButtonPortalTarget] = useState<Element | null>(null)
  const wsmLevelsChanged = useRecoilValue(wsmLevelChangedPayload)

  // show a refresh button in the Area Metrics header for 3D Sketch
  // this button saves the 3D Sketch element to update the right panel content
  // so we'll insert a button into a portal target defined in area-metrics-wc
  useEffect(() => {
    // skip if 3D Sketch is not running
    if (!i3dsAPI.inI3DSMode) {
      return
    }

    // find the save button target if editing a 3d building
    // (this target is created in the area-metrics-wc repo using the same ID)
    // the target must be "refound" if the area metrics component hides/shows
    if (isCurrentI3DSPathBuilding()) {
      // keep trying to find the element every 200ms
      const interval = setInterval(() => {
        // look for the forma-key-figures component
        const keyFiguresComponentElements = document.getElementsByTagName("forma-key-figures")
        if (keyFiguresComponentElements.length > 0) {
          // find the portal target inside the
          // forma-key-figures component shadow root
          const portalTarget = keyFiguresComponentElements[0].shadowRoot?.getElementById(
            "3d-sketch-save-button-portal-target",
          )
          // if found, set the target and clear the interval
          if (portalTarget) {
            setSave3DSketchButtonPortalTarget(portalTarget)
            clearInterval(interval)
          }
        }
      }, 200)

      return () => {
        // ensure the interval is cleared
        clearInterval(interval)
      }
    }
  }, [i3dsAPI.inI3DSMode, wsmLevelsChanged])

  // ensure the portal target is null
  // since the element will no longer be valid
  // once 3D Sketch is exited and re-entered
  useEffect(() => {
    if (!i3dsAPI.inI3DSMode && save3DSketchButtonPortalTarget) {
      setSave3DSketchButtonPortalTarget(null)
    }
  }, [i3dsAPI.inI3DSMode, save3DSketchButtonPortalTarget])

  const selectedElementsWithProps = useMemo(() => {
    return Array.from(selectedNodes).filter((node) =>
      elementSystemHasProps(parseUrn(node.elementContainer.element.urn).system),
    )
  }, [selectedNodes])

  if (selectedElementsWithProps.length === 0 && toolAPI.currentToolSignal.value.id != "WSRAPITool") return null

  if (selectedElementsWithProps.length === 1) {
    const element = selectedElementsWithProps[0].elementContainer.element
    if (element && getMappedCategory(element) === "vegetation") {
      return null
    }
  }

  return (
    <div className={styles.HeaderPanel}>
      <CategoryHeaderName />
      {isOneBuildingSelected && selectedBasePathsInProposalContext.size === 0 && !i3dsAPI.inI3DSMode && (
        <ConvertBuildingTo3DSketchButton />
      )}
      {!i3dsAPI.inI3DSMode && isConvertibleImportElementSelected && <ConvertExternalTo3DSketchButton />}
      {save3DSketchButtonPortalTarget &&
        createPortal(<>{wsmNeedsSaveSignal.value && <Save3DSketchButton />}</>, save3DSketchButtonPortalTarget)}
      <ConvertToSiteLimitButton />
    </div>
  )
}
