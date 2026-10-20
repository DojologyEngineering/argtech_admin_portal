import { cn } from "cn";
import { statusLabel } from "@/lib/order-rules";
import type { DeliveryMethod, OrderStatus } from "@/lib/types";

/**
 * One badge component for every status vocabulary in the portal, so a status
 * always looks the same wherever it appears. Classes are written out in full
 * rather than composed, which keeps them visible to Tailwind's scanner.
 */

type Tone =
  | "green"
  | "amber"
  | "blue"
  | "violet"
  | "slate"
  | "rose"
  | "orange"
  | "sky"
  | "lime"
  | "teal"
  | "indigo"
  | "solid";

const TONE_CLASS: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  lime: "bg-lime-50 text-lime-800 dark:bg-lime-500/10 dark:text-lime-300",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  solid: "bg-emerald-700 text-white dark:bg-emerald-600 dark:text-white",
};

const DOT_CLASS: Record<Tone, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  slate: "bg-slate-400",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
  sky: "bg-sky-500",
  lime: "bg-lime-600",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  solid: "bg-emerald-200",
};

/**
 * Maps every known status value to a tone. Unknown values fall back to slate.
 * Order statuses are NOT here: they have their own map below so that a word shared
 * with another vocabulary ("Completed" is also a cycle status) can never borrow
 * the wrong colour.
 */
const STATUS_TONE: Record<string, Tone> = {
  // cycle status: lime, orange, teal and indigo, so none of them shares a colour
  // with an order status (amber, blue, green, dark green, red, grey)
  Growing: "lime",
  "Ready to Harvest": "orange",
  Harvesting: "teal",
  Completed: "indigo",
  // user status
  Active: "green",
  Inactive: "slate",
  // ownership
  Own: "green",
  Rent: "blue",
  // seasons
  "Wet Season": "sky",
  "Dry Season": "amber",
  // roles
  Admin: "violet",
  Manager: "blue",
  Staff: "slate",
  // buyer feedback reporting an issue that is not resolved
  Issue: "rose",
  // staff decision on a request
  "Can meet: Yes": "green",
  "Can meet: Partly": "amber",
  "Can meet: No": "rose",
  // pickup arrangement
  "Not arranged": "amber",
  Arranged: "blue",
  "Picked up": "green",
  // calendar event types
  Planting: "green",
  Harvest: "blue",
  Irrigation: "sky",
  Fertilization: "orange",
  Delivery: "violet",
  Pickup: "amber",
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status] ?? "slate";
}

/** Tint and text colour for a small rounded label of this kind of event. */
export function toneChipClass(status: string): string {
  return TONE_CLASS[statusTone(status)];
}

export function StatusBadge({
  status,
  dot = true,
  className,
}: {
  status: string;
  dot?: boolean;
  className?: string;
}) {
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[tone])}
        />
      ) : null}
      {status}
    </span>
  );
}

/** Small square colour swatch used by calendar and chart legends. */
export function ToneDot({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        DOT_CLASS[statusTone(status)],
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------ orders */

/**
 * Order and request statuses, same colours as the Buyer App and used the same
 * everywhere an order status appears. All six are distinct from each other.
 */
const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  Requested: "amber",
  Confirmed: "blue",
  Delivered: "green",
  Completed: "solid",
  Declined: "rose",
  Cancelled: "slate",
};

export function orderStatusTone(status: OrderStatus): Tone {
  return ORDER_STATUS_TONE[status];
}

/** A delivered pickup order reads "Picked up"; the stored status stays "Delivered". */
export function OrderStatusBadge({
  status,
  method,
  dot = true,
  className,
}: {
  status: OrderStatus;
  method?: DeliveryMethod;
  dot?: boolean;
  className?: string;
}) {
  const tone = ORDER_STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[tone])}
        />
      ) : null}
      {statusLabel(status, method)}
    </span>
  );
}
