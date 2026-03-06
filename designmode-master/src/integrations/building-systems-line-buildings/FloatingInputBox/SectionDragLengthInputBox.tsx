import type { DragSectionCutData } from "src/integrations/building-systems-line-buildings/helpers/sectionDragging"
import { useMemo } from "react"
import type { ControlContextValue } from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import FloatingToolInputs from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import { exitCurrentTool } from "src/core/toolsState"

export function SectionDragLengthInputBox({
  dragSectionCutData,
  updateSectionCutData,
}: {
  dragSectionCutData: DragSectionCutData
  updateSectionCutData: (data: any) => void
}) {
  let leftLength = dragSectionCutData.effectiveSectionLengthBefore
  let rightLength = dragSectionCutData.effectiveSectionLengthAfter
  if (dragSectionCutData.fixedBeforeLength !== undefined) {
    leftLength = dragSectionCutData.fixedBeforeLength
    rightLength = dragSectionCutData.totalEffectiveLength - leftLength
  } else if (dragSectionCutData.fixedAfterLength !== undefined) {
    rightLength = dragSectionCutData.fixedAfterLength
    leftLength = dragSectionCutData.totalEffectiveLength - rightLength
  }

  const maxLength = dragSectionCutData.totalEffectiveLength

  const inputFields: ControlContextValue[] = useMemo(
    () => [
      {
        type: "horizontal",
        customIcon: <p>L</p>,
        value: leftLength,
        change: (fixedLength: number | undefined) => {
          if (fixedLength === undefined) {
            updateSectionCutData({ fixedBeforeLength: undefined, fixedAfterLength: undefined })
            return
          }
          const fixedBeforeLength = Math.max(Math.min(fixedLength, maxLength), 0)
          updateSectionCutData({ fixedBeforeLength, fixedAfterLength: undefined })
        },
      },
      {
        type: "horizontal",
        customIcon: <p>R</p>,
        value: rightLength,
        change: (fixedLength: number | undefined) => {
          if (fixedLength === undefined) {
            updateSectionCutData({ fixedBeforeLength: undefined, fixedAfterLength: undefined })
            return
          }
          const fixedAfterLength = Math.max(Math.min(fixedLength, maxLength), 0)
          updateSectionCutData({ fixedBeforeLength: undefined, fixedAfterLength })
        },
      },
    ],
    [leftLength, maxLength, rightLength, updateSectionCutData],
  )

  return <FloatingToolInputs fields={inputFields} cancel={exitCurrentTool} />
}
