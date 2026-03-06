import { signal } from "@preact/signals"
import { Color, DataTexture, InstancedBufferAttribute, Mesh, RGBAFormat } from "three"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { createSelectionOutlineMaterial } from "src/integrations/renderables/SelectionOutlineMaterial"
import sceneManager from "src/core/three/sceneManager"
import type { SelectionPath } from "src/core/selection/selectionTypes"

function toArray(color: string, thickness: number) {
  const colorArr = new Color(color)
    .convertLinearToSRGB()
    .toArray()
    .map((_) => Math.floor(_ * 255))
  return new Uint8Array(colorArr.concat(thickness))
}
const texhidden = toArray("#0696D7", 1)
const texhovered = toArray("#0696D7", 4) // Equivalent to #0696D7 at 50% opacity on white background, per Figma
const texselected = toArray("#006EAF", 5)
const texselectedandhovered = toArray("#006EAF", 4)

type Data = { id: string; pos: Float32Array }

function createOutlines() {
  const outlinesSignal = signal(new Mesh(new LineSegmentsGeometry().setPositions([]), createSelectionOutlineMaterial()))
  const datasSignal = signal<Data[]>([])

  function setGeometry(data: Record<SelectionPath, Float32Array>) {
    outlinesSignal.peek().geometry.dispose()

    let _datas: Data[] = []
    let totalPosLength = 0
    for (const [id, position] of Object.entries(data)) {
      _datas.push({ id, pos: position })
      totalPosLength += position.length
    }

    const position = new Float32Array(totalPosLength)
    const id = new Float32Array(totalPosLength / 6)
    let posPtr = 0
    let idPtr = 0
    for (let i = 0; i < _datas.length; i++) {
      const data = _datas[i]
      position.set(data.pos, posPtr)
      posPtr += data.pos.length
      for (let j = 0; j < data.pos.length / 6; j++) {
        id[idPtr++] = i
      }
    }
    outlinesSignal.peek().geometry.setPositions(position)
    outlinesSignal.peek().geometry.setAttribute("id", new InstancedBufferAttribute(id, 1))

    const width = Math.max(1, Math.min(_datas.length, 4096))
    const dimensions = [width, Math.ceil(_datas.length / width)]
    const textureData = new Uint8Array(dimensions[0] * dimensions[1] * 4)
    outlinesSignal.peek().material.uniforms.stateTexture.value = new DataTexture(
      textureData,
      dimensions[0],
      dimensions[1],
      RGBAFormat,
    )
    outlinesSignal.peek().material.uniforms.stateTexture.value.needsUpdate = true
    outlinesSignal.peek().material.uniforms.dim.value = dimensions

    datasSignal.value = _datas
  }

  function setSelection(selection: Set<string>, hover: Set<string>) {
    let ptr = 0
    const textureData = outlinesSignal.peek().material.uniforms.stateTexture.value.source.data.data
    for (let i = 0; i < datasSignal.peek().length; i++) {
      const data = datasSignal.peek()[i]
      let arr = texhidden
      const isSelected = selection.has(data.id)
      const isHovered = hover.has(data.id)

      if (isSelected && isHovered) {
        arr = texselectedandhovered
      } else if (isSelected) {
        arr = texselected
      } else if (isHovered) {
        arr = texhovered
      }
      textureData.set(arr, ptr)
      ptr += 4
    }
    outlinesSignal.peek().material.uniforms.stateTexture.value.needsUpdate = true
    sceneManager.render()
  }

  return {
    setSelection,
    setGeometry,
    meshSignal: outlinesSignal,
  }
}

export default {
  createOutlines,
}
