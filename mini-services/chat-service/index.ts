import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  log: ["error"],
});

interface AuthedUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

/** userId -> Set<socketId> conectados */
const online = new Map<string, Set<string>>();

interface ActiveCall {
  conversationId: string;
  type: "audio" | "video";
  initiatorId: string;
  startedAt: number;
  participants: Map<string, Set<string>>;
  callEnded: boolean;
}

/** conversationId -> ActiveCall */
const activeCalls = new Map<string, ActiveCall>();

const SESSION_COOKIE = "axc_session";

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

async function authSocket(socket: Socket): Promise<AuthedUser | null> {
  try {
    let token: string | undefined =
      (socket.handshake.auth?.token as string | undefined) || undefined;
    if (!token && socket.handshake.headers?.cookie) {
      token = parseCookies(socket.handshake.headers.cookie)[SESSION_COOKIE];
    }
    if (!token) return null;
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      avatarColor: session.user.avatarColor,
    };
  } catch (e) {
    console.error("socket auth error", e);
    return null;
  }
}

async function getMemberIds(conversationId: string): Promise<string[]> {
  const members = await db.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

function broadcastPresence(userId: string, isOnline: boolean) {
  io.emit("presence:update", { userId, online: isOnline });
}

async function endCallIfEmpty(call: ActiveCall) {
  if (call.participants.size > 0) return;
  activeCalls.delete(call.conversationId);
  const memberIds = await getMemberIds(call.conversationId);
  for (const memberId of memberIds) {
    io.to(userRoom(memberId)).emit("call:ended", { conversationId: call.conversationId });
  }
  // Persistir mensaje del sistema con la duración y emitirlo a los miembros
  const durationSec = Math.max(1, Math.round((Date.now() - call.startedAt) / 1000));
  try {
    const message = await db.message.create({
      data: {
        conversationId: call.conversationId,
        senderId: call.initiatorId,
        type: "call",
        content: JSON.stringify({ event: "ended", durationSec, kind: call.type }),
      },
      include: { sender: true },
    });
    await db.conversation.update({
      where: { id: call.conversationId },
      data: { updatedAt: new Date() },
    });

    const payload = {
      message: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          displayName: message.sender.displayName,
          avatarColor: message.sender.avatarColor,
          bio: message.sender.bio,
          createdAt: message.sender.createdAt.toISOString(),
        },
      },
      clientId: null,
    };
    for (const memberId of memberIds) {
      io.to(userRoom(memberId)).emit("message:new", payload);
      io.to(userRoom(memberId)).emit("conversations:refresh", {});
    }
  } catch (e) {
    console.error("end call persist error", e);
  }
}

io.on("connection", async (socket) => {
  const user = await authSocket(socket);
  if (!user) {
    socket.emit("auth:error", { message: "Sesión no válida" });
    socket.disconnect(true);
    return;
  }

  socket.data.user = user;
  socket.join(userRoom(user.id));

  const wasOnline = online.has(user.id);
  if (!wasOnline) online.set(user.id, new Set());
  online.get(user.id)!.add(socket.id);

  if (!wasOnline) {
    broadcastPresence(user.id, true);
  }

  // Estado inicial de presencia para este cliente
  socket.emit("presence:init", { onlineUserIds: [...online.keys()] });

  socket.on("message:send", async (data: { conversationId: string; content: string; clientId?: string }) => {
    try {
      const { conversationId, clientId } = data ?? ({} as any);
      const content = String(data?.content ?? "").trim().slice(0, 2000);
      if (!conversationId || !content) return;

      const member = await db.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: user.id } },
      });
      if (!member) return;

      const message = await db.message.create({
        data: { conversationId, senderId: user.id, content, type: "text" },
        include: { sender: true },
      });
      await db.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      const payload = {
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt.toISOString(),
          sender: {
            id: message.sender.id,
            username: message.sender.username,
            displayName: message.sender.displayName,
            avatarColor: message.sender.avatarColor,
            bio: message.sender.bio,
            createdAt: message.sender.createdAt.toISOString(),
          },
        },
        clientId: clientId ?? null,
      };

      const memberIds = await getMemberIds(conversationId);
      for (const memberId of memberIds) {
        io.to(userRoom(memberId)).emit("message:new", payload);
      }
    } catch (e) {
      console.error("message:send error", e);
    }
  });

  socket.on("typing", async (data: { conversationId: string; typing: boolean }) => {
    try {
      const { conversationId, typing } = data ?? ({} as any);
      if (!conversationId) return;
      const member = await db.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: user.id } },
      });
      if (!member) return;
      const memberIds = await getMemberIds(conversationId);
      for (const memberId of memberIds) {
        if (memberId === user.id) continue;
        io.to(userRoom(memberId)).emit("typing", {
          conversationId,
          userId: user.id,
          displayName: user.displayName,
          typing: Boolean(typing),
        });
      }
    } catch (e) {
      console.error("typing error", e);
    }
  });

  // Ping para que otro usuario recargue su lista de amigos
  socket.on("friends:refresh-ping", (data: { targetUserId: string }) => {
    const target = data?.targetUserId;
    if (typeof target === "string" && target) {
      io.to(userRoom(target)).emit("friends:refresh", {});
    }
  });

  // Ping para que otros usuarios recarguen sus conversaciones
  socket.on("conversations:refresh-ping", (data: { targetUserIds: string[] }) => {
    const targets = Array.isArray(data?.targetUserIds) ? data.targetUserIds : [];
    for (const t of targets) {
      if (typeof t === "string" && t) io.to(userRoom(t)).emit("conversations:refresh", {});
    }
  });

  // ===================== LLAMADAS (señalización WebRTC) =====================

  socket.on("call:start", async (data: { conversationId: string; type: "audio" | "video" }) => {
    try {
      const { conversationId } = data ?? ({} as any);
      const type = data?.type === "video" ? "video" : "audio";
      if (!conversationId) return;

      const member = await db.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: user.id } },
      });
      if (!member) return;

      if (activeCalls.has(conversationId)) {
        socket.emit("call:busy", { conversationId });
        return;
      }

      const call: ActiveCall = {
        conversationId,
        type,
        initiatorId: user.id,
        startedAt: Date.now(),
        participants: new Map([[user.id, new Set([socket.id])]]),
        callEnded: false,
      };
      activeCalls.set(conversationId, call);

      const memberIds = await getMemberIds(conversationId);
      for (const memberId of memberIds) {
        if (memberId === user.id) continue;
        io.to(userRoom(memberId)).emit("call:incoming", {
          conversationId,
          type,
          from: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarColor: user.avatarColor,
          },
        });
      }
    } catch (e) {
      console.error("call:start error", e);
    }
  });

  socket.on("call:accept", async (data: { conversationId: string }) => {
    try {
      const { conversationId } = data ?? ({} as any);
      const call = activeCalls.get(conversationId);
      if (!call || call.callEnded) return;

      const member = await db.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: user.id } },
      });
      if (!member) return;

      if (!call.participants.has(user.id)) call.participants.set(user.id, new Set());
      call.participants.get(user.id)!.add(socket.id);

      // Avisar a los ya conectados para que ofrezcan conexión al nuevo
      for (const [pid, sockets] of call.participants) {
        if (pid === user.id) continue;
        for (const sid of sockets) {
          io.to(sid).emit("call:peer-joined", { conversationId, userId: user.id });
        }
      }
      // Confirmar al que acepta
      socket.emit("call:accepted", {
        conversationId,
        participantIds: [...call.participants.keys()].filter((x) => x !== user.id),
      });
    } catch (e) {
      console.error("call:accept error", e);
    }
  });

  socket.on("call:decline", async (data: { conversationId: string }) => {
    try {
      const { conversationId } = data ?? ({} as any);
      const call = activeCalls.get(conversationId);
      if (!call) return;
      const memberIds = await getMemberIds(conversationId);
      for (const memberId of memberIds) {
        io.to(userRoom(memberId)).emit("call:declined", {
          conversationId,
          userId: user.id,
          displayName: user.displayName,
        });
      }
    } catch (e) {
      console.error("call:decline error", e);
    }
  });

  socket.on("call:cancel", async (data: { conversationId: string }) => {
    const { conversationId } = data ?? ({} as any);
    const call = activeCalls.get(conversationId);
    if (!call || call.initiatorId !== user.id) return;
    activeCalls.delete(conversationId);
    const memberIds = await getMemberIds(conversationId);
    for (const memberId of memberIds) {
      io.to(userRoom(memberId)).emit("call:ended", { conversationId });
    }
  });

  socket.on(
    "call:offer",
    async (data: { conversationId: string; targetUserId: string; sdp: RTCSessionDescriptionInit }) => {
      const { conversationId, targetUserId, sdp } = data ?? ({} as any);
      const call = activeCalls.get(conversationId);
      if (!call || !targetUserId || !sdp) return;
      if (!call.participants.has(user.id)) return;
      io.to(userRoom(targetUserId)).emit("call:offer", {
        conversationId,
        fromUserId: user.id,
        sdp,
      });
    }
  );

  socket.on(
    "call:answer",
    async (data: { conversationId: string; targetUserId: string; sdp: RTCSessionDescriptionInit }) => {
      const { conversationId, targetUserId, sdp } = data ?? ({} as any);
      const call = activeCalls.get(conversationId);
      if (!call || !targetUserId || !sdp) return;
      if (!call.participants.has(user.id)) return;
      io.to(userRoom(targetUserId)).emit("call:answer", {
        conversationId,
        fromUserId: user.id,
        sdp,
      });
    }
  );

  socket.on(
    "call:ice",
    async (data: { conversationId: string; targetUserId: string; candidate: RTCIceCandidateInit }) => {
      const { conversationId, targetUserId, candidate } = data ?? ({} as any);
      const call = activeCalls.get(conversationId);
      if (!call || !targetUserId || !candidate) return;
      if (!call.participants.has(user.id)) return;
      io.to(userRoom(targetUserId)).emit("call:ice", {
        conversationId,
        fromUserId: user.id,
        candidate,
      });
    }
  );

  socket.on("call:leave", async (data: { conversationId: string }) => {
    await handleLeave(socket, user, data?.conversationId);
  });

  socket.on("call:toggle", (data: { conversationId: string; audio?: boolean; video?: boolean }) => {
    const { conversationId } = data ?? ({} as any);
    const call = activeCalls.get(conversationId);
    if (!call) return;
    const sockets = call.participants.get(user.id);
    if (!sockets) return;
    const payload = {
      conversationId,
      userId: user.id,
      audio: data?.audio,
      video: data?.video,
    };
    for (const [pid, pSockets] of call.participants) {
      if (pid === user.id) continue;
      for (const sid of pSockets) io.to(sid).emit("call:peer-state", payload);
    }
  });

  socket.on("disconnect", async () => {
    const sockets = online.get(user.id);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        online.delete(user.id);
        broadcastPresence(user.id, false);
      }
    }
    // Salir de llamadas activas
    for (const [conversationId, call] of [...activeCalls]) {
      if (!call.participants.has(user.id)) continue;
      const socketsInCall = call.participants.get(user.id)!;
      socketsInCall.delete(socket.id);
      if (socketsInCall.size === 0) {
        call.participants.delete(user.id);
        // Avisar al resto
        for (const [pid, pSockets] of call.participants) {
          for (const sid of pSockets) {
            io.to(sid).emit("call:peer-left", { conversationId, userId: user.id });
          }
        }
        await endCallIfEmpty(call);
      }
    }
  });

  socket.on("error", (error: unknown) => {
    console.error(`Socket error (${socket.id}):`, error);
  });
});

async function handleLeave(socket: Socket, user: AuthedUser, conversationId?: string) {
  if (!conversationId) return;
  const call = activeCalls.get(conversationId);
  if (!call) return;
  const socketsInCall = call.participants.get(user.id);
  if (socketsInCall) {
    socketsInCall.delete(socket.id);
    if (socketsInCall.size === 0) call.participants.delete(user.id);
  }
  if (!call.participants.has(user.id)) {
    for (const [pid, pSockets] of call.participants) {
      for (const sid of pSockets) {
        io.to(sid).emit("call:peer-left", { conversationId, userId: user.id });
      }
    }
    await endCallIfEmpty(call);
  }
}

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`axcgames chat service (socket.io) running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
