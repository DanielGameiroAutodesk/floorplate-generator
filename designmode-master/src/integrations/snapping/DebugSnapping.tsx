import { effect, signal } from "@preact/signals"
import { Box3, BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Vector3 } from "three"
import sceneManager from "src/core/three/sceneManager"
import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"
import { mousePosition } from "src/core/useMousePosition"
import { elementState } from "src/core/elements/ElementState"
import { pixelsToMetersAtPosition } from "src/integrations/tools-common/AffineTooling/utils"
import { SNAPPING_SENSITIVITY_SQ } from "./constants"
import type { SnappingLine } from "./snapping"
import Stats from "three/addons/libs/stats.module.js"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const debugSnappingEnabledSignal = signal(false)

export const stats = new Stats()
stats.showPanel(1) // 0: fps, 1: ms, 2: mb, 3+: custom

const bboxGeometry = new BufferGeometry()
bboxGeometry.setIndex(
  new BufferAttribute(new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]), 1),
)
bboxGeometry.setAttribute("position", new BufferAttribute(new Float32Array(8 * 3), 3))

const material = new LineBasicMaterial({
  color: "hotpink",
  toneMapped: false,
  depthTest: false,
  polygonOffset: true,
  polygonOffsetFactor: -40,
  polygonOffsetUnits: -40,
})
const bboxLineSegments = new LineSegments(bboxGeometry, material)

function updateBbox(box: Box3) {
  const min = box.min
  const max = box.max
  const position = bboxGeometry.attributes.position
  const array = position.array

  array[0] = max.x
  array[1] = max.y
  array[2] = max.z
  array[3] = min.x
  array[4] = max.y
  array[5] = max.z
  array[6] = min.x
  array[7] = min.y
  array[8] = max.z
  array[9] = max.x
  array[10] = min.y
  array[11] = max.z
  array[12] = max.x
  array[13] = max.y
  array[14] = min.z
  array[15] = min.x
  array[16] = max.y
  array[17] = min.z
  array[18] = min.x
  array[19] = min.y
  array[20] = min.z
  array[21] = max.x
  array[22] = min.y
  array[23] = min.z

  position.needsUpdate = true

  bboxGeometry.computeBoundingSphere()
}

const snappingLinesGeo = new BufferGeometry()
snappingLinesGeo.setAttribute("position", new BufferAttribute(new Float32Array(), 3))
const snappingLinesLineSegments = new LineSegments(snappingLinesGeo, material)

const handle = new VertexHandle(new Vector3())

const reusedPos = new Vector3()

function snapSnappingLine(snappingLine: SnappingLine) {
  let distance = Number.MAX_SAFE_INTEGER
  const position = new Vector3()

  //console.log(snappingLine)

  snappingLine.segments?.forEach((seg) => {
    //if (!mousePosition.ray.intersectsBox(seg.bbox)) return // No speedup in testin

    const dist = mousePosition.ray.distanceSqToSegment(seg.start, seg.end, undefined, reusedPos)
    if (dist < distance) {
      position.copy(reusedPos)
      distance = dist
    }
  })
  return {
    line: snappingLine,
    distance,
    position,
  }
}

function snap() {
  stats.begin()

  let hits = []

  let minSize = Infinity
  let minBox = new Box3()
  const sizeVec = new Vector3()
  const proposal = elementState.currentProposalSignal.peek()
  const terrain = terrainSignal.peek()
  for (let node of proposal.snapshot.nodes.values()) {
    const bbox = node.bbox(terrain.terrainSamplerData).getOrCompute()
    if (!bbox) continue
    if (mousePosition.ray.intersectsBox(bbox)) {
      console.log(bbox)
      hits.push(node)

      bbox.getSize(sizeVec)
      const size = sizeVec.length()
      if (size < minSize) {
        minSize = size
        minBox = bbox
      }
    }
  }
  updateBbox(minBox)

  const snappingLines = hits.flatMap((node) => node.snappingLines(terrain.terrainSamplerData).getOrCompute())

  const allSnapped =
    snappingLines
      ?.flatMap(snapSnappingLine)
      .filter(
        (l) => l.distance <= pixelsToMetersAtPosition(SNAPPING_SENSITIVITY_SQ, mousePosition.camera, l.position),
      ) ?? []

  const pos = snappingLines.flatMap((s) => s.segments.flatMap((seg) => [seg.start, seg.end]))
  snappingLinesGeo.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([...pos.flatMap((p) => p.toArray())]), 3),
  )
  snappingLinesGeo.computeBoundingSphere()

  const sorted = allSnapped.sort((a, b) => a.distance - b.distance)

  if (sorted.length >= 1) {
    handle.moveTo(sorted[0].position)
    handle.visible = true
  } else {
    handle.visible = false
  }

  stats.end()
  sceneManager.render()
}

function mousemove() {
  let ticking = false
  if (!ticking) {
    window.requestAnimationFrame(function () {
      snap()
      ticking = false
    })
    ticking = true
  }
}

function enableDebugSnapping() {
  debugSnappingEnabledSignal.value = true

  sceneManager.scene.add(bboxLineSegments)
  sceneManager.scene.add(snappingLinesLineSegments)
  sceneManager.scene.add(handle)

  document.body.appendChild(stats.dom)
  sceneManager.renderer.domElement.addEventListener("mousemove", mousemove)
}

function disableDebugSnapping() {
  debugSnappingEnabledSignal.value = false
  sceneManager.scene.remove(bboxLineSegments)
  sceneManager.scene.remove(snappingLinesLineSegments)
  sceneManager.scene.remove(handle)

  sceneManager.renderer.domElement.removeEventListener("mousemove", mousemove)
}

export function DebugSnappingVisibilityMenu() {
  effect(() => {
    if (debugSnappingEnabledSignal.value) {
      enableDebugSnapping()
    } else {
      disableDebugSnapping()
    }
  })

  return (
    <forma-visibility-menu-item
      text="Debug snapping"
      onToggle={() => (debugSnappingEnabledSignal.value = !debugSnappingEnabledSignal.value)}
      selected={debugSnappingEnabledSignal.value}
    />
  )
}
