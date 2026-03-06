import { Vector3 } from "three"
import { cameraApi } from "./CameraAPI"
import type { ReadonlySignal } from "@preact/signals"
import { useSignal, useSignalEffect } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"
import { terrainSignal, type NewTerrainState } from "src/core/terrain/new-terrain-state"

type Vec3 = {
  x: number
  y: number
  z: number
}

type CamType =
  | {
      cameraType: "perspective"
    }
  | {
      cameraType: "orthographic"
      zoom: number
      theta: number
    }
type CameraPosition = {
  scope: string
  position: Vec3
  target: Vec3
}

type StoredCam = CameraPosition & CamType

function loadCameraPosFromQueryParams(): StoredCam | undefined {
  const search = new URLSearchParams(window.location.search)
  const camera3D = search.get("camera3D")
  if (camera3D !== null) {
    // format: x,y,z,tx,ty,tz
    const coords = camera3D.split(",").map((s) => parseFloat(s))
    const isValid = coords.every((c) => typeof c === "number")
    if (!isValid) return
    const [x, y, z, tx, ty, tz] = coords
    return {
      cameraType: "perspective",
      scope: PROJECT_ID,
      position: { x, y, z },
      target: { x: tx, y: ty, z: tz },
    }
  }
  const camera2D = search.get("camera2D")
  if (camera2D !== null) {
    // format: x,y,z,tx,ty,tz,zoom,theta
    const coords = camera2D.split(",").map((s) => parseFloat(s))
    const isValid = coords.every((c) => typeof c === "number")
    if (!isValid) return
    const [x, y, z, tx, ty, tz, zoom, theta] = coords
    return {
      cameraType: "orthographic",
      scope: PROJECT_ID,
      position: { x, y, z },
      target: { x: tx, y: ty, z: tz },
      zoom,
      theta,
    }
  }
}

export function useInitializeCamera(): ReadonlySignal<boolean> {
  const isCameraInitializedSignal = useSignal(false)

  useSignalEffect(() => {
    if (isCameraInitializedSignal.value || !elementState.isInitializedSignal.value) return

    function setCameraFromTerrain(terrain: NewTerrainState) {
      const z = terrain.elevationAt(0, 0)
      const target = new Vector3(0, 0, z)
      const cameraPos = target.clone().add(new Vector3(0, -500, 500))
      void cameraApi.moveCamera(cameraPos, target)
      isCameraInitializedSignal.value = true
    }

    const sessionStorageItem = sessionStorage.getItem("THREE-camera-position")
    const sessionCameraPosition = sessionStorageItem ? JSON.parse(sessionStorageItem) : null
    if (!sessionCameraPosition || sessionCameraPosition.scope !== elementState.currentProjectIdSignal.value) {
      setCameraFromTerrain(terrainSignal.value)
      return
    }
    const loaded: StoredCam = loadCameraPosFromQueryParams() ?? sessionCameraPosition

    // Temporary workaround to avoid invalid camera positions introduced 2024-08-28.
    // Can be removed in a few days (since we persist in session storage).
    if (loaded.position.z == null || (loaded.target.x === 0 && loaded.target.x === 0 && loaded.target.z === 0)) {
      setCameraFromTerrain(terrainSignal.value)
      return
    }

    // 3D sketch does not always store cameraType, so we need to set it to default
    loaded.cameraType ??= "perspective"

    const zoom = loaded.cameraType === "orthographic" ? loaded.zoom : undefined
    const theta = loaded.cameraType === "orthographic" ? loaded.theta : undefined

    void (async () => {
      const current = cameraApi.getCameraSettings()
      if (current.type !== loaded.cameraType) {
        await cameraApi.switchPerspective(0)
      }
      await cameraApi.moveCamera(loaded.position, loaded.target, zoom, 0, undefined, true, theta)
      isCameraInitializedSignal.value = true
    })()
  })

  return isCameraInitializedSignal
}
