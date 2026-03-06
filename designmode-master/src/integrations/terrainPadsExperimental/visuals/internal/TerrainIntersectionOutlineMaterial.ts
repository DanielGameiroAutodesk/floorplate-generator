import { Color, ShaderMaterial, UniformsUtils, Vector2 } from "three"
import { screenResolutionVector } from "src/core/three/sceneManager"

// Adopted from three/src/renderers/shaders/ShaderLib/meshlambert_vert.glsl + meshlambert_frag.glsl
// language=GLSL
const lineVertex = `
    uniform vec2 resolution;
    attribute vec3 instanceStart;
    attribute vec3 instanceEnd;
    uniform float cameraOffsetMeters;

    void trimSegment( const in vec4 start, inout vec4 end ) {

      // trim end segment so it terminates between the camera plane and the near plane

      // conservative estimate of the near plane
      float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
      float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
      float nearEstimate = - 0.5 * b / a;

      float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

      end.xyz = mix( start.xyz, end.xyz, alpha );

    }

    void lineMat(float linewidth) {

      float aspect = resolution.x / resolution.y;

      // move vertices towards camera relative to distance but capped at 10cm
      vec4 worldStart = modelMatrix * vec4( instanceStart, 1.0 );
      vec4 cameraVecStart = vec4(cameraPosition, 1.0) - worldStart;
      float factorStart = min(length(cameraVecStart) * 0.001, 0.1);
      vec4 movedToCameraStart = worldStart + factorStart * normalize(cameraVecStart);
      vec4 worldEnd = modelMatrix * vec4( instanceEnd, 1.0 );
      vec4 cameraVecEnd = vec4(cameraPosition, 1.0) - worldEnd;
      float factorEnd = min(length(cameraVecEnd) * 0.001, 0.1);
      vec4 movedToCameraEnd = worldEnd + factorEnd * normalize(cameraVecEnd);

      // camera space
      vec4 start = viewMatrix * vec4( movedToCameraStart.xyz, 1.0 );
      vec4 end = viewMatrix * vec4( movedToCameraEnd.xyz, 1.0 );

      start.xyz += normalize(start.xyz) * cameraOffsetMeters;
      end.xyz += normalize(end.xyz) * cameraOffsetMeters;

      // special case for perspective projection, and segments that terminate either in, or behind, the camera plane
      // clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
      // but we need to perform ndc-space calculations in the shader, so we must address this issue directly
      // perhaps there is a more elegant solution -- WestLangley

      bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

      if ( perspective ) {

        if ( start.z < 0.0 && end.z >= 0.0 ) {

          trimSegment( start, end );

        } else if ( end.z < 0.0 && start.z >= 0.0 ) {

          trimSegment( end, start );

        }

      }

      // clip space
      vec4 clipStart = projectionMatrix * start;
      vec4 clipEnd = projectionMatrix * end;

      // ndc space
      vec3 ndcStart = clipStart.xyz / clipStart.w;
      vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

      // direction
      vec2 dir = ndcEnd.xy - ndcStart.xy;

      // account for clip-space aspect ratio
      dir.x *= aspect;
      dir = normalize( dir );


      vec2 offset = vec2( dir.y, - dir.x );
      // undo aspect ratio adjustment
      dir.x /= aspect;
      offset.x /= aspect;

      // sign flip
      if ( position.x < 0.0 ) offset *= - 1.0;

      // endcaps
      if ( position.y < 0.0 ) {

        offset += - dir;

      } else if ( position.y > 1.0 ) {

        offset += dir;

      }

      // adjust for linewidth
      offset *= linewidth;

      // adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
      offset /= resolution.y;

      // select end
      vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

      // back to clip space
      offset *= clip.w;

      clip.xy += offset;
      gl_Position = clip;

    }
`

// language=GLSL
const vertexShader = `
    uniform float linewidth;
    void main() {
      lineMat(linewidth);
    }
`
// language=GLSL
const fragmentShader = `
    uniform vec3 color;
    void main() {
      gl_FragColor = vec4(color, 1.0);
    }
`
const lineUniforms = {
  linewidth: { value: 2 },
  resolution: { value: new Vector2(1, 1) },
}

export function createSelectionOutlineMaterial() {
  return new ShaderMaterial({
    name: "OutLineMaterial.js",
    uniforms: {
      ...UniformsUtils.clone(lineUniforms),
      resolution: { value: screenResolutionVector },
      color: { value: new Color("#006EAF").convertLinearToSRGB() },
      cameraOffsetMeters: { value: -0.5 },
    },
    vertexShader: lineVertex + vertexShader,
    fragmentShader,
  })
}
