import { NextResponse } from "next/server";
import { getSessionUser, toPublicUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (e) {
    console.error("me error", e);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
