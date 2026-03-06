export function shortenSegments(polygon: [number, number][], maxSegmentLength: number): [number, number][] {
  const segments = polygon.map((point, i) => {
    const nextPoint = polygon[(i + 1) % polygon.length]
    return [point, nextPoint]
  })
  const shorterSegments = segments.flatMap((segment) => {
    const [a, b] = segment
    const distance = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)
    const numberOfSegments = Math.ceil(distance / maxSegmentLength)
    const segments: [number, number][] = []
    for (let i = 0; i < numberOfSegments; i++) {
      const t = i / numberOfSegments
      const x = a[0] + (b[0] - a[0]) * t
      const y = a[1] + (b[1] - a[1]) * t
      segments.push([x, y])
    }
    return segments
  })
  return shorterSegments
}
