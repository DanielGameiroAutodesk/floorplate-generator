import { round } from "./math/round"
import * as formaUnits from "@spacemakerai/forma-units"
import { UnitType } from "@spacemakerai/forma-units"
import type { Translator } from "src/i18n"

export const isOnMac = window.navigator.userAgent.toLowerCase().includes("mac")

const METER_TO_FEET = 1 / 0.3048
const FEET_TO_METER = 0.3048

export const getMaglLabel = (t: Translator, imperialFlag: boolean) => {
  return imperialFlag ? "\u00A0fagl" : t(($) => $.units.magl)
}

export const getMaslLabel = (t: Translator, imperialFlag: boolean) => {
  return imperialFlag ? "\u00A0fasl" : t(($) => $.units.masl)
}

export const numberOfDecimals = (imperialFlag: boolean, decimalsForMeters: number): number => {
  if (imperialFlag) {
    switch (decimalsForMeters) {
      case 0:
        decimalsForMeters = 0
        break
      case 1:
        decimalsForMeters = 1
        break
      default:
        decimalsForMeters = decimalsForMeters - 1
    }
  }
  return decimalsForMeters
}

export function toFeetIfImperial(meters: number, imperialFlag: boolean, decimalsForMeters = 2) {
  if (imperialFlag) {
    return round(meters * METER_TO_FEET, numberOfDecimals(imperialFlag, decimalsForMeters))
  } else {
    return round(meters, numberOfDecimals(imperialFlag, decimalsForMeters))
  }
}

export function notationToFootIfImperial(notation: string, imperialFlag: boolean) {
  let newNotation: string = notation
  if (imperialFlag) {
    switch (notation) {
      case "m":
        newNotation = "\u00A0ft"
        break
      case "magl":
        newNotation = "\u00A0fagl"
        break
      case "masl":
        newNotation = "\u00A0fasl"
        break
    }
  }

  return newNotation
}

export function formatLength(t: Translator, lengthInMeters: number, useImperialSystem: boolean) {
  if (useImperialSystem) {
    const ft = lengthInMeters * METER_TO_FEET
    const roundedToNearestInch = Math.round(ft * 12) / 12
    formaUnits.setCurrentUnitType(UnitType.ImperialFeetInches)
    return formaUnits.formatLength(roundedToNearestInch)
  }

  return `${formatFloat(t, lengthInMeters, 2)} m`
}

export function formatFloat(t: Translator, val: number, precision: number) {
  return val === undefined || val === null ? "" : parseFloat(val.toFixed(precision)).toLocaleString(t.locale)
}

export function toMetersIfImperial(length: number, imperialFlag: boolean) {
  if (imperialFlag) {
    return feetToMeter(length)
  } else {
    return length
  }
}

export function feetToMeter(feetLength: number) {
  return feetLength * FEET_TO_METER
}
export function meterToFeet(meterLength: number) {
  return meterLength / FEET_TO_METER
}
