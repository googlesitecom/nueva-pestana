import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { pingUsers } from "@/lib/realtime-ping";

// DELETE: eliminar a un amigo
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const { userId } = await params;

    const deleted = await db.friendship.deleteMany({
      where: {
        status: "accepted",
        OR: [
          { requesterId: me.id, addresseeId: userId },
          { requesterId: userId, addresseeId: me.id },
        ],
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "No son amigos." }, { status: 404 });
    }
    // Avisar en tiempo real al otro usuario
    void pingUsers([userId], "friends:refresh");
    void pingUsers([userId], "conversations:refresh");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("remove friend error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
