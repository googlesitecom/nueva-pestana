import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) {
      await db.session.deleteMany({ where: { token } });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    console.error("logout error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
