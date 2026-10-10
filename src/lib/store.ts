"use client";

/**
 * Store principal de axcgames — versión 100% cliente (GitHub Pages).
 *
 * Mantiene la misma interfaz pública que la versión con backend para que
 * la UI no cambie, pero toda la persistencia es localStorage y toda la
 * comunicación en tiempo real es P2P (Trystero/WebRTC):
 *
 *  - Cuentas: localStorage con hash PBKDF2 (ver local-auth.ts)
 *  - Amigos / solicitudes: localStorage + acciones P2P por el lobby
 *  - Conversaciones (DM deterministas + grupos) y mensajes: localStorage
 *  - Llamadas voz/vídeo: WebRTC gestionado por Trystero (p2p.ts)
 */

import { create } from "zustand";
import type { Game } from "@/lib/games";
import {
  getSessionUser,
  loginAccount,
  registerAccount,
  setSession,
} from "./accounts";
import {
  LOBBY_ROOM,
  PEER_DISCOVERY_TIMEOUT_MS,
  p2p,
  subscribeP2P,
  type P2pEvent,
} from "./p2p";

export type View = "home" | "game" | "chat" | "auth";

export interface AxUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  bio: string;
  createdAt: string;
}

export interface AxMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
  sender: AxUser;
}

export interface AxConversation {
  id: string;
  type: "dm" | "group";
  name: string | null;
  avatarColor: string;
  createdBy: string | null;
  updatedAt: string;
  members: AxUser[];
  lastMessage: AxMessage | null;
  unreadCount: number;
  lastReadAt: string;
}

export interface FriendRequest {
  friendshipId: string;
  user: AxUser;
}

export type CallType = "audio" | "video";

export interface CallPeerState {
  audio?: boolean;
  video?: boolean;
}

const GROUP_COLORS = ["#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ec4899", "#f97316"];
const MSG_CAP = 200;

interface AxState {
  me: AxUser | null;
  meLoaded: boolean;
  view: View;
  activeGame: Game | null;
  socketConnected: boolean;

  friends: AxUser[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  onlineIds: Set<string>;
  onlineUsersList: AxUser[];

  conversations: AxConversation[];
  activeConversationId: string | null;
  messagesByConv: Record<string, AxMessage[]>;
  typingByConv: Record<string, Record<string, { displayName: string; ts: number }>>;

  call: {
    conversationId: string;
    type: CallType;
    role: "caller" | "callee";
    status: "connecting" | "active";
    startedAt: number;
  } | null;
  incomingCall: { conversationId: string; type: CallType; from: AxUser } | null;
  callPeerStates: Record<string, CallPeerState>;
  callStreams: Record<string, MediaStream>;

  setMe: (me: AxUser | null) => void;
  fetchMe: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (
    username: string,
    password: string,
    displayName: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  goHome: () => void;
  openGame: (game: Game) => void;
  openChat: () => void;
  openAuth: () => void;

  connect: () => void;

  loadFriends: () => Promise<void>;
  sendFriendRequest: (username: string) => Promise<{ ok: boolean; error?: string }>;
  respondFriendRequest: (friendshipId: string, action: "accept" | "decline") => Promise<void>;
  cancelFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;

  loadConversations: () => Promise<void>;
  createDm: (userId: string) => Promise<string | null>;
  createGroup: (name: string, memberIds: string[]) => Promise<string | null>;
  leaveGroup: (conversationId: string) => void;
  deleteGroup: (conversationId: string) => void;
  openConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => void;
  setTyping: (typing: boolean) => void;
  insertCallLog: (kind: "audio" | "video", durationSec: number) => void;

  startCall: (conversationId: string, type: CallType) => void;
  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;
  cancelCall: () => void;
  leaveCall: () => void;
  endCallIfActive: (conversationId: string) => void;
  setCallStatus: (status: "connecting" | "active") => void;
  setPeerState: (userId: string, state: CallPeerState) => void;
  setRemoteStream: (userId: string, stream: MediaStream) => void;
  removeRemoteStream: (userId: string) => void;

  totalUnread: () => number;
}

// ---------------------------------------------------------------------------
// Persistencia local (por usuario logueado)
// ---------------------------------------------------------------------------

let currentUid: string | null = null;

function k(name: string): string {
  return `axcg:${name}:${currentUid ?? "anon"}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignorar */
  }
}

function persistFriends(s: AxState): void {
  write(k("friends"), s.friends);
  write(k("freqin"), s.incoming);
  write(k("freqout"), s.outgoing);
}

function persistConvs(convs: AxConversation[]): void {
  write(k("convs"), convs);
}

function persistMsgs(convId: string, msgs: AxMessage[]): void {
  write(`${k("msgs")}:${convId}`, msgs.slice(-MSG_CAP));
}

export function dmConvId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(":")}`;
}

function sortConvs(convs: AxConversation[]): AxConversation[] {
  return [...convs].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function makeDmConv(meUser: AxUser, other: AxUser): AxConversation {
  const now = new Date().toISOString();
  return {
    id: dmConvId(meUser.id, other.id),
    type: "dm",
    name: null,
    avatarColor: other.avatarColor,
    createdBy: null,
    updatedAt: now,
    members: [meUser, other],
    lastMessage: null,
    unreadCount: 0,
    lastReadAt: now,
  };
}

// ---------------------------------------------------------------------------
// Registro único de eventos P2P
// ---------------------------------------------------------------------------

let p2pHandlersRegistered = false;

function ensureP2pHandlers(get: () => AxState, set: (partial: Partial<AxState>) => void): void {
  if (p2pHandlersRegistered || typeof window === "undefined") return;
  p2pHandlersRegistered = true;

  const onEvent = (e: P2pEvent) => handleP2pEvent(e, get, set);
  subscribeP2P(onEvent);
}

function handleP2pEvent(e: P2pEvent, get: () => AxState, set: (partial: Partial<AxState>) => void): void {
  const s = get();
  if (!s.me) return;

  switch (e.type) {
    case "peer-online": {
      if (e.user.id === s.me.id) return;
      if (!s.onlineIds.has(e.user.id)) {
        const next = new Set(s.onlineIds);
        next.add(e.user.id);
        set({ onlineIds: next, onlineUsersList: p2p.onlineUsers() });
      }
      return;
    }
    case "peer-offline": {
      if (!s.onlineIds.has(e.user.id)) return;
      const next = new Set(s.onlineIds);
      next.delete(e.user.id);
      set({ onlineIds: next, onlineUsersList: p2p.onlineUsers() });
      if (s.call && s.callStreams[e.user.id]) {
        const streams = { ...s.callStreams };
        delete streams[e.user.id];
        set({ callStreams: streams });
      }
      return;
    }
    case "message": {
      const m = e.message;
      if (m.senderId === s.me.id) return;
      const list = s.messagesByConv[m.conversationId] ?? [];
      if (list.some((x) => x.id === m.id)) return;
      const conv =
        s.conversations.find((c) => c.id === m.conversationId) ??
        (m.senderId !== s.me.id
          ? (() => {
              const friend = s.friends.find((f) => f.id === m.senderId);
              if (!friend) return null;
              const conv2 = makeDmConv(s.me as AxUser, friend);
              const added = sortConvs([...s.conversations, conv2]);
              persistConvs(added);
              return conv2;
            })()
          : null);
      if (!conv) return;
      const nextList = [...list, m];
      persistMsgs(m.conversationId, nextList);
      const viewing = s.view === "chat" && s.activeConversationId === m.conversationId;
      const updated = sortConvs(
        s.conversations.map((c) =>
          c.id === m.conversationId
            ? { ...c, lastMessage: m, updatedAt: m.createdAt, unreadCount: viewing ? 0 : c.unreadCount + 1 }
            : c,
        ),
      );
      persistConvs(updated);
      const typing = { ...(s.typingByConv[m.conversationId] ?? {}) };
      if (typing[m.senderId]) {
        delete typing[m.senderId];
      }
      set({
        messagesByConv: { ...s.messagesByConv, [m.conversationId]: nextList },
        conversations: updated,
        typingByConv: { ...s.typingByConv, [m.conversationId]: typing },
      });
      return;
    }
    case "typing": {
      const cur = { ...(s.typingByConv[e.conversationId] ?? {}) };
      if (e.typing) cur[e.userId] = { displayName: e.displayName, ts: Date.now() };
      else delete cur[e.userId];
      set({ typingByConv: { ...s.typingByConv, [e.conversationId]: cur } });
      return;
    }
    case "friend-request": {
      const user = e.user;
      if (s.friends.some((f) => f.id === user.id)) {
        p2p.sendFriendAccepted(user);
        return;
      }
      const outIdx = s.outgoing.findIndex((r) => r.user.id === user.id);
      if (outIdx >= 0) {
        // Aceptación mutua: ambos enviaron solicitudes
        friendAccept(user, get, set);
        p2p.sendFriendAccepted(user);
        return;
      }
      if (s.incoming.some((r) => r.user.id === user.id)) return;
      const incoming = [...s.incoming, { friendshipId: `fr-${user.id}`, user }];
      persistFriends({ ...s, incoming } as AxState);
      set({ incoming });
      return;
    }
    case "friend-accepted": {
      friendAccept(e.user, get, set);
      return;
    }
    case "friend-removed": {
      if (!s.friends.some((f) => f.id === e.userId)) return;
      const friends = s.friends.filter((f) => f.id !== e.userId);
      persistFriends({ ...s, friends } as AxState);
      set({ friends });
      return;
    }
    case "group-invite": {
      if (s.conversations.some((c) => c.id === e.group.id)) return;
      const convs = sortConvs([...s.conversations, e.group]);
      persistConvs(convs);
      for (const c of [e.group]) p2p.joinRoom(c.id);
      set({ conversations: convs });
      return;
    }
    case "group-leave": {
      const convs = s.conversations.map((c) =>
        c.id === e.conversationId
          ? { ...c, members: c.members.filter((m) => m.id !== e.user.id) }
          : c,
      );
      persistConvs(convs);
      set({ conversations: convs });
      return;
    }
    case "group-delete": {
      const convs = s.conversations.filter((c) => c.id !== e.conversationId);
      persistConvs(convs);
      p2p.leaveRoom(e.conversationId);
      set({
        conversations: convs,
        activeConversationId:
          s.activeConversationId === e.conversationId ? null : s.activeConversationId,
      });
      return;
    }
    case "call-incoming": {
      if (s.call) {
        p2p.declineCall(e.conversationId);
        return;
      }
      set({
        incomingCall: {
          conversationId: e.conversationId,
          type: e.callType,
          from: e.from,
        },
      });
      return;
    }
    case "call-accepted": {
      if (s.call?.conversationId === e.conversationId) {
        set({ call: { ...s.call, status: "active" } });
      }
      return;
    }
    case "call-declined": {
      if (s.call?.conversationId === e.conversationId) {
        set({ call: null, callPeerStates: {}, callStreams: {} });
      }
      return;
    }
    case "call-ended": {
      if (s.call?.conversationId === e.conversationId && s.call.status === "active") {
        insertCallLogFor(s, set, s.call.type, Math.floor((Date.now() - s.call.startedAt) / 1000));
      }
      if (s.call?.conversationId === e.conversationId || s.incomingCall?.conversationId === e.conversationId) {
        set({ call: null, incomingCall: null, callPeerStates: {}, callStreams: {} });
      }
      return;
    }
    case "call-toggle": {
      set({ callPeerStates: { ...s.callPeerStates, [e.user.id]: { audio: e.audio, video: e.video } } });
      return;
    }
    case "stream": {
      set({ callStreams: { ...s.callStreams, [e.user.id]: e.stream } });
      return;
    }
  }
}

function insertCallLogFor(
  s: AxState,
  set: (partial: Partial<AxState>) => void,
  kind: "audio" | "video",
  durationSec: number,
): void {
  if (!s.call || !s.me) return;
  const m: AxMessage = {
    id: crypto.randomUUID(),
    conversationId: s.call.conversationId,
    senderId: s.me.id,
    content: JSON.stringify({ event: "ended", durationSec, kind }),
    type: "call",
    createdAt: new Date().toISOString(),
    sender: s.me,
  };
  const list = [...(s.messagesByConv[s.call.conversationId] ?? []), m];
  persistMsgs(s.call.conversationId, list);
  const convs = sortConvs(
    s.conversations.map((c) =>
      c.id === s.call.conversationId ? { ...c, lastMessage: m, updatedAt: m.createdAt } : c,
    ),
  );
  persistConvs(convs);
  set({
    messagesByConv: { ...s.messagesByConv, [s.call.conversationId]: list },
    conversations: convs,
  });
}

function friendAccept(
  user: AxUser,
  get: () => AxState,
  set: (partial: Partial<AxState>) => void,
): void {
  const s = get();
  if (!s.me) return;
  if (s.friends.some((f) => f.id === user.id)) return;
  const friends = [...s.friends, user];
  const incoming = s.incoming.filter((r) => r.user.id !== user.id);
  const outgoing = s.outgoing.filter((r) => r.user.id !== user.id);
  let convs = s.conversations;
  const dmId = dmConvId(s.me.id, user.id);
  if (!convs.some((c) => c.id === dmId)) {
    convs = sortConvs([...convs, makeDmConv(s.me, user)]);
    p2p.joinRoom(dmId);
  }
  persistFriends({ ...s, friends, incoming, outgoing } as AxState);
  persistConvs(convs);
  set({ friends, incoming, outgoing, conversations: convs });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAxStore = create<AxState>((set, get) => ({
  me: null,
  meLoaded: false,
  view: "home",
  activeGame: null,
  socketConnected: false,

  friends: [],
  incoming: [],
  outgoing: [],
  onlineIds: new Set<string>(),
  onlineUsersList: [],

  conversations: [],
  activeConversationId: null,
  messagesByConv: {},
  typingByConv: {},

  call: null,
  incomingCall: null,
  callPeerStates: {},
  callStreams: {},

  setMe: (me) => set({ me, meLoaded: true }),

  fetchMe: async () => {
    const user = getSessionUser();
    if (!user) {
      set({ me: null, meLoaded: true });
      return;
    }
    currentUid = user.id;
    set({
      me: user,
      meLoaded: true,
      friends: read(k("friends"), [] as AxUser[]),
      incoming: read(k("freqin"), [] as FriendRequest[]),
      outgoing: read(k("freqout"), [] as FriendRequest[]),
      conversations: sortConvs(read(k("convs"), [] as AxConversation[])),
      onlineIds: p2p.onlineUserIds(),
      onlineUsersList: p2p.onlineUsers(),
    });
    get().connect();
    for (const c of get().conversations) p2p.joinRoom(c.id);
  },

  login: async (username, password) => {
    const res = await loginAccount(username, password);
    if (!res.ok || !res.user) return { ok: false, error: res.error };
    currentUid = res.user.id;
    set({
      me: res.user,
      meLoaded: true,
      friends: read(k("friends"), [] as AxUser[]),
      incoming: read(k("freqin"), [] as FriendRequest[]),
      outgoing: read(k("freqout"), [] as FriendRequest[]),
      conversations: sortConvs(read(k("convs"), [] as AxConversation[])),
      onlineIds: new Set<string>(),
      onlineUsersList: [],
    });
    get().connect();
    for (const c of get().conversations) p2p.joinRoom(c.id);
    return { ok: true };
  },

  register: async (username, password, displayName) => {
    const res = await registerAccount(username, password, displayName);
    if (!res.ok || !res.user) return { ok: false, error: res.error };
    currentUid = res.user.id;
    set({
      me: res.user,
      meLoaded: true,
      friends: [],
      incoming: [],
      outgoing: [],
      conversations: [],
      onlineIds: new Set<string>(),
      onlineUsersList: [],
    });
    get().connect();
    return { ok: true };
  },

  logout: async () => {
    setSession(null);
    p2p.stop();
    currentUid = null;
    set({
      me: null,
      view: "home",
      friends: [],
      incoming: [],
      outgoing: [],
      conversations: [],
      activeConversationId: null,
      messagesByConv: {},
      onlineIds: new Set<string>(),
      onlineUsersList: [],
      call: null,
      incomingCall: null,
      callStreams: {},
      callPeerStates: {},
      socketConnected: false,
    });
  },

  goHome: () => {
    set({ view: "home" });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  openGame: (game) => {
    set({ view: "game", activeGame: game });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  openChat: () => {
    const { me } = get();
    if (!me) {
      set({ view: "auth" });
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    set({ view: "chat" });
    window.scrollTo({ top: 0, behavior: "auto" });
    void get().loadConversations();
    void get().loadFriends();
  },

  openAuth: () => {
    set({ view: "auth" });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  connect: () => {
    const { me } = get();
    if (!me || typeof window === "undefined") return;
    ensureP2pHandlers(get, set);
    void p2p.start(me).then(() => {
      if (get().me?.id === me.id) set({ socketConnected: true });
    });
  },

  loadFriends: async () => {
    if (!currentUid) return;
    set({
      friends: read(k("friends"), [] as AxUser[]),
      incoming: read(k("freqin"), [] as FriendRequest[]),
      outgoing: read(k("freqout"), [] as FriendRequest[]),
    });
  },

  sendFriendRequest: async (username) => {
    const s = get();
    if (!s.me) return { ok: false, error: "Inicia sesión primero." };
    const clean = username.trim().toLowerCase();

    // El descubrimiento P2P (relés + WebRTC) puede tardar varios segundos
    // aunque ambos estén conectados: esperamos un rato antes de declarar
    // que el usuario está desconectado, en lugar de fallar al instante.
    const findOnline = () => p2p.onlineUsers().find((u) => u.username === clean);
    let user = findOnline();
    const deadline = Date.now() + PEER_DISCOVERY_TIMEOUT_MS;
    while (!user && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      if (get().me?.id !== s.me?.id) return { ok: false, error: "Sesión cerrada." };
      user = findOnline();
    }
    if (!user) {
      return {
        ok: false,
        error: `No se encontró a @${clean} con la web abierta. Comprueba que está conectado y vuelve a intentarlo en unos segundos (el chat es directo entre navegadores).`,
      };
    }
    // Releer estado: durante la espera pudo cambiar (nuevas solicitudes, etc.)
    const fresh = get();
    if (!fresh.me) return { ok: false, error: "Sesión cerrada." };
    if (user.id === fresh.me.id) return { ok: false, error: "No puedes añadirte a ti mismo." };
    if (fresh.friends.some((f) => f.id === user.id)) {
      return { ok: false, error: "Ya sois amigos." };
    }
    const inIdx = fresh.incoming.findIndex((r) => r.user.id === user.id);
    if (inIdx >= 0) {
      friendAccept(user, get, set);
      p2p.sendFriendAccepted(user);
      return { ok: true };
    }
    if (fresh.outgoing.some((r) => r.user.id === user.id)) {
      return { ok: false, error: "Ya enviaste una solicitud a este usuario." };
    }
    const outgoing = [...fresh.outgoing, { friendshipId: `fs-${user.id}`, user }];
    persistFriends({ ...fresh, outgoing } as AxState);
    set({ outgoing });
    p2p.sendFriendRequest(user);
    return { ok: true };
  },

  respondFriendRequest: async (friendshipId, action) => {
    const s = get();
    const req = s.incoming.find((r) => r.friendshipId === friendshipId);
    if (!req) return;
    if (action === "accept") {
      friendAccept(req.user, get, set);
      p2p.sendFriendAccepted(req.user);
    } else {
      const incoming = s.incoming.filter((r) => r.friendshipId !== friendshipId);
      persistFriends({ ...s, incoming } as AxState);
      set({ incoming });
    }
  },

  cancelFriendRequest: async (friendshipId) => {
    const s = get();
    const outgoing = s.outgoing.filter((r) => r.friendshipId !== friendshipId);
    persistFriends({ ...s, outgoing } as AxState);
    set({ outgoing });
  },

  removeFriend: async (userId) => {
    const s = get();
    const friends = s.friends.filter((f) => f.id !== userId);
    persistFriends({ ...s, friends } as AxState);
    set({ friends });
    p2p.sendFriendRemoved(userId);
  },

  loadConversations: async () => {
    if (!currentUid) return;
    set({ conversations: sortConvs(read(k("convs"), [] as AxConversation[])) });
  },

  createDm: async (userId) => {
    const s = get();
    if (!s.me) return null;
    const friend = s.friends.find((f) => f.id === userId);
    if (!friend) return null;
    const dmId = dmConvId(s.me.id, userId);
    let convs = s.conversations;
    if (!convs.some((c) => c.id === dmId)) {
      convs = sortConvs([...convs, makeDmConv(s.me, friend)]);
      persistConvs(convs);
      p2p.joinRoom(dmId);
      set({ conversations: convs });
    }
    await get().openConversation(dmId);
    return dmId;
  },

  createGroup: async (name, memberIds) => {
    const s = get();
    if (!s.me) return null;
    const members = [
      s.me,
      ...memberIds
        .map((id) => s.friends.find((f) => f.id === id))
        .filter((f): f is AxUser => Boolean(f)),
    ];
    const now = new Date().toISOString();
    const conv: AxConversation = {
      id: `grp:${crypto.randomUUID()}`,
      type: "group",
      name: name.slice(0, 40),
      avatarColor: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)],
      createdBy: s.me.id,
      updatedAt: now,
      members,
      lastMessage: null,
      unreadCount: 0,
      lastReadAt: now,
    };
    const convs = sortConvs([...s.conversations, conv]);
    persistConvs(convs);
    p2p.joinRoom(conv.id);
    set({ conversations: convs });
    p2p.sendGroupInvite(conv, memberIds, s.me.displayName);
    await get().openConversation(conv.id);
    return conv.id;
  },

  leaveGroup: (conversationId) => {
    const s = get();
    const conv = s.conversations.find((c) => c.id === conversationId);
    if (!conv || conv.type !== "group") return;
    p2p.sendGroupLeave(conversationId);
    p2p.leaveRoom(conversationId);
    const convs = s.conversations.filter((c) => c.id !== conversationId);
    persistConvs(convs);
    set({
      conversations: convs,
      activeConversationId:
        s.activeConversationId === conversationId ? null : s.activeConversationId,
    });
  },

  deleteGroup: (conversationId) => {
    const s = get();
    const conv = s.conversations.find((c) => c.id === conversationId);
    if (!conv || conv.type !== "group") return;
    p2p.sendGroupDelete(conversationId);
    p2p.leaveRoom(conversationId);
    const convs = s.conversations.filter((c) => c.id !== conversationId);
    persistConvs(convs);
    set({
      conversations: convs,
      activeConversationId:
        s.activeConversationId === conversationId ? null : s.activeConversationId,
    });
  },

  openConversation: async (id) => {
    set({ activeConversationId: id });
    const s = get();
    if (!currentUid) return;
    const msgs = read<AxMessage[]>(`${k("msgs")}:${id}`, []);
    const convs = s.conversations.map((c) =>
      c.id === id ? { ...c, unreadCount: 0, lastReadAt: new Date().toISOString() } : c,
    );
    persistConvs(convs);
    set({
      messagesByConv: { ...s.messagesByConv, [id]: msgs },
      conversations: convs,
    });
  },

  sendMessage: (content) => {
    const s = get();
    const conversationId = s.activeConversationId;
    const text = content.trim();
    if (!s.me || !conversationId || !text) return;
    const m: AxMessage = {
      id: crypto.randomUUID(),
      conversationId,
      senderId: s.me.id,
      content: text,
      type: "text",
      createdAt: new Date().toISOString(),
      sender: s.me,
    };
    const list = [...(s.messagesByConv[conversationId] ?? []), m];
    persistMsgs(conversationId, list);
    const convs = sortConvs(
      s.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessage: m, updatedAt: m.createdAt } : c,
      ),
    );
    persistConvs(convs);
    set({
      messagesByConv: { ...s.messagesByConv, [conversationId]: list },
      conversations: convs,
    });
    p2p.sendMessage(conversationId, m);
  },

  setTyping: (typing) => {
    const conversationId = get().activeConversationId;
    if (!conversationId) return;
    p2p.sendTyping(conversationId, typing);
  },

  insertCallLog: (kind, durationSec) => {
    const s = get();
    insertCallLogFor(s, set, kind, durationSec);
  },

  startCall: (conversationId, type) => {
    set({
      call: {
        conversationId,
        type,
        role: "caller",
        status: "connecting",
        startedAt: Date.now(),
      },
      callPeerStates: {},
      callStreams: {},
    });
    p2p.startCall(conversationId, type);
  },

  acceptIncomingCall: () => {
    const incoming = get().incomingCall;
    if (!incoming) return;
    set({
      incomingCall: null,
      call: {
        conversationId: incoming.conversationId,
        type: incoming.type,
        role: "callee",
        status: "connecting",
        startedAt: Date.now(),
      },
      callPeerStates: {},
      callStreams: {},
    });
    p2p.acceptCall(incoming.conversationId);
  },

  declineIncomingCall: () => {
    const incoming = get().incomingCall;
    if (!incoming) return;
    p2p.declineCall(incoming.conversationId);
    set({ incomingCall: null });
  },

  cancelCall: () => {
    const call = get().call;
    if (!call) return;
    if (call.role === "caller" && call.status === "connecting") {
      p2p.endCall(call.conversationId);
    }
    set({ call: null, callPeerStates: {}, callStreams: {} });
  },

  leaveCall: () => {
    const call = get().call;
    if (!call) return;
    p2p.endCall(call.conversationId);
    if (call.status === "active") {
      insertCallLogFor(get(), set, call.type, Math.floor((Date.now() - call.startedAt) / 1000));
    }
    set({ call: null, callPeerStates: {}, callStreams: {} });
  },

  endCallIfActive: (conversationId) => {
    const s = get();
    if (s.call?.conversationId === conversationId) {
      if (s.call.status === "active") {
        insertCallLogFor(s, set, s.call.type, Math.floor((Date.now() - s.call.startedAt) / 1000));
      }
      set({ call: null, callPeerStates: {}, callStreams: {} });
    }
    if (s.incomingCall?.conversationId === conversationId) {
      set({ incomingCall: null });
    }
  },

  setCallStatus: (status) => {
    const call = get().call;
    if (call) set({ call: { ...call, status } });
  },

  setPeerState: (userId, state) => {
    set((s) => ({ callPeerStates: { ...s.callPeerStates, [userId]: state } }));
  },

  setRemoteStream: (userId, stream) => {
    set((s) => ({ callStreams: { ...s.callStreams, [userId]: stream } }));
  },

  removeRemoteStream: (userId) => {
    set((s) => {
      if (!s.callStreams[userId]) return s;
      const streams = { ...s.callStreams };
      delete streams[userId];
      return { callStreams: streams };
    });
  },

  totalUnread: () => {
    return get().conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  },
}));
