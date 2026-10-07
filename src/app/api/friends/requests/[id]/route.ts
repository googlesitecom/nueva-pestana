import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { pingUsers } from "@/lib/realtime-ping";

// POST: aceptar o rechazar una solicitud recibida
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");

    const friendship = await db.friendship.findUnique({
      where: { id },
      include: { requester: true, addressee: true },
    });
    if (!friendship || friendship.addresseeId !== me.id) {
      return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
    }

    if (action === "accept") {
      if (friendship.status === "accepted") {
        return NextResponse.json({ ok: true, user: toPublicUser(friendship.requester) });
      }
      const updated = await db.friendship.update({
        where: { id },
        data: { status: "accepted" },
      });
      // Avisar en tiempo real a quien envió la solicitud
      void pingUsers([friendship.requesterId], "friends:refresh");
      void pingUsers([friendship.requesterId], "conversations:refresh");
      return NextResponse.json({ ok: true, user: toPublicUser(friendship.requester) });
    }

    if (action === "decline") {
      await db.friendship.delete({ where: { id } });
      return NextResponse.json({ ok: true, declined: true });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (e) {
    console.error("friend request action error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

// DELETE: cancelar una solicitud enviada
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const { id } = await params;
    const friendship = await db.friendship.findUnique({ where: { id } });
    if (!friendship || friendship.requesterId !== me.id) {
      return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
    }
    await db.friendship.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("cancel friend request error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
