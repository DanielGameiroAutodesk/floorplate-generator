import { useState } from "preact/hooks"
import { useTranslator } from "src/i18n"

const dotIcon = (
  <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.18286 4C9.18286 4.55228 8.73515 5 8.18286 5C7.63058 5 7.18286 4.55228 7.18286 4C7.18286 3.44772 7.63058 3 8.18286 3C8.73515 3 9.18286 3.44772 9.18286 4ZM9.18286 8C9.18286 8.55228 8.73515 9 8.18286 9C7.63058 9 7.18286 8.55228 7.18286 8C7.18286 7.44772 7.63058 7 8.18286 7C8.73515 7 9.18286 7.44772 9.18286 8ZM8.18286 13C8.73515 13 9.18286 12.5523 9.18286 12C9.18286 11.4477 8.73515 11 8.18286 11C7.63058 11 7.18286 11.4477 7.18286 12C7.18286 12.5523 7.63058 13 8.18286 13Z"
      fill="#808080"
    />
  </svg>
)

///
// Pagination
////

const SeeFloorsInRemainingBuildingsStyle = `
  height: 40px;
  display: flex;
  align-items: center;
  cursor: pointer;
`

const SeeAllFloorsButtonStyle = (hover: boolean) => `
  display: flex;
  align-items: center;
  width: 216px;
  height: 28px;
  padding: 0px 6px 0px 6px;
  border-radius: 2px;
  ${hover ? "background: var(--background-color-ghost-high-hover);" : ""}
  cursor: pointer;
`

const SeeAllFloorsTextStyle = `
  font: var(--11-medium)
`

const IconBoxStyle = `
  width: 16px;
  height: 16px;
  margin-right: 8px;
`
export const SeeFloorsInRemainingBuildings = ({
  numberOfRestStacks,
  seeAllFloors,
  setSeeAllFloors,
}: {
  numberOfRestStacks: number
  seeAllFloors: boolean
  setSeeAllFloors: (seeAllFloors: boolean | ((prev: boolean) => boolean)) => void
}) => {
  const t = useTranslator()
  const [hover, setHover] = useState(false)
  if (numberOfRestStacks === 0 || seeAllFloors) return <></>

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={SeeFloorsInRemainingBuildingsStyle}
    >
      <div
        style={SeeAllFloorsButtonStyle(hover)}
        onClick={() => {
          setSeeAllFloors(true)
        }}
      >
        <div style={IconBoxStyle}>{dotIcon}</div>
        <div style={SeeAllFloorsTextStyle}>{t(($) => $.building.floors.seeAllButton)}</div>
      </div>
    </div>
  )
}
