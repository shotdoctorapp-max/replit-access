import React, { useRef, Component, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Ball() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.18;
      groupRef.current.rotation.x += delta * 0.06;
    }
  });

  const seamColor = "#007a32";
  const seamRadius = 1.005;
  const seamTube = 0.018;
  const seamSegments = 128;

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#00C853" roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Equatorial seam */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[seamRadius, seamTube, 16, seamSegments]} />
        <meshStandardMaterial color={seamColor} roughness={0.7} />
      </mesh>

      {/* Vertical seam */}
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[seamRadius, seamTube, 16, seamSegments]} />
        <meshStandardMaterial color={seamColor} roughness={0.7} />
      </mesh>

      {/* Diagonal seam 1 */}
      <mesh rotation={[0, 0, Math.PI / 3]}>
        <torusGeometry args={[seamRadius, seamTube, 16, seamSegments]} />
        <meshStandardMaterial color={seamColor} roughness={0.7} />
      </mesh>

      {/* Diagonal seam 2 */}
      <mesh rotation={[0, 0, -Math.PI / 3]}>
        <torusGeometry args={[seamRadius, seamTube, 16, seamSegments]} />
        <meshStandardMaterial color={seamColor} roughness={0.7} />
      </mesh>
    </group>
  );
}

function WebGLBasketball() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 4]} intensity={1.4} color="#ffffff" />
      <directionalLight position={[-3, -2, -3]} intensity={0.3} color="#00C853" />
      <pointLight position={[0, 4, 2]} intensity={0.6} color="#00ff66" />
      <Ball />
    </Canvas>
  );
}

function CSSBasketball() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        style={{
          width: "min(72vw, 72vh)",
          height: "min(72vw, 72vh)",
          borderRadius: "50%",
          position: "relative",
          animation: "ballSpin 18s linear infinite",
        }}
      >
        {/* Ball body with 3D shading */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: [
              "radial-gradient(circle at 38% 30%,",
              "  #5dff9a 0%,",
              "  #00C853 22%,",
              "  #009940 55%,",
              "  #005a24 80%,",
              "  #002d12 100%",
              ")",
            ].join(" "),
            boxShadow: [
              "0 0 100px 30px rgba(0,200,83,0.22)",
              "0 30px 80px rgba(0,0,0,0.6)",
            ].join(", "),
          }}
        />

        {/* Seam SVG — proper basketball arc pattern */}
        <svg
          viewBox="0 0 200 200"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}
        >
          <defs>
            <clipPath id="ballClip">
              <circle cx="100" cy="100" r="96" />
            </clipPath>
          </defs>
          <g clipPath="url(#ballClip)" fill="none" stroke="#004d1e" strokeWidth="3.5" strokeLinecap="round">
            {/* Left arc — curves left (C-shape) */}
            <path d="M 100 4 C 52 32, 52 168, 100 196" />
            {/* Right arc — curves right (reverse C) */}
            <path d="M 100 4 C 148 32, 148 168, 100 196" />
            {/* Top arc — curves up (∪ inverted) */}
            <path d="M 4 100 C 32 52, 168 52, 196 100" />
            {/* Bottom arc — curves down (∪ shape) */}
            <path d="M 4 100 C 32 148, 168 148, 196 100" />
          </g>
        </svg>

        {/* Specular highlight */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "20%",
            width: "32%",
            height: "22%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.40) 0%, transparent 100%)",
            filter: "blur(6px)",
          }}
        />
        {/* Rim shadow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            boxShadow: "inset -20px -20px 50px rgba(0,0,0,0.45)",
          }}
        />
      </div>
      <style>{`
        @keyframes ballSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function Basketball3D() {
  const webgl = isWebGLAvailable();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {webgl ? (
        <WebGLErrorBoundary fallback={<CSSBasketball />}>
          <WebGLBasketball />
        </WebGLErrorBoundary>
      ) : (
        <CSSBasketball />
      )}
      {/* Fade so hero text stays legible */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
    </div>
  );
}
