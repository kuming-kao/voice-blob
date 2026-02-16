//
// Blob vertex displacement shader chunk
// Injected into MeshPhysicalMaterial via onBeforeCompile
//

#define M_PI 3.14159265358979323846
#define NOISE_PERIOD 10.0

uniform float time;
uniform float distort;
uniform float frequency;
uniform float speed;
uniform float surfaceDistort;
uniform float surfaceFrequency;
uniform float surfaceSpeed;
uniform float surfaceTime;
uniform float numberOfWaves;
uniform float fixNormals;
uniform float gooPoleAmount;
uniform float surfacePoleAmount;

// Mouse interaction — hit point in local/object space
uniform vec3 mouseHit;
uniform float mouseRadius;
uniform float mouseStrength;

// Varyings for fragment shader gradient
varying vec3 vBlobWorldPos;
varying vec3 vBlobLocalPos;
varying float vDisplacement;

// -- Perlin noise is prepended before this chunk --

// Displacement function: combines blob noise + surface waves
float displace(vec3 point) {
  // Pole attenuation — reduces distortion near sphere poles to prevent pinching
  float yPos = smoothstep(-1.0, 1.0, point.y);
  float poleAmount = sin(yPos * M_PI);
  float wavePoleAtten = mix(poleAmount, 1.0, surfacePoleAmount);
  float gooPoleAtten = mix(poleAmount, 1.0, gooPoleAmount);

  // Primary blob deformation — large-scale organic noise
  float goo = pnoise(
    vec3(point / frequency + mod(time * speed, NOISE_PERIOD)),
    vec3(NOISE_PERIOD)
  ) * pow(distort, 2.0);

  // Surface waves — broad, chunky ridges
  float surfaceNoise = pnoise(
    vec3(point / surfaceFrequency + mod(surfaceTime, NOISE_PERIOD)),
    vec3(NOISE_PERIOD)
  );
  float waves = (
    point.x * sin((point.y + surfaceNoise) * M_PI * numberOfWaves) +
    point.z * cos((point.y + surfaceNoise) * M_PI * numberOfWaves)
  ) * 0.03 * pow(surfaceDistort, 2.0);

  float base = waves * wavePoleAtten + goo * gooPoleAtten;

  // Mouse push — smooth radial displacement around cursor hit point
  float mouseDist = length(point - mouseHit);
  float mousePush = mouseStrength * exp(-mouseDist * mouseDist / (mouseRadius * mouseRadius));

  return base + mousePush;
}

// Helper: find an orthogonal vector
vec3 orthogonal(vec3 v) {
  return normalize(
    abs(v.x) > abs(v.z)
      ? vec3(-v.y, v.x, 0.0)
      : vec3(0.0, -v.z, v.y)
  );
}
