import { useCallback, useMemo } from "preact/hooks"
import useFeatureFlag, { LDFlag } from "src/lib/featureToggling"
import { labelClassName } from "src/lib/components/RightMenu/RightMenuLabel"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useSelectionDetails } from "src/integrations/noise/useSelectionDetails"
import { delocalisedSpeed, localisedSpeed, multiValueProps } from "src/integrations/noise/noiseUtils"
import { UnitInput } from "src/integrations/noise/UnitInput"
import type { BasicAction } from "src/integrations/basic-elements/api/types"
import type { RoadTrafficData } from "@spacemakerai/element-types"
import { useTranslator } from "src/i18n"

import { RightMenuGridPanel } from "src/lib/components/RightMenu/RightMenuGridPanel"

type AdtDistribution = NonNullable<RoadTrafficData["adtDistribution"]>

const defaultTrafficData: RoadTrafficData = {
  adtDistribution: {
    dayPercentage: 84,
    eveningPercentage: 10,
    nightPercentage: 6,
  },
  heavyVehiclePercentage: 10,
}

let timeoutId: number

// TODO: This debounce must combine calls with different parameters, otherwise updates may be lost
function debounce(fn: () => void, ms: number) {
  clearTimeout(timeoutId)
  timeoutId = window.setTimeout(() => {
    fn()
  }, ms)
}

const DEBOUNCE_DELAY = 100

function RoadProperties() {
  const t = useTranslator()
  const isSpeedImperial = useFeatureFlag(LDFlag.SpeedImperialUnits)
  const selected = useSelectionDetails()

  const selectedTrafficData = useMemo(() => {
    const trafficData: (RoadTrafficData | undefined)[] = selected.map((s) => s.element.properties?.trafficData)
    return trafficData
  }, [selected])

  const ActionAPI = useActionAPI()

  // According to the type, trafficData may not be null! It still works because undefined == null
  // TODO: Figure out if this is a bug
  const isHidden = !selectedTrafficData.some((t) => t != null)

  const allRequiredInputsFilled = useMemo(() => {
    return selectedTrafficData.every(
      (s) =>
        s?.adt &&
        s.adtDistribution &&
        s.adtDistribution.dayPercentage !== undefined &&
        s.adtDistribution.eveningPercentage !== undefined &&
        s.adtDistribution.nightPercentage !== undefined &&
        s.speed,
    )
  }, [selectedTrafficData])
  // The user is allowed to modify the properties of all selected roads provided ANY selected road has traffic data.
  // Currently, if a road without traffic data is selected and a data property is changed, it will be initialized
  // without default values.
  // TODO: Figure out the intended way to handle this case
  const updateTrafficDataProperty = useCallback(
    (description: string, updatedProperties: Partial<RoadTrafficData>) => {
      debounce(() => {
        const updates = selected.map(({ element, path }): BasicAction => {
          return BasicElementAPI.updateProperties(path, {
            trafficData: { ...element.properties?.trafficData, ...updatedProperties },
          })
        })
        const coreActions = BasicElementAPI.basicActionsToCoreActions(updates)
        ActionAPI.apply(description, coreActions, {
          elementCategory: "road",
          eventType: "update",
          numElements: selected.length,
          tool: "roadProperties",
        })
      }, DEBOUNCE_DELAY)
    },
    [ActionAPI, selected],
  )

  const selectedSpeed = useMemo(() => {
    return new Set(selectedTrafficData.map((t) => t?.speed))
  }, [selectedTrafficData])

  const selectedAdt = useMemo(() => {
    return new Set(selectedTrafficData.map((t) => t?.adt))
  }, [selectedTrafficData])

  const selectedHeavyVehiclePercentage = useMemo(() => {
    return new Set(selectedTrafficData.map((t) => t?.heavyVehiclePercentage))
  }, [selectedTrafficData])

  const selectedAdtDistribution = useMemo(() => {
    const adtDistributions: (AdtDistribution | undefined)[] = selectedTrafficData.map((data) => data?.adtDistribution)
    return adtDistributions
  }, [selectedTrafficData])

  const selectedAdtDayPercentage = useMemo(() => {
    const data = new Set(selectedAdtDistribution.map((percentage) => percentage?.dayPercentage))
    return data
  }, [selectedAdtDistribution])

  const selectedAdtEveningPercentage = useMemo(() => {
    return new Set(selectedAdtDistribution.map((percentage) => percentage?.eveningPercentage))
  }, [selectedAdtDistribution])

  const selectedAdtNightPercentageComputed = useMemo(() => {
    if (selectedAdtDayPercentage.size === 1 && selectedAdtEveningPercentage.size === 1) {
      const adtDayPercentage = [...selectedAdtDayPercentage][0]
      const adtEveningPercentage = [...selectedAdtEveningPercentage][0]
      if (adtDayPercentage !== undefined && adtEveningPercentage !== undefined) {
        return 100 - adtDayPercentage - adtEveningPercentage
      }
    }
    return undefined
  }, [selectedAdtDayPercentage, selectedAdtEveningPercentage])

  const addTrafficData = useCallback(() => {
    const basicActions = selected
      // Only selected elements without trafficData should receive defaults
      .filter(({ element }) => {
        const trafficData: RoadTrafficData | undefined = element.properties?.trafficData
        // TODO: Resolve null/undefined weirdness
        return trafficData == null
      })
      .map(({ path }): BasicAction => BasicElementAPI.updateProperties(path, { trafficData: defaultTrafficData }))

    const coreActions = BasicElementAPI.basicActionsToCoreActions(basicActions)
    ActionAPI.apply("Add trafficData to roads", coreActions, {
      elementCategory: "road",
      eventType: "add",
      numElements: basicActions.length,
      tool: "roadProperties",
    })
  }, [ActionAPI, selected])

  const removeTrafficData = useCallback(() => {
    const updates = selected.map(
      ({ path }): BasicAction => BasicElementAPI.updateProperties(path, { trafficData: undefined }),
    )
    const coreActions = BasicElementAPI.basicActionsToCoreActions(updates)
    ActionAPI.apply("Remove trafficData on roads", coreActions, {
      elementCategory: "road",
      eventType: "update",
      numElements: selected.length,
      tool: "roadProperties",
    })
  }, [ActionAPI, selected])

  // This function may introduce invalid state such that dayPercentage + eveningPercentage > 100.
  // This happens because the values are only min/max constrained if the opposite percentage is singular.
  // TODO: Figure out how to properly constrain min/max
  const updateAdtDistributionProperty = useCallback(
    (description: string, updatedProperties: AdtDistribution) => {
      debounce(() => {
        const basicActions = selected.map(({ element, path }): BasicAction => {
          const adtDistribution: AdtDistribution = {
            ...element.properties?.trafficData?.adtDistribution,
            ...updatedProperties,
          }
          adtDistribution.nightPercentage =
            100 - (adtDistribution.dayPercentage ?? 0) - (adtDistribution.eveningPercentage ?? 0)

          return BasicElementAPI.updateProperties(path, {
            trafficData: {
              ...element.properties?.trafficData,
              adtDistribution,
            },
          })
        })

        const coreActions = BasicElementAPI.basicActionsToCoreActions(basicActions)
        ActionAPI.apply(description, coreActions, {
          elementCategory: "road",
          eventType: "update",
          numElements: selected.length,
          tool: "roadProperties",
        })
      }, DEBOUNCE_DELAY)
    },
    [ActionAPI, selected],
  )

  return (
    <div>
      <hr style={{ border: "none", height: "1px", backgroundColor: "var(--border-color-divider-light)" }}></hr>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "6px 0",
        }}
      >
        <p style={{ font: "var(--11-medium)" }}>{t(($) => $.transportation.trafficData.title)}</p>
        <div style={{ display: "grid" }}>
          {isHidden ? (
            <weave-tooltip text={t(($) => $.transportation.trafficData.addButton)} nub="down-right">
              <weave-icon-button onClick={addTrafficData}>
                <weave-solid-plus-operator slot="icon" />{" "}
              </weave-icon-button>
            </weave-tooltip>
          ) : (
            <weave-tooltip text={t(($) => $.transportation.trafficData.removeButton)} nub="down-right">
              <weave-icon-button onClick={removeTrafficData}>
                <weave-solid-minus-operator slot="icon" />
              </weave-icon-button>
            </weave-tooltip>
          )}
        </div>
      </div>
      {!isHidden && (
        <>
          {!allRequiredInputsFilled && (
            // TODO: The styling for this alert was removed accidentally in a previous commit.
            <div>{t(($) => $.transportation.trafficData.roadRequiredInputsMessage)}</div>
          )}
          <RightMenuGridPanel style={{ paddingTop: "4px" }}>
            <weave-tooltip
              text={t(($) => $.transportation.trafficData.speedLimitTooltip)}
              style={{ gridColumn: `1/2` }}
              nub="down-center"
            >
              <label className={labelClassName} htmlFor="speed" style={{ color: "var(--icon-color-medium)" }}>
                S
              </label>
            </weave-tooltip>
            <UnitInput
              {...multiValueProps(selectedSpeed, (speed) => localisedSpeed(speed, isSpeedImperial))}
              min={isSpeedImperial ? 15 : 20}
              max={isSpeedImperial ? 90 : 130}
              onBlur={(speed: number | undefined) =>
                updateTrafficDataProperty("Update speed", { speed: delocalisedSpeed(speed, isSpeedImperial) })
              }
              id="speed"
              unit={isSpeedImperial ? "mph" : "km/h"}
            />
            <weave-tooltip
              text={t(($) => $.transportation.trafficData.adtTooltip)}
              style={{ gridColumn: `4/5`, left: "-10px" }}
              nub="down-center"
            >
              <label className={labelClassName} htmlFor="adt" style={{ color: "var(--icon-color-medium)" }}>
                ADT
              </label>
            </weave-tooltip>
            <UnitInput
              {...multiValueProps(selectedAdt)}
              min={0}
              max={500000}
              style={{ gridColumn: "5/6" }}
              onBlur={(adt: number | undefined) => updateTrafficDataProperty("Update adt", { adt })}
              id="adt"
            />
            <p style={{ font: "var(--11-regular)", gridColumn: `1/6`, padding: "14px 0px 4px", cursor: "default" }}>
              {t(($) => $.transportation.trafficData.dailyDistributionLabel)}
            </p>

            <weave-tooltip
              text={t(($) => $.transportation.trafficData.dayTimeTooltip)}
              style={{ gridColumn: `1/2` }}
              nub="down-center"
            >
              <label className={labelClassName} style={{ font: "var(--11-regular)" }} htmlFor="adtDay">
                Day
              </label>
            </weave-tooltip>
            <UnitInput
              {...multiValueProps(selectedAdtDayPercentage)}
              onBlur={(dayPercentage: number | undefined) =>
                updateAdtDistributionProperty("Update adt distribution, day percentage", { dayPercentage })
              }
              id="adtDay"
              unit="%"
              min={0}
              max={selectedAdtEveningPercentage.size === 1 ? 100 - ([...selectedAdtEveningPercentage][0] || 0) : 100}
              style={{ gridColumn: `5/6` }}
            />
            <weave-tooltip
              text={t(($) => $.transportation.trafficData.eveningTimeTooltip)}
              style={{ gridColumn: `1/2` }}
              nub="down-center"
            >
              <label className={labelClassName} style={{ font: "var(--11-regular)" }} htmlFor="adtEvening">
                Evening
              </label>
            </weave-tooltip>
            <UnitInput
              {...multiValueProps(selectedAdtEveningPercentage)}
              onBlur={(eveningPercentage: number | undefined) =>
                updateAdtDistributionProperty("Update adt distribution, evening percentage", { eveningPercentage })
              }
              id="adtEvening"
              unit="%"
              min={0}
              max={selectedAdtDayPercentage.size === 1 ? 100 - ([...selectedAdtDayPercentage][0] || 0) : 100}
              style={{ gridColumn: `5/6` }}
            />
            <weave-tooltip
              text={t(($) => $.transportation.trafficData.nightTimeTooltip)}
              style={{ gridColumn: `1/2` }}
              nub="down-center"
            >
              <label className={labelClassName} style={{ font: "var(--11-regular)" }} htmlFor="adtNight">
                Night
              </label>
            </weave-tooltip>
            <UnitInput
              value={selectedAdtNightPercentageComputed}
              isMixed={selectedAdtDayPercentage.size > 1 || selectedAdtEveningPercentage.size > 1}
              id="adtNight"
              unit="%"
              style={{ gridColumn: `5/6` }}
              disabled
            />
            <p style={{ font: "var(--11-regular)", gridColumn: `1/6`, padding: "14px 0px 4px", cursor: "default" }}>
              {t(($) => $.transportation.trafficData.advancedSettingsLabel)}
            </p>
            <label
              className={labelClassName}
              style={{ font: "var(--11-regular)", gridColumn: `1/3` }}
              htmlFor="heavyTraffic"
            >
              {t(($) => $.transportation.trafficData.heavyVehicleLabel)}
            </label>
            <UnitInput
              {...multiValueProps(selectedHeavyVehiclePercentage)}
              onBlur={(heavyVehiclePercentage: number | undefined) =>
                updateTrafficDataProperty("Update heavy vehicle percentage", { heavyVehiclePercentage })
              }
              min={0}
              max={100}
              id="heavyTraffic"
              unit="%"
              style={{ gridColumn: `5/6` }}
            />
          </RightMenuGridPanel>
        </>
      )}
      <hr style={{ border: "none", height: "1px", backgroundColor: "var(--border-color-divider-light)" }}></hr>
    </div>
  )
}

export default RoadProperties
