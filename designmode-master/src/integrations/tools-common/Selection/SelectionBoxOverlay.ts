/**
 * Based on the work done in this THREE.js example
 * https://threejs.org/examples/misc_boxselection.html
 */

import { colors, opacityPercentage } from "src/lib/colors"

type Vec2 = { x: number; y: number }

export class SelectionBoxOverlay {
  private element: HTMLDivElement

  private startPoint: Vec2 = { x: 0, y: 0 }
  private pointTopLeft: Vec2 = { x: 0, y: 0 }
  private pointBottomRight: Vec2 = { x: 0, y: 0 }

  public isSelectionActive: boolean
  public isReady: boolean

  private parentDomElement: HTMLElement | null

  constructor(parentDomElement: HTMLElement | null, cssClassName: string) {
    this.element = document.createElement("div")
    this.element.classList.add(cssClassName)
    this.element.style.pointerEvents = "none"
    this.element.style.backgroundColor = `${colors.blue60}${opacityPercentage[10]}`
    this.element.style.position = "fixed"

    this.parentDomElement = parentDomElement

    this.isSelectionActive = false
    this.isReady = false
  }

  onSelectStart(event: MouseEvent) {
    this.element.style.left = event.clientX + "px"
    this.element.style.top = event.clientY + "px"
    this.element.style.width = "0px"
    this.element.style.height = "0px"

    this.startPoint.x = event.clientX
    this.startPoint.y = event.clientY
    this.isReady = true
  }

  activate() {
    if (!this.isSelectionActive) {
      this.parentDomElement?.appendChild(this.element)
      this.isSelectionActive = true
    }
  }

  onSelectMove(event: MouseEvent) {
    this.pointBottomRight.x = Math.max(this.startPoint.x, event.clientX)
    this.pointBottomRight.y = Math.max(this.startPoint.y, event.clientY)
    this.pointTopLeft.x = Math.min(this.startPoint.x, event.clientX)
    this.pointTopLeft.y = Math.min(this.startPoint.y, event.clientY)

    this.element.style.left = this.pointTopLeft.x + "px"
    this.element.style.top = this.pointTopLeft.y + "px"
    this.element.style.width = this.pointBottomRight.x - this.pointTopLeft.x + "px"
    this.element.style.height = this.pointBottomRight.y - this.pointTopLeft.y + "px"

    const includeIfOneCornerInside = this.startPoint.x - event.clientX > 0
    includeIfOneCornerInside
      ? (this.element.style.border = `1px dashed ${colors.blue50}`)
      : (this.element.style.border = `1px solid ${colors.blue50}`)
  }

  onSelectOver() {
    if (this.element.parentElement) this.element.parentElement.removeChild(this.element)
    this.isSelectionActive = false
    this.isReady = false
  }

  getSizeOfBox() {
    const topLeftX = this.pointTopLeft.x
    const topLeftY = this.pointTopLeft.y
    const bottomRightX = this.pointBottomRight.x
    const bottomRightY = this.pointBottomRight.y
    return Math.abs((bottomRightX - topLeftX) * (topLeftY - bottomRightY))
  }
}
