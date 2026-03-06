import { useRecoilValue } from "recoil"
import { useMemo } from "preact/compat"
import styles from "./NameProperty.module.pcss"
import { selectedNodesSignal } from "src/core/selection/selectionState"
import {
  is3dSketchElementSelectedSignal,
  isImportElement,
  isSingle3dSketchBuildingSelectedSignal,
} from "src/integrations/3dsketch/3dsketch-selection-state"
import { isGeneratedElement } from "src/integrations/extensions-generators/elements"
import { isDefined } from "src/lib/array"
import { getMappedCategory } from "src/core/categories"
import type { FormaElement } from "@spacemakerai/element-types"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { useTranslator, type Translator } from "src/i18n"
import { ANNOTATION_LABEL_CATEGORY } from "src/integrations/labels/constants"
import BetaTag from "src/lib/components/BetaTag/BetaTag"
import { isCurrentI3DSPathBuilding } from "src/integrations/wsm-tools/building/buildingFloorUtils"
import { wsmLevelChangedPayload } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import { isConstraintElement } from "src/integrations/tools-common/Selection/editElement"
import { toolAPI } from "src/core/toolsState"

function getHeaderForElement(element: FormaElement, t: Translator, path?: string) {
  if (element.properties?.category === "floor") {
    if (element.properties?.floorIndex !== undefined) {
      return `Floor ${element.properties.floorIndex + 1}`
    }

    if (path) {
      const pathSegments = path.split("/")
      const floorIndex = parseInt(pathSegments[pathSegments.length - 1])
      if (!isNaN(floorIndex)) {
        return `Floor ${floorIndex + 1}`
      }
    }

    return "floor"
  }
  if (element.properties?.category === ANNOTATION_LABEL_CATEGORY) return t(($) => $.labels.label)
  return getMappedCategory(element)
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.4073 6.97458C14.628 5.46986 14.3978 3.26048 12.8931 2.03977C11.3883 0.819072 9.17895 1.04931 7.95825 2.55403L6.15247 4.77995C5.9785 4.9944 6.01131 5.30927 6.22576 5.48325C6.44021 5.65722 6.75509 5.62441 6.92906 5.40996L8.73484 3.18404C9.6076 2.10822 11.1872 1.9436 12.263 2.81636C13.3389 3.68912 13.5035 5.26875 12.6307 6.34457L10.8249 8.57049C10.651 8.78494 10.6838 9.09982 10.8982 9.27379C11.1127 9.44776 11.4276 9.41495 11.6015 9.2005L13.4073 6.97458ZM2.61003 9.00546C1.37757 10.5006 1.59048 12.7117 3.08558 13.9441C4.58068 15.1766 6.79181 14.9637 8.02427 13.4686L9.84744 11.2569C10.0231 11.0438 9.99274 10.7287 9.77966 10.553C9.56658 10.3774 9.25146 10.4077 9.07581 10.6208L7.25264 12.8325C6.37147 13.9015 4.7906 14.0537 3.72166 13.1725C2.65271 12.2914 2.50049 10.7105 3.38165 9.64153L5.20482 7.42984C5.38047 7.21676 5.35013 6.90163 5.13705 6.72599C4.92397 6.55034 4.60884 6.58068 4.4332 6.79376L2.61003 9.00546ZM5.14719 10.4764C4.96804 10.6865 4.99317 11.0021 5.20331 11.1812C5.41345 11.3604 5.72904 11.3353 5.90819 11.1251L10.9405 5.22217C11.1197 5.01202 11.0945 4.69644 10.8844 4.51729C10.6742 4.33814 10.3587 4.36327 10.1795 4.57341L5.14719 10.4764Z"
        fill="#3C3C3C"
      />
    </svg>
  )
}

export default function CategoryHeaderName() {
  const wsmLevelsChanged = useRecoilValue(wsmLevelChangedPayload)
  const selectedNodes = selectedNodesSignal.value
  const currentToolId = toolAPI.currentToolSignal.value.id

  const singleSelectedElement = selectedNodes.length === 1 ? selectedNodes[0].elementContainer.element : undefined

  const isSingleSelected3dSketchBuilding = isSingle3dSketchBuildingSelectedSignal.value
  const isSingleSelected3dSketchElement = is3dSketchElementSelectedSignal.value
  const isSingleSelectedBasicBuilding =
    singleSelectedElement && BasicBuildingAPI.isBasicBuildingUrn(singleSelectedElement.urn)
  const isSingleSelectedGeneratedElement = singleSelectedElement && isGeneratedElement(singleSelectedElement)
  const isSingleSelectedExternalElement =
    singleSelectedElement &&
    isDefined(singleSelectedElement.properties?.elementProvider) &&
    !isImportElement(singleSelectedElement)
  const allDetailedBuildings = selectedNodes.every(
    (n) => n.urn.includes(":detailedbuilding:") || n.urn.includes(":building-design:"),
  )

  const t = useTranslator()

  const header = useMemo(() => {
    const categories = new Set(
      selectedNodes.map((node) => getHeaderForElement(node.elementContainer.element, t, node.path)),
    )
    const allFloors = selectedNodes.every((node) => node.elementContainer.element.properties?.category === "floor")
    if (allFloors && categories.size > 1) {
      return "floors"
    }
    if (categories.size > 1) return "mixed"

    let displayerCategory: string = Array.from(categories)[0] || "unspecified"
    // Additional category check for 3D Sketch
    if (currentToolId == "WSRAPITool") {
      if (isCurrentI3DSPathBuilding()) {
        displayerCategory = "Building"
      } else if (isConstraintElement(selectedNodes[0]?.elementContainer.element)) {
        displayerCategory = "Constraint"
      } else {
        displayerCategory = "Generic"
      }
    }
    return displayerCategory.replace("_", " ")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodes, currentToolId, wsmLevelsChanged, t])

  const connected = useMemo(() => {
    return selectedNodes.every((node) => node.elementContainer.element.properties?.connected)
  }, [selectedNodes])

  let type: null | string = null
  if (isSingleSelected3dSketchElement || currentToolId == "WSRAPITool") type = "3D SKETCH"
  else if (isSingleSelectedGeneratedElement) type = "AUTOMATION"
  else if (isSingleSelectedBasicBuilding) type = "BASIC"
  else if (isSingleSelectedExternalElement) type = "EXTERNAL SOURCE"
  else if (allDetailedBuildings) type = "DETAILED"

  return (
    <>
      <span className={styles.CategoryName} id={"category-header"}>
        {header}
      </span>

      {selectedNodes.length > 1 && !isSingleSelected3dSketchBuilding && (
        <span className={styles.SelectionCount}>{selectedNodes.length}</span>
      )}
      {connected && currentToolId != "WSRAPITool" && (
        <span>
          <LinkIcon />
        </span>
      )}
      {type && <span className={styles.SelectionCount}>{type}</span>}

      {type === "DETAILED" && (
        <div style="padding-left: 8px">
          <BetaTag />
        </div>
      )}
    </>
  )
}
