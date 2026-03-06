import { useState } from "preact/hooks"
import styles from "./SelectDate.module.pcss"
import { useRecoilValue } from "recoil"
import { minRevisionDateState } from "src/integrations/proposal-history/proposal-history-state"

function getMonthName(month: number) {
  const date = new Date("1970-01-01T00:00:00")
  date.setMonth(month)
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

export const dateParamToTimeStamp = (dateParams: DateParams): number =>
  new Date(dateParams.year, dateParams.month, dateParams.date).getTime()

export type DateParams = {
  year: number
  month: number
  date: number
}

const CURRENT_YEAR = new Date().getFullYear()

function isValid({ date, min, max }: { date: DateParams; min?: number; max?: number }) {
  const dateTimeStamp = dateParamToTimeStamp(date)

  if (min && max) {
    return min <= dateTimeStamp && dateTimeStamp <= max
  } else if (min) {
    return min <= dateTimeStamp
  } else if (max) {
    return max >= dateTimeStamp
  }
  return true
}

export default function SelectDate({
  year,
  month,
  date,
  onChange,
  min,
  max,
}: DateParams & {
  onChange: (day: DateParams) => void
  min?: number
  max?: number
}) {
  const minYear = useRecoilValue(minRevisionDateState).getFullYear()
  const [dayCount, setDayCount] = useState<number>(getDaysInMonth(year, month))

  return (
    <div className={styles.SelectDate}>
      <forma-select-native
        value={year}
        onChange={(e) => {
          const newYear = parseInt(e.detail.value)
          const newDayCount = getDaysInMonth(year, month)
          setDayCount(newDayCount)
          const clampedDay = clamp(date, 1, newDayCount)
          onChange({ year: newYear, month: month, date: clampedDay })
        }}
      >
        {range(CURRENT_YEAR + 1 - minYear, minYear).map((i) => {
          return (
            <option key={i} value={i} disabled={!isValid({ date: { year: i, month, date }, min, max })}>
              {i}
            </option>
          )
        })}
      </forma-select-native>
      <forma-select-native
        value={month}
        onChange={(e) => {
          const newMonth = parseInt(e.detail.value)
          const newDayCount = getDaysInMonth(year, newMonth)
          setDayCount(newDayCount)
          const clampedDay = clamp(date, 1, newDayCount)
          onChange({ year: year, month: newMonth, date: clampedDay })
        }}
      >
        {range(12, 0).map((i) => {
          return (
            <option key={i} value={i} disabled={!isValid({ date: { year, month: i, date }, min, max })}>
              {getMonthName(i)}
            </option>
          )
        })}
      </forma-select-native>
      <forma-select-native
        value={date}
        onChange={(e) => {
          const newDate = parseInt(e.detail.value)
          onChange({ year: year, month, date: newDate })
        }}
      >
        {range(dayCount, 1).map((i) => {
          return (
            <option key={i} value={i} disabled={!isValid({ date: { year, month, date: i }, min, max })}>
              {i}
            </option>
          )
        })}
      </forma-select-native>
    </div>
  )
}
