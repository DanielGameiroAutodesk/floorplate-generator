export type Position = { x: number; y: number; z: number }

export type AnalysisGroundTextureApi = {
  add: (name: string, canvas: HTMLCanvasElement, position: Position) => void
  updateTextureData: (name: string, canvas: HTMLCanvasElement) => void
  updatePosition: (name: string, position: Position) => void
  remove: (name: string) => void
}
