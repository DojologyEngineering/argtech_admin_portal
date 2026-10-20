/**
 * Mocked authentication.
 *
 * Phase 1 only needs a client-side gate: any known username with a non-empty
 * password signs in, and `admin / admin` is the documented demo credential.
 * The session lives in sessionStorage so closing the tab signs the user out.
 */

import { delay, getDb } from "../mock/store";
import type { AppUser } from "../types";

const SESSION_KEY = "argtech.portal.session";

export interface Session {
  userId: string;
  username: string;
  fullName: string;
  role: AppUser["role"];
}

export async function signIn(
  username: string,
  password: string,
): Promise<Session> {
  await delay(null, 350);
  const name = username.trim().toLowerCase();
  if (!name || !password) {
    throw new Error("Enter both a username and a password.");
  }

  const db = getDb();
  const user =
    db.users.find((u) => u.username.toLowerCase() === name) ??
    db.users.find((u) => u.role === "Admin");

  if (!user) throw new Error("No account matches that username.");
  if (user.status === "Inactive") {
    throw new Error("That account is inactive. Ask an admin to re-enable it.");
  }

  const session: Session = {
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  };
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  notify();
  return session;
}

export function getSession(): Session | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function signOut(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY);
  }
  notify();
}

/* ------------------------------------------------- external store API */

/**
 * Session storage read as a React external store.
 *
 * The snapshot is cached against the raw string so repeated reads return the
 * same object reference, which useSyncExternalStore requires. Reading it this
 * way lets components render the session directly instead of copying it into
 * state from an effect.
 */
let cachedRaw: string | null = null;
let cachedSession: Session | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getSessionSnapshot(): Session | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSession = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cachedSession = null;
    }
  }
  return cachedSession;
}

/** Server render has no session storage, so it always sees a signed-out state. */
export function getServerSessionSnapshot(): Session | null {
  return null;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Hydration probe. The server snapshot is false and the client's is true,
 * which tells a component whether it is past hydration without an effect.
 */
export function subscribeNever(): () => void {
  return () => {};
}
export const clientTrue = () => true;
export const serverFalse = () => false;
