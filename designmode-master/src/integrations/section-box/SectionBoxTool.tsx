import { v4 as uuidv4 } from "uuid"
import styles from "./SectionBoxTool.module.pcss"
import { SectionBoxHandles } from "./tooling/SectionBoxHandles"
import PushPullSectionBox from "./tooling/handling/PushPull"
import { useTranslator } from "src/i18n"
import {
  DEFAULT_BOX_ID,
  DEFAULT_BOX_NAME,
  sectionBoxesSignal,
  selectedSectionBoxSignal,
  setSectionBoxesSignal,
  setSelectedSectionBoxSignal,
  setShowOutlineSignal,
  showOutlineSignal,
  type SectionBoxItem,
} from "./state"
import { useEffect, useState, useErrorBoundary } from "preact/hooks"
import { getSectionBoxes, putSectionBox } from "./sectionBoxApiInterface"
import { SectionBoxRow } from "./components/SectionBoxRow"
import { renderSectionBoxOutline, SectionBoxRendering } from "./rendering/SectionBoxClippingRendering"
import type { SectionBox } from "./tooling/sectionBox"
import { explicitSignal } from "src/lib/signal"
import { captureException } from "@sentry/browser"
import type { ErrorInfo } from "preact"
import { sectionBoxRenderAPI } from "./rendering/utilities/sectionBoxRenderer"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { trackAddSectionBox, trackCloseSectionBox, trackOpenSectionBox } from "./analytics"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const DEFAULT_BOX_HEIGHT = 200
const MIN_TERRAIN_THICKNESS = 30 // ~10+ stories below ground, should be more than sufficient and looks good proportionally
const DEFAULT_SECTION_BOX: SectionBox = {
  type: "Feature",
  properties: { elevation: -100, height: DEFAULT_BOX_HEIGHT },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-500, -500],
        [500, -500],
        [500, 500],
        [-500, 500],
        [-500, -500],
      ],
    ],
  },
}

const OutlineIcon = () => {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.84077 0.0260332C6.94408 -0.00867653 7.05591 -0.00867778 7.15922 0.0260297L9.7589 0.899354L9.44045 1.84729L7.00001 1.02746L4.55923 1.84746L4.24077 0.899529L6.84077 0.0260332ZM11.9919 2.70442L10.7403 2.28396L11.0587 1.33602L13.6584 2.20934C13.862 2.27774 13.9992 2.46853 13.9992 2.68331V5.18898H12.9992V3.3997L11.0719 4.10779L10.7271 3.16914L11.9919 2.70442ZM1 3.40005V5.18923H0V2.68374C0 2.46896 0.137168 2.27817 0.340766 2.20977L2.94077 1.33628L3.25923 2.28421L2.00744 2.70476L3.27239 3.16938L2.92761 4.10807L1 3.40005ZM7.5 5.42018L9.77211 4.58537L9.42724 3.64672L6.99997 4.53853L4.57239 3.64688L4.22761 4.58556L6.5 5.42021V7.64272H7.5V5.42018ZM13.9992 6.44181V8.94747C13.9992 9.15307 13.8733 9.33771 13.682 9.41286L11.0823 10.4339L10.7167 9.50309L12.9992 8.60666V6.44181H13.9992ZM0 8.94747V6.44198H1V8.60665L3.28276 9.50308L2.91724 10.4339L0.317238 9.41287C0.125862 9.33772 0 9.15307 0 8.94747ZM6.5 10.7665V8.92848H7.5V10.7664L9.41689 10.0136L9.78246 10.9444L7.18278 11.9654C7.0653 12.0115 6.93472 12.0115 6.81724 11.9654L4.21724 10.9444L4.58276 10.0136L6.5 10.7665Z"
        fill="#3C3C3C"
      />
    </svg>
  )
}

const OutlineHiddenIcon = () => {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        opacity="0.5"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.35656 0.764195L7.15922 0.0260297C7.05591 -0.00867778 6.94408 -0.00867653 6.84077 0.0260332L4.24077 0.899529L4.55923 1.84746L7.00001 1.02746L8.67953 1.59167L9.35656 0.764195ZM6.4375 4.33193L4.57239 3.64688L4.22761 4.58556L5.76729 5.15109L6.4375 4.33193ZM2.46826 9.18323L1 8.60665V6.44198H0V8.94747C0 9.15307 0.125862 9.33772 0.317238 9.41287L1.803 9.99633L2.46826 9.18323ZM2.78087 10.3803L3.08353 10.0104L2.91724 10.4339L2.78087 10.3803ZM6.5 5.83473L7.80146 4.24405L9.42724 3.64672L9.77211 4.58537L7.5 5.42018V7.64272H6.5V5.83473ZM10.7403 2.28396L11.9919 2.70442L10.7271 3.16914L11.0719 4.10779L12.9992 3.3997V5.18898H13.9992V2.68331C13.9992 2.46853 13.862 2.27774 13.6584 2.20934L11.0587 1.33602L10.7403 2.28396ZM1 5.18923V3.40005L2.92761 4.10807L3.27239 3.16938L2.00744 2.70476L3.25923 2.28421L2.94077 1.33628L0.340766 2.20977C0.137168 2.27817 0 2.46896 0 2.68374V5.18923H1ZM13.9992 8.94747V6.44181H12.9992V8.60666L10.7167 9.50309L11.0823 10.4339L13.682 9.41286C13.8733 9.33771 13.9992 9.15307 13.9992 8.94747ZM6.5 8.92848V10.7665L4.58276 10.0136L4.21724 10.9444L6.81724 11.9654C6.93472 12.0115 7.0653 12.0115 7.18278 11.9654L9.78246 10.9444L9.41689 10.0136L7.5 10.7664V8.92848H6.5Z"
        fill="#3C3C3C"
        fillOpacity="0.7"
      />
      <path
        opacity="0.5"
        d="M11.5 0.5L2.5 11.5"
        stroke="#3C3C3C"
        strokeLinecap="round"
        strokeLinejoin="bevel"
        strokeOpacity="0.7"
      />
    </svg>
  )
}

const SectionBoxIcon = () => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.2463 7.73304C13.3214 7.83566 13.3808 7.92551 13.4259 8.00006C13.3808 8.07461 13.3214 8.16444 13.2463 8.26706C13.0009 8.60249 12.6239 9.02525 12.1278 9.43793C11.134 10.2647 9.72752 11 8 11C6.27032 11 4.86386 10.265 3.87084 9.43882C3.37513 9.02637 2.99854 8.60383 2.75351 8.26849C2.67824 8.16548 2.61878 8.07533 2.57363 8.00061C2.61879 7.92596 2.67821 7.83595 2.7534 7.73309C2.99854 7.39773 3.37524 6.975 3.87101 6.56231C4.86421 5.73558 6.27061 5 8 5C9.72701 5 11.1335 5.73522 12.1275 6.5621C12.6237 6.97481 13.0008 7.39759 13.2463 7.73304ZM14.5 8C14.5 8.55115 12.0464 12 8 12C3.95 12 1.5 8.55342 1.5 8C1.5 7.44998 3.95 4 8 4C12.0454 4 14.5 7.44885 14.5 8ZM9.5 8C9.5 8.82843 8.82843 9.5 8 9.5C7.17157 9.5 6.5 8.82843 6.5 8C6.5 7.17157 7.17157 6.5 8 6.5C8.82843 6.5 9.5 7.17157 9.5 8Z"
        fill="#3C3C3C"
      />
    </svg>
  )
}
const SectionBoxHiddenIcon = () => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        opacity="0.5"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.887 2.81663C13.0618 2.60291 13.0303 2.2879 12.8166 2.11304C12.6029 1.93817 12.2879 1.96967 12.113 2.1834L3.11302 13.1834C2.93816 13.3971 2.96966 13.7121 3.18338 13.887C3.3971 14.0619 3.71211 14.0304 3.88698 13.8166L5.69163 11.6109C6.38703 11.8514 7.15902 12 8 12C12.0464 12 14.5 8.55116 14.5 8.00002C14.5 7.61894 13.3266 5.85261 11.2652 4.79877L12.887 2.81663ZM10.6151 5.59338L6.37409 10.7768C6.87754 10.9176 7.42064 11 8 11C9.72752 11 11.134 10.2648 12.1278 9.43795C12.6239 9.02526 13.0009 8.6025 13.2463 8.26707C13.3214 8.16446 13.3808 8.07462 13.4259 8.00007C13.3808 7.92552 13.3214 7.83568 13.2463 7.73305C13.0008 7.3976 12.6237 6.97482 12.1275 6.56212C11.6979 6.20477 11.1913 5.86454 10.6151 5.59338ZM8 4.00002C8.43391 4.00002 8.84952 4.03969 9.24576 4.11122L8.50152 5.02085C8.33752 5.00717 8.17032 5.00002 8 5.00002C6.27061 5.00002 4.86421 5.73559 3.87101 6.56233C3.37524 6.97501 2.99854 7.39775 2.7534 7.73311C2.67821 7.83596 2.61879 7.92598 2.57363 8.00062C2.61878 8.07535 2.67824 8.16549 2.75351 8.26851C2.99854 8.60385 3.37513 9.02639 3.87084 9.43883C4.06551 9.6008 4.27606 9.75926 4.50183 9.90936L3.86593 10.6866C2.34615 9.64968 1.5 8.32525 1.5 8.00002C1.5 7.44999 3.95 4.00002 8 4.00002Z"
        fill="#3C3C3C"
        fillOpacity="0.7"
      />
    </svg>
  )
}

const PlusIcon = ({ isActive, className }: { isActive: boolean; className: string }) => {
  const fillColor = isActive ? "#006EAF" : "#3C3C3C"
  const fillOpacity = isActive ? "1" : "0.4"

  return (
    <div className={className}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7 7V2H8V7H13V8H8V13H7V8H2V7H7Z"
          fill={fillColor}
          fillOpacity={fillOpacity}
        />
      </svg>
    </div>
  )
}

const computeDefaultSectionBox = (): SectionBox => {
  // we compute initial section box based on terrain bbox
  // we could compute it based on all geos, but this is easier and good enough
  const terrainBbox = terrainSignal.peek().terrainSamplerData.bbox
  if (!terrainBbox) return DEFAULT_SECTION_BOX
  const elevation = terrainBbox.min.z - MIN_TERRAIN_THICKNESS
  const height = terrainBbox.max.z - elevation + DEFAULT_BOX_HEIGHT // We only need to compute the bbox for the terrain this way
  const xInset = (terrainBbox.max.x - terrainBbox.min.x) / 3
  const yInset = (terrainBbox.max.y - terrainBbox.min.y) / 3
  const coordinates = [
    [terrainBbox.min.x + xInset, terrainBbox.min.y + yInset],
    [terrainBbox.max.x - xInset, terrainBbox.min.y + yInset],
    [terrainBbox.max.x - xInset, terrainBbox.max.y - yInset],
    [terrainBbox.min.x + xInset, terrainBbox.max.y - yInset],
    [terrainBbox.min.x + xInset, terrainBbox.min.y + yInset],
  ]

  return {
    type: "Feature",
    properties: { elevation, height },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  }
}

const addSectionBox = (newSectionBox: SectionBoxItem) => {
  // Save the section box to the server
  void putSectionBox(newSectionBox)
  // Add the new one to the local signal
  setSectionBoxesSignal((prev) => [...(prev ?? []), newSectionBox])
}

// Save the current section box
const onSaveSectionBox = () => {
  if (editAccessLevelSignal.peek() !== "edit") return
  const sectionBox = selectedSectionBoxSignal.peek()
  if (!sectionBox) return
  const date = new Date()
  const newSectionBox = {
    id: uuidv4(),
    name: `${date.toLocaleString("default", { month: "short" })} ${date.getDate()} at ${date.toLocaleTimeString()}`,
    box: sectionBox.box,
  }
  addSectionBox(newSectionBox)
  // Turn the new section box on
  setSelectedSectionBoxSignal(newSectionBox)
  trackAddSectionBox()
}

// Create a default section box if there are no section boxes
const onToggleSectionBox = (value: boolean) => {
  if (value) {
    // Turn the new section box on
    const box = initialSectionBoxSignal.peek() ?? computeDefaultSectionBox()
    setSelectedSectionBoxSignal({ id: DEFAULT_BOX_ID, name: DEFAULT_BOX_NAME, box })
    trackOpenSectionBox()
    return
  }
  // Use the current section box if toggle back on and turn off the section box
  const sectionBox = selectedSectionBoxSignal.peek()
  if (sectionBox) setInitialSectionBoxSignal(sectionBox.box)
  setSelectedSectionBoxSignal(undefined)
  trackCloseSectionBox()
}

const onToggleOutlines = (value: boolean) => {
  setShowOutlineSignal(value)
  const sectionBox = selectedSectionBoxSignal.peek()?.box
  if (!sectionBox) return
  if (!value) sectionBoxRenderAPI.remove("sectionBox")
  else renderSectionBoxOutline(sectionBox, "normal")
}

const useLoadSectionBoxes = (isOpen: boolean) => {
  const [isLoading, setIsLoading] = useState(false)
  useEffect(() => {
    if (isOpen && !sectionBoxesSignal.peek()) {
      setIsLoading(true)
      void getSectionBoxes().then((fetchedSectionBoxes) => {
        const syncedSectionBoxes = fetchedSectionBoxes.map<SectionBoxItem>(({ sectionId, name, sectionBox }) => ({
          name,
          id: sectionId,
          box: sectionBox,
        }))
        setSectionBoxesSignal(syncedSectionBoxes)
        setIsLoading(false)
      })
    }
  }, [isOpen])

  return isLoading
}

const handleComponentError = (message: string) => (error: Error, errorInfo: ErrorInfo) => {
  window.forma_toasts.push({ content: message, status: "warning" })
  captureException(error, { tags: { owner: "squad-na-east" }, extra: { errorInfo, message } })
}

export const [initialSectionBoxSignal, setInitialSectionBoxSignal] = explicitSignal<SectionBox | undefined>(undefined)

type IconToggleProps = {
  active: boolean
  onChange: (value: boolean) => void
  children: React.ReactNode[]
  id?: string
}

const IconToggle = ({ active, onChange, children, id }: IconToggleProps) => {
  if (children.length !== 2) return null
  const handleClick = () => {
    onChange(!active)
  }

  return (
    <button id={id} className={styles.Button} onClick={handleClick}>
      {active ? children[0] : children[1]}
    </button>
  )
}

type Props = {
  isOpen: boolean
}

export function SectionBoxTool({ isOpen }: Props) {
  const [error, resetError] = useErrorBoundary(handleComponentError("Section box is not available"))
  const isLoading = useLoadSectionBoxes(isOpen)
  const isDisabled = !selectedSectionBoxSignal.value || editAccessLevelSignal.value !== "edit"
  const t = useTranslator()

  if (error) {
    resetError()
    return null
  }

  return (
    <>
      <div className={styles.Row}>
        <h1 className={styles.MenuTitle}>{t(($) => $.sectionBox.title)}</h1>
        {selectedSectionBoxSignal.value && (
          <weave-tooltip text={t(($) => $.sectionBox.toggleButton)} nub="down-right">
            <IconToggle active={showOutlineSignal.value} onChange={onToggleOutlines}>
              <OutlineIcon />
              <OutlineHiddenIcon />
            </IconToggle>
          </weave-tooltip>
        )}
        <weave-tooltip text={t(($) => $.sectionBox.enableButton)} nub="down-right">
          <IconToggle
            id="toggle-section-box-button"
            active={!!selectedSectionBoxSignal.value}
            onChange={onToggleSectionBox}
          >
            <SectionBoxIcon />
            <SectionBoxHiddenIcon />
          </IconToggle>
        </weave-tooltip>
      </div>
      {isLoading ? (
        <div className={styles.NoSectionBoxes}>
          <weave-skeleton-item radius="5%" width="235px" height="16px" />
        </div>
      ) : (
        <>
          <div className={styles.ScrollItems}>
            {sectionBoxesSignal.value?.map(({ id, name }) => <SectionBoxRow key={id} id={id} name={name} />)}
          </div>
          <div
            data-testid="save-section-box-button"
            onClick={onSaveSectionBox}
            className={styles.SaveRowButton}
            disabled={isDisabled}
          >
            <PlusIcon isActive={!isDisabled} className={styles.RowItemIcon} />
            <div className={styles.RowItemName}>{t(($) => $.sectionBox.saveButton)}</div>
          </div>
        </>
      )}
      <SectionBoxHandles />
      <PushPullSectionBox />
      {selectedSectionBoxSignal.value && <SectionBoxRendering />}
    </>
  )
}
