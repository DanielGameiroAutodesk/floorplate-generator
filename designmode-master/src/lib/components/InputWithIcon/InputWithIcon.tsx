import { labelClassName } from "src/lib/components/RightMenu/RightMenuLabel"
import LengthInput from "src/lib/components/LengthInput/LengthInput"
import UnitInput from "src/lib/components/UnitInput/UnitInput"
import { useCallback } from "preact/hooks"
import styles from "./InputWithIcon.module.pcss"

import { RightMenuInput } from "src/lib/components/RightMenu/RightMenuInput"

type Props = {
  icon: JSX.Element | string
  label: string
  id: string
  min?: number
  max?: number
  step?: number
  value: number | undefined
  disabled?: boolean
  onChange: (inputValue: number) => void | undefined
  unit?: "length" | "angle" | "count"
  fulltextLabel?: boolean
  isMixed?: boolean
  metricStep?: number
  metricMin?: number
  metricMax?: number
  feetStep?: number
  debounceTime?: number
  canEditProposal: boolean
}

let debounceTimer: NodeJS.Timeout

const InputWithIcon = ({
  icon,
  label,
  id,
  min,
  max,
  step = 1,
  value,
  onChange,
  disabled = false,
  unit = "count",
  isMixed,
  metricStep,
  metricMin,
  metricMax,
  feetStep,
  debounceTime,
  canEditProposal,
}: Props) => {
  const onChangeDebounced = useCallback(
    (val: number) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => onChange(val), debounceTime)
    },
    [debounceTime, onChange],
  )
  return (
    <div className={styles.InputWithIcon}>
      <weave-tooltip className={styles.Icon} text={label}>
        {!icon ? (
          <label className={labelClassName} htmlFor={id}>
            {label.slice(0, 1)}
          </label>
        ) : (
          <label
            htmlFor={id}
            aria-label={label}
            style={{ display: "flex", flexDirection: "column", alignContent: "center" }}
          >
            {icon}
          </label>
        )}
      </weave-tooltip>
      <RightMenuInput>
        {unit === "length" ? (
          <LengthInput
            id={id}
            metricValue={value}
            onChange={onChangeDebounced}
            disabled={disabled}
            isMixed={isMixed}
            metricStep={metricStep}
            metricMin={metricMin}
            metricMax={metricMax}
            feetStep={feetStep}
            accessAware={true}
            editAccess={canEditProposal}
          />
        ) : (
          <UnitInput
            id={id}
            value={value}
            unit={unit === "angle" ? "°" : ""}
            onChange={onChangeDebounced}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            isMixed={isMixed}
            accessAware={true}
            editAccess={canEditProposal}
          />
        )}
      </RightMenuInput>
    </div>
  )
}

export default InputWithIcon
