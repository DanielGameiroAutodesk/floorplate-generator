import { toFeetIfImperial } from "src/lib/measurementSystem"
import * as formaUnits from "@spacemakerai/forma-units"
import { UnitType } from "@spacemakerai/forma-units"
import type { Section } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"
import type { DrawSetting } from "./types"

function isLengthRounded(length: number, imperialFlag: boolean = false) {
  const localLength = parseFloat(toFeetIfImperial(length, imperialFlag, 10).toFixed(12))
  const roundedLength = parseFloat(toFeetIfImperial(length, imperialFlag).toFixed(12))
  return roundedLength !== localLength
}

export function getDrawSettingIdForSection(section: Section, width: number) {
  const drawSetting = getDrawSettingFromSection(section, width)
  return drawSetting ? getDrawSettingId(drawSetting) : undefined
}

export function getDrawSettingId(drawSetting: DrawSetting) {
  if (drawSetting.sectionType === "Corner") {
    const { startLeg, endLeg, width, angle } = drawSetting
    return `Corner:startLeg=${startLeg}:endLeg=${endLeg}:width=${width}:angle=${angle}`
  }
  if (drawSetting.sectionType === "Split") {
    return "Split"
  }
  const { width, length } = drawSetting
  return `rectangle:${width}x${length}`
}

export function getDrawSettingButtonTitle(drawSetting: DrawSetting, imperialFlag: boolean = false) {
  if (drawSetting.sectionType === "Corner") {
    return "Corner"
  }
  if (drawSetting.sectionType === "Split") {
    return "Split"
  }
  const { width, length } = drawSetting

  if (imperialFlag) {
    const feetInchesWidth = formaUnits.formatMetricLengthAs(width, UnitType.ImperialFeetInches)
    const feetInchesLength = formaUnits.formatMetricLengthAs(length, UnitType.ImperialFeetInches)

    return `${feetInchesWidth}x${feetInchesLength}`
  }

  /* TODO: Cleanup this? */
  const localWidth = parseFloat(toFeetIfImperial(width, imperialFlag, 10).toFixed(12))
  const localRoundedLength = parseFloat(toFeetIfImperial(length, imperialFlag).toFixed(12))

  if (isLengthRounded(length, imperialFlag)) {
    return `${localWidth}x~${localRoundedLength}`
  }

  return `${localWidth}x${localRoundedLength}`
}

export function corridorSideSwitchedAfterNormalization(section: Section): boolean {
  if (section?.sectionType !== "Corner") return false
  if (section?.angle === undefined) {
    return false
  }
  // Line buildings carry a number of floor plans within lineBuildingParameters.customLayouts, that
  // are interchangeable across the line building's different sections with the same shape (modulo
  // rotating/flipping). This "normalization" of section shapes is done by getDrawSettingFromSection
  // below. For corner sections, the convention is that the start leg should be the longest one, and
  // that the turn angle should be positive. Hence, of the four different corner sections below,
  // they would all normalize to the same 'DrawSetting' that is equivalent to #1:
  //
  //  1. Left-turn with long start leg              1.  \\      2.     //
  //  2. Left-turn with short start leg                  \\//       \\//
  //
  //  3. Right-turn with long start leg             3.   //\\   4.  //\\
  //  4. Right-turn with short start leg                //             \\
  //
  // Given e.g. a corridor specified to be on the "left" side of the line building (i.e. top side of
  // 1 and 2), this works interchangeably between 1 and 2. However, for 3 and 4, the corridor ends
  // up on the wrong side. For right-turning corners (negative angles), we thus need to render the
  // corridor into the floor plan on the _opposite_ side of that specified in the section properties
  return section?.angle < 0
}

export function getDrawSettingFromSection(section: Section, width: number): DrawSetting | undefined {
  const cutWidth = parseFloat(width.toFixed(10))
  if (section?.sectionType === "Rectangle") {
    const cutLength = parseFloat(section.length.toFixed(8))
    return { sectionType: "Rectangle", width: cutWidth, length: cutLength }
  }
  if (section?.sectionType === "Split") {
    return { sectionType: "Split" }
  }
  if (section?.sectionType === "Corner") {
    if (section?.startLeg === undefined || section?.endLeg === undefined || section?.angle === undefined) {
      return undefined
    }
    const cutStartLeg = parseFloat(section.startLeg.toFixed(8))
    const cutEndLeg = parseFloat(section.endLeg.toFixed(8))
    const cutAngle = parseFloat(section.angle.toFixed(8))
    const positiveAngle = Math.abs(cutAngle)
    if (cutStartLeg >= cutEndLeg) {
      return {
        sectionType: "Corner",
        startLeg: cutStartLeg,
        endLeg: cutEndLeg,
        width: cutWidth,
        angle: positiveAngle,
      }
    } else {
      return {
        sectionType: "Corner",
        startLeg: cutEndLeg,
        endLeg: cutStartLeg,
        width: cutWidth,
        angle: positiveAngle,
      }
    }
  }
  return undefined
}

export function getSortedDrawSettings(drawSetting: DrawSetting[], imperialFlag: boolean = false) {
  return [...drawSetting].sort((drawSettingA, drawSettingB) => {
    if (drawSettingA.sectionType === "Rectangle" && drawSettingB.sectionType !== "Rectangle") return -1
    if (drawSettingA.sectionType !== "Rectangle" && drawSettingB.sectionType === "Rectangle") return 1
    if (drawSettingA.sectionType === "Rectangle" && drawSettingB.sectionType === "Rectangle") {
      const isARounded = isLengthRounded(drawSettingA.length, imperialFlag)
      const isBRounded = isLengthRounded(drawSettingB.length, imperialFlag)
      if (isARounded && !isBRounded) return 1
      if (!isARounded && isBRounded) return -1
      return drawSettingA.length > drawSettingB.length ? -1 : 1
    }

    if (drawSettingA.sectionType === "Corner" && drawSettingB.sectionType === "Split") return -1
    if (drawSettingA.sectionType === "Split" && drawSettingB.sectionType === "Corner") return 1

    return 0
  })
}
