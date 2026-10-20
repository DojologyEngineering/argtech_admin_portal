"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleCheck,
  Leaf,
  Loader2,
  Package,
  Pencil,
  Percent,
  Scissors,
  TriangleAlert,
  Undo2,
  Wallet,
} from "lucide-react";
import { cn } from "cn";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { OrderStatusBadge, StatusBadge } from "@/components/status-badge";
import { DetailItem } from "@/components/form/field";
import { CycleFormDialog } from "@/components/cycles/cycle-form-dialog";
import { ActivityLogCard, HarvestLogCard } from "@/components/cycles/cycle-logs";
import { Button } from "@/components/ui/button";
import {
  getCycle,
  setCycleComplete,
  type CropCycleView,
} from "@/lib/services/cycles";
import {
  listAllocationsForCycle,
  type CycleAllocation,
} from "@/lib/services/orders";
import { money, moneyPrecise, num, percent, prettyDate } from "@/lib/format";
import type { EconomicsChip } from "@/lib/derive";
import { CYCLE_STATUSES } from "@/lib/types";

export default function CycleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cycleId = params.id;

  const [cycle, setCycle] = React.useState<CropCycleView | null>(null);
  const [allocations, setAllocations] = React.useState<CycleAllocation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  const refresh = React.useCallback(
    () =>
      Promise.all([getCycle(cycleId), listAllocationsForCycle(cycleId)]).then(
        ([next, allocs]) => {
          setCycle(next);
          setAllocations(allocs);
          setLoading(false);
        },
        () => {
          setNotFound(true);
          setLoading(false);
        },
      ),
    [cycleId],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading cycle…
      </div>
    );
  }

  if (notFound || !cycle) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
          That crop cycle no longer exists.
        </p>
      </div>
    );
  }

  const m = cycle.metrics;
  const e = cycle.economics;
  const isComplete = m.status === "Completed";
  const hasSales = allocations.length > 0;

  const toggleComplete = async () => {
    try {
      await setCycleComplete(cycle.id, !isComplete);
      toast.success(isComplete ? "Cycle reopened." : "Cycle marked complete.");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the cycle.");
    }
  };

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        title={`${cycle.cropName} · ${cycle.code}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{cycle.farmerName}</span>
            <span aria-hidden>·</span>
            <span>{cycle.plotName}</span>
            <span aria-hidden>·</span>
            <span>{cycle.cropVariety}</span>
          </span>
        }
        actions={
          <>
            <StatusBadge status={m.status} className="mr-1 h-8 px-3" />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button variant={isComplete ? "outline" : "default"} onClick={() => void toggleComplete()}>
              {isComplete ? (
                <>
                  <Undo2 className="size-4" />
                  Reopen cycle
                </>
              ) : (
                <>
                  <CircleCheck className="size-4" />
                  Mark cycle complete
                </>
              )}
            </Button>
          </>
        }
      />

      <StatusLadder current={m.status} />

      {/* ------------------------------------------------ supply position */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Supply position</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Scissors />}
            value={`${num(m.harvestedKg)} kg`}
            label="Harvested so far"
            hint={`${cycle.harvestLog.length} picking${cycle.harvestLog.length === 1 ? "" : "s"} logged`}
          />
          <StatCard
            icon={<Package />}
            value={`${num(m.soldKg)} kg`}
            label="Sold so far"
            hint={`Across ${allocations.length} order line${allocations.length === 1 ? "" : "s"}`}
          />
          <StatCard
            icon={<Leaf />}
            value={`${num(m.availableKg)} kg`}
            label="Available to sell"
            hint="Harvested minus sold"
          />
          <StatCard
            icon={<TriangleAlert />}
            value={`${num(m.unsoldSurplusKg)} kg`}
            label="Unsold surplus"
            hint="At risk of spoiling"
          />
        </div>
      </section>

      {/* --------------------------------------------- break-even & margin */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-4 sm:p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Percent className="size-5 text-primary" />
              Farmer economics
            </h3>
            {e.chip ? <EconomicsChipBadge chip={e.chip} /> : null}
          </div>
          <p className="mt-0.5 text-xs font-medium text-foreground">
            For the farmer. This is not ARG TECH revenue.
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            <DetailItem label="Total cost" value={money(e.totalCost)} />
            {e.breakEvenPerKg === null ? (
              <div className="col-span-2 flex items-end text-sm text-muted-foreground">
                Add expected output to see break-even
              </div>
            ) : (
              <>
                <DetailItem
                  label="Break-even price per kg"
                  value={
                    <span>
                      {moneyPrecise(e.breakEvenPerKg)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {e.basis} · {num(e.basisKg)} kg
                      </span>
                    </span>
                  }
                />
                <DetailItem
                  label="Tier price per kg"
                  value={
                    e.tierPricePerKg !== null ? (
                      moneyPrecise(e.tierPricePerKg)
                    ) : (
                      <span className="text-muted-foreground">Not set in Crop Management</span>
                    )
                  }
                />
                <DetailItem
                  label={`${e.basis} profit per kg`}
                  value={
                    e.profitPerKg !== null ? (
                      <span className={cn(e.profitPerKg <= 0 && "text-destructive")}>
                        {e.profitPerKg < 0 ? "−" : ""}
                        {moneyPrecise(Math.abs(e.profitPerKg))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  }
                />
                <DetailItem
                  label="Margin"
                  value={
                    e.margin !== null ? (
                      <span className={cn(e.margin <= 0 && "text-destructive")}>
                        {percent(e.margin)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  }
                />
              </>
            )}
          </dl>

          {hasSales ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4 sm:grid-cols-3">
              <DetailItem label="Total revenue" value={money(m.revenue)} />
              <DetailItem
                label="Margin on sales so far"
                value={
                  m.margin !== null ? (
                    <span className={cn(m.margin < 0 && "text-destructive")}>
                      {percent(m.margin)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No revenue yet</span>
                  )
                }
              />
            </dl>
          ) : null}

          <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            Break-even price = total cost (including labour) ÷ expected kg. Tier price comes from
            Crop Management.
          </p>
        </div>

        <div className="card-surface p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Wallet className="size-5 text-primary" />
            Cost breakdown
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <CostRow label="Seed" value={cycle.costs.seed} />
            <CostRow label="Fertilizer" value={cycle.costs.fertilizer} />
            <CostRow label="Labour (own and hired)" value={cycle.costs.labor} />
            <CostRow label="Other" value={cycle.costs.other} />
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{money(m.totalCost)}</span>
          </div>
          {hasSales ? (
            <div
              className={cn(
                "mt-3 rounded-lg px-3 py-2 text-xs",
                m.revenue >= m.totalCost
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
              )}
            >
              {m.revenue >= m.totalCost
                ? `Ahead by ${money(m.profit)} on sales so far.`
                : `${money(Math.abs(m.profit))} of cost still to recover from the remaining ${num(m.availableKg)} kg.`}
            </div>
          ) : null}
        </div>
      </section>

      {/* --------------------------------------------------------- logs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <HarvestLogCard
          cycleId={cycle.id}
          entries={cycle.harvestLog}
          soldKg={m.soldKg}
          onChanged={() => void refresh()}
        />
        <ActivityLogCard
          cycleId={cycle.id}
          activities={cycle.activities}
          onChanged={() => void refresh()}
        />
      </div>

      {/* -------------------------------------------------- allocations */}
      <section className="card-surface">
        <header className="border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Package className="size-5 text-primary" />
            Committed to purchase orders
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every order line drawing on this cycle. Their quantities are what
            &ldquo;sold so far&rdquo; adds up to.
          </p>
        </header>

        {allocations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing from this cycle has been committed to a buyer yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {allocations.map((a, index) => (
              <li
                key={`${a.orderId}-${index}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/orders/${a.orderId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {a.orderCode}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.buyerName} · ordered {prettyDate(a.orderDate)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <OrderStatusBadge status={a.status} method={a.method} />
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {num(a.quantityKg)} kg
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {moneyPrecise(a.pricePerKg)}/kg · {money(a.lineTotal)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------- production */}
      <section className="card-surface p-4 sm:p-6">
        <h3 className="text-base font-semibold">Production details</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Recorded by the field agent. Read-only here.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <DetailItem label="Production method" value={cycle.production.method || "—"} />
          <DetailItem
            label="Fertilizer type"
            value={cycle.production.fertilizerType || "—"}
          />
          <DetailItem
            label="Pesticide used"
            value={cycle.production.pesticideUsed || "—"}
          />
          <DetailItem
            label="Pesticide details"
            value={cycle.production.pesticideDetails || "—"}
          />
          <DetailItem
            label="Delivery frequency"
            value={cycle.production.deliveryFrequency || "Not set"}
          />
          <DetailItem
            label="Agent notes"
            value={cycle.production.notes || "—"}
            className="col-span-2 sm:col-span-3"
          />
        </dl>
      </section>

      {/* ------------------------------------------------------ details */}
      <section className="card-surface p-4 sm:p-6">
        <h3 className="text-base font-semibold">Schedule &amp; details</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <DetailItem label="Planting date" value={prettyDate(cycle.plantingDate)} />
          <DetailItem
            label="Expected harvest"
            value={prettyDate(cycle.expectedHarvestDate)}
          />
          <DetailItem
            label="Expected output"
            value={`${num(cycle.expectedOutputKg)} kg`}
          />
          <DetailItem
            label="Completed"
            value={cycle.completedAt ? prettyDate(cycle.completedAt) : "—"}
          />
          <DetailItem label="Created" value={prettyDate(cycle.createdAt)} />
          <DetailItem
            label="Remark"
            value={cycle.remark || "—"}
            className="col-span-2"
          />
        </dl>
      </section>

      {editOpen ? (
        <CycleFormDialog
          open
          onOpenChange={setEditOpen}
          cycle={cycle}
          onSaved={() => void refresh()}
        />
      ) : null}

      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/cycles")}>
          <ArrowLeft className="size-4" />
          Back to all cycles
        </Button>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/cycles"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to all cycles
    </Link>
  );
}

function EconomicsChipBadge({ chip }: { chip: EconomicsChip }) {
  const tone =
    chip === "Above break-even"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      : chip === "Thin margin"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
        : "bg-destructive/10 text-destructive";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        tone,
      )}
    >
      {chip}
    </span>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </li>
  );
}

/**
 * The four-stage ladder. Everything except the final step is derived from the
 * record, so the visual can never disagree with the computed status.
 */
function StatusLadder({ current }: { current: string }) {
  const index = CYCLE_STATUSES.indexOf(current as (typeof CYCLE_STATUSES)[number]);

  return (
    <ol className="flex flex-col gap-2 card-surface p-4 sm:p-6 sm:flex-row sm:items-center">
      {CYCLE_STATUSES.map((status, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li key={status} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                active && "bg-primary text-primary-foreground",
                done && "bg-brand-soft text-primary",
                !active && !done && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CircleCheck className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm whitespace-nowrap",
                active ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {status}
            </span>
            {i < CYCLE_STATUSES.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "ml-1 hidden h-px flex-1 sm:block",
                  done ? "bg-primary/40" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
