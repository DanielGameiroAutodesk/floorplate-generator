import { explicitSignal } from "./signal"
import { fetchMeasurementSettings, isProjectImperial } from "./unitSettings"
import { captureException } from "@sentry/browser"
import * as formaUnits from "@spacemakerai/forma-units"

const [formaUnitsInitializedSignal, setFormaUnitsInitializedSignalValue] = explicitSignal<boolean>(false)

export { formaUnitsInitializedSignal }

export function useInitFormaUnits() {
  fetchMeasurementSettings(false)
    .then(() => {
      if (!formaUnitsInitializedSignal.value) {
        setFormaUnitsInitializedSignalValue(true)

        if (isProjectImperial()) {
          formaUnits.setCurrentUnitType(formaUnits.UnitType.ImperialFeetInches)
        } else {
          formaUnits.setCurrentUnitType(formaUnits.UnitType.MetricMeter)
        }
      }
    })
    .catch((err) => {
      console.error("Failed to fetch settings", err)
      captureException(err, { tags: { owner: "conceptual" } })
    })
}
