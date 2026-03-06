import { useEffect } from "preact/hooks"
import sceneManager from "src/core/three/sceneManager"
import { cameraApi } from "src/integrations/camera/CameraAPI"

const CompareScreenshot = () => {
  useEffect(() => {
    const takeCompareScreenshot = async (event: MessageEvent) => {
      if (event.data.type === "takeCompareScreenshot") {
        const iframeId = event.data.iframeId
        const width = sceneManager.renderer.domElement.clientWidth
        const height = sceneManager.renderer.domElement.clientHeight

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        await cameraApi.EXPERIMENTAL_captureScreen(ctx, width, height)
        const blob = await new Promise<Blob>((resolve, reject) =>
          ctx.canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error("Failed to get blob"))
          }, "image/png"),
        )
        window.parent.postMessage({ type: "compareScreenshotData", blob: blob, iframeId: iframeId })
      }
    }

    const handler = (e: MessageEvent) => void takeCompareScreenshot(e)
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])
  return null
}

export default CompareScreenshot
