import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, toPublicUser } from "@/lib/auth";

// GET: historial de mensajes (últimos 60)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const { id } = await params;

    const member = await db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: me.id } },
    });
    if (!member) {
      return NextResponse.json({ error: "No tienes acceso a esta conversación." }, { status: 403 });
    }

    const messages = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { sender: true },
    });

    return NextResponse.json({
      messages: messages
        .map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          content: m.content,
          type: m.type,
          createdAt: m.createdAt.toISOString(),
          sender: toPublicUser(m.sender),
        }))
        .reverse(),
    });
  } catch (e) {
    console.error("messages list error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
