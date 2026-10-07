"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Hash,
  Info,
  Phone,
  Send,
  Users,
  Video,
  PhoneCall,
} from "lucide-react";
import { useAxStore, type AxMessage } from "@/lib/store";
import Avatar from "../avatar";
import { convDisplayName, convDisplayColor } from "./sidebar";

function formatDay(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "HOY";
  if (sameDay(d, yesterday)) return "AYER";
  return d.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function formatCallContent(content: string): string {
  try {
    const data = JSON.parse(content) as { event: string; durationSec: number; kind: string };
    if (data.event === "ended") {
      const min = Math.floor(data.durationSec / 60);
      const sec = data.durationSec % 60;
      const dur = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
      return `${data.kind === "video" ? "Videollamada" : "Llamada"} finalizada · ${dur}`;
    }
  } catch {
    /* noop */
  }
  return "Llamada";
}

export default function ChatWindow({ onBack }: { onBack: () => void }) {
  const {
    me,
    conversations,
    activeConversationId,
    messagesByConv,
    typingByConv,
    onlineIds,
    sendMessage,
    setTyping,
    startCall,
  } = useAxStore();

  const conv = conversations.find((c) => c.id === activeConversationId);
  const messages = useMemo(
    () => (activeConversationId ? messagesByConv[activeConversationId] ?? [] : []),
    [messagesByConv, activeConversationId]
  );
  const typing = activeConversationId ? typingByConv[activeConversationId] ?? {} : {};
  const typingUsers = Object.values(typing).filter((t) => Date.now() - t.ts < 6000);

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);
  const typingActive = useRef(false);

  const meId = me?.id ?? "";
  const name = conv ? convDisplayName(conv, meId) : "";
  const color = conv ? convDisplayColor(conv, meId) : "#fbbf24";
  const isOnline =
    conv?.type === "dm" && conv.members.some((m) => m.id !== meId && onlineIds.has(m.id));

  // Auto-scroll al fondo cuando llegan mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typingUsers.length > 0]);

  const handleInputChange = (v: string) => {
    setInput(v);
    const now = Date.now();
    if (v && now - lastTypingSent.current > 1800 && !typingActive.current) {
      typingActive.current = true;
      lastTypingSent.current = now;
      setTyping(true);
    }
    if (!v && typingActive.current) {
      typingActive.current = false;
      setTyping(false);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    typingActive.current = false;
    setTyping(false);
    sendMessage(text);
  };

  // Limpiar typing al desmontar
  useEffect(() => {
    return () => {
      if (typingActive.current) setTyping(false);
    };
  }, [setTyping]);

  if (!conv) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {conv.type === "group" ? (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black"
            style={{ background: color }}
          >
            <Hash className="h-5 w-5" strokeWidth={2.6} />
          </span>
        ) : (
          <Avatar displayName={name} color={color} size={40} online={isOnline} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-bold tracking-wide text-white">
            {name.toUpperCase()}
          </h2>
          <p className="truncate text-xs text-white/40">
            {conv.type === "group"
              ? `${conv.members.length} miembros`
              : isOnline
                ? <span className="text-emerald-400/90">En línea</span>
                : "Desconectado"}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => startCall(conv.id, "audio")}
            title="Iniciar llamada de voz"
            aria-label="Iniciar llamada de voz"
            className="rounded-full p-2.5 text-white/60 transition hover:bg-amber-400 hover:text-black active:scale-90"
          >
            <Phone className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => startCall(conv.id, "video")}
            title="Iniciar videollamada"
            aria-label="Iniciar videollamada"
            className="rounded-full p-2.5 text-white/60 transition hover:bg-amber-400 hover:text-black active:scale-90"
          >
            <Video className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="axc-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: `${color}22`, color }}
            >
              {conv.type === "group" ? (
                <Users className="h-8 w-8" />
              ) : (
                <Hash className="h-8 w-8" />
              )}
            </span>
            <div>
              <p className="font-display text-sm font-bold tracking-wide text-white/85">
                {name.toUpperCase()}
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/40">
                Este es el principio de vuestra conversación. ¡Saluda con estilo! 👋
              </p>
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showDay =
            !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const isMine = m.senderId === meId;
          const grouped =
            prev &&
            prev.senderId === m.senderId &&
            prev.type === "text" &&
            new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000 &&
            !showDay;

          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/8" />
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {formatDay(new Date(m.createdAt))}
                  </span>
                  <span className="h-px flex-1 bg-white/8" />
                </div>
              )}

              {m.type === "call" ? (
                <div className="my-2 flex justify-center">
                  <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/50">
                    <PhoneCall className="h-3.5 w-3.5 text-amber-400/80" />
                    {formatCallContent(m.content)}
                  </span>
                </div>
              ) : (
                <div
                  className={`axc-msg-in flex gap-3 ${grouped ? "mt-0.5" : "mt-4"} ${
                    isMine ? "flex-row-reverse" : ""
                  }`}
                >
                  {grouped ? (
                    <span className="w-9 shrink-0" />
                  ) : (
                    <Avatar
                      displayName={m.sender.displayName}
                      color={m.sender.avatarColor}
                      size={36}
                    />
                  )}
                  <div className={`max-w-[75%] sm:max-w-[62%] ${isMine ? "items-end text-right" : ""}`}>
                    {!grouped && (
                      <p className="mb-1 flex items-center gap-2 text-[11px] leading-none">
                        <span
                          className="font-bold"
                          style={{ color: isMine ? "#fbbf24" : m.sender.avatarColor }}
                        >
                          {isMine ? "Tú" : m.sender.displayName}
                        </span>
                        <span className="text-white/30">{formatTime(m.createdAt)}</span>
                      </p>
                    )}
                    <div
                      className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        isMine
                          ? "bg-amber-400 text-black rounded-br-md"
                          : "bg-white/[0.07] text-white/90 rounded-bl-md"
                      } ${grouped ? (isMine ? "rounded-tr-md" : "rounded-tl-md") : ""}`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <div className="h-6 px-5">
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-1.5 text-xs text-white/50"
            >
              <span className="flex gap-1">
                <span className="axc-typing-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="axc-typing-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="axc-typing-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
              </span>
              {typingUsers.map((t) => t.displayName).join(", ")}{" "}
              {typingUsers.length === 1 ? "está" : "están"} escribiendo…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="px-3 pb-4 sm:px-5 sm:pb-5">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2 transition focus-within:border-amber-400/50 focus-within:ring-2 focus-within:ring-amber-400/20">
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder={`Escribe un mensaje en ${name}…`}
            aria-label="Escribe un mensaje"
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-white placeholder:text-white/30 outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            aria-label="Enviar mensaje"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-black transition hover:bg-amber-300 active:scale-90 disabled:opacity-40"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </div>
        <p className="mt-1.5 flex items-center gap-1 pl-1 text-[10px] text-white/25">
          <Info className="h-3 w-3" />
          Enter para enviar · Mayús+Enter para salto de línea
        </p>
      </div>
    </div>
  );
}

export type { AxMessage };
