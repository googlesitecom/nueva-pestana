"use client";

/**
 * Fondo animado premium: aurora + grid + ruido + viñeta.
 * Solo CSS (transform/opacity) para rendimiento. Respeta prefers-reduced-motion.
 */
export default function AnimatedBg({ dim = false }: { dim?: boolean }) {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#050505]">
      {/* Blobs de aurora */}
      <div
        className="axc-aurora axc-aurora-a absolute -top-[20%] left-[-10%] h-[55vmax] w-[55vmax] rounded-full opacity-70 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(251,191,36,0.16), rgba(251,146,60,0.05) 45%, transparent 70%)",
        }}
      />
      <div
        className="axc-aurora axc-aurora-b absolute top-[30%] right-[-15%] h-[50vmax] w-[50vmax] rounded-full opacity-60 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(239,68,68,0.10), rgba(190,24,93,0.05) 45%, transparent 70%)",
        }}
      />
      <div
        className="axc-aurora axc-aurora-c absolute bottom-[-25%] left-[20%] h-[45vmax] w-[45vmax] rounded-full opacity-60 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(52,211,153,0.08), rgba(45,212,191,0.04) 45%, transparent 70%)",
        }}
      />

      {/* Grid con paneo lento */}
      <div className="axc-grid absolute inset-0 opacity-[0.55]" />

      {/* Ruido */}
      <div
        className="axc-noise absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Viñeta */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 50% 0%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {dim && <div className="absolute inset-0 bg-black/30" />}
    </div>
  );
}
