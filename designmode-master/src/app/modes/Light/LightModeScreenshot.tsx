import { useEffect } from "preact/hooks"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import sceneManager from "src/core/three/sceneManager"

export default function LightModeScreenshot() {
  useEffect(() => {
    const takeScreenshot = async (event: MessageEvent) => {
      if (event.data.type === "light-mode-take-screenshot") {
        const width = sceneManager.renderer.domElement.clientWidth
        const height = sceneManager.renderer.domElement.clientHeight

        const canvas = document.createElement("canvas")

        const maxDim = 4000
        const aspectRatio = width / height
        const scaledWidth = aspectRatio > 1 ? maxDim : maxDim * aspectRatio
        const scaledHeight = aspectRatio > 1 ? maxDim / aspectRatio : maxDim

        canvas.width = scaledWidth
        canvas.height = scaledHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        await cameraApi.EXPERIMENTAL_captureScreen(ctx, scaledWidth, scaledHeight).catch((e) => {
          throw e
        })
        const blob = await new Promise<Blob>((resolve, reject) =>
          ctx.canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error("Failed to get blob"))
          }, "image/png"),
        ).catch((e) => {
          throw e
        })
        window.parent.postMessage({ type: "light-mode-screenshot-taken", blob: blob, mediaType: "image/png" })
      }
    }

    const handler = (e: MessageEvent) => void takeScreenshot(e)
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  return null
}
