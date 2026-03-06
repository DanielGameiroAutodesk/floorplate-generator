import type { AddSectionCutData } from "src/integrations/building-systems-line-buildings/helpers/sectionDragging"
import type { ControlContextValue } from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import FloatingToolInputs from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import { useMemo } from "react"
import { exitCurrentTool } from "src/core/toolsState"

export function SectionAddLengthInputBox({ addSectionCutData }: { addSectionCutData: AddSectionCutData }) {
  let leftLength = addSectionCutData.beforeSectionLength
  let rightLength = addSectionCutData.effectiveAfterSectionLength

  const inputFields: ControlContextValue[] = useMemo(
    () => [
      {
        type: "horizontal",
        customIcon: <p>L</p>,
        value: leftLength,
        change: () => {},
        disabled: true,
      },
      {
        type: "horizontal",
        customIcon: <p>R</p>,
        value: rightLength,
        change: () => {},
        disabled: true,
      },
    ],
    [leftLength, rightLength],
  )

  return <FloatingToolInputs fields={inputFields} cancel={exitCurrentTool} />
}
