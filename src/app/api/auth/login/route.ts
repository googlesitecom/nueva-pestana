import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSession,
  sessionCookieOptions,
  toPublicUser,
  verifyPassword,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Escribe tu usuario y contraseña." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ user: toPublicUser(user) });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
