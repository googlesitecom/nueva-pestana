"use client";

import { useState } from "react";
import { Gamepad2, Heart, Search, X } from "lucide-react";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onGoHome: () => void;
  onNavigate: (sectionId: string) => void;
  favoritesCount: number;
};

export default function Header({
  query,
  onQueryChange,
  onGoHome,
  onNavigate,
  favoritesCount,
}: Props) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const searchInput = (id: string) => (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar juegos..."
        aria-label="Buscar juegos"
        autoComplete="off"
        className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-10 pr-10 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-amber-400/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-amber-400/25"
      />
      {query && (
        <button
          type="button"
          onClick={() => onQueryChange("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050505]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          type="button"
          onClick={onGoHome}
          aria-label="Ir al inicio de axcgames"
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-lg shadow-amber-500/20 transition-transform group-hover:scale-105">
            <Gamepad2 className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="font-display text-lg font-extrabold tracking-wider">
            <span className="text-white">AXC</span>
            <span className="text-amber-400">GAMES</span>
          </span>
        </button>

        {/* Desktop search */}
        <div className="mx-2 hidden min-w-0 flex-1 md:block md:mx-6">
          {searchInput("search-desktop")}
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
          <button
            type="button"
            onClick={() => onNavigate("inicio")}
            className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Inicio
          </button>
          <button
            type="button"
            onClick={() => onNavigate("juegos")}
            className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Juegos
          </button>
          <button
            type="button"
            onClick={() => onNavigate("favoritos")}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            <Heart className="h-4 w-4" />
            Favoritos
            {favoritesCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-black">
                {favoritesCount}
              </span>
            )}
          </button>
        </nav>

        {/* Mobile search toggle */}
        <button
          type="button"
          onClick={() => setMobileSearchOpen((v) => !v)}
          aria-label={mobileSearchOpen ? "Cerrar búsqueda" : "Abrir búsqueda"}
          aria-expanded={mobileSearchOpen}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95 md:hidden"
        >
          {mobileSearchOpen ? <X className="h-4.5 w-4.5" /> : <Search className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* Mobile search row */}
      {mobileSearchOpen && (
        <div className="border-t border-white/10 px-4 py-3 md:hidden">
          {searchInput("search-mobile")}
        </div>
      )}
    </header>
  );
}
