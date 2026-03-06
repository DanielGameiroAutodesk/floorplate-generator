import { PortalTarget } from "./PortalTarget"
import PerspectiveSwitch from "./tools/PerspectiveSwitch"
import Compass from "./tools/Compass"
import GuidesAndMeasurements from "./tools/GuidesAndMeasurements/GuidesAndMeasurements"
import { VisibilityMenu } from "./tools/VisibilityMenu/VisibilityMenu"
import styles from "./SceneToolsToolbar.module.pcss"
import CameraTool from "./tools/CameraTool"
import { CameraControls } from "./tools/CameraControls/CameraControls"
import { AnalysisColorbar } from "src/integrations/colorbar/AnalysisColorbar"

export default function SceneToolsToolbar() {
  return (
    <div className={styles.SceneToolsWrapper}>
      <PortalTarget portalId="predictive_wind_analysis_scene_tools" />
      <AnalysisColorbar />

      <div className={styles.SceneToolsToolbar}>
        <GuidesAndMeasurements />
        <VisibilityMenu />
        <CameraTool />
        <CameraControls />
        <PerspectiveSwitch />
        <Compass />
      </div>
    </div>
  )
}
