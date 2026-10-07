"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  Check,
  Clock,
  Info,
  MessageSquare,
  Phone,
  Search,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { useAxStore, type AxUser } from "@/lib/store";
import Avatar from "../avatar";
import { useToast } from "@/hooks/use-toast";

type Tab = "all" | "pending" | "add";

export default function FriendsPanel({
  onBack,
  onOpenDm,
}: {
  onBack: () => void;
  onOpenDm: (userId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const { friends, incoming, outgoing, onlineIds, loadFriends } = useAxStore();

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a los chats"
          className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-display text-base font-bold tracking-wide">AMIGOS</h2>
        {incoming.length > 0 && (
          <span className="axc-badge-pop flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-black">
            {incoming.length}
          </span>
        )}
        <div className="ml-auto" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 px-4 py-2.5">
        {(
          [
            { id: "all", label: `Todos (${friends.length})` },
            { id: "pending", label: `Pendientes (${incoming.length + outgoing.length})` },
            { id: "add", label: "Añadir amigo" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              tab === t.id
                ? "bg-white/10 text-white"
                : "text-white/45 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="axc-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "all" && <AllFriends onOpenDm={onOpenDm} />}
            {tab === "pending" && <PendingRequests />}
            {tab === "add" && <AddFriendForm onAdded={() => void loadFriends()} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function AllFriends({ onOpenDm }: { onOpenDm: (userId: string) => void }) {
  const { friends, onlineIds, removeFriend, startCall } = useAxStore();
  const [confirmRemove, setConfirmRemove] = useState<AxUser | null>(null);
  const { toast } = useToast();

  const openDm = (f: AxUser) => {
    // Buscar conversación DM existente o crearla, y cambiar de panel
    onOpenDm(f.id);
  };

  const callInDm = (f: AxUser, type: "audio" | "video") => {
    const conv = useAxStore
      .getState()
      .conversations.find(
        (c) => c.type === "dm" && c.members.some((m) => m.id === f.id)
      );
    if (conv) {
      startCall(conv.id, type);
    } else {
      toast({ description: "Abre el chat con tu amigo antes de llamarle." });
    }
  };

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
          <UserPlus className="h-8 w-8 text-white/30" />
        </span>
        <h3 className="font-display text-sm font-bold tracking-wide text-white/80">
          TODAVÍA NO TIENES AMIGOS
        </h3>
        <p className="mt-2 max-w-xs text-sm text-white/40">
          Añade amigos con su nombre de usuario en la pestaña «Añadir amigo» para chatear
          y llamar.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {friends.map((f) => {
        const online = onlineIds.has(f.id);
        return (
          <li
            key={f.id}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.04]"
          >
            <Avatar displayName={f.displayName} color={f.avatarColor} size={42} online={online} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{f.displayName}</p>
              <p className="truncate text-xs text-white/40">
                {online ? (
                  <span className="text-emerald-400/90">En línea</span>
                ) : (
                  "Desconectado"
                )}{" "}
                · @{f.username}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
              <IconBtn label={`Chat con ${f.displayName}`} onClick={() => openDm(f)}>
                <MessageSquare className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={`Llamar a ${f.displayName}`} onClick={() => callInDm(f, "audio")}>
                <Phone className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={`Videollamar a ${f.displayName}`} onClick={() => callInDm(f, "video")}>
                <Video className="h-4 w-4" />
              </IconBtn>
              <IconBtn
                label={`Eliminar a ${f.displayName}`}
                danger
                onClick={() => setConfirmRemove(f)}
              >
                <X className="h-4 w-4" />
              </IconBtn>
            </div>
          </li>
        );
      })}

      {confirmRemove && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setConfirmRemove(null)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-base font-bold tracking-wide">
              ELIMINAR AMIGO
            </h3>
            <p className="mt-2 text-sm text-white/55">
              ¿Seguro que quieres eliminar a <b className="text-white">{confirmRemove.displayName}</b>{" "}
              de tus amigos? Podréis volver a agregaos cuando queráis.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await removeFriend(confirmRemove.id);
                  setConfirmRemove(null);
                }}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-400"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </ul>
  );
}

function PendingRequests() {
  const { incoming, outgoing, respondFriendRequest, onlineIds } = useAxStore();

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-widest text-white/40">
          <Bell className="h-3.5 w-3.5" />
          Recibidas — {incoming.length}
        </h3>
        {incoming.length === 0 && (
          <p className="px-1 text-xs text-white/35">No tienes solicitudes pendientes.</p>
        )}
        <ul className="space-y-1">
          {incoming.map(({ friendshipId, user }) => (
            <li
              key={friendshipId}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.04]"
            >
              <Avatar
                displayName={user.displayName}
                color={user.avatarColor}
                size={40}
                online={onlineIds.has(user.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{user.displayName}</p>
                <p className="truncate text-xs text-white/40">
                  quiere ser tu amigo · @{user.username}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void respondFriendRequest(friendshipId, "accept")}
                  aria-label={`Aceptar a ${user.displayName}`}
                  className="rounded-full bg-emerald-500/90 p-2 text-white transition hover:bg-emerald-400 active:scale-90"
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </button>
                <button
                  type="button"
                  onClick={() => void respondFriendRequest(friendshipId, "decline")}
                  aria-label={`Rechazar a ${user.displayName}`}
                  className="rounded-full bg-red-500/90 p-2 text-white transition hover:bg-red-400 active:scale-90"
                >
                  <X className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-widest text-white/40">
          <Clock className="h-3.5 w-3.5" />
          Enviadas — {outgoing.length}
        </h3>
        {outgoing.length === 0 && (
          <p className="px-1 text-xs text-white/35">No has enviado solicitudes.</p>
        )}
        <ul className="space-y-1">
          {outgoing.map(({ friendshipId, user }) => (
            <li key={friendshipId} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <Avatar displayName={user.displayName} color={user.avatarColor} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white/85">{user.displayName}</p>
                <p className="truncate text-xs text-white/40">pendiente de respuesta</p>
              </div>
              <CancelRequestButton friendshipId={friendshipId} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CancelRequestButton({ friendshipId }: { friendshipId: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await useAxStore.getState().cancelFriendRequest(friendshipId);
        } finally {
          setLoading(false);
        }
      }}
      className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/50 transition hover:border-red-400/40 hover:text-red-300"
    >
      {loading ? "…" : "Cancelar"}
    </button>
  );
}

function AddFriendForm({ onAdded }: { onAdded: () => void }) {
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const { sendFriendRequest, onlineUsersList, friends, me, incoming, outgoing } = useAxStore();
  const { toast } = useToast();

  const busyIds = new Set([
    ...(me ? [me.id] : []),
    ...friends.map((f) => f.id),
    ...incoming.map((r) => r.user.id),
    ...outgoing.map((r) => r.user.id),
  ]);
  const suggestions = onlineUsersList.filter((u) => !busyIds.has(u.id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !username.trim()) return;
    setLoading(true);
    setMsg(null);
    const res = await sendFriendRequest(username.trim());
    setLoading(false);
    if (res.ok) {
      setMsg({ ok: true, text: `¡Solicitud enviada a «${username.trim()}»!` });
      toast({ description: `Solicitud enviada a @${username.trim()}` });
      setUsername("");
      onAdded();
    } else {
      setMsg({ ok: false, text: res.error ?? "Error" });
    }
  };

  const quickAdd = (user: AxUser) => {
    void sendFriendRequest(user.username).then((res) => {
      if (res.ok) {
        toast({ description: `Solicitud enviada a @${user.username}` });
        onAdded();
      } else {
        toast({ description: res.error ?? "Error" });
      }
    });
  };

  return (
    <div className="space-y-5 px-1">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="add-friend-input" className="mb-2 block text-sm text-white/60">
            Añade amigos con su <b className="text-amber-400">nombre de usuario</b>. ¡Ellos
            tendrán que aceptar tu solicitud!
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              id="add-friend-input"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="escribe un usuario…"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/25"
            />
          </div>
        </div>
        {msg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border px-4 py-2.5 text-sm ${
              msg.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
            role="status"
          >
            {msg.text}
          </motion.p>
        )}
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="axc-shine relative w-full overflow-hidden rounded-xl bg-amber-400 px-6 py-3 font-display text-sm font-bold tracking-widest text-black shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "ENVIANDO…" : "ENVIAR SOLICITUD"}
        </button>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-white/30">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          El chat funciona directamente entre navegadores (P2P): vuestros dos deben
          tener la web abierta para encontraros.
        </p>
      </form>

      {suggestions.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-widest text-white/40">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Conectados ahora — {suggestions.length}
          </h3>
          <ul className="space-y-1">
            {suggestions.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.04]"
              >
                <Avatar displayName={u.displayName} color={u.avatarColor} size={36} online />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{u.displayName}</p>
                  <p className="truncate text-xs text-white/40">@{u.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => quickAdd(u)}
                  className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-400 hover:text-black active:scale-95"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Añadir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-full p-2 transition active:scale-90 ${
        danger
          ? "text-white/40 hover:bg-red-500/15 hover:text-red-400"
          : "bg-white/5 text-white/70 hover:bg-amber-400 hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}
