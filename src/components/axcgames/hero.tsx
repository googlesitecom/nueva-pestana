"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronDown, Flame, Heart, Play, Star, Users } from "lucide-react";
import type { Game } from "@/lib/games";

type Props = {
  game: Game;
  onPlay: (game: Game) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onExplore: () => void;
};

export default function Hero({
  game,
  onPlay,
  isFavorite,
  onToggleFavorite,
  onExplore,
}: Props) {
  return (
    <section
      id="inicio"
      className="relative mx-auto w-full max-w-7xl scroll-mt-24 px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black"
      >
        <div className="relative h-[500px] w-full sm:h-[440px] lg:h-[520px]">
          <Image
            src={game.cover}
            alt={`Portada de ${game.title}, juego de carreras de Fórmula 1`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {/* Legibility overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/75 to-[#050505]/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/40" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 lg:p-14">
            <div className="max-w-2xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-black shadow-lg shadow-amber-400/25">
                  <Flame className="h-3.5 w-3.5" fill="currentColor" />
                  Destacado
                </span>
                <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/80 backdrop-blur">
                  {game.categories.join(" · ")}
                </span>
              </div>

              <h1 className="font-display text-4xl font-black leading-[1.05] tracking-wide text-white sm:text-5xl lg:text-6xl">
                {game.title.toUpperCase()}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
                {game.description}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-400" fill="currentColor" />
                  <b className="text-white">{game.rating}</b>
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-white/50" />
                  {game.players} jugadores
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="axc-pulse h-2 w-2 rounded-full bg-amber-400" />
                  Juega al instante
                </span>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onPlay(game)}
                  className="axc-shine relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-amber-400 px-7 py-3.5 font-display text-sm font-bold tracking-widest text-black shadow-xl shadow-amber-400/30 transition hover:bg-amber-300 hover:shadow-amber-400/50 active:scale-95"
                >
                  <Play className="h-4 w-4" fill="currentColor" />
                  JUGAR AHORA
                </button>
                <button
                  type="button"
                  onClick={onExplore}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/85 backdrop-blur transition hover:border-white/35 hover:bg-white/10 active:scale-95"
                >
                  Explorar juegos
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(game.id)}
                  aria-label={
                    isFavorite
                      ? `Quitar ${game.title} de favoritos`
                      : `Añadir ${game.title} a favoritos`
                  }
                  className="rounded-full border border-white/15 bg-white/5 p-3.5 text-white/80 backdrop-blur transition hover:border-amber-400/50 hover:text-amber-400 active:scale-95"
                >
                  <Heart
                    className="h-5 w-5"
                    fill={isFavorite ? "#fbbf24" : "none"}
                    color={isFavorite ? "#fbbf24" : "currentColor"}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
