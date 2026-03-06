import type { TreeAreaConfig } from "./area/TreeAreaGenerator"
import type { TreeLineConfig } from "./lines/TreeLinesGenerator"
import { feetToMeter, toMetersIfImperial } from "src/lib/measurementSystem"
import { metricMinDefault } from "src/lib/components/LengthInput/formaUnitUtils"
import type { VegetationInputConfig } from "./VegetationAutomationPropertyPanel"

export function defaultTreeElementConfig(imperialUnits?: boolean): { height: number; radius: number } {
  if (imperialUnits) {
    return {
      height: toMetersIfImperial(15, imperialUnits),
      radius: toMetersIfImperial(1, imperialUnits),
    }
  }

  return {
    height: 5,
    radius: 0.3,
  }
}

export function defaultTreeAreaConfig(imperialUnits?: boolean): TreeAreaConfig {
  if (imperialUnits) {
    return {
      height: defaultTreeElementConfig(imperialUnits).height,
      avgSpacing: toMetersIfImperial(15, imperialUnits),
      placeOnRoof: true,
    }
  }

  return {
    height: defaultTreeElementConfig(imperialUnits).height,
    avgSpacing: 5,
    placeOnRoof: true,
  }
}

export function defaultTreeLineConfig(imperialUnits?: boolean): TreeLineConfig {
  if (imperialUnits) {
    return {
      spacing: toMetersIfImperial(15, imperialUnits),
      offset: 0,
      height: defaultTreeElementConfig(imperialUnits).height,
      alignment: "center",
      placeOnRoof: true,
    }
  }

  return {
    spacing: 5,
    offset: 0,
    height: defaultTreeElementConfig(imperialUnits).height,
    alignment: "center",
    placeOnRoof: true,
  }
}

export const getTreeInputConfigs = (imperialUnits: boolean): VegetationInputConfig => ({
  metricAlignmentMin: metricMinDefault(imperialUnits),
  metricAlignmentMax: imperialUnits ? feetToMeter(80) : 25,
  metricAvgSpacingMin: imperialUnits ? feetToMeter(2) : 0.5,
  metricAvgSpacingMax: imperialUnits ? feetToMeter(80) : 25,
  metricHeightMin: imperialUnits ? feetToMeter(5) : 1.5,
  metricHeightMax: imperialUnits ? feetToMeter(100) : 30,
  metricInitialOffset: imperialUnits ? feetToMeter(10) : 3,
  metricStep: 0.5,
  feetStep: 1,
})
