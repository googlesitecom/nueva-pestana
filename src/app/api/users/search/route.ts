import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, toPublicUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }
    const users = await db.user.findMany({
      where: {
        username: { startsWith: q },
        id: { not: me.id },
      },
      take: 8,
      orderBy: { username: "asc" },
    });
    return NextResponse.json({ users: users.map(toPublicUser) });
  } catch (e) {
    console.error("user search error", e);
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
