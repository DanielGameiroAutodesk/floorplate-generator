export function createRotateTranslateAffine(angle: number, pivot: number[], translation: number[]) {
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  const [px, py] = pivot
  const [x0, y0] = translation
  return [ca, -sa, x0 + px - px * ca + py * sa, sa, ca, y0 + py - px * sa - py * ca]
}

export function createRotateAffine(angle: number, pivot: number[]) {
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  const [px, py] = pivot
  return [ca, -sa, px - px * ca + py * sa, sa, ca, py - px * sa - py * ca]
}

export function affineMultiply(point: [number, number], aff: number[]): [number, number] {
  const [dxx, dxy, x0, dyx, dyy, y0] = aff
  const [px, py] = point
  return [px * dxx + py * dxy + x0, px * dyx + py * dyy + y0]
}
