"use client";

/**
 * Motor de chat P2P basado en Trystero (WebRTC + relés públicos Nostr).
 *
 * No requiere servidor propio: funciona en hosting estático como GitHub
 * Pages. La señalización WebRTC (mensajes y llamadas de voz/vídeo) viaja
 * por relés Nostr públicos y los datos fluyen directamente entre
 * navegadores (peer to peer).
 *
 * Modelo de salas:
 *  - "lobby": todos los usuarios conectados (presencia global + solicitudes
 *    de amistad + invitaciones a grupos).
 *  - Una sala por conversación: el roomId ES el id de la conversación
 *    (determinista para DMs, uuid para grupos).
 */

import type { Room } from "trystero/nostr";
import type { AxConversation, AxMessage, AxUser } from "./store";

const APP_ID = "axcgames-nueva-pestana-v1";
export const LOBBY_ROOM = "lobby";

/** Intervalo de reanuncio de identidad en el lobby (robustez de presencia). */
const PRESENCE_HEARTBEAT_MS = 20_000;
/** Tiempo máximo que sendFriendRequest espera a que aparezca el par. */
export const PEER_DISCOVERY_TIMEOUT_MS = 12_000;

export type P2pEvent =
  | { type: "peer-online"; user: AxUser }
  | { type: "peer-offline"; user: AxUser }
  | { type: "message"; message: AxMessage }
  | {
      type: "typing";
      conversationId: string;
      userId: string;
      displayName: string;
      typing: boolean;
    }
  | { type: "friend-request"; user: AxUser }
  | { type: "friend-accepted"; user: AxUser }
  | { type: "friend-removed"; userId: string }
  | { type: "group-invite"; group: AxConversation; fromName: string }
  | { type: "group-update"; group: AxConversation }
  | { type: "group-leave"; conversationId: string; user: AxUser }
  | { type: "group-delete"; conversationId: string }
  | {
      type: "call-incoming";
      conversationId: string;
      callType: "audio" | "video";
      from: AxUser;
    }
  | { type: "call-accepted"; conversationId: string; user: AxUser }
  | { type: "call-declined"; conversationId: string; user: AxUser }
  | { type: "call-ended"; conversationId: string; user: AxUser }
  | {
      type: "call-toggle";
      conversationId: string;
      user: AxUser;
      audio: boolean;
      video: boolean;
    }
  | { type: "stream"; conversationId: string; stream: MediaStream; user: AxUser };

type TrysteroModule = typeof import("trystero/nostr");

let trystero: TrysteroModule | null = null;
let me: AxUser | null = null;
let startPromise: Promise<void> | null = null;

const rooms = new Map<string, Room>();
const actionsByRoom = new Map<string, Record<string, { send: (data: unknown, options?: { target?: string | string[] | null }) => Promise<void> }>>();
const peerUsers = new Map<string, string>(); // peerId -> userId
const peersByUser = new Map<string, Set<string>>(); // userId -> peerIds
const onlineUsers = new Map<string, AxUser>(); // userId -> user (visto en el lobby)

/** Salas pedidas antes de que Trystero termine de cargar. */
const pendingRooms = new Set<string>();

/** Temporizador del heartbeat de presencia del lobby. */
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const listeners = new Set<(e: P2pEvent) => void>();

export function subscribeP2P(fn: (e: P2pEvent) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(event: P2pEvent): void {
  for (const fn of listeners) {
    try {
      fn(event);
    } catch (err) {
      console.error("[p2p] listener error", err);
    }
  }
}

export async function startP2P(user: AxUser): Promise<void> {
  if (typeof window === "undefined") return;
  if (trystero && me?.id === user.id && rooms.has(LOBBY_ROOM)) return;
  // Si ya hay un arranque en curso, esperar a que termine y reintentar
  // (evita perder salas en inicios de sesión consecutivos).
  if (startPromise) {
    await startPromise;
    if (trystero && me?.id === user.id && rooms.has(LOBBY_ROOM)) return;
  }
  // Cambio de usuario sin desconectar: reiniciar limpio
  if (trystero && me && me.id !== user.id) stopP2P();

  const run = async () => {
    try {
      if (!trystero) trystero = await import("trystero/nostr");
      me = user;
      ensureRoom(LOBBY_ROOM);
      // Salas pedidas mientras cargaba el módulo (DMs/grupos del usuario):
      // sin esta cola se perdían silenciosamente y los mensajes no llegaban.
      for (const roomId of pendingRooms) {
        if (roomId !== LOBBY_ROOM) ensureRoom(roomId);
      }
      pendingRooms.clear();
      // Heartbeat: reanuncia la identidad periódicamente para que ningún par
      // se quede sin saber quiénes somos (repara mensajes de identidad perdidos
      // y acelera el descubrimiento en presencia mutua).
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        const lobby = rooms.get(LOBBY_ROOM);
        if (!lobby || !me) return;
        void send(LOBBY_ROOM, "id", me);
      }, PRESENCE_HEARTBEAT_MS);
      // Exponer estado para diagnóstico (solo desarrollo)
      if (typeof window !== "undefined") {
        (window as unknown as { __axcP2P?: unknown }).__axcP2P = {
          rooms,
          onlineUsers,
          peerUsers,
          started: () => p2pStarted(),
        };
      }
    } catch (err) {
      console.error("[p2p] fallo al iniciar", err);
    }
  };

  startPromise = run();
  try {
    await startPromise;
  } finally {
    startPromise = null;
  }
}

export function stopP2P(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  pendingRooms.clear();
  for (const room of rooms.values()) {
    try {
      void room.leave();
    } catch {
      /* ignorar */
    }
  }
  rooms.clear();
  actionsByRoom.clear();
  peerUsers.clear();
  peersByUser.clear();
  onlineUsers.clear();
  me = null;
}

export function joinRoom(roomId: string): void {
  if (!trystero || !me) {
    // Trystero aún no cargó (arranque en curso): encolar la sala para
    // unirse en cuanto esté disponible.
    pendingRooms.add(roomId);
    return;
  }
  ensureRoom(roomId);
}

export function leaveRoom(roomId: string): void {
  pendingRooms.delete(roomId);
  const room = rooms.get(roomId);
  if (room) {
    try {
      void room.leave();
    } catch {
      /* ignorar */
    }
    rooms.delete(roomId);
    actionsByRoom.delete(roomId);
  }
}

export function p2pStarted(): boolean {
  return rooms.has(LOBBY_ROOM);
}

// ---------------------------------------------------------------------------
// Utilidades de presencia
// ---------------------------------------------------------------------------

export function getOnlineUsers(): AxUser[] {
  return Array.from(onlineUsers.values());
}

export function getOnlineUserIds(): Set<string> {
  return new Set(onlineUsers.keys());
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

function peerIdsOf(userId: string): string[] {
  return Array.from(peersByUser.get(userId) ?? []);
}

/** Envía una acción a un usuario concreto (por sus peerIds conocidos). */
async function sendToUser(roomId: string, name: string, data: unknown, userId: string): Promise<void> {
  const targets = peerIdsOf(userId);
  await send(roomId, name, data, targets.length > 0 ? targets : null);
}

async function send(
  roomId: string,
  name: string,
  data: unknown,
  target?: string | string[] | null,
): Promise<void> {
  const act = actionsByRoom.get(roomId)?.[name];
  if (!act) return;
  try {
    await act.send(data, target !== undefined ? { target } : undefined);
  } catch (err) {
    console.warn("[p2p] error enviando", name, err);
  }
}

// ---------------------------------------------------------------------------
// Gestión de salas y registro de identidad
// ---------------------------------------------------------------------------

function ensureRoom(roomId: string): Room | null {
  if (!trystero || !me) return null;
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const room = trystero.joinRoom(
    {
      appId: APP_ID,
      // Reescribe candidatos mDNS (.local) a 127.0.0.1: permite conectar
      // peers que ejecutan la web en la misma máquina o red sin resolver
      // mDNS (típico en navegadores headless y algunas redes locales).
      // Con pares de internet no afecta: ICE sigue usando candidatos srflx.
      _test_only_mdnsHostFallbackToLoopback: true,
      rtcConfig: {
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:stun1.l.google.com:19302",
              "stun:stun.cloudflare.com:3478",
            ],
          },
          // TURN gratuito (Open Relay Project): imprescindible para pares en
          // redes distintas con NAT estricto, donde STUN solo no basta.
          // Sin TURN, esos pares jamás conectan y aparecen como
          // «desconectados» aunque ambos tengan la web abierta.
          {
            urls: [
              "turn:openrelay.metered.ca:80",
              "turn:openrelay.metered.ca:443",
              "turn:openrelay.metered.ca:443?transport=tcp",
            ],
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      },
    },
    roomId,
  );
  rooms.set(roomId, room);

  const idAct = room.makeAction<AxUser>("id");
  const msgAct = room.makeAction<AxMessage>("msg");
  const typAct = room.makeAction<{ c: string; u: string; n: string; t: boolean }>("typ");
  const freqAct = room.makeAction<{ from: AxUser; to: string }>("freq");
  const faccAct = room.makeAction<{ from: AxUser; to: string }>("facc");
  const funfAct = room.makeAction<{ from: string }>("funf");
  const ginvAct = room.makeAction<{ group: AxConversation; fromName: string; to: string[] }>("ginv");
  const gleaveAct = room.makeAction<{ from: AxUser }>("gleave");
  const gdelAct = room.makeAction<{ id: string }>("gdel");
  const callAct = room.makeAction<{ c: string; k: "audio" | "video"; from: AxUser }>("call");
  const caccAct = room.makeAction<{ c: string; from: AxUser }>("cacc");
  const crejAct = room.makeAction<{ c: string; from: AxUser }>("crej");
  const cendAct = room.makeAction<{ c: string; from: AxUser }>("cend");
  const ctogAct = room.makeAction<{ c: string; from: AxUser; a: boolean; v: boolean }>("ctog");

  actionsByRoom.set(roomId, {
    id: idAct,
    msg: msgAct,
    typ: typAct,
    freq: freqAct,
    facc: faccAct,
    funf: funfAct,
    ginv: ginvAct,
    gleave: gleaveAct,
    gdel: gdelAct,
    call: callAct,
    cacc: caccAct,
    crej: crejAct,
    cend: cendAct,
    ctog: ctogAct,
  });

  room.onPeerJoin = (peerId) => {
    void idAct.send(me as AxUser, { target: peerId });
  };

  room.onPeerLeave = (peerId) => {
    handlePeerLeave(peerId);
  };

  room.onPeerStream = (stream, peerId) => {
    const userId = peerUsers.get(peerId);
    if (!userId || userId === me?.id || roomId === LOBBY_ROOM) return;
    const user = onlineUsers.get(userId);
    if (user) emit({ type: "stream", conversationId: roomId, stream, user });
  };

  idAct.onMessage = (user, ctx) => {
    registerIdentity(user, ctx.peerId, roomId);
  };

  msgAct.onMessage = (message) => {
    if (message.senderId === me?.id) return;
    emit({ type: "message", message });
  };

  typAct.onMessage = (d) => {
    if (d.u === me?.id) return;
    emit({
      type: "typing",
      conversationId: d.c,
      userId: d.u,
      displayName: d.n,
      typing: d.t,
    });
  };

  freqAct.onMessage = (d) => {
    if (d.to !== me?.id) return;
    if (d.from.id === me?.id) return;
    emit({ type: "friend-request", user: d.from });
  };

  faccAct.onMessage = (d) => {
    if (d.to !== me?.id) return;
    if (d.from.id === me?.id) return;
    emit({ type: "friend-accepted", user: d.from });
  };

  funfAct.onMessage = (d) => {
    if (d.from === me?.id) return;
    emit({ type: "friend-removed", userId: d.from });
  };

  ginvAct.onMessage = (d) => {
    if (!d.to.includes(me?.id ?? "")) return;
    if (d.group.members.some((m) => m.id === me?.id)) {
      emit({ type: "group-invite", group: d.group, fromName: d.fromName });
    }
  };

  gleaveAct.onMessage = (d) => {
    if (d.from.id === me?.id) return;
    emit({ type: "group-leave", conversationId: roomId, user: d.from });
  };

  gdelAct.onMessage = (d) => {
    emit({ type: "group-delete", conversationId: d.id });
  };

  callAct.onMessage = (d) => {
    if (d.from.id === me?.id) return;
    emit({ type: "call-incoming", conversationId: d.c, callType: d.k, from: d.from });
  };

  caccAct.onMessage = (d) => {
    if (d.from.id === me?.id) return;
    emit({ type: "call-accepted", conversationId: d.c, user: d.from });
  };

  crejAct.onMessage = (d) => {
    if (d.from.id === me?.id) return;
    emit({ type: "call-declined", conversationId: d.c, user: d.from });
  };

  cendAct.onMessage = (d) => {
    if (d.from.id === me?.id) return;
    emit({ type: "call-ended", conversationId: d.c, user: d.from });
  };

  ctogAct.onMessage = (d) => {
    if (d.from.id === me?.id) return;
    emit({
      type: "call-toggle",
      conversationId: d.c,
      user: d.from,
      audio: d.a,
      video: d.v,
    });
  };

  return room;
}

function registerIdentity(user: AxUser, peerId: string, roomId: string): void {
  if (!me || user.id === me.id) return;
  peerUsers.set(peerId, user.id);
  let set = peersByUser.get(user.id);
  if (!set) {
    set = new Set();
    peersByUser.set(user.id, set);
  }
  const wasEmpty = set.size === 0;
  if (!set.has(peerId)) set.add(peerId);
  onlineUsers.set(user.id, user);
  if (roomId === LOBBY_ROOM && wasEmpty) {
    emit({ type: "peer-online", user });
  }
}

function handlePeerLeave(peerId: string): void {
  const userId = peerUsers.get(peerId);
  peerUsers.delete(peerId);
  if (!userId) return;
  const set = peersByUser.get(userId);
  set?.delete(peerId);
  if (!set || set.size === 0) {
    peersByUser.delete(userId);
    const user = onlineUsers.get(userId);
    onlineUsers.delete(userId);
    if (user) emit({ type: "peer-offline", user });
  }
}

// ---------------------------------------------------------------------------
// Acciones de alto nivel usadas por el store
// ---------------------------------------------------------------------------

export const p2p = {
  start: startP2P,
  stop: stopP2P,
  joinRoom,
  leaveRoom,
  started: p2pStarted,
  onlineUsers: getOnlineUsers,
  onlineUserIds: getOnlineUserIds,
  isOnline: isUserOnline,

  sendMessage(conversationId: string, message: AxMessage): void {
    void send(conversationId, "msg", message);
  },

  sendTyping(conversationId: string, typing: boolean): void {
    if (!me) return;
    void send(conversationId, "typ", {
      c: conversationId,
      u: me.id,
      n: me.displayName,
      t: typing,
    });
  },

  sendFriendRequest(user: AxUser): void {
    if (!me) return;
    void sendToUser(LOBBY_ROOM, "freq", { from: me, to: user.id }, user.id);
  },

  sendFriendAccepted(user: AxUser): void {
    if (!me) return;
    void sendToUser(LOBBY_ROOM, "facc", { from: me, to: user.id }, user.id);
  },

  sendFriendRemoved(userId: string): void {
    if (!me) return;
    void send(LOBBY_ROOM, "funf", { from: me.id });
  },

  sendGroupInvite(
    group: AxConversation,
    memberIds: string[],
    fromName: string,
  ): void {
    void send(LOBBY_ROOM, "ginv", { group, fromName, to: memberIds });
  },

  sendGroupLeave(conversationId: string): void {
    if (!me) return;
    void send(conversationId, "gleave", { from: me });
  },

  sendGroupDelete(conversationId: string): void {
    void send(conversationId, "gdel", { id: conversationId });
  },

  startCall(conversationId: string, callType: "audio" | "video"): void {
    if (!me) return;
    void send(conversationId, "call", { c: conversationId, k: callType, from: me });
  },

  acceptCall(conversationId: string): void {
    if (!me) return;
    void send(conversationId, "cacc", { c: conversationId, from: me });
  },

  declineCall(conversationId: string): void {
    if (!me) return;
    void send(conversationId, "crej", { c: conversationId, from: me });
  },

  endCall(conversationId: string): void {
    if (!me) return;
    void send(conversationId, "cend", { c: conversationId, from: me });
  },

  sendCallToggle(conversationId: string, audio: boolean, video: boolean): void {
    if (!me) return;
    void send(conversationId, "ctog", { c: conversationId, from: me, a: audio, v: video });
  },

  addCallStream(conversationId: string, stream: MediaStream): void {
    const room = ensureRoom(conversationId);
    if (!room) return;
    try {
      for (const p of room.addStream(stream)) void p.catch(() => undefined);
    } catch (err) {
      console.warn("[p2p] addStream", err);
    }
  },

  removeCallStream(conversationId: string, stream: MediaStream): void {
    const room = ensureRoom(conversationId);
    if (!room) return;
    try {
      room.removeStream(stream);
    } catch {
      /* ignorar */
    }
  },
};
