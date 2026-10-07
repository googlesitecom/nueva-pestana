import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  USERNAME_RE,
  createSession,
  hashPassword,
  sessionCookieOptions,
  toPublicUser,
  SESSION_COOKIE,
} from "@/lib/auth";

const AVATAR_COLORS = [
  "#fbbf24",
  "#f87171",
  "#34d399",
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#fb923c",
  "#2dd4bf",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const displayNameRaw = String(body?.displayName ?? "").trim();

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        {
          error:
            "El usuario debe tener 3-20 caracteres: minúsculas, números o guion bajo.",
        },
        { status: 400 }
      );
    }
    if (password.length < 6 || password.length > 100) {
      return NextResponse.json(
        { error: "La contraseña debe tener entre 6 y 100 caracteres." },
        { status: 400 }
      );
    }
    const displayName = (displayNameRaw || username).slice(0, 24);

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "Ese nombre de usuario ya está ocupado." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        username,
        displayName,
        passwordHash: hashPassword(password),
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      },
    });

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch (e) {
    console.error("register error", e);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
