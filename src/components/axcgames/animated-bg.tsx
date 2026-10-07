"use client";

import { useEffect, useRef } from "react";

/**
 * Campo de partículas conectadas (canvas) — patrón animado premium.
 * Se pausa cuando la pestaña está oculta y respeta prefers-reduced-motion.
 */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type P = { x: number; y: number; vx: number; vy: number; r: number; gold: boolean };
    let parts: P[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(85, Math.max(28, Math.floor((w * h) / 26000)));
      parts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.5 + 0.5,
        gold: Math.random() < 0.55,
      }));
    };

    const step = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -24) p.x = w + 24;
        if (p.x > w + 24) p.x = -24;
        if (p.y < -24) p.y = h + 24;
        if (p.y > h + 24) p.y = -24;
      }

      const maxDist = 110;
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        for (let j = i + 1; j < parts.length; j++) {
          const b = parts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxDist * maxDist) {
            const alpha = (1 - Math.sqrt(d2) / maxDist) * 0.13;
            ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of parts) {
        ctx.fillStyle = p.gold
          ? "rgba(251, 191, 36, 0.5)"
          : "rgba(255, 255, 255, 0.32)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(step);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-60" />;
}

/**
 * Fondo animado premium: partículas + aurora + grid + ruido + viñeta.
 * Solo transform/opacity/canvas para rendimiento. Respeta prefers-reduced-motion.
 */
export default function AnimatedBg({ dim = false }: { dim?: boolean }) {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#050505]">
      {/* Partículas conectadas */}
      <Particles />

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
