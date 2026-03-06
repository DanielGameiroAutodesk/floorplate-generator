import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import type { Matrix4 } from "three"
import { Vector3 } from "three"
import { useEffect, useMemo } from "preact/hooks"
import type { Renderable } from "src/integrations/renderables/renderable"
import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { ThreePolygonLine } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/ThreePolygonLine"
import { subdividePolygon } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/polygon"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import { lockedMaterial, solidMaterial } from "./materials"
import { createTransformFromLineSegments } from "./utils"
import type { Segment } from "src/lib/geometry/geometryTypes"
import { raycast } from "src/core/terrain/2d-raytracer"
import { selectedNodesSignal } from "src/core/selection/selectionState"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const renderGroup = new RenderGroup("transform2d preview")

export const makePreviewComponent =
  (
    originalLineSegment: Segment | undefined,
    referencePointMode: boolean,
    accumulatedTransform: Matrix4,
  ): LineSegmentRenderer =>
  ({ lineSegment: newLineSegment }) => {
    // Ignoring lint rule as this is an edge case where this is
    // returning an component.
    // eslint-disable-next-line local/signals-explicit-naming
    const selectedNode = selectedNodesSignal.value[0]

    const matrix = useMemo(() => {
      let matrix = accumulatedTransform
      if (!referencePointMode && newLineSegment && originalLineSegment) {
        matrix = createTransformFromLineSegments(newLineSegment, originalLineSegment).multiply(accumulatedTransform)
      }
      return matrix
    }, [newLineSegment])

    const previewRenderable: Renderable[] = useMemo(() => {
      if (!selectedNode) return []

      const renderables = selectedNode.renderables2d.getOrCompute()?.map((renderable) => ({ ...renderable })) ?? []
      renderables.forEach((renderable) => {
        renderable.geometry = renderable.geometry.clone().applyMatrix4(matrix)
        renderable.mode = referencePointMode ? "normal" : "faint"
      })

      return renderables
    }, [selectedNode, matrix])

    useEffect(() => {
      renderGroup.update(previewRenderable)
      sceneManager.render(false, true)
      return () => {
        renderGroup.clear()
        sceneManager.render(false, true)
      }
    }, [previewRenderable])

    useObjectLifecycle(renderGroup, true, sceneManager.overlay.scene, false)

    const outline = useMemo(() => {
      return new ThreePolygonLine([], true, referencePointMode ? lockedMaterial : solidMaterial)
    }, [])

    useObjectLifecycle(outline, true, sceneManager.scene, false)

    const terrain = terrainSignal.value.terrainSamplerData
    const outlineVertices = useMemo(() => {
      if (!selectedNode) return []
      const footprint = selectedNode.elementContainer.representations.footprint
      if (!footprint || footprint.geometry.type !== "Polygon") return []
      let vertices = footprint.geometry.coordinates[0].map((coord) => {
        const vertex = new Vector3(coord[0], coord[1], 0)
        if (selectedNode.globalMatrix) {
          vertex.applyMatrix4(selectedNode.globalMatrix)
        }
        vertex.applyMatrix4(matrix)
        return vertex
      })
      vertices = subdividePolygon(vertices, 1, true)
      vertices.forEach((vertex) => {
        return vertex.setZ(raycast(vertex.x, vertex.y, terrain))
      })
      return vertices
    }, [selectedNode, matrix, terrain])

    useEffect(() => {
      outline.updatePolygon(outlineVertices)
    }, [outlineVertices, outline])

    return null
  }
