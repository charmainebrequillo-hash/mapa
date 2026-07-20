"use client";

export function BackgroundGrid() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#111417]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 242, 255, 1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 242, 255, 1) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          animation: "grid-drift 8s linear infinite",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(0, 242, 255, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(182, 0, 248, 0.2) 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, rgba(254, 214, 57, 0.1) 0%, transparent 50%)
          `,
        }}
      />
      <div
        className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-[0.03]"
        style={{
          background: "radial-gradient(circle, #00f2ff 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "orb-drift 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-1/3 -right-24 w-80 h-80 rounded-full opacity-[0.02]"
        style={{
          background: "radial-gradient(circle, #b600f8 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "orb-drift-2 15s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes grid-drift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
        @keyframes orb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(80px, -40px) scale(1.1); }
          66% { transform: translate(-40px, 60px) scale(0.9); }
        }
        @keyframes orb-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-60px, 40px) scale(1.15); }
          66% { transform: translate(50px, -30px) scale(0.85); }
        }
      `}</style>
    </div>
  );
}
