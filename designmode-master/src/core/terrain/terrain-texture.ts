import type { Mesh, Texture } from "three"
import { BackSide, Box3, DataTexture, DoubleSide } from "three"
import sceneManager from "src/core/three/sceneManager"
import { makeCustomLambertMaterial } from "./customLambertMaterial"

type BBox = [[number, number], [number, number]]

function twoTextureMaterial(overlay: Texture) {
  const dataTexture = new DataTexture(new Uint8Array([238, 238, 238, 255]), 1, 1)
  dataTexture.name = "twoTextureMaterial"
  dataTexture.needsUpdate = true
  return makeCustomLambertMaterial({
    uniforms: {
      onlyOverlay: { value: false },
      backgroundMap: { value: dataTexture },
      overlay: { value: overlay },
      scale: { value: [0, 0] },
      offset: { value: [0, 0] },
      fade: { value: 0 },
    },
    // language=GLSL
    vertexShader: `
        varying vec2 v_uv;
        void main() {
            lambert();
            v_uv = uv;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
    `,
    // language=GLSL
    fragmentShader: `
        varying vec2 v_uv;
        uniform sampler2D backgroundMap, overlay;
        uniform vec2 scale;
        uniform vec2 offset;
        uniform float fade;
        uniform bool onlyOverlay;
        void main() {
            vec4 over = texture2D(overlay, scale * vec2(v_uv.x, 1.0 - v_uv.y) + offset);
            if ( onlyOverlay) {
                lambert(over);
                if (over.r + over.g + over.b < 0.001) {
                    gl_FragColor.a = 0.;
                } else {
                    gl_FragColor.a = 0.2;
                }
            } else {
              vec4 background = texture2D(backgroundMap, v_uv);
              background.rgb = mix(background.rgb, over.rgb, over.a);
              background.rgb = mix(background.rgb, vec3(0., 0., 0.), fade);
              lambert(background);
            }
        }
    `,
  })
}

export function createTerrainMaterial(texture: Texture) {
  const material = twoTextureMaterial(texture)
  material.side = DoubleSide
  material.shadowSide = BackSide
  material.name = "Terrain"
  material.polygonOffset = true
  material.polygonOffsetUnits = 0.01
  material.polygonOffsetFactor = 0.1
  return material
}

const box = new Box3()

export function getPaddedBbox(meshes: Mesh[]): BBox {
  box.makeEmpty()

  const relevantMeshes = meshes.filter(
    (mesh) => mesh.name !== "__background__" && mesh.geometry.attributes.position?.count > 0,
  )
  if (relevantMeshes.length === 0) {
    return [
      [-1, -1],
      [1, 1],
    ]
  }

  for (const mesh of relevantMeshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    box.expandByObject(mesh, false)
  }
  const terrainMin = sceneManager.overlay.terrainBbox[0]
  const terrainMax = sceneManager.overlay.terrainBbox[1]
  box.min.x = Math.min(terrainMax[0], Math.max(box.min.x, terrainMin[0]))
  box.max.x = Math.max(terrainMin[0], Math.min(box.max.x, terrainMax[0]))
  box.min.y = Math.min(terrainMax[1], Math.max(box.min.y, terrainMin[1]))
  box.max.y = Math.max(terrainMin[1], Math.min(box.max.y, terrainMax[1]))

  box.expandByScalar(100)
  const padded = [
    [box.min.x, box.min.y],
    [box.max.x, box.max.y],
  ]
  return padded as BBox
}
