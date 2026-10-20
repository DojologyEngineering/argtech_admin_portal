/**
 * Crop cycles — one record per farmer + plot + crop planting.
 *
 * Supply and profitability figures are never stored on the cycle. They are
 * recomputed from the harvest log and the full set of purchase orders every
 * time a cycle is read, which is what keeps "sold so far" honest when several
 * orders draw from the same harvest.
 */

import { commit, delay, getDb, newId, nextCode, NotFoundError } from "../mock/store";
import { addDays, farmerName, todayISO } from "../format";
import {
  cycleEconomics,
  cycleMetrics,
  isActiveStatus,
  orderTotals,
  type CycleEconomics,
  type CycleMetrics,
} from "../derive";
import {
  EMPTY_PRODUCTION,
  type ActivityType,
  type CropCycle,
  type CycleCosts,
  type CycleStatus,
  type FieldActivity,
  type HarvestEntry,
  type ID,
} from "../types";

export interface CycleInput {
  farmerId: ID;
  plotId: ID;
  cropId: ID;
  plantingDate: string;
  expectedHarvestDate: string;
  expectedOutputKg: number;
  costs: CycleCosts;
  remark: string;
}

export interface CropCycleView extends CropCycle {
  farmerName: string;
  plotName: string;
  cropName: string;
  cropVariety: string;
  metrics: CycleMetrics;
  /** Farmer-side break-even against the crop's buyer tier price. */
  economics: CycleEconomics;
}

function decorate(cycle: CropCycle): CropCycleView {
  const db = getDb();
  const metrics = cycleMetrics(cycle, db.orders);
  const farmer = db.farmers.find((f) => f.id === cycle.farmerId);
  const plot = db.plots.find((p) => p.id === cycle.plotId);
  const crop = db.crops.find((c) => c.id === cycle.cropId);
  return {
    ...cycle,
    farmerName: farmer ? farmerName(farmer) : "Unknown farmer",
    plotName: plot?.name ?? "Unknown plot",
    cropName: crop?.name ?? "Unknown crop",
    cropVariety: crop?.variety ?? "",
    metrics,
    economics: cycleEconomics(cycle, crop?.buyerPrices, metrics.status),
  };
}

export async function listCycles(): Promise<CropCycleView[]> {
  const views = getDb()
    .cycles.map(decorate)
    .sort((a, b) => b.plantingDate.localeCompare(a.plantingDate));
  return delay(views);
}

export async function getCycle(id: ID): Promise<CropCycleView> {
  const cycle = getDb().cycles.find((c) => c.id === id);
  if (!cycle) throw new NotFoundError("Crop cycle", id);
  return delay(decorate(cycle));
}

export async function listCyclesByFarmer(farmerId: ID): Promise<CropCycleView[]> {
  const views = getDb()
    .cycles.filter((c) => c.farmerId === farmerId)
    .map(decorate);
  return delay(views, 60);
}

/** Seeds the expected harvest date from the crop's typical days-to-harvest. */
export async function suggestHarvestDate(
  cropId: ID,
  plantingDate: string,
): Promise<string> {
  const crop = getDb().crops.find((c) => c.id === cropId);
  if (!crop || !plantingDate) return plantingDate;
  return addDays(plantingDate, crop.daysToHarvest);
}

export async function createCycle(input: CycleInput): Promise<CropCycle> {
  return commit((db) => {
    const cycle: CropCycle = {
      ...input,
      id: newId("cycle"),
      code: nextCode("CC", db.cycles.map((c) => c.code)),
      harvestLog: [],
      activities: [],
      completedAt: null,
      production: { ...EMPTY_PRODUCTION },
      stockClosed: false,
      createdAt: todayISO(),
    };
    db.cycles.push(cycle);
    return { ...cycle };
  });
}

export async function updateCycle(
  id: ID,
  input: Partial<CycleInput>,
): Promise<CropCycle> {
  return commit((db) => {
    const cycle = db.cycles.find((c) => c.id === id);
    if (!cycle) throw new NotFoundError("Crop cycle", id);
    Object.assign(cycle, input);
    return { ...cycle };
  });
}

export async function deleteCycle(id: ID): Promise<void> {
  commit((db) => {
    const committed = db.orders.some((o) =>
      o.lineItems.some((li) => li.cropCycleId === id),
    );
    if (committed) {
      throw new Error(
        "This cycle is referenced by a purchase order line item, so it cannot be removed.",
      );
    }
    db.cycles = db.cycles.filter((c) => c.id !== id);
  });
}

/* --------------------------------------------------------- harvest log */

export interface HarvestInput {
  date: string;
  quantityKg: number;
  note: string;
}

/**
 * Records one picking event. Vegetables are picked repeatedly over weeks, so
 * this is a list rather than a single "actual harvest" figure — and it carries
 * no price, because being picked is not the same as being sold.
 */
export async function addHarvestEntry(
  cycleId: ID,
  input: HarvestInput,
): Promise<HarvestEntry> {
  return commit((db) => {
    const cycle = db.cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new NotFoundError("Crop cycle", cycleId);
    if (input.quantityKg <= 0) {
      throw new Error("Quantity harvested must be greater than zero.");
    }
    const entry: HarvestEntry = { ...input, id: newId("h") };
    cycle.harvestLog.push(entry);
    cycle.harvestLog.sort((a, b) => a.date.localeCompare(b.date));
    return { ...entry };
  });
}

export async function updateHarvestEntry(
  cycleId: ID,
  entryId: ID,
  input: Partial<HarvestInput>,
): Promise<HarvestEntry> {
  return commit((db) => {
    const cycle = db.cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new NotFoundError("Crop cycle", cycleId);
    const entry = cycle.harvestLog.find((h) => h.id === entryId);
    if (!entry) throw new NotFoundError("Harvest entry", entryId);

    // Reducing a picking below what buyers already hold would let the same
    // kilos be sold twice, so the store refuses it.
    if (input.quantityKg !== undefined) {
      const sold = db.orders
        .flatMap((o) => o.lineItems)
        .filter((li) => li.cropCycleId === cycleId)
        .reduce((s, li) => s + li.quantityKg, 0);
      const others = cycle.harvestLog
        .filter((h) => h.id !== entryId)
        .reduce((s, h) => s + h.quantityKg, 0);
      if (others + input.quantityKg < sold) {
        throw new Error(
          `${sold} kg is already committed to purchase orders, so the harvest total cannot drop below that.`,
        );
      }
    }

    Object.assign(entry, input);
    cycle.harvestLog.sort((a, b) => a.date.localeCompare(b.date));
    return { ...entry };
  });
}

export async function removeHarvestEntry(
  cycleId: ID,
  entryId: ID,
): Promise<void> {
  commit((db) => {
    const cycle = db.cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new NotFoundError("Crop cycle", cycleId);
    const entry = cycle.harvestLog.find((h) => h.id === entryId);
    if (!entry) throw new NotFoundError("Harvest entry", entryId);
    const sold = db.orders
      .flatMap((o) => o.lineItems)
      .filter((li) => li.cropCycleId === cycleId)
      .reduce((s, li) => s + li.quantityKg, 0);
    const remaining = cycle.harvestLog
      .filter((h) => h.id !== entryId)
      .reduce((s, h) => s + h.quantityKg, 0);
    if (remaining < sold) {
      throw new Error(
        `${sold} kg is already committed to purchase orders, so this entry cannot be removed.`,
      );
    }
    cycle.harvestLog = cycle.harvestLog.filter((h) => h.id !== entryId);
  });
}

/* ----------------------------------------------------- field activities */

export interface ActivityInput {
  type: ActivityType;
  date: string;
  note: string;
}

export async function addActivity(
  cycleId: ID,
  input: ActivityInput,
): Promise<FieldActivity> {
  return commit((db) => {
    const cycle = db.cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new NotFoundError("Crop cycle", cycleId);
    const activity: FieldActivity = { ...input, id: newId("a") };
    cycle.activities.push(activity);
    cycle.activities.sort((a, b) => a.date.localeCompare(b.date));
    return { ...activity };
  });
}

export async function removeActivity(
  cycleId: ID,
  activityId: ID,
): Promise<void> {
  commit((db) => {
    const cycle = db.cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new NotFoundError("Crop cycle", cycleId);
    cycle.activities = cycle.activities.filter((a) => a.id !== activityId);
  });
}

/* -------------------------------------------------------- completion */

/** The one status transition a person makes by hand. */
export async function setCycleComplete(
  cycleId: ID,
  complete: boolean,
): Promise<CropCycle> {
  return commit((db) => {
    const cycle = db.cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new NotFoundError("Crop cycle", cycleId);
    cycle.completedAt = complete ? todayISO() : null;
    return { ...cycle };
  });
}

/* ---------------------------------------------------------- calendar */

export const CALENDAR_EVENT_TYPES = [
  "Planting",
  "Harvest",
  "Irrigation",
  "Fertilization",
  "Delivery",
  "Pickup",
] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export interface CalendarEvent {
  id: string;
  date: string;
  type: CalendarEventType;
  /** Null for Delivery and Pickup events, which belong to an order. */
  cycleId: ID | null;
  cycleCode: string;
  /** Order code on Delivery and Pickup events. */
  orderCode: string | null;
  /** Where clicking the event goes: the cycle or the order. */
  href: string;
  cropName: string;
  farmerName: string;
  plotName: string;
  /** Harvest: the picking. Delivery and Pickup: the order quantity. */
  quantityKg: number | null;
  note: string;
}

/**
 * Flattens every cycle into dated events.
 *
 * Each harvest-log entry becomes its own marker rather than one marker per
 * cycle, because a vegetable cycle is picked many times.
 */
export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  const db = getDb();
  const events: CalendarEvent[] = [];

  for (const cycle of db.cycles) {
    const view = decorate(cycle);
    const base = {
      cycleId: cycle.id,
      orderCode: null,
      href: `/cycles/${cycle.id}`,
      cycleCode: cycle.code,
      cropName: view.cropName,
      farmerName: view.farmerName,
      plotName: view.plotName,
    };

    events.push({
      ...base,
      id: `${cycle.id}-planting`,
      date: cycle.plantingDate,
      type: "Planting",
      quantityKg: null,
      note: `Planted ${view.cropName}`,
    });

    for (const entry of cycle.harvestLog) {
      events.push({
        ...base,
        id: entry.id,
        date: entry.date,
        type: "Harvest",
        quantityKg: entry.quantityKg,
        note: entry.note,
      });
    }

    for (const activity of cycle.activities) {
      events.push({
        ...base,
        id: activity.id,
        date: activity.date,
        type: activity.type,
        quantityKg: null,
        note: activity.note,
      });
    }
  }

  // Confirmed orders still to go out: one event on the delivery date, or on the
  // arranged pickup date once there is one.
  for (const order of db.orders) {
    if (order.status !== "Confirmed") continue;
    const buyer = db.buyers.find((b) => b.id === order.buyerId)?.name ?? "";
    const isPickup = order.method === "Pickup";
    const pickup = order.pickup;
    const date = isPickup ? (pickup?.date ?? order.deliveryDate) : order.deliveryDate;
    const detail = isPickup
      ? pickup?.state === "Arranged" && pickup.pointName
        ? `${pickup.pointName}, ${pickup.timeWindow}`
        : "Pickup not arranged yet"
      : (order.deliveryAddress ?? "");
    events.push({
      id: `order-${order.id}`,
      date,
      type: isPickup ? "Pickup" : "Delivery",
      cycleId: null,
      cycleCode: "",
      orderCode: order.code,
      href: `/orders/${order.id}`,
      cropName: order.cropName,
      farmerName: "",
      plotName: "",
      quantityKg: orderTotals(order).quantityKg,
      note: [buyer, detail].filter(Boolean).join(" · "),
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return delay(events);
}

/* --------------------------------------------------- supply forecast */

export type ForecastGranularity = "week" | "month";

export interface ForecastPeriod {
  key: string;
  label: string;
  start: string;
  end: string;
}

export interface ForecastCell {
  periodKey: string;
  expectedKg: number;
  cycleCount: number;
}

export interface ForecastRow {
  cropId: ID;
  cropName: string;
  cells: ForecastCell[];
  totalKg: number;
  cycleCount: number;
}

export interface SupplyForecast {
  granularity: ForecastGranularity;
  periods: ForecastPeriod[];
  rows: ForecastRow[];
  totalsByPeriod: Record<string, number>;
  grandTotalKg: number;
  /** Cycles counted — Growing and Ready to Harvest only. */
  activeCycleCount: number;
}

function startOfWeek(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

function periodFor(
  iso: string,
  granularity: ForecastGranularity,
): ForecastPeriod {
  if (granularity === "week") {
    const start = startOfWeek(iso);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const key = toISO(start);
    return {
      key,
      start: key,
      end: toISO(end),
      label: `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`,
    };
  }
  const d = new Date(`${iso}T00:00:00`);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return {
    key,
    start: toISO(start),
    end: toISO(end),
    label: start.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
  };
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Projects expected output for cycles that have not started producing yet,
 * so staff can answer "how much of this crop should be ready by <date>".
 */
export async function getSupplyForecast(
  granularity: ForecastGranularity = "week",
): Promise<SupplyForecast> {
  const db = getDb();
  const active = db.cycles.filter((c) =>
    isActiveStatus(cycleMetrics(c, db.orders).status),
  );

  const periodMap = new Map<string, ForecastPeriod>();
  const rowMap = new Map<
    ID,
    { cropName: string; cells: Map<string, ForecastCell>; total: number; cycles: number }
  >();

  for (const cycle of active) {
    const period = periodFor(cycle.expectedHarvestDate, granularity);
    periodMap.set(period.key, period);

    const crop = db.crops.find((c) => c.id === cycle.cropId);
    const cropName = crop?.name ?? "Unknown crop";
    let row = rowMap.get(cycle.cropId);
    if (!row) {
      row = { cropName, cells: new Map(), total: 0, cycles: 0 };
      rowMap.set(cycle.cropId, row);
    }
    const cell = row.cells.get(period.key) ?? {
      periodKey: period.key,
      expectedKg: 0,
      cycleCount: 0,
    };
    cell.expectedKg += cycle.expectedOutputKg;
    cell.cycleCount += 1;
    row.cells.set(period.key, cell);
    row.total += cycle.expectedOutputKg;
    row.cycles += 1;
  }

  const periods = [...periodMap.values()].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  const rows: ForecastRow[] = [...rowMap.entries()]
    .map(([cropId, row]) => ({
      cropId,
      cropName: row.cropName,
      cells: periods.map(
        (p) =>
          row.cells.get(p.key) ?? {
            periodKey: p.key,
            expectedKg: 0,
            cycleCount: 0,
          },
      ),
      totalKg: row.total,
      cycleCount: row.cycles,
    }))
    .sort((a, b) => b.totalKg - a.totalKg);

  const totalsByPeriod: Record<string, number> = {};
  for (const p of periods) {
    totalsByPeriod[p.key] = rows.reduce(
      (sum, r) => sum + (r.cells.find((c) => c.periodKey === p.key)?.expectedKg ?? 0),
      0,
    );
  }

  return delay({
    granularity,
    periods,
    rows,
    totalsByPeriod,
    grandTotalKg: rows.reduce((s, r) => s + r.totalKg, 0),
    activeCycleCount: active.length,
  });
}

export type { CycleStatus };
