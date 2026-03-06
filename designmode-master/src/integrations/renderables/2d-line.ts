import type { Color } from "three"
import { BufferAttribute, BufferGeometry, Mesh, ShaderMaterial } from "three"

export const lineshader = (dashed = false, faded: boolean = false) => {
  let shaderMaterial = new ShaderMaterial({
    // language=Glsl
    vertexShader: `
        // how far from the centerline are we
        attribute float distanceToCenter, distanceAlongLine;
        attribute vec3 color;
        attribute float width;
        varying vec3 v_color;
        varying float v_width;
        varying float v_distanceToCenter, v_distanceAlongLine;
        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            v_distanceToCenter = distanceToCenter;
            v_distanceAlongLine = distanceAlongLine;
            v_color = color;
            v_width = width;
        }
    `,
    // language=Glsl
    fragmentShader: `
        varying float v_distanceToCenter, v_distanceAlongLine;
        varying vec3 v_color;
        varying float v_width;
        uniform float dashed;
        uniform float opacity;
        void main() {
            float alpha = smoothstep(1.0, 0.4, pow(abs(v_distanceToCenter), v_width / 2.));
            alpha *= smoothstep(0.5, 0.6, 0.5 * cos(dashed * (v_distanceAlongLine * 3. - 0.785)) + 0.5);
            gl_FragColor = vec4(v_color, alpha * opacity);
        }
    `,
    transparent: true,
    uniforms: {
      dashed: { value: dashed ? 1 : 0 },
      opacity: { value: faded ? 0.2 : 1 },
    },
  })
  shaderMaterial.name = "Custom Line Shader"
  return shaderMaterial
}
export const lineshaderWithColor = (dashed = false, faded: boolean = false, color: Color, opacity?: number) => {
  let shaderMaterial = new ShaderMaterial({
    // language=Glsl
    vertexShader: `
        // how far from the centerline are we
        attribute float distanceToCenter, distanceAlongLine;
        uniform vec3 color;
        uniform float width;
        varying vec3 v_color;
        varying float v_width;
        varying float v_distanceToCenter, v_distanceAlongLine;
        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            v_distanceToCenter = distanceToCenter;
            v_distanceAlongLine = distanceAlongLine;
            v_color = color;
            v_width = width;
        }
    `,
    // language=Glsl
    fragmentShader: `
        varying float v_distanceToCenter, v_distanceAlongLine;
        varying vec3 v_color;
        varying float v_width;
        uniform float dashed;
        uniform float opacity;
        void main() {
            float alpha = smoothstep(1.0, 0.4, pow(abs(v_distanceToCenter), v_width / 2.));
            alpha *= smoothstep(0.5, 0.6, 0.5 * cos(dashed * (v_distanceAlongLine * 3. - 0.785)) + 0.5);
            gl_FragColor = vec4(v_color, alpha * opacity);
        }
    `,
    transparent: true,
    uniforms: {
      dashed: { value: dashed ? 1 : 0 },
      opacity: { value: opacity ? opacity : faded ? 0.2 : 1 },
      color: { value: color },
      width: { value: 3 },
    },
  })
  shaderMaterial.name = "Custom Line Shader"
  return shaderMaterial
}

// This needs to be called with metric units, as the width logic does not go well with later applying a matrix on
// the geometry
export function createlinegeo(segments: number[], width: number, color?: number[]) {
  const geometry = new BufferGeometry()
  const positions = new Float32Array((segments.length / 4) * 15)
  const distanceAlongLine = new Float32Array(positions.length / 3)

  let previousDistance = 0
  for (let i = 0; i < positions.length; i += 15) {
    const offset = (i / 15) * 4
    const startx = segments[offset]
    const starty = segments[offset + 1]
    const endx = segments[offset + 2]
    const endy = segments[offset + 3]
    const _nx = -(endy - starty)
    const _ny = endx - startx
    const nlength = Math.sqrt(_nx ** 2 + _ny ** 2)
    const nx = nlength === 0 ? 0 : (_nx * width) / 2 / nlength
    const ny = nlength === 0 ? 0 : (_ny * width) / 2 / nlength

    const distanceOffset = i / 3
    distanceAlongLine[distanceOffset] = previousDistance
    distanceAlongLine[distanceOffset + 1] = previousDistance + nlength
    distanceAlongLine[distanceOffset + 2] = previousDistance + nlength
    distanceAlongLine[distanceOffset + 3] = previousDistance
    distanceAlongLine[distanceOffset + 4] = previousDistance + nlength
    previousDistance += nlength
    positions[i] = startx - nx
    positions[i + 1] = starty - ny
    positions[i + 2] = 0
    positions[i + 3] = endx - nx
    positions[i + 4] = endy - ny
    positions[i + 5] = 0
    positions[i + 6] = endx + nx
    positions[i + 7] = endy + ny
    positions[i + 8] = 0
    positions[i + 9] = startx + nx
    positions[i + 10] = starty + ny
    positions[i + 11] = 0
    positions[i + 12] = endx
    positions[i + 13] = endy
    positions[i + 14] = 0
  }

  const distanceToCenter = new Float32Array(positions.length / 3)
  for (let i = 0; i < distanceToCenter.length; i += 5) {
    distanceToCenter[i] = -1
    distanceToCenter[i + 1] = -1
    distanceToCenter[i + 2] = 1
    distanceToCenter[i + 3] = 1
    distanceToCenter[i + 4] = 0
  }

  const index = new Uint32Array((6 * segments.length) / 4 + Math.max((6 * (segments.length - 4)) / 4, 0))
  for (let i = 0; i < index.length; i += 12) {
    const offset = Math.floor(i / 12) * 5
    index[i] = offset
    index[i + 1] = 1 + offset
    index[i + 2] = 2 + offset

    index[i + 3] = offset
    index[i + 4] = 2 + offset
    index[i + 5] = 3 + offset
    if (i + 12 < index.length) {
      index[i + 6] = 2 + offset
      index[i + 7] = 4 + offset
      index[i + 8] = 8 + offset

      index[i + 9] = 1 + offset
      index[i + 10] = 5 + offset
      index[i + 11] = 4 + offset
    }
  }

  geometry.setAttribute("position", new BufferAttribute(positions, 3))
  if (color)
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(positions.map((_, i) => color[i % 3])), 3))

  geometry.setAttribute("width", new BufferAttribute(new Float32Array(positions.map(() => width)), 1))
  geometry.setAttribute("distanceAlongLine", new BufferAttribute(distanceAlongLine, 1))
  geometry.setAttribute("distanceToCenter", new BufferAttribute(distanceToCenter, 1))
  geometry.setIndex(new BufferAttribute(index, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function create2DLine(segments: number[], color?: number[], width = 0.5, dashed = false) {
  return new Mesh(createlinegeo(segments, width, color), lineshader(dashed))
}

export function create2DLineGeoFromSegments(coords: number[][], width = 1) {
  const segments = []
  for (let i = 0; i < coords.length - 1; i++) {
    segments.push(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
  }
  const geo = createlinegeo(segments, width)
  return geo
}

export function create2DLineFromCoords(coords: number[][], color: Color, width = 0.5, dashed = false) {
  const segments = []
  for (let i = 0; i < coords.length - 1; i++) {
    segments.push(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
  }
  return new Mesh(createlinegeo(segments, width), lineshader(dashed))
}
