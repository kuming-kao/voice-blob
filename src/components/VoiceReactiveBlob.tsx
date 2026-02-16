import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BlobMaterial, BLOB_DEFAULTS } from '../materials/BlobMaterial';
import { debugStore } from '../lib/debugStore';
import type { VoiceData } from '../hooks/useVoiceAnalyser';

/** Idle blob parameters */
const IDLE = {
  distort: BLOB_DEFAULTS.distort,
  speed: BLOB_DEFAULTS.speed,
  surfaceDistort: BLOB_DEFAULTS.surfaceDistort,
  surfaceSpeed: BLOB_DEFAULTS.surfaceSpeed,
};

/** Maximum blob parameters when voice is at peak amplitude
 *  Very tight range — calming breath, not wobble */
const ACTIVE = {
  distort: 0.70,       // pronounced shape shift with voice
  speed: 0.58,         // slight speed-up with voice
  surfaceDistort: 1.7,  // deeper ridges with voice
  surfaceSpeed: 0.48,   // slightly faster surface motion
};

/** Scale range: idle → peak voice */
const SCALE_IDLE = 0.64;
const SCALE_ACTIVE = 0.96;  // 50% expansion at peak

interface VoiceReactiveBlobProps {
  voiceData: React.RefObject<VoiceData>;
}

/**
 * Owns the blob mesh/material, reads voice data + debugStore per-frame,
 * and publishes audio levels to a hidden DOM element for the DebugPanel.
 */
export function VoiceReactiveBlob({ voiceData }: VoiceReactiveBlobProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new BlobMaterial(), []);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 192, 192), []);

  // Hidden DOM element for debug panel to poll audio levels
  useEffect(() => {
    const el = document.createElement('div');
    el.id = '__voice_data';
    el.style.display = 'none';
    document.body.appendChild(el);
    return () => {
      el.remove();
      material.dispose();
      geometry.dispose();
    };
  }, [material, geometry]);

  // Fade-in on load
  const fadeIn = useRef(0);
  useEffect(() => {
    material.transparent = true;
    material.opacity = 0;
  }, [material]);

  // Throttle DOM writes for audio levels
  const levelWriteCounter = useRef(0);
  // Smoothed scale for breathing effect
  const currentScale = useRef(SCALE_IDLE);

  // Mouse interaction state
  const { raycaster, pointer, camera } = useThree();
  const smoothedHit = useRef(new THREE.Vector3(0, 0, 0));
  const smoothedStrength = useRef(0);
  const localHit = useRef(new THREE.Vector3());
  const raycastFrame = useRef(0);

  useFrame((_, delta) => {
    const u = material.uniforms;
    if (!u) return;

    const dt = Math.min(delta, 0.1);

    // Smooth fade-in over ~1.5s
    if (fadeIn.current < 1) {
      fadeIn.current = Math.min(1, fadeIn.current + dt * 0.7);
      material.opacity = fadeIn.current * fadeIn.current; // ease-in curve
      if (fadeIn.current >= 1) {
        material.transparent = false;
      }
    }

    // Apply animation speed from debug store
    const speedMult = debugStore.animationSpeed;
    material.tick(dt * speedMult);

    // Read voice data
    const v = voiceData.current;
    const amp = v.amplitude;
    const mid = v.midEnergy;
    const high = v.highEnergy;

    // Map amplitude to blob parameters — very tight range
    const targetDistort = IDLE.distort + (ACTIVE.distort - IDLE.distort) * amp;
    const targetSpeed = (IDLE.speed + (ACTIVE.speed - IDLE.speed) * amp) * speedMult;

    const surfaceAmp = Math.max(mid, high);
    const targetSurfaceDistort =
      IDLE.surfaceDistort +
      (ACTIVE.surfaceDistort - IDLE.surfaceDistort) * surfaceAmp;
    const targetSurfaceSpeed =
      (IDLE.surfaceSpeed + (ACTIVE.surfaceSpeed - IDLE.surfaceSpeed) * amp) * speedMult;

    // Very gentle interpolation — smooth, calming motion
    const attackRate = 0.02;
    const releaseRate = 0.008;
    const lr = (cur: number, tgt: number) =>
      tgt > cur ? attackRate : releaseRate;

    u.distort.value += (targetDistort - u.distort.value) * lr(u.distort.value, targetDistort);
    u.speed.value += (targetSpeed - u.speed.value) * lr(u.speed.value, targetSpeed);
    u.surfaceDistort.value += (targetSurfaceDistort - u.surfaceDistort.value) * lr(u.surfaceDistort.value, targetSurfaceDistort);
    u.surfaceSpeed.value += (targetSurfaceSpeed - u.surfaceSpeed.value) * lr(u.surfaceSpeed.value, targetSurfaceSpeed);

    // Breathing scale — responsive expand/contract driven by voice
    const targetScale = SCALE_IDLE + (SCALE_ACTIVE - SCALE_IDLE) * amp;
    const scaleRate = targetScale > currentScale.current ? 0.06 : 0.03;
    currentScale.current += (targetScale - currentScale.current) * scaleRate;
    const s = currentScale.current;

    if (meshRef.current) {
      meshRef.current.scale.set(s, s, s);
      meshRef.current.rotation.y += dt * 0.08 * speedMult;
      meshRef.current.rotation.x += dt * 0.03 * speedMult;
    }

    // --- Mouse interaction: raycast every 3rd frame for performance ---
    const mu = material.mouseUniforms;
    raycastFrame.current++;
    if (meshRef.current && raycastFrame.current % 3 === 0) {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(meshRef.current);

      if (hits.length > 0) {
        // Convert world-space hit to object/local space
        localHit.current.copy(hits[0].point);
        meshRef.current.worldToLocal(localHit.current);

        // Smooth the hit position so the push glides
        smoothedHit.current.lerp(localHit.current, 0.12);
        // Fade strength in
        smoothedStrength.current += (0.4 - smoothedStrength.current) * 0.12;
      } else {
        // Fade strength out when cursor leaves
        smoothedStrength.current *= 0.92;
      }

      mu.mouseHit.value.copy(smoothedHit.current);
      mu.mouseStrength.value = smoothedStrength.current;
    }

    // Publish levels to DOM for DebugPanel (throttled to ~10fps)
    levelWriteCounter.current++;
    if (levelWriteCounter.current % 6 === 0) {
      const el = document.getElementById('__voice_data');
      if (el) {
        el.dataset.levels = JSON.stringify({
          low: v.lowEnergy,
          mid: v.midEnergy,
          high: v.highEnergy,
        });
      }
    }
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}
