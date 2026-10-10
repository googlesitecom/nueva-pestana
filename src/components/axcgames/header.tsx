"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { asset } from "@/lib/paths";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  BellOff,
  Heart,
  LogOut,
  MessageSquare,
  Search,
  User,
  X,
} from "lucide-react";
import { useAxStore } from "@/lib/store";
import {
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notify";
import { useToast } from "@/hooks/use-toast";
import Avatar from "./avatar";

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [permVersion, setPermVersion] = useState(0);
  const { me, view, openChat, openAuth, logout, conversations, socketConnected } =
    useAxStore();
  const { toast } = useToast();

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const inChat = view === "chat";

  const perm = (() => {
    void permVersion; // re-evaluar al cambiar el permiso
    return notificationPermission();
  })();

  const handleBell = async () => {
    const current = notificationPermission();
    if (current === "unsupported") {
      toast({ description: "Tu navegador no soporta notificaciones." });
      return;
    }
    if (current === "granted") {
      toast({ description: "Las notificaciones ya están activadas." });
      return;
    }
    const res = await requestNotificationPermission();
    setPermVersion((v) => v + 1);
    toast({
      description:
        res === "granted"
          ? "¡Notificaciones activadas! No te perderás ningún mensaje."
          : "Notificaciones desactivadas. Actívalas desde el candado del navegador.",
    });
  };

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
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          type="button"
          onClick={onGoHome}
          aria-label="Ir al inicio de axcgames"
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-amber-400/30 shadow-lg shadow-amber-500/20 transition-transform group-hover:scale-105">
            <Image
              src={asset("/logo-emblem.png")}
              alt="Logotipo de AXC GAMES"
              fill
              sizes="40px"
              className="object-cover"
              priority
            />
          </span>
          <span className="font-display text-lg font-extrabold tracking-wider">
            <span className="text-white">AXC</span>
            <span className="text-amber-400">GAMES</span>
          </span>
        </button>

        {/* Buscador escritorio */}
        <div className={`mx-2 hidden min-w-0 flex-1 md:block md:mx-6 ${inChat ? "opacity-40 pointer-events-none" : ""}`}>
          {searchInput("search-desktop")}
        </div>

        {/* Nav escritorio */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
          <button
            type="button"
            onClick={onGoHome}
            className={`rounded-full px-4 py-2 text-sm font-medium transition hover:bg-white/5 ${
              view === "home" ? "text-white" : "text-white/70 hover:text-white"
            }`}
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
              <span className="axc-badge-pop flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-black">
                {favoritesCount}
              </span>
            )}
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:ml-2">
          {/* Botón notificaciones (solo con sesión) */}
          {me && (
            <motion.button
              type="button"
              onClick={() => void handleBell()}
              whileTap={{ scale: 0.94 }}
              aria-label={
                perm === "granted"
                  ? "Notificaciones activadas"
                  : perm === "denied"
                    ? "Notificaciones bloqueadas"
                    : "Activar notificaciones"
              }
              title={
                perm === "granted"
                  ? "Notificaciones activadas"
                  : perm === "denied"
                    ? "Notificaciones bloqueadas en el navegador"
                    : "Activar notificaciones del chat"
              }
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition active:scale-95 ${
                perm === "granted"
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                  : perm === "denied"
                    ? "border-white/10 bg-white/5 text-white/40"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-amber-400/40 hover:text-amber-300"
              }`}
            >
              {perm === "denied" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {perm === "granted" && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#050505] bg-emerald-400" />
              )}
              {!inChat && totalUnread > 0 && perm !== "granted" && (
                <span className="axc-badge-pop absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-black shadow-lg">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </motion.button>
          )}

          {/* Botón chat */}
          <motion.button
            type="button"
            onClick={inChat ? onGoHome : openChat}
            whileTap={{ scale: 0.94 }}
            aria-label={inChat ? "Volver a los juegos" : "Abrir el chat"}
            className={`relative flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${
              inChat
                ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
                : "border-white/10 bg-white/5 text-white/75 hover:border-amber-400/40 hover:text-amber-300"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">{inChat ? "Juegos" : "Chat"}</span>
            {!inChat && totalUnread > 0 && (
              <span className="axc-badge-pop absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-black shadow-lg">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
            {inChat && (
              <span
                className={`hidden h-1.5 w-1.5 rounded-full sm:block ${
                  socketConnected ? "bg-emerald-400" : "bg-red-400"
                }`}
                title={socketConnected ? "Conectado" : "Reconectando…"}
              />
            )}
          </motion.button>
        </div>

        {/* Menú usuario */}
        {me ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label="Menú de usuario"
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 transition hover:border-amber-400/40"
            >
              <Avatar displayName={me.displayName} color={me.avatarColor} size={28} online={socketConnected} />
              <span className="hidden max-w-28 truncate text-sm font-semibold text-white/85 sm:block">
                {me.displayName}
              </span>
            </button>
            <AnimatePresence>
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black backdrop-blur-xl"
                  >
                    <div className="border-b border-white/10 px-4 py-3.5">
                      <p className="truncate text-sm font-bold text-white">{me.displayName}</p>
                      <p className="truncate text-xs text-white/40">@{me.username}</p>
                    </div>
                    <div className="p-1.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          openChat();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/5 hover:text-white"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Chat y amigos
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          void logout();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-300/90 transition hover:bg-red-500/10 hover:text-red-300"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openAuth();
            }}
            className="flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Entrar</span>
          </Link>
        )}

        {/* Buscador móvil */}
        <button
          type="button"
          onClick={() => setMobileSearchOpen((v) => !v)}
          aria-label={mobileSearchOpen ? "Cerrar búsqueda" : "Abrir búsqueda"}
          aria-expanded={mobileSearchOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95 md:hidden"
        >
          {mobileSearchOpen ? <X className="h-4.5 w-4.5" /> : <Search className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* Búsqueda móvil */}
      {mobileSearchOpen && (
        <div className="border-t border-white/10 px-4 py-3 md:hidden">
          {searchInput("search-mobile")}
        </div>
      )}
    </header>
  );
}
