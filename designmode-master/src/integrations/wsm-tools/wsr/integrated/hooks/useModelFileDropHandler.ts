import { useEffect } from "preact/hooks"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import sceneManager from "src/core/three/sceneManager"

// Process the dropped model file and import it to I3DS
function processModelFileDrop(event: DragEvent) {
  event.stopPropagation()
  event.preventDefault()

  //TODO Add analytics for file drop
  const file = event.dataTransfer?.items[0].getAsFile()

  const extension = file?.name.split(".").pop() ?? "axm"

  const reader = new FileReader()
  reader.onload = (readEvent: ProgressEvent) => {
    if (readEvent.loaded === readEvent.total) {
      const arrayBuffer = readEvent.target?.result as ArrayBuffer
      const data = new Uint8Array(arrayBuffer)
      const tempFile = `/tmp/filedrop.${extension}`
      window.FormItModule.FS_createDataFile("", tempFile, data, true, true, true)
      FormIt.ImportToGroup(extension, tempFile)
      window.FormItModule.ccall("FormItCore_DeleteFile", "int", ["string"], [tempFile])
    }
  }
  reader.readAsArrayBuffer(file!)
}

// Drag over handler to allow drop
function dragOverHandler(event: Event) {
  // Prevent the default action to allow drop
  event.preventDefault()
}

// Custom hook to handle model file drop
function useModelFileDropHandler() {
  const isFormItCoreReady = formitInitializedSignal.value

  useEffect(() => {
    if (isFormItCoreReady) {
      const eventHandlerRef = (e: DragEvent) => {
        processModelFileDrop(e)
      }
      sceneManager.canvas.addEventListener("drop", eventHandlerRef)
      sceneManager.canvas.addEventListener("dragover", dragOverHandler)
      return () => {
        sceneManager.canvas.removeEventListener("drop", eventHandlerRef)
        sceneManager.canvas.removeEventListener("dragover", dragOverHandler)
      }
    }
  }, [isFormItCoreReady])
}

export default useModelFileDropHandler
