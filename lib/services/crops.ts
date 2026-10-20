/**
 * Crop reference catalogue.
 *
 * Full CRUD lives here in the admin portal rather than the field tool: shared
 * reference pricing has to stay consistent for everyone's break-even figures.
 */

import { commit, delay, getDb, newId, NotFoundError } from "../mock/store";
import { cycleEconomics, cycleMetrics } from "../derive";
import type { Crop, ID } from "../types";

export type CropInput = Omit<Crop, "id">;

export interface CropView extends Crop {
  cycleCount: number;
  activeCycleCount: number;
  /**
   * Average break-even price per kg (total cost ÷ expected kg) across this
   * crop's cycles that have costs and a quantity. Null when there are none.
   */
  typicalCostPerKg: number | null;
}

function typicalCost(crop: Crop): number | null {
  const db = getDb();
  const values: number[] = [];
  for (const cycle of db.cycles) {
    if (cycle.cropId !== crop.id) continue;
    const status = cycleMetrics(cycle, db.orders).status;
    const e = cycleEconomics(cycle, crop.buyerPrices, status);
    if (e.totalCost > 0 && e.breakEvenPerKg !== null) values.push(e.breakEvenPerKg);
  }
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000;
}

export async function listCrops(): Promise<CropView[]> {
  const db = getDb();
  const views = db.crops
    .map((c) => ({
      ...c,
      typicalCostPerKg: typicalCost(c),
      cycleCount: db.cycles.filter((cy) => cy.cropId === c.id).length,
      activeCycleCount: db.cycles.filter(
        (cy) => cy.cropId === c.id && !cy.completedAt,
      ).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return delay(views);
}

export async function getCrop(id: ID): Promise<Crop> {
  const crop = getDb().crops.find((c) => c.id === id);
  if (!crop) throw new NotFoundError("Crop", id);
  return delay(crop);
}

export async function createCrop(input: CropInput): Promise<Crop> {
  return commit((db) => {
    const crop: Crop = { ...input, id: newId("crop"), name: input.name.trim() };
    db.crops.push(crop);
    return { ...crop };
  });
}

export async function updateCrop(
  id: ID,
  input: Partial<CropInput>,
): Promise<Crop> {
  return commit((db) => {
    const crop = db.crops.find((c) => c.id === id);
    if (!crop) throw new NotFoundError("Crop", id);
    Object.assign(crop, input);
    return { ...crop };
  });
}

export async function deleteCrop(id: ID): Promise<void> {
  commit((db) => {
    const cycles = db.cycles.filter((c) => c.cropId === id).length;
    if (cycles) {
      throw new Error(
        `${cycles} crop cycle(s) reference this crop, so it cannot be removed.`,
      );
    }
    db.crops = db.crops.filter((c) => c.id !== id);
  });
}

export async function cropOptions(): Promise<
  Array<{ value: string; label: string }>
> {
  return delay(
    getDb()
      .crops.map((c) => ({ value: c.id, label: `${c.name} · ${c.variety}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    50,
  );
}
