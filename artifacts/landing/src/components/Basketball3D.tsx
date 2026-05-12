import basketballImg from "../assets/basketball.png";

export function Basketball3D() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
      {/* Shift left to center the ball (ball sits in right half of the source image) */}
      <div style={{ width: "min(115vw, 115vh)", height: "min(115vw, 115vh)", transform: "translateX(-20%)", flexShrink: 0 }}>
        <img
          src={basketballImg}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.95,
            animation: "ballFloat 6s ease-in-out infinite",
          }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-black/55" />
      <style>{`
        @keyframes ballFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-14px) rotate(1.5deg); }
        }
      `}</style>
    </div>
  );
}
