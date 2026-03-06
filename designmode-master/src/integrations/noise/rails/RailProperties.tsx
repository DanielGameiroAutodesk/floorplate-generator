import { useCallback, useMemo } from "preact/hooks"
import useFeatureFlag, { LDFlag } from "src/lib/featureToggling"
import { labelClassName } from "src/lib/components/RightMenu/RightMenuLabel"
import noiseStyles from "src/integrations/noise/noisePanelStyles.module.pcss"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { BasicAction } from "src/integrations/basic-elements/api/types"
import { debounce, delocalisedSpeed, localisedSpeed, multiValueProps } from "src/integrations/noise/noiseUtils"
import { UnitInput } from "src/integrations/noise/UnitInput"
import { useSelectionDetails } from "src/integrations/noise/useSelectionDetails"
import styles from "src/integrations/noise/NoiseInput.module.pcss"
import type { RailTrafficData } from "@spacemakerai/element-types"
import { useTranslator } from "src/i18n"

import { RightMenuGridPanel } from "src/lib/components/RightMenu/RightMenuGridPanel"

type AdtDistribution = NonNullable<RailTrafficData["adtDistribution"]>

const defaultTrafficData: RailTrafficData = {
  adtDistribution: {
    dayPercentage: 65,
    eveningPercentage: 20,
    nightPercentage: 15,
  },
  railType: "train",
}

const DEBOUNCE_DELAY = 100

function RailProperties() {
  const selected = useSelectionDetails()

  const mixOfWithAndWithoutTrafficData = useMemo(
    () =>
      selected.some(
        (e, idx, array) =>
          idx !== 0 && !!array[idx - 1].element.properties?.trafficData !== !!e.element.properties?.trafficData,
      ),
    [selected],
  )
  const show = useMemo(
    () => selected.every((e) => e.element.properties?.category === "rails") && !mixOfWithAndWithoutTrafficData,
    [selected, mixOfWithAndWithoutTrafficData],
  )

  if (!show) return null
  return <RenderedRailTrafficProperties />
}

function RenderedRailTrafficProperties() {
  const t = useTranslator()
  const isSpeedImperial = useFeatureFlag(LDFlag.SpeedImperialUnits)

  const selected = useSelectionDetails()
  const selectedTrafficData = useMemo(() => {
    const trafficData: (RailTrafficData | undefined)[] = selected.map((s) => s.element.properties?.trafficData)
    return trafficData
  }, [selected])

  const ActionAPI = useActionAPI()

  // According to the type, trafficData may not be null! It still works because undefined == null
  // TODO: Figure out if this is a bug
  const isHidden = selectedTrafficData.some((t) => {
    return t == null
  })

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
  // The user is allowed to modify the properties of all selected rails provided ANY selected rail has traffic data.
  // Currently, if a rail without traffic data is selected and a data property is changed, it will be initialized
  // without default values.
  // TODO: Figure out the intended way to handle this case
  const updateTrafficDataProperty = useCallback(
    (description: string, updatedProperties: Partial<RailTrafficData>) => {
      debounce(() => {
        const updates = selected.map(({ element, path }): BasicAction => {
          return BasicElementAPI.updateProperties(path, {
            trafficData: { ...element.properties?.trafficData, ...updatedProperties },
          })
        })
        const coreActions = BasicElementAPI.basicActionsToCoreActions(updates)
        ActionAPI.apply(description, coreActions, {
          elementCategory: "rails",
          eventType: "update",
          numElements: selected.length,
          tool: "railProperties",
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

  const selectedRailType = useMemo(() => {
    return new Set(selectedTrafficData.map((t) => t?.railType))
  }, [selectedTrafficData])

  const selectedAdtDistribution = useMemo(() => {
    const adtDistributions: (AdtDistribution | undefined)[] = selectedTrafficData.map((data) => data?.adtDistribution)
    return adtDistributions
  }, [selectedTrafficData])

  const selectedAdtDayPercentage = useMemo(() => {
    return new Set(selectedAdtDistribution.map((percentage) => percentage?.dayPercentage))
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
        const trafficData: RailTrafficData | undefined = element.properties?.trafficData
        // TODO: Resolve null/undefined weirdness
        return trafficData == null
      })
      .map(({ path }): BasicAction => BasicElementAPI.updateProperties(path, { trafficData: defaultTrafficData }))

    const coreActions = BasicElementAPI.basicActionsToCoreActions(basicActions)
    ActionAPI.apply("Add trafficData to rails", coreActions, {
      elementCategory: "rails",
      eventType: "add",
      numElements: basicActions.length,
      tool: "railProperties",
    })
  }, [ActionAPI, selected])

  const removeTrafficData = useCallback(() => {
    const updates = selected.map(
      ({ path }): BasicAction => BasicElementAPI.updateProperties(path, { trafficData: undefined }),
    )
    const coreActions = BasicElementAPI.basicActionsToCoreActions(updates)
    ActionAPI.apply("Remove trafficData on rails", coreActions, {
      elementCategory: "rails",
      eventType: "update",
      numElements: selected.length,
      tool: "railProperties",
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
          elementCategory: "rails",
          eventType: "update",
          numElements: selected.length,
          tool: "railProperties",
        })
      }, DEBOUNCE_DELAY)
    },
    [ActionAPI, selected],
  )

  const onTypeChange = useCallback(
    (e: Event) => {
      const newType = (e as CustomEvent).detail.value
      updateTrafficDataProperty("Update traffic data", {
        railType: newType as RailTrafficData["railType"],
      })
    },
    [updateTrafficDataProperty],
  )

  const typeValue = useMemo(() => {
    return multiValueProps(selectedRailType).isMixed ? undefined : multiValueProps(selectedRailType).value
  }, [selectedRailType])

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
                <weave-solid-plus-operator slot="icon" />
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
            <div className={noiseStyles.Alerts}>{t(($) => $.transportation.trafficData.railRequiredInputsMessage)}</div>
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
              max={isSpeedImperial ? 300 : 500}
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
              htmlFor="train-type"
              className={labelClassName}
              style={{ font: "var(--11-regular)", gridColumn: `1/3` }}
            >
              {t(($) => $.transportation.railroads.typeLabel)}
            </label>
            <forma-select-native
              id="train-type"
              placeholder={t(($) => $.transportation.railroads.typePlaceholder)}
              value={typeValue}
              onChange={onTypeChange}
              className={styles.NoiseInput}
              style={{ gridColumn: `5/6`, width: "80px" }}
            >
              <option value="train" selected={typeValue === "train"}>
                Train
              </option>
              <option value="tram" selected={typeValue === "tram"}>
                Tram
              </option>
              <option value="subway" selected={typeValue === "subway"}>
                Subway
              </option>
            </forma-select-native>
          </RightMenuGridPanel>
        </>
      )}
      <hr style={{ border: "none", height: "1px", backgroundColor: "var(--border-color-divider-light)" }}></hr>
    </div>
  )
}

export default RailProperties
