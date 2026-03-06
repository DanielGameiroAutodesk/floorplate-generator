import { useCallback } from "preact/hooks"
import { withLazyLoadScriptPlaceholder } from "src/lib/useLazyLoadScript"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { elementState } from "src/core/elements/ElementState"
import styles from "./CameraTool.module.pcss"
import { ClickOutside } from "src/lib/components/ClickOutside"
import { Analytics } from "src/core/analytics"
import { EventName } from "@spacemakerai/webapp-analytics"
import { effect, useSignal } from "@preact/signals"
import { vectorExportEventProperties } from "src/integrations/vector-export/lib/tracking"
import vectorSceneExport from "src/integrations/vector-export/VectorExport"
import { useTranslator } from "src/i18n"
import {
  cancelVectorExportSignal,
  progressTotalSignal,
  vectorExportModalSignal,
  vectorExportProgressSignal,
} from "src/integrations/vector-export/state"

type ScreenCaptureDrawHandler = (
  event: CustomEvent<{
    ctx: CanvasRenderingContext2D
    size: { width: number; height: number }
    done: (err?: Error) => void
  }>,
) => void

type VectorSceneExportHandler = (
  event: CustomEvent<{
    done: (err?: Error) => void
  }>,
) => void

type Vector3 = {
  x: number
  y: number
  z: number
}

type CameraPosition = {
  position: Vector3
  target: Vector3
} & (
  | {
      cameraType: "perspective"
    }
  | {
      cameraType: "orthographic"
      zoom: number
    }
)

type CameraPositionSaveHandler = (
  event: CustomEvent<{
    setPosition: (position: CameraPosition) => void
  }>,
) => void

type CameraPositionSelectHandler = (event: CustomEvent<CameraPosition>) => void

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-camera-tool": HTMLAttributes<HTMLElement> & {
        rooturn: string
        mapbox?: boolean
        exportvectorsceneenabled?: boolean
        screencapturefilenameprefix?: string
        onScreenCaptureDraw: ScreenCaptureDrawHandler
        onCameraPositionSave: CameraPositionSaveHandler
        onCameraPositionSelect: CameraPositionSelectHandler
        onExportVectorScene?: VectorSceneExportHandler
      }
    }
  }
}

const CameraToolPlaceholder = () => (
  <div style="padding: 6px">
    <forma-camera-24 style="display: block; width: 24px; height: 24px; color: var(--icon-color-medium);"></forma-camera-24>
  </div>
)

export default withLazyLoadScriptPlaceholder(
  "/web-components/forma-camera-tool/forma-camera-tool.js",
  "gamma",
  CameraToolPlaceholder,
)(() => {
  const t = useTranslator()
  const timeoutIdSignal = useSignal<NodeJS.Timeout | null>(null)
  const onScreenCaptureDraw = useCallback<ScreenCaptureDrawHandler>((event) => {
    async function run() {
      try {
        const { width, height } = event.detail.size
        await cameraApi.EXPERIMENTAL_captureScreen(event.detail.ctx, width, height)
        event.detail.done()
      } catch (err) {
        event.detail.done(err as Error)
      }
    }
    void run()
  }, [])

  const onExportVectorScene = useCallback<VectorSceneExportHandler>((event) => {
    function run() {
      try {
        vectorSceneExport().then(
          () => {
            event.detail.done()
          },
          (err) => {
            event.detail.done(err)
          },
        )
      } catch (err) {
        event.detail.done(err as Error)
      }
    }
    run()
  }, [])

  const onCameraPositionSave = useCallback<CameraPositionSaveHandler>((event) => {
    const { target, position } = cameraApi.getCurrentCameraState()
    const cameraSettings = cameraApi.getCameraSettings()

    event.detail.setPosition({
      target,
      position,
      ...(cameraSettings.type === "orthographic"
        ? {
            cameraType: cameraSettings.type,
            zoom: cameraSettings.zoom,
          }
        : {
            cameraType: cameraSettings.type,
          }),
    })
  }, [])

  const onCameraPositionSelect = useCallback<CameraPositionSelectHandler>((event) => {
    async function run() {
      const cameraSettings = cameraApi.getCameraSettings()
      if (event.detail.cameraType !== cameraSettings.type) {
        await cameraApi.switchPerspective()
      }

      await cameraApi.moveCamera(
        ...([
          event.detail.position,
          event.detail.target,
          event.detail.cameraType === "orthographic" ? event.detail.zoom : undefined,
          500,
        ] as const),
      )
    }
    void run()
  }, [])

  const proposal = elementState.currentProposalSignal.value

  const handleCancelVectorExport = () => {
    vectorExportProgressSignal.value = {
      progress: vectorExportProgressSignal.peek()?.progress ?? 0,
      message: `Cancelling...`,
    }
    cancelVectorExportSignal.value = true
    Analytics.track(EventName.Cancel, vectorExportEventProperties)
  }

  const handleCloseModal = () => {
    vectorExportModalSignal.value = false
  }

  const formatProgress = (progress?: number) => {
    const progressTotal = progressTotalSignal.peek()
    return progress && progressTotal ? `${Math.round((progress / progressTotal) * 100)}` : undefined
  }

  const formattedProgress = formatProgress(vectorExportProgressSignal.value?.progress)

  effect(() => {
    // Close modal after half a second if export is successful
    if (!vectorExportProgressSignal.peek() && vectorExportModalSignal.peek()) {
      timeoutIdSignal.value = setTimeout(handleCloseModal, 500)
    }
    // Clear timeout if modal is closed manually
    const timeoutId = timeoutIdSignal.peek()
    if (timeoutId && !vectorExportModalSignal.peek()) {
      clearTimeout(timeoutId)
      timeoutIdSignal.value = null
    }
  })

  return (
    <>
      {vectorExportModalSignal.value && (
        <div className={styles.Modal__overlay}>
          <ClickOutside onClickOutside={vectorExportProgressSignal.value ? () => {} : handleCloseModal}>
            <div className={styles.Modal}>
              <div className={styles.Modal__title}>{t(($) => $.camera.vectorExport.title)}</div>
              <div className={styles.Modal__body}>
                {vectorExportProgressSignal.value ? (
                  <>
                    <weave-progress-bar percentcomplete={formattedProgress}></weave-progress-bar>
                    <div className={styles.Modal__body__context}>
                      <p>{vectorExportProgressSignal.value?.message}</p>
                      <p>{formattedProgress ? `${formattedProgress}%` : undefined}</p>
                    </div>
                  </>
                ) : (
                  <p>{t(($) => $.camera.vectorExport.exportSuccessful)}</p>
                )}
              </div>
              <div className={styles.Modal__footer}>
                <weave-button
                  className={styles.Modal__footer__button}
                  variant="outlined"
                  disabled={cancelVectorExportSignal.value}
                  onClick={vectorExportProgressSignal.value ? handleCancelVectorExport : handleCloseModal}
                >
                  {vectorExportProgressSignal.value ? "Cancel" : "Close"}
                </weave-button>
              </div>
            </div>
          </ClickOutside>
        </div>
      )}
      <forma-camera-tool
        exportvectorsceneenabled={true}
        screencapturefilenameprefix={`${proposal.element.properties?.name?.replaceAll(" ", "_") || "design"}_`}
        rooturn={proposal.urn}
        mapbox={proposal.terrain?.textureAttributionTag === "MAPBOX"}
        onScreenCaptureDraw={onScreenCaptureDraw}
        onCameraPositionSave={onCameraPositionSave}
        onCameraPositionSelect={onCameraPositionSelect}
        onExportVectorScene={onExportVectorScene}
      ></forma-camera-tool>
    </>
  )
})
