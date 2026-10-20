/**
 * Pure derivation layer.
 *
 * Every figure a user sees about a crop cycle's supply and profitability is
 * computed here from the raw records. Nothing in this file reads or writes the
 * store, so the same functions serve the UI today and a backend later.
 */

import { tierPriceFromPrices } from "./pricing";
import type {
  BuyerPrices,
  CropCycle,
  CycleCosts,
  CycleStatus,
  ID,
  OrderLineItem,
  PurchaseOrder,
} from "./types";

/** Rounds to `dp` decimals, avoiding float dust like 0.30000000000000004. */
export function round(value: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function totalCost(costs: CycleCosts): number {
  return round(costs.seed + costs.fertilizer + costs.labor + costs.other);
}

/** Sum of every picking event logged against the cycle. */
export function harvestedKg(cycle: CropCycle): number {
  return round(cycle.harvestLog.reduce((sum, h) => sum + h.quantityKg, 0), 2);
}

/**
 * Every line item pointing at this cycle, across every order.
 *
 * This is what stops the same harvested kilos being committed twice: allocation
 * is never tracked on the cycle itself, it is always re-read from the full set
 * of orders, so a second order sees what the first one already took.
 */
export function lineItemsForCycle(
  cycleId: ID,
  orders: PurchaseOrder[],
): Array<{ order: PurchaseOrder; item: OrderLineItem }> {
  const out: Array<{ order: PurchaseOrder; item: OrderLineItem }> = [];
  for (const order of orders) {
    for (const item of order.lineItems) {
      if (item.cropCycleId === cycleId) out.push({ order, item });
    }
  }
  return out;
}

export function soldKg(cycleId: ID, orders: PurchaseOrder[]): number {
  return round(
    lineItemsForCycle(cycleId, orders).reduce(
      (sum, { item }) => sum + item.quantityKg,
      0,
    ),
    2,
  );
}

/** Revenue actually committed by buyers — quantity x price, per line item. */
export function revenue(cycleId: ID, orders: PurchaseOrder[]): number {
  return round(
    lineItemsForCycle(cycleId, orders).reduce(
      (sum, { item }) => sum + item.quantityKg * item.pricePerKg,
      0,
    ),
    2,
  );
}

/**
 * Status ladder. The first three stages are computed from the record itself so
 * they can never be stale; only "Completed" is a deliberate human action.
 */
export function cycleStatus(cycle: CropCycle, today = new Date()): CycleStatus {
  if (cycle.completedAt) return "Completed";
  if (cycle.harvestLog.length > 0) return "Harvesting";
  const expected = new Date(`${cycle.expectedHarvestDate}T00:00:00`);
  const midnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (!Number.isNaN(expected.getTime()) && midnight >= expected) {
    return "Ready to Harvest";
  }
  return "Growing";
}

/** A cycle still expected to produce — what the supply forecast projects from. */
export function isActiveStatus(status: CycleStatus): boolean {
  return status === "Growing" || status === "Ready to Harvest";
}

export interface CycleMetrics {
  status: CycleStatus;
  /** Sum of the harvest log. */
  harvestedKg: number;
  /** Sum of every order line item referencing this cycle. */
  soldKg: number;
  /** Harvested minus sold — what can still be allocated to a buyer. */
  availableKg: number;
  /** Same figure as availableKg, surfaced separately as a spoilage-risk signal. */
  unsoldSurplusKg: number;
  totalCost: number;
  revenue: number;
  /** Cost per kg actually sold. Null until the first kilo is committed. */
  breakEvenPricePerKg: number | null;
  /** (revenue - cost) / revenue, as a fraction. Null with no revenue yet. */
  margin: number | null;
  profit: number;
}

export function cycleMetrics(
  cycle: CropCycle,
  orders: PurchaseOrder[],
  today = new Date(),
): CycleMetrics {
  const harvested = harvestedKg(cycle);
  const sold = soldKg(cycle.id, orders);
  const available = cycle.stockClosed ? 0 : round(Math.max(0, harvested - sold), 2);
  const cost = totalCost(cycle.costs);
  const rev = revenue(cycle.id, orders);

  return {
    status: cycleStatus(cycle, today),
    harvestedKg: harvested,
    soldKg: sold,
    availableKg: available,
    unsoldSurplusKg: available,
    totalCost: cost,
    revenue: rev,
    breakEvenPricePerKg: sold > 0 ? round(cost / sold, 3) : null,
    margin: rev > 0 ? round((rev - cost) / rev, 4) : null,
    profit: round(rev - cost, 2),
  };
}

/* ------------------------------------------------ farmer-side economics */

export type EconomicsChip = "Above break-even" | "Thin margin" | "Below break-even";

export interface CycleEconomics {
  /** Expected output while the cycle runs, the actual harvest once it is completed. */
  basis: "Expected" | "Actual";
  basisKg: number;
  totalCost: number;
  /** Total cost (labour included) divided by the basis kg. Null without a quantity. */
  breakEvenPerKg: number | null;
  /** ARG TECH buyer price for the crop at this quantity (applies to the whole quantity). */
  tierPricePerKg: number | null;
  profitPerKg: number | null;
  /** Profit per kg as a fraction of the tier price. */
  margin: number | null;
  chip: EconomicsChip | null;
}

/** Profit per kg at or above this share of the tier price counts as a healthy margin. */
export const HEALTHY_MARGIN = 0.1;

/**
 * What the farmer can expect from a cycle: break-even = total cost ÷ expected kg,
 * set against the buyer tier price for that quantity. Nothing here is ARG TECH
 * revenue. Pure: reads no store.
 */
export function cycleEconomics(
  cycle: CropCycle,
  buyerPrices: BuyerPrices | null | undefined,
  status: CycleStatus,
): CycleEconomics {
  const harvested = harvestedKg(cycle);
  const useActual = status === "Completed" && harvested > 0;
  const basisKg = useActual ? harvested : cycle.expectedOutputKg > 0 ? cycle.expectedOutputKg : 0;
  const cost = totalCost(cycle.costs);

  const breakEvenPerKg = basisKg > 0 ? round(cost / basisKg, 4) : null;
  const tier = basisKg > 0 ? tierPriceFromPrices(buyerPrices, basisKg) : null;
  const profitPerKg =
    breakEvenPerKg !== null && tier !== null ? round(tier - breakEvenPerKg, 4) : null;
  const margin =
    profitPerKg !== null && tier !== null && tier > 0 ? round(profitPerKg / tier, 4) : null;
  const chip: EconomicsChip | null =
    profitPerKg === null || tier === null
      ? null
      : profitPerKg <= 0
        ? "Below break-even"
        : profitPerKg >= tier * HEALTHY_MARGIN
          ? "Above break-even"
          : "Thin margin";

  return {
    basis: useActual ? "Actual" : "Expected",
    basisKg,
    totalCost: cost,
    breakEvenPerKg,
    tierPricePerKg: tier,
    profitPerKg,
    margin,
    chip,
  };
}

/* ---------------------------------------------------------------- orders */

export function orderTotals(order: PurchaseOrder): {
  quantityKg: number;
  /** Null while no price has been agreed (an open or declined request). */
  totalPrice: number | null;
  lineCount: number;
} {
  // Orders that hold stock are always summed from their line items. Requested,
  // Declined and Cancelled orders have none, so they fall back to the
  // order-level quantity and price.
  if (order.lineItems.length > 0) {
    return {
      quantityKg: round(
        order.lineItems.reduce((s, i) => s + i.quantityKg, 0),
        2,
      ),
      totalPrice: round(
        order.lineItems.reduce((s, i) => s + i.quantityKg * i.pricePerKg, 0),
        2,
      ),
      lineCount: order.lineItems.length,
    };
  }
  const quantityKg = order.suppliedKg ?? order.requestedKg;
  return {
    quantityKg,
    totalPrice:
      order.pricePerKg === null ? null : round(quantityKg * order.pricePerKg, 2),
    lineCount: 0,
  };
}

/**
 * One price per kg for the whole order: the shared line price, or the average
 * when lines were priced differently (flagged so the UI can say so).
 */
export function orderPricePerKg(order: PurchaseOrder): {
  pricePerKg: number | null;
  mixed: boolean;
} {
  if (order.lineItems.length === 0) {
    return { pricePerKg: order.pricePerKg, mixed: false };
  }
  const first = order.lineItems[0]!.pricePerKg;
  if (order.lineItems.every((i) => i.pricePerKg === first)) {
    return { pricePerKg: first, mixed: false };
  }
  const { quantityKg, totalPrice } = orderTotals(order);
  return {
    pricePerKg: quantityKg > 0 ? round((totalPrice ?? 0) / quantityKg, 4) : null,
    mixed: true,
  };
}

/**
 * Available-to-sell for an in-progress allocation.
 *
 * When editing an existing order, that order's own line items must not count
 * against the cycle — otherwise re-opening an order would show its own
 * allocation as unavailable. `excludeOrderId` handles that case.
 */
export function availableForAllocation(
  cycle: CropCycle,
  orders: PurchaseOrder[],
  excludeOrderId?: ID,
): number {
  if (cycle.stockClosed) return 0;
  const relevant = excludeOrderId
    ? orders.filter((o) => o.id !== excludeOrderId)
    : orders;
  return round(Math.max(0, harvestedKg(cycle) - soldKg(cycle.id, relevant)), 2);
}
