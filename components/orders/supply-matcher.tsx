"use client";

import * as React from "react";
import { cn } from "cn";
import { Check, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormGrid } from "@/components/form/field";
import { FormSelect } from "@/components/form/form-select";
import { StatusBadge } from "@/components/status-badge";
import { listSupplyCandidates, type SupplyCandidate } from "@/lib/services/orders";
import { listCrops, type CropView } from "@/lib/services/crops";
import { tierPriceFromPrices } from "@/lib/pricing";
import { money, moneyPrecise, num, prettyDate } from "@/lib/format";
import type { ID } from "@/lib/types";

export interface DraftLine {
  cropCycleId: ID;
  quantityKg: number;
  pricePerKg: number;
  /**
   * Set once staff type a price. Until then the price follows the buyer price
   * tier for the order's total quantity and updates as lines are added.
   */
  priceEdited?: boolean;
}

/**
 * Supply matching.
 *
 * A buyer often needs more than any one farmer can supply, so this screen lists
 * every crop cycle currently holding stock of the requested crop — across all
 * farmers — and lets staff draw a quantity from as many of them as it takes to
 * reach the target. Each allocation becomes one line item on the order.
 */
export function SupplyMatcher({
  lines,
  onLinesChange,
  excludeOrderId,
  reloadKey = 0,
  initialCropId,
  initialTargetKg,
}: {
  lines: DraftLine[];
  onLinesChange: (lines: DraftLine[]) => void;
  /** When editing an order, its own lines must not count as already sold. */
  excludeOrderId?: ID;
  /** Bump to re-read availability after the order is saved. */
  reloadKey?: number;
  /** Crop to preselect, e.g. the crop of the request being confirmed. */
  initialCropId?: ID;
  /** Target quantity to prefill, e.g. the kg the buyer asked for. */
  initialTargetKg?: number;
}) {
  const [cropId, setCropId] = React.useState(initialCropId ?? "");
  const [targetKg, setTargetKg] = React.useState(
    initialTargetKg ? String(initialTargetKg) : "",
  );
  const [query, setQuery] = React.useState("");

  // The loaded slice is stamped with the request it answered, so staleness is
  // derived rather than tracked in a separate loading flag.
  const requestKey = `${excludeOrderId ?? ""}#${reloadKey}`;
  const [loaded, setLoaded] = React.useState<{
    key: string;
    candidates: SupplyCandidate[];
    crops: CropView[];
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listSupplyCandidates(null, excludeOrderId),
      listCrops(),
    ]).then(([next, cropList]) => {
      if (!cancelled) {
        setLoaded({ key: requestKey, candidates: next, crops: cropList });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [excludeOrderId, requestKey]);

  const loading = loaded?.key !== requestKey;
  const candidates = React.useMemo(() => loaded?.candidates ?? [], [loaded]);
  const crops = React.useMemo(() => loaded?.crops ?? [], [loaded]);

  const byId = React.useMemo(
    () => new Map(candidates.map((c) => [c.cycleId, c])),
    [candidates],
  );

  /** Crops that actually have stock, with the total available beside them. */
  const cropOptions = React.useMemo(() => {
    const map = new Map<string, { name: string; kg: number; farmers: Set<string> }>();
    for (const c of candidates) {
      const entry = map.get(c.cropId) ?? {
        name: c.cropName,
        kg: 0,
        farmers: new Set<string>(),
      };
      entry.kg += c.availableKg;
      entry.farmers.add(c.farmerId);
      map.set(c.cropId, entry);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].kg - a[1].kg)
      .map(([id, e]) => ({
        value: id,
        label: e.name,
        description: `${num(e.kg)} kg available from ${e.farmers.size} farmer${e.farmers.size === 1 ? "" : "s"}`,
      }));
  }, [candidates]);

  /**
   * Options for the crop picker. A preselected crop with no harvested stock (for
   * example one just added to the catalog) is shown disabled, so the picker never
   * displays a raw id.
   */
  const selectOptions = React.useMemo(() => {
    if (cropOptions.length === 0) {
      return crops.map((c) => ({
        value: c.id,
        label: c.name,
        description: "No harvested stock available",
        disabled: true,
      }));
    }
    const missing = cropId && !cropOptions.some((o) => o.value === cropId);
    const crop = missing ? crops.find((c) => c.id === cropId) : undefined;
    return crop
      ? [
          ...cropOptions,
          {
            value: crop.id,
            label: crop.name,
            description: "No harvested stock available",
            disabled: true,
          },
        ]
      : cropOptions;
  }, [cropOptions, crops, cropId]);

  const allocatedFor = React.useCallback(
    (cycleId: ID) =>
      lines
        .filter((l) => l.cropCycleId === cycleId)
        .reduce((s, l) => s + l.quantityKg, 0),
    [lines],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (cropId && c.cropId !== cropId) return false;
      if (!q) return true;
      return [c.farmerName, c.plotName, c.province, c.cycleCode]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [candidates, cropId, query]);

  /** Kilos allocated per crop, which decide each crop's buyer price tier. */
  const cropTotals = React.useMemo(() => {
    const totals = new Map<string, number>();
    for (const l of lines) {
      const c = byId.get(l.cropCycleId);
      if (c) totals.set(c.cropId, (totals.get(c.cropId) ?? 0) + l.quantityKg);
    }
    return totals;
  }, [lines, byId]);

  /** Lines whose price has not been typed follow the tier for the current total. */
  const reprice = (next: DraftLine[]): DraftLine[] => {
    const totals = new Map<string, number>();
    for (const l of next) {
      const c = byId.get(l.cropCycleId);
      if (c) totals.set(c.cropId, (totals.get(c.cropId) ?? 0) + l.quantityKg);
    }
    return next.map((l) => {
      const c = byId.get(l.cropCycleId);
      if (!c || l.priceEdited) return l;
      const tier = tierPriceFromPrices(c.buyerPrices, totals.get(c.cropId) ?? 0);
      return { ...l, pricePerKg: tier ?? l.pricePerKg };
    });
  };

  const totalAllocated = lines.reduce((s, l) => s + l.quantityKg, 0);
  const target = Number(targetKg) || 0;
  const remaining = Math.max(0, target - totalAllocated);
  const totalValue = lines.reduce((s, l) => s + l.quantityKg * l.pricePerKg, 0);

  const allocate = (candidate: SupplyCandidate) => {
    const already = allocatedFor(candidate.cycleId);
    const room = candidate.availableKg - already;
    if (room <= 0) return;
    const qty = target > 0 ? Math.min(room, Math.max(remaining, 0) || room) : room;
    const next = [...lines];
    const existing = next.findIndex((l) => l.cropCycleId === candidate.cycleId);
    if (existing >= 0) {
      next[existing] = {
        ...next[existing]!,
        quantityKg: Math.min(candidate.availableKg, next[existing]!.quantityKg + qty),
      };
    } else {
      next.push({
        cropCycleId: candidate.cycleId,
        quantityKg: qty,
        pricePerKg: 0,
      });
    }
    onLinesChange(reprice(next));
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    const next = [...lines];
    const line = next[index];
    if (!line) return;
    next[index] = {
      ...line,
      ...patch,
      ...(patch.pricePerKg !== undefined ? { priceEdited: true } : {}),
    };
    onLinesChange(reprice(next));
  };

  /** "buyer price $0.60/kg" for a crop at the quantity being matched. */
  const tierLabel = (candidate: SupplyCandidate) => {
    const kg = cropTotals.get(candidate.cropId) || target;
    const tier = tierPriceFromPrices(candidate.buyerPrices, kg);
    return tier === null ? "no buyer price set" : `buyer price ${moneyPrecise(tier)}/kg`;
  };

  const lineTierHint = (candidate: SupplyCandidate) => {
    const kg = cropTotals.get(candidate.cropId) ?? 0;
    const tier = tierPriceFromPrices(candidate.buyerPrices, kg);
    return tier === null
      ? "No buyer price set for this crop. Enter the agreed price."
      : `Buyer tier ${moneyPrecise(tier)}/kg at ${num(kg)} kg`;
  };

  return (
    <div className="space-y-4">
      {/* --------------------------------------------- 1. what is needed */}
      <section className="card-surface p-4 sm:p-6">
        <h3 className="text-base font-semibold">1 · What does the buyer need?</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick the crop and the volume, then draw from as many farmers as it takes.
        </p>
        <FormGrid className="mt-4">
          <Field label="Crop type" required>
            <FormSelect
              value={cropId}
              onChange={setCropId}
              options={selectOptions}
              placeholder="Select a crop"
            />
          </Field>
          <Field label="Target quantity (kg)" hint="Optional — drives the running total">
            <Input
              type="number"
              min={0}
              step="1"
              value={targetKg}
              onChange={(e) => setTargetKg(e.target.value)}
              placeholder="e.g. 1000"
            />
          </Field>
        </FormGrid>
      </section>

      {/* ------------------------------------------------ running total */}
      <section
        className={cn(
          "rounded-xl border p-4",
          target > 0 && totalAllocated >= target
            ? "border-primary/40 bg-brand-softer"
            : "border-border bg-card",
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Allocated</p>
            <p className="text-2xl font-semibold tabular-nums">
              {num(totalAllocated)}
              {target > 0 ? (
                <span className="text-muted-foreground"> / {num(target)}</span>
              ) : null}{" "}
              <span className="text-base font-normal text-muted-foreground">kg</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {lines.length} line item{lines.length === 1 ? "" : "s"} ·{" "}
              {new Set(lines.map((l) => byId.get(l.cropCycleId)?.farmerId)).size}{" "}
              farmer(s)
            </p>
            <p className="text-lg font-semibold tabular-nums">{money(totalValue)}</p>
          </div>
        </div>

        {target > 0 ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  totalAllocated >= target ? "bg-primary" : "bg-primary/60",
                )}
                style={{
                  width: `${Math.min(100, target > 0 ? (totalAllocated / target) * 100 : 0)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {totalAllocated >= target ? (
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <Check className="size-3.5" />
                  Target met
                  {totalAllocated > target
                    ? ` — ${num(totalAllocated - target)} kg over`
                    : ""}
                </span>
              ) : (
                `${num(remaining)} kg still to allocate`
              )}
            </p>
          </>
        ) : null}
      </section>

      {/* --------------------------------------------- 2. available supply */}
      <section className="card-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Users className="size-5 text-primary" />
              2 · Available supply across all farmers
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Harvested and not yet committed to another order.
            </p>
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter farmers or plots…"
              aria-label="Filter available supply"
              className="h-9 pl-9"
            />
          </div>
        </header>

        {loading ? (
          <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Reading available stock…
          </p>
        ) : !cropId ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Select a crop above to see which farmers can supply it.
          </p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No farmer currently has that crop available to sell.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((c) => {
              const already = allocatedFor(c.cycleId);
              const room = c.availableKg - already;
              return (
                <li
                  key={c.cycleId}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.farmerName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.plotName} · {c.province} · {c.cycleCode}
                      {c.lastHarvestDate
                        ? ` · last picked ${prettyDate(c.lastHarvestDate)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <StatusBadge status={c.status} />
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {num(room)} kg
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {already > 0
                          ? `${num(already)} kg allocated here`
                          : tierLabel(c)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={already > 0 ? "outline" : "default"}
                      disabled={room <= 0}
                      onClick={() => allocate(c)}
                    >
                      <Plus className="size-3.5" />
                      Allocate
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* --------------------------------------------------- 3. line items */}
      <section className="card-surface">
        <header className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">3 · Order line items</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Farmer, plot and crop are inherited from the crop cycle — set the
            quantity and the price agreed for each farmer.
          </p>
        </header>

        {lines.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing allocated yet. An order needs at least one line item.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((line, index) => {
              const candidate = byId.get(line.cropCycleId);
              const max = candidate?.availableKg ?? line.quantityKg;
              const over = line.quantityKg > max;
              return (
                <li key={`${line.cropCycleId}-${index}`} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {candidate?.farmerName ?? "Unknown farmer"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {candidate?.cropName} · {candidate?.plotName} ·{" "}
                        {candidate?.cycleCode}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove line item"
                      onClick={() =>
                        onLinesChange(reprice(lines.filter((_, i) => i !== index)))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field
                      label="Quantity (kg)"
                      hint={`Max ${num(max)} kg available`}
                      error={over ? `Only ${num(max)} kg is available.` : null}
                    >
                      <Input
                        type="number"
                        min={0}
                        max={max}
                        step="0.1"
                        value={line.quantityKg}
                        onChange={(e) =>
                          updateLine(index, { quantityKg: Number(e.target.value) })
                        }
                        aria-invalid={over || undefined}
                      />
                    </Field>
                    <Field
                      label="Price ($/kg)"
                      hint={
                        candidate
                          ? lineTierHint(candidate)
                          : undefined
                      }
                    >
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.pricePerKg}
                        onChange={(e) =>
                          updateLine(index, { pricePerKg: Number(e.target.value) })
                        }
                      />
                    </Field>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">Line total</p>
                      <div className="flex h-9 items-center rounded-lg bg-muted/60 px-3 text-sm font-semibold tabular-nums">
                        {money(line.quantityKg * line.pricePerKg)}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-4 text-sm font-semibold">
            <span>{num(totalAllocated)} kg total</span>
            <span className="tabular-nums">{money(totalValue)}</span>
          </div>
        ) : null}
      </section>
    </div>
  );
}
