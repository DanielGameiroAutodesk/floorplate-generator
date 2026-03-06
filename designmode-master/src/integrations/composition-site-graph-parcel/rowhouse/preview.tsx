import styles from "./preview.module.css"
import type { Object3D } from "three"
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from "three"
import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { useLayoutEffect, useMemo } from "preact/compat"
import { featureAsPolygon } from "src/integrations/renderables/2d-polygon"
import type { Feature, Polygon } from "geojson"
import { DEFAULT_COLOR_2D, DEFAULT_OPACITY_2D } from "src/lib/three/defaultRenderingProperties"
import { generateColorArray } from "src/lib/three/geometryUtils"
import { RENDER_CANVAS_RESOLUTION, renderCanvas } from "src/lib/three/ThreeThumbnail"
import type { TerrainShape } from "src/lib/element/types"
import { EasingFunctions } from "src/lib/easing"
import type { ParcelParameters } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { calculateBuildingTransform } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import privateOutdoorSpaceGenerator from "src/integrations/composition-site-graph-parcel/privateOutdoorSpace/privateOutdoorSpaceGenerator"
import type { RowHouseParameters } from "src/integrations/composition-row-house-generator/api"
import { rowHouseApi } from "src/integrations/composition-row-house-generator/api"
import { PROJECT_ID } from "src/core/project/project"

const BASIC_MATERIAL = new MeshBasicMaterial({ vertexColors: true })
const TERRAIN_SHAPE_MATERIAL = new MeshBasicMaterial({
  vertexColors: true,
  side: DoubleSide,
  polygonOffset: true,
  polygonOffsetUnits: -4,
})
const LINES_MATERIAL = new LineBasicMaterial({
  polygonOffset: true,
  polygonOffsetFactor: -6,
  color: "#555555",
})

const MIN_ZOOM = 0.33
const MAX_ZOOM = 2.0

function animate(
  renderTarget: HTMLCanvasElement,
  meshes: Object3D[],
  from: CameraAngle,
  to: CameraAngle,
  zoom: number,
  durationMS: number,
) {
  const startTime = performance.now()

  function animateInner(timestamp: number) {
    const elapsed = timestamp - startTime
    const fraction = EasingFunctions.easeInOutSine(elapsed / durationMS)

    const phi = from.phi + (to.phi - from.phi) * fraction
    const theta = from.theta + (to.theta - from.theta) * fraction

    renderCanvas(renderTarget, meshes, phi, theta, zoom)

    if (elapsed < durationMS) {
      window.requestAnimationFrame(animateInner)
    } else {
      renderCanvas(renderTarget, meshes, to.phi, to.theta, zoom)
    }
  }

  window.requestAnimationFrame(animateInner)
}

function getTerrainShapes(terrainShape: TerrainShape) {
  return terrainShape.features
    .map((feature) => {
      const geometry = featureAsPolygon(feature as Feature<Polygon>).toNonIndexed()

      const colorHex = feature.properties?.fill?.color ?? DEFAULT_COLOR_2D
      const opacity = feature.properties?.fill?.opacity ?? DEFAULT_OPACITY_2D

      const color = new Color(colorHex)
      const colorArray = generateColorArray(color, geometry.attributes.position.count, opacity)
      geometry.setAttribute("color", new BufferAttribute(colorArray, 4, true))
      geometry.computeBoundingSphere()
      return geometry
    })
    .map((geo) => new Mesh(geo, TERRAIN_SHAPE_MATERIAL))
}

export type CameraAngle = { phi: number; theta: number }
const DEFAULT_ANGLE = { phi: 0.1, theta: -Math.PI / 8 }

export type CameraPreset = "default" | "above" | "frontHigh" | "sideHigh" | "frontLow" | "sideLow"
const presets: Record<CameraPreset, CameraAngle> = {
  default: DEFAULT_ANGLE,
  above: { phi: Math.PI / 2, theta: 0 },
  frontHigh: { phi: 0.4, theta: 0 },
  frontLow: { phi: 0, theta: 0 },
  sideHigh: { phi: 0.4, theta: Math.PI / 2 },
  sideLow: { phi: 0, theta: Math.PI / 2 },
}

export default function Preview({
  rowHouseParameters,
  parcelParameters,
  cameraPreset,
  draggable,
}: {
  rowHouseParameters: RowHouseParameters
  parcelParameters: ParcelParameters
  cameraPreset?: CameraPreset
  draggable?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  const cameraAngle = useRef<CameraAngle>(cameraPreset ? (presets[cameraPreset] ?? DEFAULT_ANGLE) : DEFAULT_ANGLE)
  const [manualCameraAngle, setManualCameraAngle] = useState<CameraAngle | undefined>(undefined)
  const [zoom, setZoom] = useState<number>(1)

  const elementMeshes = useMemo(() => {
    const { geometry, outlines } = rowHouseApi.generateRowHouse(rowHouseParameters, PROJECT_ID)
    const { terrainShape } = privateOutdoorSpaceGenerator.generate(parcelParameters)
    const terrainShapes = getTerrainShapes(terrainShape)

    const buildingPositionTransform = calculateBuildingTransform({
      parcelWidth: parcelParameters.width,
      parcelDepth: parcelParameters.depth,
      buildingDepth: rowHouseParameters.buildingDepth,
      buildingWidth: rowHouseParameters.buildingWidth,
      buildingPositionParameters: parcelParameters.buildingPositionParameters,
    })

    const linesGeo = new BufferGeometry()
    linesGeo.setAttribute("position", new BufferAttribute(outlines, 3))

    geometry.applyMatrix4(buildingPositionTransform)
    linesGeo.applyMatrix4(buildingPositionTransform)

    return [new Mesh(geometry, BASIC_MATERIAL), new LineSegments(linesGeo, LINES_MATERIAL), ...terrainShapes]
  }, [rowHouseParameters, parcelParameters])

  useEffect(() => {
    if (!ref.current) return
    const newAngle = cameraPreset ? (presets[cameraPreset] ?? DEFAULT_ANGLE) : DEFAULT_ANGLE
    if (newAngle !== cameraAngle.current && !manualCameraAngle) {
      animate(ref.current, elementMeshes, cameraAngle.current, newAngle, zoom, 200)
      cameraAngle.current = newAngle
    }
  }, [cameraPreset, manualCameraAngle, elementMeshes, zoom])

  useLayoutEffect(() => {
    if (!ref.current) return
    const angle = manualCameraAngle ?? cameraAngle.current
    renderCanvas(ref.current, elementMeshes, angle.phi, angle.theta, zoom)
  }, [manualCameraAngle, elementMeshes, zoom])

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!e.buttons) return
      const angle = manualCameraAngle ?? cameraAngle.current
      setManualCameraAngle({
        theta: angle.theta + e.movementX / 50,
        phi: angle.phi + e.movementY / 50,
      })
    },
    [manualCameraAngle],
  )

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom - e.deltaY * 0.01)))
    },
    [zoom],
  )

  return (
    <canvas
      className={draggable ? `${styles.PreviewCanvas} ${styles.DraggablePreview}` : styles.PreviewCanvas}
      ref={ref}
      height={RENDER_CANVAS_RESOLUTION}
      width={RENDER_CANVAS_RESOLUTION}
      onMouseMove={draggable ? onMouseMove : undefined}
      onWheel={draggable ? onWheel : undefined}
      onContextMenu={(e) => {
        e.preventDefault()
      }}
    ></canvas>
  )
}
