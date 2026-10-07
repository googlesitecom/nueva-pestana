import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// POST: marcar conversación como leída
export async function POST(
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
      return NextResponse.json({ error: "No tienes acceso." }, { status: 403 });
    }

    await db.conversationMember.update({
      where: { id: member.id },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("mark read error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
