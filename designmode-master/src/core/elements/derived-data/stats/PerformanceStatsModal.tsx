import { useCallback, useEffect, useState } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import PopUpBox from "src/lib/components/PopUps/PopUpBox"
import styles from "./PerformanceStatsModal.module.pcss"
import type { DerivedDataStatsCell, DerivedDataStatsTable, MetricStats } from "./stats"
import { getStatsTable, recordsCountSignal } from "./stats"
import { useTranslator } from "src/i18n"

function RenderDerivedDataStatsCell({ cell }: { cell: DerivedDataStatsCell }) {
  const formatMetricStats = (metricStats: MetricStats) =>
    `${metricStats.min.toFixed(3)} min / ${metricStats.mean.toFixed(3)} mean / ${metricStats.max.toFixed(3)} max`
  const valueThresholdStyle = (value: number, lowThreshold: number, highThreshold: number) =>
    value < lowThreshold ? styles.ValueLow : value > highThreshold ? styles.ValueHigh : undefined
  return (
    <>
      <td className={styles.SizeCell} title={formatMetricStats(cell.size)}>
        <span className={valueThresholdStyle(cell.size.sum, 1, 10)}>
          {cell.recordCount > 0 ? `${cell.size.sum.toFixed(1)} MB` : ""}
        </span>
      </td>
      <td className={styles.DurationCell} title={formatMetricStats(cell.duration)}>
        <span className={valueThresholdStyle(cell.duration.sum, 10, 1000)}>
          {cell.recordCount > 0 ? `${cell.duration.sum.toFixed(0)} ms` : ""}
        </span>
      </td>
    </>
  )
}

function RenderDerivedDataStatsTable({ table }: { table: DerivedDataStatsTable }) {
  return (
    <table>
      <tr key={"header"}>
        <th key={"corner"}></th>
        {Object.entries(table["SUM"]).map(([columnTitle, sumCell]) => (
          <th key={columnTitle} colSpan={2}>
            {columnTitle}
            <div style={{ fontWeight: "normal" }}>
              {sumCell.containerCounts.container} C / {sumCell.containerCounts.node} N
            </div>
          </th>
        ))}
      </tr>
      {Object.entries(table).map(([rowTitle, row]) => (
        <tr key={rowTitle}>
          <th style={{ textAlign: "left" }}>{rowTitle}</th>
          {Object.entries(row).map(([colTitle, cell]) => (
            <RenderDerivedDataStatsCell key={colTitle} cell={cell} />
          ))}
        </tr>
      ))}
    </table>
  )
}

function PerformanceStatsModalHeader({ status, onRefresh }: { status: string; onRefresh: () => void }) {
  const t = useTranslator()
  return (
    <>
      <PopUpBox.HeaderTitle>{t(($) => $.performanceStats.title, { status })}</PopUpBox.HeaderTitle>
      <weave-button
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.stopPropagation()
          onRefresh()
        }}
      >
        {t(($) => $.ui.refresh)}
      </weave-button>
    </>
  )
}

export function PerformanceStatsModal() {
  const t = useTranslator()
  const derivedDataRecordCountSignalValue = recordsCountSignal.value

  const [status, setStatus] = useState<string>("loading")
  const [currentSnapshotStats, setCurrentSnapshotStats] = useState<DerivedDataStatsTable>()
  const [pastSnapshotStats, setPastSnapshotStats] = useState<DerivedDataStatsTable>()

  const refreshStatsTables = useCallback(() => {
    setCurrentSnapshotStats(getStatsTable(elementState.currentSnapshot.peek(), "in-snapshot"))
    setPastSnapshotStats(getStatsTable(elementState.currentSnapshot.peek(), "not-in-snapshot"))
  }, [])

  useEffect(() => {
    setStatus(`(${derivedDataRecordCountSignalValue} records)...`)
    const debounceTimeout = setTimeout(() => {
      refreshStatsTables()
      setStatus(`(${derivedDataRecordCountSignalValue} records)`)
    }, 1000)
    return () => clearTimeout(debounceTimeout)
  }, [derivedDataRecordCountSignalValue, refreshStatsTables])

  return (
    <PopUpBox.Container
      id="performance-stats-modal"
      top={200}
      header={<PerformanceStatsModalHeader status={status} onRefresh={refreshStatsTables} />}
    >
      <div className={styles.PerformanceStatsMain}>
        {currentSnapshotStats && currentSnapshotStats["SUM"]["SUM"].recordCount > 0 && (
          <>
            <h2>{t(($) => $.performanceStats.currentSnapshot)}</h2>
            <RenderDerivedDataStatsTable table={currentSnapshotStats} />
          </>
        )}
        {pastSnapshotStats && pastSnapshotStats["SUM"]["SUM"].recordCount > 0 && (
          <>
            <h2>{t(($) => $.performanceStats.remainingFromPastSnapshots)}</h2>
            <RenderDerivedDataStatsTable table={pastSnapshotStats} />
          </>
        )}
      </div>
    </PopUpBox.Container>
  )
}
