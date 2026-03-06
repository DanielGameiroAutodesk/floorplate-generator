import type { VNode } from "preact"
import * as formaUnits from "@spacemakerai/forma-units"
import { UnitType } from "@spacemakerai/forma-units"
import { toMetersIfImperial } from "src/lib/measurementSystem"
import { atom, useRecoilState } from "recoil"
import type { ChangeEvent } from "preact/compat"
import { useCallback, useEffect, useState } from "preact/compat"
import { useRef } from "preact/hooks"
import { round } from "src/lib/math/round"
import {
  applyLengthStep,
  inputStringToMeters,
  metricMinDefault,
  sanitizeComma,
} from "src/lib/components/LengthInput/formaUnitUtils"
import useAvoidInputCaretJump from "src/lib/components/useAvoidCaretJump"
import { useMemo } from "react"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import styles from "./FloatingToolInputs/FloatingToolInputs.module.pcss"

const METER_TO_FEET = 1 / 0.3048

const lastUnitTypeEnteredState = atom<UnitType | undefined>({
  key: "LastUnitTypeEntered",
  default: undefined,
})

const toDisplayUnit = (metricValue: number, displayType: UnitType): number => {
  if (displayType === UnitType.MetricMeter) {
    return round(metricValue, 2)
  } else if (displayType === UnitType.MetricCentimeter) {
    return metricValue * 100
  } else if (displayType === UnitType.MetricMillimeter) {
    return metricValue * 1000
  } else {
    return metricValue * METER_TO_FEET
  }
}

type Props = {
  metricValue: number
  metricMin?: number
  metricMax?: number
  feetStep?: number
  metricStep?: number
  useImperialUnits: boolean
  change: (value: number | undefined) => void
  submit?: (value: number | undefined) => void
  icon?: VNode
  unit?: string
  active: boolean
  step?: number
  disabled?: boolean
  sharedInputWidthCh?: number
  updateSharedWidthCh?: (newWidth: number) => void
  focus?: () => void
}

/**
 * This is an input box that includes displays a unit string within, either in imperial
 * (10'-11") or metric (9m). The user can also type the unit string themselves to do conversions.
 *
 * Intended to be used in a tool context where the input floats/follows the cursor.
 */
export const ToolLengthInput = ({
  active,
  metricValue,
  useImperialUnits,
  disabled,
  change,
  icon,
  unit,
  sharedInputWidthCh,
  updateSharedWidthCh,
  metricStep = 1,
  feetStep = 1,
  metricMax = 10000,
  metricMin = metricMinDefault(useImperialUnits),
  focus,
}: Props) => {
  const [internal, setInternal] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const [lastUnitTypeEntered, setLastUnitTypeEntered] = useRecoilState(lastUnitTypeEnteredState)

  // Controls the unit that we're displaying in
  const [displayUnit, setDisplayUnit] = useState(
    lastUnitTypeEntered ?? (useImperialUnits ? UnitType.ImperialFeetInches : UnitType.MetricMeter),
  )

  const ref = useRef<WeaveInputElement>(null)
  const avoidInputCaretJump = useAvoidInputCaretJump(ref)

  useEffect(() => {
    if (!isTyping && active) {
      ref.current?.inputEl?.focus()
      ref.current?.inputEl?.select()
    }
  }, [internal, active, isTyping, metricValue])

  // Only update external value if user is not typing
  useEffect(() => {
    if (!isTyping) {
      formaUnits.setCurrentUnitType(displayUnit)
      const val = toDisplayUnit(metricValue, displayUnit)
      setInternal(formaUnits.formatLength(val))
    }
  }, [active, isTyping, metricValue, displayUnit, useImperialUnits])

  const onFocus = useMemo(() => focus ?? (() => {}), [focus])

  // This will trigger updating of internval value from external value
  const onBlur = useCallback(() => {
    if (active) {
      ref.current?.inputEl?.focus()
      ref.current?.inputEl?.select()
    } else setIsTyping(false)
  }, [setIsTyping, active])

  const keydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isTyping) {
        setLastUnitTypeEntered(displayUnit)
        e.stopPropagation()
      }
      setIsTyping(false)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()

      const steppedUp = applyLengthStep({
        direction: "UP",
        currentVal: internal,
        isImperial: useImperialUnits,
        displayUnit,
        feetStep,
        metricStep,
        metricMax,
        metricMin,
      })

      setInternal(formaUnits.formatLength(steppedUp))
      change(toMetersIfImperial(steppedUp, useImperialUnits))
    } else if (e.key === "ArrowDown") {
      e.preventDefault()

      const steppedDown = applyLengthStep({
        direction: "DOWN",
        currentVal: internal,
        isImperial: useImperialUnits,
        displayUnit,
        feetStep,
        metricStep,
        metricMax,
        metricMin,
      })

      setInternal(formaUnits.formatLength(steppedDown))
      change(toMetersIfImperial(steppedDown, useImperialUnits))
    } else if (e.key === "`") {
      // This keyboard shortcut will toggle metric and imperial,
      // useful for debugging or for a quick conversion
      if (!isTyping) {
        e.preventDefault()
        const currentUnit = formaUnits.getUnitTypeNoDefault(internal) ?? displayUnit
        const newUnitType =
          displayUnit === UnitType.ImperialFeetInches ? UnitType.MetricMeter : UnitType.ImperialFeetInches
        setDisplayUnit(newUnitType)
        const result = formaUnits.convertStringToUnit(internal, newUnitType, { defaultSourceUnit: currentUnit })
        if (result) {
          setInternal(result)
        }
      } else {
        e.preventDefault()
        const currentUnit = formaUnits.getUnitTypeNoDefault(internal) ?? displayUnit
        const newUnitType =
          displayUnit === UnitType.ImperialFeetInches ? UnitType.MetricMeter : UnitType.ImperialFeetInches
        setDisplayUnit(newUnitType)
        const result = formaUnits.convertStringToUnit(internal, newUnitType, { defaultSourceUnit: currentUnit })
        if (result) {
          setInternal(result)
        }
      }
    }
  }

  useEffect(() => {
    if (isTyping) {
      const setIsTypingFalse = () => setIsTyping(false)
      window.addEventListener("mousemove", setIsTypingFalse)
      return () => {
        window.removeEventListener("mousemove", setIsTypingFalse)
      }
    }
  }, [isTyping])

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const changedVal = (e.target as HTMLInputElement).value
    const val = sanitizeComma(changedVal)
    avoidInputCaretJump(e.target as HTMLInputElement)

    if (val === "") {
      if (typeof lastUnitTypeEntered !== "undefined") {
        setDisplayUnit(lastUnitTypeEntered)
      } else {
        setDisplayUnit(useImperialUnits ? UnitType.ImperialFeetInches : UnitType.MetricMeter)
      }
      setInternal("")
      setIsTyping(false)

      // need to set "value" to undefined or else the useEffect for
      // updating external value wont fire
      change(undefined)
      return
    }

    setIsTyping(true)
    setInternal(changedVal)

    // see if we can parse the value, if we can, call "change"
    if (formaUnits.isValidString(val)) {
      const valUnitType = formaUnits.getUnitTypeNoDefault(val)
      const { metricValue } = inputStringToMeters(val, displayUnit)

      if (metricValue <= metricMax && metricValue >= metricMin) {
        change(metricValue)
      } else {
        console.warn("Exceeded max/min allowed input value", {
          element: ref.current?.offsetParent,
          input: `${metricValue}m`,
          max: `${metricMax}m`,
          min: `${metricMin}m`,
        })
      }

      if (valUnitType !== displayUnit) {
        setDisplayUnit(formaUnits.getUnitType(val))
      }
    }
  }

  /* a bit arbitrary, but imperial units with feet, inches, dashes and whitespace (e.g 291'-5 5/16")
     takes up less space per character than metric (e.g 99.02m) */
  const internalInputWidth = useMemo(() => {
    const buffer = useImperialUnits ? -1 : 2
    return Math.max(internal.length + buffer, 6)
  }, [internal, useImperialUnits])

  useEffect(() => {
    if (updateSharedWidthCh && internalInputWidth > (sharedInputWidthCh || 0)) {
      updateSharedWidthCh(internalInputWidth)
    }
  }, [updateSharedWidthCh, sharedInputWidthCh, internalInputWidth])

  return (
    <>
      <div className={styles.IconWrapper}>
        <span className={styles.Icon}>{icon}</span>
      </div>
      <div className={styles.FloatingInputWrapper}>
        <weave-input
          className={styles.FloatingInput}
          ref={ref}
          value={internal}
          disabled={disabled}
          onChange={onInputChange}
          onKeyDown={keydown}
          onBlur={onBlur}
          onFocus={onFocus}
          style={{ width: `${sharedInputWidthCh ?? internalInputWidth}ch` }}
          autoComplete={"off"}
        />
      </div>
      <span className={styles.Unit}>{unit ?? ""}</span>
    </>
  )
}
