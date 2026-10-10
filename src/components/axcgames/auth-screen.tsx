"use client";

import { useState } from "react";
import Image from "next/image";
import { asset } from "@/lib/paths";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Loader2, LogIn, UserPlus } from "lucide-react";
import { useAxStore } from "@/lib/store";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, register, goHome } = useAxStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await login(username.trim(), password)
          : await register(username.trim(), password, displayName.trim());
      if (!res.ok) {
        setError(res.error ?? "Algo salió mal.");
      }
      // Si ok: el store cambia de vista automáticamente en el efecto del header
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/70 shadow-2xl shadow-black backdrop-blur-xl">
          {/* Cabecera */}
          <div className="relative border-b border-white/10 px-8 pb-6 pt-8 text-center">
            <span className="relative mx-auto mb-4 block h-16 w-16 overflow-hidden rounded-2xl border border-amber-400/30 shadow-xl shadow-amber-500/25">
              <Image
                src={asset("/logo-emblem.png")}
                alt="Logotipo de AXC GAMES"
                fill
                sizes="64px"
                className="object-cover"
                priority
              />
            </span>
            <h1 className="font-display text-2xl font-black tracking-wider text-white">
              <span>AXC</span>
              <span className="text-amber-400">GAMES</span>
            </h1>
            <p className="mt-1.5 text-sm text-white/50">
              {mode === "login"
                ? "Bienvenido de nuevo. Entra para chatear y jugar."
                : "Crea tu cuenta gratis. Sin email, sin complicaciones."}
            </p>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 border-b border-white/10 p-2" role="tablist">
            {(
              [
                { id: "login", label: "Entrar", icon: LogIn },
                { id: "register", label: "Crear cuenta", icon: UserPlus },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => {
                  setMode(id);
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  mode === id
                    ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Formulario */}
          <form onSubmit={submit} className="space-y-4 px-8 py-7">
            <div>
              <label htmlFor="axc-username" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/50">
                Usuario
              </label>
              <input
                id="axc-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej: shadowrider"
                autoComplete="username"
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-amber-400/25"
              />
            </div>

            {mode === "register" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
              >
                <label htmlFor="axc-displayname" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/50">
                  Nombre visible <span className="font-normal normal-case text-white/30">(opcional)</span>
                </label>
                <input
                  id="axc-displayname"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="¿Cómo te llaman?"
                  autoComplete="nickname"
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-amber-400/25"
                />
              </motion.div>
            )}

            <div>
              <label htmlFor="axc-password" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/50">
                Contraseña
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  id="axc-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-amber-400/25"
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"
                role="alert"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="axc-shine relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-amber-400 px-6 py-3.5 font-display text-sm font-bold tracking-widest text-black shadow-xl shadow-amber-400/25 transition hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>{mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}</>
              )}
              {mode === "login" ? "ENTRAR" : "CREAR CUENTA"}
            </button>

            <p className="text-center text-xs leading-relaxed text-white/40">
              Solo necesitas usuario y contraseña. Tus amigos te encontrarán por tu
              nombre de usuario.
            </p>
          </form>
        </div>

        <button
          type="button"
          onClick={goHome}
          className="mx-auto mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 transition hover:border-white/25 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Seguir jugando sin cuenta
        </button>
      </motion.div>
    </main>
  );
}
