import SelectionMenu from "./SelectionMenu/SelectionMenu"
import SelectionMenuControl from "./SelectionMenu/SelectionMenuControl"
import S from "./SceneControls.module.pcss"
import PerspectiveSwitch from "src/integrations/SceneToolsToolbar/tools/PerspectiveSwitch"
import Compass from "src/integrations/SceneToolsToolbar/tools/Compass"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import GuidesAndMeasurementMenu from "./GuidesAndMeasurements/GuidesAndMeasurementMenu"
import GuidesAndMeasurements from "./GuidesAndMeasurements/GuidesAndMeasurements"
import VisibilityMenu from "./VisibilityMenu/VisibilityMenu"
import ZoomToFit from "./ZoomToFit"

const I3DSSceneControls = () => {
  const isFormItCoreReady = formitInitializedSignal.value

  if (!isFormItCoreReady) return null

  return (
    <div className={S.ToolsWrapperContainer}>
      <div className={S.SceneToolsToolbar}>
        <GuidesAndMeasurementMenu />
        <SelectionMenu />
        <SelectionMenuControl />
        <GuidesAndMeasurements />
        <VisibilityMenu />
        <ZoomToFit />
        <PerspectiveSwitch />
        <Compass />
      </div>
    </div>
  )
}

export default I3DSSceneControls
