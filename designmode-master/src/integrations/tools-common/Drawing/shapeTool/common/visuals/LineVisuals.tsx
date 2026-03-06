import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import type { Vector3 } from "three"
import { Object3D } from "three"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import type { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { useMemo } from "preact/compat"
import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"

const linesToPositions = (lines: LineType[]) =>
  lines.flatMap((l) =>
    l.segments.flatMap((seg) => [seg.start.x, seg.start.y, seg.start.z, seg.end.x, seg.end.y, seg.end.z]),
  )

type Segment3 = {
  start: Vector3
  end: Vector3
}

export type LineType = {
  segments: Segment3[]
}

export class LineVisuals extends Object3D {
  private readonly line: LineSegments2
  constructor(material: LineMaterial) {
    super()
    this.line = new LineSegments2(new LineSegmentsGeometry().setPositions([0, 0, 0, 0, 0, 0]), material)
    this.add(this.line)
    this.line.renderOrder = 1
  }

  updatePositions(positions: number[]) {
    this.line.geometry.dispose()
    this.line.geometry.setPositions(positions)
    this.line.computeLineDistances()
    sceneManager.render()
  }

  updateLines(lines: LineType[]) {
    this.line.geometry.dispose()
    const positions = linesToPositions(lines)
    this.line.geometry.setPositions(positions)
    this.line.computeLineDistances()

    sceneManager.render()
  }
}

export function useLineVisuals(material: LineMaterial) {
  const visuals = useMemo(() => new LineVisuals(material), [material])
  useObjectLifecycle(visuals)
  return visuals
}
