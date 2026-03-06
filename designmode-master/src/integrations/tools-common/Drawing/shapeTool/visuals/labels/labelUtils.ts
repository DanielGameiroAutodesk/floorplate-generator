import type { Camera } from "three"
import { AlwaysDepth, CanvasTexture, OrthographicCamera, Sprite, SpriteMaterial, Vector3 } from "three"
import { formatLength } from "src/lib/measurementSystem"
import { getScalingCoefficient } from "src/lib/three/scaling"
import sceneManager from "src/core/three/sceneManager"
import { colors } from "src/lib/colors"
import type { Translator } from "src/i18n"

export function createTextMaterial(message: string, color: string): SpriteMaterial {
  const canvas = document.createElement("canvas")
  const width = 256
  const height = 128
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (context == null) throw Error("Something went wrong! Couldn't create label.")
  context.font = `Normal ${FONT_SIZE}px ${fontFace}`

  const textSize = context.measureText(message)
  const textWidth = textSize.width

  const xCenter = width / 2
  const yCenter = height / 2
  const textHeight = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent

  context.fillStyle = color
  context.fillText(message, xCenter - textWidth / 2, yCenter - textHeight)

  const texture = new CanvasTexture(canvas)
  texture.name = `Label [${message}]`

  return new SpriteMaterial({
    map: texture,
    depthWrite: false,
    transparent: true,
    rotation: 0,
    sizeAttenuation: false,
    depthFunc: AlwaysDepth,
  })
}

const from = new Vector3()
const to = new Vector3()
const tempMultiplication = new Vector3()

export function getScreenAngle(start: Vector3, end: Vector3, camera: Camera, canvas: HTMLCanvasElement) {
  from.copy(start).project(camera)
  to.copy(end).project(camera)

  const canvasWidth = canvas.clientWidth
  const canvasHeight = canvas.clientHeight
  tempMultiplication.set(canvasWidth, canvasHeight, 0)
  const screenVector = to.sub(from).multiply(tempMultiplication)
  let angle = Math.atan2(screenVector.y, screenVector.x)
  if (Math.abs(angle) > Math.PI / 2) {
    angle += Math.PI
  }
  return angle
}

const FONT_SIZE = 14
const fontFace = "Inter, Arial"
const SCALING_COEFFICIENT = 2.2
const reuseVector = new Vector3()

const tempStart = new Vector3()
const tempEnd = new Vector3()
export function createLabel(
  start: Vector3,
  end: Vector3,
  camera: Camera,
  useImperialSystem: boolean,
  t: Translator,
  fontSize: number,
  color = colors.blue50,
  horizontalDistance: boolean,
): Sprite {
  tempStart.copy(start)
  tempEnd.copy(end)
  if (horizontalDistance) {
    tempStart.setZ(0)
    tempEnd.setZ(0)
  }
  const length = tempStart.distanceTo(tempEnd)
  const spriteMaterial = createTextMaterial(formatLength(t, length, useImperialSystem), color)
  spriteMaterial.rotation = getScreenAngle(start, end, camera, sceneManager.canvas)
  const sprite = new Sprite(spriteMaterial)
  sprite.renderOrder = 1

  if (camera instanceof OrthographicCamera) {
    const distanceToCamera = camera.position.clone().sub(sprite.getWorldPosition(reuseVector)).length() / camera.zoom

    const scale = distanceToCamera / SCALING_COEFFICIENT
    const scaleVector = new Vector3(scale, scale / 2, 1)
    sprite.scale.copy(scaleVector)
  } else {
    const scalingCoefficient = getScalingCoefficient(fontSize, 120)
    sprite.scale.set(scalingCoefficient, scalingCoefficient / 2, 1)
  }

  return sprite
}
