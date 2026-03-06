import { useRecoilState } from "recoil"
import {
  backfaceSelectedState,
  nonWatertightSelectedState,
  showModelDiagnosticsState,
} from "src/integrations/wsm-tools/wsr/integrated/state"
import { useCallback, useState } from "preact/hooks"
import { BackfacesIcon, NonWaterTightEdgesIcon } from "src/integrations/wsm-tools/wsr/svg-icons"
import sceneManager from "src/core/three/sceneManager"

export function ModelDiagnostics() {
  const [isModelDiagnosticsEnabled, setModelDiagnosticsEnabled] = useRecoilState(showModelDiagnosticsState)
  const [isNonWatertightSelected, setNonWatertightSelected] = useRecoilState(nonWatertightSelectedState)
  const [isBackfaceSelected, setIsBackfaceSelected] = useRecoilState(backfaceSelectedState)

  const [previousSelections, setPreviousSelections] = useState({
    nonWatertight: true,
    backface: true,
  })

  const handleToggle = () => {
    if (isModelDiagnosticsEnabled) {
      setPreviousSelections({
        nonWatertight: isNonWatertightSelected,
        backface: isBackfaceSelected,
      })

      setNonWatertightSelected(false)
      setIsBackfaceSelected(false)
    } else {
      setNonWatertightSelected(previousSelections.nonWatertight)
      setIsBackfaceSelected(previousSelections.backface)
    }

    setModelDiagnosticsEnabled((prevState) => !prevState)
  }

  const handleNonWatertightClick = useCallback(() => {
    if (isModelDiagnosticsEnabled === false) {
      setModelDiagnosticsEnabled((prevState) => !prevState)
    }

    setNonWatertightSelected((prevState) => !prevState)
    sceneManager.canvas.focus()
  }, [isModelDiagnosticsEnabled, setModelDiagnosticsEnabled, setNonWatertightSelected])

  const handleBackfacesClick = useCallback(() => {
    if (isModelDiagnosticsEnabled === false) {
      setModelDiagnosticsEnabled((prevState) => !prevState)
    }

    setIsBackfaceSelected((prevState) => !prevState)
    sceneManager.canvas.focus()
  }, [isModelDiagnosticsEnabled, setIsBackfaceSelected, setModelDiagnosticsEnabled])

  return (
    <forma-visibility-menu-item
      text="Model Diagnostics"
      onToggle={handleToggle}
      selected={isModelDiagnosticsEnabled !== false}
      options={[
        {
          icon: NonWaterTightEdgesIcon,
          selected: isNonWatertightSelected !== false,
          toolTip: "Non-watertight edges",
          action: handleNonWatertightClick,
        },
        {
          icon: BackfacesIcon,
          selected: isBackfaceSelected !== false,
          toolTip: "Backfaces",
          action: handleBackfacesClick,
        },
      ]}
    />
  )
}
