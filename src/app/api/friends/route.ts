import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { pingUsers } from "@/lib/realtime-ping";

// GET: lista de amigos + solicitudes
export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const friendships = await db.friendship.findMany({
      where: { OR: [{ requesterId: me.id }, { addresseeId: me.id }] },
      include: { requester: true, addressee: true },
    });

    const friends = [];
    const incoming = [];
    const outgoing = [];

    for (const f of friendships) {
      const other = f.requesterId === me.id ? f.addressee : f.requester;
      if (f.status === "accepted") {
        friends.push(toPublicUser(other));
      } else if (f.status === "pending") {
        if (f.addresseeId === me.id) {
          incoming.push({ friendshipId: f.id, user: toPublicUser(other) });
        } else {
          outgoing.push({ friendshipId: f.id, user: toPublicUser(other) });
        }
      }
    }

    return NextResponse.json({ friends, incoming, outgoing });
  } catch (e) {
    console.error("friends list error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

// POST: enviar solicitud de amistad por nombre de usuario
export async function POST(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const username = String(body?.username ?? "").trim().toLowerCase();
    if (!username) {
      return NextResponse.json({ error: "Escribe un nombre de usuario." }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { username } });
    if (!target) {
      return NextResponse.json(
        { error: `No existe ningún usuario llamado «${username}».` },
        { status: 404 }
      );
    }
    if (target.id === me.id) {
      return NextResponse.json({ error: "No puedes agregarte a ti mismo." }, { status: 400 });
    }

    const existing = await db.friendship.findFirst({
      where: {
        OR: [
          { requesterId: me.id, addresseeId: target.id },
          { requesterId: target.id, addresseeId: me.id },
        ],
      },
    });

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json(
          { error: `Ya son amigos con ${target.displayName}.` },
          { status: 409 }
        );
      }
      if (existing.requesterId === me.id) {
        return NextResponse.json(
          { error: `Ya enviaste una solicitud a ${target.displayName}.` },
          { status: 409 }
        );
      }
      // La otra persona ya nos envió solicitud: aceptarla directamente
      const updated = await db.friendship.update({
        where: { id: existing.id },
        data: { status: "accepted" },
      });
      // Avisar en tiempo real al otro usuario (nuevo amigo + chats)
      void pingUsers([target.id], "friends:refresh");
      void pingUsers([target.id], "conversations:refresh");
      return NextResponse.json({
        accepted: true,
        friendshipId: updated.id,
        user: toPublicUser(target),
      });
    }

    const friendship = await db.friendship.create({
      data: { requesterId: me.id, addresseeId: target.id, status: "pending" },
    });

    // Notificación en tiempo real al destinatario de la solicitud
    void pingUsers([target.id], "friends:refresh");

    return NextResponse.json(
      { accepted: false, friendshipId: friendship.id, user: toPublicUser(target) },
      { status: 201 }
    );
  } catch (e) {
    console.error("friend request error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
