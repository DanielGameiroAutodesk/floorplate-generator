import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import * as formaUnits from "@spacemakerai/forma-units"
import { UnitType } from "@spacemakerai/forma-units"
import { applyLengthStep, inputStringToMeters, sanitizeComma, withinMetricLimits } from "./formaUnitUtils"
import styles from "./LengthInput.module.pcss"
import { useMemo } from "preact/compat"
import useAvoidInputCaretJump from "src/lib/components/useAvoidCaretJump"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

export type LengthInputProps = {
  metricValue?: number
  /* Used to keep track of the input having changes since mount. Doesn't fire onBlur/onChange if on exact same number */
  initialMetricValue?: number
  metricMin?: number
  metricMax?: number
  metricStep?: number
  feetStep?: number
  isMixed?: boolean
  onChange?: (newValue: number) => void
  onBlur?: (newValue: number) => void
  disabled?: boolean
  id?: string
  style?: { [key: string]: string }
  /** When true, disables this field if users doesn't have edit access to the proposal */
  accessAware?: boolean
}

/**
 * This component allows for displaying and updating a length value in either metric (9.2m) or
 * fractional imperial (9'-10", etc.)
 *
 * input is set deliberately to type="text" is to handle both metric and imperial inputs in as string format,
 * e.g 10m, 100cm, 9'-10" etc that is converted by forma-units to a number.
 *
 * @param props
 * @returns
 */
export default function LengthInput(props: LengthInputProps & { editAccess?: boolean }) {
  const t = useTranslator()
  const {
    metricValue,
    initialMetricValue = metricValue,
    onChange,
    onBlur,
    style,
    disabled,
    id,
    isMixed,
    accessAware,
    metricMin = -Infinity,
    metricMax = Infinity,
    metricStep = 1,
    feetStep = 1,
    editAccess,
  } = props

  const inputRef = useRef<WeaveInputElement>(null)
  const avoidInputCaretJump = useAvoidInputCaretJump(inputRef)

  const isProjectImperial = useIsImperial()

  const defaultDisplayUnit = isProjectImperial ? UnitType.ImperialFeetInches : UnitType.MetricMeter

  // Overrides the project display unit (if set)
  const [displayUnitOverride, setDisplayUnitOverride] = useState<UnitType | undefined>()

  // Returns specificDisplayUnit if it is set, otherwise returns the project display unit
  const displayUnit = useCallback(
    () => (typeof displayUnitOverride === "undefined" ? defaultDisplayUnit : displayUnitOverride),
    [displayUnitOverride, defaultDisplayUnit],
  )

  const readOnly = useMemo(() => accessAware && !editAccess, [accessAware, editAccess])

  const formatMetricValueToDisplayUnit = useCallback((valueMeters: number | undefined, unit: UnitType) => {
    if (typeof valueMeters === "undefined") return ""
    if (isNaN(valueMeters)) return ""
    return formaUnits.formatMetricLengthAs(valueMeters, unit)
  }, [])

  const [internal, setInternal] = useState(formatMetricValueToDisplayUnit(metricValue, displayUnit()))

  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setInternal(formatMetricValueToDisplayUnit(metricValue, displayUnit()))
  }, [metricValue, formatMetricValueToDisplayUnit, displayUnitOverride, displayUnit])

  const handleChange = useCallback(
    (changed: string) => {
      setInternal(changed)
      const newValue = sanitizeComma(changed)

      if (newValue !== "" && formaUnits.isValidString(newValue)) {
        const { metricValue: newMetricValue, parsedUnitType } = inputStringToMeters(newValue, displayUnit())
        setDisplayUnitOverride(parsedUnitType)

        const metricWithinLimits = withinMetricLimits({ metricValue: newMetricValue, metricMin, metricMax })
        if (initialMetricValue !== metricWithinLimits && onChange) {
          onChange(metricWithinLimits)
        }
      }
    },
    [displayUnit, initialMetricValue, metricMax, metricMin, onChange],
  )

  const onSubmit = (submitted: string) => {
    const newValue = sanitizeComma(submitted)

    if (newValue !== "" && formaUnits.isValidString(newValue)) {
      const newValueUnitType = formaUnits.getUnitTypeNoDefault(newValue) ?? displayUnit()
      const valueInDefaultProjectUnits = formaUnits.convertStringToUnit(newValue, defaultDisplayUnit, {
        defaultSourceUnit: newValueUnitType,
      })
      setDisplayUnitOverride(defaultDisplayUnit)
      setInternal(valueInDefaultProjectUnits!)
      const { metricValue: newMetricValue } = inputStringToMeters(newValue, displayUnit())
      const metricWithinLimits = withinMetricLimits({ metricValue: newMetricValue, metricMin, metricMax })

      if (initialMetricValue !== metricWithinLimits && onBlur) {
        onBlur(metricWithinLimits)
      }

      setInternal(formaUnits.formatMetricLengthAs(metricWithinLimits, defaultDisplayUnit))
    } else {
      formaUnits.setCurrentUnitType(defaultDisplayUnit)
      setDisplayUnitOverride(defaultDisplayUnit)
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
      displayUnitOverride === UnitType.ImperialFeetInches ? UnitType.MetricMeter : UnitType.ImperialFeetInches
    setDisplayUnitOverride(newDisplayUnit)
    setInternal(formatMetricValueToDisplayUnit(metricValue, newDisplayUnit))
  }, [displayUnitOverride, formatMetricValueToDisplayUnit, metricValue])

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
          isImperial: isProjectImperial,
          displayUnit: displayUnit(),
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
          isImperial: isProjectImperial,
          displayUnit: displayUnit(),
        })
        handleChange(formaUnits.formatLength(steppedDown))
      }
    },
    [toggleUnit, internal, metricMax, metricMin, feetStep, metricStep, isProjectImperial, displayUnit, handleChange],
  )

  return (
    <div className={styles.LengthInput} style={style}>
      <weave-input
        ref={inputRef}
        type="text"
        onKeyDown={(e) => keyDown(e)}
        value={internal}
        onChange={(e) => {
          avoidInputCaretJump(e.target as HTMLInputElement)
          handleChange((e.target as HTMLInputElement).value)
        }}
        onBlur={(e) => onSubmit((e.target as HTMLInputElement).value)}
        disabled={disabled || readOnly}
        onFocus={() => inputRef.current?.inputEl?.select()}
        id={id}
        placeholder={isMixed ? t(($) => $.properties.mixed) : undefined}
        autoComplete="off"
        readOnly={readOnly}
      />
    </div>
  )
}
