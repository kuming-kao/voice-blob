import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { VoiceReactiveBlob } from './components/VoiceReactiveBlob';
import { DebugPanel } from './components/DebugPanel';
import { useVoiceAnalyser } from './hooks/useVoiceAnalyser';
import { debugStore } from './lib/debugStore';
import './index.css';

export default function App() {
  const {
    voiceData,
    isListening,
    startListening,
    availableMics,
    selectedDeviceId,
    switchMicrophone,
  } = useVoiceAnalyser();

  const [showButton, setShowButton] = useState(true);
  const [buttonFading, setButtonFading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [buttonActive, setButtonActive] = useState(false);

  const handleEnableMic = async () => {
    setButtonFading(true);
    const success = await startListening();
    if (success) {
      setTimeout(() => setShowButton(false), 500);
    } else {
      setButtonFading(false);
      alert('Could not access microphone. Please check your browser permissions.');
    }
  };

  const handleMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    debugStore.isMuted = next;
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#FCD9EF',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 45 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        scene={{ background: new THREE.Color('#FCD9EF') }}
      >
        {/* Lighting -- soft and diffuse, with pink/violet accents */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} />
        <directionalLight position={[-3, -2, -4]} intensity={0.35} color="#8B2FC6" />
        <directionalLight position={[2, -3, 3]} intensity={0.2} color="#E60278" />
        <pointLight position={[0, 4, 0]} intensity={0.3} color="#00B4D8" />

        <Environment preset="studio" />
        <VoiceReactiveBlob voiceData={voiceData} />


        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={2}
          maxDistance={8}
        />
      </Canvas>

      {/* Debug panel — appears after mic is enabled */}
      <DebugPanel
        isActive={isListening}
        availableMics={availableMics}
        selectedDeviceId={selectedDeviceId}
        onMicChange={switchMicrophone}
        isMuted={isMuted}
        onMuteToggle={handleMuteToggle}
      />

      {/* Enable microphone button — matches reference project exactly */}
      {showButton && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              background: 'rgba(255, 255, 255, 0.3)',
              zIndex: 99,
              opacity: buttonFading ? 0 : 1,
              transition: 'opacity 0.5s ease',
              pointerEvents: 'none',
            }}
          />
          <button
            onClick={handleEnableMic}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => {
              setButtonHovered(false);
              setButtonActive(false);
            }}
            onMouseDown={() => setButtonActive(true)}
            onMouseUp={() => setButtonActive(false)}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: buttonActive
                ? 'translate(-50%, -50%) scale(0.98)'
                : 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 64,
              paddingLeft: 30,
              paddingRight: 32,
              fontSize: 16,
              fontWeight: 600,
              fontFamily: '"Red Hat Mono", monospace',
              color: '#ffffff',
              background: buttonActive
                ? '#A00043'
                : buttonHovered
                  ? '#C6005B'
                  : '#e60278',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              opacity: buttonFading ? 0 : 1,
              pointerEvents: buttonFading ? 'none' : 'auto',
              zIndex: 100,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10.0006 1.66667C7.69947 1.66667 5.83398 3.53215 5.83398 5.83333V9.16667C5.83398 11.4678 7.69947 13.3333 10.0006 13.3333C12.3018 13.3333 14.1673 11.4678 14.1673 9.16667V5.83333C14.1673 3.53215 12.3018 1.66667 10.0006 1.66667Z"
                fill="white"
              />
              <path
                d="M4.87915 12.0463C4.62862 11.6603 4.11254 11.5504 3.72648 11.801C3.3404 12.0515 3.23053 12.5676 3.48108 12.9537C4.41743 14.3965 6.20688 16.3153 9.16816 16.624V17.5C9.16816 17.9602 9.54124 18.3333 10.0015 18.3333C10.4617 18.3333 10.8348 17.9602 10.8348 17.5V16.624C13.7962 16.3153 15.5856 14.3965 16.5219 12.9537C16.7725 12.5676 16.6626 12.0515 16.2765 11.801C15.8905 11.5504 15.3744 11.6603 15.1238 12.0463C14.2575 13.3813 12.6682 15 10.0015 15C7.33475 15 5.74549 13.3813 4.87915 12.0463Z"
                fill="white"
              />
            </svg>
            Enable microphone
          </button>
        </>
      )}
    </div>
  );
}
