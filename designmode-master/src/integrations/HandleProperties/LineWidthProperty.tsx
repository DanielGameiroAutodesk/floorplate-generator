import { labelClassName } from "src/lib/components/RightMenu/RightMenuLabel"
import { useCallback } from "preact/compat"
import { currentLineWidth } from "./lineWidth"
import type { BasicFeaturePathInfo } from "src/core/selection/selected-basic-features"
import LengthInput from "src/integrations/inputs/LengthInput"
import { useMemo } from "react"
import { useTranslator } from "src/i18n"

import { partialTrackingDataForSelectionSignal } from "src/core/selection/analytics-utils"

import { categoryToDefaultLineWidth } from "src/lib/three/Shape/shapeUtils"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { BasicAction } from "src/integrations/basic-elements/api/types"
import type { InternalPath } from "src/lib/element/path"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import { RightMenuGridPanel } from "src/lib/components/RightMenu/RightMenuGridPanel"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { useIsImperial } from "src/lib/unitSettings"

export function useUpdateLineWidth(selected: { path: InternalPath; geojson: BasicFeature }[]) {
  const actionAPI = useActionAPI()
  const partialTrackingData = partialTrackingDataForSelectionSignal.value

  return useCallback(
    (newValue: number) => {
      const updates = selected.map(({ path, geojson }): BasicAction => {
        return BasicElementAPI.updateFeature(path, {
          ...geojson,
          properties: {
            ...geojson.properties,
            lineWidth: newValue,
          },
        })
      })

      actionAPI.apply("Element - Set line width", BasicElementAPI.basicActionsToCoreActions(updates), {
        ...partialTrackingData,
        eventType: "update",
        tool: "lineWidthProperties",
      })
    },
    [actionAPI, partialTrackingData, selected],
  )
}

export const LineWidthProperty = ({ selected }: { selected: BasicFeaturePathInfo[] }) => {
  const t = useTranslator()
  const isImperial = useIsImperial()
  const metricMin = useMemo(() => categoryToDefaultLineWidth(isImperial, "default"), [isImperial])

  const updateLineWidth = useUpdateLineWidth(selected)

  const onValueSubmit = useCallback(
    (newValue: number) => {
      if (isNaN(newValue) || newValue < metricMin) return
      updateLineWidth(newValue)
    },
    [metricMin, updateLineWidth],
  )
  const id = `width_input`
  const name = t(($) => $.properties.width)
  const currentValueM = currentLineWidth(selected, isImperial)

  return (
    <RightMenuGridPanel>
      <weave-tooltip text={name} style={{ gridColumn: "1/2" }} nub="right-center">
        <label className={labelClassName} htmlFor={id}>
          {name.slice(0, 1)}
        </label>
      </weave-tooltip>
      <LengthInput
        style={{ gridColumn: "2/3" }}
        metricValue={currentValueM ?? 0}
        onBlur={onValueSubmit}
        id={id}
        isMixed={currentValueM === undefined}
        metricMin={metricMin}
        accessAware={true}
      />
    </RightMenuGridPanel>
  )
}
