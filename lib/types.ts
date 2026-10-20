/**
 * Domain model for the ARG TECH admin portal.
 *
 * Everything here is transport-agnostic: the same shapes are returned today by
 * the mock store in `lib/mock/store.ts` and, later, by real API endpoints.
 * Derived values (available-to-sell, break-even, cycle status) are deliberately
 * NOT stored — see `lib/derive.ts` — so they can never drift out of sync.
 */

export type ID = string;

/* ------------------------------------------------------------------ users */

export const USER_ROLES = ["Admin", "Manager", "Staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["Active", "Inactive"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface AppUser {
  id: ID;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string; // ISO date (yyyy-mm-dd)
}

/* ---------------------------------------------------------------- farmers */

export const GENDERS = ["Male", "Female", "Other"] as const;
export type Gender = (typeof GENDERS)[number];

/** Same list as the Agent App, which is the source of truth for farmer records. */
export const EDUCATION_LEVELS = [
  "No formal schooling",
  "Primary school",
  "Grade 9",
  "Grade 12",
  "Vocational training",
  "University",
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const CERTIFICATE_TYPES = ["GAP", "Organic", "Other"] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

/**
 * What buyers can see of a certificate, with the Buyer App's three settings
 * (`hidden`, `details`, `details_and_image`) written the way staff read them.
 */
export const CERTIFICATE_SHARING = ["Hidden", "Details only", "Details and image"] as const;
export type CertificateSharing = (typeof CERTIFICATE_SHARING)[number];

/** Shown to buyers under the setting. Fixed wording shared with the Buyer App. */
export const CERTIFICATE_CAPTION =
  "Document provided by the farmer and seen by an ARG TECH field agent.";

export interface Certificate {
  id: ID;
  /** Kind of certificate, as recorded by the field agent. */
  type: CertificateType;
  /** Display name, e.g. "Good Agricultural Practices (GAP)". */
  name: string;
  issuer: string;
  /** What the certificate covers, e.g. "Tomato production". */
  scope: string;
  /** The Agent App does not record an issue date, so it can be empty. */
  issuedDate: string | null;
  expiryDate: string | null;
  note?: string;
  /** What buyers can see. Hidden until staff choose otherwise. */
  sharing: CertificateSharing;
  /** The farmer's crop cycles this certificate applies to, so buyers see it on those lots. */
  appliesTo: ID[];
  /** Crops from the catalog this certificate covers (optional guidance for choosing cycles). */
  coversCropIds: ID[];
  /** The agent's photo of the original. Staff only; buyers never see it. */
  originalImage: string | null;
  /** A copy with personal details hidden, prepared by staff. Small data URL in this phase. */
  safeImage: string | null;
  /** Buyers only ever see the safe image, and only once it is approved. */
  safeImageApproved: boolean;
}

export interface Farmer {
  id: ID;
  firstName: string;
  lastName: string;
  gender: Gender | null;
  dateOfBirth: string;
  educationLevel: EducationLevel | null;
  primaryPhone: string;
  secondaryPhone: string;
  province: string;
  district: string;
  commune: string;
  village: string;
  /** Object URLs / data URLs in this phase; file storage keys once a backend exists. */
  profilePhotoUrl: string | null;
  nationalIdUrl: string | null;
  additionalPhotoUrl: string | null;
  remark: string;
  certificates: Certificate[];
  createdAt: string;
}

/* ------------------------------------------------------------------ plots */

export const OWNERSHIP_TYPES = ["Own", "Rent"] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

/** [latitude, longitude] — the order Leaflet uses. */
export type LatLng = [number, number];

/**
 * How a plot's area was established. A plot has exactly one source of truth for
 * its area, never two competing ones: tracing a boundary sets `polygon`, and the
 * manual length x width fallback sets `manual`. `areaHectares` is written from
 * whichever source is active.
 */
export type AreaSource = "polygon" | "manual";

export interface Plot {
  id: ID;
  name: string;
  farmerId: ID;
  ownershipType: OwnershipType;
  province: string;
  district: string;
  commune: string;
  village: string;
  latitude: number | null;
  longitude: number | null;
  areaSource: AreaSource;
  /** Traced boundary ring, only meaningful when areaSource === "polygon". */
  boundary: LatLng[] | null;
  /** Manual fallback dimensions, only meaningful when areaSource === "manual". */
  manualLengthM: number | null;
  manualWidthM: number | null;
  /** Single derived area figure the rest of the app reads. */
  areaHectares: number;
  soilType: string;
  irrigationType: string;
  infrastructure: string;
  remark: string;
  createdAt: string;
}

/* -------------------------------------------------------- crop catalogue */

export const SEASONS = ["Wet Season", "Dry Season"] as const;
export type Season = (typeof SEASONS)[number];

/**
 * Written specification buyers see for a crop. Wording rule (shared with the
 * Buyer App): "checked by our agent at handover", never a lab claim or a promise.
 */
export interface CropSpec {
  ripeness: string;
  size: string;
  /** Fixed: buyers cannot lower it. */
  condition: string;
  /** Null until set. */
  bestUsedWithinDays: number | null;
  /** Up to four short labels shown on the buyer's crop card. */
  chips: string[];
  /** Whether buyers may pick a ripeness or size on a request. */
  buyerCanChoose: boolean;
  /** Request options. "Standard" is always first; one entry means no dropdown. */
  ripenessOptions: string[];
  sizeOptions: string[];
}

export const MAX_SPEC_CHIPS = 4;
export const STANDARD_OPTION = "Standard";

/** Buyer price per kg by whole order quantity. Null until set. */
export interface BuyerPrices {
  /** Under 200 kg. */
  under200: number | null;
  /** 200 to 999 kg. */
  from200: number | null;
  /** 1,000 kg and above. */
  from1000: number | null;
}

export interface Crop {
  id: ID;
  name: string;
  variety: string;
  season: Season;
  seedSource: string;
  daysToHarvest: number;
  note: string;
  spec: CropSpec;
  buyerPrices: BuyerPrices;
}

/* ------------------------------------------------------------ crop cycles */

export const CYCLE_STATUSES = [
  "Growing",
  "Ready to Harvest",
  "Harvesting",
  "Completed",
] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

/** One picking event. Records only what came off the plot — never a price. */
export interface HarvestEntry {
  id: ID;
  date: string;
  quantityKg: number;
  note: string;
}

export const ACTIVITY_TYPES = ["Irrigation", "Fertilization"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface FieldActivity {
  id: ID;
  type: ActivityType;
  date: string;
  note: string;
}

export interface CycleCosts {
  seed: number;
  fertilizer: number;
  labor: number;
  other: number;
}

/** How the crop was grown, as recorded by the field agent. Read-only in the portal. */
export interface ProductionDetails {
  /** Conventional, Organic, GAP or Mixed. */
  method: string | null;
  deliveryFrequency: string | null;
  /** Chemical, Urea, NPK, Organic, Compost, Manure, Mixed or None. */
  fertilizerType: string | null;
  /** Not used, Used or Not sure. */
  pesticideUsed: string | null;
  pesticideDetails: string;
  notes: string;
}

export const EMPTY_PRODUCTION: ProductionDetails = {
  method: null,
  deliveryFrequency: null,
  fertilizerType: null,
  pesticideUsed: null,
  pesticideDetails: "",
  notes: "",
};

export interface CropCycle {
  id: ID;
  code: string;
  farmerId: ID;
  plotId: ID;
  cropId: ID;
  plantingDate: string;
  /** Seeded from the crop's daysToHarvest, then editable. */
  expectedHarvestDate: string;
  expectedOutputKg: number;
  costs: CycleCosts;
  harvestLog: HarvestEntry[];
  activities: FieldActivity[];
  /** Set only when someone taps "Mark cycle complete"; drives the final status. */
  completedAt: string | null;
  remark: string;
  production: ProductionDetails;
  /**
   * True when the cycle was completed and its unsold balance closed out (sold at
   * market or written off), so it offers no stock to orders. Used by the sample
   * history that fills the Harvest Overview chart.
   */
  stockClosed: boolean;
  createdAt: string;
}

/* -------------------------------------------------------- purchase orders */

/** A saved delivery address, shaped like the Buyer App's address book. */
export interface BuyerAddress {
  id: ID;
  /** e.g. "Main store". */
  label: string;
  line: string;
  district: string;
  city: string;
}

export interface Buyer {
  id: ID;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  addresses: BuyerAddress[];
}

/**
 * One status field for every order and request, with the same six values as the
 * Buyer and Agent apps. A Delivered pickup order is *shown* as "Picked up" (see
 * `statusLabel` in `lib/order-rules.ts`); the stored value stays "Delivered".
 */
export const ORDER_STATUSES = [
  "Requested",
  "Confirmed",
  "Delivered",
  "Completed",
  "Declined",
  "Cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** "Order now" draws on stock available today; a "Request" is for a future date. */
export const ORDER_TYPES = ["Order now", "Request"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const DELIVERY_METHODS = ["Delivery", "Pickup"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const PICKUP_STATES = ["Not arranged", "Arranged", "Picked up"] as const;
export type PickupState = (typeof PICKUP_STATES)[number];

/**
 * Pickup arrangements on a pickup order. Data only in this phase: there is no
 * arrangement screen yet. A pickup point is always a meeting point, never a farm.
 */
export interface PickupDetails {
  state: PickupState;
  /** The pickup point chosen, copied below so the arrangement keeps its wording. */
  pointId: ID | null;
  pointName: string;
  district: string;
  landmark: string;
  mapUrl: string;
  /** Arranged pickup date. Empty until arranged (the buyer's wished date is the order date). */
  date: string | null;
  /** e.g. "8:00 to 10:00". */
  timeWindow: string;
  collectorName: string;
  collectorPhone: string;
  instructions: string;
  /** When the arrangement was last shared with the buyer app. */
  sharedAt: string | null;
}

/**
 * A public meeting point staff choose for pickup orders: a market or roadside
 * spot, never a farm. Farmers stay anonymous to buyers.
 */
export interface PickupPoint {
  id: ID;
  name: string;
  district: string;
  landmark: string;
  mapUrl: string;
  active: boolean;
}

export const PICKUP_DISTRICTS = ["Kang Meas", "Srey Santhor", "Kampong Siem"] as const;

/** Staff guidance on whether a request can be met. It never blocks Confirm or Decline. */
export const MEET_DECISIONS = ["Not checked yet", "Yes", "Partly", "No"] as const;
export type MeetDecision = (typeof MEET_DECISIONS)[number];

export interface MeetCheck {
  decision: MeetDecision;
  note: string;
}

/** The agent's check of one farmer's produce at handover, read-only in the portal. */
export const REJECT_REASONS = [
  "Too ripe",
  "Not ripe enough",
  "Cracks or damage",
  "Wrong size",
  "Other",
] as const;

export interface HandoverResult {
  receivedKg: number;
  acceptedKg: number;
  /** Received minus accepted. */
  rejectedKg: number;
  /** One of REJECT_REASONS, or empty when nothing was rejected. */
  rejectReason: string;
  /** Up to two photos taken at the check. */
  photos: string[];
  note: string;
  /** Pickup orders only: was the buyer's representative there? */
  buyerRepPresent: boolean | null;
  /** Pickup orders only: did the representative match the order? */
  repMatchesOrder: boolean | null;
  checkedAt: string;
}

/** The Buyer App's feedback options and reasons, copied as they are written there. */
export const FEEDBACK_REASONS = [
  "Too ripe",
  "Not ripe enough",
  "Cracks or damage",
  "Wrong size",
  "Short quantity",
  "Other",
] as const;

export type FeedbackOutcome = "as_expected" | "issue";

export const FEEDBACK_OUTCOME_LABEL: Record<FeedbackOutcome, string> = {
  as_expected: "As expected",
  issue: "Had an issue",
};

/** What the buyer answered to "How was the produce?" in the Buyer App. */
export interface OrderFeedback {
  outcome: FeedbackOutcome;
  reasons: string[];
  note: string;
  /** Lot codes of the order, so staff can link the answer to the produce. */
  lotCodes: string[];
  at: string;
}

export const FOLLOW_UP_STATUSES = ["Open", "In progress", "Resolved"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

/** Staff follow-up on feedback that reports an issue. */
export interface FollowUp {
  status: FollowUpStatus;
  note: string;
  /** When staff last saved it. Null if never. */
  updatedAt: string | null;
}

/** A free-text note staff add to an order's quality log. */
export interface QualityNote {
  id: ID;
  at: string;
  by: string;
  text: string;
}

/**
 * One farmer's contribution to an order. Farmer / plot / crop are never stored
 * here — they are read through `cropCycleId`, so a line item can't disagree with
 * the cycle it draws from.
 */
export interface OrderLineItem {
  id: ID;
  cropCycleId: ID;
  quantityKg: number;
  pricePerKg: number;
  /** Anonymous lot code shared with the Buyer App, e.g. "A-014". */
  lotCode?: string;
  /** Present once the agent has saved a handover check for this line. */
  handover?: HandoverResult | null;
}

export interface PurchaseOrder {
  id: ID;
  /**
   * REQ-0010 while a request is open or declined, PO-0010 once it is confirmed:
   * the prefix changes, the number never does. One number is never used under
   * both prefixes.
   */
  code: string;
  /** The original REQ- code of a request that has since been confirmed. */
  requestedAs: string | null;
  buyerId: ID;
  orderDate: string;
  /** Delivery date, pickup date, or the needed-by date for a request. */
  deliveryDate: string;
  type: OrderType;
  method: DeliveryMethod;
  status: OrderStatus;
  /** Catalog crop, or null for an "Other crop" request. */
  cropId: ID | null;
  cropName: string;
  /** True for a request whose crop is not in the catalog. */
  notInCatalog: boolean;
  requestedKg: number;
  /** What staff actually matched. Null until a request is confirmed. */
  suppliedKg: number | null;
  /**
   * Final price per kg. Null while a request is open or declined. When the order
   * has line items, prices live on the lines and this is only a fallback.
   */
  pricePerKg: number | null;
  /** Delivery orders only. Null for pickup orders. */
  deliveryAddress: string | null;
  /** Pickup orders only. Null for delivery orders. */
  pickup: PickupDetails | null;
  /** Free text buyer requirements on a request (ripeness, size). */
  requirements: string;
  /** Ripeness the buyer picked on a catalog request. "Standard" = the crop's specification. */
  requestedRipeness: string;
  /** Size the buyer picked on a catalog request. Empty for an "Other crop" request. */
  requestedSize: string;
  /** Staff check of whether the request can be met. */
  meetCheck: MeetCheck;
  /** The crop specification line when the order was placed, so staff see what produce was checked against. */
  specSnapshot: string;
  /** What the buyer said in the Buyer App after receiving the produce. */
  feedback: OrderFeedback | null;
  followUp: FollowUp;
  /** Staff notes in the quality log. Everything else in the log is built from other records. */
  qualityNotes: QualityNote[];
  declineReason: string;
  /** When a request was declined. Null otherwise. */
  declinedAt: string | null;
  cancelReason: string;
  note: string;
  /** Empty for Requested, Declined and Cancelled orders: no stock is held. */
  lineItems: OrderLineItem[];
  createdAt: string;
}

/* -------------------------------------------------- shared lookup entries */

/**
 * Free-form option lists the field tool lets users extend on the fly
 * (soil types, seed sources, ...). Kept as a keyed list of strings so a
 * backend can back it with a simple reference table.
 */
export type LookupKey =
  | "soilType"
  | "irrigationType"
  | "infrastructure"
  | "seedSource"
  | "variety"
  | "certificateName";

export type Lookups = Record<LookupKey, string[]>;
