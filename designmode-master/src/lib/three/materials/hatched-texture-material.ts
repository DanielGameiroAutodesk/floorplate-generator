import { CanvasTexture, MeshBasicMaterial, RepeatWrapping } from "three"

export function getHatchedTexture(): CanvasTexture {
  const SIZE = 256
  const LINEWIDTH = 20
  const canvas = new OffscreenCanvas(SIZE, SIZE)
  const ctx = canvas.getContext("2d")!
  ctx.lineWidth = LINEWIDTH
  ctx.strokeStyle = "#01FFEA"
  ctx.beginPath()
  ctx.moveTo(-LINEWIDTH, -LINEWIDTH)
  ctx.lineTo(SIZE + LINEWIDTH, SIZE + LINEWIDTH)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(SIZE - LINEWIDTH, -LINEWIDTH)
  ctx.lineTo(SIZE + SIZE + LINEWIDTH, SIZE + LINEWIDTH)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-LINEWIDTH, SIZE - LINEWIDTH)
  ctx.lineTo(SIZE + LINEWIDTH, SIZE + SIZE + LINEWIDTH)
  ctx.stroke()
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

export const HATCHED_TEXTURE_MATERIAL = new MeshBasicMaterial({ map: getHatchedTexture(), transparent: true })
