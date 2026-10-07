"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gamepad2, SearchX, ShieldCheck, Trophy, Zap } from "lucide-react";
import { allCategories, featuredGame, games, type Game } from "@/lib/games";
import Header from "@/components/axcgames/header";
import Hero from "@/components/axcgames/hero";
import GameCard from "@/components/axcgames/game-card";
import GameView from "@/components/axcgames/game-view";
import Footer from "@/components/axcgames/footer";
import { useToast } from "@/hooks/use-toast";

const FAV_KEY = "axcgames:favorites";
const RECENT_KEY = "axcgames:recent";

const FEATURE_STRIP = [
  {
    icon: Zap,
    title: "Al instante",
    sub: "Sin descargas ni instalaciones",
  },
  {
    icon: ShieldCheck,
    title: "100% gratis",
    sub: "Sin registros ni pagos",
  },
  {
    icon: Gamepad2,
    title: "Catálogo curado",
    sub: "Lo mejor de cada género",
  },
  {
    icon: Trophy,
    title: "Supera tu récord",
    sub: "Compite contra ti mismo",
  },
];

export default function Home() {
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const { toast } = useToast();

  // Cargar favoritos y recientes desde localStorage (tras el montaje, para evitar mismatch de hidratación)
  useEffect(() => {
    try {
      const f = JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar preferencias persistidas al montar
      if (Array.isArray(f)) setFavorites(f);
      if (Array.isArray(r)) setRecent(r);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const isFav = prev.includes(id);
        const next = isFav ? prev.filter((x) => x !== id) : [...prev, id];
        try {
          localStorage.setItem(FAV_KEY, JSON.stringify(next));
        } catch {
          /* ignorar */
        }
        const g = games.find((x) => x.id === id);
        toast({
          description: isFav
            ? `${g?.title ?? "Juego"} eliminado de favoritos`
            : `${g?.title ?? "Juego"} añadido a favoritos`,
        });
        return next;
      });
    },
    [toast]
  );

  const openGame = useCallback((game: Game) => {
    setActiveGame(game);
    window.scrollTo({ top: 0, behavior: "auto" });
    setRecent((prev) => {
      const next = [game.id, ...prev.filter((r) => r !== game.id)].slice(0, 4);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignorar */
      }
      return next;
    });
  }, []);

  const goHome = useCallback(() => {
    setActiveGame(null);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // ESC cierra el juego (cuando no está en pantalla completa)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeGame && !document.fullscreenElement) goHome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeGame, goHome]);

  // Buscar mientras juegas te devuelve al catálogo
  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q);
      if (activeGame) {
        setActiveGame(null);
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    },
    [activeGame]
  );

  const navigate = useCallback((sectionId: string) => {
    setActiveGame(null);
    window.scrollTo({ top: 0, behavior: "auto" });
    window.setTimeout(() => {
      const el =
        document.getElementById(sectionId) ?? document.getElementById("juegos");
      el?.scrollIntoView({ behavior: "smooth" });
    }, 240);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      const inCategory = category === "Todos" || g.categories.includes(category);
      const inQuery =
        !q ||
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.categories.some((c) => c.toLowerCase().includes(q)) ||
        g.tags.some((t) => t.toLowerCase().includes(q));
      return inCategory && inQuery;
    });
  }, [category, query]);

  const recentGames = useMemo(
    () =>
      recent
        .map((id) => games.find((g) => g.id === id))
        .filter((g): g is Game => Boolean(g)),
    [recent]
  );

  const favoriteGames = useMemo(
    () =>
      favorites
        .map((id) => games.find((g) => g.id === id))
        .filter((g): g is Game => Boolean(g)),
    [favorites]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-[#050505] text-white">
      {/* Resplandor ambiental superior */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[480px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(251,191,36,0.09),transparent_70%)]"
      />

      <Header
        query={query}
        onQueryChange={handleQueryChange}
        onGoHome={goHome}
        onNavigate={navigate}
        favoritesCount={favorites.length}
      />

      <AnimatePresence mode="wait">
        {activeGame ? (
          <GameView
            key={activeGame.id}
            game={activeGame}
            others={games.filter((g) => g.id !== activeGame.id)}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onClose={goHome}
            onPlay={openGame}
          />
        ) : (
          <motion.main
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 flex flex-1 flex-col"
          >
            {/* Juego destacado */}
            <Hero
              game={featuredGame}
              onPlay={openGame}
              isFavorite={favorites.includes(featuredGame.id)}
              onToggleFavorite={toggleFavorite}
              onExplore={() =>
                document.getElementById("juegos")?.scrollIntoView({ behavior: "smooth" })
              }
            />

            {/* Ventajas */}
            <section
              aria-label="Ventajas de axcgames"
              className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8"
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {FEATURE_STRIP.map(({ icon: Icon, title, sub }) => (
                  <div
                    key={title}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{title}</p>
                      <p className="truncate text-xs text-white/45">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Continúa jugando */}
            {recentGames.length > 0 && (
              <section
                aria-labelledby="recent-heading"
                className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8"
              >
                <h2
                  id="recent-heading"
                  className="font-display text-lg font-bold tracking-wide"
                >
                  CONTINÚA JUGANDO
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {recentGames.map((g, i) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      index={i}
                      onPlay={openGame}
                      isFavorite={favorites.includes(g.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Favoritos */}
            {favoriteGames.length > 0 && (
              <section
                id="favoritos"
                aria-labelledby="favorites-heading"
                className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 pt-10 sm:px-6 lg:px-8"
              >
                <h2
                  id="favorites-heading"
                  className="font-display text-lg font-bold tracking-wide"
                >
                  TUS FAVORITOS
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {favoriteGames.map((g, i) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      index={i}
                      onPlay={openGame}
                      isFavorite={favorites.includes(g.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Catálogo */}
            <section
              id="juegos"
              aria-labelledby="games-heading"
              className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 pb-16 pt-12 sm:px-6 lg:px-8"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="games-heading"
                    className="font-display text-xl font-bold tracking-wide sm:text-2xl"
                  >
                    TODOS LOS JUEGOS
                  </h2>
                  <p className="mt-1 text-sm text-white/45">
                    {filtered.length} {filtered.length === 1 ? "juego" : "juegos"}
                    {category !== "Todos" ? ` en ${category.toLowerCase()}` : ""}
                    {query.trim() ? ` para «${query.trim()}»` : ""}
                  </p>
                </div>
              </div>

              {/* Categorías */}
              <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    aria-pressed={category === cat}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                      category === cat
                        ? "border-amber-400 bg-amber-400 text-black shadow-lg shadow-amber-400/25"
                        : "border-white/10 bg-white/5 text-white/65 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Grid de juegos */}
              {filtered.length > 0 ? (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {filtered.map((g, i) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      index={i}
                      onPlay={openGame}
                      isFavorite={favorites.includes(g.id)}
                      onToggleFavorite={toggleFavorite}
                      priority={i < 2}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                    <SearchX className="h-8 w-8 text-white/40" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-wide">
                    SIN RESULTADOS
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-white/50">
                    No encontramos juegos para «{query.trim()}». Prueba con otro término o
                    explora todas las categorías.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setCategory("Todos");
                    }}
                    className="mt-5 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-amber-300 active:scale-95"
                  >
                    Ver todos los juegos
                  </button>
                </div>
              )}
            </section>

            <Footer onNavigate={navigate} />
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
