import initial from "lodash/initial"
import uniqBy from "lodash/uniqBy"
import { getTranslator, type I18nStringProvider } from "src/i18n"
import type { LevelData } from "src/integrations/wsm-tools/wsr/integrated/types"
import { convertDMUnitsToFeet, convertFeetToDMUnits } from "src/integrations/wsm-tools/wsr/integrated/utils"
import { round } from "@spacemakerai/forma-units"
import { WSM_MACHINE_TOL } from "src/integrations/wsm-tools/wsr/api/types"
// import { formatFloat } from "../../../../../lib/measurementSystem"
import * as formaUnits from "@spacemakerai/forma-units"

// Generate the value and name for new level data
export const generateCustomWSMLevelData = (
  count: number,
  level: number,
  nextFloorElevationInFeet: number,
  floorHeightInFeet: number,
): LevelData[] => {
  const t = getTranslator()
  const wsmLevelsData: LevelData[] = []
  while (wsmLevelsData.length < count) {
    const levelHeight = nextFloorElevationInFeet
    const levelData: LevelData = {
      first: t(($) => $.wsm.floors.floorWithNumberLabel, { level }),
      second: levelHeight,
    }
    wsmLevelsData.push(levelData)
    nextFloorElevationInFeet += floorHeightInFeet
    level++
  }
  return wsmLevelsData
}

// Update wsm elevations using floor heights. Remove level
// data above the building height and make sure the top
// floor is at least defaultFloorHeightInFeet in height.
export const updateWSMElevationsBasedOnDMFloorHeights = (
  buildingHeightInFeet: number,
  wsmLevelData: LevelData[],
  isImperial: boolean,
  defaultFloorHeightInFeet: number,
) => {
  let currentFloor = 0
  let nextLevelElevationInFeet = 0

  // Calc elevation based on floor heights. Stop once the next floor is too short.
  while (
    wsmLevelData.length > currentFloor &&
    wsmLevelData[currentFloor].floorHeight! > WSM_MACHINE_TOL &&
    nextLevelElevationInFeet < buildingHeightInFeet - defaultFloorHeightInFeet + WSM_MACHINE_TOL
  ) {
    if (wsmLevelData[currentFloor].floorHeight) {
      wsmLevelData[currentFloor].second = nextLevelElevationInFeet
      nextLevelElevationInFeet += convertDMUnitsToFeet(wsmLevelData[currentFloor].floorHeight!, isImperial)
    }
    currentFloor++
  }

  if (currentFloor < wsmLevelData.length) {
    wsmLevelData.splice(currentFloor)
  }
}

export const getObjectName = (objectId: number): I18nStringProvider => {
  return (t) => t(($) => $.wsm.properties.objectWithIdLabel, { id: objectId })
}

// Helper function to get max and min z values from an object in the main history.
export const getZValuesInFeetFromObjectBox = (objectId: number) => {
  const mainHistoryId = FormIt.Model.GetHistoryID()
  const instanceBox = WSM.APIGetBoxReadOnly(mainHistoryId, objectId)
  const {
    lower: { z: minZValue },
    upper: { z: maxZValue },
  } = instanceBox

  return { minZValue, maxZValue }
}

export function getDMFloorHeightInfo(
  objectId: number,
  levelsData: LevelData[],
  defaultFloorHeightInFeet: number,
  isImperial: boolean,
) {
  // Make sure the imperial or metric unit type is set
  const unit = isImperial ? formaUnits.UnitType.ImperialFeetInches : formaUnits.UnitType.MetricMeter
  const { minZValue, maxZValue } = getZValuesInFeetFromObjectBox(objectId)
  const buildingHeightInFeet = maxZValue - minZValue
  const overallFloorHeightDM = convertFeetToDMUnits(buildingHeightInFeet, isImperial)

  const floorHeightsWithOutLastOne = initial(levelsData)
  const areFloorHeightsEqual = uniqBy(floorHeightsWithOutLastOne, (x) => round(x.floorHeight!, 2)).length === 1

  const { floorHeightDM, floorHeightInFeet } = getFloorHeightDMFromLevelData(
    levelsData,
    defaultFloorHeightInFeet,
    isImperial,
  )

  const floorQuantity = levelsData.length

  const roundedOverallFloorHeightDM = formaUnits.formatLengthAs(overallFloorHeightDM, unit, { decimalPlaces: 2 })

  const formattedFloorHeightDM = formaUnits.formatLengthAs(floorHeightDM, unit, { decimalPlaces: 2 })

  const canAddFloors =
    floorQuantity && levelsData[levelsData.length - 1].floorHeight! - floorHeightDM >= floorHeightDM - WSM_MACHINE_TOL
  return {
    floorHeightDM,
    floorQuantity,
    overallFloorHeightDM,
    roundedOverallFloorHeightDM,
    areFloorHeightsEqual,
    floorHeightInFeet,
    formattedFloorHeightDM,
    canAddFloors,
  }
}

// Get the floor height common to all the levels, or fallback to default
export function getFloorHeightDMFromLevelData(
  levelsData: LevelData[],
  defaultFloorHeightInFeet: number,
  isImperial: boolean,
) {
  const floorHeightsWithOutLastOne = initial(levelsData)
  const areFloorHeightsEqual =
    floorHeightsWithOutLastOne.length > 1 &&
    uniqBy(floorHeightsWithOutLastOne, (x) => round(x.floorHeight!, 2)).length === 1

  const floorHeightDM =
    (levelsData.length === 1 || (levelsData.length > 0 && areFloorHeightsEqual)) && levelsData[0].floorHeight
      ? levelsData[0].floorHeight
      : convertFeetToDMUnits(defaultFloorHeightInFeet, isImperial)

  const floorHeightInFeet = convertDMUnitsToFeet(floorHeightDM, isImperial)

  return { floorHeightDM, floorHeightInFeet }
}
