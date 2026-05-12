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
          width: "min(70vw, 70vh)",
          height: "min(70vw, 70vh)",
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 32%, #1aff7a 0%, #00C853 38%, #007a32 80%, #004d20 100%)",
          boxShadow: "0 0 80px 20px rgba(0,200,83,0.18), inset -18px -18px 40px rgba(0,0,0,0.35)",
          position: "relative",
          overflow: "hidden",
          animation: "spin3d 12s linear infinite",
        }}
      >
        {/* SVG seam lines */}
        <svg
          viewBox="0 0 200 200"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.7 }}
        >
          {/* Equatorial seam */}
          <ellipse cx="100" cy="100" rx="98" ry="28" fill="none" stroke="#005a24" strokeWidth="2.5" />
          {/* Vertical seam */}
          <ellipse cx="100" cy="100" rx="28" ry="98" fill="none" stroke="#005a24" strokeWidth="2.5" />
          {/* Diagonal seam 1 */}
          <ellipse cx="100" cy="100" rx="98" ry="28" fill="none" stroke="#005a24" strokeWidth="2.5"
            transform="rotate(60 100 100)" />
          {/* Diagonal seam 2 */}
          <ellipse cx="100" cy="100" rx="98" ry="28" fill="none" stroke="#005a24" strokeWidth="2.5"
            transform="rotate(-60 100 100)" />
        </svg>
        {/* Specular highlight */}
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "22%",
            width: "28%",
            height: "18%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 100%)",
            filter: "blur(4px)",
          }}
        />
      </div>
      <style>{`
        @keyframes spin3d {
          from { transform: rotate3d(0.2, 1, 0.1, 0deg); }
          to   { transform: rotate3d(0.2, 1, 0.1, 360deg); }
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
