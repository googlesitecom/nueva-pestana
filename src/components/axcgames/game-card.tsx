"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, Play, Star, Users } from "lucide-react";
import type { Game } from "@/lib/games";

type Props = {
  game: Game;
  onPlay: (game: Game) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  index?: number;
  priority?: boolean;
};

export default function GameCard({
  game,
  onPlay,
  isFavorite,
  onToggleFavorite,
  index = 0,
  priority = false,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 5) * 0.06 }}
      whileHover={{ y: -6 }}
      className="group"
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Jugar ${game.title}`}
        onClick={() => onPlay(game)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPlay(game);
          }
        }}
        style={{ ["--accent" as string]: game.accent }}
        className="relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 text-left outline-none transition-[border-color,box-shadow] duration-300 hover:border-white/25 hover:shadow-2xl hover:shadow-black focus-visible:ring-2 focus-visible:ring-amber-400/70"
      >
        <div className="relative aspect-[16/10] w-full">
          <Image
            src={game.cover}
            alt={`Portada de ${game.title}`}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          />
          {/* legibility gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/10" />

          {/* hover glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              boxShadow: `inset 0 0 0 1.5px ${game.accent}80, inset 0 -60px 60px -30px ${game.accent}33`,
            }}
          />

          {/* category badge */}
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-black shadow-lg"
            style={{ backgroundColor: game.accent }}
          >
            {game.categories[0]}
          </span>

          {/* favorite button */}
          <button
            type="button"
            aria-label={
              isFavorite
                ? `Quitar ${game.title} de favoritos`
                : `Añadir ${game.title} a favoritos`
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(game.id);
            }}
            className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white/80 backdrop-blur transition hover:scale-110 hover:bg-black/75 hover:text-amber-400 active:scale-90"
          >
            <Heart
              className="h-4 w-4"
              fill={isFavorite ? "#fbbf24" : "none"}
              color={isFavorite ? "#fbbf24" : "currentColor"}
            />
          </button>

          {/* play overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="flex h-14 w-14 scale-75 items-center justify-center rounded-full bg-white text-black shadow-2xl transition-transform duration-300 group-hover:scale-100">
              <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
            </span>
          </div>

          {/* bottom info */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
            <h3 className="font-display text-sm font-bold tracking-wider text-white sm:text-base">
              {game.title.toUpperCase()}
            </h3>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-white/60">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-400" fill="currentColor" />
                {game.rating.toFixed(1)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {game.players}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
