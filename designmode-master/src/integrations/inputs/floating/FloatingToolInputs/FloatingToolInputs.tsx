import { useCallback, useEffect, useState } from "preact/compat"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { ToolAngleInput } from "src/integrations/inputs/floating/ToolAngleInput"
import { ToolInputIcons } from "src/integrations/inputs/floating/ToolInputIcons"
import FocusTrap from "./FocusTrap"
import { ToolLengthInput } from "src/integrations/inputs/floating/ToolLengthInput"
import { useMemo } from "preact/hooks"
import type { VNode } from "preact"
import styles from "./FloatingToolInputs.module.pcss"
import { mouseScreenPosition } from "src/core/useMousePosition"
import { ToolStringInput } from "src/integrations/inputs/floating/ToolStringInput"
import { useIsImperial } from "src/lib/unitSettings"

export { styles as floatingToolInputsStyles }

export type ValueTypes =
  | "masl"
  | "magl"
  | "vertical"
  | "verticalOffset"
  | "horizontal"
  | "noFloors"
  | "angle"
  | "string"
  | "none"

export type ControlContextValue = {
  type: ValueTypes
  value: any
  change: (value: number | undefined) => void
  submit?: (value: number | undefined) => void
  disabled?: boolean
  customIcon?: VNode
  metricMin?: number
  hidden?: boolean
  options?: InputOptions
  id?: string
}

export type Props = {
  focus?: (value: ValueTypes, id?: string) => void
  cancel: (e?: KeyboardEvent) => void
  fields: ControlContextValue[]
  offsetX?: number
  offsetY?: number
  x?: number
  y?: number
}

export type InputOptions = {
  // Esc key blurs input
  blurOnEscapeKey?: boolean
  // Select the input value on focus
  selectOnFocus?: boolean
  // Do not cancel typing on mouse move
  typeOnMouseMove?: boolean | (() => boolean)
}

function getNextEnabledFieldIndex(activeField: number, values: ControlContextValue[], event: KeyboardEvent) {
  let i = 0 // safeguard to not infinite loop if all fields are disabled.
  let nextActive = activeField

  while (i <= values.length) {
    nextActive = (event.shiftKey ? nextActive - 1 + values.length : nextActive + 1) % values.length
    if (!values[nextActive].disabled) break
    i++
  }

  return nextActive
}

function FloatingToolInputsWrapper({
  children,
  offsetX,
  offsetY,
  x,
  y,
}: {
  children?: (VNode | null | false)[]
  offsetX?: number
  offsetY?: number
  x?: number
  y?: number
}) {
  const cx = typeof x !== "undefined" ? x : mouseScreenPosition.x
  const cy = typeof y !== "undefined" ? y : mouseScreenPosition.y
  return (
    <div
      id="floating-tool-inputs-wrapper"
      className={styles.FloatingInputsWrapper}
      style={{
        top: `calc(${cy + (offsetY ?? 0)}px + 16px)`,
        left: `calc(${cx + (offsetX ?? 0)}px + 40px)`,
      }}
    >
      {children}
    </div>
  )
}

export const domCanvas = document.getElementById("design-mode-canvas") as HTMLCanvasElement

const MAX_WIDTH = 18
export default function FloatingToolInputs({ fields, focus, cancel, offsetX, offsetY, x, y }: Props) {
  const [activeField, setActiveField] = useState<number>(0)
  const [sharedInputWidth, setSharedInputWidth] = useState<number | undefined>(undefined)
  const useImperialUnits = useIsImperial()

  const updateSharedInputWidth = useCallback((sharedWidth: number) => {
    setSharedInputWidth(Math.min(sharedWidth, MAX_WIDTH))
  }, [])

  const onFocus = useMemo(() => focus ?? (() => {}), [focus])

  const keydown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault()
        event.stopImmediatePropagation()
        const nextActive = getNextEnabledFieldIndex(activeField, fields, event)
        setActiveField(nextActive)
      } else if (event.key === "Escape") {
        cancel?.(event)
      }
      return Propagate.YES
    },
    [activeField, fields, cancel],
  )

  const focusedType = fields[activeField]?.type
  const focusedId = fields[activeField]?.id

  useEffect(() => {
    onFocus(focusedType, focusedId)
  }, [focusedId, focusedType, onFocus])

  useEventHandler("keydown", keydown, Priority.TOOL_INPUT_CONTROL)

  return (
    <FloatingToolInputsWrapper offsetX={offsetX} offsetY={offsetY} x={x} y={y}>
      {fields.map((field, i) => {
        if (field.hidden) return null
        switch (field.type) {
          case "masl":
            return (
              <ToolLengthInput
                key={i}
                metricValue={field.value}
                change={field.change}
                active={activeField === i}
                useImperialUnits={useImperialUnits}
                disabled={field.disabled}
                icon={<ToolInputIcons.MASLIcon />}
                sharedInputWidthCh={sharedInputWidth}
                updateSharedWidthCh={updateSharedInputWidth}
                metricMin={-2000}
              />
            )
          case "magl":
            return (
              <ToolLengthInput
                key={i}
                metricValue={field.value}
                change={field.change}
                active={activeField === i}
                useImperialUnits={useImperialUnits}
                disabled={field.disabled}
                icon={<ToolInputIcons.MAGLIcon />}
                sharedInputWidthCh={sharedInputWidth}
                updateSharedWidthCh={updateSharedInputWidth}
                metricMin={-2000}
              />
            )
          case "vertical":
            return (
              <ToolLengthInput
                key={i}
                metricValue={field.value}
                change={field.change}
                active={activeField === i}
                useImperialUnits={useImperialUnits}
                disabled={field.disabled}
                icon={<ToolInputIcons.VerticalArrow />}
                sharedInputWidthCh={sharedInputWidth}
                updateSharedWidthCh={updateSharedInputWidth}
                metricMin={field.metricMin}
              />
            )
          case "verticalOffset":
            return (
              <ToolLengthInput
                key={i}
                metricValue={field.value}
                change={field.change}
                active={activeField === i}
                useImperialUnits={useImperialUnits}
                disabled={field.disabled}
                icon={<ToolInputIcons.HeightIcon />}
                sharedInputWidthCh={sharedInputWidth}
                updateSharedWidthCh={updateSharedInputWidth}
                metricMin={field.metricMin}
              />
            )
          case "horizontal":
            return (
              <ToolLengthInput
                key={i}
                metricValue={field.value}
                change={field.change}
                active={activeField === i}
                useImperialUnits={useImperialUnits}
                icon={field.customIcon || <ToolInputIcons.HorizontalArrow />}
                disabled={field.disabled}
                sharedInputWidthCh={sharedInputWidth}
                updateSharedWidthCh={updateSharedInputWidth}
                metricMax={10000}
                metricMin={field.metricMin}
              />
            )
          case "angle":
            return (
              <ToolAngleInput
                key={i}
                value={field.value}
                onChange={field.change}
                onSubmit={field.submit}
                active={activeField === i}
                step={15}
                icon={<ToolInputIcons.AngleIcon />}
                disabled={field.disabled}
                sharedInputWidthCh={sharedInputWidth}
              />
            )
          case "string":
            return (
              <ToolStringInput
                key={i}
                value={field.value}
                change={field.change}
                submit={field.submit}
                active={activeField === i}
                icon={field.customIcon || <ToolInputIcons.HorizontalArrow />}
                disabled={field.disabled}
                sharedInputWidthCh={sharedInputWidth}
                updateSharedWidthCh={updateSharedInputWidth}
                options={field.options}
              />
            )
          case "none":
            return <FocusTrap hasFocus={activeField === i} />
          default:
            return null
        }
      })}
    </FloatingToolInputsWrapper>
  )
}
