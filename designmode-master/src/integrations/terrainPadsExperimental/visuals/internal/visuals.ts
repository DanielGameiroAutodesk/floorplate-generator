import {
  type Box3,
  BufferAttribute,
  type BufferGeometry,
  DataTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  type ShaderMaterial,
  WebGLRenderTarget,
} from "three"
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js"
import { recalculateUVs } from "src/integrations/terrainPadsExperimental/api/terrain-repair"
import sceneManager from "src/core/three/sceneManager"
import { makeCustomLambertMaterial } from "src/core/terrain/customLambertMaterial"
import type { TerrainElement } from "src/core/terrain/terrain-types"
import { createSelectionOutlineMaterial } from "./TerrainIntersectionOutlineMaterial"
import { useMemo } from "preact/hooks"

const outlineMaterial = createSelectionOutlineMaterial()

const mask2dRenderTarget = new WebGLRenderTarget(2048, 2048)
const maskMaterial2d = new MeshBasicMaterial({ color: 0xffffff })
const camera = new OrthographicCamera(0, 0, 0, 0, -10000, 10000)

export const noMaskTexture = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
noMaskTexture.needsUpdate = true

const greyBackgroundTexture = new DataTexture(new Uint8Array([176, 176, 176, 255]), 1, 1)
greyBackgroundTexture.name = "twoTextureMaterial"
greyBackgroundTexture.needsUpdate = true

const padTerrainMaterial = createOverlayAndContourMaterial(1)
const padMaterial = createOverlayAndContourMaterial(1)

// TODO: Get rid of this
export function usePadTerrainMaterials() {
  useMemo(() => {
    const materials = [padTerrainMaterial, padMaterial]
    materials.forEach((material) => {
      material.uniforms.overlay.value = sceneManager.overlay.renderTarget.texture
      material.uniforms.scale.value = sceneManager.overlay.material.uniforms.scale.value
      material.uniforms.offset.value = sceneManager.overlay.material.uniforms.offset.value
      material.uniforms.discardMask.value = noMaskTexture
    })
  }, [])

  return { padMaterial, padTerrainMaterial }
}

export function getShapes2DMask(shapes: BufferGeometry[]) {
  const meshes: Mesh[] = []
  let bbox: Box3 | undefined
  for (const shape of shapes) {
    if (!shape.boundingBox) shape.computeBoundingBox()
    if (!bbox) bbox = shape.boundingBox!
    else bbox.union(shape.boundingBox!)
    meshes.push(new Mesh(shape, maskMaterial2d))
  }
  if (!bbox) return { maskTexture: noMaskTexture, offset: [0, 0], scale: [0, 0] }
  const scene = new Group().add(...meshes)

  camera.left = bbox.min.x
  camera.right = bbox.max.x
  camera.top = bbox.max.y
  camera.bottom = bbox.min.y
  camera.updateProjectionMatrix()
  sceneManager.renderer.setRenderTarget(mask2dRenderTarget)
  sceneManager.renderer.render(scene, camera)
  sceneManager.renderer.setRenderTarget(null)

  const discardOffset = [bbox.min.x, bbox.min.y]
  const discardScale = [1 / (bbox.max.x - bbox.min.x), 1 / (bbox.max.y - bbox.min.y)]
  const discardMask = mask2dRenderTarget.texture
  discardMask.magFilter = LinearFilter
  discardMask.minFilter = LinearFilter
  return { discardMask, discardOffset, discardScale }
}

export function createPreviewShapeVisuals(
  geometry: {
    outlines: number[]
    geometry: BufferGeometry
  }[],
  terrainElement: TerrainElement,
  padVisualMaterial: ShaderMaterial,
) {
  const group = new Group()
  geometry.forEach(({ outlines, geometry }) => {
    const linesGeo = new LineSegmentsGeometry()
    linesGeo.setPositions(outlines)
    const linesMesh = new Mesh(linesGeo, outlineMaterial)
    group.add(linesMesh)
    linesMesh.renderOrder = 10

    const uvs = recalculateUVs(
      geometry.attributes.position.array as Float32Array,
      terrainElement.properties.geoReference.refPoint,
      terrainElement.properties.bbox,
    )
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2))
    geometry.computeVertexNormals()

    const previewMesh = new Mesh(geometry, padVisualMaterial)
    previewMesh.receiveShadow = true
    previewMesh.castShadow = true

    previewMesh.renderOrder = -2
    group.add(previewMesh)
  })
  return group
}

function getTerrainMaterial(alpha: number) {
  return makeCustomLambertMaterial({
    uniforms: {
      overlay: { value: null },
      backgroundMap: { value: greyBackgroundTexture },
      scale: { value: [0, 0] },
      offset: { value: [0, 0] },
      fade: { value: 0 },
      shading: { value: 1 },
      discardMask: { value: noMaskTexture },
      discardScale: { value: [0, 0] },
      discardOffset: { value: [0, 0] },
      alpha: { value: alpha },
      highlightZ: { value: -10000 },
      highlightColor: { value: [1, 1, 0] },
      showGridContours: { value: true },
    },
    // language=GLSL
    vertexShader: `
        varying vec2 v_uv;
        varying vec4 vPos;

        out vec3 vertexMC;
        out vec3 normalVC;

        void main() {
            lambert();
            v_uv = uv;
            normalVC = normalMatrix * normal;

            vertexMC = position;
            vPos = modelMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewMatrix * vPos;
        }
    `,
    // language=GLSL
    fragmentShader: `
        varying vec2 v_uv;
        varying vec4 vPos;
        uniform sampler2D overlay, discardMask, backgroundMap;
        uniform vec2 scale, offset, discardScale, discardOffset;
        uniform float fade, alpha, highlightZ;
        uniform vec3 highlightColor;
        uniform bool showGridContours;

        in vec3 vertexMC;
        in vec3 normalVC;

        float cartesianGridFactor(float parameter, float width, float feather) {
            float w1 = width - feather * 0.5;
            float d = fwidth(parameter);
            float looped = 0.5 - abs(mod(parameter, 1.0) - 0.5);
            return smoothstep(d * w1, d * (w1 + feather), looped);
        }
        
        float distanceFactor(float parameter1, float parameter2, float width, float feather) {
            float w1 = width - feather * 0.5;
            float d = fwidth(parameter1);
            float dist = abs(parameter1 - parameter2);
            return smoothstep(d * w1, d * (w1 + feather), dist);
        }

        void contour() {
            const float gridMinZ = 0.0;
            const float gridMaxZ = 1.0;
            const float contourInterval = 1.;
            const float contourIntervalMajor = contourInterval * 5.;

            // Generate the normal if we are not passed in one
            vec3 normalVC = normalize(normalVC);
            if(gl_FrontFacing == false) {
              normalVC = -normalVC;
            }

            float width = 0.1;
            float feather = 1.75;
            float g = min(
              cartesianGridFactor((vertexMC.z - gridMinZ) / contourInterval, width, feather),
              cartesianGridFactor((vertexMC.z - gridMinZ) / contourIntervalMajor, width * 4., feather)
            );
            float h = distanceFactor(vertexMC.z, highlightZ, width * 8., feather);

            vec3 dv = normalize(fwidth(vertexMC)); // check if triangle is flat
            if(abs(dv.z) < 0.001 || (abs(vertexMC.z - gridMinZ) < 0.075) || (abs(vertexMC.z - gridMaxZ) < 0.075)) {
              g = 1.0;
              h = 1.0;
            }
            if (!showGridContours) {
              g = 1.0;
            }

            vec3 baseColor = gl_FragColor.rgb;
            vec3 contourLineColor = vec3(0, 0, 0);
            vec3 diffuseColor = vec3(mix(contourLineColor, baseColor, g));
            vec3 highlight = mix(highlightColor, baseColor, h);
            diffuseColor = mix(highlight, diffuseColor, step(0.999, h));

            gl_FragColor = vec4(diffuseColor, 1.0);
        }

        void main() {
            vec4 over = texture2D(overlay, scale * vec2(v_uv.x, 1.0 - v_uv.y) + offset);
            vec4 background = texture2D(backgroundMap, v_uv);
            background.rgb = mix(background.rgb, over.rgb, over.a);
            background.rgb = mix(background.rgb, vec3(0., 0., 0.), fade);
            lambert(background);
            contour();

            vec2 discardUv = discardScale * (vPos.xy - discardOffset);
            bool validUv = discardUv.x >= 0.0 && discardUv.x <= 1.0 && discardUv.y >= 0.0 && discardUv.y <= 1.0;
            if (validUv && texture2D(discardMask, discardUv).r == 1.0) discard;
            gl_FragColor.a = alpha;
        }
    `,
  })
}

function createOverlayAndContourMaterial(alpha: number) {
  const material = getTerrainMaterial(alpha)
  material.side = DoubleSide
  material.name = "Terrain"
  material.polygonOffset = true
  material.polygonOffsetUnits = 0.01
  material.polygonOffsetFactor = 0.1
  material.transparent = alpha < 1
  return material
}
