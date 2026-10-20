/**
 * In-memory mock store standing in for the backend.
 *
 * Nothing outside `lib/services/*` may import this module. Components call the
 * service functions, which are all async — so when a real API arrives, only the
 * service bodies change and no component is touched.
 *
 * State is mirrored into localStorage so a page reload keeps whatever the user
 * entered during a session. Bump SCHEMA_VERSION to discard old saved data.
 */

import { createSeedDb, type Db } from "./seed";

const STORAGE_KEY = "argtech.portal.db";
const SCHEMA_VERSION = 7;

interface Persisted {
  version: number;
  db: Db;
}

let db: Db | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Fills in fields that older saved data may lack, so a record written before a
 * field existed can never crash a screen. Data from an older SCHEMA_VERSION is
 * not patched: it is replaced by the current seed instead.
 */
function normalize(value: Db): Db {
  for (const farmer of value.farmers) {
    for (const cert of farmer.certificates) {
      cert.coversCropIds ??= [];
      cert.appliesTo ??= [];
    }
  }
  return value;
}

function load(): Db {
  if (!isBrowser()) return createSeedDb();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed.version === SCHEMA_VERSION && parsed.db) return normalize(parsed.db);
    }
  } catch {
    // Corrupt or unreadable storage just falls back to a fresh seed.
  }
  const seeded = createSeedDb();
  persist(seeded);
  return seeded;
}

function persist(value: Db): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, db: value } satisfies Persisted),
    );
  } catch {
    // Storage full or blocked — the in-memory copy still works for this session.
  }
}

/** The live database. Lazily seeded on first access. */
export function getDb(): Db {
  if (!db) db = load();
  return db;
}

/** Runs a mutation and writes the result through to storage. */
export function commit<T>(mutate: (db: Db) => T): T {
  const current = getDb();
  const result = mutate(current);
  persist(current);
  return result;
}

/** Throws the saved data away and re-seeds. Used by the Settings screen. */
export function resetDb(): void {
  db = createSeedDb();
  persist(db);
}

/* ------------------------------------------------------------- helpers */

/**
 * Structured clone on the way out, so a component mutating a returned object
 * can never reach back into the store — the same isolation a network boundary
 * would give us.
 */
export function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

/** Simulates network latency so loading states are real and get exercised. */
export function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(clone(value)), ms));
}

let counter = 0;

/** Collision-resistant id for records created in the browser. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * Next sequential display code, e.g. "PO-0012" or "REQ-0012".
 *
 * Reads the numbers out of the codes it is given rather than a stored counter,
 * so it survives resets. Pass *every* code that shares one sequence: for orders
 * that is all REQ- and PO- codes together, so either prefix can be produced
 * from the same count. It always returns a number higher than every number
 * already in use, so a number never ends up under both prefixes.
 */
export function nextCode(prefix: string, existing: string[]): string {
  const highest = existing.reduce((max, code) => {
    const match = code.match(/(\d+)$/);
    const n = match ? Number(match[1]) : 0;
    return n > max ? n : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found.`);
    this.name = "NotFoundError";
  }
}

export type { Db };
