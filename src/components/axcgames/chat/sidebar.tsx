"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Hash,
  LogOut,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useAxStore, type AxConversation, type AxUser } from "@/lib/store";
import Avatar from "../avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function convDisplayName(conv: AxConversation, meId: string): string {
  if (conv.type === "group") return conv.name ?? "Grupo";
  const other = conv.members.find((m) => m.id !== meId);
  return other?.displayName ?? other?.username ?? "Directo";
}

export function convDisplayColor(conv: AxConversation, meId: string): string {
  if (conv.type === "group") return conv.avatarColor;
  const other = conv.members.find((m) => m.id !== meId);
  return other?.avatarColor ?? "#fbbf24";
}

export default function Sidebar({
  onNavigate,
}: {
  onNavigate?: (panel: "friends" | "conversations") => void;
}) {
  const {
    me,
    conversations,
    friends,
    incoming,
    activeConversationId,
    onlineIds,
    openConversation,
    logout,
    socketConnected,
    createGroup,
  } = useAxStore();
  const [search, setSearch] = useState("");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  const meId = me?.id ?? "";
  const filtered = search.trim()
    ? conversations.filter((c) =>
        convDisplayName(c, meId).toLowerCase().includes(search.trim().toLowerCase())
      )
    : conversations;

  const handleOpenConv = (id: string) => {
    void openConversation(id);
    onNavigate?.("conversations");
  };

  return (
    <div className="flex h-full w-full flex-col bg-black/40">
      {/* Panel de usuario */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          {me && <Avatar displayName={me.displayName} color={me.avatarColor} size={40} online />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{me?.displayName}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-white/40">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  socketConnected ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              @{me?.username}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="rounded-full p-2 text-white/40 transition hover:bg-red-500/15 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Botón amigos */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => onNavigate?.("friends")}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <Users className="h-4.5 w-4.5 text-amber-400/80" />
          Amigos
          {incoming.length > 0 && (
            <span className="axc-badge-pop ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-black">
              {incoming.length}
            </span>
          )}
        </button>
      </div>

      {/* Lista de conversaciones */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col px-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/40">
            Mensajes directos
          </h3>
          <button
            type="button"
            onClick={() => setGroupDialogOpen(true)}
            title="Crear grupo"
            aria-label="Crear grupo"
            className="rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-amber-400"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar chat…"
            aria-label="Buscar conversación"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/25"
          />
        </div>

        <div className="axc-scroll -mr-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs leading-relaxed text-white/35">
              Aún no tienes chats. Ve a <b className="text-white/60">Amigos</b> para
              empezar a hablar.
            </p>
          )}
          {filtered.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const name = convDisplayName(conv, meId);
            const color = convDisplayColor(conv, meId);
            const isOnline =
              conv.type === "dm" &&
              conv.members.some((m) => m.id !== meId && onlineIds.has(m.id));
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => handleOpenConv(conv.id)}
                className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                  isActive
                    ? "bg-amber-400/15 ring-1 ring-amber-400/40"
                    : "hover:bg-white/5"
                }`}
              >
                {conv.type === "group" ? (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black"
                    style={{ background: color }}
                  >
                    <Hash className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                ) : (
                  <Avatar
                    displayName={name}
                    color={color}
                    size={36}
                    online={isOnline}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-semibold ${
                      isActive ? "text-white" : "text-white/80"
                    }`}
                  >
                    {name}
                  </span>
                  <span className="block truncate text-[11px] text-white/35">
                    {conv.lastMessage
                      ? conv.lastMessage.type === "call"
                        ? "📞 Llamada"
                        : `${conv.lastMessage.senderId === meId ? "Tú: " : ""}${conv.lastMessage.content}`
                      : conv.type === "group"
                        ? `${conv.members.length} miembros`
                        : "Empieza la conversación"}
                  </span>
                </span>
                {conv.unreadCount > 0 && (
                  <span className="axc-badge-pop flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-black">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <CreateGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        friends={friends}
        onCreate={async (name, memberIds) => {
          const id = await createGroup(name, memberIds);
          if (id) {
            setGroupDialogOpen(false);
            onNavigate?.("conversations");
          }
        }}
      />
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  friends,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  friends: AxUser[];
  onCreate: (name: string, memberIds: string[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-950/95 backdrop-blur-xl sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide text-white">
            CREAR GRUPO
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Reúne a tus amigos en un chat de grupo con llamadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label htmlFor="group-name" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/50">
              Nombre del grupo
            </label>
            <input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Squad de carreras"
              maxLength={40}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/25"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">
              Miembros ({selected.length})
            </p>
            <div className="axc-scroll max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-1.5">
              {friends.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-white/40">
                  Añade amigos primero para crear grupos.
                </p>
              )}
              {friends.map((f) => {
                const isSel = selected.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggle(f.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      isSel ? "bg-amber-400/15" : "hover:bg-white/5"
                    }`}
                  >
                    <Avatar displayName={f.displayName} color={f.avatarColor} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white/90">
                        {f.displayName}
                      </span>
                      <span className="block truncate text-[11px] text-white/35">@{f.username}</span>
                    </span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                        isSel
                          ? "border-amber-400 bg-amber-400 text-black"
                          : "border-white/20 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/60 hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={loading || !name.trim() || selected.length === 0}
            onClick={async () => {
              setLoading(true);
              try {
                await onCreate(name.trim(), selected);
                setName("");
                setSelected([]);
              } finally {
                setLoading(false);
              }
            }}
            className="bg-amber-400 font-bold text-black hover:bg-amber-300"
          >
            {loading ? "Creando…" : "Crear grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
