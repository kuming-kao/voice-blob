import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { debugStore } from '../lib/debugStore';
import type { MicDevice } from '../hooks/useVoiceAnalyser';

interface DebugPanelProps {
  isActive: boolean;
  availableMics: MicDevice[];
  selectedDeviceId: string | null;
  onMicChange: (deviceId: string) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
}

// Design tokens from Figma
const colors = {
  text: '#1c2330',
  textMuted: '#5a6881',
  border: '#eaecf1',
  pink: '#e60278',
  background: '#ffffff',
};

function sliderStyle(value: number, min: number, max: number): CSSProperties {
  const pct = ((value - min) / (max - min)) * 100;
  return {
    width: '100%',
    height: 4,
    borderRadius: 8,
    appearance: 'none',
    WebkitAppearance: 'none' as const,
    background: `linear-gradient(to right, ${colors.pink} ${pct}%, ${colors.border} ${pct}%)`,
    cursor: 'pointer',
    outline: 'none',
  };
}

function levelBarStyle(value: number): CSSProperties {
  return {
    width: `${Math.min(100, value * 100)}%`,
    height: '100%',
    background: colors.text,
    borderRadius: 8,
    transition: 'width 0.05s',
  };
}

export function DebugPanel({
  isActive,
  availableMics,
  selectedDeviceId,
  onMicChange,
  isMuted,
  onMuteToggle,
}: DebugPanelProps) {
  const [levels, setLevels] = useState({ bass: '0.000', mid: '0.000', high: '0.000' });
  const [sensitivity, setSensitivity] = useState(debugStore.sensitivity);
  const [noiseGate, setNoiseGate] = useState(debugStore.noiseGate);
  const [animationSpeed, setAnimationSpeed] = useState(debugStore.animationSpeed);

  // Poll audio levels for display
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      // Read from the voiceData ref indirectly via debugStore isn't ideal,
      // so we expose a global for the panel to read. The panel imports
      // this from the hook's returned ref in the parent -- but for the
      // level display we use a simple polling approach via a global.
      const el = document.getElementById('__voice_data');
      if (el) {
        try {
          const d = JSON.parse(el.dataset.levels || '{}');
          setLevels({
            bass: (d.low ?? 0).toFixed(3),
            mid: (d.mid ?? 0).toFixed(3),
            high: (d.high ?? 0).toFixed(3),
          });
        } catch { /* ignore */ }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isActive]);

  const handleSensitivity = (v: string) => {
    const val = parseFloat(v);
    setSensitivity(val);
    debugStore.sensitivity = val;
  };

  const handleNoiseGate = (v: string) => {
    const val = parseFloat(v);
    setNoiseGate(val);
    debugStore.noiseGate = val;
  };

  const handleAnimationSpeed = (v: string) => {
    const val = parseFloat(v);
    setAnimationSpeed(val);
    debugStore.animationSpeed = val;
  };

  if (!isActive) return null;

  return (
    <>
      {/* Slider thumb styles */}
      <style>{`
        .debug-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${colors.pink};
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .debug-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${colors.pink};
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .mute-button {
          transition: opacity 0.15s ease;
        }
        .mute-button:hover {
          opacity: 0.8;
        }
        .debug-panel {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="debug-panel"
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          fontFamily: '"Red Hat Mono", monospace',
          background: colors.background,
          border: 'none',
          borderRadius: 16,
          padding: '48px 24px 56px 24px',
          zIndex: 100,
          width: 358,
        }}
      >
        {/* Microphone */}
        <div style={{ marginBottom: 48 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 12,
              color: colors.text,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Microphone
          </label>
          <div
            style={{
              position: 'relative',
              background: '#F7F8FB',
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              height: 40,
            }}
          >
            <select
              value={selectedDeviceId || ''}
              onChange={(e) => onMicChange(e.target.value)}
              style={{
                width: '100%',
                height: '100%',
                padding: '0 40px 0 12px',
                background: 'transparent',
                border: 'none',
                color: colors.text,
                fontSize: 12,
                fontFamily: '"Red Hat Mono", monospace',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none' as const,
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {availableMics.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>
            {/* Chevron */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              <path
                d="M7.29102 8.54163C7.04992 8.54163 6.83031 8.68029 6.72668 8.89804C6.62307 9.11571 6.65391 9.37363 6.80595 9.56071L9.51427 12.894C9.63293 13.0401 9.81118 13.125 9.99935 13.125C10.1876 13.125 10.3658 13.0401 10.4844 12.894L13.1928 9.56071C13.3448 9.37363 13.3757 9.11571 13.272 8.89804C13.1684 8.68029 12.9488 8.54163 12.7077 8.54163H7.29102Z"
                fill={colors.text}
              />
            </svg>
          </div>
        </div>

        {/* Sliders */}
        <div style={{ marginBottom: 48 }}>
          {/* Sensitivity */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <label style={{ color: colors.text, fontSize: 14, fontWeight: 600 }}>
                Sensitivity
              </label>
              <span style={{ color: colors.textMuted, fontSize: 12, fontWeight: 400 }}>
                {sensitivity.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="5"
              step="0.1"
              value={sensitivity}
              onChange={(e) => handleSensitivity(e.target.value)}
              className="debug-slider"
              style={sliderStyle(sensitivity, 0.2, 5)}
            />
          </div>

          {/* Background noise */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <label style={{ color: colors.text, fontSize: 14, fontWeight: 600 }}>
                Background noise
              </label>
              <span style={{ color: colors.textMuted, fontSize: 12, fontWeight: 400 }}>
                {(noiseGate * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.01"
              value={noiseGate}
              onChange={(e) => handleNoiseGate(e.target.value)}
              className="debug-slider"
              style={sliderStyle(noiseGate, 0, 0.3)}
            />
          </div>

          {/* Animation speed */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <label style={{ color: colors.text, fontSize: 14, fontWeight: 600 }}>
                Animation speed
              </label>
              <span style={{ color: colors.textMuted, fontSize: 12, fontWeight: 400 }}>
                {animationSpeed.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={animationSpeed}
              onChange={(e) => handleAnimationSpeed(e.target.value)}
              className="debug-slider"
              style={sliderStyle(animationSpeed, 0.1, 5)}
            />
          </div>
        </div>

        {/* Audio levels */}
        <div style={{ marginBottom: 56 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 24,
              color: colors.text,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Audio levels
          </label>

          {/* Bass */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span style={{ color: colors.text, fontSize: 14, fontWeight: 400 }}>Bass</span>
              <span style={{ color: colors.textMuted, fontSize: 12, fontWeight: 400 }}>
                {levels.bass}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                background: colors.border,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div style={levelBarStyle(parseFloat(levels.bass))} />
            </div>
          </div>

          {/* Mid */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span style={{ color: colors.text, fontSize: 14, fontWeight: 400 }}>Mid</span>
              <span style={{ color: colors.textMuted, fontSize: 12, fontWeight: 400 }}>
                {levels.mid}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                background: colors.border,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div style={levelBarStyle(parseFloat(levels.mid))} />
            </div>
          </div>

          {/* High */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span style={{ color: colors.text, fontSize: 14, fontWeight: 400 }}>High</span>
              <span style={{ color: colors.textMuted, fontSize: 12, fontWeight: 400 }}>
                {levels.high}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                background: colors.border,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div style={levelBarStyle(parseFloat(levels.high))} />
            </div>
          </div>
        </div>

        {/* Mute/Unmute Button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={onMuteToggle}
            className="mute-button"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: isMuted ? 'none' : `1px solid ${colors.border}`,
              background: isMuted ? colors.text : '#F7F8FB',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isMuted ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M14.1675 9.16667C14.1675 9.60883 14.0986 10.0348 13.9711 10.4347L6.75586 3.21945C7.51964 2.27246 8.68948 1.66667 10.0008 1.66667C12.3021 1.66667 14.1675 3.53215 14.1675 5.83333V9.16667Z"
                  fill="white"
                />
                <path
                  d="M1.91107 1.91074C2.23651 1.58531 2.76414 1.58531 3.08958 1.91074L18.0896 16.9107C18.415 17.2362 18.415 17.7638 18.0896 18.0892C17.7642 18.4147 17.2365 18.4147 16.9111 18.0892L14.2035 15.3817C13.3025 16.0025 12.1867 16.482 10.8337 16.6237V17.5C10.8337 17.9602 10.4606 18.3333 10.0003 18.3333C9.54008 18.3333 9.16699 17.9602 9.16699 17.5V16.624C6.20572 16.3153 4.41626 14.3965 3.47991 12.9537C3.22937 12.5676 3.33923 12.0515 3.72531 11.801C4.11138 11.5504 4.62745 11.6603 4.87798 12.0463C5.74433 13.3813 7.33358 15 10.0003 15C11.2201 15 12.2053 14.6645 12.9994 14.1776L11.7642 12.9424C11.2282 13.1932 10.63 13.3333 10.0003 13.3333C7.69915 13.3333 5.83367 11.4678 5.83367 9.16667V7.01186L1.91107 3.08926C1.58563 2.76382 1.58563 2.23618 1.91107 1.91074Z"
                  fill="white"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10.0006 1.66667C7.69947 1.66667 5.83398 3.53215 5.83398 5.83333V9.16667C5.83398 11.4678 7.69947 13.3333 10.0006 13.3333C12.3018 13.3333 14.1673 11.4678 14.1673 9.16667V5.83333C14.1673 3.53215 12.3018 1.66667 10.0006 1.66667Z"
                  fill={colors.text}
                />
                <path
                  d="M4.87915 12.0463C4.62862 11.6603 4.11254 11.5504 3.72648 11.801C3.3404 12.0515 3.23053 12.5676 3.48108 12.9537C4.41743 14.3965 6.20688 16.3153 9.16816 16.624V17.5C9.16816 17.9602 9.54124 18.3333 10.0015 18.3333C10.4617 18.3333 10.8348 17.9602 10.8348 17.5V16.624C13.7962 16.3153 15.5856 14.3965 16.5219 12.9537C16.7725 12.5676 16.6626 12.0515 16.2765 11.801C15.8905 11.5504 15.3744 11.6603 15.1238 12.0463C14.2575 13.3813 12.6682 15 10.0015 15C7.33475 15 5.74549 13.3813 4.87915 12.0463Z"
                  fill={colors.text}
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
