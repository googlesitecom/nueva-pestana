"use client";

/**
 * Sistema de notificaciones reales de axcgames:
 * - Sonidos sintetizados con WebAudio (sin archivos externos)
 * - Notificaciones de escritorio vía la Notification API del navegador
 * - Desbloqueo de audio con el primer gesto del usuario
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Llamar en el primer gesto del usuario para habilitar los sonidos */
export function unlockAudio(): void {
  getCtx();
}

function tone(freq: number, delay: number, dur: number, vol: number): void {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  try {
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch {
    /* best effort */
  }
}

/** Ding de mensaje nuevo (dos notas ascendentes) */
export function playMessageChime(): void {
  tone(880, 0, 0.18, 0.12);
  tone(1318.5, 0.12, 0.3, 0.1);
}

/** Nuevo amigo / solicitud de amistad (acorde cálido) */
export function playFriendChime(): void {
  tone(659.25, 0, 0.2, 0.1);
  tone(880, 0.14, 0.38, 0.09);
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Notificación de escritorio con el icono del logo */
export function notifyDesktop(title: string, body: string, tag?: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const n = new Notification(title, {
      body,
      tag,
      icon: `${bp}/icon.png`,
      badge: `${bp}/icon.png`,
      silent: true, // ya reproducimos nuestro propio sonido
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* algunos navegadores requieren ServiceWorker; ignorar */
  }
}
