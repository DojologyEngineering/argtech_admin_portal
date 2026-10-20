/**
 * Purchase orders and requests.
 *
 * An order is a buyer plus (once it holds stock) a list of line items, each
 * drawing from one crop cycle. Farmer / plot / crop are read through the cycle
 * reference and never duplicated onto the line item, and order totals are always
 * summed from the line items rather than entered.
 *
 * Requested, Declined and Cancelled orders hold no stock: they have no line
 * items, so nothing is taken out of a farmer's harvest for them.
 */

import {
  commit,
  delay,
  getDb,
  newId,
  nextCode,
  NotFoundError,
  type Db,
} from "../mock/store";
import { farmerName, prettyDate, todayISO } from "../format";
import { specSummary } from "../crop-spec";
import {
  availableForAllocation,
  cycleMetrics,
  harvestedKg,
  orderPricePerKg,
  orderTotals,
  round,
  soldKg,
} from "../derive";
import {
  canDelete,
  canMove,
  codeNumber,
  formatCode,
  statusLabel,
} from "../order-rules";
import { FEEDBACK_OUTCOME_LABEL } from "../types";
import type {
  Buyer,
  BuyerPrices,
  DeliveryMethod,
  FollowUpStatus,
  HandoverResult,
  ID,
  MeetDecision,
  OrderStatus,
  OrderType,
  PickupDetails,
  PurchaseOrder,
} from "../types";

export interface LineItemInput {
  cropCycleId: ID;
  quantityKg: number;
  pricePerKg: number;
}

export interface OrderDetailsInput {
  buyerId: ID;
  orderDate: string;
  /** Delivery date, pickup date, or the needed-by date. */
  deliveryDate: string;
  type: OrderType;
  method: DeliveryMethod;
  /** Used only for delivery orders; a pickup order has no address. */
  deliveryAddress: string;
  note: string;
}

export interface OrderInput extends OrderDetailsInput {
  lineItems: LineItemInput[];
}

export interface OrderLineView {
  id: ID;
  cropCycleId: ID;
  cycleCode: string;
  farmerName: string;
  plotName: string;
  cropName: string;
  cropVariety: string;
  quantityKg: number;
  pricePerKg: number;
  lineTotal: number;
  lotCode: string | null;
  handover: HandoverResult | null;
  /** What the cycle could still supply if this line were re-edited. */
  availableKg: number;
}

export interface PurchaseOrderView extends PurchaseOrder {
  buyerName: string;
  /** Supplied kg when matched, otherwise the requested kg. */
  totalQuantityKg: number;
  /** Null while no price has been agreed. */
  totalPrice: number | null;
  /** The price per kg for the whole order, or the average when lines differ. */
  displayPricePerKg: number | null;
  priceMixed: boolean;
  lineCount: number;
  farmerNames: string[];
  cropNames: string[];
  /** "Picked up" for a delivered pickup order, otherwise the stored status. */
  statusLabel: string;
  lines: OrderLineView[];
  /** Dated events for this order, newest first. */
  qualityLog: QualityLogEntry[];
}

export interface QualityLogEntry {
  id: string;
  /** yyyy-mm-dd */
  at: string;
  kind: "check" | "pickup" | "feedback" | "followup" | "note";
  text: string;
  /** Who wrote it, for staff notes. */
  by?: string;
}

/**
 * The quality log is built from records that already exist (handover checks,
 * the pickup arrangement, buyer feedback, staff follow-up). Only staff notes are
 * stored as log entries of their own.
 */
function buildQualityLog(order: PurchaseOrder, lines: OrderLineView[]): QualityLogEntry[] {
  const entries: QualityLogEntry[] = [];

  for (const line of lines) {
    const h = line.handover;
    if (!h) continue;
    entries.push({
      id: `check-${line.id}`,
      at: h.checkedAt,
      kind: "check",
      text: `Handover check saved by the agent for ${line.farmerName}: ${h.acceptedKg} kg accepted, ${h.rejectedKg} kg rejected.`,
    });
  }

  const pickup = order.pickup;
  if (pickup && pickup.sharedAt && pickup.state !== "Not arranged") {
    entries.push({
      id: "pickup",
      at: pickup.sharedAt,
      kind: "pickup",
      text: `Pickup arranged at ${pickup.pointName}${pickup.date ? ` on ${prettyDate(pickup.date)}` : ""}${pickup.timeWindow ? `, ${pickup.timeWindow}` : ""}.`,
    });
  }

  if (order.feedback) {
    const f = order.feedback;
    entries.push({
      id: "feedback",
      at: f.at,
      kind: "feedback",
      text: `Buyer feedback received: ${FEEDBACK_OUTCOME_LABEL[f.outcome]}${f.reasons.length ? ` (${f.reasons.join(", ")})` : ""}.`,
    });
  }

  if (order.followUp.updatedAt) {
    entries.push({
      id: "followup",
      at: order.followUp.updatedAt,
      kind: "followup",
      text: `Follow-up ${order.followUp.status.toLowerCase()}${order.followUp.note ? `: ${order.followUp.note}` : "."}`,
    });
  }

  for (const note of order.qualityNotes) {
    entries.push({ id: note.id, at: note.at, kind: "note", text: note.text, by: note.by });
  }

  // Oldest first (stable), then flipped, so the latest entry of a day is on top.
  return entries.sort((a, b) => a.at.localeCompare(b.at)).reverse();
}

function decorate(order: PurchaseOrder): PurchaseOrderView {
  const db = getDb();
  const buyer = db.buyers.find((b) => b.id === order.buyerId);
  const totals = orderTotals(order);
  const price = orderPricePerKg(order);

  const lines: OrderLineView[] = order.lineItems.map((item) => {
    const cycle = db.cycles.find((c) => c.id === item.cropCycleId);
    const farmer = cycle && db.farmers.find((f) => f.id === cycle.farmerId);
    const plot = cycle && db.plots.find((p) => p.id === cycle.plotId);
    const crop = cycle && db.crops.find((c) => c.id === cycle.cropId);
    return {
      id: item.id,
      cropCycleId: item.cropCycleId,
      cycleCode: cycle?.code ?? "—",
      farmerName: farmer ? farmerName(farmer) : "Unknown farmer",
      plotName: plot?.name ?? "Unknown plot",
      cropName: crop?.name ?? "Unknown crop",
      cropVariety: crop?.variety ?? "",
      quantityKg: item.quantityKg,
      pricePerKg: item.pricePerKg,
      lineTotal: round(item.quantityKg * item.pricePerKg),
      lotCode: item.lotCode ?? null,
      handover: item.handover ?? null,
      availableKg: cycle
        ? availableForAllocation(cycle, db.orders, order.id)
        : 0,
    };
  });

  const lineCrops = [...new Set(lines.map((l) => l.cropName))];

  return {
    ...order,
    buyerName: buyer?.name ?? "Unknown buyer",
    totalQuantityKg: totals.quantityKg,
    totalPrice: totals.totalPrice,
    displayPricePerKg: price.pricePerKg,
    priceMixed: price.mixed,
    lineCount: totals.lineCount,
    farmerNames: [...new Set(lines.map((l) => l.farmerName))],
    cropNames: lineCrops.length > 0 ? lineCrops : order.cropName ? [order.cropName] : [],
    statusLabel: statusLabel(order.status, order.method),
    lines,
    qualityLog: buildQualityLog(order, lines),
  };
}

export async function listOrders(): Promise<PurchaseOrderView[]> {
  const views = getDb()
    .orders.map(decorate)
    .sort(
      (a, b) =>
        b.orderDate.localeCompare(a.orderDate) ||
        codeNumber(b.code) - codeNumber(a.code),
    );
  return delay(views);
}

/** Requests staff still have to deal with: Requested or Declined. They live on the Requests page. */
export function isOpenRequest(order: Pick<PurchaseOrder, "type" | "status">): boolean {
  return (
    order.type === "Request" &&
    (order.status === "Requested" || order.status === "Declined")
  );
}

export async function listRequests(): Promise<PurchaseOrderView[]> {
  return delay(getDb().orders.filter(isOpenRequest).map(decorate));
}

/** How many requests are waiting for a reply (status Requested). */
export async function countRequestsWaiting(): Promise<number> {
  return delay(
    getDb().orders.filter((o) => o.type === "Request" && o.status === "Requested")
      .length,
    30,
  );
}

/**
 * Links a request for an "Other crop" to a catalog crop that has just been
 * added, so it can be confirmed like any other request.
 */
export async function linkCatalogCrop(id: ID, cropId: ID): Promise<PurchaseOrder> {
  return commit((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new NotFoundError("Purchase order", id);
    const crop = db.crops.find((c) => c.id === cropId);
    if (!crop) throw new NotFoundError("Crop", cropId);
    if (!order.notInCatalog) throw new Error("This request already uses a catalog crop.");
    order.cropId = crop.id;
    order.cropName = crop.name;
    order.notInCatalog = false;
    return { ...order };
  });
}

export async function getOrder(id: ID): Promise<PurchaseOrderView> {
  const order = getDb().orders.find((o) => o.id === id);
  if (!order) throw new NotFoundError("Purchase order", id);
  return delay(decorate(order));
}

/**
 * Rejects an allocation that would commit more than a cycle has harvested.
 * `excludeOrderId` lets an order being edited ignore its own existing lines.
 */
function assertAllocatable(
  lineItems: LineItemInput[],
  excludeOrderId?: ID,
): void {
  const db = getDb();
  if (lineItems.length === 0) {
    throw new Error("An order needs at least one line item.");
  }

  // Several lines can point at the same cycle, so check the combined draw.
  const byCycle = new Map<ID, number>();
  for (const item of lineItems) {
    if (item.quantityKg <= 0) {
      throw new Error("Every line item needs a quantity greater than zero.");
    }
    if (item.pricePerKg < 0) {
      throw new Error("Price per kg cannot be negative.");
    }
    byCycle.set(
      item.cropCycleId,
      (byCycle.get(item.cropCycleId) ?? 0) + item.quantityKg,
    );
  }

  for (const [cycleId, requested] of byCycle) {
    const cycle = db.cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new NotFoundError("Crop cycle", cycleId);
    const available = availableForAllocation(cycle, db.orders, excludeOrderId);
    if (requested > available + 1e-9) {
      throw new Error(
        `Cycle ${cycle.code} only has ${available} kg available, but ${requested} kg was allocated.`,
      );
    }
  }
}

/* ------------------------------------------------------------- helpers */

function emptyPickup(): PickupDetails {
  return {
    state: "Not arranged",
    pointId: null,
    instructions: "",
    sharedAt: null,
    pointName: "",
    district: "",
    landmark: "",
    mapUrl: "",
    date: null,
    timeWindow: "",
    collectorName: "",
    collectorPhone: "",
  };
}

/** A delivery order keeps its address; a pickup order has none and gets a pickup record. */
function applyMethod(
  order: PurchaseOrder,
  method: DeliveryMethod,
  deliveryAddress: string,
): void {
  order.method = method;
  if (method === "Delivery") {
    order.deliveryAddress = deliveryAddress.trim() || order.deliveryAddress || "";
    order.pickup = null;
  } else {
    order.deliveryAddress = null;
    order.pickup = order.pickup ?? emptyPickup();
  }
}

/** The crop specification line(s) for the crops behind these cycles, as written today. */
function specLine(db: Db, cycleIds: ID[]): string {
  const seen = new Set<ID>();
  const lines: string[] = [];
  for (const id of cycleIds) {
    const crop = db.crops.find(
      (c) => c.id === db.cycles.find((cy) => cy.id === id)?.cropId,
    );
    if (!crop || seen.has(crop.id)) continue;
    seen.add(crop.id);
    const line = specSummary(crop.spec);
    if (line) lines.push(seen.size > 1 || cycleIds.length > 1 ? `${crop.name}: ${line}` : line);
  }
  return lines.join(" | ");
}

/**
 * Code a request takes when it is confirmed: the same number under the PO-
 * prefix. If that number is somehow already used by another order (a number must
 * never exist under both prefixes) a fresh one is taken instead.
 */
function confirmedCode(db: Db, order: PurchaseOrder): string {
  const number = codeNumber(order.code);
  const taken = db.orders.some(
    (o) => o.id !== order.id && codeNumber(o.code) === number,
  );
  return taken
    ? nextCode("PO", db.orders.map((o) => o.code))
    : formatCode("PO", number);
}

/** Crop and quantity shown on an order that is built straight from farmer lines. */
function summariseLines(db: Db, lineItems: LineItemInput[]) {
  const names: string[] = [];
  let cropId: ID | null = null;
  for (const li of lineItems) {
    const cycle = db.cycles.find((c) => c.id === li.cropCycleId);
    const crop = cycle && db.crops.find((c) => c.id === cycle.cropId);
    if (crop && !names.includes(crop.name)) names.push(crop.name);
    if (cropId === null && crop) cropId = crop.id;
  }
  return {
    cropId,
    cropName: names.join(", "),
    kg: round(lineItems.reduce((s, l) => s + l.quantityKg, 0), 2),
  };
}

function toLines(lineItems: LineItemInput[]) {
  return lineItems.map((li) => ({
    id: newId("li"),
    cropCycleId: li.cropCycleId,
    quantityKg: li.quantityKg,
    pricePerKg: li.pricePerKg,
    handover: null,
  }));
}

/* ------------------------------------------------------------- writes */

/** Staff build an order straight from matched farmer supply, so it starts Confirmed. */
export async function createOrder(input: OrderInput): Promise<PurchaseOrder> {
  assertAllocatable(input.lineItems);
  return commit((db) => {
    const summary = summariseLines(db, input.lineItems);
    const order: PurchaseOrder = {
      id: newId("order"),
      // One sequence for REQ- and PO- codes: count every existing code.
      code: nextCode("PO", db.orders.map((o) => o.code)),
      requestedAs: null,
      buyerId: input.buyerId,
      orderDate: input.orderDate,
      deliveryDate: input.deliveryDate,
      type: input.type,
      method: input.method,
      status: "Confirmed",
      cropId: summary.cropId,
      cropName: summary.cropName,
      notInCatalog: false,
      requestedKg: summary.kg,
      suppliedKg: summary.kg,
      pricePerKg: null,
      deliveryAddress: null,
      pickup: null,
      requirements: "",
      requestedRipeness: "Standard",
      requestedSize: "Standard",
      meetCheck: { decision: "Not checked yet", note: "" },
      specSnapshot: specLine(db, input.lineItems.map((l) => l.cropCycleId)),
      feedback: null,
      followUp: { status: "Open", note: "", updatedAt: null },
      qualityNotes: [],
      declineReason: "",
      declinedAt: null,
      cancelReason: "",
      note: input.note,
      lineItems: toLines(input.lineItems),
      createdAt: todayISO(),
    };
    applyMethod(order, input.method, input.deliveryAddress);
    order.pricePerKg = orderPricePerKg(order).pricePerKg;
    db.orders.push(order);
    return { ...order };
  });
}

/**
 * Confirms a request by matching farmer stock to it. Its code changes from REQ-
 * to PO- with the same number (the original is kept in `requestedAs`), and it
 * may be confirmed for less than was asked.
 */
export async function confirmOrder(
  id: ID,
  lineItems: LineItemInput[],
): Promise<PurchaseOrder> {
  const current = getDb().orders.find((o) => o.id === id);
  if (!current) throw new NotFoundError("Purchase order", id);
  if (!canMove(current.status, "Confirmed")) {
    throw new Error(`${current.code} is ${current.status} and cannot be confirmed.`);
  }
  if (current.notInCatalog || !current.cropId) {
    throw new Error("This crop is not in the catalog, so there is no supply to match yet.");
  }
  assertAllocatable(lineItems);
  const wrongCrop = lineItems.some(
    (li) =>
      getDb().cycles.find((c) => c.id === li.cropCycleId)?.cropId !== current.cropId,
  );
  if (wrongCrop) {
    throw new Error(`Every line must supply ${current.cropName}.`);
  }

  return commit((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new NotFoundError("Purchase order", id);
    order.lineItems = toLines(lineItems);
    order.suppliedKg = round(lineItems.reduce((s, l) => s + l.quantityKg, 0), 2);
    order.pricePerKg = orderPricePerKg(order).pricePerKg;
    order.status = "Confirmed";
    if (!order.specSnapshot) {
      order.specSnapshot = specLine(db, lineItems.map((l) => l.cropCycleId));
    }
    if (order.code.startsWith("REQ-")) {
      order.requestedAs = order.requestedAs ?? order.code;
      order.code = confirmedCode(db, order);
    }
    return { ...order };
  });
}

/** Edit a confirmed order's buyer, dates, method or farmer lines. */
export async function updateOrder(
  id: ID,
  input: Partial<OrderDetailsInput> & { lineItems?: LineItemInput[] },
): Promise<PurchaseOrder> {
  const current = getDb().orders.find((o) => o.id === id);
  if (!current) throw new NotFoundError("Purchase order", id);
  if (current.status !== "Confirmed") {
    throw new Error("Only a confirmed order can be edited.");
  }
  if (input.lineItems) assertAllocatable(input.lineItems, id);
  return commit((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new NotFoundError("Purchase order", id);
    const { lineItems, method, deliveryAddress, type, ...rest } = input;
    Object.assign(order, rest);
    if (type) order.type = type;
    applyMethod(
      order,
      method ?? order.method,
      deliveryAddress ?? order.deliveryAddress ?? "",
    );
    if (lineItems) {
      order.lineItems = toLines(lineItems);
      order.suppliedKg = round(lineItems.reduce((s, l) => s + l.quantityKg, 0), 2);
      order.pricePerKg = orderPricePerKg(order).pricePerKg;
    }
    return { ...order };
  });
}

/**
 * Moves an order one step along the allowed flow. Backward moves and skipped
 * steps are refused here as well as hidden in the UI. Decline and cancel need a
 * reason. Confirming goes through `confirmOrder`, because it needs matched stock.
 */
export async function moveOrder(
  id: ID,
  to: OrderStatus,
  reason?: string,
): Promise<PurchaseOrder> {
  const current = getDb().orders.find((o) => o.id === id);
  if (!current) throw new NotFoundError("Purchase order", id);
  if (!canMove(current.status, to)) {
    throw new Error(`${current.code} is ${current.status} and cannot move to ${to}.`);
  }
  if (to === "Confirmed") {
    throw new Error("Confirm a request by matching farmers to it.");
  }
  if (to === "Declined" && current.type !== "Request") {
    throw new Error("Only requests can be declined.");
  }
  if (
    to === "Delivered" &&
    current.method === "Pickup" &&
    current.pickup?.state !== "Arranged"
  ) {
    throw new Error("Arrange the pickup (point, date and time window) before marking it picked up.");
  }
  const trimmed = reason?.trim() ?? "";
  if ((to === "Declined" || to === "Cancelled") && !trimmed) {
    throw new Error("A reason is required.");
  }

  return commit((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new NotFoundError("Purchase order", id);

    if (to === "Declined") {
      order.declineReason = trimmed;
      order.declinedAt = todayISO();
    }

    if (to === "Cancelled") {
      order.cancelReason = trimmed;
      // Keep what had been agreed for the record, but release the farmers' stock.
      if (order.lineItems.length > 0) {
        order.suppliedKg = orderTotals(order).quantityKg;
        order.pricePerKg = orderPricePerKg(order).pricePerKg;
        order.lineItems = [];
      }
    }

    if (to === "Delivered" && order.pickup) {
      order.pickup = {
        ...order.pickup,
        state: "Picked up",
        date: order.pickup.date ?? todayISO(),
      };
    }

    order.status = to;
    return { ...order };
  });
}

/* ------------------------------------------------- pickup arrangement */

export interface PickupArrangementInput {
  pointId: ID;
  date: string;
  /** 24-hour "HH:MM" from a time input. */
  startTime: string;
  endTime: string;
  collectorName: string;
  collectorPhone: string;
  instructions: string;
}

/** "08:00" -> "8:00", the way the Buyer App writes a time window. */
function shortTime(time: string): string {
  const [h = "", m = ""] = time.split(":");
  return `${Number(h)}:${m}`;
}

/**
 * Saves the pickup arrangement and shares it with the buyer app: the order's
 * pickup becomes Arranged. Can be saved again while the order is Confirmed.
 */
export async function arrangePickup(
  id: ID,
  input: PickupArrangementInput,
): Promise<PurchaseOrder> {
  const current = getDb().orders.find((o) => o.id === id);
  if (!current) throw new NotFoundError("Purchase order", id);
  if (current.method !== "Pickup" || !current.pickup) {
    throw new Error("Only pickup orders have a pickup arrangement.");
  }
  if (current.status !== "Confirmed") {
    throw new Error("The pickup can only be arranged while the order is Confirmed.");
  }
  const point = getDb().pickupPoints.find((p) => p.id === input.pointId);
  if (!point) throw new Error("Choose a pickup point.");
  if (!point.active && point.id !== current.pickup.pointId) {
    throw new Error("That pickup point is inactive. Choose an active one.");
  }
  if (!input.date) throw new Error("Choose a pickup date.");
  if (!input.startTime || !input.endTime) throw new Error("Enter a time window.");
  if (input.startTime >= input.endTime) {
    throw new Error("The time window must end after it starts.");
  }

  return commit((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order || !order.pickup) throw new NotFoundError("Purchase order", id);
    order.pickup = {
      state: "Arranged",
      pointId: point.id,
      pointName: point.name,
      district: point.district,
      landmark: point.landmark,
      mapUrl: point.mapUrl,
      date: input.date,
      timeWindow: `${shortTime(input.startTime)} to ${shortTime(input.endTime)}`,
      collectorName: input.collectorName.trim(),
      collectorPhone: input.collectorPhone.trim(),
      instructions: input.instructions.trim(),
      sharedAt: todayISO(),
    };
    // The order's date follows the arranged pickup date.
    order.deliveryDate = input.date;
    return { ...order };
  });
}

/* ----------------------------------------------- buyer feedback follow-up */

/** Staff follow-up on feedback that reports an issue. */
export async function saveFollowUp(
  id: ID,
  status: FollowUpStatus,
  note: string,
): Promise<PurchaseOrder> {
  return commit((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new NotFoundError("Purchase order", id);
    if (order.feedback?.outcome !== "issue") {
      throw new Error("Only feedback that reports an issue has a follow-up.");
    }
    order.followUp = { status, note: note.trim(), updatedAt: todayISO() };
    return { ...order };
  });
}

/** A free-text staff note in the quality log. */
export async function addQualityNote(
  id: ID,
  text: string,
  by: string,
): Promise<PurchaseOrder> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Write a note first.");
  return commit((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new NotFoundError("Purchase order", id);
    order.qualityNotes.push({
      id: newId("qnote"),
      at: todayISO(),
      by: by || "Staff",
      text: trimmed,
    });
    return { ...order };
  });
}

/** True when buyer feedback reports an issue that staff have not resolved. */
export function hasOpenIssue(
  order: Pick<PurchaseOrder, "feedback" | "followUp">,
): boolean {
  return order.feedback?.outcome === "issue" && order.followUp.status !== "Resolved";
}

/* ------------------------------------------------------ request check */

/** Staff note on whether a request can be met. Guidance only: it never blocks Confirm or Decline. */
export async function setMeetCheck(
  id: ID,
  decision: MeetDecision,
  note: string,
): Promise<PurchaseOrder> {
  return commit((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new NotFoundError("Purchase order", id);
    order.meetCheck = { decision, note: note.trim() };
    return { ...order };
  });
}

export interface RequestCheckField {
  standard: string;
  /** What the buyer chose; "Standard" or empty means the crop's specification. */
  choice: string;
  matches: boolean;
}

export interface RequestCheck {
  /** False for an "Other crop" request, or a catalog crop with no specification yet. */
  hasStandard: boolean;
  cropName: string;
  /** The buyer's own words, shown for an "Other crop" request. */
  buyerText: string;
  ripeness: RequestCheckField;
  size: RequestCheckField;
  /** Null when the crop is not in the catalog, so there is no stock to count. */
  supply: {
    requestedKg: number;
    inStockKg: number;
    dueKg: number;
    dueCycleCount: number;
    totalKg: number;
    enough: boolean;
    shortKg: number;
    neededBy: string;
  } | null;
}

function fieldCheck(standard: string, choice: string): RequestCheckField {
  const wanted = choice.trim();
  const matches =
    wanted === "" ||
    wanted.toLowerCase() === "standard" ||
    wanted.toLowerCase() === standard.trim().toLowerCase();
  return { standard, choice: wanted, matches };
}

/**
 * Compares a request with the crop's standard and with the stock available:
 * harvested stock not yet sold, plus cycles still to be picked whose expected
 * harvest falls on or before the needed-by date.
 */
export async function getRequestCheck(id: ID): Promise<RequestCheck> {
  const db = getDb();
  const order = db.orders.find((o) => o.id === id);
  if (!order) throw new NotFoundError("Purchase order", id);
  const crop = order.cropId ? db.crops.find((c) => c.id === order.cropId) : undefined;

  const base = {
    cropName: order.cropName,
    buyerText: order.requirements,
  };

  if (!crop) {
    return delay({
      ...base,
      hasStandard: false,
      ripeness: fieldCheck("", ""),
      size: fieldCheck("", ""),
      supply: null,
    });
  }

  let inStockKg = 0;
  let dueKg = 0;
  let dueCycleCount = 0;
  for (const cycle of db.cycles) {
    if (cycle.cropId !== crop.id) continue;
    inStockKg += availableForAllocation(cycle, db.orders);
    const notPickedYet = !cycle.completedAt && cycle.harvestLog.length === 0;
    if (notPickedYet && cycle.expectedHarvestDate <= order.deliveryDate) {
      dueKg += cycle.expectedOutputKg;
      dueCycleCount += 1;
    }
  }
  inStockKg = round(inStockKg, 2);
  dueKg = round(dueKg, 2);
  const totalKg = round(inStockKg + dueKg, 2);

  return delay({
    ...base,
    hasStandard: Boolean(crop.spec.ripeness.trim() && crop.spec.size.trim()),
    ripeness: fieldCheck(crop.spec.ripeness, order.requestedRipeness),
    size: fieldCheck(crop.spec.size, order.requestedSize),
    supply: {
      requestedKg: order.requestedKg,
      inStockKg,
      dueKg,
      dueCycleCount,
      totalKg,
      enough: totalKg >= order.requestedKg,
      shortKg: round(Math.max(0, order.requestedKg - totalKg), 2),
      neededBy: order.deliveryDate,
    },
  });
}

/** Only Declined and Cancelled orders can be removed. */
export async function deleteOrder(id: ID): Promise<void> {
  const current = getDb().orders.find((o) => o.id === id);
  if (!current) throw new NotFoundError("Purchase order", id);
  if (!canDelete(current.status)) {
    throw new Error("Only declined or cancelled orders can be deleted.");
  }
  commit((db) => {
    db.orders = db.orders.filter((o) => o.id !== id);
  });
}

/* ------------------------------------------------------------- buyers */

export async function listBuyers(): Promise<Buyer[]> {
  return delay([...getDb().buyers].sort((a, b) => a.name.localeCompare(b.name)));
}

/** Finds a buyer by name or creates one — backs the "type to create" control. */
export async function findOrCreateBuyer(name: string): Promise<Buyer> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A buyer name is required.");
  return commit((db) => {
    const existing = db.buyers.find(
      (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return { ...existing };
    const buyer: Buyer = {
      id: newId("buyer"),
      name: trimmed,
      contactPerson: "",
      phone: "",
      email: "",
      addresses: [],
    };
    db.buyers.push(buyer);
    return { ...buyer };
  });
}

/* ---------------------------------------------------- supply matching */

export interface SupplyCandidate {
  cycleId: ID;
  cycleCode: string;
  farmerId: ID;
  farmerName: string;
  plotId: ID;
  plotName: string;
  province: string;
  cropId: ID;
  cropName: string;
  cropVariety: string;
  /** The crop's buyer price tiers, the default for line prices. */
  buyerPrices: BuyerPrices;
  harvestedKg: number;
  soldKg: number;
  availableKg: number;
  lastHarvestDate: string | null;
  status: string;
}

/**
 * Every crop cycle growing `cropId` with stock left to sell, across all farmers.
 *
 * This is the list the Supply Matching screen allocates from. Availability is
 * computed against every existing order, so a cycle already drawn on by another
 * order shows only what is genuinely left.
 */
export async function listSupplyCandidates(
  cropId: ID | null,
  excludeOrderId?: ID,
): Promise<SupplyCandidate[]> {
  const db = getDb();
  const candidates: SupplyCandidate[] = [];

  for (const cycle of db.cycles) {
    if (cropId && cycle.cropId !== cropId) continue;
    const available = availableForAllocation(cycle, db.orders, excludeOrderId);
    if (available <= 0) continue;

    const farmer = db.farmers.find((f) => f.id === cycle.farmerId);
    const plot = db.plots.find((p) => p.id === cycle.plotId);
    const crop = db.crops.find((c) => c.id === cycle.cropId);
    const lastHarvest = cycle.harvestLog.at(-1)?.date ?? null;

    candidates.push({
      cycleId: cycle.id,
      cycleCode: cycle.code,
      farmerId: cycle.farmerId,
      farmerName: farmer ? farmerName(farmer) : "Unknown farmer",
      plotId: cycle.plotId,
      plotName: plot?.name ?? "Unknown plot",
      province: plot?.province ?? "",
      cropId: cycle.cropId,
      cropName: crop?.name ?? "Unknown crop",
      cropVariety: crop?.variety ?? "",
      buyerPrices: crop?.buyerPrices ?? { under200: null, from200: null, from1000: null },
      harvestedKg: harvestedKg(cycle),
      soldKg: soldKg(cycle.id, db.orders),
      availableKg: available,
      lastHarvestDate: lastHarvest,
      status: cycleMetrics(cycle, db.orders).status,
    });
  }

  candidates.sort(
    (a, b) => b.availableKg - a.availableKg || a.farmerName.localeCompare(b.farmerName),
  );
  return delay(candidates);
}

/** Crops that currently have any sellable stock, for the matching dropdown. */
export async function listCropsWithSupply(): Promise<
  Array<{ cropId: ID; cropName: string; availableKg: number; farmerCount: number }>
> {
  const db = getDb();
  const map = new Map<ID, { cropName: string; availableKg: number; farmers: Set<ID> }>();

  for (const cycle of db.cycles) {
    const available = availableForAllocation(cycle, db.orders);
    if (available <= 0) continue;
    const crop = db.crops.find((c) => c.id === cycle.cropId);
    const entry = map.get(cycle.cropId) ?? {
      cropName: crop?.name ?? "Unknown crop",
      availableKg: 0,
      farmers: new Set<ID>(),
    };
    entry.availableKg = round(entry.availableKg + available);
    entry.farmers.add(cycle.farmerId);
    map.set(cycle.cropId, entry);
  }

  return delay(
    [...map.entries()]
      .map(([cropId, e]) => ({
        cropId,
        cropName: e.cropName,
        availableKg: e.availableKg,
        farmerCount: e.farmers.size,
      }))
      .sort((a, b) => b.availableKg - a.availableKg),
  );
}

/* ----------------------------------------------- cycle-centric lookups */

export interface CycleAllocation {
  orderId: ID;
  orderCode: string;
  buyerName: string;
  orderDate: string;
  status: OrderStatus;
  method: DeliveryMethod;
  quantityKg: number;
  pricePerKg: number;
  lineTotal: number;
}

/**
 * Every order line item drawing on one cycle.
 *
 * The cycle detail screen uses this to show exactly where its harvest went,
 * which is what makes "sold so far" auditable rather than just a number.
 */
export async function listAllocationsForCycle(
  cycleId: ID,
): Promise<CycleAllocation[]> {
  const db = getDb();
  const rows: CycleAllocation[] = [];

  for (const order of db.orders) {
    for (const item of order.lineItems) {
      if (item.cropCycleId !== cycleId) continue;
      rows.push({
        orderId: order.id,
        orderCode: order.code,
        buyerName: db.buyers.find((b) => b.id === order.buyerId)?.name ?? "—",
        orderDate: order.orderDate,
        status: order.status,
        method: order.method,
        quantityKg: item.quantityKg,
        pricePerKg: item.pricePerKg,
        lineTotal: round(item.quantityKg * item.pricePerKg),
      });
    }
  }

  rows.sort((a, b) => a.orderDate.localeCompare(b.orderDate));
  return delay(rows);
}
