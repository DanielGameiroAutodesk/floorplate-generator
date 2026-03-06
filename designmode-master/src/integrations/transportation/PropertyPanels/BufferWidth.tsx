import { useTranslator } from "src/i18n"
import { labelClassName } from "src/lib/components/RightMenu/RightMenuLabel"
import { useCallback } from "preact/compat"
import { useMemo } from "react"
import { categoryToDefaultLineWidth } from "src/lib/three/Shape/shapeUtils"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import transportationApi, { type TransportationElement } from "src/integrations/transportation/lib/transportationApi"
import { elementState } from "src/core/elements/ElementState"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { createElementContainer } from "src/integrations/transportation/glue"
import { WeaveInputComponent, withAccess, withImperial } from "src/lib/components/LengthInput/WeaveInputHelpers"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useIsImperial } from "src/lib/unitSettings"

export const BufferWidthEdit = ({ selected }: { selected: ChildNodeContainer[] }) => {
  const isImperial = useIsImperial()
  const metricMin = useMemo(() => categoryToDefaultLineWidth(isImperial, "default"), [isImperial])
  const contextRoot = scenarioModeSignal.value ? "base" : "proposal"
  const currentValue = useMemo(() => {
    const first = transportationApi.getWidth(selected[0].element as TransportationElement)
    const isMixed = selected.some((e) => transportationApi.getWidth(e.element as TransportationElement) !== first)
    return isMixed ? 0 : first
  }, [selected])
  const onComplete = useCallback(
    (newValue: number) => {
      if (isNaN(newValue) || newValue < metricMin) return
      selected.forEach((selected) => {
        elementState.edit(({ updateElement }) => {
          const updatedElement = transportationApi.updateWidth(selected.element as TransportationElement, newValue)
          const container = createElementContainer(updatedElement)
          updateElement(contextRoot, { ...selected.child, urn: updatedElement.urn }, container)
        })
      })
    },
    [contextRoot, metricMin, selected],
  )

  return (
    <div style={{ paddingBottom: "12px" }}>
      <BufferWidthInput width={currentValue} onChange={onComplete} />
    </div>
  )
}

const MeterInput = withAccess(withImperial(WeaveInputComponent))

export function BufferWidthInput({ width, onChange }: { width: number; onChange: (newVal: number) => void }) {
  const t = useTranslator()
  const id = `width_input`
  const name = t(($) => $.properties.width)

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <weave-tooltip text={name} style={{ gridColumn: "1/2" }} nub="right-center">
        <label className={labelClassName} htmlFor={id}>
          {name.slice(0, 1)}
        </label>
      </weave-tooltip>
      <MeterInput
        style={{ margin: "0 8px" }}
        editAccess={canEditProposalSignal.value}
        metricValue={width}
        onChangeValue={onChange}
        metricMin={0.5}
        metricMax={100}
        id={id}
      />
    </div>
  )
}
