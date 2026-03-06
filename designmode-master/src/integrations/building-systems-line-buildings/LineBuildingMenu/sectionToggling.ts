import type {
  Feature,
  SectionProps,
} from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"

export function getUpdatedSectionPropsOnToggleOff(sectionProps: SectionProps) {
  const numberOfFloorsCounter: { [key: string]: number } = {}
  for (let sectionId of Object.keys(sectionProps)) {
    const numberOfFloors = sectionProps[sectionId].numberOfFloors.toString()
    if (!numberOfFloorsCounter[numberOfFloors]) numberOfFloorsCounter[numberOfFloors] = 0
    numberOfFloorsCounter[numberOfFloors] += 1
  }
  let mostCommonNumberOfFloors = 1
  let maxCount = 0
  for (let numberOfFloorsKey of Object.keys(numberOfFloorsCounter)) {
    const count = numberOfFloorsCounter[numberOfFloorsKey]
    const numberOfFloors = parseInt(numberOfFloorsKey)
    if (count > maxCount || (count === maxCount && numberOfFloors < mostCommonNumberOfFloors)) {
      mostCommonNumberOfFloors = numberOfFloors
      maxCount = count
    }
  }
  const featureCounter: { [key: string]: number } = {
    Empty: 0,
    Circulation: 0,
  }
  const corridorAlignmentCounter = { left: 0, center: 0, right: 0 }
  const corridorWidthCounter: { [width: string]: number } = {}
  for (let sectionId of Object.keys(sectionProps)) {
    const feature = sectionProps[sectionId].feature
    if (feature?.name === "Circulation") {
      featureCounter["Circulation"] += 1
      const corridorAlignment: "left" | "right" | "center" = feature.settings.corridorAlignment.value
      corridorAlignmentCounter[corridorAlignment] += 1
      const corridorWidth: number = feature.settings.corridorWidth.value
      if (!corridorWidthCounter[corridorWidth]) corridorWidthCounter[corridorWidth] = 0
      corridorWidthCounter[corridorWidth] += 1
    } else {
      featureCounter["Empty"] += 1
    }
  }
  let feature: Feature | undefined = undefined
  if (featureCounter["Circulation"] > featureCounter["Empty"]) {
    const maCorridorAlignmentCount = Math.max(...Object.values(corridorAlignmentCounter))
    const corridorAlignment = (["left", "center", "right"] as const).find((corridorAlignment) => {
      return corridorAlignmentCounter[corridorAlignment] === maCorridorAlignmentCount
    }) as "left" | "right" | "center"
    let mostCommonCorridorWidth = 2
    let maxCount = 0
    for (let corridorWidthKey of Object.keys(corridorWidthCounter)) {
      const count = corridorWidthCounter[corridorWidthKey]
      const corridorWidth = parseInt(corridorWidthKey)
      if (count > maxCount || (count === maxCount && corridorWidth < mostCommonCorridorWidth)) {
        mostCommonCorridorWidth = corridorWidth
        maxCount = count
      }
    }
    feature = {
      name: "Circulation",
      settings: {
        corridorAlignment: { value: corridorAlignment },
        corridorWidth: { value: mostCommonCorridorWidth },
      },
    }
  }
  return { feature, numberOfFloors: mostCommonNumberOfFloors }
}
