import { signal } from "@preact/signals"

type VectorExportProgress = {
  progress: number
  message: string
} | null
export const vectorExportModalSignal = signal(false)
export const vectorExportProgressSignal = signal<VectorExportProgress>(null)
export const progressTotalSignal = signal<number>()
export const startUpDefault = { progress: 0, message: "Preparing..." }
export const cancelVectorExportSignal = signal<boolean>(false)

export const resetVectorExportState = (keepModalOpen?: boolean) => {
  if (!keepModalOpen) vectorExportModalSignal.value = false
  vectorExportProgressSignal.value = null
  progressTotalSignal.value = undefined
  cancelVectorExportSignal.value = false
}
