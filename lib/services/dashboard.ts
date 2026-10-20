/** Aggregates for the dashboard landing screen. */

import { delay, getDb } from "../mock/store";
import { cycleMetrics, isActiveStatus, orderTotals, round } from "../derive";
import { farmerName, todayISO } from "../format";
import { isOpenRequest } from "./orders";
import type { DeliveryMethod, ID, OrderStatus, OrderType } from "../types";

export interface DashboardStats {
  totalFarmers: number;
  farmPlots: number;
  /** Distinct crops with at least one open (not completed) cycle. */
  cropsInProduction: number;
  /** Cycles that are not completed yet. */
  openCycles: number;
  /** Orders that went ahead: everything except open and declined requests. */
  purchaseOrders: number;
  /** Confirmed orders still to be delivered or picked up. */
  ordersInProgress: number;
  /** Requests waiting for a reply (status Requested). */
  requestsWaiting: number;
  totalAreaHectares: number;
}

export interface HarvestPoint {
  /** yyyy-mm, used as a stable key. */
  key: string;
  label: string;
  kg: number;
}

export interface UpcomingHarvest {
  cycleId: ID;
  cropName: string;
  farmerName: string;
  province: string;
  expectedHarvestDate: string;
  expectedOutputKg: number;
  /** Negative when the harvest is late. */
  daysAway: number;
  /** Expected date passed and nothing picked yet. */
  overdue: boolean;
}

export interface RecentOrder {
  id: ID;
  code: string;
  buyerName: string;
  cropSummary: string;
  notInCatalog: boolean;
  quantityKg: number;
  /** Null while a request has no agreed price. */
  totalPrice: number | null;
  /** Delivery date, pickup date, or needed-by date. */
  date: string;
  status: OrderStatus;
  type: OrderType;
  method: DeliveryMethod;
}

export interface DashboardData {
  stats: DashboardStats;
  harvest: HarvestPoint[];
  harvestTrendPct: number | null;
  upcoming: UpcomingHarvest[];
  recentOrders: RecentOrder[];
}

const MONTHS_SHOWN = 6;

export async function getDashboard(): Promise<DashboardData> {
  const db = getDb();
  const today = new Date();

  /* --------------------------------------------------------- stats */
  const openCycles = db.cycles.filter((c) => !c.completedAt);
  const cropsInProduction = new Set(openCycles.map((c) => c.cropId)).size;

  const stats: DashboardStats = {
    totalFarmers: db.farmers.length,
    farmPlots: db.plots.length,
    cropsInProduction,
    openCycles: openCycles.length,
    purchaseOrders: db.orders.filter((o) => !isOpenRequest(o)).length,
    ordersInProgress: db.orders.filter((o) => o.status === "Confirmed").length,
    requestsWaiting: db.orders.filter(
      (o) => o.type === "Request" && o.status === "Requested",
    ).length,
    totalAreaHectares: round(
      db.plots.reduce((s, p) => s + p.areaHectares, 0),
      2,
    ),
  };

  /* ------------------------------------------ harvest volume by month */
  const buckets: HarvestPoint[] = [];
  for (let i = MONTHS_SHOWN - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      kg: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const cycle of db.cycles) {
    for (const entry of cycle.harvestLog) {
      const key = entry.date.slice(0, 7);
      const bucket = byKey.get(key);
      if (bucket) bucket.kg = round(bucket.kg + entry.quantityKg, 2);
    }
  }

  // Month to date against the same number of days of last month, so a month that
  // has only just started is never compared with a whole one. No badge when
  // either period has nothing in it.
  const dayOfMonth = today.getDate();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevLength = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const sumUpTo = (key: string, lastDay: number) =>
    db.cycles
      .flatMap((c) => c.harvestLog)
      .filter((h) => h.date.slice(0, 7) === key && Number(h.date.slice(8, 10)) <= lastDay)
      .reduce((sum, h) => sum + h.quantityKg, 0);
  const latest = sumUpTo(keyOf(monthStart), dayOfMonth);
  const previous = sumUpTo(keyOf(prevStart), Math.min(dayOfMonth, prevLength));
  const harvestTrendPct =
    previous > 0 && latest > 0 ? round((latest - previous) / previous, 4) : null;

  /* ------------------------------------------------ upcoming harvests */
  const iso = todayISO();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);
  const horizonISO = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, "0")}-${String(horizon.getDate()).padStart(2, "0")}`;

  const upcoming: UpcomingHarvest[] = db.cycles
    .filter((c) => {
      const status = cycleMetrics(c, db.orders).status;
      return (
        isActiveStatus(status) &&
        c.expectedHarvestDate <= horizonISO
      );
    })
    .map((c) => {
      const farmer = db.farmers.find((f) => f.id === c.farmerId);
      const plot = db.plots.find((p) => p.id === c.plotId);
      const crop = db.crops.find((x) => x.id === c.cropId);
      const days = Math.round(
        (new Date(`${c.expectedHarvestDate}T00:00:00`).getTime() -
          new Date(`${iso}T00:00:00`).getTime()) /
          86_400_000,
      );
      return {
        cycleId: c.id,
        cropName: crop?.name ?? "Unknown crop",
        farmerName: farmer ? farmerName(farmer) : "Unknown farmer",
        province: plot?.province ?? "",
        expectedHarvestDate: c.expectedHarvestDate,
        expectedOutputKg: c.expectedOutputKg,
        daysAway: days,
        overdue: days < 0,
      };
    })
    // Overdue harvests first (the latest running furthest behind on top), then
    // what is coming up soonest.
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        a.expectedHarvestDate.localeCompare(b.expectedHarvestDate),
    )
    .slice(0, 5);

  /* -------------------------------------------------- recent orders */
  const recentOrders: RecentOrder[] = db.orders
    .filter((o) => !isOpenRequest(o))
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
    .slice(0, 5)
    .map((o) => {
      const totals = orderTotals(o);
      return {
        id: o.id,
        code: o.code,
        buyerName: db.buyers.find((b) => b.id === o.buyerId)?.name ?? "—",
        cropSummary: o.cropName || "—",
        notInCatalog: o.notInCatalog,
        quantityKg: totals.quantityKg,
        totalPrice: totals.totalPrice,
        date: o.deliveryDate,
        status: o.status,
        type: o.type,
        method: o.method,
      };
    });

  return delay({ stats, harvest: buckets, harvestTrendPct, upcoming, recentOrders });
}
