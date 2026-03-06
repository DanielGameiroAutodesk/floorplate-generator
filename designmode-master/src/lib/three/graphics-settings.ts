import type { ShadowMapType } from "three"
import { BasicShadowMap, PCFSoftShadowMap } from "three"

type GraphicsSettings = {
  pixelRatio: number
  antialias: boolean
  shadowMapEnabled: boolean
  shadowMapping: ShadowMapType
  shadowMapSize: number
}

const options: Record<string, GraphicsSettings> = {
  high: {
    antialias: true,
    shadowMapEnabled: true,
    shadowMapping: PCFSoftShadowMap,
    pixelRatio: window.devicePixelRatio,
    shadowMapSize: 4096,
  },
  medium: {
    antialias: window.devicePixelRatio < 2,
    shadowMapEnabled: true,
    shadowMapping: BasicShadowMap,
    pixelRatio: window.devicePixelRatio,
    shadowMapSize: 1024,
  },
  low: {
    antialias: window.devicePixelRatio > 1,
    shadowMapEnabled: false,
    shadowMapping: BasicShadowMap,
    pixelRatio: 1,
    shadowMapSize: 1,
  },
}

export const graphicsSettings = options[localStorage.getItem("graphics-settings") || "high"]
