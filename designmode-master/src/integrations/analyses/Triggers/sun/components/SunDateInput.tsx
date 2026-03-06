import { useState } from "preact/hooks"
import { Calendar } from "./Calendar"
import { useTranslator } from "src/i18n"

function getMonthName(month: number) {
  const date = new Date("1970-01-01T00:00:00")
  date.setMonth(month - 1)
  return date.toLocaleString("en-US", {
    month: "long",
  })
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function range(length: number, startAt: number) {
  return [...Array(length).keys()].map((i) => i + startAt)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export interface Props {
  month: number
  date: number
  onChange: (date: { month: number; date: number }) => void
  onDelete?: () => void
  disabled: boolean
}

const DEFAULT_YEAR = 2017

export function SunDateInput({ month, date, onChange, onDelete, disabled }: Props) {
  const [dayCount, setDayCount] = useState<number>(getDaysInMonth(DEFAULT_YEAR, month))
  const t = useTranslator()

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        height: "40px",
      }}
    >
      <div style={{ display: "flex" }}>
        <Calendar />
      </div>
      <forma-select-native
        style={{ flex: "auto" }}
        value={month}
        disabled={disabled}
        onChange={(e) => {
          const newMonth = parseInt((e as CustomEvent<{ value: string }>).detail.value)
          const newDayCount = getDaysInMonth(DEFAULT_YEAR, newMonth)
          setDayCount(newDayCount)
          const clampedDay = clamp(date, 1, newDayCount)
          onChange({ month: newMonth, date: clampedDay })
        }}
      >
        {range(12, 1).map((i) => {
          return (
            <option key={i} value={i}>
              {getMonthName(i)}
            </option>
          )
        })}
      </forma-select-native>
      <forma-select-native
        style={{ width: "54px" }}
        value={date}
        disabled={disabled}
        onChange={(e) => {
          const newDate = parseInt((e as CustomEvent<{ value: string }>).detail.value)
          onChange({ month, date: newDate })
        }}
      >
        {range(dayCount, 1).map((i) => {
          return (
            <option key={i} value={i}>
              {i}
            </option>
          )
        })}
      </forma-select-native>
      <div style={{ display: onDelete === undefined || disabled ? "none" : "block" }} onClick={onDelete}>
        <weave-tooltip text={t(($) => $.analysis.sun.removeDateButton)} nub="down-right">
          <weave-icon-button>
            <weave-solid-minus-operator slot="icon"></weave-solid-minus-operator>
          </weave-icon-button>
        </weave-tooltip>
      </div>
    </div>
  )
}
