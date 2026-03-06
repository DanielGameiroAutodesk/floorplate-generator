import { Color, DataTexture, InstancedBufferAttribute, Mesh, RGBAFormat } from "three"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import {
  highlightVisibilitySignal,
  hoveredSelectionPathsSignal,
  selectionPathsSignal,
  selectionVisibilitySignal,
} from "src/core/selection/selectionState"
import { useLayoutEffect, useMemo } from "preact/compat"
import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { HiddenPaths } from "src/core/hidden"
import { createSelectionOutlineMaterial } from "./SelectionOutlineMaterial"
import { previewSetSignal } from "src/core/preview-element-state"
import { elementState } from "src/core/elements/ElementState"
import { getSelectablesForToplevelNode } from "src/core/elements/child-node-container-derived-data/selectables"
import {
  internalPathToSelectionPath,
  isCustomSelectionPath,
  type SelectionPath,
} from "src/core/selection/selectionTypes"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

function toArray(color: string, thickness: number) {
  const colorArr = new Color(color)
    .convertLinearToSRGB()
    .toArray()
    .map((_) => Math.floor(_ * 255))
  return new Uint8Array(colorArr.concat(thickness))
}

const texhidden = toArray("#000000", 0)

const texhovered = toArray("#0696D7", 3) // Equivalent to #0696D7 at 50% opacity on white background, per Figma
const texselected = toArray("#006EAF", 2)
const texselectedandhovered = toArray("#006EAF", 3)

const texhoveredbase = toArray("#b37bfc", 3)
const texselectedbase = toArray("#934def", 2)
const texselectedandhoveredbase = toArray("#934def", 3)

export type SelectionVisual = { selectionPath: SelectionPath; outlineArray: Float32Array; scenario: boolean }

export function SelectionVisualInner({
  selectionVisuals,
  selectedPaths,
  hoveredPaths,
  hiddenPaths,
  selectionVisible,
  highlightVisible,
}: {
  selectionVisuals: SelectionVisual[]
  selectedPaths: Set<SelectionPath>
  hoveredPaths: Set<SelectionPath>
  hiddenPaths: Set<SelectionPath>
  selectionVisible: boolean
  highlightVisible: boolean
}) {
  const outlines = useMemo(
    () => new Mesh(new LineSegmentsGeometry().setPositions([]), createSelectionOutlineMaterial()),
    [],
  )
  useObjectLifecycle(outlines, selectedPaths.size > 0 || hoveredPaths.size > 0)

  useLayoutEffect(() => {
    outlines.geometry.dispose()

    let totalPosLength = 0
    selectionVisuals.forEach((selectionVisual) => {
      totalPosLength += selectionVisual.outlineArray.length
    })

    const position = new Float32Array(totalPosLength)
    const id = new Float32Array(totalPosLength / 6)
    let posPtr = 0
    let idPtr = 0
    for (let i = 0; i < selectionVisuals.length; i++) {
      const data = selectionVisuals[i]
      position.set(data.outlineArray, posPtr)
      posPtr += data.outlineArray.length
      for (let j = 0; j < data.outlineArray.length / 6; j++) {
        id[idPtr++] = i
      }
    }
    outlines.geometry.setPositions(position)
    outlines.geometry.setAttribute("id", new InstancedBufferAttribute(id, 1))

    const width = Math.max(1, Math.min(selectionVisuals.length, 4096))
    const dimensions = [width, Math.ceil(selectionVisuals.length / width)]
    const textureData = new Uint8Array(dimensions[0] * dimensions[1] * 4)
    const stateTexture = new DataTexture(textureData, dimensions[0], dimensions[1], RGBAFormat)
    outlines.material.uniforms.stateTexture.value = stateTexture
    outlines.material.uniforms.stateTexture.value.needsUpdate = true
    outlines.material.uniforms.dim.value = dimensions
  }, [selectionVisuals, outlines.geometry, outlines.material.uniforms.dim, outlines.material.uniforms.stateTexture])

  useLayoutEffect(() => {
    let ptr = 0
    const textureData = outlines.material.uniforms.stateTexture.value.source.data.data
    for (let i = 0; i < selectionVisuals.length; i++) {
      const data = selectionVisuals[i]
      const hidden = hiddenPaths.has(data.selectionPath)
      const isSelected = !hidden && selectedPaths.has(data.selectionPath) && selectionVisible
      const isHovered = !hidden && hoveredPaths.has(data.selectionPath) && highlightVisible

      let arr = texhidden
      if (isSelected && isHovered) {
        arr = data.scenario ? texselectedandhoveredbase : texselectedandhovered
      } else if (isSelected) {
        arr = data.scenario ? texselectedbase : texselected
      } else if (isHovered) {
        arr = data.scenario ? texhoveredbase : texhovered
      }
      textureData.set(arr, ptr)
      ptr += 4
    }
    outlines.material.uniforms.stateTexture.value.needsUpdate = true
    sceneManager.render()
  }, [
    outlines.material.uniforms.stateTexture.value,
    selectionVisuals,
    selectedPaths,
    selectionVisible,
    hoveredPaths,
    highlightVisible,
    hiddenPaths,
  ])

  return null
}

export default function SelectionVisuals() {
  const selectedPaths = selectionPathsSignal.value
  const hoveredPaths = hoveredSelectionPathsSignal.value
  const hiddenElementPaths = HiddenPaths.hiddenPathsSignal.value
  const previewFilter = previewSetSignal.value
  const selectionVisible = selectionVisibilitySignal.value
  const highlightVisible = highlightVisibilitySignal.value
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value

  const selectionVisuals = useMemo(() => {
    let visuals: SelectionVisual[] = []
    proposal.getToplevelNodes().forEach((toplevelNode) =>
      getSelectablesForToplevelNode(toplevelNode, proposal, terrain).forEach((selectable) => {
        selectable.selectionOutlines.forEach((outlineArray) => {
          visuals.push({
            outlineArray,
            selectionPath: selectable.selectionPath,
            scenario: selectable.context == "base",
          })
        })
      }),
    )

    return visuals
  }, [proposal, terrain])

  const hiddenPaths: Set<SelectionPath> = useMemo(
    () =>
      new Set([
        ...[...hiddenElementPaths, ...previewFilter].map((path) =>
          isCustomSelectionPath(path) ? path : internalPathToSelectionPath(path),
        ),
      ]),
    [hiddenElementPaths, previewFilter],
  )

  return (
    <SelectionVisualInner
      selectionVisuals={selectionVisuals}
      selectedPaths={selectedPaths}
      hoveredPaths={hoveredPaths}
      hiddenPaths={hiddenPaths}
      selectionVisible={selectionVisible}
      highlightVisible={highlightVisible}
    />
  )
}
