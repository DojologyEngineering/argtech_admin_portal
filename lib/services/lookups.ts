/**
 * Free-form reference lists (soil types, delivery methods, ...) that users can
 * extend inline from a "select or type to create" control.
 */

import { commit, delay, getDb } from "../mock/store";
import type { LookupKey, Lookups } from "../types";

export async function listLookups(): Promise<Lookups> {
  return delay(getDb().lookups, 60);
}

export async function getLookup(key: LookupKey): Promise<string[]> {
  return delay(getDb().lookups[key], 60);
}

/** Adds a value if it is new; returns the full list either way. */
export async function addLookupValue(
  key: LookupKey,
  value: string,
): Promise<string[]> {
  const trimmed = value.trim();
  if (!trimmed) return getLookup(key);
  return commit((db) => {
    const list = db.lookups[key];
    const exists = list.some(
      (v) => v.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!exists) list.push(trimmed);
    return [...db.lookups[key]];
  });
}
