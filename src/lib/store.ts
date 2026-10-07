"use client";

import { create } from "zustand";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import type { Game } from "@/lib/games";

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

interface AxState {
  me: AxUser | null;
  meLoaded: boolean;
  view: View;
  activeGame: Game | null;
  socketConnected: boolean;

  friends: AxUser[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];

  conversations: AxConversation[];
  activeConversationId: string | null;
  messagesByConv: Record<string, AxMessage[]>;
  typingByConv: Record<string, Record<string, { displayName: string; ts: number }>>;
  onlineIds: Set<string>;

  // Llamada activa (estado propio de este dispositivo)
  call: {
    conversationId: string;
    type: CallType;
    role: "caller" | "callee";
    status: "connecting" | "active";
    startedAt: number;
  } | null;
  incomingCall: { conversationId: string; type: CallType; from: AxUser } | null;
  callPeerStates: Record<string, CallPeerState>;

  // Acciones
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
  initSocketListeners: () => void;

  loadFriends: () => Promise<void>;
  sendFriendRequest: (username: string) => Promise<{ ok: boolean; error?: string }>;
  respondFriendRequest: (friendshipId: string, action: "accept" | "decline") => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;

  loadConversations: () => Promise<void>;
  createDm: (userId: string) => Promise<string | null>;
  createGroup: (name: string, memberIds: string[]) => Promise<string | null>;
  openConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => void;
  setTyping: (typing: boolean) => void;

  startCall: (conversationId: string, type: CallType) => void;
  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;
  cancelCall: () => void;
  leaveCall: () => void;
  endCallIfActive: (conversationId: string) => void;
  setCallStatus: (status: "connecting" | "active") => void;
  setPeerState: (userId: string, state: CallPeerState) => void;

  totalUnread: () => number;
}

function api<T>(url: string, options?: RequestInit): Promise<T> {
  return fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data as { error?: string }).error ?? "Error de red");
    return data as T;
  });
}

export const useAxStore = create<AxState>((set, get) => ({
  me: null,
  meLoaded: false,
  view: "home",
  activeGame: null,
  socketConnected: false,

  friends: [],
  incoming: [],
  outgoing: [],

  conversations: [],
  activeConversationId: null,
  messagesByConv: {},
  typingByConv: {},
  onlineIds: new Set<string>(),

  call: null,
  incomingCall: null,
  callPeerStates: {},

  setMe: (me) => set({ me, meLoaded: true }),

  fetchMe: async () => {
    try {
      const data = await api<{ user: AxUser }>("/api/auth/me");
      set({ me: data.user, meLoaded: true });
    } catch {
      set({ me: null, meLoaded: true });
    }
  },

  login: async (username, password) => {
    try {
      const data = await api<{ user: AxUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      set({ me: data.user });
      get().connect();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  register: async (username, password, displayName) => {
    try {
      const data = await api<{ user: AxUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password, displayName }),
      });
      set({ me: data.user });
      get().connect();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  logout: async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* continuar */
    }
    disconnectSocket();
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
      call: null,
      incomingCall: null,
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
    if (!me) return;
    const socket = connectSocket();

    socket.off("connect");
    socket.off("disconnect");
    socket.on("connect", () => {
      set({ socketConnected: true });
      // Refrescar datos al conectar (y reconectar): mantiene los badges y
      // notificaciones al día aunque el usuario no abra el chat
      void get().loadConversations();
      void get().loadFriends();
    });
    socket.on("disconnect", () => set({ socketConnected: false }));

    if (!socket.data?.axcInit) {
      socket.data = { ...socket.data, axcInit: true };
      get().initSocketListeners();
    }
    if (!socket.connected) socket.connect();
  },

  initSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on("message:new", (payload: { message: AxMessage; clientId: string | null }) => {
      const { message } = payload;
      const state = get();
      const list = state.messagesByConv[message.conversationId] ?? [];
      // Deduplicar (mensaje optimista local con mismo clientId)
      if (payload.clientId && list.some((m) => m.id === payload.clientId)) {
        set({
          messagesByConv: {
            ...state.messagesByConv,
            [message.conversationId]: list.map((m) =>
              m.id === payload.clientId ? message : m
            ),
          },
        });
      } else if (!list.some((m) => m.id === message.id)) {
        set({
          messagesByConv: {
            ...state.messagesByConv,
            [message.conversationId]: [...list, message],
          },
        });
      }
      // Actualizar lista de conversaciones (lastMessage + orden)
      const convs = get().conversations.map((c) =>
        c.id === message.conversationId
          ? { ...c, lastMessage: message, updatedAt: message.createdAt }
          : c
      );
      convs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      const isActive =
        get().activeConversationId === message.conversationId &&
        (get().view === "chat" || get().call?.conversationId === message.conversationId);
      const isMine = message.senderId === get().me?.id;
      if (!isActive && !isMine) {
        set({ conversations: convs });
        get().loadConversations();
      } else if (isActive && !isMine) {
        void fetch(`/api/conversations/${message.conversationId}/read`, { method: "POST" });
        set({ conversations: convs });
      } else {
        set({ conversations: convs });
      }
      // Limpiar typing del remitente
      const typing = { ...(get().typingByConv[message.conversationId] ?? {}) };
      if (typing[message.senderId]) {
        delete typing[message.senderId];
        set({ typingByConv: { ...get().typingByConv, [message.conversationId]: typing } });
      }
    });

    socket.on("typing", (data: { conversationId: string; userId: string; displayName: string; typing: boolean }) => {
      const cur = { ...(get().typingByConv[data.conversationId] ?? {}) };
      if (data.typing) {
        cur[data.userId] = { displayName: data.displayName, ts: Date.now() };
      } else {
        delete cur[data.userId];
      }
      set({ typingByConv: { ...get().typingByConv, [data.conversationId]: cur } });
    });

    socket.on("presence:init", (data: { onlineUserIds: string[] }) => {
      set({ onlineIds: new Set(data.onlineUserIds) });
    });

    socket.on("presence:update", (data: { userId: string; online: boolean }) => {
      const next = new Set(get().onlineIds);
      if (data.online) next.add(data.userId);
      else next.delete(data.userId);
      set({ onlineIds: next });
    });

    socket.on("friends:refresh", () => {
      if (get().me) void get().loadFriends();
    });

    socket.on("conversations:refresh", () => {
      if (get().me) void get().loadConversations();
    });
  },

  loadFriends: async () => {
    try {
      const data = await api<{ friends: AxUser[]; incoming: FriendRequest[]; outgoing: FriendRequest[] }>(
        "/api/friends"
      );
      set({ friends: data.friends, incoming: data.incoming, outgoing: data.outgoing });
    } catch {
      /* sin sesión */
    }
  },

  sendFriendRequest: async (username) => {
    try {
      const data = await api<{ accepted: boolean; user: AxUser }>("/api/friends", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      if (!data.accepted) {
        // notificar al destino en tiempo real
        getSocket()?.emit("friends:refresh-ping", { targetUserId: data.user.id });
      } else {
        // se aceptó automáticamente la solicitud inversa: ambos refrescan
        getSocket()?.emit("friends:refresh-ping", { targetUserId: data.user.id });
        void get().loadConversations();
      }
      await get().loadFriends();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  respondFriendRequest: async (friendshipId, action) => {
    try {
      const data = await api<{ user?: AxUser }>(`/api/friends/requests/${friendshipId}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await get().loadFriends();
      if (action === "accept" && data.user) {
        getSocket()?.emit("friends:refresh-ping", { targetUserId: data.user.id });
        getSocket()?.emit("conversations:refresh-ping", { targetUserIds: [data.user.id] });
      }
    } catch {
      /* ignorar */
    }
  },

  removeFriend: async (userId) => {
    try {
      await api(`/api/friends/${userId}`, { method: "DELETE" });
      getSocket()?.emit("friends:refresh-ping", { targetUserId: userId });
      await get().loadFriends();
    } catch {
      /* ignorar */
    }
  },

  loadConversations: async () => {
    try {
      const data = await api<{ conversations: AxConversation[] }>("/api/conversations");
      set({ conversations: data.conversations });
    } catch {
      /* sin sesión */
    }
  },

  createDm: async (userId) => {
    try {
      const data = await api<{ conversationId: string }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ type: "dm", userId }),
      });
      await get().loadConversations();
      if (data.conversationId) {
        getSocket()?.emit("conversations:refresh-ping", { targetUserIds: [userId] });
        await get().openConversation(data.conversationId);
      }
      return data.conversationId;
    } catch {
      return null;
    }
  },

  createGroup: async (name, memberIds) => {
    try {
      const data = await api<{ conversationId: string }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ type: "group", name, memberIds }),
      });
      await get().loadConversations();
      if (data.conversationId) {
        getSocket()?.emit("conversations:refresh-ping", { targetUserIds: memberIds });
        await get().openConversation(data.conversationId);
      }
      return data.conversationId;
    } catch {
      return null;
    }
  },

  openConversation: async (id) => {
    set({ activeConversationId: id });
    try {
      const data = await api<{ messages: AxMessage[] }>(`/api/conversations/${id}/messages`);
      set((s) => ({ messagesByConv: { ...s.messagesByConv, [id]: data.messages } }));
      await fetch(`/api/conversations/${id}/read`, { method: "POST" });
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, unreadCount: 0 } : c
        ),
      }));
    } catch {
      /* ignorar */
    }
  },

  sendMessage: (content) => {
    const socket = getSocket();
    const conversationId = get().activeConversationId;
    const text = content.trim();
    if (!socket || !conversationId || !text) return;
    const me = get().me!;
    const clientId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Mensaje optimista
    const optimistic: AxMessage = {
      id: clientId,
      conversationId,
      senderId: me.id,
      content: text,
      type: "text",
      createdAt: new Date().toISOString(),
      sender: me,
    };
    set((s) => ({
      messagesByConv: {
        ...s.messagesByConv,
        [conversationId]: [...(s.messagesByConv[conversationId] ?? []), optimistic],
      },
    }));
    socket.emit("message:send", { conversationId, content: text, clientId });
  },

  setTyping: (typing) => {
    const socket = getSocket();
    const conversationId = get().activeConversationId;
    if (!socket || !conversationId) return;
    socket.emit("typing", { conversationId, typing });
  },

  startCall: (conversationId, type) => {
    const socket = getSocket();
    if (!socket) return;
    set({
      call: {
        conversationId,
        type,
        role: "caller",
        status: "connecting",
        startedAt: Date.now(),
      },
      callPeerStates: {},
    });
    socket.emit("call:start", { conversationId, type });
  },

  acceptIncomingCall: () => {
    const socket = getSocket();
    const incoming = get().incomingCall;
    if (!socket || !incoming) return;
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
    });
    socket.emit("call:accept", { conversationId: incoming.conversationId });
  },

  declineIncomingCall: () => {
    const socket = getSocket();
    const incoming = get().incomingCall;
    if (!socket || !incoming) return;
    socket.emit("call:decline", { conversationId: incoming.conversationId });
    set({ incomingCall: null });
  },

  cancelCall: () => {
    const socket = getSocket();
    const call = get().call;
    if (!call) return;
    if (socket && call.role === "caller" && call.status === "connecting") {
      socket.emit("call:cancel", { conversationId: call.conversationId });
    }
    set({ call: null, callPeerStates: {} });
  },

  leaveCall: () => {
    const socket = getSocket();
    const call = get().call;
    if (!call) return;
    if (socket) socket.emit("call:leave", { conversationId: call.conversationId });
    set({ call: null, callPeerStates: {} });
  },

  endCallIfActive: (conversationId) => {
    if (get().call?.conversationId === conversationId) {
      set({ call: null, callPeerStates: {} });
    }
    if (get().incomingCall?.conversationId === conversationId) {
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

  totalUnread: () => {
    return get().conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  },
}));
