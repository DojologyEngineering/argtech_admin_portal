/** Helpers for a crop's written specification and buyer prices. Pure functions. */

import type { BuyerPrices, CropSpec } from "./types";

export const EMPTY_SPEC: CropSpec = {
  ripeness: "",
  size: "",
  condition: "",
  bestUsedWithinDays: null,
  chips: [],
  buyerCanChoose: false,
  ripenessOptions: ["Standard"],
  sizeOptions: ["Standard"],
};

export const EMPTY_PRICES: BuyerPrices = {
  under200: null,
  from200: null,
  from1000: null,
};

/** True when ripeness, size, condition and best-used-within are all filled in. */
export function isSpecComplete(spec: CropSpec): boolean {
  return (
    spec.ripeness.trim() !== "" &&
    spec.size.trim() !== "" &&
    spec.condition.trim() !== "" &&
    spec.bestUsedWithinDays !== null &&
    spec.bestUsedWithinDays > 0
  );
}

/** The one line buyers see: "Firm, mostly red-ripe · Medium · No cracks, rot or bruising". */
export function specSummary(spec: Pick<CropSpec, "ripeness" | "size" | "condition">): string {
  return [spec.ripeness, spec.size, spec.condition]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

export function hasBuyerPrices(prices: BuyerPrices): boolean {
  return (
    prices.under200 !== null && prices.from200 !== null && prices.from1000 !== null
  );
}

/** "0.65 / 0.60 / 0.55", or an em dash when the prices are not set. */
export function buyerPricesLabel(prices: BuyerPrices): string {
  if (!hasBuyerPrices(prices)) return "—";
  return [prices.under200, prices.from200, prices.from1000]
    .map((p) => (p as number).toFixed(2))
    .join(" / ");
}
