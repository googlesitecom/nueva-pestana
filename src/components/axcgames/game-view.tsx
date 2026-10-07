"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  Gamepad2,
  Heart,
  Keyboard,
  Maximize2,
  Minimize,
  RotateCcw,
  Star,
  Users,
  Wrench,
} from "lucide-react";
import type { Game } from "@/lib/games";
import GameCard from "./game-card";

type Props = {
  game: Game;
  others: Game[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onPlay: (game: Game) => void;
};

function ControlButton({
  children,
  label,
  onClick,
  active = false,
  href,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  href?: string;
}) {
  const className = `flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-90 ${
    active
      ? "border-amber-400/60 bg-amber-400/15 text-amber-400"
      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
  }`;
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        aria-label={label}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={className}>
      {children}
    </button>
  );
}

export default function GameView({
  game,
  others,
  favorites,
  onToggleFavorite,
  onClose,
  onPlay,
}: Props) {
  const [iframeKey, setIframeKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const reloadGame = () => {
    setLoaded(false);
    setIframeKey((k) => k + 1);
  };

  const toggleFullscreen = () => {
    if (!frameRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void frameRef.current.requestFullscreen();
    }
  };

  const isFavorite = favorites.includes(game.id);

  return (
    <motion.main
      key="game-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="relative z-10 flex flex-1 flex-col"
    >
      {/* Game toolbar */}
      <div className="sticky top-16 z-40 border-b border-white/10 bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver</span>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold tracking-wide text-white sm:text-base">
              {game.title.toUpperCase()}
            </p>
            <p className="truncate text-xs text-white/45">{game.tagline}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <ControlButton
              label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
              onClick={() => onToggleFavorite(game.id)}
              active={isFavorite}
            >
              <Heart className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
            </ControlButton>
            <ControlButton label="Reiniciar juego" onClick={reloadGame}>
              <RotateCcw className="h-4 w-4" />
            </ControlButton>
            <ControlButton label="Abrir en una pestaña nueva" href={game.url}>
              <ExternalLink className="h-4 w-4" />
            </ControlButton>
            <ControlButton
              label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </ControlButton>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1440px] flex-1 px-3 py-4 sm:px-6">
        {/* Game frame: el juego se abre DENTRO de la página */}
        <div
          ref={frameRef}
          className="relative h-[calc(100dvh-215px)] min-h-[430px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black"
        >
          <iframe
            key={iframeKey}
            src={game.url}
            title={game.title}
            onLoad={() => setLoaded(true)}
            className="h-full w-full border-0"
            allow="fullscreen; autoplay; gamepad *; clipboard-write"
            allowFullScreen
          />

          {/* Loading overlay */}
          {!loaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 overflow-hidden bg-[#080808]">
              <Image
                src={game.cover}
                alt=""
                fill
                sizes="100vw"
                aria-hidden
                className="object-cover opacity-15 blur-md"
              />
              <div className="relative flex flex-col items-center gap-4">
                <span className="relative h-16 w-16 overflow-hidden rounded-2xl border border-amber-400/40 shadow-xl shadow-amber-500/25">
                  <Image
                    src="/logo-emblem.png"
                    alt="Logotipo de AXC GAMES"
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </span>
                <div className="h-1 w-44 overflow-hidden rounded-full bg-white/10">
                  <div className="axc-loading-bar h-full w-1/3 rounded-full bg-amber-400" />
                </div>
                <p className="text-sm text-white/60">
                  Cargando <b className="text-white">{game.title}</b>…
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Game info */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-display text-lg font-bold tracking-wide">
              ACERCA DE {game.title.toUpperCase()}
            </h2>
            <p className="mt-3 leading-relaxed text-white/70">{game.longDescription}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {game.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
              <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/80" />
              <p>
                Juega con teclado y ratón; en dispositivos táctiles, simplemente toca la
                pantalla. El juego se ejecuta dentro de axcgames: si ves la pantalla oscura un
                momento, es que todavía se está cargando.
              </p>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="font-display text-sm font-bold tracking-wide text-white/90">
                FICHA DEL JUEGO
              </h3>
              <ul className="mt-4 space-y-3.5 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-white/50">
                    <Star className="h-4 w-4 text-amber-400" fill="currentColor" />
                    Valoración
                  </span>
                  <b className="text-white">{game.rating} / 5</b>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-white/50">
                    <Users className="h-4 w-4" />
                    Jugadores
                  </span>
                  <b className="text-white">{game.players}</b>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-white/50">
                    <Wrench className="h-4 w-4" />
                    Dificultad
                  </span>
                  <b className="text-white">{game.difficulty}</b>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-white/50">
                    <Gamepad2 className="h-4 w-4" />
                    Géneros
                  </span>
                  <b className="text-right text-white">{game.categories.join(", ")}</b>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
              <h3 className="font-display text-sm font-bold tracking-wide text-amber-300">
                CONSEJO PRO
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-white/65">
                Usa el botón de pantalla completa para una experiencia totalmente inmersiva y
                el de reinicio si quieres empezar la partida de cero.
              </p>
            </div>
          </aside>
        </div>

        {/* Related games */}
        <section className="mt-10 pb-14" aria-labelledby="related-heading">
          <h2 id="related-heading" className="mb-4 font-display text-lg font-bold tracking-wide">
            SIGUE JUGANDO
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((g, i) => (
              <GameCard
                key={g.id}
                game={g}
                index={i}
                onPlay={onPlay}
                isFavorite={favorites.includes(g.id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      </div>
    </motion.main>
  );
}
