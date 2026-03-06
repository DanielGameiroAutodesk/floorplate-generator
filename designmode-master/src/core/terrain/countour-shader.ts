import { BackSide, DoubleSide, GLSL3, RawShaderMaterial } from "three"

const MAX_CLIPPING_PLANES = 6

// See https://git.autodesk.com/groundforce/forma-terrain-advanced/blob/main/src/three/shaders/Surface.vert
export const contourShader = new RawShaderMaterial({
  glslVersion: GLSL3,
  vertexShader: `
      precision mediump float;
      precision mediump int;
      
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform mat3 normalMatrix;
      
      in vec3 position;
      in vec3 normal;
      
      out vec3 vertexMC;
      out vec3 normalVC;
      out vec4 vPosition;
      
      void main() {
        normalVC = normalMatrix * normal;
      
        vertexMC = position;
        vPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      precision mediump float;
      precision mediump int;
      uniform int shading;
      uniform int numClippingPlanes;
      in vec3 vertexMC;
      in vec3 normalVC;
      in vec4 vPosition;

      uniform vec4 clippingPlanes[${MAX_CLIPPING_PLANES}];

      out vec4 fragColor;
      
      float cartesianGridFactor(float parameter, float width, float feather) {
        float w1 = width - feather * 0.5;
        float d = fwidth(parameter);
        float looped = 0.5 - abs(mod(parameter, 1.0) - 0.5);
        return smoothstep(d * w1, d * (w1 + feather), looped);
      }
      
      void main() {
        // clipping
        for (int i = 0; i < numClippingPlanes; ++i) {
          if (dot(vPosition, clippingPlanes[i]) < 0.0) discard;
        }

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
      
        vec3 dv = normalize(fwidth(vertexMC)); // check if triangle is flat
        if(abs(dv.z) < 0.001 || (abs(vertexMC.z - gridMinZ) < 0.075) || (abs(vertexMC.z - gridMaxZ) < 0.075)) {
          g = 1.0;
        }
        vec3 baseColor = vec3(0.9, 0.9, 0.9);
        vec3 contourLineColor = vec3(0, 0, 0);
        vec3 diffuseColor = vec3(mix(contourLineColor, baseColor, g));
      
        if (shading == 0) {
          fragColor = vec4(diffuseColor, 1.0);
        } else {
          float df = max(0.0, normalVC.z);
          df = (df * 0.366) + 0.633;
          vec3 triangleColor = df * diffuseColor;
          fragColor = vec4(triangleColor, 1.0);
        }
      }
    `,
  side: DoubleSide,
  shadowSide: BackSide,
  uniforms: {
    shading: { value: 1 },
    numClippingPlanes: { value: 0 },
  },
  clipping: true,
})
