import * as THREE from "three"
import sceneManager from "src/core/three/sceneManager"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import type { ReadonlySignal } from "@preact/signals"
import { useSignalEffect } from "@preact/signals"
import type { CustomOrbitControls } from "@spacemakerai/orbit-controls-common"

const enableCamsync = new URLSearchParams(window.location.search).has("camsync")
const cameraSyncChannel = new BroadcastChannel("camera-sync")

interface SyncPositionMessage {
  type: "sync_position"
  target: THREE.Vector3
  position: THREE.Vector3
  zoom: number
  cameraType?: "perspective" | "orthographic"
}

interface SyncModeMessage {
  type: "sync_mode"
  toMode: "2d" | "3d"
}

interface SyncRequestStateMessage {
  type: "sync_request_state"
}

type SyncStateMessage = SyncPositionMessage | SyncModeMessage | SyncRequestStateMessage

export function useCameraSync(cameraIsInitializedSignal: ReadonlySignal<boolean>) {
  useSignalEffect(() => {
    if (!enableCamsync || !cameraIsInitializedSignal.value) return

    const onChange = (event: { target?: CustomOrbitControls; syncWithRemotes?: boolean }) => {
      if ("syncWithRemotes" in event && !event.syncWithRemotes) return
      if (!event.target || !event.target.object) return

      cameraSyncChannel.postMessage({
        type: "sync_position",
        target: event.target.target,
        position: event.target.object.position,
        zoom: "zoom" in event.target.object ? (event.target.object as any).zoom : undefined,
        cameraType: event.target.object instanceof THREE.PerspectiveCamera ? "perspective" : "orthographic",
      })
    }

    const onToggle = (event: { target?: CustomOrbitControls; syncWithRemotes?: boolean }) => {
      if ("syncWithRemotes" in event && !event.syncWithRemotes) return
      if (!event.target || !event.target.object) return

      let toMode = sceneManager.camera instanceof THREE.PerspectiveCamera ? "3d" : "2d"
      cameraSyncChannel.postMessage({
        type: "sync_mode",
        toMode,
      })
    }

    const handleMessage = (event: MessageEvent<SyncStateMessage>) => {
      async function run() {
        const isPerspectiveNow = sceneManager.camera instanceof THREE.PerspectiveCamera

        switch (event.data.type) {
          case "sync_position": {
            const { position, target, zoom, cameraType } = event.data
            switch (cameraType) {
              case "perspective": {
                if (!isPerspectiveNow) {
                  await cameraApi.switchPerspective(0, undefined, false)
                }
                break
              }
              case "orthographic": {
                if (isPerspectiveNow) {
                  await cameraApi.switchPerspective(0, undefined, false)
                }
                break
              }
            }
            await cameraApi.moveCamera(position, target, zoom, 0, undefined, false)
            break
          }
          case "sync_mode": {
            const { toMode } = event.data
            if ((isPerspectiveNow && toMode === "2d") || (!isPerspectiveNow && toMode === "3d")) {
              await cameraApi.switchPerspective(0, undefined, false)
            }
            break
          }
          case "sync_request_state": {
            const mode = isPerspectiveNow ? "3d" : "2d"
            cameraSyncChannel.postMessage({ toMode: mode, type: "sync_mode" })

            const position = sceneManager.controls.object.position
            const zoom = "zoom" in sceneManager.controls.object ? (sceneManager.controls.object as any).zoom : undefined
            const target = sceneManager.controls.target
            cameraSyncChannel.postMessage({
              target,
              position,
              zoom,
              type: "sync_position",
            })
            break
          }
        }
      }
      void run()
    }

    sceneManager.controls.addEventListener("change", onChange)
    sceneManager.controls.addEventListener("toggle", onToggle)
    cameraSyncChannel.addEventListener("message", handleMessage)

    cameraSyncChannel.postMessage({ type: "sync_request_state" })
    return () => {
      sceneManager.controls.removeEventListener("change", onChange)
      sceneManager.controls.removeEventListener("toggle", onToggle)
      cameraSyncChannel.removeEventListener("message", handleMessage)
    }
  })
}
