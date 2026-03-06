import SceneToolsToolbar from "src/integrations/SceneToolsToolbar/SceneToolsToolbar"
import { Suspense } from "react"
import { useEffect } from "preact/hooks"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { MainApp } from "src/app/modes/MainMode/MainMode"
import { formaUnitsInitializedSignal } from "src/lib/forma-units"
import styles from "./LightMode.module.pcss"
import LayerListWrapper from "src/integrations/NavigatorTab/layer-list/LayerListWrapper"

export default function LightMode() {
  const initialized = isAppInitializedSignal.value
  const formaUnitsInitialized = formaUnitsInitializedSignal.value

  useEffect(() => {
    if (!initialized) {
      window.globalSpinner.start()
    } else {
      window.globalSpinner.stop()
    }
  }, [initialized])

  return initialized && formaUnitsInitialized ? (
    <Suspense fallback={null}>
      <MainApp />
      <div className={styles.LeftPanel}>
        <LayerListWrapper />
      </div>
      <div className={styles.BottomContainer}>
        <SceneToolsToolbar />
      </div>
    </Suspense>
  ) : null
}
