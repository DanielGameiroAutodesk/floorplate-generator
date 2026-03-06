import { useCallback, useLayoutEffect, useMemo } from "preact/hooks"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { replaceRevision } from "src/lib/element/urn"
import { ANNOTATION_LABEL_CATEGORY, ANNOTATION_LABEL_PROPERTY_NAME } from "src/integrations/labels/constants"
import { getCurrentUserId } from "src/lib/userInfo"
import LabelWrapper from "src/integrations/labels/Label/LabelWrapper"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool } from "src/core/toolsState"
import { selectedNodesSignal } from "src/core/selection/selectionState"
import { HiddenPaths } from "src/core/hidden"

export const EditLabelToolCfg: ToolCfg = {
  id: "edit-label",
  tool: EditLabelTool,
  toolbar: "topLevel",
  propertyPanel: "default",
}

function EditLabelTool() {
  const ActionAPI = useActionAPI()
  const selectedNodes = selectedNodesSignal.value

  const editNode = useMemo(() => {
    const firstNode = selectedNodes[0]
    if (!firstNode) return
    const el = firstNode.element
    if (el.properties?.category !== ANNOTATION_LABEL_CATEGORY) return
    return firstNode
  }, [selectedNodes])

  useLayoutEffect(() => {
    if (!editNode) return
    HiddenPaths.setPathHidden(editNode.path, true)
    return () => {
      HiddenPaths.setPathHidden(editNode.path, false)
    }
  }, [editNode])

  const persistNote = useCallback(
    (text: string) => {
      if (!text.length) return
      if (!editNode) return

      const action = ActionAPI.update.one(
        editNode.path,
        {
          urn: replaceRevision(editNode.urn),
          properties: {
            ...editNode.element.properties,
            [ANNOTATION_LABEL_PROPERTY_NAME]: {
              ...(editNode.element.properties?.[ANNOTATION_LABEL_PROPERTY_NAME] || {}),
              editedAt: Date.now(),
              author: getCurrentUserId(),
              text,
            },
          },
        },
        false,
        {
          cloneGeometry: true,
        },
      )
      ActionAPI.apply("Label: update text", action)
      exitCurrentTool()
    },
    [ActionAPI, editNode],
  )

  if (!editNode) return null

  return <LabelWrapper path={editNode.path} onComplete={persistNote} worldTransform={editNode.globalMatrix} />
}
