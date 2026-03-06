import { batch, useComputed, useSignal, useSignalEffect, type ReadonlySignal } from "@preact/signals"
import type { ElementClipboardValue } from "./types"
import { useReadonlySignal } from "src/lib/signal"
import { useEffect } from "preact/hooks"
import { defaultCursor, loadingCursor } from "src/integrations/cursors/setCursor"
import type { Renderable } from "src/integrations/renderables/renderable"
import { getAffineSnapFromSnappingLines, type AffineSnap } from "src/integrations/snapping/snapping"
import { elementState } from "src/core/elements/ElementState"
import { downloadAllElementData } from "src/core/elements-loading/downloadAllElementData"
import { ElementContainer } from "src/core/elements/ElementContainer"
import type { KnownRepresentations } from "src/core/elements/ElementRepresentations"
import { isDefined } from "src/lib/array"
import { BufferAttribute, Color, Matrix4, Object3D, Vector3 } from "three"
import { mergePath } from "src/lib/element/path"
import { captureException } from "@sentry/browser"
import { contextRootSignal } from "src/core/selection/selectionState"
import { newChildKey } from "src/lib/element/urn"
import {
  snappingLineFromPartialSnappingLine,
  transformedSnappingLine,
} from "src/core/elements/child-node-container-derived-data/snapping"
import { raycast } from "src/core/terrain/2d-raytracer"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import { screenResolutionVector } from "src/core/three/sceneManager"
import type { Urn } from "@spacemakerai/element-types"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export function useClipboardValuesPreviewData(
  clipboardValuesSignal: ReadonlySignal<ElementClipboardValue[] | null>,
  exitPaste: () => void,
) {
  const loadingSignal = useSignal(false)
  const loading = loadingSignal.value
  const exitPasteSignal = useReadonlySignal(exitPaste)

  useEffect(() => {
    if (loading) {
      loadingCursor()
    }
    return () => {
      defaultCursor()
    }
  }, [loading])

  const renderables3dSignal = useSignal<Renderable[] | null>(null)
  const outlines3dSignal = useSignal<Float32Array[] | null>(null)
  const renderables2dSignal = useSignal<Renderable[] | null>(null)
  const movingAffineSnapSignal = useSignal<AffineSnap[]>([])
  useSignalEffect(() => {
    const clipboardValues = clipboardValuesSignal.value
    if (!clipboardValues) return
    const missingUrnsValues = clipboardValuesSignal.value.filter(
      (cv) => !elementState.currentSnapshot.peek().getNode(cv.urn),
    )
    if (missingUrnsValues.length > 0) loadingSignal.value = true
    downloadAllElementData(new Set(missingUrnsValues.map((cv) => cv.urn)))
      .then(({ elements: fetchedElements, representations }) => {
        function getElementContainer(urn: Urn): ElementContainer | undefined {
          const fetchedElement = fetchedElements.get(urn)?.element
          if (!fetchedElement) return undefined

          const knownRepresentations: KnownRepresentations = {
            volumeMesh: representations.volumeMesh.get(urn),
            footprint: representations.footprint.get(urn),
            terrainShape: representations.terrainShape.get(urn),
            terrainTexture: representations.terrainTexture.get(urn),
            buildingFloors3DSketch_UNSTABLE: undefined,
          }
          const childContainers = fetchedElement.children
            ?.map((child) => getElementContainer(child.urn))
            .filter(isDefined)
          return ElementContainer.fromServerElement(fetchedElement, childContainers, knownRepresentations)
        }

        const renderables3D: Renderable[] = []
        const outlines3D: Float32Array[] = []
        const renderables2D: Renderable[] = []
        const affineSnapData: AffineSnap[] = []

        function addRenderData(elementContainer: ElementContainer, transform: Matrix4, path: string) {
          const transform2D = transform.clone()
          transform2D.elements[14] = 0 // Assumes we're not rotating X/Y. Just set all to Z=0 for now.
          const elementRenderables3d = elementContainer.renderable3d.getOrCompute()
          if (elementRenderables3d)
            elementRenderables3d.forEach((r) =>
              renderables3D.push({ ...r, geometry: r.geometry.clone().applyMatrix4(transform), id: path }),
            )

          const scaleVector = new Vector3().setFromMatrixScale(transform)
          const assumedUniformScale = scaleVector.x
          const elementRenderables2d = elementContainer.renderable2d({ scale: assumedUniformScale }).getOrCompute()
          if (elementRenderables2d)
            elementRenderables2d.forEach((r) =>
              renderables2D.push({ ...r, geometry: r.geometry.clone().applyMatrix4(transform2D), id: path }),
            )

          const outlines = elementContainer.outlines.getOrCompute()
          if (outlines) outlines3D.push(transformOutlineCoordinates(outlines, transform))

          elementContainer.element.children?.forEach((child) => {
            const childElementContainer = elementContainer.childrenByUrn.get(child.urn)
            if (!childElementContainer) return
            const childTransform = child.transform ? new Matrix4().fromArray(child.transform) : new Matrix4()
            addRenderData(childElementContainer, transform.clone().multiply(childTransform), mergePath(path, child.key))
          })
        }

        clipboardValues.forEach((cv) => {
          const transform = cv.transform ? new Matrix4().fromArray(cv.transform) : new Matrix4()
          const existingNode = elementState.currentProposalSignal
            .peek()
            .getToplevelNodes()
            .find((n) => n.urn === cv.urn && n.globalMatrix.equals(transform))

          const terrain = terrainSignal.peek()
          // Using snap info only for top level nodes
          if (existingNode) {
            const nodeWithDescendants = elementState.currentProposalSignal
              .peek()
              .snapshot.getNodesWithAllDescendants([existingNode])
            nodeWithDescendants.forEach((node) => {
              affineSnapData.push(existingNode.affineSnapInfo(terrain.terrainSamplerData).getOrCompute())
              renderables3D.push(...node.renderables3d.getOrCompute())
              renderables2D.push(...(node.renderables2d.getOrCompute() || []))
              const outlines = node.outlines.getOrCompute()
              if (outlines) outlines3D.push(outlines)
            })
          } else {
            const elementContainer = getElementContainer(cv.urn)
            if (!elementContainer) {
              captureException(new Error("Element container not found for clipboard value"))
              return
            }
            const path = mergePath(contextRootSignal.peek(), newChildKey())
            addRenderData(elementContainer, transform, path)
            const partialSnappingLines = elementContainer.snappingLines.getOrCompute()
            const snappingLines = partialSnappingLines
              .map((partialSnappingLine) => transformedSnappingLine(partialSnappingLine, transform))
              .map((psl) =>
                snappingLineFromPartialSnappingLine(
                  psl,
                  (x: number, y: number) => raycast(x, y, terrain.terrainSamplerData),
                  path,
                ),
              )
            const affineSnap = getAffineSnapFromSnappingLines(snappingLines, path)
            affineSnapData.push(affineSnap)
          }
        })
        batch(() => {
          loadingSignal.value = false
          renderables3dSignal.value = renderables3D
          renderables2dSignal.value = renderables2D
          movingAffineSnapSignal.value = affineSnapData
          outlines3dSignal.value = outlines3D
        })
      })
      .catch((e) => {
        captureException(new Error("Error while pasting clipboard contents", { cause: e }))
        exitPasteSignal.value()
        throw e
      })
  })

  const moveGroup3dSignal = useComputed(() => {
    const renderables3d = renderables3dSignal.value
    if (renderables3d === null) return undefined

    const group = new Object3D()
    if (!renderables3d || renderables3d.length === 0) return group
    const renderables3dCopied = renderables3d.map((r) => {
      return { ...r, geometry: r.geometry.clone() } as Renderable
    })
    if (renderables3dCopied.length === 0) return group

    const outlines3d = outlines3dSignal.value
    if (outlines3d !== null) {
      const outlineMesh = outlinesArraysToMesh(outlines3d)
      group.add(outlineMesh)
    }

    const renderGroup = new RenderGroup("paste-renderables-3d")
    renderGroup.update(renderables3dCopied)
    group.add(renderGroup)
    return group
  })

  const moveGroup2dSignal = useComputed(() => {
    const renderables2d = renderables2dSignal.value
    if (renderables2d === null) return undefined

    if (!renderables2d || renderables2d.length === 0) return new Object3D()
    const renderables2dCopied = renderables2d.map((r) => ({ ...r, geometry: r.geometry.clone() }) as Renderable)
    const group = new RenderGroup("paste-renderables-2d")
    group.update(renderables2dCopied)
    return group
  })

  const moveGroup3d = moveGroup3dSignal.value
  const moveGroup2d = moveGroup2dSignal.value
  const movingAffineSnap = movingAffineSnapSignal.value
  return { moveGroup3d, moveGroup2d, movingAffineSnap }
}

function transformOutlineCoordinates(array: Float32Array, matrix: Matrix4): Float32Array {
  const clone = new Float32Array(array)
  new BufferAttribute(clone, 3).applyMatrix4(matrix)
  return clone
}

const outlineMaterial = new LineMaterial({
  color: new Color("#006EAF"),
  linewidth: 2,
  resolution: screenResolutionVector,
})

const outlinesArraysToMesh = (outlines: Float32Array[]) => {
  const outlineArray = new Float32Array(outlines.reduce((acc, o) => acc + o.length, 0))
  let posPtr = 0
  outlines.forEach((o) => {
    outlineArray.set(o, posPtr)
    posPtr += o.length
  })
  const outlineGeometry = new LineSegmentsGeometry()
  outlineGeometry.setPositions(outlineArray)
  return new LineSegments2(outlineGeometry, outlineMaterial)
}
