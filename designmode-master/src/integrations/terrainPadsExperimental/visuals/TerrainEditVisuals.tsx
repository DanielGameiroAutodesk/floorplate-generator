import type { TerrainOperation } from "src/core/terrain/terrain-types"
import type { BufferGeometry } from "three"
import { Mesh, type ShaderMaterial } from "three"
import { createPreviewShapeVisuals, getShapes2DMask, noMaskTexture, usePadTerrainMaterials } from "./internal/visuals"
import { useEffect, useLayoutEffect, useMemo } from "preact/hooks"
import sceneManager from "src/core/three/sceneManager"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { signal } from "@preact/signals"
import type { Terrain } from "src/core/elements/Terrain"

const updateMaterialUniforms = (material: ShaderMaterial, uniforms: Record<string, any>) => {
  Object.entries(uniforms).forEach(([key, value]) => {
    material.uniforms[key].value = value
  })
}

const createPreviewShape = (terrainOperation: TerrainOperation, terrainGeo: BufferGeometry) => {
  const meshedPads = terrainApi.getMeshedPads([terrainOperation], terrainGeo)

  return meshedPads.map((pad) => {
    const outerVertices = pad.coordinates[0]
    const outlinesPositions = outerVertices.slice(1).flatMap((v, i) => [...outerVertices[i], ...v])
    return { geometry: pad.mesh.geometry, outlines: outlinesPositions, outerVertices }
  })
}

type TerrainEditVisualizationSettings = { previewOp?: TerrainOperation; highlightZ?: number }
export const terrainEditVisualizationSignal = signal<TerrainEditVisualizationSettings>({})

export function TerrainEditVisuals({ currentTerrain }: { currentTerrain: Terrain }) {
  const { previewOp, highlightZ } = terrainEditVisualizationSignal.value
  const { padTerrainMaterial, padMaterial } = usePadTerrainMaterials()

  useEffect(() => {
    padTerrainMaterial.uniforms.highlightZ.value = highlightZ ?? previewOp?.elevation ?? -10000
  }, [previewOp, highlightZ, padTerrainMaterial])

  const editedOpIndex = useMemo(() => {
    return previewOp ? terrainApi.getTerrainOperationIndex(currentTerrain.element, previewOp.id) : undefined
  }, [currentTerrain.element, previewOp])

  const modeTerrainGeo = useMemo(() => {
    const terrainOperations = currentTerrain.element.properties.terrain_mode_operations ?? []
    const initTerrainGeo = currentTerrain.data.baseTerrain!.baseTerrainGeometry
    const otherPads = terrainOperations.filter((_, i) => i !== editedOpIndex)
    const { mesh } = terrainApi.applyTerrainPads(
      otherPads,
      initTerrainGeo,
      new Mesh(initTerrainGeo.clone(), padTerrainMaterial),
      currentTerrain.element.properties,
    )
    return mesh.geometry
  }, [currentTerrain, editedOpIndex, padTerrainMaterial])

  const modeTerrain = useMemo(() => {
    const mesh = new Mesh(modeTerrainGeo, padTerrainMaterial)
    mesh.renderOrder = -1
    return mesh
  }, [padTerrainMaterial, modeTerrainGeo])
  useObjectLifecycle(modeTerrain)

  useLayoutEffect(() => {
    currentTerrain.mesh.visible = false
    sceneManager.render()
    return () => {
      currentTerrain.mesh.visible = true
      sceneManager.render()
    }
  }, [currentTerrain.mesh, currentTerrain.mesh.visible])

  const padPreviewMesh = useMemo(() => {
    if (!previewOp) {
      const resetMaskSettings = { discardMask: noMaskTexture }
      updateMaterialUniforms(padTerrainMaterial, resetMaskSettings)
      return undefined
    }
    const geometry = createPreviewShape(previewOp, modeTerrainGeo)
    const discardMaskSettings = getShapes2DMask([geometry[0].geometry])
    updateMaterialUniforms(padTerrainMaterial, discardMaskSettings)
    return createPreviewShapeVisuals(geometry, currentTerrain.element, padMaterial)
  }, [currentTerrain, previewOp, modeTerrainGeo, padMaterial, padTerrainMaterial])
  useObjectLifecycle(padPreviewMesh)

  return null
}
