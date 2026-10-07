"use client";

import type { CSSProperties } from "react";

type Props = {
  displayName: string;
  color: string;
  size?: number;
  online?: boolean;
  className?: string;
  ring?: boolean;
};

export default function Avatar({
  displayName,
  color,
  size = 40,
  online,
  className = "",
  ring = false,
}: Props) {
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const fontSize = Math.max(11, Math.round(size * 0.38));

  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-bold text-black select-none"
        style={
          {
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            fontSize,
            boxShadow: ring ? `0 0 0 2px #050505, 0 0 0 4px ${color}55` : undefined,
          } as CSSProperties
        }
        aria-hidden
      >
        {initials || "?"}
      </span>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full border-2 border-[#0a0a0c] transition-colors ${
            online ? "bg-emerald-400" : "bg-zinc-600"
          }`}
          style={{ width: Math.max(9, size * 0.28), height: Math.max(9, size * 0.28) }}
          aria-label={online ? "En línea" : "Desconectado"}
        />
      )}
    </span>
  );
}
