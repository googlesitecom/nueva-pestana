"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gamepad2, MessageSquare, Sparkles, Users } from "lucide-react";
import { useAxStore } from "@/lib/store";
import Sidebar from "./sidebar";
import FriendsPanel from "./friends-panel";
import ChatWindow from "./chat-window";
import Avatar from "../avatar";
import { convDisplayName } from "./sidebar";

export default function ChatApp() {
  const { activeConversationId, conversations, onlineIds, goHome, me } = useAxStore();
  const [panel, setPanel] = useState<"friends" | "conversations">("conversations");

  const conv = conversations.find((c) => c.id === activeConversationId);
  const meId = me?.id ?? "";

  // En móvil: si hay conversación activa se muestra la ventana; si no, el sidebar
  const showWindow = panel === "conversations" && Boolean(conv);
  const showFriends = panel === "friends";

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-0 py-0 sm:px-4 sm:py-5 lg:px-6">
      <div className="relative flex min-h-0 flex-1 overflow-hidden border-white/10 bg-zinc-950/55 shadow-2xl shadow-black/60 backdrop-blur-xl sm:rounded-3xl sm:border">
        {/* Sidebar (escritorio siempre visible; móvil solo si no hay chat activo) */}
        <aside
          className={`w-full shrink-0 border-white/10 md:block md:w-[290px] md:border-r ${
            showWindow || showFriends ? "hidden" : "flex"
          }`}
        >
          <Sidebar onNavigate={setPanel} />
        </aside>

        {/* Panel principal */}
        <section
          className={`min-w-0 flex-1 ${showWindow || showFriends ? "flex" : "hidden md:flex"}`}
        >
          {showFriends ? (
            <div className="w-full">
              <FriendsPanel
                onBack={() => setPanel("conversations")}
                onOpenDm={(userId) => {
                  setPanel("conversations");
                  void useAxStore.getState().createDm(userId);
                }}
              />
            </div>
          ) : showWindow && conv ? (
            <div className="flex w-full">
              <div className="flex min-w-0 flex-1 flex-col">
                <ChatWindow onBack={() => setPanel("conversations")} />
              </div>
              {/* Lista de miembros (grupos, escritorio) */}
              {conv.type === "group" && (
                <aside className="hidden w-56 shrink-0 border-l border-white/10 lg:block">
                  <div className="p-4">
                    <h3 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-widest text-white/40">
                      Miembros — {conv.members.length}
                    </h3>
                    <ul className="axc-scroll max-h-[calc(100%-2.5rem)] space-y-0.5 overflow-y-auto">
                      {conv.members.map((m) => {
                        const online = onlineIds.has(m.id);
                        return (
                          <li
                            key={m.id}
                            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                          >
                            <Avatar
                              displayName={m.displayName}
                              color={m.avatarColor}
                              size={30}
                              online={online}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-white/80">
                                {m.displayName}
                                {m.id === meId && " (tú)"}
                              </span>
                              <span
                                className={`block truncate text-[10px] ${
                                  online ? "text-emerald-400/80" : "text-white/30"
                                }`}
                              >
                                {online ? "En línea" : "Desconectado"}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </aside>
              )}
            </div>
          ) : (
            <EmptyState onGoHome={goHome} />
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-8 text-center">
      <motion.span
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/25"
      >
        <MessageSquare className="h-9 w-9" />
      </motion.span>
      <div className="max-w-sm">
        <h3 className="font-display text-lg font-bold tracking-wide text-white">
          TU CENTRO DE MANDO
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/45">
          Selecciona un chat de la izquierda, habla con tus amigos o crea un grupo.
          Todo en tiempo real, con llamadas y videollamadas incluidas.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/55">
          <Users className="h-3.5 w-3.5 text-amber-400/80" /> Amigos
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/55">
          <Sparkles className="h-3.5 w-3.5 text-amber-400/80" /> Grupos
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/55">
          📞 Llamadas
        </span>
      </div>
      <button
        type="button"
        onClick={onGoHome}
        className="mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:border-amber-400/40 hover:text-amber-300"
      >
        <Gamepad2 className="h-4 w-4" />
        Volver a los juegos
      </button>
    </div>
  );
}

export { convDisplayName };
