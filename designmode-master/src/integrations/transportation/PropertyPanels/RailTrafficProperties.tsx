import { useCallback, useMemo } from "preact/hooks"
import useFeatureFlag, { LDFlag } from "src/lib/featureToggling"
import { labelClassName } from "src/lib/components/RightMenu/RightMenuLabel"
import { delocalisedSpeed, localisedSpeed, multiValueProps } from "src/integrations/noise/noiseUtils"
import { UnitInput } from "src/integrations/noise/UnitInput"
import type { RailTrafficData } from "@spacemakerai/element-types"
import { useTranslator } from "src/i18n"

import { RightMenuGridPanel } from "src/lib/components/RightMenu/RightMenuGridPanel"
import transportationApi, { type TransportationElement } from "src/integrations/transportation/lib/transportationApi"
import { elementState } from "src/core/elements/ElementState"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { ElementContainer } from "src/core/elements/ElementContainer"
import styles from "./NoiseInput.module.pcss"

type AdtDistribution = NonNullable<RailTrafficData["adtDistribution"]>

const defaultTrafficData: RailTrafficData = {
  adtDistribution: {
    dayPercentage: 84,
    eveningPercentage: 10,
    nightPercentage: 6,
  },
  railType: "train",
}

function RailTrafficProperties({ selectedRailNodes }: { selectedRailNodes: ChildNodeContainer[] }) {
  const t = useTranslator()
  const isSpeedImperial = useFeatureFlag(LDFlag.SpeedImperialUnits)
  const contextRoot = scenarioModeSignal.value ? "base" : "proposal"
  const selectedTrafficData = useMemo(() => {
    return selectedRailNodes.map((elm) => elm.element.properties?.trafficData as RailTrafficData)
  }, [selectedRailNodes])

  const isHidden = useMemo(() => {
    return selectedTrafficData.every((data) => data === undefined)
  }, [selectedTrafficData])

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

  const addTrafficData = useCallback(() => {
    //TODO  Any analysis should be done here?
    const { child, element, elementContainer } = selectedRailNodes[0]
    if (child !== undefined && element !== undefined && elementContainer !== undefined) {
      const updatedElement = transportationApi.updateGenericProperties(element as TransportationElement, {
        trafficData: defaultTrafficData,
      })

      const updatedContainer = ElementContainer.fromDraftElement(updatedElement, undefined, {
        ...elementContainer.representations,
      })

      elementState.edit(({ updateElement }) => {
        updateElement(contextRoot, { ...child, urn: updatedContainer.element.urn }, updatedContainer)
      })
    }
  }, [contextRoot, selectedRailNodes])
  const removeTrafficData = useCallback(() => {
    const updatedElementContainers = selectedRailNodes.map((node) => {
      const element = node.element as TransportationElement
      const updatedElement = transportationApi.updateGenericProperties(element, { trafficData: undefined })

      const updatedContainer = ElementContainer.fromDraftElement(updatedElement, undefined, {
        ...node.elementContainer.representations,
      })
      return {
        elmContainer: updatedContainer,
        child: { ...node.child, urn: updatedContainer.element.urn },
      }
    })
    updatedElementContainers.forEach((elm) => {
      elementState.edit(({ updateElement }) => {
        updateElement(contextRoot, elm.child, elm.elmContainer)
      })
    })
  }, [contextRoot, selectedRailNodes])
  const updateTrafficDataProperty = useCallback(
    (description: string, updatedProperties: Partial<RailTrafficData>) => {
      console.log(description)
      selectedRailNodes.forEach(({ element, child, elementContainer }) => {
        elementState.edit(({ updateElement }) => {
          const updatedTrafficData = { trafficData: { ...element.properties?.trafficData, ...updatedProperties } }
          const updatedElement = transportationApi.updateGenericProperties(
            element as TransportationElement,
            updatedTrafficData,
          )
          const updatedContainer = ElementContainer.fromDraftElement(updatedElement, undefined, {
            ...elementContainer.representations,
          })
          updateElement(contextRoot, { ...child, urn: updatedElement.urn }, updatedContainer)
        })
      })
    },
    [contextRoot, selectedRailNodes],
  )

  const updateAdtDistributionProperty = useCallback(
    (description: string, updatedProperties: AdtDistribution) => {
      //TODO  Any analysis should be done here?
      const updatedElementContainers = selectedRailNodes.map((node) => {
        const element = node.element as TransportationElement
        //TODO move this into noise specific code
        const adtDistribution: AdtDistribution = {
          ...element.properties?.trafficData?.adtDistribution,
          ...updatedProperties,
        }
        adtDistribution.nightPercentage =
          100 - (adtDistribution.dayPercentage ?? 0) - (adtDistribution.eveningPercentage ?? 0)
        const updatedTrafficData = {
          trafficData: { ...element.properties?.trafficData, adtDistribution: adtDistribution },
        }
        const updatedElement = transportationApi.updateGenericProperties(element, updatedTrafficData)
        const updatedContainer = ElementContainer.fromDraftElement(updatedElement, undefined, {
          ...node.elementContainer.representations,
        })
        return {
          updatedContainer,
          child: { ...node.child, urn: updatedContainer.element.urn },
        }
      })
      updatedElementContainers.forEach((elm) => {
        elementState.edit(({ updateElement }) => {
          updateElement(contextRoot, elm.child, elm.updatedContainer)
        })
      })
    },
    [contextRoot, selectedRailNodes],
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
            <div className={styles.Alerts}>{t(($) => $.transportation.trafficData.railRequiredInputsMessage)}</div>
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
            <p
              style={{
                font: "var(--11-regular)",
                gridColumn: `1/6`,
                padding: "14px 0px 4px",
                cursor: "default",
              }}
            >
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
            <p
              style={{
                font: "var(--11-regular)",
                gridColumn: `1/6`,
                padding: "14px 0px 4px",
                cursor: "default",
              }}
            >
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

export default RailTrafficProperties
