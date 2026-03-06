import { useCallback, useMemo, useState } from "preact/hooks"
import { atom } from "recoil"
import { isDefined } from "src/lib/array"
import { ToolInputIcons } from "src/integrations/inputs/floating/ToolInputIcons"
import type { ControlContextValue } from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import FloatingToolInputs from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import { CalculateMousePosition } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import * as formaUnits from "@spacemakerai/forma-units"
import { useIsImperial } from "src/lib/unitSettings"

export const showFloatingToolOptionsState = atom<boolean>({
  key: "showFloatingToolOptionsState",
  default: false,
})

const FloatingToolOptions = () => {
  const [, setRerender] = useState(new Object())
  const useImperial = useIsImperial()
  const toolOptionValues = Array.from(Array(FormIt.Tools.GetToolsOptionCount())).map(
    (_o, i) => FormIt.Tools.GetToolsOptionValueAndType(i)?.[0] ?? "",
  )

  const updateHandler = useCallback(
    (val: number, i: number) => {
      if (!val) return
      const unit = useImperial ? formaUnits.UnitType.ImperialFeetInches : formaUnits.UnitType.MetricMeter

      const formattedValue = formaUnits.formatLengthAs(useImperial ? formaUnits.meterToFeet(val) : val, unit)
      if (!formattedValue) return
      FormIt.Tools.SetToolsOptionValue(i, formattedValue)
      FormIt.Tools.ApplyToolOptionValues()
      setRerender(new Object())
    },
    [useImperial],
  )

  const toolOptionFields = useMemo(() => {
    // Use metric conversion for FloatingToolInputs field property "metricValue"
    formaUnits.setCurrentUnitType(formaUnits.UnitType.MetricMeter)
    return toolOptionValues
      .map((optionValue, i) => {
        const valueType = FormIt.Tools.GetToolsOptionValueAndType(i)?.[1]
        if (!valueType || !["int", "double"].includes(valueType)) return
        const toolOptionTitle = FormIt.Tools.GetToolsOptionTitle(i)?.toLowerCase()
        const icon =
          toolOptionTitle?.includes("width") || toolOptionTitle?.includes("radius") ? (
            <ToolInputIcons.HorizontalArrow />
          ) : toolOptionTitle?.includes("height") ? (
            <ToolInputIcons.MAGLIcon />
          ) : toolOptionTitle?.includes("depth") ? (
            <ToolInputIcons.VerticalArrow />
          ) : (
            <ToolInputIcons.AngleIcon />
          )
        return {
          type: "horizontal",
          value: formaUnits.parseLength(optionValue),
          disabled: false,
          change: (val) => val && updateHandler(val, i),
          submit: (val) => val && updateHandler(val, i),
          customIcon: icon,
        } as ControlContextValue
      })
      .filter(isDefined)
  }, [toolOptionValues, updateHandler])

  if (!toolOptionFields.length) return null

  return (
    <>
      <CalculateMousePosition
        onTerrain={false}
        onChange={() => {
          setRerender(new Object())
        }}
        hideFloatingInputs={true}
      />
      <FloatingToolInputs
        fields={toolOptionFields}
        cancel={() => {
          // Exit the current tool
          FormIt.Tools.StartTool(FormIt.ToolType.SELECTION)
        }}
      />
    </>
  )
}

export default FloatingToolOptions
