"use client";

/**
 * Cuentas reales SIN email y SIN servidor (compatible con GitHub Pages).
 *
 * - Las credenciales se guardan en localStorage de este navegador.
 * - Las contraseñas se hashean con PBKDF2-SHA256 (120 000 iteraciones,
 *   salt aleatorio de 16 bytes) mediante la Web Crypto API.
 * - Cada cuenta tiene una identidad (AxUser) con un userId único que se
 *   usa para el chat P2P entre navegadores.
 */

import type { AxUser } from "./store";

const ACCOUNTS_KEY = "axcg:accounts";
const SESSION_KEY = "axcg:session";
const ITERATIONS = 120_000;

export type Account = {
  username: string;
  salt: string;
  hash: string;
  user: AxUser;
};

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const AVATAR_COLORS = [
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#22d3ee",
  "#a3e635",
  "#fb7185",
  "#38bdf8",
];

function randomSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function derive(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export function loadAccounts(): Record<string, Account> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const parsed = JSON.parse(raw ?? "{}") as Record<string, Account>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAccounts(accounts: Record<string, Account>): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* almacenamiento lleno o no disponible */
  }
}

export function setSession(username: string | null): void {
  try {
    if (username) localStorage.setItem(SESSION_KEY, username);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignorar */
  }
}

export function getSessionUser(): AxUser | null {
  if (typeof window === "undefined") return null;
  try {
    const username = localStorage.getItem(SESSION_KEY);
    if (!username) return null;
    const account = loadAccounts()[username];
    return account?.user ?? null;
  } catch {
    return null;
  }
}

export async function registerAccount(
  username: string,
  password: string,
  displayName: string,
): Promise<{ ok: boolean; error?: string; user?: AxUser }> {
  const clean = username.trim().toLowerCase();
  if (!USERNAME_RE.test(clean)) {
    return {
      ok: false,
      error: "El usuario debe tener 3-20 caracteres: letras, números o guion bajo.",
    };
  }
  if (password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }
  const accounts = loadAccounts();
  if (accounts[clean]) {
    return { ok: false, error: "Ese nombre de usuario ya existe en este navegador." };
  }
  const salt = randomSalt();
  const hash = await derive(password, salt);
  const user: AxUser = {
    id: crypto.randomUUID(),
    username: clean,
    displayName: (displayName.trim() || clean).slice(0, 24),
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    bio: "",
    createdAt: new Date().toISOString(),
  };
  accounts[clean] = { username: clean, salt, hash, user };
  saveAccounts(accounts);
  setSession(clean);
  return { ok: true, user };
}

export async function loginAccount(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string; user?: AxUser }> {
  const clean = username.trim().toLowerCase();
  const account = loadAccounts()[clean];
  if (!account) {
    return { ok: false, error: "No existe ninguna cuenta con ese usuario." };
  }
  const hash = await derive(password, account.salt);
  if (hash !== account.hash) {
    return { ok: false, error: "Contraseña incorrecta." };
  }
  setSession(clean);
  return { ok: true, user: account.user };
}
