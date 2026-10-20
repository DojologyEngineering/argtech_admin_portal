/**
 * Buyer price tiers.
 *
 * The price per kg a buyer pays depends on the *whole order quantity*: under
 * 200 kg, 200 to 999 kg, or 1,000 kg and above. The tier applies to every kilo
 * in the order, not just the kilos above the threshold.
 *
 * Copied from the Agent App's `BUYER_PRICE_TIERS` (and identical to the Buyer
 * App's catalog), keyed by the same crop ids. It only seeds each crop's
 * `buyerPrices`; after that the crop record is what is read and edited. This is
 * separate from a crop's break-even reference price.
 */
import type { BuyerPrices } from "./types";

export const TIER_LIMITS = { mid: 200, large: 1000 } as const;

export const BUYER_PRICE_TIERS: Record<string, readonly [number, number, number]> = {
  crop_tomato: [0.65, 0.6, 0.55],
  crop_cucumber: [0.5, 0.48, 0.45],
  crop_longbean: [0.75, 0.7, 0.65],
  crop_morningglory: [0.38, 0.35, 0.32],
  crop_chili: [1.3, 1.2, 1.1],
  crop_cabbage: [0.45, 0.42, 0.4],
  crop_eggplant: [0.6, 0.55, 0.5],
};

/**
 * Price per kg for a crop's own buyer prices at a total order quantity. The
 * crop record is the source of truth; `BUYER_PRICE_TIERS` above only seeds it.
 * Null when the crop has no prices set.
 */
export function tierPriceFromPrices(
  prices: BuyerPrices | null | undefined,
  totalKg: number,
): number | null {
  if (!prices) return null;
  const price =
    totalKg < TIER_LIMITS.mid
      ? prices.under200
      : totalKg < TIER_LIMITS.large
        ? prices.from200
        : prices.from1000;
  return price ?? null;
}
