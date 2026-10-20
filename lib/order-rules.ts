/**
 * Order status rules shared by the list, the detail page and the service layer.
 *
 * Pure functions only: nothing here reads or writes the store.
 */

import type { DeliveryMethod, OrderStatus, OrderType } from "./types";

/**
 * Allowed moves. There is no way back and no skipping a step:
 * Requested -> Confirmed -> Delivered (Picked up) -> Completed, with Declined
 * possible from Requested and Cancelled from Requested or Confirmed.
 */
export const ALLOWED_MOVES: Record<OrderStatus, readonly OrderStatus[]> = {
  Requested: ["Confirmed", "Declined", "Cancelled"],
  Confirmed: ["Delivered", "Cancelled"],
  Delivered: ["Completed"],
  Completed: [],
  Declined: [],
  Cancelled: [],
};

export function canMove(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_MOVES[from].includes(to);
}

/** The single forward step the primary action button performs, if any. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  if (status === "Requested") return "Confirmed";
  if (status === "Confirmed") return "Delivered";
  if (status === "Delivered") return "Completed";
  return null;
}

export function canDecline(order: { status: OrderStatus; type: OrderType }): boolean {
  return order.type === "Request" && canMove(order.status, "Declined");
}

export function canCancel(status: OrderStatus): boolean {
  return canMove(status, "Cancelled");
}

/** Only orders that never went ahead can be removed. */
export function canDelete(status: OrderStatus): boolean {
  return status === "Declined" || status === "Cancelled";
}

/** A delivered pickup order reads "Picked up"; the stored value stays "Delivered". */
export function statusLabel(status: OrderStatus, method?: DeliveryMethod): string {
  return status === "Delivered" && method === "Pickup" ? "Picked up" : status;
}

export function formatCode(prefix: "REQ" | "PO", number: number): string {
  return `${prefix}-${String(number).padStart(4, "0")}`;
}

/** Trailing number of a code like REQ-0010. */
export function codeNumber(code: string): number {
  const match = code.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

/** What the order's date means, for column and field labels. */
export function dateLabel(order: {
  type: OrderType;
  method: DeliveryMethod;
  status: OrderStatus;
}): string {
  if (order.status === "Requested" || order.status === "Declined") return "Needed by";
  return order.method === "Pickup" ? "Pickup date" : "Delivery date";
}
