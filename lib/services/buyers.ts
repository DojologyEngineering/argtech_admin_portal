/**
 * Buyer accounts.
 *
 * A buyer is created in the Buyer App; staff see them here with what each has
 * ordered and requested. Order and request figures are always derived from the
 * orders themselves, never stored on the buyer.
 */

import { commit, delay, getDb, newId, NotFoundError } from "../mock/store";
import { orderTotals, round } from "../derive";
import type { Buyer, BuyerAddress, ID, PurchaseOrder } from "../types";
import { listOrders, type PurchaseOrderView } from "./orders";

export interface BuyerInput {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  /** New addresses can leave `id` empty; the service assigns one. */
  addresses: Array<Omit<BuyerAddress, "id"> & { id?: ID }>;
}

export interface BuyerView extends Buyer {
  /** Orders that went ahead: Confirmed, Delivered or Completed (not cancelled). */
  orderCount: number;
  /** Requests still waiting for a reply (status Requested). */
  requestCount: number;
  /** Sum of the totals of those orders. */
  totalOrdered: number;
  lastOrderDate: string | null;
  /** Every order and request on record, including cancelled and declined. */
  recordCount: number;
}

const WENT_AHEAD = new Set(["Confirmed", "Delivered", "Completed"]);

function decorate(buyer: Buyer, orders: PurchaseOrder[]): BuyerView {
  const mine = orders.filter((o) => o.buyerId === buyer.id);
  const placed = mine.filter((o) => WENT_AHEAD.has(o.status));
  const dates = placed.map((o) => o.orderDate).sort();
  return {
    ...buyer,
    orderCount: placed.length,
    requestCount: mine.filter((o) => o.status === "Requested").length,
    totalOrdered: round(
      placed.reduce((sum, o) => sum + (orderTotals(o).totalPrice ?? 0), 0),
      2,
    ),
    lastOrderDate: dates.at(-1) ?? null,
    recordCount: mine.length,
  };
}

export async function listBuyerViews(): Promise<BuyerView[]> {
  const db = getDb();
  return delay(
    db.buyers
      .map((b) => decorate(b, db.orders))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export async function getBuyerView(id: ID): Promise<BuyerView> {
  const db = getDb();
  const buyer = db.buyers.find((b) => b.id === id);
  if (!buyer) throw new NotFoundError("Buyer", id);
  return delay(decorate(buyer, db.orders));
}

export interface BuyerActivity {
  /** Everything on the Orders page for this buyer, newest first. */
  orders: PurchaseOrderView[];
  /** Requested and Declined requests, newest first. */
  requests: PurchaseOrderView[];
}

export async function getBuyerActivity(id: ID): Promise<BuyerActivity> {
  const all = (await listOrders()).filter((o) => o.buyerId === id);
  const isRequest = (o: PurchaseOrderView) =>
    o.type === "Request" && (o.status === "Requested" || o.status === "Declined");
  return {
    orders: all.filter((o) => !isRequest(o)),
    requests: all.filter(isRequest),
  };
}

function clean(input: BuyerInput, excludeId?: ID): BuyerInput {
  const name = input.name.trim();
  if (!name) throw new Error("A buyer name is required.");
  const clash = getDb().buyers.some(
    (b) => b.id !== excludeId && b.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) throw new Error(`A buyer called "${name}" already exists.`);
  return {
    name,
    contactPerson: input.contactPerson.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    addresses: input.addresses
      .map((a) => ({
        ...a,
        label: a.label.trim(),
        line: a.line.trim(),
        district: a.district.trim(),
        city: a.city.trim(),
      }))
      .filter((a) => a.label || a.line || a.district || a.city),
  };
}

function withIds(addresses: BuyerInput["addresses"]): BuyerAddress[] {
  return addresses.map((a) => ({ ...a, id: a.id || newId("addr") }));
}

export async function createBuyer(input: BuyerInput): Promise<Buyer> {
  const data = clean(input);
  return commit((db) => {
    const buyer: Buyer = {
      id: newId("buyer"),
      ...data,
      addresses: withIds(data.addresses),
    };
    db.buyers.push(buyer);
    return { ...buyer };
  });
}

export async function updateBuyer(id: ID, input: BuyerInput): Promise<Buyer> {
  const data = clean(input, id);
  return commit((db) => {
    const buyer = db.buyers.find((b) => b.id === id);
    if (!buyer) throw new NotFoundError("Buyer", id);
    Object.assign(buyer, data, { addresses: withIds(data.addresses) });
    return { ...buyer };
  });
}

/** A buyer with any order or request on record cannot be removed. */
export async function deleteBuyer(id: ID): Promise<void> {
  commit((db) => {
    const records = db.orders.filter((o) => o.buyerId === id).length;
    if (records > 0) {
      throw new Error(
        `This buyer has ${records} order or request record${records === 1 ? "" : "s"}, so it cannot be deleted.`,
      );
    }
    db.buyers = db.buyers.filter((b) => b.id !== id);
  });
}
