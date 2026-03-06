import { formatMetricLengthAs, UnitType } from "@spacemakerai/forma-units"
import { useIsImperial } from "src/lib/unitSettings"

/*
 * Wrapper to formats metric length based on ImperialUnits flag and NewUnits. I.e
 * 5m or 5m
 * 16'-4 27/32" or 16,4 ft
 *  */
export default function FormatLength({ metricLength }: { metricLength: number }) {
  const useImperialUnits = useIsImperial()

  return (
    <>{formatMetricLengthAs(metricLength, useImperialUnits ? UnitType.ImperialFeetInches : UnitType.MetricMeter)}</>
  )
}
