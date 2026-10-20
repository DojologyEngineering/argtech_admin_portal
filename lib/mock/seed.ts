/**
 * Seed data for the mock store.
 *
 * Farmers, plots, crops, crop cycles and certificates are copied from the Agent
 * App (`argtech_agent_miniapp/lib/mock/seed.ts`), which is the source of truth
 * for them, keeping its ids and values. Orders are the shared orders that all
 * three apps show. Everything is sample data for the Kampong Cham pilot.
 *
 * Dates are generated relative to "today" at seed time rather than hard-coded,
 * so the status ladder (Growing / Ready to Harvest / Harvesting / Completed) and
 * the supply forecast always read sensibly whenever the portal is opened.
 */

import { polygonAreaHectares, polygonCentroid } from "../geo";
import { addDays, toISODate, todayISO } from "../format";
import { BUYER_PRICE_TIERS, tierPriceFromPrices } from "../pricing";
import { EMPTY_SPEC, specSummary } from "../crop-spec";
import { placeholderImage } from "../placeholder";
import {
  EMPTY_PRODUCTION,
  type ActivityType,
  type AppUser,
  type Buyer,
  type BuyerPrices,
  type Certificate,
  type CertificateType,
  type Crop,
  type CropCycle,
  type CropSpec,
  type DeliveryMethod,
  type Farmer,
  type FollowUpStatus,
  type HandoverResult,
  type LatLng,
  type Lookups,
  type FeedbackOutcome,
  type OrderStatus,
  type OrderType,
  type PickupDetails,
  type PickupPoint,
  type Plot,
  type ProductionDetails,
  type PurchaseOrder,
} from "../types";

export interface Db {
  users: AppUser[];
  farmers: Farmer[];
  plots: Plot[];
  crops: Crop[];
  cycles: CropCycle[];
  orders: PurchaseOrder[];
  buyers: Buyer[];
  pickupPoints: PickupPoint[];
  lookups: Lookups;
}

const T = todayISO();
const d = (offset: number) => addDays(T, offset);

/** Builds a slightly irregular field polygon around a centre point (as in the Agent App). */
function field(center: LatLng, widthM: number, heightM: number, skew = 0.12): LatLng[] {
  const [lat, lng] = center;
  const dLat = heightM / 2 / 110_574;
  const dLng = widthM / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat + dLat, lng - dLng],
    [lat + dLat * (1 - skew), lng + dLng],
    [lat - dLat, lng + dLng * (1 - skew)],
    [lat - dLat * (1 - skew / 2), lng - dLng],
  ];
}

/**
 * Smallholder plot sizes in hectares. The Agent App's sample polygons are 2 to 7 ha,
 * too large for the story, so each is rescaled around its own centre to these sizes.
 */
const PLOT_HECTARES: Record<string, number> = {
  plot_1: 0.8,
  plot_2: 0.45,
  plot_3: 1.0,
  plot_4: 0.6,
  plot_5: 1.0,
  plot_6: 0.6,
  plot_7: 0.35,
  plot_8: 1.1,
  plot_9: 1.0,
  plot_10: 0.7,
};

function scaleToHectares(ring: LatLng[], target: number): LatLng[] {
  const area = polygonAreaHectares(ring);
  const centre = polygonCentroid(ring);
  if (!area || !centre) return ring;
  const k = Math.sqrt(target / area);
  const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
  return ring.map(
    ([lat, lng]) =>
      [r6(centre[0] + (lat - centre[0]) * k), r6(centre[1] + (lng - centre[1]) * k)] as LatLng,
  );
}

/** "Prek Koy, Angkor Ban, Kang Meas, Kampong Cham" -> village, commune, district, province. */
function parseLocation(text: string) {
  const [village = "", commune = "", district = "", province = ""] = text
    .split(",")
    .map((part) => part.trim());
  return { village, commune, district, province };
}

function plot(
  id: string,
  farmerId: string,
  name: string,
  ownershipType: Plot["ownershipType"],
  soilType: string,
  locationText: string,
  traced: LatLng[],
): Plot {
  const boundary = PLOT_HECTARES[id] ? scaleToHectares(traced, PLOT_HECTARES[id]) : traced;
  const centroid = polygonCentroid(boundary);
  return {
    id,
    name,
    farmerId,
    ownershipType,
    ...parseLocation(locationText),
    latitude: centroid?.[0] ?? null,
    longitude: centroid?.[1] ?? null,
    areaSource: "polygon",
    boundary,
    manualLengthM: null,
    manualWidthM: null,
    areaHectares: polygonAreaHectares(boundary),
    soilType,
    // The Agent App records neither of these, so they start empty.
    irrigationType: "",
    infrastructure: "",
    remark: "",
    createdAt: d(-320),
  };
}

function cert(
  id: string,
  type: CertificateType,
  issuer: string,
  scope: string,
  expiryOffset: number | null,
  sharing: Partial<
    Pick<
      Certificate,
      | "sharing"
      | "appliesTo"
      | "coversCropIds"
      | "originalImage"
      | "safeImage"
      | "safeImageApproved"
    >
  > = {},
): Certificate {
  const name =
    type === "GAP"
      ? "Good Agricultural Practices (GAP)"
      : type === "Organic"
        ? "Organic Certification"
        : scope;
  return {
    id,
    type,
    name,
    issuer,
    scope,
    issuedDate: null,
    expiryDate: expiryOffset === null ? null : d(expiryOffset),
    note: "",
    // Hidden until staff choose otherwise.
    sharing: "Hidden",
    appliesTo: [],
    coversCropIds: [],
    originalImage: null,
    safeImage: null,
    safeImageApproved: false,
    ...sharing,
  };
}

interface CycleSeed {
  n: number;
  farmerId: string;
  plotId: string;
  cropId: string;
  plantingOffset: number;
  harvestOffset: number;
  /** seed, fertilizer, labor, other */
  costs: [number, number, number, number];
  expectedOutputKg: number;
  /** [offset, kg, note] */
  harvests?: Array<[number, number, string?]>;
  completedOffset?: number;
  production?: Partial<ProductionDetails>;
  activities?: Array<[ActivityType, number, string]>;
}

function cycle(input: CycleSeed): CropCycle {
  const id = `cycle_${input.n}`;
  return {
    id,
    code: `CC-${String(input.n).padStart(4, "0")}`,
    farmerId: input.farmerId,
    plotId: input.plotId,
    cropId: input.cropId,
    plantingDate: d(input.plantingOffset),
    expectedHarvestDate: d(input.harvestOffset),
    expectedOutputKg: input.expectedOutputKg,
    costs: {
      seed: input.costs[0],
      fertilizer: input.costs[1],
      labor: input.costs[2],
      other: input.costs[3],
    },
    harvestLog: (input.harvests ?? []).map(([offset, quantityKg, note], i) => ({
      id: `${id}_harvest_${i}`,
      date: d(offset),
      quantityKg,
      note: note ?? "",
    })),
    activities: (input.activities ?? []).map(([type, offset, note], i) => ({
      id: `${id}_act_${i}`,
      type,
      date: d(offset),
      note,
    })),
    completedAt: input.completedOffset != null ? d(input.completedOffset) : null,
    remark: "",
    production: { ...EMPTY_PRODUCTION, ...input.production },
    stockClosed: false,
    createdAt: d(input.plantingOffset - 3),
  };
}

/** A date in a calendar month some months ago, clamped to that month's length. */
function monthDate(monthsAgo: number, day: number): string {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  first.setDate(Math.min(day, last));
  return toISODate(first);
}

/** Harvest kg planned for the months before this one (5 months ago ... last month): a gentle ramp. */
const HISTORY_KG = [820, 1240, 1610, 2050, 2380];

/**
 * Sample history for the Harvest Overview chart: one closed cycle per earlier
 * month, topping each month up to its target after the Agent App's own harvests
 * are counted. The cycles are Completed with their unsold balance closed out, so
 * they add no stock and change no order allocation.
 */
function historyCycles(existing: CropCycle[]): CropCycle[] {
  const plan: Array<{
    farmerId: string;
    plotId: string;
    cropId: string;
    costs: [number, number, number, number];
  }> = [
    { farmerId: "farmer_1", plotId: "plot_1", cropId: "crop_cucumber", costs: [30, 55, 130, 15] },
    { farmerId: "farmer_2", plotId: "plot_3", cropId: "crop_tomato", costs: [55, 85, 200, 30] },
    { farmerId: "farmer_3", plotId: "plot_5", cropId: "crop_cabbage", costs: [45, 70, 160, 25] },
    { farmerId: "farmer_4", plotId: "plot_6", cropId: "crop_eggplant", costs: [35, 55, 170, 25] },
    { farmerId: "farmer_6", plotId: "plot_8", cropId: "crop_longbean", costs: [25, 40, 105, 15] },
  ];
  const out: CropCycle[] = [];

  HISTORY_KG.forEach((target, i) => {
    const monthsAgo = HISTORY_KG.length - i; // 5 ... 1
    const monthKey = monthDate(monthsAgo, 1).slice(0, 7);
    const already = existing
      .flatMap((c) => c.harvestLog)
      .filter((h) => h.date.slice(0, 7) === monthKey)
      .reduce((sum, h) => sum + h.quantityKg, 0);
    const need = Math.round(target - already);
    if (need < 50) return;

    const days = monthsAgo === 1 ? [3, 9, 15] : [4, 11, 19];
    const weights = [0.3, 0.4, 0.3];
    let left = need;
    const harvests: Array<{ id: string; date: string; quantityKg: number; note: string }> =
      days.map((day, k) => {
        const kg = k === days.length - 1 ? left : Math.round(need * weights[k]!);
        left -= kg;
        return {
          id: `cycle_h${monthsAgo}_harvest_${k}`,
          date: monthDate(monthsAgo, day),
          quantityKg: kg,
          note: k === 0 ? "First picking (sample history)" : "",
        };
      });

    const p = plan[i]!;
    const first = harvests[0]!.date;
    const last = harvests[harvests.length - 1]!.date;
    out.push({
      id: `cycle_h${monthsAgo}`,
      code: `CC-${String(27 + i).padStart(4, "0")}`,
      farmerId: p.farmerId,
      plotId: p.plotId,
      cropId: p.cropId,
      plantingDate: addDays(first, -45),
      expectedHarvestDate: addDays(first, -2),
      expectedOutputKg: need,
      costs: { seed: p.costs[0], fertilizer: p.costs[1], labor: p.costs[2], other: p.costs[3] },
      harvestLog: harvests,
      activities: [],
      completedAt: addDays(last, 3),
      remark: "Sample history. Cycle closed and the unsold balance closed out.",
      production: {
        ...EMPTY_PRODUCTION,
        method: "Conventional",
        fertilizerType: "Chemical",
        pesticideUsed: "Not used",
      },
      stockClosed: true,
      createdAt: addDays(first, -48),
    });
  });
  return out;
}

/* ------------------------------------------------------- shared orders */

const FRESH_MARKET = "buyer_1";

const MAIN_STORE = "Main store, No. 24, Street 278, Boeng Keng Kang, Phnom Penh";
const WAREHOUSE = "Warehouse, No. 112, National Road 1, Chbar Ampov, Phnom Penh";

/** Sample meeting points, the same wording as the Buyer App. Pickup points are never farms. */
const PICKUP_POINTS: PickupPoint[] = [
  {
    id: "pickup_kang_meas",
    name: "Kang Meas sample meeting point",
    district: "Kang Meas",
    landmark: "Next to the market gate (sample)",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Kang+Meas+Kampong+Cham",
    active: true,
  },
  {
    id: "pickup_srey_santhor",
    name: "Srey Santhor sample meeting point",
    district: "Srey Santhor",
    landmark: "Near the main market (sample)",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Srey+Santhor+Kampong+Cham",
    active: true,
  },
];

/** A pickup record pointing at one of the seeded points. */
const atPoint = (pointId: string) => {
  const p = PICKUP_POINTS.find((x) => x.id === pointId)!;
  return {
    pointId: p.id,
    pointName: p.name,
    district: p.district,
    landmark: p.landmark,
    mapUrl: p.mapUrl,
  };
};

const notArranged = (): PickupDetails => ({
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
});

interface OrderSeed {
  /** Shown code: REQ- while open or declined, PO- once confirmed (REQ-0010, PO-0009). */
  code: string;
  /** Original REQ- code of a request that was already confirmed. */
  requestedAs?: string;
  type: OrderType;
  method: DeliveryMethod;
  status: OrderStatus;
  /** Catalog crop id, or null for an "Other crop" request. */
  cropId: string | null;
  cropName?: string;
  requestedKg: number;
  /** Days from today the order was placed. */
  placed: number;
  /** Days from today of the delivery, pickup, or needed-by date. */
  date: number;
  address?: string;
  pickup?: PickupDetails;
  requirements?: string;
  /** Ripeness and size the buyer picked on a catalog request. */
  ripeness?: string;
  size?: string;
  declineReason?: string;
  /** Days from today the request was declined. */
  declinedOffset?: number;
  cancelReason?: string;
  note?: string;
  /** Farmer lines. Empty for Requested, Declined and Cancelled orders. */
  lines?: Array<{
    cycleId: string;
    kg: number;
    lotCode?: string;
    handover?: HandoverResult;
  }>;
  /** Quantity for a cancelled order that no longer holds any lines. */
  suppliedKg?: number;
  /** What the buyer said in the Buyer App, and how many days ago. */
  feedback?: {
    outcome: FeedbackOutcome;
    reasons: string[];
    note: string;
    lotCodes: string[];
    atOffset: number;
  };
  followUpStatus?: FollowUpStatus;
}

function order(
  input: OrderSeed,
  crops: Crop[],
): PurchaseOrder {
  const cropOf = (cropId: string | null) => crops.find((c) => c.id === cropId);
  const lines = input.lines ?? [];
  const linesKg = lines.reduce((sum, l) => sum + l.kg, 0);
  const suppliedKg = lines.length > 0 ? linesKg : (input.suppliedKg ?? null);
  // One tier price for the whole quantity, applied to every line.
  const price =
    suppliedKg === null
      ? null
      : tierPriceFromPrices(cropOf(input.cropId)?.buyerPrices, suppliedKg);

  const code = input.code;
  const key = code.toLowerCase().replace("-", "_");

  return {
    id: `order_${key}`,
    code,
    requestedAs: input.requestedAs ?? null,
    buyerId: FRESH_MARKET,
    orderDate: d(input.placed),
    deliveryDate: d(input.date),
    type: input.type,
    method: input.method,
    status: input.status,
    cropId: input.cropId,
    cropName: cropOf(input.cropId)?.name ?? input.cropName ?? "",
    notInCatalog: input.cropId === null,
    requestedKg: input.requestedKg,
    suppliedKg,
    pricePerKg: price,
    deliveryAddress: input.method === "Delivery" ? (input.address ?? null) : null,
    pickup: input.method === "Pickup" ? (input.pickup ?? notArranged()) : null,
    requirements: input.requirements ?? "",
    // "Standard" means the crop's own specification. An "Other crop" request has none.
    requestedRipeness: input.ripeness ?? (input.cropId ? "Standard" : ""),
    requestedSize: input.size ?? (input.cropId ? "Standard" : ""),
    meetCheck: { decision: "Not checked yet", note: "" },
    specSnapshot: cropOf(input.cropId) ? specSummary(cropOf(input.cropId)!.spec) : "",
    feedback: input.feedback
      ? {
          outcome: input.feedback.outcome,
          reasons: input.feedback.reasons,
          note: input.feedback.note,
          lotCodes: input.feedback.lotCodes,
          at: d(input.feedback.atOffset),
        }
      : null,
    followUp: { status: input.followUpStatus ?? "Open", note: "", updatedAt: null },
    qualityNotes: [],
    declineReason: input.declineReason ?? "",
    declinedAt: input.declinedOffset != null ? d(input.declinedOffset) : null,
    cancelReason: input.cancelReason ?? "",
    note: input.note ?? "",
    lineItems: lines.map((l, i) => ({
      id: `li_${key}_${i + 1}`,
      cropCycleId: l.cycleId,
      quantityKg: l.kg,
      pricePerKg: price ?? 0,
      lotCode: l.lotCode,
      handover: l.handover ?? null,
    })),
    createdAt: d(input.placed),
  };
}

export function createSeedDb(): Db {
  /* ------------------------------------------------------------- users */
  const users: AppUser[] = [
    {
      id: "user-1",
      username: "admin",
      fullName: "Admin User",
      email: "admin@argtech.com",
      role: "Admin",
      status: "Active",
      createdAt: d(-540),
    },
    {
      id: "user-2",
      username: "sophal",
      fullName: "Sophal Chan",
      email: "sophal@argtech.com",
      role: "Manager",
      status: "Active",
      createdAt: d(-410),
    },
    {
      id: "user-3",
      username: "dara",
      fullName: "Dara Kim",
      email: "dara@argtech.com",
      role: "Staff",
      status: "Active",
      createdAt: d(-286),
    },
    {
      id: "user-4",
      username: "srey",
      fullName: "Srey Pov",
      email: "srey@argtech.com",
      role: "Staff",
      status: "Inactive",
      createdAt: d(-193),
    },
    {
      id: "user-5",
      username: "vichea",
      fullName: "Vichea Ly",
      email: "vichea@argtech.com",
      role: "Manager",
      status: "Active",
      createdAt: d(-97),
    },
  ];

  /* ----------------------------------------------------------- farmers */
  const farmer = (
    id: string,
    firstName: string,
    lastName: string,
    gender: Farmer["gender"],
    dateOfBirth: string,
    educationLevel: Farmer["educationLevel"],
    primaryPhone: string,
    secondaryPhone: string,
    district: string,
    commune: string,
    village: string,
    remark: string,
    createdOffset: number,
    certificates: Certificate[] = [],
  ): Farmer => ({
    id,
    firstName,
    lastName,
    gender,
    dateOfBirth,
    educationLevel,
    primaryPhone,
    secondaryPhone,
    province: "Kampong Cham",
    district,
    commune,
    village,
    profilePhotoUrl: null,
    nationalIdUrl: null,
    additionalPhotoUrl: null,
    remark,
    certificates,
    createdAt: d(createdOffset),
  });

  const farmers: Farmer[] = [
    farmer("farmer_1", "Sokha", "Meas", "Male", "1985-03-15", "Grade 12", "098 765 432", "012 445 118", "Kang Meas", "Angkor Ban", "Prek Koy", "Long-standing supplier, reliable with wet-season vegetables.", -400),
    farmer("farmer_2", "Kimly", "Lay", "Female", "1991-07-02", "Grade 9", "011 240 907", "", "Kang Meas", "Ampil", "Kampong Tnaot", "Interested in organic certification next cycle.", -360, [
      cert("cert_1", "Organic", "Cambodian Organic Agriculture Association", "Vegetable production", 230),
    ]),
    farmer("farmer_3", "Chantrea", "Sok", "Female", "1978-11-23", "Primary school", "092 118 640", "078 902 331", "Srey Santhor", "Baray", "Ta Ong", "", -290, [
      // Shared as details only, on this farmer's chili cycles (the Buyer App's chili GAP lot).
      cert("cert_2", "GAP", "Ministry of Agriculture (sample)", "Cabbage and chili production", 110, {
        sharing: "Details only",
        appliesTo: ["cycle_7", "cycle_20"],
        coversCropIds: ["crop_cabbage", "crop_chili"],
      }),
      cert("cert_3", "Other", "Provincial Department of Water Resources", "Water use training", null),
    ]),
    farmer("farmer_4", "Virak", "Phan", "Male", "1988-01-09", "Vocational training", "016 703 522", "089 447 210", "Kang Meas", "Chrey Vien", "Prek Tonloap", "Runs a shared tractor with two neighbouring households.", -210, [
      cert("cert_4", "Other", "Provincial Department of Agriculture", "Fresh produce handling", 635),
      // The one certificate the Buyer App shows with an image (its tomato lot A-022).
      cert("cert_5", "GAP", "Cambodia GAP Certification Body (sample)", "Tomato production", 300, {
        sharing: "Details and image",
        appliesTo: ["cycle_9"],
        coversCropIds: ["crop_tomato"],
        originalImage: placeholderImage("GAP certificate", { sample: true }),
        safeImage: placeholderImage("Sample document"),
        safeImageApproved: true,
      }),
    ]),
    farmer("farmer_5", "Sereypheap", "Ly", "Male", "1995-05-30", "University", "070 336 894", "", "Kampong Siem", "Kampong Siem", "Prek Pdau", "New to the programme, registered this season.", -70),
    farmer("farmer_6", "Dara", "Heng", "Male", "1982-09-12", "Grade 9", "097 612 345", "", "Kang Meas", "Ampil", "Prey Kmeng", "Grows cabbage and leafy greens for the Phnom Penh markets.", -150),
    farmer("farmer_7", "Srey Mom", "Chea", "Female", "1990-04-27", "Grade 12", "085 330 912", "012 778 604", "Srey Santhor", "Kaoh Krabei", "Prek Dambouk", "Organic-minded grower on the Mekong river bank.", -120, [
      cert("cert_6", "Organic", "Cambodian Organic Agriculture Association (sample)", "Long bean production", 420, {
        coversCropIds: ["crop_longbean"],
      }),
    ]),
    farmer("farmer_8", "Vannak", "Keo", "Male", "1986-12-03", "Primary school", "096 204 781", "", "Kampong Siem", "Veal Vong", "Veal Vong", "Registered this season, starting with tomatoes.", -45),
  ];

  /* ------------------------------------------------------------- plots */
  const plots: Plot[] = [
    plot("plot_1", "farmer_1", "Vegetable Plot A", "Own", "Clay Soil", "Prek Koy, Angkor Ban, Kang Meas, Kampong Cham", field([12.014, 105.382], 260, 190)),
    plot("plot_2", "farmer_1", "Vegetable Plot B", "Rent", "Loam Soil", "Prek Koy, Angkor Ban, Kang Meas, Kampong Cham", field([12.0095, 105.3905], 180, 150, 0.2)),
    plot("plot_3", "farmer_2", "Riverside Plot", "Own", "Alluvial Soil", "Kampong Tnaot, Ampil, Kang Meas, Kampong Cham", field([11.965, 105.351], 300, 210)),
    plot("plot_4", "farmer_2", "Vegetable Plot C", "Own", "Clay Soil", "Kampong Tnaot, Ampil, Kang Meas, Kampong Cham", field([11.9705, 105.344], 240, 200, 0.05)),
    plot("plot_5", "farmer_3", "Vegetable Plot D", "Rent", "Silt Soil", "Ta Ong, Baray, Srey Santhor, Kampong Cham", field([11.883, 105.263], 320, 240)),
    plot("plot_6", "farmer_4", "Vegetable Plot E", "Own", "Sandy Soil", "Prek Tonloap, Chrey Vien, Kang Meas, Kampong Cham", field([12.038, 105.356], 220, 180, 0.18)),
    plot("plot_7", "farmer_5", "Hill Farm Terrace", "Own", "Loam Soil", "Prek Pdau, Kampong Siem, Kampong Siem, Kampong Cham", field([12.082, 105.465], 170, 140)),
    plot("plot_8", "farmer_6", "Vegetable Plot F", "Own", "Loam Soil", "Prey Kmeng, Ampil, Kang Meas, Kampong Cham", field([11.992, 105.368], 250, 190, 0.1)),
    plot("plot_9", "farmer_7", "Mekong Bank Plot", "Own", "Alluvial Soil", "Prek Dambouk, Kaoh Krabei, Srey Santhor, Kampong Cham", field([11.901, 105.278], 280, 200, 0.14)),
    plot("plot_10", "farmer_8", "Vegetable Plot G", "Rent", "Silt Soil", "Veal Vong, Veal Vong, Kampong Siem, Kampong Cham", field([12.105, 105.489], 210, 170, 0.08)),
  ];

  /* ------------------------------------------------------ crop catalogue */
  /**
   * Specification wording, chips and request options are copied from the Buyer
   * App's catalog (`lib/mock/catalog.ts`). Tier prices seed from the shared tier
   * constant, after which the crop record is the source of truth.
   */
  const S = "Standard";
  const SIZES = [S, "Small", "Medium", "Large"];
  const spec = (
    ripeness: string,
    size: string,
    condition: string,
    bestUsedWithinDays: number,
    chips: string[],
    options: {
      ripenessExtras?: string[];
      sizeOptions?: string[];
      buyerCanChoose?: boolean;
    } = {},
  ): CropSpec => ({
    ...EMPTY_SPEC,
    ripeness,
    size,
    condition,
    bestUsedWithinDays,
    chips,
    buyerCanChoose: options.buyerCanChoose ?? false,
    ripenessOptions: [S, ...(options.ripenessExtras ?? [])],
    sizeOptions: options.sizeOptions ?? [S],
  });
  const prices = (cropId: string): BuyerPrices => {
    const [under200, from200, from1000] = BUYER_PRICE_TIERS[cropId]!;
    return { under200, from200, from1000 };
  };
  const crop = (
    id: string,
    name: string,
    variety: string,
    season: Crop["season"],
    seedSource: string,
    daysToHarvest: number,
    cropSpec: CropSpec,
  ): Crop => ({
    id,
    name,
    variety,
    season,
    seedSource,
    daysToHarvest,
    note: "",
    spec: cropSpec,
    buyerPrices: prices(id),
  });

  const crops: Crop[] = [
    crop("crop_cucumber", "Cucumber", "Local Hybrid F1", "Wet Season", "Thailand", 40,
      spec("Firm, dark green", "Medium", "Straight, no soft spots or yellowing", 5, ["Firm", "Medium", "Dark green"], {
        ripenessExtras: ["Younger and smaller", "Fully grown"],
        sizeOptions: SIZES,
        buyerCanChoose: true,
      })),
    crop("crop_tomato", "Tomato", "Local Round", "Dry Season", "Thailand", 60,
      spec("Firm, mostly red-ripe", "Medium", "No cracks, rot or bruising", 7, ["Firm", "Medium", "Red-ripe"], {
        ripenessExtras: ["Firm and green", "Partly ripe", "Fully ripe"],
        sizeOptions: SIZES,
        buyerCanChoose: true,
      })),
    crop("crop_longbean", "Long Bean", "Yardlong Green", "Wet Season", "Vietnam", 45,
      spec("Tender, snaps cleanly", "Medium length", "No spots or overgrown pods", 4, ["Tender", "Medium"])),
    crop("crop_morningglory", "Morning Glory", "Trakuon Sre", "Wet Season", "Local", 25,
      spec("Fresh, tender leaves", "Standard bundle", "No yellowing or wilting", 2, ["Fresh", "Tender"])),
    crop("crop_chili", "Chili", "Bird's Eye (Marech Kdao)", "Dry Season", "Thailand", 75,
      spec("Fully colored", "Standard", "No soft spots or shriveling", 7, ["Fully colored"])),
    crop("crop_cabbage", "Cabbage", "Green Ball", "Dry Season", "Korea", 65,
      spec("Firm, compact heads", "Medium to large", "No split heads or damaged outer leaves", 14, ["Compact", "Medium to large"], {
        ripenessExtras: ["Smaller heads", "Larger heads"],
        sizeOptions: SIZES,
        buyerCanChoose: true,
      })),
    // The Buyer App also lets buyers pick an eggplant size; the brief seeds the
    // switch on for Tomato, Cucumber and Cabbage only, so those options are kept
    // here but switched off.
    crop("crop_eggplant", "Eggplant", "Long Purple", "Wet Season", "Vietnam", 70,
      spec("Firm, glossy", "Medium", "No blemishes or soft spots", 7, ["Firm", "Glossy", "Medium"], {
        sizeOptions: SIZES,
      })),
  ];

  /* -------------------------------------------------------- crop cycles */
  const C = "Conventional";
  const cycles: CropCycle[] = [
    cycle({
      n: 1, farmerId: "farmer_1", plotId: "plot_1", cropId: "crop_cucumber",
      plantingOffset: -75, harvestOffset: -35, costs: [40, 60, 150, 20], expectedOutputKg: 900,
      harvests: [[-33, 120, "First picking"], [-29, 150], [-25, 160], [-21, 140], [-17, 110], [-13, 90, "Final picking, vines declining"]],
      completedOffset: -10,
      production: { method: C, deliveryFrequency: "Weekly", fertilizerType: "Chemical", pesticideUsed: "Used", pesticideDetails: "Neem oil", notes: "Picked twice weekly during peak season." },
      activities: [["Irrigation", -50, "Drip line set up"]],
    }),
    cycle({
      n: 2, farmerId: "farmer_2", plotId: "plot_3", cropId: "crop_tomato",
      plantingOffset: -80, harvestOffset: -20, costs: [60, 90, 220, 35], expectedOutputKg: 1400,
      harvests: [[-18, 180, "First picking"], [-11, 220], [-4, 240, "Peak production"]],
      production: { method: C, deliveryFrequency: "Weekly", fertilizerType: "Chemical", pesticideUsed: "Used", pesticideDetails: "Mancozeb" },
      activities: [["Irrigation", -60, "Canal water released"]],
    }),
    cycle({
      n: 3, farmerId: "farmer_3", plotId: "plot_5", cropId: "crop_cabbage",
      plantingOffset: -75, harvestOffset: -10, costs: [45, 70, 160, 25], expectedOutputKg: 2000,
      harvests: [[-8, 2150, "Full plot cut in one day"]],
      completedOffset: -7,
      production: { method: "Mixed", fertilizerType: "Mixed", pesticideUsed: "Not used", notes: "Compost base with a chemical top dressing. Good head formation this cycle." },
    }),
    cycle({
      n: 4, farmerId: "farmer_4", plotId: "plot_6", cropId: "crop_eggplant",
      plantingOffset: -100, harvestOffset: -30, costs: [35, 55, 190, 30], expectedOutputKg: 1100,
      harvests: [[-28, 140], [-21, 160], [-14, 150], [-7, 130], [-1, 100, "Final harvest before plot cleared"]],
      completedOffset: 0,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Used", pesticideDetails: "Spinosad" },
    }),
    cycle({
      n: 5, farmerId: "farmer_1", plotId: "plot_2", cropId: "crop_longbean",
      plantingOffset: -50, harvestOffset: -5, costs: [25, 40, 110, 15], expectedOutputKg: 750,
      harvests: [[-3, 140, "First picking"]],
      production: { method: C, fertilizerType: "Organic", pesticideUsed: "Not sure", notes: "Pods forming well, first pick taken." },
    }),
    cycle({
      n: 6, farmerId: "farmer_2", plotId: "plot_4", cropId: "crop_morningglory",
      plantingOffset: -10, harvestOffset: 15, costs: [10, 15, 40, 5], expectedOutputKg: 400,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Not used" },
    }),
    cycle({
      n: 7, farmerId: "farmer_3", plotId: "plot_5", cropId: "crop_chili",
      plantingOffset: -60, harvestOffset: -15, costs: [50, 65, 200, 40], expectedOutputKg: 850,
      harvests: [[-12, 60, "First picking"], [-6, 80], [-1, 70, "Picking continues weekly"]],
      production: { method: C, fertilizerType: "Mixed", pesticideUsed: "Used", pesticideDetails: "Abamectin", notes: "Picking weekly, plants still flowering." },
    }),
    cycle({
      n: 8, farmerId: "farmer_5", plotId: "plot_7", cropId: "crop_cucumber",
      plantingOffset: -35, harvestOffset: 5, costs: [30, 45, 100, 15], expectedOutputKg: 700,
      harvests: [[-2, 90, "Early thinning picks"]],
      production: { method: "Organic", fertilizerType: "Organic", pesticideUsed: "Not used" },
    }),
    cycle({
      n: 9, farmerId: "farmer_4", plotId: "plot_6", cropId: "crop_tomato",
      plantingOffset: -8, harvestOffset: 52, costs: [55, 80, 150, 20], expectedOutputKg: 1300,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Not used" },
      activities: [["Irrigation", 2, "First irrigation"]],
    }),
    cycle({
      n: 10, farmerId: "farmer_1", plotId: "plot_2", cropId: "crop_tomato",
      plantingOffset: -75, harvestOffset: -15, costs: [60, 90, 200, 30], expectedOutputKg: 1200,
      harvests: [[-12, 300, "First picking"], [-6, 320], [-2, 280]],
      production: { method: C, deliveryFrequency: "Weekly", fertilizerType: "Mixed", pesticideUsed: "Not used" },
    }),
    cycle({
      n: 12, farmerId: "farmer_4", plotId: "plot_6", cropId: "crop_cucumber",
      plantingOffset: -20, harvestOffset: 20, costs: [55, 85, 240, 30], expectedOutputKg: 800,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Used", pesticideDetails: "Neem oil" },
    }),
    cycle({
      n: 13, farmerId: "farmer_2", plotId: "plot_4", cropId: "crop_cucumber",
      plantingOffset: -2, harvestOffset: 38, costs: [40, 70, 160, 22], expectedOutputKg: 650,
      production: { method: C, fertilizerType: "Mixed", pesticideUsed: "Not used" },
    }),
    cycle({
      n: 14, farmerId: "farmer_1", plotId: "plot_1", cropId: "crop_morningglory",
      plantingOffset: -3, harvestOffset: 22, costs: [10, 15, 40, 5], expectedOutputKg: 350,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Not used" },
    }),
    cycle({
      n: 15, farmerId: "farmer_5", plotId: "plot_7", cropId: "crop_longbean",
      plantingOffset: -15, harvestOffset: 30, costs: [25, 40, 100, 15], expectedOutputKg: 500,
      production: { method: "Organic", fertilizerType: "Organic", pesticideUsed: "Not used" },
    }),
    cycle({
      n: 16, farmerId: "farmer_2", plotId: "plot_3", cropId: "crop_chili",
      plantingOffset: -30, harvestOffset: 45, costs: [45, 60, 170, 35], expectedOutputKg: 600,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Used", pesticideDetails: "Abamectin" },
    }),
    cycle({
      n: 17, farmerId: "farmer_3", plotId: "plot_5", cropId: "crop_cabbage",
      plantingOffset: -12, harvestOffset: 53, costs: [60, 90, 200, 30], expectedOutputKg: 1500,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Not sure" },
    }),
    cycle({
      n: 18, farmerId: "farmer_4", plotId: "plot_6", cropId: "crop_eggplant",
      plantingOffset: -10, harvestOffset: 60, costs: [40, 60, 180, 30], expectedOutputKg: 900,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Used", pesticideDetails: "Spinosad" },
    }),
    cycle({
      n: 19, farmerId: "farmer_1", plotId: "plot_1", cropId: "crop_tomato",
      plantingOffset: -2, harvestOffset: 58, costs: [60, 95, 210, 35], expectedOutputKg: 1100,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Used", pesticideDetails: "Mancozeb" },
    }),
    cycle({
      n: 20, farmerId: "farmer_3", plotId: "plot_5", cropId: "crop_chili",
      plantingOffset: 0, harvestOffset: 75, costs: [50, 65, 190, 35], expectedOutputKg: 700,
      production: { method: C, fertilizerType: "Mixed", pesticideUsed: "Used", pesticideDetails: "Abamectin" },
    }),
    cycle({
      n: 21, farmerId: "farmer_5", plotId: "plot_7", cropId: "crop_tomato",
      plantingOffset: 0, harvestOffset: 60, costs: [55, 80, 170, 25], expectedOutputKg: 900,
      production: { method: "Mixed", fertilizerType: "Mixed", pesticideUsed: "Not used" },
    }),
    cycle({
      n: 22, farmerId: "farmer_2", plotId: "plot_4", cropId: "crop_morningglory",
      plantingOffset: -13, harvestOffset: 12, costs: [10, 15, 35, 5], expectedOutputKg: 300,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Not used" },
    }),
    cycle({
      n: 23, farmerId: "farmer_1", plotId: "plot_2", cropId: "crop_cucumber",
      plantingOffset: -31, harvestOffset: 9, costs: [35, 50, 120, 15], expectedOutputKg: 500,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Used", pesticideDetails: "Neem oil" },
    }),
    cycle({
      n: 24, farmerId: "farmer_6", plotId: "plot_8", cropId: "crop_cabbage",
      plantingOffset: -20, harvestOffset: 45, costs: [50, 80, 170, 25], expectedOutputKg: 1200,
      production: { method: C, fertilizerType: "Chemical", pesticideUsed: "Used", pesticideDetails: "Spinosad" },
    }),
    cycle({
      n: 25, farmerId: "farmer_7", plotId: "plot_9", cropId: "crop_longbean",
      plantingOffset: -50, harvestOffset: -5, costs: [25, 35, 105, 10], expectedOutputKg: 600,
      harvests: [[-4, 90, "First picking"], [-1, 110]],
      production: { method: "Organic", deliveryFrequency: "Weekly", fertilizerType: "Organic", pesticideUsed: "Not used", notes: "Compost and neem spray only." },
    }),
    cycle({
      n: 26, farmerId: "farmer_8", plotId: "plot_10", cropId: "crop_tomato",
      plantingOffset: -6, harvestOffset: 54, costs: [50, 75, 140, 20], expectedOutputKg: 1000,
      production: { method: C, fertilizerType: "Mixed", pesticideUsed: "Not sure" },
    }),
  ];

  cycles.push(...historyCycles(cycles));

  /* ------------------------------------------------------------ buyers */
  const buyers: Buyer[] = [
    {
      id: FRESH_MARKET,
      name: "Fresh Market Ltd.",
      contactPerson: "Sophea Chan",
      phone: "+855 12 888 456",
      email: "sophea@freshmarket.example",
      // The same address book as the Buyer App's seed buyer.
      addresses: [
        {
          id: "addr_main",
          label: "Main store",
          line: "No. 24, Street 278",
          district: "Boeng Keng Kang",
          city: "Phnom Penh",
        },
        {
          id: "addr_warehouse",
          label: "Warehouse",
          line: "No. 112, National Road 1",
          district: "Chbar Ampov",
          city: "Phnom Penh",
        },
      ],
    },
  ];

  /* ---------------------------------------------------- purchase orders */
  const orders: PurchaseOrder[] = (
    [
      {
        code: "REQ-0011", type: "Request", method: "Pickup", status: "Requested",
        cropId: null, cropName: "Pumpkin", requestedKg: 150, placed: 0, date: 21,
        requirements: "Medium, firm, no cracks",
      },
      {
        code: "REQ-0010", type: "Request", method: "Delivery", status: "Requested",
        cropId: "crop_chili", requestedKg: 200, placed: -1, date: 14, address: MAIN_STORE,
        note: "Prefer a mix of red and green if possible.",
      },
      {
        // Confirmed request, delivery today, no saved handover result yet. Number 12
        // because 10 belongs to REQ-0010: a number is never used under both prefixes.
        code: "PO-0012", requestedAs: "REQ-0012", type: "Request", method: "Delivery", status: "Confirmed",
        cropId: "crop_tomato", requestedKg: 300, placed: -3, date: 0, address: MAIN_STORE,
        requirements: "Partly ripe, Medium",
        ripeness: "Partly ripe",
        size: "Medium",
        lines: [{ cycleId: "cycle_10", kg: 300 }],
      },
      {
        // The Agent App only has two tomato cycles with harvested stock, so one
        // farmer carries two of the three lots.
        code: "PO-0009", type: "Order now", method: "Delivery", status: "Confirmed",
        cropId: "crop_tomato", requestedKg: 1000, placed: -2, date: 2, address: WAREHOUSE,
        note: "Please call on arrival at the gate.",
        lines: [
          { cycleId: "cycle_10", kg: 400, lotCode: "A-014" },
          { cycleId: "cycle_2", kg: 350, lotCode: "A-022" },
          { cycleId: "cycle_2", kg: 250, lotCode: "A-031" },
        ],
      },
      {
        code: "PO-0008", requestedAs: "REQ-0008", type: "Request", method: "Pickup", status: "Delivered",
        cropId: "crop_cucumber", requestedKg: 500, placed: -9, date: -3,
        pickup: {
          state: "Picked up",
          ...atPoint("pickup_kang_meas"),
          date: d(-3),
          timeWindow: "8:00 to 10:00",
          collectorName: "Vannak Sok (sample)",
          collectorPhone: "+855 12 777 321",
          instructions: "",
          sharedAt: d(-7),
        },
        lines: [
          {
            cycleId: "cycle_1",
            kg: 400,
            handover: {
              receivedKg: 400,
              acceptedKg: 380,
              rejectedKg: 20,
              rejectReason: "Cracks or damage",
              photos: [
                placeholderImage("Handover photo 1"),
                placeholderImage("Handover photo 2"),
              ],
              note: "Some cucumbers cracked in the crates.",
              buyerRepPresent: true,
              repMatchesOrder: true,
              checkedAt: d(-3),
            },
          },
        ],
        // The Buyer App seeds no feedback, so this is sample feedback with an open follow-up.
        feedback: {
          outcome: "issue",
          reasons: ["Cracks or damage"],
          note: "A few cucumbers had cracks.",
          lotCodes: ["B-107", "B-112"],
          atOffset: -2,
        },
        followUpStatus: "Open",
      },
      {
        code: "PO-0007", type: "Order now", method: "Delivery", status: "Completed",
        cropId: "crop_cabbage", requestedKg: 300, placed: -22, date: -18, address: MAIN_STORE,
        lines: [
          {
            cycleId: "cycle_3",
            kg: 300,
            // Checked at the farm before loading: everything accepted.
            handover: {
              receivedKg: 300,
              acceptedKg: 300,
              rejectedKg: 0,
              rejectReason: "",
              photos: [],
              note: "",
              buyerRepPresent: null,
              repMatchesOrder: null,
              checkedAt: d(-18),
            },
          },
        ],
        // The Buyer App seeds no feedback, so this is a sample positive review.
        feedback: {
          outcome: "as_expected",
          reasons: [],
          note: "Good quality, thank you.",
          lotCodes: ["D-302", "D-309"],
          atOffset: -17,
        },
      },
      {
        code: "REQ-0006", type: "Request", method: "Delivery", status: "Declined",
        cropId: "crop_morningglory", requestedKg: 150, placed: -12, date: 4, address: MAIN_STORE,
        declineReason: "Not enough supply for your date",
        declinedOffset: -11,
      },
      {
        // Cancelled orders hold no stock, so there are no lines and no handover.
        code: "PO-0005", type: "Order now", method: "Delivery", status: "Cancelled",
        cropId: "crop_eggplant", requestedKg: 250, placed: -10, date: -6, address: MAIN_STORE,
        cancelReason: "Farmer could not deliver",
        suppliedKg: 250,
      },
      {
        code: "PO-0004", type: "Order now", method: "Pickup", status: "Confirmed",
        cropId: "crop_longbean", requestedKg: 120, placed: -3, date: 2,
        pickup: {
          state: "Arranged",
          ...atPoint("pickup_kang_meas"),
          date: d(2),
          timeWindow: "8:00 to 10:00",
          collectorName: "Dara Kim (sample)",
          collectorPhone: "+855 96 555 019",
          instructions: "",
          sharedAt: d(-1),
        },
        lines: [{ cycleId: "cycle_5", kg: 120 }],
      },
      {
        // Pickup not arranged yet: the date is the buyer's wished pickup date.
        code: "PO-0003", type: "Order now", method: "Pickup", status: "Confirmed",
        cropId: "crop_cucumber", requestedKg: 150, placed: -4, date: 5,
        lines: [{ cycleId: "cycle_1", kg: 150 }],
      },
    ] satisfies OrderSeed[]
  ).map((o) => order(o, crops));

  /* ----------------------------------------------------------- lookups */
  const lookups: Lookups = {
    soilType: ["Clay Soil", "Loam Soil", "Sandy Soil", "Silt Soil", "Alluvial Soil"],
    irrigationType: ["River Water", "Well Water", "Rainfed", "Drip", "Sprinkler"],
    infrastructure: [
      "Canal",
      "Greenhouse",
      "Net House",
      "Water Pump",
      "Storage Shed",
      "None",
    ],
    seedSource: ["Local", "Thailand", "Vietnam", "Korea"],
    variety: [
      "Local Hybrid F1",
      "Local Round",
      "Yardlong Green",
      "Trakuon Sre",
      "Bird's Eye (Marech Kdao)",
      "Green Ball",
      "Long Purple",
    ],
    certificateName: [
      "Good Agricultural Practices (GAP)",
      "Organic Certification",
      "Food Safety Training",
    ],
  };

  return {
    users,
    farmers,
    plots,
    crops,
    cycles,
    orders,
    buyers,
    pickupPoints: PICKUP_POINTS.map((p) => ({ ...p })),
    lookups,
  };
}
