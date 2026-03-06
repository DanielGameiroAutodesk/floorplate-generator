import type { FunctionComponent, JSX } from "preact"
import * as formaUnits from "@spacemakerai/forma-units"
import { UnitType } from "@spacemakerai/forma-units"
import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { applyLengthStep, inputStringToMeters, sanitizeComma, withinMetricLimits } from "./formaUnitUtils"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import useAvoidInputCaretJump from "src/lib/components/useAvoidCaretJump"
import { forwardRef } from "preact/compat"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

type ImperialProps = {
  metricValue?: number
  /* Used to keep track of the input having changes since mount. Doesn't fire onBlur/onChange if on exact same number */
  initialMetricValue?: number
  metricMin?: number
  metricMax?: number
  metricStep?: number
  feetStep?: number
  isMixed?: boolean

  onChangeValue?: (newValue: number) => void
  onBlurValue?: (newValue: number) => void
}

export function withImperial<T extends JSX.IntrinsicElements["weave-input"]>(
  Component: FunctionComponent<T>,
): FunctionComponent<T & ImperialProps> {
  return function ImperialConversion(props: T & ImperialProps) {
    const {
      metricValue,
      initialMetricValue,
      metricMin = -Infinity,
      metricMax = Infinity,
      metricStep = 1,
      feetStep = 1,
      onChangeValue,
      onBlurValue,
      isMixed,
    } = props

    const t = useTranslator()
    const inputRef = useRef<WeaveInputElement>(null)
    const avoidInputCaretJump = useAvoidInputCaretJump(inputRef)

    const isImperial = useIsImperial()

    const defaultDisplayUnit = isImperial ? UnitType.ImperialFeetInches : UnitType.MetricMeter

    const [displayUnit, setDisplayUnit] = useState(isImperial ? UnitType.ImperialFeetInches : UnitType.MetricMeter)

    const formatMetricValueToDisplayUnit = useCallback(
      (valueMeters: number | undefined, unit: UnitType) => {
        if (isMixed) return ""
        if (typeof valueMeters === "undefined") return ""
        if (isNaN(valueMeters)) return ""
        return formaUnits.formatMetricLengthAs(valueMeters, unit)
      },
      [isMixed],
    )

    const [internal, setInternal] = useState(formatMetricValueToDisplayUnit(metricValue, displayUnit))

    useEffect(() => {
      if (document.activeElement === inputRef.current) return
      setInternal(formatMetricValueToDisplayUnit(metricValue, displayUnit))
    }, [formatMetricValueToDisplayUnit, displayUnit, metricValue])

    const handleChange = useCallback(
      (changed: string) => {
        setInternal(changed)
        const newValue = sanitizeComma(changed)

        if (newValue !== "" && formaUnits.isValidString(newValue)) {
          const { metricValue: newMetricValue, parsedUnitType } = inputStringToMeters(newValue, displayUnit)
          setDisplayUnit(parsedUnitType)

          const metricWithinLimits = withinMetricLimits({ metricValue: newMetricValue, metricMin, metricMax })
          if (initialMetricValue !== metricWithinLimits && onChangeValue) {
            onChangeValue(metricWithinLimits)
          }
        }
      },
      [displayUnit, initialMetricValue, metricMax, metricMin, onChangeValue],
    )

    const onSubmit = (submitted: string) => {
      const newValue = sanitizeComma(submitted)

      if (newValue !== "" && formaUnits.isValidString(newValue)) {
        const newValueUnitType = formaUnits.getUnitTypeNoDefault(newValue) ?? displayUnit
        const valueInDefaultProjectUnits = formaUnits.convertStringToUnit(newValue, defaultDisplayUnit, {
          defaultSourceUnit: newValueUnitType,
        })
        setDisplayUnit(defaultDisplayUnit)
        setInternal(valueInDefaultProjectUnits!)
        const { metricValue: newMetricValue } = inputStringToMeters(newValue, displayUnit)
        const metricWithinLimits = withinMetricLimits({ metricValue: newMetricValue, metricMin, metricMax })

        if (initialMetricValue !== metricWithinLimits && onBlurValue) {
          onBlurValue(metricWithinLimits)
        }

        setInternal(formaUnits.formatMetricLengthAs(metricWithinLimits, defaultDisplayUnit))
      } else {
        formaUnits.setCurrentUnitType(defaultDisplayUnit)
        setDisplayUnit(defaultDisplayUnit)
        if (metricValue) {
          setInternal(formaUnits.formatMetricLengthAs(metricValue, defaultDisplayUnit))
        } else {
          setInternal("")
        }
      }
    }

    // switches between feet and meters (for debugging)
    const toggleUnit = useCallback(() => {
      const newDisplayUnit =
        displayUnit === UnitType.ImperialFeetInches ? UnitType.MetricMeter : UnitType.ImperialFeetInches
      setDisplayUnit(newDisplayUnit)
      setInternal(formatMetricValueToDisplayUnit(metricValue, newDisplayUnit))
    }, [displayUnit, formatMetricValueToDisplayUnit, metricValue])

    const keyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === "`") {
          // key to toggle units for debugging
          e.preventDefault()
          toggleUnit()
        } else if (["Enter", "Escape"].includes(e.key)) {
          e.preventDefault()
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          const steppedUp = applyLengthStep({
            direction: "UP",
            currentVal: internal,
            metricMax,
            metricMin,
            feetStep,
            metricStep,
            isImperial,
            displayUnit,
          })
          handleChange(formaUnits.formatLength(steppedUp))
        } else if (e.key === "ArrowDown") {
          e.preventDefault()
          const steppedDown = applyLengthStep({
            direction: "DOWN",
            currentVal: internal,
            metricMax,
            metricMin,
            feetStep,
            metricStep,
            isImperial,
            displayUnit,
          })
          handleChange(formaUnits.formatLength(steppedDown))
        }
      },
      [displayUnit, feetStep, handleChange, internal, isImperial, metricMax, metricMin, metricStep, toggleUnit],
    )

    return (
      <Component
        {...props}
        ref={inputRef}
        onChange={(e) => {
          avoidInputCaretJump(e.target as HTMLInputElement)
          handleChange((e.target as HTMLInputElement).value)
          props.onChange && props.onChange(e)
        }}
        onBlur={(e) => onSubmit((e.target as HTMLInputElement).value)}
        onFocus={(e) => {
          inputRef.current?.inputEl?.select()
          props.onFocus && props.onFocus(e)
        }}
        onKeyDown={keyDown}
        value={internal}
        placeholder={isMixed ? t(($) => $.properties.mixed) : undefined}
        autoComplete="off"
        type="text"
      />
    )
  }
}

function formatValue(value: number | undefined, isMixed: boolean | undefined) {
  return value === undefined || isNaN(value) || isMixed ? "" : `${parseFloat(value.toFixed(2))}`
}

function getValueWithinLimits(value: number, min: number, max: number) {
  if (value > max) return max
  if (value < min) return min
  return value
}

type WithNumberProps = {
  value?: number
  min?: number
  max?: number
  step?: number
  isMixed?: boolean
  onChangeValue?: (newVal: number) => void
  onBlurValue?: (newVal: number) => void
}

export function withNumber<T extends JSX.IntrinsicElements["weave-input"]>(Component: FunctionComponent<T>) {
  return function NumberInput(props: T & WithNumberProps) {
    const t = useTranslator()
    const { value, min = -Infinity, max = Infinity, step, isMixed, onChangeValue, onBlurValue } = props

    const inputRef = useRef<WeaveInputElement>(null)

    const [internal, setInternal] = useState(formatValue(value, isMixed))

    /* Needed to update this input's value when an outside component updates the value, e.g slider input */
    useEffect(() => {
      if (document.activeElement === inputRef.current) return
      setInternal(formatValue(value, isMixed))
    }, [value, isMixed])

    const changeHandler = useCallback(
      (event: Event) => {
        const strValue = (event.target as HTMLInputElement).value
        setInternal(strValue)

        const newValue = parseFloat(sanitizeComma(strValue))
        if (Number.isNaN(newValue)) return

        const valueWithinLimits = getValueWithinLimits(newValue, min, max)
        setInternal(`${valueWithinLimits}`)

        onChangeValue?.(valueWithinLimits)
      },
      [max, min, onChangeValue],
    )

    const blurHandler = useCallback(
      (event: Event) => {
        const newValue = parseFloat((event.target as HTMLInputElement).value)

        if (Number.isNaN(newValue)) {
          setInternal(formatValue(value, isMixed))
          return
        }
        const valueWithinLimits = getValueWithinLimits(newValue, min, max)
        setInternal(`${valueWithinLimits}`)
        onBlurValue?.(valueWithinLimits)
      },
      [isMixed, max, min, onBlurValue, value],
    )

    const onKeyDown = (e: KeyboardEvent) => {
      if (["Enter", "Escape"].includes(e.key)) {
        e.preventDefault()
        inputRef.current?.blur()
      }
    }

    return (
      <Component
        // This need to come before min, max and step, if not weave-input complains
        type="number"
        ref={inputRef}
        {...props}
        onKeyDown={onKeyDown}
        value={internal}
        onChange={changeHandler}
        onBlur={blurHandler}
        onFocus={(e) => {
          inputRef.current?.inputEl?.select()
          props.onFocus && props.onFocus(e)
        }}
        placeholder={isMixed ? t(($) => $.properties.mixed) : undefined}
        autoComplete="off"
        step={step}
        max={max}
        min={min}
      />
    )
  }
}

export type EditAccessProps = {
  editAccess: boolean
}

export function withAccess<T extends JSX.IntrinsicElements["weave-input"]>(
  Component: FunctionComponent<T>,
): FunctionComponent<T & EditAccessProps> {
  return function Access(props: T & EditAccessProps) {
    return <Component {...props} disabled={!props.editAccess || props.disabled} />
  }
}

export const WeaveInputComponent = forwardRef<WeaveInputElement, JSX.IntrinsicElements["weave-input"]>((props, ref) => {
  return <weave-input ref={ref} {...props} />
})
