import { useCallback } from "preact/hooks"
import sceneManager from "src/core/three/sceneManager"
import { MessageHandler } from "@spacemakerai/web-sketch-renderer"
import { wsmSideEffectAdapter } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import { captureException } from "@sentry/browser"
import FormItWasmURL from "@spacemakerai/adsk-formit-core-standalone/dist/FormIt.ems.wasm?url"
import { explicitSignal } from "src/lib/signal"
import { defaultFloorHeightImperial, defaultFloorHeightMetric } from "./types"
import { useIsImperial } from "src/lib/unitSettings"

declare global {
  interface Window {
    WSM?: any
    FormIt?: any
    formit_scriptBinaryBlobURL?: any
    onEmscriptenFinishedLoading?: () => void
  }
}

export const [formitInitializedSignal, setFormitInitializedSignalValue] = explicitSignal<boolean>(false)

// Not sure why these have to be set like this.
window.WSM = {}
window.FormIt = {}

window.formit_scriptBinaryBlobURL = {
  "FormIt.ems.wasm": FormItWasmURL,
}

const _origFormItReceiveCoreMessage = window.FormItReceiveCoreMessage

window.FormItReceiveCoreMessage = (_payload) => {
  //dispatch events in case any external components (such as wsm-model-tree) need the messages
  window.dispatchEvent(
    new CustomEvent("formit-core-message", {
      detail: _payload,
      bubbles: false,
      cancelable: true,
    }),
  )

  //This is probably not needed long term, but wanted to ensure that
  //this update doesn't break the WSR implementation using window.FormItReceiveCoreMessage
  if (_origFormItReceiveCoreMessage) {
    _origFormItReceiveCoreMessage(_payload)
  }
}

window.onEmscriptenFinishedLoading = function () {
  console.log("Emscripten finished loading")
}

/** This is called when initialize finishes, which resolves the formItInitializing promise */
let resolvePromiseOnInitFinished: (value: any) => void

/** This rejects the formItInitializing promise if there was an error on startup. */
let rejectPromiseOnInitFailed: (reason?: any) => void

/** This promise can be used to await on formit initializing */
let formItInitPromise: Promise<any>

export function useInitializeFormitCoreCallback() {
  const imperial = useIsImperial()

  return useCallback(async (): Promise<void> => {
    if (typeof formItInitPromise !== "undefined") {
      console.info("FormIt init promise present, using that")
      return formItInitPromise
    }

    formItInitPromise = new Promise<any>((resolve: (value: any) => void, reject: (reason?: any) => void) => {
      resolvePromiseOnInitFinished = resolve
      rejectPromiseOnInitFailed = reject
    })

    const FormItModule: any = await import("@spacemakerai/adsk-formit-core-standalone")

    FormItModule.default()
      .then((module: any) => {
        console.log("Starting FormIt initialize")
        window.FormItModule = module
        module._FormItCore_Emscripten_InitHeadless()
        module._RegisterMethods()
        module._FormItCore_InitWrapper()

        // tick does a lazy init, run it once so it's not lazy
        module._Emscripten_Tick_Headless(0, sceneManager.canvas.clientWidth, sceneManager.canvas.clientHeight, 1.0)

        // If this was a pure WSM init, you'd want to create the main history here
        // WSM.APICreateHistory(..)

        const messageHandler = new MessageHandler()
        messageHandler.registerAsHandler(true)
        messageHandler.setFormItMessageKeys()

        // Set the top-level History
        if (WSM.InferenceEngine.GetTopLevelHistory() === WSM.INVALID_ID) {
          WSM.InferenceEngine.SetTopLevelHistory(FormIt.Model.GetHistoryID())
        }

        wsmSideEffectAdapter.setImperial(true)

        if (!imperial) {
          // Set the current project and the default. The primitive tool
          // get the sizes based on the default units.
          FormIt.Model.SetUnitTypeCurrent(FormIt.UnitType.kMetricMeter)
          FormIt.SetUnitTypeDefault(FormIt.UnitType.kMetricMeter)
          console.log("FormIt set to metric")
        } else {
          // If default was previously metric, we need to make sure this
          // is changed explicitly.
          FormIt.Model.SetUnitTypeCurrent(FormIt.UnitType.kImperialFeetInches)
          FormIt.SetUnitTypeDefault(FormIt.UnitType.kImperialFeetInches)
          console.log("FormIt set to imperial")
        }
        // Set the default level height in FormIt
        FormIt.Levels.SetDefaultLevelHeight(defaultFloorHeightImperial, defaultFloorHeightMetric)

        // Configure FormIt settings and visual styles
        FormIt.SetFireflyDisabled(true)
        FormIt.VisualStyles.SetGridVisible(false)
        FormIt.SetSnap(false)

        // Hybrid tools
        FormIt.SetFeatureFlag(WSM.Tools.kUseHybridToolsMode, true)
        FormIt.SetFeatureFlag(WSM.Tools.kUseImplicitToolsFeatureFlag, false)
        FormIt.SetFeatureFlag(WSM.Tools.kUseDragFaceByTweak, true)

        // For primitive sizing, mostly
        FormIt.SetFeatureFlag(FormIt.kRunningInForma, true)

        // When the translation tool is executed in implicit mode, always
        // use quick mode (i.e. need to click on part of the selected object to
        // start the move, otherwise deselect)
        FormIt.SetFeatureFlag(WSM.Tools.kUseMoveQuick, true)

        // Always ignore xy inference axes. Will change later once an LCS is set
        FormIt.VisualStyles.EnableAxisDisplay(false)

        // Always show inferences
        WSM.InferenceEngine.SetAlwaysShowInference(true)

        // Keep terrain from blocking selection and inferencing
        FormIt.SetFeatureFlag(WSM.Tools.kNoTerrainSelectionAndInferenceBlocking, true)

        // Enable double clicking to convert mesh to object
        FormIt.SetFeatureFlag(FormIt.Tools.kDoubleClickMeshToObjectFlag, true)

        // Enable drag face after sketching. NOTE: For testing only at the moment
        //FormIt.SetFeatureFlag(WSM.Tools.kFaceDragAfterSketching, true)
        // Enable drag face after sketching a horizontal shape that was started on the terrain
        FormIt.SetFeatureFlag(WSM.Tools.kFaceDragAfterSketchingHorizontalOnTerrain, true)

        // Need to set transition duration to 0, so that formit camera changes are
        // executed immediately and Forma can adjsut it's camera accordingly
        FormIt.Cameras.SetCameraTransitionDuration(0)

        console.log("FormIt initialize finished")
        setFormitInitializedSignalValue(true)
        FormIt.Configuration.ConfigureFromJSON("{}") // Creates an empty map for FormitTools to avoid TypeErrors
        resolvePromiseOnInitFinished(true)
      })
      .catch((err: any) => {
        rejectPromiseOnInitFailed(err)
        captureException(err, {
          tags: { owner: "conceptual", errorPoint: "Initialize Core", "integration-type": "integrated" },
        })
      })

    return formItInitPromise
  }, [imperial])
}
