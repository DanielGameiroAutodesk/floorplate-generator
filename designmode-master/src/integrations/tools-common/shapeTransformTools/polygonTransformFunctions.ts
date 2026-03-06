import type { Geom, MultiPolygon } from "polygon-clipping"
import {
  contextRootSignal,
  selectedTopLevelNodesSignal,
  selectionArraySignal,
  selectionSetSignal,
} from "src/core/selection/selectionState"
import { isDefined } from "src/lib/array"
import type { Feature, Polygon, Position } from "geojson"
import type { Matrix4 } from "three"
import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three"
import { HiddenPaths } from "src/core/hidden"
import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import { geometryFromGeojson } from "src/lib/three/geometryFromGeojson"
import { copyColor } from "src/lib/three/basic-geometry-utils"
import type { Renderable } from "src/integrations/renderables/renderable"
import { RenderingSpecs } from "src/integrations/renderables/renderable"
import sceneManager from "src/core/three/sceneManager"
import type { FormaElement } from "@spacemakerai/element-types"
import { PROJECT_ID } from "src/core/project/project"
import { proposalIdSignal } from "src/core/proposal"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { buildRenderablesFromGeojson } from "src/integrations/renderables/buildRenderablesFromGeojson"
import { newChildKey, newId, newRevision } from "src/lib/element/urn"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { Action } from "src/core/legacy-actions"
import { calculateEdgesGeometry, edgesPositionFromBox3, setGeometryColor } from "src/lib/three/geometryUtils"
import { DEFAULT_COLOR_2D, DEFAULT_OPACITY_2D } from "src/lib/three/defaultRenderingProperties"
import type { InternalPath } from "src/lib/element/path"
import { featureToTerrainShape } from "src/integrations/basic-elements/api/terrainShape"
import { elementState } from "src/core/elements/ElementState"
import { assertIsDefined } from "src/lib/assertions"
import { useIsImperial } from "src/lib/unitSettings"

const toWorldVec = new Vector3()

function applyMatrix([x, y]: Position, matrix?: Matrix4): [number, number] {
  toWorldVec.set(x, y, 0)
  if (matrix) {
    toWorldVec.applyMatrix4(matrix)
  }
  return [toWorldVec.x, toWorldVec.y]
}

function applyMatrixToPositions(positions: Position[], matrix?: Matrix4) {
  return positions.map((p) => applyMatrix(p, matrix))
}

export type TransformPolygonFunction = () => {
  features: Feature<Polygon>[]
  actions: Action[]
  isValid: boolean
  addedKeys?: Set<InternalPath>
}

export const useCalculatePolygons = (
  operation: (geom: Geom, ...geoms: Geom[]) => MultiPolygon,
  deleteOperands: boolean,
) => {
  const api = useActionAPI()
  return useCallback(() => {
    const selection = selectedTopLevelNodesSignal.peek()

    const contextRoot = contextRootSignal.peek()
    const proposalId = proposalIdSignal.peek()

    const mainOperand = selection[0]

    const [first, ...rest] = selection
      .map((node) => {
        let geojson = node.elementContainer.representations.footprint
        if (!geojson || !(geojson.geometry.type === "Polygon")) return undefined
        return geojson.geometry.coordinates.map((positions) => applyMatrixToPositions(positions, node.globalMatrix))
      })
      .filter(isDefined)

    if (!isDefined(first))
      return {
        features: [],
        actions: [],
        newActions: [],
        isValid: true,
      }

    const result = operation(first, rest)

    const elementWorldTransform = mainOperand.globalMatrix

    // TODO: It looks like it can't correctly assume that mainOperand is always a footprint element?
    const originalGeojson = assertIsDefined(
      "Expected first top level selection node to have have footprint",
      mainOperand.elementContainer.representations.footprint,
    )
    const features: Feature<Polygon>[] = result.map((poly) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: poly.map((p) => applyMatrixToPositions(p, elementWorldTransform?.clone().invert())),
      },
      properties: originalGeojson.properties,
    }))
    const originalElement = mainOperand.elementContainer.element
    const properties = {
      ...originalElement.properties,
    }
    if (properties.circleDefinition) {
      delete properties.circleDefinition //No longer a circle
    }

    const selectedPaths = selectionSetSignal.peek()
    if (selectedPaths.size <= 1)
      return {
        features: [],
        actions: [],
        isValid: true,
      }

    const actions = [] as Action[]
    const addedKeys = new Set<InternalPath>()

    features.forEach((feature) => {
      if (feature.geometry.coordinates.length > 1) {
        feature.geometry.coordinates = [feature.geometry.coordinates[0]] //Remove holes
      }
      const geometry = geometryFromGeojson(feature)

      const id = `${proposalId}+${newId()}`
      const element: FormaElement = {
        urn: `urn:adsk-forma-elements:basic:${PROJECT_ID}:${id}:${newRevision()}`,
        properties,
      }

      const terrainShape = !(feature.properties && "height" in feature.properties)
        ? featureToTerrainShape(feature, element)
        : undefined

      const key = newChildKey()
      const transform = mainOperand.globalMatrix?.toArray()

      const addActions = api.add.one(element, false, {
        child: { key, transform },
        representations: {
          footprint: feature,
          terrainShape,
          volumeMesh: geometry,
          terrainTexture: undefined,
          buildingFloors3DSketch_UNSTABLE: undefined,
        },
        parentPath: contextRoot,
      })

      actions.push(...addActions)
      addedKeys.add(`${contextRoot}/${key}`)
    })

    const selectedPathsArray = Array.from(selectedPaths)
    const elementsToDelete = deleteOperands ? selectedPathsArray : selectedPathsArray.slice(0, 1)

    if (elementsToDelete.length) {
      actions.push(...api.delete.multiple(elementsToDelete))
    }

    return {
      features,
      actions,
      isValid: true,
      addedKeys,
    }
  }, [operation, deleteOperands, api])
}

export const useTransformPolygonsPreview = (operator: TransformPolygonFunction) => {
  const selected = selectionArraySignal.value
  const proposal = elementState.currentProposalSignal.value

  const previewGroup3d = useMemo(() => new RenderGroup("Boolean operation Preview 3D"), [])
  const previewGroup2d = useMemo(() => new RenderGroup("Boolean operation Preview 2D"), [])
  const isImperial = useIsImperial()

  const [showPreview, setShowPreview] = useState(false)
  useObjectLifecycle(previewGroup3d, showPreview)
  useObjectLifecycle(previewGroup2d, showPreview, sceneManager.overlay.scene, false)

  useEffect(() => {
    if (!showPreview) return

    const renderables3D: Renderable[] = selected
      .map((s) => proposal.snapshot.nodes.get(s))
      .filter(isDefined)
      .filter((node) => node !== proposal.terrain?.node)
      .flatMap((node) => [...node.renderableForOutlines.getOrCompute(), ...node.renderables3d.getOrCompute()])
      .map((r) => {
        if (RenderingSpecs[r.spec].drawMode === "LineSegments") {
          return {
            ...r,
            spec: "basicLines",
            mode: "faint",
          } as Renderable
        } else {
          return {
            ...r,
            spec: "previewDeletion",
            mode: "normal",
          }
        }
      })
    const firstSelectedNode = proposal.snapshot.getNodeOrThrow(selected[0])
    const features = operator().features

    const resultRenderables3d = features
      .map(geometryFromGeojson)
      .filter(isDefined)
      .flatMap((geometry) => {
        firstSelectedNode.globalMatrix && geometry.applyMatrix4(firstSelectedNode.globalMatrix)
        let existingGeom = firstSelectedNode.renderables3d.getOrCompute()[0].geometry

        copyColor(existingGeom, geometry)
        let existingRenderable = firstSelectedNode.renderables3d.getOrCompute()[0]
        const volume: Renderable = {
          ...existingRenderable,
          geometry: geometry,
        }
        let outlines = calculateEdgesGeometry(geometry)
        if (!outlines) {
          if (!geometry.boundingBox) geometry.computeBoundingBox()
          outlines = edgesPositionFromBox3(geometry.boundingBox)
        }
        const outlinegeo = new BufferGeometry()
        outlinegeo.setAttribute("position", new BufferAttribute(outlines, 3))
        const outlinesRenderable: Renderable = {
          geometry: outlinegeo,
          id: "new-outline",
          mode: "normal",
          spec:
            firstSelectedNode.elementContainer.element.properties?.category === "constraints"
              ? "constraintOutline"
              : "basicLines",
        }
        return [volume, outlinesRenderable]
      })
    const resultRenderables2d = features.flatMap((feat) => {
      return buildRenderablesFromGeojson(
        feat,
        firstSelectedNode.elementContainer.element.properties?.category,
        firstSelectedNode.globalMatrix,
        firstSelectedNode.elementContainer.element.properties?.color ?? DEFAULT_COLOR_2D,
        firstSelectedNode.elementContainer.element.properties?.opacity ?? DEFAULT_OPACITY_2D,
        "new",
        undefined,
        isImperial,
        firstSelectedNode.elementContainer.element.properties,
      )
    })

    const renderables2D: Renderable[] = selected
      .map((s) => proposal.snapshot.nodes.get(s))
      .filter(isDefined)
      .flatMap((node) => node.renderables2d.getOrCompute())
      .filter(isDefined)
      .map((r: Renderable) => {
        return {
          ...r,
          geometry: setGeometryColor(new Color("#000000"), r.geometry.clone(), 0.2),
          mode: "faint",
        }
      })

    previewGroup3d.update(renderables3D.concat(resultRenderables3d))
    previewGroup2d.update(renderables2D.concat(resultRenderables2d))
    resultRenderables3d.length && sceneManager.render()
    resultRenderables2d.length && sceneManager.render(false, true)
  }, [selected, operator, showPreview, previewGroup2d, previewGroup3d, isImperial, proposal])

  useEffect(() => {
    if (!showPreview) return
    HiddenPaths.setHiddenPathsSignalValue(new Set(selected))
    return () => {
      HiddenPaths.resetHiddenPaths()
    }
  }, [showPreview, selected])

  return setShowPreview
}
