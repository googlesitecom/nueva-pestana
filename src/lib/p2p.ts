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
let starting = false;

const rooms = new Map<string, Room>();
const actionsByRoom = new Map<string, Record<string, { send: (data: unknown, options?: { target?: string | string[] | null }) => Promise<void> }>>();
const peerUsers = new Map<string, string>(); // peerId -> userId
const peersByUser = new Map<string, Set<string>>(); // userId -> peerIds
const onlineUsers = new Map<string, AxUser>(); // userId -> user (visto en el lobby)

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
  if (starting) return;
  starting = true;
  try {
    if (!trystero) trystero = await import("trystero/nostr");
    me = user;
    ensureRoom(LOBBY_ROOM);
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
  } finally {
    starting = false;
  }
}

export function stopP2P(): void {
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
  ensureRoom(roomId);
}

export function leaveRoom(roomId: string): void {
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
