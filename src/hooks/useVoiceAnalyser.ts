import { useRef, useState, useCallback, useEffect } from 'react';
import { debugStore } from '../lib/debugStore';

export interface VoiceData {
  amplitude: number;
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;
}

const EMPTY_VOICE_DATA: VoiceData = {
  amplitude: 0,
  lowEnergy: 0,
  midEnergy: 0,
  highEnergy: 0,
};

export interface MicDevice {
  deviceId: string;
  label: string;
}

/**
 * Hook that provides real-time voice analysis from the microphone.
 * Supports device enumeration, switching, mute, sensitivity, and noise gate
 * via the global debugStore.
 */
export function useVoiceAnalyser() {
  const [isListening, setIsListening] = useState(false);
  const [currentMic, setCurrentMic] = useState('');
  const [availableMics, setAvailableMics] = useState<MicDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const voiceData = useRef<VoiceData>({ ...EMPTY_VOICE_DATA });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number>(0);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const loadMicrophones = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}...`,
        }));
      setAvailableMics(audioInputs);
      return audioInputs;
    } catch {
      return [];
    }
  }, []);

  const analyse = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioContextRef.current;
    if (!analyser || !ctx) return;

    // Mute: fade out smoothly
    if (debugStore.isMuted) {
      const v = voiceData.current;
      v.amplitude *= 0.9;
      v.lowEnergy *= 0.9;
      v.midEnergy *= 0.9;
      v.highEnergy *= 0.9;
      rafIdRef.current = requestAnimationFrame(analyse);
      return;
    }

    let freqData = frequencyDataRef.current;
    if (!freqData) {
      freqData = new Uint8Array(analyser.frequencyBinCount);
      frequencyDataRef.current = freqData;
    }

    analyser.getByteFrequencyData(freqData);
    const bufferLength = analyser.frequencyBinCount;

    // Frequency band sums
    let bassSum = 0;
    let midSum = 0;
    let highSum = 0;

    for (let i = 0; i < 6; i++) bassSum += freqData[i];
    for (let i = 6; i < 50; i++) midSum += freqData[i];
    for (let i = 50; i < bufferLength; i++) highSum += freqData[i];

    let rawBass = bassSum / (6 * 255);
    let rawMid = midSum / (44 * 255);
    let rawHigh = highSum / ((bufferLength - 50) * 255);

    // Noise gate
    const gate = debugStore.noiseGate;
    rawBass = rawBass > gate ? (rawBass - gate) / (1 - gate) : 0;
    rawMid = rawMid > gate ? (rawMid - gate) / (1 - gate) : 0;
    rawHigh = rawHigh > gate ? (rawHigh - gate) / (1 - gate) : 0;

    // Apply sensitivity — very slow, calming smoothing
    const sensitivity = debugStore.sensitivity;
    const attack = 0.025;
    const release = 0.992;

    const v = voiceData.current;

    // Bass — reduced multiplier so it doesn't spike
    const targetBass = Math.min(1, rawBass * sensitivity * 1.0);
    v.lowEnergy =
      targetBass > v.lowEnergy
        ? v.lowEnergy + (targetBass - v.lowEnergy) * attack
        : v.lowEnergy * release;

    // Mid
    const targetMid = Math.min(1, rawMid * sensitivity * 1.2);
    v.midEnergy =
      targetMid > v.midEnergy
        ? v.midEnergy + (targetMid - v.midEnergy) * attack
        : v.midEnergy * release;

    // High
    const targetHigh = Math.min(1, rawHigh * sensitivity * 0.8);
    v.highEnergy =
      targetHigh > v.highEnergy
        ? v.highEnergy + (targetHigh - v.highEnergy) * attack
        : v.highEnergy * release;

    // Clamp and compute overall amplitude
    v.lowEnergy = Math.max(0, Math.min(1, v.lowEnergy)) || 0;
    v.midEnergy = Math.max(0, Math.min(1, v.midEnergy)) || 0;
    v.highEnergy = Math.max(0, Math.min(1, v.highEnergy)) || 0;
    v.amplitude = Math.max(v.lowEnergy, v.midEnergy, v.highEnergy);

    rafIdRef.current = requestAnimationFrame(analyse);
  }, []);

  const startListening = useCallback(
    async (deviceId: string | null = null) => {
      try {
        // Reset
        voiceData.current = { ...EMPTY_VOICE_DATA };

        // Stop existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
        }

        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        };

        if (deviceId) {
          audioConstraints.deviceId = { exact: deviceId };
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
        streamRef.current = stream;

        // Refresh device list (labels available after permission grant)
        await loadMicrophones();

        const tracks = stream.getAudioTracks();
        const settings = tracks[0]?.getSettings();
        setCurrentMic(tracks[0]?.label || 'Unknown Microphone');
        setSelectedDeviceId(settings?.deviceId || null);

        // Audio context
        if (
          !audioContextRef.current ||
          audioContextRef.current.state === 'closed'
        ) {
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioContextRef.current = new AC();
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Disconnect old source
        if (sourceRef.current) {
          sourceRef.current.disconnect();
        }

        sourceRef.current =
          audioContextRef.current.createMediaStreamSource(stream);

        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          analyserRef.current.smoothingTimeConstant = 0.85;
          analyserRef.current.minDecibels = -90;
          analyserRef.current.maxDecibels = -10;
        }

        sourceRef.current.connect(analyserRef.current);

        setIsListening(true);
        rafIdRef.current = requestAnimationFrame(analyse);
        return true;
      } catch (err) {
        console.error('Failed to access microphone:', err);
        return false;
      }
    },
    [analyse, loadMicrophones]
  );

  const switchMicrophone = useCallback(
    async (deviceId: string) => {
      await startListening(deviceId);
    },
    [startListening]
  );

  const stopListening = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (
      audioContextRef.current &&
      audioContextRef.current.state !== 'closed'
    ) {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    frequencyDataRef.current = null;
    voiceData.current = { ...EMPTY_VOICE_DATA };
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        stopListening();
      }
    };
  }, [stopListening]);

  return {
    voiceData,
    isListening,
    startListening,
    stopListening,
    currentMic,
    availableMics,
    selectedDeviceId,
    switchMicrophone,
  };
}
