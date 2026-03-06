import { useComputed } from "@preact/signals"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { type ReadonlySignalHack, useReadonlySignal } from "src/lib/signal"
import type { Material, WebGLRenderer } from "three"
import { DoubleSide, Group, Mesh, MeshBasicMaterial } from "three"
import type { TerrainExtents } from "./stencil-volumes"
import {
  getGeometryForStencilVolume,
  getStencilVolumeForPolygon,
  mergeStencilVolumesByColorAndOpacity,
} from "./stencil-volumes"
import type { MultiRingPolygon } from "forma-elements"
import PolygonBoolean from "polygon-clipping"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export type SurfacesToVisualize = {
  polygons: MultiRingPolygon[]
  color: string
  opacity?: number
}

/*
 * To display highlighted area stats surfaces, we do the following rendering steps:
 *  1. Let the usual scene finish rendering
 *  2. Clear the depth buffer
 *  3. Render the terrain again, but only into the depth buffer
 *  4. Render stencil volumes (extruded volumes based on the area stats surfaces) and populate the
 *     stencil buffer with the intersection of the stencil volume with the terrain mesh
 *  5. Render color into the pixels of the intersection (as indicated by the stencil buffer)
 */

const SURFACE_OPACITY = 0.7

const terrainMat = new MeshBasicMaterial({ side: DoubleSide, transparent: true, colorWrite: false })
const stencilMat = new MeshBasicMaterial({ side: DoubleSide, transparent: true, colorWrite: false, depthWrite: false })
const colorMat = new MeshBasicMaterial({ side: DoubleSide, transparent: true, vertexColors: true, depthTest: false })

function stencilMaterialOnBeforeRender(renderer: WebGLRenderer, _s: any, _c: any, _g: any, material: Material) {
  const gl = renderer.getContext()
  gl.enable(gl.STENCIL_TEST)
  gl.stencilFunc(gl.ALWAYS, 0, 0xff)
  gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.INCR_WRAP, gl.KEEP)
  gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.DECR_WRAP, gl.KEEP)

  // Small hack: We need all meshes in this file to render at the very end of the rendering cycle
  // (in order to clear the depth buffer and mess around without interfering with other geometry
  // being rendered). However, three.js has special logic to sort ALL transparent objects into a
  // separate pile that gets rendered after everything solid. Thus, we need to "pretend" that all
  // our materials here are transparent, even if they aren't, to get them to sort after everything
  // else. At render-time, after sorting has been done, we switch behavior back to non-transparent
  material.transparent = false
}

function colorMaterialOnBeforeRender(renderer: WebGLRenderer) {
  const gl = renderer.getContext()
  gl.enable(gl.STENCIL_TEST)
  gl.stencilFunc(gl.NOTEQUAL, 0, 0xff)
  gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.ZERO)
  gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.ZERO)
}

function onAfterRender(renderer: WebGLRenderer, _s: any, _c: any, _g: any, material: Material) {
  const gl = renderer.getContext()
  gl.disable(gl.STENCIL_TEST)
  material.transparent = true
}

export function RenderSurfaces({ surfacesSignal }: { surfacesSignal: ReadonlySignalHack<SurfacesToVisualize[]> }) {
  return surfacesSignal.value.length > 0 ? <RenderSurfacesInner surfaces={surfacesSignal.value} /> : null
}

const START_RENDER_ORDER = 100

function RenderSurfacesInner({ surfaces }: { surfaces: SurfacesToVisualize[] }) {
  const surfacesSignal = useReadonlySignal(surfaces)
  const terrainExtentsSignal = useComputed<TerrainExtents>(() => ({
    lowestElevation: terrainSignal.value.terrainSamplerData.bbox.min.z,
    highestElevation: terrainSignal.value.terrainSamplerData.bbox.max.z,
  }))

  const terrainMeshSignal = useComputed(() => {
    const originalTerrainMesh = terrainSignal.value.mesh
    const terrainMesh = new Mesh(originalTerrainMesh.geometry, terrainMat)
    terrainMesh.renderOrder = START_RENDER_ORDER
    terrainMesh.onBeforeRender = (renderer: WebGLRenderer) => {
      const gl = renderer.getContext()
      // Don't know why the next line is needed, but apparently, at some specific camera angles,
      // writing to the depth buffer is disabled by three.js?? Let's just force it back to true
      gl.depthMask(true)
      renderer.clearDepth()
    }
    return terrainMesh
  })

  const stencilMeshesSignal = useComputed(() => {
    const surfaces = surfacesSignal.value
    const roundedSurfaces = surfaces.map((s) => ({ ...s, polygons: s.polygons.map(roundPolygonCoordinates) }))
    const mergedSurfaces = groupSurfacesByColorAndOpacityAndMerge(roundedSurfaces)

    const stencilVolumes = mergedSurfaces.flatMap((surface) => {
      const opacity = surface.opacity ?? SURFACE_OPACITY
      return surface.polygons.flatMap((polygon) =>
        getStencilVolumeForPolygon(polygon, terrainExtentsSignal.value, surface.color, opacity),
      )
    })
    const mergedStencilVolumes = mergeStencilVolumesByColorAndOpacity(stencilVolumes)

    if (mergedStencilVolumes.length === 0) return undefined

    return new Group().add(
      ...mergedStencilVolumes.flatMap((stencilVolume, i) => {
        const geometry = getGeometryForStencilVolume(stencilVolume)
        const stencilMesh = new Mesh(geometry, stencilMat)
        stencilMesh.renderOrder = START_RENDER_ORDER + 1 + 2 * i
        stencilMesh.onBeforeRender = stencilMaterialOnBeforeRender
        stencilMesh.onAfterRender = onAfterRender

        const colorMesh = new Mesh(geometry, colorMat)
        colorMesh.renderOrder = START_RENDER_ORDER + 2 + 2 * i
        colorMesh.onBeforeRender = colorMaterialOnBeforeRender
        colorMesh.onAfterRender = onAfterRender

        return [stencilMesh, colorMesh]
      }),
    )
  })

  useObjectLifecycle(terrainMeshSignal.value)
  useObjectLifecycle(stencilMeshesSignal.value)
  return null
}

function roundPolygonCoordinates(polygon: MultiRingPolygon): MultiRingPolygon {
  const round = (x: number) => Math.fround(x)
  return polygon.map((ring) => ring.map(([x, y]) => [round(x), round(y)]))
}

function unionOfPolygons(polygons: MultiRingPolygon[]): MultiRingPolygon[] {
  if (polygons.length < 2) return polygons
  return PolygonBoolean.union(polygons[0], ...polygons.slice(1))
}

function groupSurfacesByColorAndOpacityAndMerge(surfaces: SurfacesToVisualize[]): SurfacesToVisualize[] {
  const groups: Record<string, SurfacesToVisualize[]> = {}
  surfaces.forEach((surface) => {
    const key = `${surface.color}-${surface.opacity}`
    if (!groups[key]) groups[key] = []
    groups[key].push(surface)
  })
  return Object.values(groups).map((surfacesInGroup) => {
    const color = surfacesInGroup[0].color
    const opacity = surfacesInGroup[0].opacity
    const unmergedPolygons = surfacesInGroup.flatMap((s) => s.polygons)
    const mergedPolygons = unionOfPolygons(unmergedPolygons)
    return { polygons: mergedPolygons, color, opacity }
  })
}
