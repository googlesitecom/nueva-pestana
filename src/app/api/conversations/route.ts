import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, toPublicUser } from "@/lib/auth";

// GET: conversaciones del usuario con último mensaje y no leídos
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const memberships = await db.conversationMember.findMany({
      where: { userId: me.id },
      include: {
        conversation: {
          include: {
            members: { include: { user: true } },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { sender: true },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });

    const conversations = memberships.map((m) => {
      const conv = m.conversation;
      const lastMessage = conv.messages[0] ?? null;
      return {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        avatarColor: conv.avatarColor,
        createdBy: conv.createdBy,
        updatedAt: conv.updatedAt.toISOString(),
        members: conv.members.map((mm) => toPublicUser(mm.user)),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              conversationId: lastMessage.conversationId,
              senderId: lastMessage.senderId,
              content: lastMessage.content,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt.toISOString(),
              sender: toPublicUser(lastMessage.sender),
            }
          : null,
        unreadCount: 0,
        lastReadAt: m.lastReadAt.toISOString(),
      };
    });

    // Contar no leídos por conversación
    const unreadMap: Record<string, number> = {};
    for (const m of memberships) {
      const unread = await db.message.count({
        where: {
          conversationId: m.conversationId,
          senderId: { not: me.id },
          createdAt: { gt: m.lastReadAt },
        },
      });
      if (unread > 0) unreadMap[m.conversationId] = unread;
    }
    for (const c of conversations) {
      c.unreadCount = unreadMap[c.id] ?? 0;
    }

    return NextResponse.json({ conversations });
  } catch (e) {
    console.error("conversations list error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

// POST: crear DM o grupo
export async function POST(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const type = String(body?.type ?? "");

    if (type === "dm") {
      const userId = String(body?.userId ?? "");
      const other = await db.user.findUnique({ where: { id: userId } });
      if (!other || other.id === me.id) {
        return NextResponse.json({ error: "Usuario inválido." }, { status: 400 });
      }

      // Buscar DM existente entre ambos
      const myDms = await db.conversationMember.findMany({
        where: { userId: me.id, conversation: { type: "dm" } },
        include: { conversation: { include: { members: true } } },
      });
      const found = myDms.find((m) =>
        m.conversation.members.some((mm) => mm.userId === other.id)
      );
      if (found) {
        return NextResponse.json({ conversationId: found.conversationId, existing: true });
      }

      const conv = await db.conversation.create({
        data: {
          type: "dm",
          createdBy: me.id,
          members: {
            create: [
              { userId: me.id },
              { userId: other.id },
            ],
          },
        },
      });
      return NextResponse.json({ conversationId: conv.id, existing: false }, { status: 201 });
    }

    if (type === "group") {
      const name = String(body?.name ?? "").trim().slice(0, 40);
      const memberIds: string[] = Array.isArray(body?.memberIds) ? body.memberIds : [];
      if (!name) {
        return NextResponse.json({ error: "Ponle un nombre al grupo." }, { status: 400 });
      }
      const users = await db.user.findMany({ where: { id: { in: memberIds } } });
      const uniqueIds = [...new Set(users.map((u) => u.id))].filter((id) => id !== me.id);
      if (uniqueIds.length === 0) {
        return NextResponse.json(
          { error: "Añade al menos un miembro al grupo." },
          { status: 400 }
        );
      }

      const conv = await db.conversation.create({
        data: {
          type: "group",
          name,
          createdBy: me.id,
          avatarColor: ["#fbbf24", "#f87171", "#34d399", "#38bdf8", "#a78bfa", "#f472b6"][
            Math.floor(Math.random() * 6)
          ],
          members: {
            create: [{ userId: me.id }, ...uniqueIds.map((id) => ({ userId: id }))],
          },
        },
      });
      return NextResponse.json({ conversationId: conv.id, existing: false }, { status: 201 });
    }

    return NextResponse.json({ error: "Tipo de conversación inválido." }, { status: 400 });
  } catch (e) {
    console.error("create conversation error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
