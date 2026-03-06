import type { Category } from "src/core/categories"
import type { FunctionComponent } from "preact"
import styles from "./Layer/Category.module.pcss"
import { RailsIcon } from "src/integrations/basic-elements/draw/Transportation/icons/RailsIcon"
import { RoadIcon } from "src/integrations/basic-elements/draw/Transportation/icons/RoadIcon"
import { ConstraintsIcon } from "src/integrations/basic-elements/draw/Limits/icons/ConstraintsIcon"
import { CategoryLayer, LayerSkeleton, TerrainLayer } from "./Layer/CategoryLayer"
import Label16px from "src/integrations/labels/Icons/Label16px"
import { ANNOTATION_LABEL_CATEGORY } from "src/integrations/labels/constants"
import { objectKeys } from "src/lib/record"
import { elementState } from "src/core/elements/ElementState"
import { useTranslator, type I18nStringProvider } from "src/i18n"

const VegetationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_6642_212)">
      <path
        d="M7.52572 12.2598V17.2468M7.59765 12.2598C9.32401 12.2598 10.6907 10.7623 10.6907 8.87065C10.6907 6.97901 8.53276 2.1297 8.31697 1.57797C8.1731 1.2627 7.88538 1.02625 7.52572 1.02625C7.16606 1.02625 6.87833 1.2627 6.73447 1.57797C6.58614 1.9572 5.52027 4.36677 4.86825 6.45071C4.57167 7.39865 4.36072 8.27921 4.36072 8.87065C4.36072 9.54146 4.53259 10.1627 4.83141 10.6852C5.37526 11.6361 6.33962 12.2598 7.45379 12.2598H7.59765Z"
        stroke="currentColor"
        strokeMiterlimit="10"
      />
    </g>
    <defs>
      <clipPath id="clip0_6642_212">
        <rect width="16" height="16" fill="none" />
      </clipPath>
    </defs>
  </svg>
)

const BuildingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_6621_63)">
      <path
        d="M0.471558 5.81319L0.471558 12.4765L5.16993 15.5092H5.81411M0.471558 5.81319L5.78541 9.24588M0.471558 5.81319L9.56127 0.479156H10.8215L15.5308 3.48928M15.5308 3.48928V10.1526L6.45828 15.5092H5.81411M15.5308 3.48928L5.78541 9.24588M5.78541 9.24588L5.81411 15.5092"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        opacity="0.4"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.6914 9.55241L10.7146 6.33441V4.23369L15.2614 7.14002L15.8 6.29744L10.7146 3.04686V0.502502H9.71458V3.03887L0.218445 8.6114L0.724558 9.47387L9.71458 4.19834V6.32192L0.474411 11.8086L0.984971 12.6684L10.2034 7.19469L15.1484 10.3922L15.6914 9.55241Z"
        fill="currentColor"
      />
      <path d="M0.471558 9.14318L5.78541 12.5731L15.5308 6.81927" stroke="currentColor" strokeLinejoin="round" />
    </g>
    <defs>
      <clipPath id="clip0_6621_63">
        <rect width="16" height="16" fill="none" />
      </clipPath>
    </defs>
  </svg>
)

const GenericIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_888_97737)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.27032 13.2981C7.2968 13.4554 7.39675 13.5906 7.53935 13.6621C7.68195 13.7335 7.85009 13.7327 7.99196 13.6598L13.7617 10.6941C14.8231 10.1485 15.5334 9.09969 15.6461 7.91157L16.086 3.27085C16.1443 2.65647 15.8203 2.06912 15.2695 1.79066L12.2169 0.247177C11.6526 -0.0381153 10.9701 0.0610336 10.5103 0.495073L7.21393 3.6071C6.36467 4.40887 5.9713 5.58141 6.16518 6.73314L7.27032 13.2981ZM13.3046 9.80472L8.88439 12.0767C9.11468 11.5913 9.31188 11.1544 9.50789 10.7201L9.50859 10.7186C9.78119 10.1147 10.0516 9.51574 10.408 8.7916C11.2337 8.9979 12.1225 8.61901 12.5289 7.82969C13.0031 6.90869 12.6409 5.77766 11.7199 5.30346C10.7989 4.82926 9.66789 5.19147 9.19369 6.11246C8.81053 6.85663 8.97344 7.73792 9.53596 8.29905C9.15919 9.062 8.87731 9.68648 8.59783 10.3056L8.59714 10.3072C8.40697 10.7285 8.21788 11.1474 7.99989 11.608L7.1513 6.56713C7.01282 5.74447 7.2938 4.90694 7.90041 4.33425L11.1968 1.22222C11.3501 1.07754 11.5776 1.04449 11.7657 1.13959L14.8183 2.68307C15.0019 2.77589 15.1099 2.97168 15.0905 3.17647L14.6505 7.81719C14.5701 8.66585 14.0627 9.41501 13.3046 9.80472ZM11.6398 7.37193C11.4185 7.8019 10.8904 7.971 10.4605 7.74961C10.0305 7.52823 9.86138 7.0002 10.0828 6.57023C10.3041 6.14025 10.8322 5.97115 11.2622 6.19254C11.6921 6.41392 11.8612 6.94195 11.6398 7.37193Z"
        fill="currentColor"
      />
      <path
        d="M0.690871 8.18308C1.32813 7.16933 2.4981 6.43611 3.41592 7.21472C5.69806 9.1507 0.109132 12.3104 2.43382 14.7406C3.61345 15.9737 5.26848 15.6166 6.48365 14.7406"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="clip0_888_97737">
        <rect width="16" height="16" fill="white" transform="translate(0.116699 16.0434) rotate(-90)" />
      </clipPath>
    </defs>
  </svg>
)

const TerrainIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_6639_66)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.29495 1.32816L8 1.11267L7.70504 1.32816L0.205044 6.80744L0 6.95724V7.21118V8.76219V9.0154L0.204112 9.16524L7.70411 14.6711L8 14.8883L8.29589 14.6711L15.7959 9.16524L16 9.0154V8.76219V7.21118V6.95724L15.795 6.80744L14.4488 5.82401L14.4526 5.81701C14.4363 5.80834 14.42 5.79971 14.4038 5.79112L8.29495 1.32816ZM10.8856 4.45928L8 2.35111L1 7.46511V8.50898L5.23787 11.6201L5.23385 11.611C5.26869 11.5956 5.3172 11.5722 5.34637 11.3943C5.37958 11.1918 5.36395 10.9082 5.32367 10.5131C5.31598 10.4377 5.30739 10.3589 5.29848 10.2771L5.29843 10.2766L5.29841 10.2765C5.22092 9.56544 5.11906 8.63081 5.37019 7.76496C5.74271 6.48057 6.52079 5.1533 8.04072 4.59636C8.82552 4.3088 9.76524 4.24301 10.8856 4.45928ZM6.05113 12.2171L8 13.6478L8.98605 12.9239C9.04299 12.7698 9.07284 12.5621 9.07508 12.2879C9.07748 11.9931 9.04856 11.664 9.01422 11.2952L9.0065 11.2128C8.94213 10.5261 8.86438 9.69669 9.05445 8.96913C9.15713 8.57613 9.34058 8.19616 9.65321 7.87311C9.96577 7.55012 10.3827 7.30963 10.913 7.15729C11.7618 6.91344 12.9322 6.8867 14.5346 7.12509L13.8729 6.64167C11.2079 5.24317 9.48315 5.13285 8.38478 5.53531C7.28532 5.93818 6.65812 6.91432 6.33061 8.04351C6.13819 8.70696 6.2156 9.43748 6.29389 10.1763C6.3022 10.2547 6.31051 10.3332 6.31851 10.4117C6.35724 10.7915 6.39105 11.2033 6.33319 11.5561C6.29536 11.7868 6.21229 12.0229 6.05113 12.2171ZM15 8.21501C13.1212 7.87834 11.9318 7.90505 11.1891 8.11841C10.7962 8.2313 10.5421 8.39254 10.3718 8.56853C10.2016 8.74446 10.0902 8.96071 10.022 9.2219C9.87791 9.77336 9.9395 10.4464 10.0099 11.2025C10.0381 11.5055 10.067 11.822 10.0737 12.1254L15 8.50898V8.21501Z"
        fill="currentColor"
      />
      <path
        opacity="0.2"
        d="M5.85038 7.90424C5.35745 9.60379 6.40299 11.6386 5.4369 12.068L7.95337 14.3111L16.3935 7.90424L14.2174 6.25828C8.66093 3.29742 6.55042 5.49066 5.85038 7.90424Z"
        fill="currentColor"
      />
      <path
        opacity="0.4"
        d="M15.5911 7.81833C6.83482 6.06674 10.2593 11.1967 9.43199 13.1555L15.5911 8.70139L15.5911 7.81833Z"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="clip0_6639_66">
        <rect width="16" height="16" fill="none" />
      </clipPath>
    </defs>
  </svg>
)

const PropertyBoundariesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_889_97758)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.07532 5.95071L4.47084 7.52885L1.08206 5.47548L0.129229 6.06738L3.50601 8.11348L0.0549315 10.2046L0.982471 10.8118L4.47084 8.6981L7.0752 10.2762L3.55154 12.4113L4.50317 13.0039L8.04004 10.8608L11.4811 12.9459L12.4358 12.3551L9.00488 10.2762L11.6094 8.69803L14.9949 10.7495L15.9449 10.1558L12.5742 8.1134L15.8465 6.13063L14.8999 5.5349L11.6094 7.52878L9.005 5.95071L12.3315 3.93508L11.3861 3.33867L8.04016 5.36608L4.59652 3.27947L3.6449 3.8721L7.07532 5.95071ZM8.04016 6.53534L5.43568 8.11348L8.04004 9.69154L10.6445 8.1134L8.04016 6.53534Z"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="clip0_889_97758">
        <rect width="16" height="16" fill="white" transform="translate(0 16.1696) rotate(-90)" />
      </clipPath>
    </defs>
  </svg>
)

const ZonesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_886_97683)">
      <path
        opacity="0.5"
        d="M3.7237 10.1894L3.3126 10.474L3.88181 11.2962L4.29291 11.0116L3.7237 10.1894ZM11.9938 11.0116L12.4049 11.2962L12.9741 10.474L12.563 10.1894L11.9938 11.0116ZM11.7861 4.60773L3.7237 10.1894L4.29291 11.0116L12.3553 5.42993L11.7861 4.60773ZM3.93141 5.42993L11.9938 11.0116L12.563 10.1894L4.50062 4.60773L3.93141 5.42993Z"
        fill="#808080"
      />
      <path
        d="M0.616699 7.41086L8.1167 2.68692L15.6167 7.41086V8.58916L8.1167 13.3131L0.616699 8.58916V7.41086Z"
        stroke="currentColor"
      />
    </g>
    <defs>
      <clipPath id="clip0_886_97683">
        <rect width="16" height="16" fill="white" transform="translate(0.116699)" />
      </clipPath>
    </defs>
  </svg>
)

const SiteLimitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_886_97673)">
      <path
        opacity="0.5"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.66342 9.71253L9.33859 3.25278L9.89493 3.82766L3.21975 10.2874L2.66342 9.71253ZM11.1536 4.46556L4.47334 10.9302L5.02968 11.5051L11.7099 5.04044L11.1536 4.46556ZM6.33862 12.0944L13.0289 5.62008L13.5852 6.19497L6.89495 12.6693L6.33862 12.0944ZM9.17508 12.3188L14.8386 6.83806L15.3949 7.41295L9.73141 12.8937L9.17508 12.3188ZM5.83855 3.67055L0.766357 8.57905L1.32269 9.15393L6.39488 4.24543L5.83855 3.67055Z"
        fill="#808080"
      />
      <path
        d="M0.616943 7.41083L8.11694 2.68689L15.6169 7.41083V8.58913L8.11694 13.3131L0.616943 8.58913V7.41083Z"
        stroke="currentColor"
      />
    </g>
    <defs>
      <clipPath id="clip0_886_97673">
        <rect width="16" height="16" fill="white" transform="translate(0.116699)" />
      </clipPath>
    </defs>
  </svg>
)

export const ReferenceImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" />
    <path
      d="M1.59729 10.0676L1.32206 9.6502L1.09729 9.7984V10.0676H1.59729ZM11 13.5V14C11.1969 14 11.3755 13.8844 11.4561 13.7048C11.5368 13.5252 11.5045 13.3149 11.3737 13.1678L11 13.5ZM1.87252 10.4851L4.79287 8.55956L4.24241 7.7247L1.32206 9.6502L1.87252 10.4851ZM6.09071 8.73003L10.6263 13.8322L11.3737 13.1678L6.83809 8.06564L6.09071 8.73003ZM11 13H3.59729V14H11V13ZM2.09729 11.5V10.0676H1.09729V11.5H2.09729ZM3.59729 13C2.76886 13 2.09729 12.3284 2.09729 11.5H1.09729C1.09729 12.8807 2.21658 14 3.59729 14V13ZM4.79287 8.55956C5.20774 8.28602 5.76055 8.35863 6.09071 8.73003L6.83809 8.06564C6.17776 7.32283 5.07216 7.17761 4.24241 7.7247L4.79287 8.55956Z"
      fill="currentColor"
    />
    <circle cx="10.5" cy="6.5" r="1.5" fill="currentColor" />
  </svg>
)

export const allCategories: Record<Category, { title: I18nStringProvider; Icon: FunctionComponent }> = {
  site_limit: {
    title: (t) => t(($) => $.layerList.siteLimits),
    Icon: SiteLimitIcon,
  },
  building: {
    title: (t) => t(($) => $.layerList.buildings),
    Icon: BuildingsIcon,
  },
  vegetation: {
    title: (t) => t(($) => $.layerList.vegetation),
    Icon: VegetationIcon,
  },
  generic: {
    title: (t) => t(($) => $.layerList.generic),
    Icon: GenericIcon,
  },
  road: {
    title: (t) => t(($) => $.layerList.roads),
    Icon: RoadIcon,
  },
  property_boundary: {
    title: (t) => t(($) => $.layerList.propertyBoundaries),
    Icon: PropertyBoundariesIcon,
  },
  zone: {
    title: (t) => t(($) => $.layerList.zones),
    Icon: ZonesIcon,
  },
  terrain: {
    title: (t) => t(($) => $.layerList.terrain),
    Icon: TerrainIcon,
  },
  rails: {
    title: (t) => t(($) => $.transportation.railroads.name),
    Icon: RailsIcon,
  },
  constraints: {
    title: (t) => t(($) => $.limits.constraint.plural),
    Icon: ConstraintsIcon,
  },
  reference_image: {
    title: (t) => t(($) => $.layerList.images),
    Icon: ReferenceImageIcon,
  },
  [ANNOTATION_LABEL_CATEGORY]: {
    title: (t) => t(($) => $.labels.category),
    Icon: Label16px,
  },
}

const order = objectKeys(allCategories)

export type Action = "click" | "shiftclick" | "mouseover" | "mouseout" | "togglelock" | "togglehide"

export function LayerListCategorized({
  isScenario,
  categories,
  hidden,
  locked,
  selected,
  hovered,
  pending,
  setLayerListViewState,
}: {
  isScenario: boolean
  categories: Set<Category>
  hidden: Set<Category>
  locked: Set<Category>
  selected: Set<Category>
  hovered: Set<Category>
  pending?: Set<Category>
  setLayerListViewState: (state: { category: Category; isBaseLayer: boolean } | null) => void
}) {
  const t = useTranslator()
  const siteDesignTerrain = elementState.currentTerrainSignal.value

  if (categories.size === 0 && pending?.size === 0) {
    return (
      <div>
        {!isScenario && siteDesignTerrain && <TerrainLayer pending={pending?.has("terrain")} />}
        <div className={styles.EmptyLayersContainer}>
          <p>{isScenario ? t(($) => $.base.noBaseLayersText) : t(($) => $.proposal.noProposalLayersText)}</p>
        </div>
      </div>
    )
  }

  function getLayersList(c: Category) {
    return (
      <CategoryLayer
        isScenario={isScenario}
        key={c}
        category={c}
        hidden={hidden.has(c)}
        locked={locked.has(c)}
        selected={selected.has(c)}
        hovered={hovered.has(c)}
        pending={isScenario ? pending?.has(c) : undefined}
        setLayerListViewState={setLayerListViewState}
      />
    )
  }

  return (
    <div>
      {order
        .filter((c) => categories.has(c) || (isScenario && pending?.has(c) && c !== "terrain"))
        .map((c) => getLayersList(c))}
      {!isScenario && siteDesignTerrain && <TerrainLayer pending={pending?.has("terrain")} />}
    </div>
  )
}

export function LayerListSkeleton() {
  return (
    <>
      <LayerSkeleton />
      <LayerSkeleton />
      <LayerSkeleton />
      <LayerSkeleton />
      <LayerSkeleton />
    </>
  )
}
