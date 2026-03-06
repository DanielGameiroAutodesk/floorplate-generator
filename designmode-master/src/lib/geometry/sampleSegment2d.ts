import { Vector2 } from "three"

export function sampleSegment2d(from: Vector2, to: Vector2, stepSize: number = 1): [Vector2, Vector2][] {
  const positionsSampled: [Vector2, Vector2][] = []

  const length = to.distanceTo(from)
  if (length < 1e-5) {
    console.log({ from, to })
  }
  const steps = Math.floor(length / stepSize)
  const delta = length / steps

  for (let step = 0; step < steps; step++) {
    const stepFrom = new Vector2().lerpVectors(to, from, (step * delta) / length)
    const stepTo = new Vector2().lerpVectors(to, from, ((step + 1) * delta) / length)
    positionsSampled.push([stepFrom, stepTo])
  }

  return positionsSampled
}
