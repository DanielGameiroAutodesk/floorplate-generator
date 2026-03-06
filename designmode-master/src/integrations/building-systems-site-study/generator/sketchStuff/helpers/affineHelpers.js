export function createRotateTranslateAffine(angle, pivot, translation) {
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  const [px, py] = pivot
  const [x0, y0] = translation
  return [ca, -sa, x0 + px - px * ca + py * sa, sa, ca, y0 + py - px * sa - py * ca]
}

export function createRotateAffine(angle, pivot) {
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  const [px, py] = pivot
  return [ca, -sa, px - px * ca + py * sa, sa, ca, py - px * sa - py * ca]
}

export function inverseAffine(aff) {
  const [dxx, dxy, x0, dyx, dyy, y0] = aff
  const idet = 1 / (dxx * dyy - dxy * dyx)
  const ra = dyy * idet
  const rb = -dxy * idet
  const rd = -dyx * idet
  const re = dxx * idet
  return [ra, rb, -x0 * ra - y0 * rb, rd, re, -x0 * rd - y0 * re]
}

export function affineMultiply(point, aff) {
  const [dxx, dxy, x0, dyx, dyy, y0] = aff
  const [px, py] = point
  return [px * dxx + py * dxy + x0, px * dyx + py * dyy + y0]
}
