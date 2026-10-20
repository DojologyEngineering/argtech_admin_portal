/**
 * Items that need staff attention, for the notification bell. Everything here is
 * derived from the orders and cycles themselves, so the list can never drift out
 * of step with what the pages show.
 */

import { delay, getDb } from "../mock/store";
import { cycleMetrics } from "../derive";
import { farmerName, todayISO } from "../format";
import { hasOpenIssue } from "./orders";
import type { ID } from "../types";

export type AttentionKind = "today" | "overdue" | "requests" | "pickup" | "issue";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  text: string;
  detail: string;
  href: string;
}

export interface Attention {
  items: AttentionItem[];
  /** Requests waiting for a reply, also shown as a badge on the sidebar link. */
  requestsWaiting: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export async function getAttention(): Promise<Attention> {
  const db = getDb();
  const today = todayISO();
  const buyerName = (id: ID) => db.buyers.find((b) => b.id === id)?.name ?? "—";

  const today_: AttentionItem[] = [];
  const overdue: AttentionItem[] = [];
  const requests: AttentionItem[] = [];
  const pickup: AttentionItem[] = [];
  const issues: AttentionItem[] = [];

  /* ----------------------------------------------- orders due today */
  for (const o of db.orders) {
    if (o.status !== "Confirmed" || o.deliveryDate !== today) continue;
    today_.push({
      id: `today-${o.id}`,
      kind: "today",
      text: `${o.code} ${o.method === "Pickup" ? "pickup" : "delivery"} today`,
      detail: `${o.cropName} · ${buyerName(o.buyerId)}`,
      href: `/orders/${o.id}`,
    });
  }

  /* ----------------------------------------------- overdue harvests */
  for (const c of db.cycles) {
    if (cycleMetrics(c, db.orders).status !== "Ready to Harvest") continue;
    if (c.expectedHarvestDate >= today) continue;
    const days = Math.round(
      (new Date(`${today}T00:00:00`).getTime() -
        new Date(`${c.expectedHarvestDate}T00:00:00`).getTime()) /
        86_400_000,
    );
    const crop = db.crops.find((x) => x.id === c.cropId)?.name ?? "Crop";
    const farmer = db.farmers.find((f) => f.id === c.farmerId);
    overdue.push({
      id: `overdue-${c.id}`,
      kind: "overdue",
      text: `${crop} harvest overdue`,
      detail: `${c.code} · ${plural(days, "day")} late${farmer ? ` · ${farmerName(farmer)}` : ""}`,
      href: `/cycles/${c.id}`,
    });
  }

  /* -------------------------------------------- requests waiting */
  const requestsWaiting = db.orders.filter(
    (o) => o.type === "Request" && o.status === "Requested",
  ).length;
  if (requestsWaiting > 0) {
    requests.push({
      id: "requests",
      kind: "requests",
      text: `${plural(requestsWaiting, "request")} waiting`,
      detail: "Needs your reply",
      href: "/requests",
    });
  }

  /* ----------------------------------- pickups not yet arranged */
  for (const o of db.orders) {
    if (o.status !== "Confirmed" || o.method !== "Pickup") continue;
    if (o.pickup?.state !== "Not arranged") continue;
    pickup.push({
      id: `pickup-${o.id}`,
      kind: "pickup",
      text: `${o.code} pickup not arranged`,
      detail: `${o.cropName} · ${buyerName(o.buyerId)}`,
      href: `/orders/${o.id}`,
    });
  }

  /* ------------------------------------------- open buyer issues */
  for (const o of db.orders) {
    if (!hasOpenIssue(o)) continue;
    issues.push({
      id: `issue-${o.id}`,
      kind: "issue",
      text: `${o.code} buyer issue open`,
      detail: `${o.cropName} · follow-up ${o.followUp.status.toLowerCase()}`,
      href: `/orders/${o.id}`,
    });
  }

  return delay(
    {
      items: [...today_, ...overdue, ...requests, ...pickup, ...issues],
      requestsWaiting,
    },
    30,
  );
}
