import type { LevelData } from "src/integrations/wsm-tools/wsr/integrated/types"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import * as formaUnits from "@spacemakerai/forma-units"

import styled from "./FloorDetails.module.pcss"
import { useCallback, useLayoutEffect, useState } from "preact/hooks"
import { FormaFunctionDropdown } from "src/lib/components/FormaFunctionDropdown"
import { useRecoilValue } from "recoil"
import type { FunctionTag } from "src/integrations/building-systems-common/useFetchBuildingFunctions"
import { buildingFunctionsAtom } from "src/integrations/building-systems-common/useFetchBuildingFunctions"
import FloorMoreMenu from "./FloorMoreMenu"
import { PROJECT_ID } from "src/core/project/project"
import { useIsImperial } from "src/lib/unitSettings"

type Props = {
  details: LevelData[]
  onChange: (value: string, index: number) => void
  onDelete: (index: number) => void
}

const FloorDetails = ({ details, onChange, onDelete }: Props) => {
  const functionTags = useRecoilValue(buildingFunctionsAtom)
  const functionTagsMap: Record<string, FunctionTag> = functionTags.reduce((p, c) => ({ ...p, [c.id]: c }), {})
  const isImperial = useIsImperial()
  // Used to revert values if user input is invalid or <= 0
  const [internalValues, setInternalValues] = useState<number[]>([])

  const unitType = isImperial ? formaUnits.UnitType.ImperialFeetInches : formaUnits.UnitType.MetricMeter
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null)

  const handleMoreMenuOpen = (index: number) => {
    setOpenMenuIndex(index)
  }

  const handleMoreMenuClose = () => {
    setOpenMenuIndex(null)
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, index: number) => {
      const inputEl = e.target as HTMLInputElement
      if (e.key === "Enter") {
        inputEl.blur()
      }
      if (e.key === "Escape") {
        inputEl.value = String(details[index].floorHeight!)
        inputEl.blur()
      }
    },
    [details],
  )

  // Set interval values if details property changes
  useLayoutEffect(() => {
    setInternalValues(details.map((detail) => detail.floorHeight ?? 0))
  }, [details])

  return (
    <ul className={styled.FloorHeightContainer}>
      {details.map((detail, index) => {
        return (
          <li className={styled.FloorHeightDetail} key={index}>
            <div className={styled.TitleWrapper} title={functionTagsMap[detail.floorFunction ?? "unspecified"]?.name}>
              <FormaFunctionDropdown
                projectId={PROJECT_ID}
                canEdit={false}
                setBuildingFunction={() => {}}
                selectedBuildingFunctions={[{ functionId: detail.floorFunction ?? "unspecified" }]}
                showDotsOnly={true}
              />
              {detail.first}
            </div>
            <weave-input
              className={styled.weaveInput}
              value={formaUnits.formatLengthAs(internalValues[index], unitType, { decimalPlaces: 2 })}
              type="text"
              unit={" "}
              onFocus={(e: FocusEvent) => {
                const inputEl = (e.target as WeaveInputElement).inputEl!
                inputEl.select()
              }}
              onBlur={(e: FocusEvent) => {
                const inputEl = (e.target as WeaveInputElement).inputEl!
                const newValue = parseFloat(inputEl.value)
                // If the new value is invalid or <= 0
                if (!formaUnits.isValidString(inputEl.value) || newValue <= 0) {
                  // Reset to internal values
                  setInternalValues([...internalValues])
                } else {
                  onChange(inputEl.value, index)
                  // Else update internal value
                  formaUnits.setCurrentUnitType(unitType)
                  formaUnits.runWithUnit(unitType, () => {
                    setInternalValues(
                      internalValues.map((val, i) => (i === index ? formaUnits.parseLength(inputEl.value) : val)),
                    )
                  })
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={index !== 0 && index === details.length - 1}
            />
            <div className={styled.ActionWrapper}>
              {index > 0 ? (
                <FloorMoreMenu
                  level={index}
                  onDelete={onDelete}
                  isOpen={openMenuIndex === index}
                  onOpen={() => handleMoreMenuOpen(index)}
                  onClose={handleMoreMenuClose}
                />
              ) : (
                <div className={styled.Placeholder}></div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default FloorDetails
