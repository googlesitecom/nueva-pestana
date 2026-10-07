"use client";

/**
 * NotificationWatcher — notificaciones reales del chat EN TODO MOMENTO.
 *
 * Se monta en la raíz de la página (fuera de AnimatePresence) para que siga
 * activo en todas las vistas: home, juego en pantalla completa (iframe),
 * chat y auth. Cubre:
 *  - Mensajes nuevos: toast + sonido + notificación de escritorio (si el
 *    documento no tiene el foco, p. ej. jugando en el iframe o pestaña en
 *    segundo plano).
 *  - Solicitudes de amistad, amigos nuevos e invitaciones a grupos.
 *  - Llamadas entrantes con la pestaña en segundo plano.
 *  - Contador de no leídos en el título de la pestaña: "(3) nueva-pestaña".
 */

import { useEffect, useRef } from "react";
import { subscribeP2P, type P2pEvent } from "@/lib/p2p";
import { useAxStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  notifyDesktop,
  notificationPermission,
  playFriendChime,
  playMessageChime,
  requestNotificationPermission,
  unlockAudio,
} from "@/lib/notify";

export const APP_TITLE = "nueva-pestaña";

export default function NotificationWatcher() {
  const { toast } = useToast();
  const me = useAxStore((s) => s.me);
  const conversations = useAxStore((s) => s.conversations);
  const incoming = useAxStore((s) => s.incoming);
  const friends = useAxStore((s) => s.friends);

  const loginAtRef = useRef(0);
  const incomingCountRef = useRef(0);
  const friendsCountRef = useRef(0);
  const meRef = useRef<string | null>(null);

  const withinLoginGrace = () => Date.now() - loginAtRef.current < 5000;

  // 1) Desbloquear audio con el primer gesto del usuario
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // 2) Al iniciar sesión: registrar momento, resetear contadores y pedir permiso
  useEffect(() => {
    if (!me) {
      meRef.current = null;
      return;
    }
    if (meRef.current === me.id) return;
    meRef.current = me.id;
    // Periodo de gracia: la carga inicial de amigos no dispara notificaciones
    loginAtRef.current = Date.now();
    incomingCountRef.current = 0;
    friendsCountRef.current = 0;
    if (notificationPermission() === "default") {
      void requestNotificationPermission();
    }
  }, [me]);

  // 3) Escucha global de eventos P2P (activa en todas las vistas)
  useEffect(() => {
    if (!me) return;

    const onP2pEvent = (e: P2pEvent) => {
      if (e.type === "message") {
        const state = useAxStore.getState();
        if (e.message.senderId === state.me?.id) return;
        const isViewing =
          state.view === "chat" && state.activeConversationId === e.message.conversationId;
        if (isViewing) return; // ya lo está leyendo en el chat

        const content = e.message.content;
        const preview = content.length > 90 ? `${content.slice(0, 90)}…` : content;
        playMessageChime();
        toast({
          title: e.message.sender.displayName,
          description: preview,
        });
        if (!document.hasFocus()) {
          // Jugando en el iframe, en otra ventana o con la pestaña en segundo plano
          notifyDesktop(
            `${e.message.sender.displayName} · axcgames`,
            preview,
            `conv:${e.message.conversationId}`,
          );
        }
        return;
      }

      if (e.type === "call-incoming") {
        if (!document.hasFocus()) {
          notifyDesktop(
            `${e.from.displayName} te llama`,
            e.callType === "video" ? "Videollamada entrante" : "Llamada entrante",
            `call:${e.conversationId}`,
          );
        }
        return;
      }

      if (e.type === "group-invite") {
        playFriendChime();
        toast({
          title: "Te añadieron a un grupo",
          description: `${e.fromName} te invitó a «${e.group.name ?? "Grupo"}»`,
        });
        if (!document.hasFocus()) {
          notifyDesktop(
            "axcgames",
            `${e.fromName} te invitó al grupo ${e.group.name ?? ""}`,
            "friends",
          );
        }
      }
    };

    return subscribeP2P(onP2pEvent);
  }, [me, toast]);

  // 4) Solicitudes de amistad nuevas → toast + sonido + escritorio
  useEffect(() => {
    if (!me) return;
    const count = incoming.length;
    if (count > incomingCountRef.current && !withinLoginGrace()) {
      playFriendChime();
      toast({
        title: "Nueva solicitud de amistad",
        description: "Alguien quiere ser tu amigo",
      });
      if (!document.hasFocus()) {
        notifyDesktop("axcgames", "Tienes una nueva solicitud de amistad", "friends");
      }
    }
    incomingCountRef.current = count;
  }, [incoming, me, toast]);

  // 5) Amigos nuevos (aceptaron mi solicitud) → toast + sonido
  useEffect(() => {
    if (!me) return;
    const count = friends.length;
    if (count > friendsCountRef.current && !withinLoginGrace()) {
      playFriendChime();
      toast({ title: "¡Nuevo amigo!", description: "Ya puedes chatear con él" });
      if (!document.hasFocus()) {
        notifyDesktop("axcgames", "¡Tenéis un nuevo amigo!", "friends");
      }
    }
    friendsCountRef.current = count;
  }, [friends, me, toast]);

  // 6) Contador de no leídos en el título de la pestaña
  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) ${APP_TITLE}` : APP_TITLE;
  }, [totalUnread]);

  return null;
}
