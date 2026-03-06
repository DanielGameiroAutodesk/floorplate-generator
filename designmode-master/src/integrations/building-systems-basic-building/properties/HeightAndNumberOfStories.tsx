import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useCallback, useMemo } from "preact/hooks"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import InputWithIcon from "src/lib/components/InputWithIcon/InputWithIcon"
import { roundUpToClosestFootInMetric } from "src/lib/components/LengthInput/formaUnitUtils"
import type { BasicSelection } from "./BasicBuildingProperties"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { RightMenuPanelContainer } from "src/lib/components/RightMenu/RightMenuPanelContainer"
import { RightMenuPanelContentGrid } from "src/lib/components/RightMenu/RightMenuPanelContentGrid"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

const StoryHeightIcon = (
  <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 0L14 1L-4.37114e-08 1L0 -6.11959e-07L14 0ZM6.5 4.18208L5.34824 5.29997L4.65176 4.58239L6.65176 2.64121L7 2.30321L7.34824 2.64121L9.34824 4.58239L8.65176 5.29997L7.5 4.18208L7.5 11.7591L8.65176 10.6412L9.34824 11.3588L7.34824 13.3L7 13.638L6.65176 13.3L4.65176 11.3588L5.34824 10.6412L6.5 11.7591L6.5 4.18208ZM14 16L14 15L-6.55671e-07 15L-6.99382e-07 16L14 16Z"
      fill="#808080"
    />
  </svg>
)
const StoriesIcon = (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9 1H1V3H9V1ZM1 0C0.447715 0 0 0.447715 0 1V3C0 3.55228 0.447715 4 1 4H9C9.55229 4 10 3.55228 10 3V1C10 0.447715 9.55228 0 9 0H1ZM9 6H1V8H9V6ZM1 5C0.447715 5 0 5.44772 0 6V8C0 8.55228 0.447715 9 1 9H9C9.55229 9 10 8.55228 10 8V6C10 5.44772 9.55228 5 9 5H1ZM1 11H9V13H1V11ZM0 11C0 10.4477 0.447715 10 1 10H9C9.55228 10 10 10.4477 10 11V13C10 13.5523 9.55229 14 9 14H1C0.447715 14 0 13.5523 0 13V11Z"
      fill="#808080"
    />
  </svg>
)

export function HeightAndNumberOfStories({ selections }: { selections: BasicSelection[] }) {
  const t = useTranslator()
  const actionAPI = useActionAPI()
  const isImperial = useIsImperial()

  const updateNumberOfStories = useCallback(
    (nofOfStories: number) => {
      const actions: Action[] = []
      for (const selection of selections) {
        const updatedBuilding = BasicBuildingAPI.updateNumberOfFloors(selection.buildingElement, nofOfStories)
        actions.push(
          ...BasicBuildingAPI.actions.createUpdateActions(
            selection.buildingPath,
            selection.buildingElement,
            updatedBuilding,
            actionAPI,
          ),
        )
      }
      actionAPI.apply("Update story height", actions)
    },
    [actionAPI, selections],
  )

  const updateStoryHeight = useCallback(
    (height: number) => {
      const actions: Action[] = []
      for (const selection of selections) {
        const updatedBuilding = BasicBuildingAPI.updateStoryHeight(selection.building, selection.floorIndices, height)
        actions.push(
          ...BasicBuildingAPI.actions.createUpdateActions(
            selection.buildingPath,
            selection.buildingElement,
            updatedBuilding,
            actionAPI,
          ),
        )
      }
      actionAPI.apply("Update story height", actions)
    },
    [actionAPI, selections],
  )

  const { canEditStories, nofStories, storyHeight } = useMemo(() => {
    const onlyBuildings = selections.every((s) => s.wholeBuilding)
    const firstNof = selections[0]?.building.floors.length
    const someWithOtherNof = selections.some((s) => s.building.floors.length !== firstNof)
    const nofStories = onlyBuildings ? (someWithOtherNof ? undefined : firstNof) : 1

    const firstHeight = selections[0]?.building.floors[selections[0].floorIndices[0]].height
    const someWithDifferent = selections.some((s) =>
      s.floorIndices.some((i) => s.building.floors[i].height !== firstHeight),
    )
    const storyHeight = someWithDifferent ? undefined : firstHeight
    return {
      canEditStories: onlyBuildings,
      nofStories,
      storyHeight,
    }
  }, [selections])

  return (
    <RightMenuPanelContainer style={{ paddingBottom: "12px" }}>
      <RightMenuPanelContentGrid>
        <InputWithIcon
          id={"stories"}
          icon={StoriesIcon}
          label={t(($) => $.building.properties.stories)}
          min={1}
          max={1000}
          value={nofStories}
          canEditProposal={canEditProposalSignal.value}
          onChange={updateNumberOfStories}
          isMixed={nofStories === undefined}
          disabled={!canEditStories}
        />
        <InputWithIcon
          id={"storyHeight"}
          icon={StoryHeightIcon}
          label={t(($) => $.building.properties.storyHeight)}
          unit={"length"}
          value={storyHeight}
          canEditProposal={canEditProposalSignal.value}
          onChange={updateStoryHeight}
          isMixed={storyHeight === undefined}
          metricStep={0.1}
          feetStep={0.5}
          metricMin={isImperial ? roundUpToClosestFootInMetric(1) : 1}
          metricMax={isImperial ? roundUpToClosestFootInMetric(100) : 100}
        />
      </RightMenuPanelContentGrid>
    </RightMenuPanelContainer>
  )
}
