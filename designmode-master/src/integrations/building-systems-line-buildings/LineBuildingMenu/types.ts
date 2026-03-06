export type SectionSelection = {
  allSectionIds: string[]
  activeSectionIds: string[]
  selectedSectionIds: string[] | undefined
  fullSelection: boolean
  unSectioned: boolean
}
export type RectangleSection = { sectionType: "Rectangle"; width: number; length: number }
export type SplitSection = { sectionType: "Split" }
export type CornerSection = { sectionType: "Corner"; startLeg: number; endLeg: number; width: number; angle: number }
export type DrawSetting = RectangleSection | CornerSection | SplitSection
