//
// Blob fragment shader chunk — vibrant mesh gradient
// Injected into MeshPhysicalMaterial via onBeforeCompile
// Hot pink dominant, deep indigo + blue-violet + warm orange supporting.
//

// Primaries + accents
const vec3 COL_HOT_PINK       = vec3(0.90, 0.01, 0.47);   // #E60278 — dominant
const vec3 COL_DEEP_INDIGO    = vec3(0.25, 0.05, 0.85);   // rich blue-violet
const vec3 COL_BLUE_VIOLET    = vec3(0.35, 0.18, 0.95);   // brighter blue-purple
const vec3 COL_WARM_ORANGE    = vec3(1.00, 0.50, 0.08);   // golden orange
const vec3 COL_MAGENTA        = vec3(0.88, 0.0,  0.60);   // pink→indigo bridge
const vec3 COL_CORAL_PINK     = vec3(0.98, 0.20, 0.30);   // pink→orange bridge

// Bell-shaped weight: center = peak position, width = spread
float bell(float t, float center, float width) {
  float d = (t - center) / width;
  return exp(-d * d * 2.0);
}

vec3 meshGradient(float t) {
  // Hot pink — dominant, two wide peaks wrapping the range
  float w1 = bell(t, 0.0,  0.38) * 1.6;
  float w2 = bell(t, 1.0,  0.38) * 1.4;

  // Blue-purple zone — boosted so they punch through the pink
  float w3 = bell(t, 0.32, 0.32) * 1.5;   // deep indigo — strong
  float w4 = bell(t, 0.44, 0.30) * 1.3;   // blue-violet — visible

  // Warm orange — wider bell so it fades gently into pink
  float w5 = bell(t, 0.72, 0.40) * 1.1;

  // Smooth bridges — coral wider to soften orange edges
  float w6 = bell(t, 0.18, 0.26) * 0.8;   // magenta: pink → blue zone
  float w7 = bell(t, 0.58, 0.36) * 0.9;   // coral-pink: blue zone → orange, wider

  float wSum = w1 + w2 + w3 + w4 + w5 + w6 + w7 + 0.001;

  return (COL_HOT_PINK     * w1
        + COL_HOT_PINK     * w2
        + COL_DEEP_INDIGO  * w3
        + COL_BLUE_VIOLET  * w4
        + COL_WARM_ORANGE  * w5
        + COL_MAGENTA      * w6
        + COL_CORAL_PINK   * w7) / wSum;
}
