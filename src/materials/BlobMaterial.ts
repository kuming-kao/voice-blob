import * as THREE from 'three';
import noiseGlsl from '../shaders/noise.glsl?raw';
import blobVertexGlsl from '../shaders/blobVertex.glsl?raw';
import blobFragmentGlsl from '../shaders/blobFragment.glsl?raw';

/**
 * Default uniform values for the blob shader.
 * These define the idle/"breathing" state of the blob.
 */
export const BLOB_DEFAULTS = {
  time: 0,
  distort: 0.6,            // pronounced organic shape
  frequency: 1.5,           // broad, chunky folds
  speed: 0.5,               // smooth but noticeable motion
  surfaceDistort: 1.4,      // deeper ridges for visual interest
  surfaceFrequency: 1.2,    // large smooth surface features
  surfaceSpeed: 0.4,        // visible surface movement
  surfaceTime: 0,
  numberOfWaves: 2.5,       // fewer, chunkier ridges
  fixNormals: 1.0,
  gooPoleAmount: 0.95,      // allow deformation almost everywhere
  surfacePoleAmount: 0.85,  // surface waves reach the poles
} as const;

export type BlobUniforms = {
  [K in keyof typeof BLOB_DEFAULTS]: THREE.IUniform<number>;
};

/**
 * Creates a typed uniforms object from default values.
 */
function createBlobUniforms(): BlobUniforms {
  const uniforms = {} as BlobUniforms;
  for (const [key, value] of Object.entries(BLOB_DEFAULTS)) {
    (uniforms as Record<string, THREE.IUniform<number>>)[key] = { value };
  }
  return uniforms;
}

/**
 * BlobMaterial — satin-finish physical material with flowing mesh gradient.
 *
 * Extends MeshPhysicalMaterial with:
 *   - Vertex shader: Perlin noise displacement + normal recalculation
 *   - Fragment shader: Procedural mesh gradient based on world position + noise
 *   - Satin surface: moderate roughness, low metalness, no clearcoat
 */
/** Mouse interaction uniforms — separate from blob defaults (different types). */
export type MouseUniforms = {
  mouseHit: THREE.IUniform<THREE.Vector3>;
  mouseRadius: THREE.IUniform<number>;
  mouseStrength: THREE.IUniform<number>;
};

function createMouseUniforms(): MouseUniforms {
  return {
    mouseHit: { value: new THREE.Vector3(0, 0, 0) },
    mouseRadius: { value: 0.55 },
    mouseStrength: { value: 0.0 },
  };
}

export class BlobMaterial extends THREE.MeshPhysicalMaterial {
  uniforms: BlobUniforms;
  mouseUniforms: MouseUniforms;

  constructor(params?: THREE.MeshPhysicalMaterialParameters) {
    super({
      // --- Satin finish ---
      metalness: 0.15,
      roughness: 0.38,
      clearcoat: 0.0,
      clearcoatRoughness: 0.0,
      // Subtle iridescence for gentle color shift at grazing angles
      iridescence: 0.3,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [100, 400],
      // Soft environment reflections — enough to add depth, not overpower
      envMapIntensity: 0.7,
      // Base color — will be overridden by mesh gradient in fragment shader
      color: new THREE.Color('#ffffff'),
      sheen: 0.8,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color('#E60278'),
      // Dithering breaks up colour banding in smooth gradients/highlights
      dithering: true,
      ...params,
    });

    this.uniforms = createBlobUniforms();
    this.mouseUniforms = createMouseUniforms();

    this.onBeforeCompile = (shader) => {
      // Merge blob uniforms into the shader's uniform set
      for (const [key, uniform] of Object.entries(this.uniforms)) {
        shader.uniforms[key] = uniform;
      }
      // Merge mouse interaction uniforms
      for (const [key, uniform] of Object.entries(this.mouseUniforms)) {
        shader.uniforms[key] = uniform;
      }

      // =============================================
      // VERTEX SHADER MODIFICATIONS
      // =============================================

      // 1. Prepend noise + displacement functions before main()
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `
${noiseGlsl}
${blobVertexGlsl}

void main() {`
      );

      // 2. Replace #include <beginnormal_vertex>
      //    Compute displacement + normals BEFORE defaultnormal_vertex
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `
// --- Blob: compute displacement and corrected normals ---
float blobDisplacement = displace(position);

vec3 blobObjectNormal = normal;

if (fixNormals > 0.5) {
  float eps = 0.005;
  vec3 tang = orthogonal(normal);
  vec3 bitang = normalize(cross(normal, tang));

  float d0 = displace(position + tang * eps);
  float d1 = displace(position + bitang * eps);

  vec3 displacedPos = position + normal * blobDisplacement;
  vec3 displacedTang = position + tang * eps + normal * d0;
  vec3 displacedBitang = position + bitang * eps + normal * d1;

  blobObjectNormal = normalize(cross(
    displacedTang - displacedPos,
    displacedBitang - displacedPos
  ));
}

vec3 objectNormal = blobObjectNormal;

#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`
      );

      // 3. Replace #include <begin_vertex>
      //    Apply displacement + write varyings for fragment shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
// --- Blob: displace position + export gradient data ---
vec3 transformed = position + normal * blobDisplacement;

// Pass data to fragment shader for mesh gradient
vBlobLocalPos = position;
vDisplacement = blobDisplacement;
`
      );

      // 4. After worldpos_vertex, capture the world position for gradient
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
#include <worldpos_vertex>
vBlobWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`
      );

      // =============================================
      // FRAGMENT SHADER MODIFICATIONS
      // =============================================

      // 1. Add varyings + gradient functions before main()
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `
// Varyings from vertex shader
varying vec3 vBlobWorldPos;
varying vec3 vBlobLocalPos;
varying float vDisplacement;

// Uniforms needed for gradient animation
uniform float time;
uniform float speed;
uniform float frequency;

${noiseGlsl}
${blobFragmentGlsl}

void main() {`
      );

      // 2. After #include <color_fragment>, override diffuseColor with mesh gradient
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
#include <color_fragment>

// --- Vibrant mesh gradient: multiple colors visible at once, flowing in real time ---
vec3 gp = vBlobLocalPos;
float t = mod(time * 0.25, 10.0);  // faster flow so colours shift visibly

// Low spatial freq → very broad, gentle colour regions
// Single layer keeps the full noise range so all colours are reachable
float n1 = pnoise(vec3(gp * 0.4 + t), vec3(10.0));
float n2 = pnoise(vec3(gp.yzx * 0.35 + t * 0.7 + 4.2), vec3(10.0));

float gradParam = n1 + n2 * 0.25;
gradParam = gradParam * 0.5 + 0.5;
gradParam = clamp(gradParam, 0.0, 1.0);

// Gentle fresnel nudge for depth
vec3 viewDir = normalize(cameraPosition - vBlobWorldPos);
float fresnel = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
fresnel = pow(fresnel, 3.0);
gradParam = clamp(gradParam + fresnel * 0.08, 0.0, 1.0);

// Sample the gradient — bell-curve weights give multi-color mix
vec3 gradientColor = meshGradient(gradParam);

// Heavy saturation boost — compensates for PBR material wash
float luma = dot(gradientColor, vec3(0.299, 0.587, 0.114));
gradientColor = mix(vec3(luma), gradientColor, 2.0);
// Push values deeper — clamp keeps things valid
gradientColor = clamp(gradientColor * 1.15, 0.0, 1.0);

diffuseColor.rgb = gradientColor;
`
      );
    };

    this.needsUpdate = true;
  }

  /**
   * Call this every frame to advance animation time.
   */
  tick(delta: number) {
    this.uniforms.time.value += delta * this.uniforms.speed.value;
    this.uniforms.surfaceTime.value += delta * this.uniforms.surfaceSpeed.value;
  }
}
