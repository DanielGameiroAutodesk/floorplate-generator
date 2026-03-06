import { selectionSetSignal } from "src/core/selection/selectionState"
import {
  useCalculatePolygons,
  useTransformPolygonsPreview,
} from "src/integrations/tools-common/shapeTransformTools/polygonTransformFunctions"
import type { Geom, MultiPolygon } from "polygon-clipping"
import { useCallback } from "preact/compat"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"

import { partialTrackingDataForSelectionSignal } from "src/core/selection/analytics-utils"

export default function useBooleanOperation(
  booleanOperation: (geom: Geom, ...geoms: Geom[]) => MultiPolygon,
  deleteOperands: boolean,
  description: string,
) {
  const actionApi = useActionAPI()
  const operation = useCalculatePolygons(booleanOperation, deleteOperands)

  const execute = useCallback(() => {
    if (selectionSetSignal.peek().size <= 1) return
    const { actions, addedKeys } = operation()
    actionApi.apply(
      description,
      actions,
      {
        ...partialTrackingDataForSelectionSignal.peek(),
        tool: description,
        eventType: "replace",
      },
      addedKeys || new Set(),
    )
  }, [operation, description, actionApi])

  const setShowPreview = useTransformPolygonsPreview(operation)

  return { setShowPreview, execute }
}
