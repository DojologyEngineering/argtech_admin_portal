/**
 * Farm plots.
 *
 * Area has a single source of truth per plot: `areaSource` decides whether
 * `areaHectares` comes from the traced boundary or the manual fallback, and the
 * service recomputes it on every write so the two can never disagree.
 */

import { commit, delay, getDb, newId, NotFoundError } from "../mock/store";
import { farmerName, todayISO } from "../format";
import { polygonAreaHectares, polygonCentroid, rectangleAreaHectares } from "../geo";
import type { ID, Plot } from "../types";

export type PlotInput = Omit<Plot, "id" | "createdAt" | "areaHectares">;

export interface PlotView extends Plot {
  farmerName: string;
  cycleCount: number;
}

/**
 * Normalises a plot so exactly one area source is populated and `areaHectares`
 * matches it. Tracing also fills in the GPS coordinate from the shape's centre
 * unless the caller supplied one.
 */
function normalise<T extends PlotInput>(input: T): T & { areaHectares: number } {
  if (input.areaSource === "polygon") {
    const boundary = input.boundary && input.boundary.length >= 3 ? input.boundary : null;
    const centroid = polygonCentroid(boundary);
    return {
      ...input,
      boundary,
      manualLengthM: null,
      manualWidthM: null,
      latitude: input.latitude ?? centroid?.[0] ?? null,
      longitude: input.longitude ?? centroid?.[1] ?? null,
      areaHectares: polygonAreaHectares(boundary),
    };
  }
  return {
    ...input,
    boundary: null,
    areaHectares: rectangleAreaHectares(input.manualLengthM, input.manualWidthM),
  };
}

function decorate(plot: Plot): PlotView {
  const db = getDb();
  const farmer = db.farmers.find((f) => f.id === plot.farmerId);
  return {
    ...plot,
    farmerName: farmer ? farmerName(farmer) : "Unassigned",
    cycleCount: db.cycles.filter((c) => c.plotId === plot.id).length,
  };
}

export async function listPlots(): Promise<PlotView[]> {
  const views = getDb()
    .plots.map(decorate)
    .sort((a, b) => a.name.localeCompare(b.name));
  return delay(views);
}

export async function getPlot(id: ID): Promise<PlotView> {
  const plot = getDb().plots.find((p) => p.id === id);
  if (!plot) throw new NotFoundError("Plot", id);
  return delay(decorate(plot));
}

export async function listPlotsByFarmer(farmerId: ID): Promise<PlotView[]> {
  const views = getDb()
    .plots.filter((p) => p.farmerId === farmerId)
    .map(decorate);
  return delay(views, 60);
}

export async function createPlot(input: PlotInput): Promise<Plot> {
  return commit((db) => {
    const plot: Plot = {
      ...normalise(input),
      id: newId("plot"),
      createdAt: todayISO(),
    };
    db.plots.push(plot);
    return { ...plot };
  });
}

export async function updatePlot(
  id: ID,
  input: Partial<PlotInput>,
): Promise<Plot> {
  return commit((db) => {
    const plot = db.plots.find((p) => p.id === id);
    if (!plot) throw new NotFoundError("Plot", id);
    const merged = { ...plot, ...input } as PlotInput;
    Object.assign(plot, normalise(merged));
    return { ...plot };
  });
}

export async function deletePlot(id: ID): Promise<void> {
  commit((db) => {
    const cycles = db.cycles.filter((c) => c.plotId === id).length;
    if (cycles) {
      throw new Error(
        `This plot is referenced by ${cycles} crop cycle(s), so it cannot be removed.`,
      );
    }
    db.plots = db.plots.filter((p) => p.id !== id);
  });
}

export async function plotOptions(
  farmerId?: ID,
): Promise<Array<{ value: string; label: string }>> {
  const db = getDb();
  const plots = farmerId
    ? db.plots.filter((p) => p.farmerId === farmerId)
    : db.plots;
  return delay(
    plots
      .map((p) => ({ value: p.id, label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    50,
  );
}
