import LengthInput from "src/lib/components/LengthInput/LengthInput"
import { useEffect, useState } from "preact/compat"
import { feetToMeter } from "src/lib/measurementSystem"
import { useIsImperial } from "src/lib/unitSettings"

export type SliderLengthInputProps = {
  label: string
  metricValue?: number
  metricMin?: number
  metricMax?: number
  metricStep?: number
  feetStep?: number
  disabled?: boolean
  onSubmit: (metricValue: number) => void | undefined
  id: string
  tooltip?: string
  inputStyle?: { [key: string]: string }
}

/* Renders a slider with a length input intended to be used for lengths.*/
export default function SliderLengthInput(props: SliderLengthInputProps & { editAccess?: boolean }) {
  const {
    metricValue,
    id,
    label,
    disabled,
    onSubmit,
    tooltip,
    metricStep = 1,
    feetStep = 1,
    metricMax = Infinity,
    metricMin = -Infinity,
    inputStyle = {},
    editAccess,
  } = props

  const [internalMetricValue, setInternalMetricValue] = useState(metricValue)
  const isImperial = useIsImperial()

  useEffect(() => {
    if (metricValue) {
      setInternalMetricValue(metricValue)
    }
  }, [metricValue])

  return (
    <>
      <weave-tooltip nub="up-center" text={tooltip}>
        <label htmlFor={id}>{label}</label>
      </weave-tooltip>
      <weave-slider
        value={`${internalMetricValue}`}
        min={`${metricMin}`}
        max={`${metricMax}`}
        step={`${isImperial ? feetToMeter(feetStep) : metricStep}`}
        disabled={disabled || !editAccess}
        onInput={(e) => {
          if (!e.detail) return
          setInternalMetricValue(parseFloat(e.detail))
        }}
        onChange={(e) => {
          if (!e.detail) return
          return onSubmit(parseFloat(e.detail))
        }}
      ></weave-slider>
      <LengthInput
        id={id}
        metricValue={internalMetricValue}
        initialMetricValue={metricValue}
        disabled={disabled}
        onBlur={(newMetricValue) => {
          onSubmit(newMetricValue)
          setInternalMetricValue(newMetricValue)
        }}
        onChange={(newMetricValue) => {
          setInternalMetricValue(newMetricValue)
        }}
        metricMin={metricMin}
        metricMax={metricMax}
        metricStep={metricStep}
        feetStep={feetStep}
        accessAware={true}
        style={inputStyle}
        editAccess={editAccess}
      />
    </>
  )
}
