/**
 * Ping interno al servicio de chat (socket.io) para disparar refrescos
 * en tiempo real desde las rutas API — sin depender del navegador del
 * remitente. Best effort: si el servicio se está reiniciando, se ignora.
 */

const INTERNAL_URL = "http://127.0.0.1:3004/internal/notify";
const INTERNAL_SECRET = "axc-internal-9f3d1b7c2e";

export type PingEvent = "friends:refresh" | "conversations:refresh";

export async function pingUsers(userIds: string[], event: PingEvent): Promise<void> {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return;
  try {
    await fetch(INTERNAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-axc-internal": INTERNAL_SECRET,
      },
      body: JSON.stringify({ userIds: ids, event }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    /* best effort */
  }
}
