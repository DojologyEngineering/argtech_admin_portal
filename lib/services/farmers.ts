/**
 * Farmer records.
 *
 * These are mostly written by field agents in the mobile tool; the portal reads
 * them and offers full create/edit as an admin fallback.
 */

import { commit, delay, getDb, newId, NotFoundError } from "../mock/store";
import { farmerName, todayISO } from "../format";
import { cycleMetrics } from "../derive";
import type { Certificate, CertificateSharing, Farmer, ID } from "../types";

export type FarmerInput = Omit<Farmer, "id" | "createdAt" | "certificates">;

export interface FarmerView extends Farmer {
  fullName: string;
  plotCount: number;
  /** Crop cycles of this farmer that are not Completed. */
  activeCycleCount: number;
  certificateCount: number;
  /** Certificates buyers can see in some form (anything but Hidden). */
  sharedCertificateCount: number;
}

function decorate(farmer: Farmer): FarmerView {
  const db = getDb();
  return {
    ...farmer,
    fullName: farmerName(farmer),
    plotCount: db.plots.filter((p) => p.farmerId === farmer.id).length,
    activeCycleCount: db.cycles.filter(
      (c) => c.farmerId === farmer.id && cycleMetrics(c, db.orders).status !== "Completed",
    ).length,
    certificateCount: farmer.certificates.length,
    sharedCertificateCount: farmer.certificates.filter((c) => c.sharing !== "Hidden")
      .length,
  };
}

export async function listFarmers(): Promise<FarmerView[]> {
  const db = getDb();
  const views = db.farmers
    .map((f) => decorate(f))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  return delay(views);
}

export async function getFarmer(id: ID): Promise<FarmerView> {
  const db = getDb();
  const farmer = db.farmers.find((f) => f.id === id);
  if (!farmer) throw new NotFoundError("Farmer", id);
  return delay(decorate(farmer));
}

export async function createFarmer(input: FarmerInput): Promise<Farmer> {
  return commit((db) => {
    const farmer: Farmer = {
      ...input,
      id: newId("farmer"),
      certificates: [],
      createdAt: todayISO(),
    };
    db.farmers.push(farmer);
    return { ...farmer };
  });
}

export async function updateFarmer(
  id: ID,
  input: Partial<FarmerInput>,
): Promise<Farmer> {
  return commit((db) => {
    const farmer = db.farmers.find((f) => f.id === id);
    if (!farmer) throw new NotFoundError("Farmer", id);
    Object.assign(farmer, input);
    return { ...farmer };
  });
}

/**
 * A farmer with plots or crop cycles behind them can't be removed — the history
 * would be orphaned. The caller gets a message explaining what is in the way.
 */
export async function deleteFarmer(id: ID): Promise<void> {
  commit((db) => {
    const plots = db.plots.filter((p) => p.farmerId === id).length;
    const cycles = db.cycles.filter((c) => c.farmerId === id).length;
    if (plots || cycles) {
      throw new Error(
        `This farmer still has ${plots} plot(s) and ${cycles} crop cycle(s). Remove those first.`,
      );
    }
    db.farmers = db.farmers.filter((f) => f.id !== id);
  });
}

/* ------------------------------------------------------- certificates */

/** What the add form asks for. Sharing starts Hidden, with no images. */
export type CertificateInput = Omit<
  Certificate,
  | "id"
  | "sharing"
  | "appliesTo"
  | "coversCropIds"
  | "originalImage"
  | "safeImage"
  | "safeImageApproved"
>;

export async function addCertificate(
  farmerId: ID,
  input: CertificateInput,
): Promise<Certificate> {
  return commit((db) => {
    const farmer = db.farmers.find((f) => f.id === farmerId);
    if (!farmer) throw new NotFoundError("Farmer", farmerId);
    const cert: Certificate = {
      ...input,
      id: newId("cert"),
      sharing: "Hidden",
      appliesTo: [],
      coversCropIds: [],
      originalImage: null,
      safeImage: null,
      safeImageApproved: false,
    };
    farmer.certificates.push(cert);
    return { ...cert };
  });
}

export async function removeCertificate(
  farmerId: ID,
  certificateId: ID,
): Promise<void> {
  commit((db) => {
    const farmer = db.farmers.find((f) => f.id === farmerId);
    if (!farmer) throw new NotFoundError("Farmer", farmerId);
    farmer.certificates = farmer.certificates.filter(
      (c) => c.id !== certificateId,
    );
  });
}

/* ------------------------------------------------- certificate sharing */

export interface CertificateChange {
  certificate: Certificate;
  /** Plain-words note when a setting was changed for the staff member. */
  notice?: string;
}

/** Buyers only see the safe copy, and only once it is approved. */
function hasApprovedImage(cert: Certificate): boolean {
  return Boolean(cert.safeImage) && cert.safeImageApproved;
}

function findCertificate(farmerId: ID, certificateId: ID) {
  const db = getDb();
  const farmer = db.farmers.find((f) => f.id === farmerId);
  if (!farmer) throw new NotFoundError("Farmer", farmerId);
  const cert = farmer.certificates.find((c) => c.id === certificateId);
  if (!cert) throw new NotFoundError("Certificate", certificateId);
  return { farmer, cert };
}

/**
 * Applies the rule "Details and image needs an approved buyer-safe image": when
 * the image goes away or is withdrawn, sharing drops to Details only.
 */
function enforceImageRule(cert: Certificate): string | undefined {
  if (cert.sharing === "Details and image" && !hasApprovedImage(cert)) {
    cert.sharing = "Details only";
    return "Sharing changed to Details only, because there is no approved buyer-safe image.";
  }
  return undefined;
}

export async function setCertificateSharing(
  farmerId: ID,
  certificateId: ID,
  sharing: CertificateSharing,
): Promise<CertificateChange> {
  findCertificate(farmerId, certificateId);
  return commit((db) => {
    const cert = db.farmers
      .find((f) => f.id === farmerId)!
      .certificates.find((c) => c.id === certificateId)!;
    if (sharing === "Details and image" && !hasApprovedImage(cert)) {
      throw new Error(
        "Details and image needs a buyer-safe image that is approved. Add and approve one first.",
      );
    }
    cert.sharing = sharing;
    return { certificate: { ...cert } };
  });
}

/** The crop cycles of this farmer a certificate applies to. */
export async function setCertificateAppliesTo(
  farmerId: ID,
  certificateId: ID,
  cycleIds: ID[],
): Promise<Certificate> {
  findCertificate(farmerId, certificateId);
  return commit((db) => {
    const cert = db.farmers
      .find((f) => f.id === farmerId)!
      .certificates.find((c) => c.id === certificateId)!;
    const own = new Set(
      db.cycles.filter((c) => c.farmerId === farmerId).map((c) => c.id),
    );
    cert.appliesTo = cycleIds.filter((id) => own.has(id));
    return { ...cert };
  });
}

/** The crops a certificate covers. Only a guide for picking cycles; it changes no ticks. */
export async function setCertificateCoversCrops(
  farmerId: ID,
  certificateId: ID,
  cropIds: ID[],
): Promise<Certificate> {
  findCertificate(farmerId, certificateId);
  return commit((db) => {
    const cert = db.farmers
      .find((f) => f.id === farmerId)!
      .certificates.find((c) => c.id === certificateId)!;
    const known = new Set(db.crops.map((c) => c.id));
    cert.coversCropIds = cropIds.filter((id) => known.has(id));
    return { ...cert };
  });
}

/** Adds or replaces the buyer-safe copy. A new image starts unapproved. */
export async function setCertificateSafeImage(
  farmerId: ID,
  certificateId: ID,
  dataUrl: string,
): Promise<CertificateChange> {
  findCertificate(farmerId, certificateId);
  return commit((db) => {
    const cert = db.farmers
      .find((f) => f.id === farmerId)!
      .certificates.find((c) => c.id === certificateId)!;
    cert.safeImage = dataUrl;
    cert.safeImageApproved = false;
    const notice = enforceImageRule(cert);
    return { certificate: { ...cert }, notice };
  });
}

export async function removeCertificateSafeImage(
  farmerId: ID,
  certificateId: ID,
): Promise<CertificateChange> {
  findCertificate(farmerId, certificateId);
  return commit((db) => {
    const cert = db.farmers
      .find((f) => f.id === farmerId)!
      .certificates.find((c) => c.id === certificateId)!;
    cert.safeImage = null;
    cert.safeImageApproved = false;
    const notice = enforceImageRule(cert);
    return { certificate: { ...cert }, notice };
  });
}

export async function setCertificateImageApproved(
  farmerId: ID,
  certificateId: ID,
  approved: boolean,
): Promise<CertificateChange> {
  const { cert: current } = findCertificate(farmerId, certificateId);
  if (approved && !current.safeImage) {
    throw new Error("Add a buyer-safe image before approving it.");
  }
  return commit((db) => {
    const cert = db.farmers
      .find((f) => f.id === farmerId)!
      .certificates.find((c) => c.id === certificateId)!;
    cert.safeImageApproved = approved;
    const notice = enforceImageRule(cert);
    return { certificate: { ...cert }, notice };
  });
}

/** Lightweight option list for the farmer pickers used across the portal. */
export async function farmerOptions(): Promise<
  Array<{ value: string; label: string }>
> {
  const db = getDb();
  return delay(
    db.farmers
      .map((f) => ({ value: f.id, label: farmerName(f) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    50,
  );
}
