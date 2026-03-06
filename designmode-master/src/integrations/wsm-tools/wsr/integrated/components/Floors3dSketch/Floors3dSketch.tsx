import { useCallback, useMemo } from "preact/hooks"
import { useTranslator } from "src/i18n"
import {
  generateCustomWSMLevelData,
  getDMFloorHeightInfo,
  getZValuesInFeetFromObjectBox,
  updateWSMElevationsBasedOnDMFloorHeights,
} from "src/integrations/wsm-tools/wsr/integrated/utils/levelsData"

import styled from "./Floors3dSketch.module.pcss"
import FloorDetails from "./FloorDetails"
import { useRecoilValue } from "recoil"
import { Analytics } from "src/core/analytics"
import { wsmChangedSelector, wsmDefaultFloorHeightInFeet } from "src/integrations/wsm-tools/wsr/integrated/state"
import {
  addWSMLevelDataToWSMInstance,
  addLevelsToInstance,
  removeLevels,
  removeLevel,
  renameLevels,
} from "src/integrations/wsm-tools/building/buildingFloorUtils"
import {
  getParamsToGenerateWSMLevelsData,
  getFirstObjectAndHistoryIdFromGIP,
  convertDMUnitsToFeet,
  fetchAndUpdateLevelDataFromGIP,
  convertFeetToDMUnits,
} from "src/integrations/wsm-tools/wsr/integrated/utils"
import FloorDetailsContainer from "./FloorDetailsContainer"
import * as formaUnits from "@spacemakerai/forma-units"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import type { InternalPath } from "src/lib/element/path"
import { elementState } from "src/core/elements/ElementState"
import { useIsImperial } from "src/lib/unitSettings"
import { UnitType } from "src/integrations/wsm-tools/wsr/integrated/utils/enums"

const Floors3dSketch = ({ editPath }: { editPath?: InternalPath }) => {
  const t = useTranslator()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isChanged = useRecoilValue(wsmChangedSelector)
  const isImperial = useIsImperial()
  const unitType = isImperial ? UnitType.Feet : UnitType.Meter

  const defaultFloorHeightInFeet = wsmDefaultFloorHeightInFeet(isImperial)
  const defaultFloorHeightDM = convertFeetToDMUnits(defaultFloorHeightInFeet, isImperial)
  const groupInstancePath = FormIt.GroupEdit.GetInContextEditingPath()
  const { historyId, objectId } = getFirstObjectAndHistoryIdFromGIP(groupInstancePath)
  const { minZValue, maxZValue } = getZValuesInFeetFromObjectBox(objectId)
  const isValid = minZValue < maxZValue
  const buildingHeightInFeet = isValid ? maxZValue - minZValue : 0
  const snapshot = elementState.currentSnapshot.value
  const wsmLevelData = fetchAndUpdateLevelDataFromGIP(
    snapshot,
    groupInstancePath,
    isImperial,
    buildingHeightInFeet,
    defaultFloorHeightInFeet,
    editPath,
  )
  const {
    floorHeightDM,
    floorQuantity,
    overallFloorHeightDM,
    areFloorHeightsEqual,
    formattedFloorHeightDM,
    canAddFloors,
    floorHeightInFeet,
  } = useMemo(
    () => getDMFloorHeightInfo(objectId, wsmLevelData, defaultFloorHeightInFeet, isImperial),
    [defaultFloorHeightInFeet, isImperial, objectId, wsmLevelData],
  )

  const applyFloorHeightValue = useCallback(
    (value?: number) => {
      let floorHeightToUseDM = value ?? floorHeightDM
      if (floorHeightToUseDM > overallFloorHeightDM) {
        floorHeightToUseDM = overallFloorHeightDM
      }

      const count = Math.floor(overallFloorHeightDM / floorHeightToUseDM)
      const { level, nextFloorElevationInFeet } = getParamsToGenerateWSMLevelsData(
        "height",
        defaultFloorHeightInFeet,
        wsmLevelData,
      )
      const newLevelsData = generateCustomWSMLevelData(
        count,
        level,
        nextFloorElevationInFeet,
        convertDMUnitsToFeet(floorHeightToUseDM, isImperial),
      )

      addWSMLevelDataToWSMInstance(historyId, objectId, newLevelsData)
    },
    [defaultFloorHeightInFeet, floorHeightDM, historyId, isImperial, objectId, overallFloorHeightDM, wsmLevelData],
  )

  const handleKeyDown = useCallback((e: KeyboardEvent, defaultValue: string) => {
    const input = e?.target as HTMLInputElement
    if (e.key === "Enter") {
      input.blur()
    } else if (e.key === "Escape") {
      input.value = defaultValue
      input.blur()
    }
  }, [])

  // This updates the floor/level height at the specific position (index) of the level data array
  const onFloorDetailChange = useCallback(
    (strValue: string, position: number) => {
      if (!formaUnits.isValidString(strValue)) return
      const value = formaUnits.parseLength(strValue)
      if (value > overallFloorHeightDM) {
        applyFloorHeightValue(value)
        return
      }

      if (wsmLevelData.length > position) {
        wsmLevelData[position].floorHeight = value
      }

      updateWSMElevationsBasedOnDMFloorHeights(buildingHeightInFeet, wsmLevelData, isImperial, defaultFloorHeightInFeet)

      // Check if modifying top (remainder) floor
      if (position === 0 && wsmLevelData.length === 1) {
        // Get floor height sum
        const floorHeightSumDM = wsmLevelData.reduce((p, c) => (p += c.floorHeight ?? 0), 0)
        // Create remainder floor if total floor heights does not equal building height
        if (floorHeightSumDM !== overallFloorHeightDM) {
          const lastFloor = wsmLevelData[wsmLevelData.length - 1]
          const remainderFloorElevationFeet =
            lastFloor.second + convertDMUnitsToFeet(lastFloor.floorHeight ?? 0, isImperial)
          const remainderFloor = generateCustomWSMLevelData(
            1,
            wsmLevelData.length + 1,
            remainderFloorElevationFeet,
            0,
          )?.[0]
          if (remainderFloor) wsmLevelData.push(remainderFloor)
        }
      }

      addWSMLevelDataToWSMInstance(historyId, objectId, wsmLevelData)
    },
    [
      overallFloorHeightDM,
      wsmLevelData,
      buildingHeightInFeet,
      isImperial,
      historyId,
      objectId,
      applyFloorHeightValue,
      defaultFloorHeightInFeet,
    ],
  )

  // Updates level data to the new quantity of floors compared to the existing # of floors
  const applyFloorQuantityValue = useCallback(
    (value?: number) => {
      let heightInFeet = floorHeightInFeet ?? defaultFloorHeightInFeet
      const quantity = value ?? floorQuantity ?? wsmLevelData.length

      if (quantity < wsmLevelData.length) {
        const newLevelsData = wsmLevelData.slice(0, quantity)
        addWSMLevelDataToWSMInstance(historyId, objectId, newLevelsData)
        return
      }
      const count = quantity - wsmLevelData.length
      const { level, nextFloorElevationInFeet } = getParamsToGenerateWSMLevelsData(
        "quantity",
        defaultFloorHeightInFeet,
        wsmLevelData,
      )
      // Reset floor heights if projected floor height total will be larger than building height
      if (heightInFeet * quantity > buildingHeightInFeet) {
        heightInFeet = defaultFloorHeightInFeet
        wsmLevelData.forEach((l) => (l.floorHeight = defaultFloorHeightDM))
      }
      const newWSMLevelsDataToAdd = generateCustomWSMLevelData(count, level, nextFloorElevationInFeet, heightInFeet)
      const newWSMLevelsData = [...wsmLevelData, ...newWSMLevelsDataToAdd]
      addWSMLevelDataToWSMInstance(historyId, objectId, newWSMLevelsData)
    },
    [
      buildingHeightInFeet,
      defaultFloorHeightDM,
      defaultFloorHeightInFeet,
      floorHeightInFeet,
      floorQuantity,
      historyId,
      objectId,
      wsmLevelData,
    ],
  )

  const handleReset = useCallback(() => {
    FormIt.UndoManagement.BeginState()
    removeLevels(historyId, objectId)
    addLevelsToInstance(historyId, objectId, defaultFloorHeightInFeet)
    FormIt.UndoManagement.EndState("handleReset")
    Analytics.trackSelectTool("3dSketch", "Reset Floors", "right_panel", "design-tool")
  }, [defaultFloorHeightInFeet, historyId, objectId])

  const handleRemove = useCallback(() => {
    removeLevels(historyId, objectId)
    Analytics.trackSelectTool("3dSketch", "Remove Floors", "right_panel", "design-tool")
  }, [historyId, objectId])

  const handleFloorDelete = useCallback(
    (index: number) => {
      FormIt.UndoManagement.BeginState()
      removeLevel(historyId, objectId, index)
      renameLevels(historyId, objectId)
      FormIt.UndoManagement.EndState("handleFloorDelete")
      Analytics.trackSelectTool("3dSketch", "Remove Floor", "right_panel", "design-tool")
    },
    [historyId, objectId],
  )

  const handleFloorHeightUpdate = useCallback(
    (e: FocusEvent) => {
      const input = e?.target as HTMLInputElement
      if (!formaUnits.isValidString(input.value)) return
      const value = formaUnits.parseLength(input.value)
      if (value != floorHeightDM) applyFloorHeightValue(value)
      else input.value = formattedFloorHeightDM
    },
    [applyFloorHeightValue, floorHeightDM, formattedFloorHeightDM],
  )

  const handleFloorQuantityUpdate = useCallback(
    (e: FocusEvent) => {
      const input = e?.target as HTMLInputElement
      const value = parseInt(input.value)
      if (isNaN(value) || value < 1 || value == floorQuantity) {
        input.value = String(floorQuantity)
        return
      }
      applyFloorQuantityValue(value)
    },
    [applyFloorQuantityValue, floorQuantity],
  )

  const handleAddFloor = useCallback(
    () => applyFloorQuantityValue(floorQuantity + 1),
    [applyFloorQuantityValue, floorQuantity],
  )

  if (!wsmLevelData.length || !isValid) {
    return null
  }

  return (
    <div className={styled.FloorHeightContainer}>
      <hr className={styled.Divider} />
      <div className={styled.TitleContainer}>
        <span className={styled.HeaderTitle}>{t(($) => $.wsm.floors.floors)}</span>

        <div className={styled.ActionContainer}>
          <weave-tooltip text={t(($) => $.wsm.floors.resetFloors)} nub="down-center">
            <button className={styled.ActionButton} onClick={handleReset}>
              <forma-refresh-16 />
            </button>
          </weave-tooltip>
          <weave-tooltip text={t(($) => $.wsm.floors.removeFloors)} nub="down-right">
            <button className={styled.ActionButton} onClick={handleRemove}>
              <forma-trash-16 />
            </button>
          </weave-tooltip>
        </div>
      </div>
      <div className={styled.Header}>
        <div className={styled.InputContainer}>
          <weave-tooltip text={t(($) => $.wsm.floors.numberOfFloors)} nub="down-center">
            <div className={styled.IconWrapper}>
              <forma-floor-quantity-14 />
            </div>
          </weave-tooltip>
          <weave-input
            value={floorQuantity}
            type="number"
            min={1}
            onKeyDown={(e: KeyboardEvent) => handleKeyDown(e, String(floorQuantity))}
            onFocus={(e: FocusEvent) => (e.target as WeaveInputElement).inputEl!.select()}
            onBlur={handleFloorQuantityUpdate}
          />
        </div>
        <div className={styled.InputContainer}>
          <weave-tooltip text={t(($) => $.wsm.floors.floorHeight)} nub="down-center">
            <div className={styled.IconWrapper}>
              <forma-floor-height-16 />
            </div>
          </weave-tooltip>
          {(areFloorHeightsEqual || wsmLevelData.length === 1) && (
            <weave-input
              value={formattedFloorHeightDM}
              type="text"
              onKeyDown={(e: KeyboardEvent) => handleKeyDown(e, formattedFloorHeightDM)}
              onFocus={(e: FocusEvent) => (e.target as WeaveInputElement).inputEl!.select()}
              onBlur={handleFloorHeightUpdate}
            />
          )}
          {!areFloorHeightsEqual && wsmLevelData.length > 1 && (
            <weave-input value={t(($) => $.wsm.properties.mixed)} unit={unitType} type="text" disabled />
          )}
        </div>
      </div>

      <div className={styled.Body}>
        <FloorDetailsContainer
          title={t(($) => $.wsm.floors.title)}
          handleAddFloor={canAddFloors ? handleAddFloor : undefined}
        >
          <FloorDetails details={wsmLevelData} onChange={onFloorDetailChange} onDelete={handleFloorDelete} />
        </FloorDetailsContainer>
      </div>
    </div>
  )
}

export default Floors3dSketch
