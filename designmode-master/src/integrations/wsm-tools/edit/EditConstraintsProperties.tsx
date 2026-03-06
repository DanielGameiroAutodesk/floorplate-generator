import * as formaUnits from "@spacemakerai/forma-units"
import { FEET_TO_METER } from "@spacemakerai/forma-units"
import { wsmModelChangedPayload } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import { useRecoilState } from "recoil"
import { getParentPath } from "src/lib/element/path"
import { ExtrusionPropertiesStats } from "src/lib/components/RightMenu/ExtrusionProperties/ExtrustionPropertiesStats"
import { useCallback, useRef } from "preact/hooks"
import { Box3, Matrix4 } from "three"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { applyTransform } from "src/lib/three/geometryUtils"
import { elementState } from "src/core/elements/ElementState"
import { getBoundingBox3For3DSElement, isParent3DSElement } from "src/integrations/wsm-tools/wsm-integration/wsm-utils"
import { isDefined } from "src/lib/array"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { selectedNodesSignal } from "src/core/selection/selectionState"

const calculateWSMElevationAndHeight = (groupInstancePath: WSM.GroupInstancePathInterface) => {
  // values will be converted to current units and shown in the right panel fields
  const calculatedResult = {
    elevation: 0,
    height: 0,
  }

  // get the constraint bounding box and its upper and lower bounds
  const constraintBBox = WSM.APIGetBoxReadOnly(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object)
  const bBoxUpperZ = constraintBBox.upper.z
  const bBoxLowerZ = constraintBBox.lower.z
  // constraint elevation is the lowest Z-value of bbox
  calculatedResult.elevation = bBoxLowerZ * FEET_TO_METER
  // constraint height is the difference between
  // upper and lower bbox Z-bounds, which should be positive
  const bBoxZDiff = bBoxUpperZ - bBoxLowerZ
  if (bBoxZDiff > 0) {
    calculatedResult.height = (bBoxUpperZ - bBoxLowerZ) * FEET_TO_METER
  } else {
    // handle negative result case (unexpected)
    calculatedResult.height = 0
    console.error("Constraint bounding box height was unexpectedly negative.")
  }

  return calculatedResult
}

type Props = {
  groupInstancePath: WSM.GroupInstancePathInterface // WSM path
}

export const EditConstraintsProperties = ({ groupInstancePath }: Props) => {
  // only used for triggering a re-render when the model changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [wsmModelChanged, setWSMModelChanged] = useRecoilState(wsmModelChangedPayload)

  const { elevation, height } = calculateWSMElevationAndHeight(groupInstancePath)

  const handleElevationChange = useCallback(
    (newElevation: number) => {
      const newTransform = WSM.Geom.MakeRigidTransform(
        WSM.Geom.Point3d(
          0,
          0,
          parseFloat(formaUnits.formatMetricLengthAs(newElevation - elevation, formaUnits.UnitType.ImperialFeetInches)),
        ),
        WSM.Geom.Vector3d(1, 0, 0),
        WSM.Geom.Vector3d(0, 1, 0),
        WSM.Geom.Vector3d(0, 0, 1),
      )

      WSM.APITransformObject(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object, newTransform)
    },
    [groupInstancePath, elevation],
  )

  return (
    <ExtrusionPropertiesStats
      elevation={elevation}
      height={height}
      canEditProposal={canEditProposalSignal.value}
      onElevationSubmit={handleElevationChange}
    />
  )
}

export const HandleWSMProperties = () => {
  const selectedWSMPathUrns = selectedNodesSignal.value
    .map((node) => {
      const element = node.elementContainer?.element
      return element.properties?.spacemakerObjectStorageReferenceFormats?.[0] === "axm" ||
        (element?.properties?.category === "floor" && isParent3DSElement(elementState.currentSnapshot.value, node.path))
        ? { path: node.path, urn: node.urn }
        : undefined
    })
    .filter(isDefined)
  const ActionAPI = useActionAPI()
  const elevation = useRef(0)
  const height = useRef(0)

  const handleElevationChange = useCallback(
    (newElevation: number) => {
      selectedWSMPathUrns.forEach((pu) => {
        if (!pu.urn) return
        const parentPath = getParentPath(pu.path)!
        const parentNode = elementState.currentSnapshot.peek().getNode(parentPath)
        const parentTransform = parentNode?.globalMatrix
        if (!parentTransform) return
        const curElement = parentNode?.elementContainer.element
        const curNode = elementState.currentSnapshot.peek().getNode(pu.path)
        const curChild = curNode?.child
        if (!curChild) return
        const curTransform = curChild.transform ? new Matrix4().fromArray(curChild.transform) : new Matrix4().identity()
        const newTransform = applyTransform(
          parentTransform,
          curTransform,
          new Matrix4().makeTranslation(0, 0, newElevation - elevation.current),
        )
        const action = ActionAPI.update.one(pu.path, { ...curElement, urn: pu.urn }, false, {
          child: {
            ...curChild,
            transform: newTransform.toArray(), // this transform is between the element and its parent
          },
          cloneGeometry: true,
        })
        ActionAPI.apply("Update element with WSR", action)
      })
    },
    [selectedWSMPathUrns, ActionAPI],
  )

  // Don't render if no wsm elements selected or mixed wsm/non-wsm selection
  if (
    !selectedWSMPathUrns[0] ||
    !selectedWSMPathUrns[0].urn ||
    selectedNodesSignal.value.length != selectedWSMPathUrns.length
  )
    return null

  const bbox = getBoundingBox3For3DSElement(elementState.currentSnapshot.value, selectedWSMPathUrns?.[0]?.path)?.clone()

  const elementNode = elementState.currentSnapshot.value.getNode(selectedWSMPathUrns?.[0]?.path)

  // Apply world transform to get correct elevation
  if (selectedWSMPathUrns?.[0]?.path && bbox && bbox instanceof Box3) {
    const elementTransform = elementNode?.globalMatrix
    if (elementTransform) bbox.applyMatrix4(elementTransform)
  }
  const isFloor = elementNode?.elementContainer?.element?.properties?.category == "floor"

  // Return blank if no bounding box
  if (!bbox) return null
  else {
    const bBoxUpperZ = (bbox as Box3).max.z
    const bBoxLowerZ = (bbox as Box3).min.z
    // constraint elevation is the lowest Z-value of bbox
    elevation.current = bBoxLowerZ
    // constraint height is the difference between
    // upper and lower bbox Z-bounds, which should be positive
    const bBoxZDiff = bBoxUpperZ - bBoxLowerZ
    if (bBoxZDiff > 0) {
      height.current = bBoxUpperZ - bBoxLowerZ
    } else {
      // handle negative result case (unexpected)
      height.current = 0
      console.error("Constraint bounding box height was unexpectedly negative.")
    }
  }

  // Return "mixed" for stat values if multiple wsm elements are selected
  if (selectedWSMPathUrns.length > 1) return <ExtrusionPropertiesStats canEditProposal={canEditProposalSignal.value} />

  return (
    <ExtrusionPropertiesStats
      elevation={elevation.current}
      height={height.current}
      canEditProposal={canEditProposalSignal.value}
      onElevationSubmit={isFloor ? undefined : handleElevationChange}
    />
  )
}
