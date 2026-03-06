import { useCallback, useMemo } from "preact/hooks"
import type { Vec3 } from "src/lib/geometry/geometryTypes"
import { Matrix4, Vector3 } from "three"

import type { Action } from "src/core/legacy-actions"
import { ANNOTATION_LABEL_CATEGORY } from "src/integrations/labels/constants"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { drawApi } from "src/integrations/draw/DrawAPI"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import { LabelToolbarActive } from "src/integrations/labels/LabelTool/LabelToolbar"
import { DesignModeEvents } from "src/core/events/events"
import { setContextMenuPositionSignalValue } from "src/core/context-menu-state"
import { exitCurrentTool } from "src/core/toolsState"
import { selectedNodesSignal } from "src/core/selection/selectionState"
import { HiddenPaths } from "src/core/hidden"

const reusableMatrix = new Matrix4()
const reusablePoint = new Vector3()

export default function useMoveLabels() {
  const ActionAPI = useActionAPI()
  const selectedNodes = selectedNodesSignal.value

  const toggleHide = useCallback(
    (hide: boolean) => {
      for (const node of selectedNodes) {
        const element = node.element
        if (element.properties?.category !== ANNOTATION_LABEL_CATEGORY) return

        HiddenPaths.setPathHidden(node.path, hide)
      }
    },
    [selectedNodes],
  )

  const currentTranslation = useMemo(() => {
    if (selectedNodes.length !== 1) return undefined
    const transform = selectedNodes[0]?.globalMatrix
    if (!transform) return undefined
    return new Vector3().applyMatrix4(transform)
  }, [selectedNodes])

  const Preview = useMemo(() => {
    return function Preview({ point }: { point: { x: number; y: number; z: number } }) {
      reusablePoint.set(point.x, point.y, point.z)
      const diff = currentTranslation ? reusablePoint.sub(currentTranslation) : reusablePoint
      DesignModeEvents.dispatch("tool.affine.preview", reusableMatrix.makeTranslation(diff.x, diff.y, diff.z).toArray())
      return <Handle position={new Vector3(point.x, point.y, point.z)} />
    }
  }, [currentTranslation])

  const onCancelMove = useCallback(() => {
    DesignModeEvents.dispatch("tool.affine.preview", reusableMatrix.identity().toArray())
    setContextMenuPositionSignalValue(undefined)
    exitCurrentTool()
    toggleHide(false)
  }, [toggleHide])

  const onCompleteMove = useCallback(
    (point?: Vec3) => {
      if (!point) {
        onCancelMove()
        return
      }
      const transform = new Matrix4().makeTranslation(point.x, point.y, point.z).toArray()
      const actions = selectedNodes.flatMap<Action>((node) => {
        if (!node || node.element.properties?.category !== ANNOTATION_LABEL_CATEGORY) return []
        return [
          {
            type: "update",
            path: node.path,
            element: node.element,
            persisted: node.elementContainer.isServerState,
            child: { transform },
            cloneGeometry: true,
          },
        ]
      })
      ActionAPI.apply("Update label position", actions)
      exitCurrentTool()
      setContextMenuPositionSignalValue(undefined)
      toggleHide(false)
    },
    [ActionAPI, selectedNodes, onCancelMove, toggleHide],
  )

  return useCallback(() => {
    toggleHide(true)
    return drawApi.getPoint(onCompleteMove, LabelToolbarActive, Preview)
  }, [Preview, onCompleteMove, toggleHide])
}
