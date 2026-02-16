/**
 * Global mutable settings store.
 * Written by the DebugPanel UI, read per-frame by the blob and voice analyser.
 * Using a plain object (not React state) so reads in useFrame don't cause re-renders.
 */
export const debugStore = {
  sensitivity: 3.0,
  noiseGate: 0.08,
  animationSpeed: 1.0,
  isMuted: false,
};
