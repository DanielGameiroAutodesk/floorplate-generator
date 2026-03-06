import { effect, signal } from "@preact/signals"
import ArrayUtils from "src/lib/array"
import { estimateObjectSize } from "src/lib/debugging/estimateObjectSize"
import { parseUrn } from "src/lib/element/urn"
import { ExternalURLFlag, featureFlagSignalFamily } from "src/lib/featureToggling"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { registerDerivedDataPlugin } from "src/core/elements/derived-data/plugins"
import { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { ElementContainer } from "src/core/elements/ElementContainer"

type DerivedDataRecord = {
  containerType: string
  derivedDataType: string
  elementSystem: string

  containerWeakRef: WeakRef<ElementContainer | ChildNodeContainer | WeakKey>
  valueWeakRef?: WeakRef<any>

  selfTimeDuration: number
}
type AliveDerivedDataRecord = DerivedDataRecord & { bytesEstimate: number }

const derivedDataRecordsInternal: DerivedDataRecord[] = []
export const recordsCountSignal = signal<number>(0)

export type MetricStats = { min: number; max: number; sum: number; mean: number }
export type DerivedDataStatsCell = {
  recordCount: number
  containerCounts: { container: number; node: number }
  size: MetricStats
  duration: MetricStats
}
export type DerivedDataStatsTable = Record<string, Record<string, DerivedDataStatsCell>>

function getContainerType(container: ElementContainer | ChildNodeContainer | WeakKey): string {
  if (container instanceof ElementContainer) {
    return "container"
  } else if (container instanceof ChildNodeContainer) {
    return "node"
  } else {
    // Adding derived data to other stuff.
    return container.constructor.name
  }
}

function getElementSystemForContainer(container: ElementContainer | ChildNodeContainer | WeakKey): string {
  if (container instanceof ElementContainer) {
    return parseUrn(container.element.urn).system
  } else if (container instanceof ChildNodeContainer) {
    return getElementSystemForContainer(container.elementContainer)
  } else {
    // Adding derived data to other stuff.
    return "unknown"
  }
}

function getDerivedDataTypeRows(records: DerivedDataRecord[]): string[] {
  return [...new Set(records.map((r) => r.derivedDataType))].sort().concat("SUM")
}

function getElementSystemColumns(records: DerivedDataRecord[]): string[] {
  return [...new Set(records.map((r) => r.elementSystem))].sort().concat("SUM")
}

function getMetricStats(values: number[]): MetricStats {
  if (values.length == 0) return { min: NaN, max: NaN, sum: NaN, mean: NaN }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const sum = ArrayUtils.sum(values)
  const mean = sum / values.length
  return { min, max, sum, mean }
}

function getDerivedDataStatsCell(
  records: AliveDerivedDataRecord[],
  derivedDataType: string | undefined,
  elementSystem: string | undefined,
): DerivedDataStatsCell {
  const filteredRecords = records.filter(
    (record) =>
      (derivedDataType === undefined || record.derivedDataType == derivedDataType) &&
      (elementSystem === undefined || record.elementSystem == elementSystem),
  )
  const countContainersByType = (containerType: string) => {
    return new Set(
      filteredRecords
        .filter((r) => r.containerType == containerType)
        .filter((r) => !!r.containerWeakRef.deref())
        .map((r) => r.containerWeakRef.deref()),
    ).size
  }
  return {
    recordCount: filteredRecords.length,
    containerCounts: {
      container: countContainersByType("container"),
      node: countContainersByType("node"),
    },
    size: getMetricStats(filteredRecords.map((r) => r.bytesEstimate / 1_000_000)),
    duration: getMetricStats(filteredRecords.map((r) => r.selfTimeDuration)),
  }
}

export function getStatsTable(
  snapshot: ElementSnapshot,
  filter: "in-snapshot" | "not-in-snapshot",
): DerivedDataStatsTable {
  const containers = new Set<ElementContainer | ChildNodeContainer | WeakKey>([
    ...snapshot.elements.values(),
    ...snapshot.nodes.values(),
  ])

  const inSnapshotFilter = (record: DerivedDataRecord) =>
    !!(record.containerWeakRef.deref() && containers.has(record.containerWeakRef.deref()!))
  const recordFilter: (record: DerivedDataRecord) => boolean =
    filter == "in-snapshot" ? inSnapshotFilter : (record) => !inSnapshotFilter(record)
  const filteredRecords = derivedDataRecordsInternal.filter(recordFilter)
  const estimatedRecords = filteredRecords.map((record) => ({
    ...record,
    referenceAlive: !!(record.valueWeakRef && record.valueWeakRef.deref()),
    bytesEstimate: estimateObjectSize(record.valueWeakRef && record.valueWeakRef.deref()),
  }))
  const aliveRecords = estimatedRecords.filter((r) => r.referenceAlive)

  const derivedDataTypeRows = getDerivedDataTypeRows(aliveRecords)
  const elementSystemColumns = getElementSystemColumns(aliveRecords)
  return Object.fromEntries(
    derivedDataTypeRows.map((derivedDataTypeRow) => [
      derivedDataTypeRow,
      Object.fromEntries(
        elementSystemColumns.map((elementSystemColumn) => [
          elementSystemColumn,
          getDerivedDataStatsCell(
            aliveRecords,
            derivedDataTypeRow !== "SUM" ? derivedDataTypeRow : undefined,
            elementSystemColumn !== "SUM" ? elementSystemColumn : undefined,
          ),
        ]),
      ),
    ]),
  )
}

type OngoingTimer = { start: number; nestedDurationAlreadyCounted: number }
const nestedOngoingTimerStack: OngoingTimer[] = []

function markComputeStart() {
  const start = performance.now()
  nestedOngoingTimerStack.push({ start, nestedDurationAlreadyCounted: 0 })
}

function markComputeEnd(
  computeFn: (container: ElementContainer | ChildNodeContainer) => any,
  container: ElementContainer | ChildNodeContainer | WeakKey,
  value: any,
) {
  if (nestedOngoingTimerStack.length == 0) return
  const timerEnd = performance.now()
  const timer = nestedOngoingTimerStack.pop()!
  const totalDuration = timerEnd - timer.start
  const selfTimeDuration = totalDuration - timer.nestedDurationAlreadyCounted
  if (nestedOngoingTimerStack.length > 0) {
    nestedOngoingTimerStack.at(-1)!.nestedDurationAlreadyCounted += totalDuration
  }

  const containerType = getContainerType(container)
  const derivedDataType = `${containerType} ${computeFn.name}`
  const elementSystem = getElementSystemForContainer(container)

  const containerWeakRef = new WeakRef(container)
  const valueWeakRef = value ? new WeakRef(value) : undefined

  derivedDataRecordsInternal.push({
    containerType,
    derivedDataType,
    elementSystem,
    containerWeakRef,
    valueWeakRef,
    selfTimeDuration,
  })
  recordsCountSignal.value = derivedDataRecordsInternal.length
}

effect(() => {
  if (featureFlagSignalFamily(ExternalURLFlag.PerformanceStats).value) {
    return registerDerivedDataPlugin({
      markComputeStart,
      markComputeEnd,
    })
  }
})
