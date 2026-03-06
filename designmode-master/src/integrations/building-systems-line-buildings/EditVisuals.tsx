import * as THREE from "three"
import type { Matrix4 } from "three"
import { AlwaysDepth, BufferAttribute, BufferGeometry, Color, Group, Vector3 } from "three"
import { useMemo } from "preact/compat"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"

import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { useRecoilValue } from "recoil"
import { quickDrawTemporaryDumpAtom } from "./quickDrawState"
import type { AddPointData } from "./addPointToLine"
import { colors } from "src/lib/colors"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import type { SnappingLine } from "src/integrations/snapping/snapping"
import { screenResolutionVector } from "src/core/three/sceneManager"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"

/////
// Graph tool
///

const activeEditModeRoofLineMaterial = new LineMaterial({
  color: new Color("#0696D7").getHex(),
  linewidth: 2,
  resolution: screenResolutionVector,
  polygonOffset: true,
  polygonOffsetUnits: -2,
  polygonOffsetFactor: -1,
})

const defaultEditModeRoofLineMaterial = new LineMaterial({
  color: new Color("#0696D7").getHex(),
  linewidth: 1,
  resolution: screenResolutionVector,
  polygonOffset: true,
  polygonOffsetUnits: -2,
  polygonOffsetFactor: -1,
})

export const defaultRoofLineMaterial = new LineMaterial({
  color: new Color(colors.gray40).getHex(),
  linewidth: 2,
  resolution: screenResolutionVector,
  polygonOffset: true,
  polygonOffsetUnits: -2,
  polygonOffsetFactor: -1,
  dashed: true,
  dashSize: 2,
  gapSize: 2,
  dashScale: 3,
  transparent: true,
  opacity: 0.5,
})

export const roofLineMaterialInValid = new LineMaterial({
  color: new Color(colors.red50).getHex(),
  linewidth: 2,
  resolution: screenResolutionVector,
  polygonOffset: true,
  polygonOffsetUnits: -2,
  polygonOffsetFactor: -1,
})

export function GraphToolVisual({
  hoveredVertexId,
  roofLines,
  liveVertices,
  addPointLiveData,
  validGraph = true,
  roofLineActive,
}: {
  roofLines: [Vector3, Vector3][]
  liveVertices: { x: number; y: number; z: number; id: string }[]
  hoveredVertexId?: string | undefined
  addPointLiveData?: AddPointData | undefined
  validGraph?: boolean
  roofLineActive: boolean
}) {
  const renderApi = useRenderAPI("default")

  const edgeVisuals = useMemo(() => {
    const geom = new LineSegmentsGeometry()
    const n = roofLines.length
    const positions = new Float32Array(6 * n)
    for (let i = 0; i < n; i++) {
      const v0 = roofLines[i][0]
      const v1 = roofLines[i][1]
      positions[i * 6] = v0.x
      positions[i * 6 + 1] = v0.y
      positions[i * 6 + 2] = v0.z
      positions[i * 6 + 3] = v1.x
      positions[i * 6 + 4] = v1.y
      positions[i * 6 + 5] = v1.z
    }
    geom.setPositions(positions)
    if (!validGraph) return new LineSegments2(geom, roofLineMaterialInValid)
    return new LineSegments2(geom, roofLineActive ? activeEditModeRoofLineMaterial : defaultEditModeRoofLineMaterial)
  }, [roofLineActive, roofLines, validGraph])

  const newVertex = useMemo(() => {
    if (!addPointLiveData?.newVertex) return undefined
    return new Vector3(addPointLiveData.newVertex.x, addPointLiveData.newVertex.y, addPointLiveData.newVertex.z)
  }, [addPointLiveData])

  renderApi.useObjectLifecycle_TEMPORARY_FIX(edgeVisuals)
  return (
    <>
      {liveVertices.map((vertex: any) => {
        const hovered = vertex.id === hoveredVertexId
        const key = hovered ? `vertex-${vertex.id}-hovered` : `vertex-${vertex.id}`
        return <Handle key={key} position={vertex} hovered={hovered} />
      })}
      {newVertex && <Handle position={newVertex} hovered={!!addPointLiveData?.snappedToVertex} />}
    </>
  )
}

//////
// Section hit boxes
///

function getLineMaterial(linewidth: number) {
  return new LineMaterial({
    color: new Color("#0696D7").getHex(),
    linewidth: linewidth,
    resolution: screenResolutionVector,
    name: "Box line",
    polygonOffset: true,
    polygonOffsetFactor: -1,
  })
}

export function SelectionVisuals({
  hitBoxes,
  selectedSectionIds,
  hoveredSectionIds,
  worldMatrix,
  allSectionsSelected,
}: {
  hitBoxes: any
  selectedSectionIds: string[]
  hoveredSectionIds: string[]
  worldMatrix: Matrix4
  allSectionsSelected: boolean
}) {
  const renderApi = useRenderAPI("default")

  const quickDrawState = useRecoilValue(quickDrawTemporaryDumpAtom)

  const allHoveredSectionIds = useMemo(() => {
    return new Set(quickDrawState.hoverSectionIds.concat(hoveredSectionIds))
  }, [hoveredSectionIds, quickDrawState.hoverSectionIds])

  const visuals = useMemo(() => {
    const group = new Group()
    if (!allSectionsSelected) {
      // skip showing selection if all is selected (shown by fat roofline)
      for (let selectedSectionId of selectedSectionIds) {
        if (!hitBoxes[selectedSectionId]) continue
        const { linesGeometry } = hitBoxes[selectedSectionId]
        const linesGeo = new LineSegmentsGeometry().setPositions(linesGeometry)
        const lineMaterial = getLineMaterial(2)

        const mesh = new LineSegments2(linesGeo, lineMaterial)
        group.add(mesh)
      }
    }

    for (let hoveredSectionId of allHoveredSectionIds) {
      if (hoveredSectionId && hitBoxes[hoveredSectionId]) {
        const { geometry } = hitBoxes[hoveredSectionId]
        const bufferGeo = new BufferGeometry()
        bufferGeo.setAttribute("position", new BufferAttribute(geometry.attributes.position.array, 3))
        bufferGeo.setAttribute("normal", new BufferAttribute(geometry.attributes.normal.array, 3, false))

        const material = new THREE.MeshLambertMaterial({
          color: new Color("#0696D7"),
          transparent: true,
          opacity: 0.2,
          polygonOffset: true,
          depthTest: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
        const mesh = new THREE.Mesh(bufferGeo, material)
        group.add(mesh)
      }
    }

    group.applyMatrix4(worldMatrix)
    return group
  }, [allSectionsSelected, worldMatrix, selectedSectionIds, hitBoxes, allHoveredSectionIds])
  renderApi.useObjectLifecycle_TEMPORARY_FIX(visuals)
  return <></>
}

const SNAPPING_ACTIVE_COLOR = new Color("#E30288")
const baseLineParams = {
  color: SNAPPING_ACTIVE_COLOR.getHex(),
  linewidth: 1,
  depthFunc: AlwaysDepth,
  transparent: true,
  opacity: 1,
  dashed: false,
  resolution: screenResolutionVector,
  polygonOffset: true,
  polygonOffsetUnits: -4,
  polygonOffsetFactor: -4,
}
const shapeToolSnappingLineMaterial = new LineMaterial({
  ...baseLineParams,
})

function ShapeToolSnapLineVisuals({ snappingLines }: { snappingLines: SnappingLine[] }) {
  const renderApi = useRenderAPI("default")
  const lineVisuals = useMemo(() => {
    if (snappingLines.length === 0) return undefined
    const geom = new LineSegmentsGeometry()
    const n = snappingLines.length
    const positions = new Float32Array(6 * n)
    for (let i = 0; i < n; i++) {
      const v0 = snappingLines[i].start
      const v1 = snappingLines[i].end
      positions[i * 6] = v0.x
      positions[i * 6 + 1] = v0.y
      positions[i * 6 + 2] = v0.z
      positions[i * 6 + 3] = v1.x
      positions[i * 6 + 4] = v1.y
      positions[i * 6 + 5] = v1.z
    }
    geom.setPositions(positions)
    return new LineSegments2(geom, shapeToolSnappingLineMaterial)
  }, [snappingLines])

  renderApi.useObjectLifecycle_TEMPORARY_FIX(lineVisuals)
  return <></>
}

export const DragVertexSnappingVisual = ({ snappingLines }: { snappingLines?: SnappingLine[] }) => {
  if (snappingLines) return <ShapeToolSnapLineVisuals snappingLines={snappingLines} />
  return <></>
}
