"use client";

import * as React from "react";
import { cn } from "cn";
import { Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupplyForecast, type ForecastGranularity, type SupplyForecast } from "@/lib/services/cycles";
import { num } from "@/lib/format";

/**
 * Forward supply projection.
 *
 * Sums expected output across every cycle still growing, grouped by crop and
 * bucketed by expected-harvest week or month — the view that answers "how much
 * of this crop should be ready by <date>" before anything has been picked.
 */
export function SupplyForecastView() {
  const [granularity, setGranularity] = React.useState<ForecastGranularity>("week");
  const [data, setData] = React.useState<SupplyForecast | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getSupplyForecast(granularity).then((next) => {
      if (!cancelled) setData(next);
    });
    return () => {
      cancelled = true;
    };
  }, [granularity]);

  // The response carries its own granularity, so staleness is derived rather
  // than tracked in a second piece of state.
  if (!data || data.granularity !== granularity) {
    return (
      <div className="flex items-center justify-center gap-2 card-surface px-6 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Building forecast…
      </div>
    );
  }

  const peak = Math.max(1, ...data.rows.flatMap((r) => r.cells.map((c) => c.expectedKg)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 card-surface p-3 sm:p-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="size-5 text-primary" />
            Supply Forecast
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {num(data.grandTotalKg)} kg expected across {data.activeCycleCount}{" "}
            active cycle{data.activeCycleCount === 1 ? "" : "s"} (Growing and
            Ready to Harvest)
          </p>
        </div>

        <div className="inline-flex rounded-full bg-muted p-1">
          {(["week", "month"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={granularity === value ? "default" : "ghost"}
              onClick={() => setGranularity(value)}
              className="rounded-full px-4 capitalize"
            >
              By {value}
            </Button>
          ))}
        </div>
      </div>

      {data.rows.length === 0 ? (
        <p className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
          No cycles are currently growing, so there is nothing to project.
        </p>
      ) : (
        <div className="overflow-x-auto card-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="px-5 py-4 text-left text-xs font-medium text-muted-foreground"
                >
                  Crop
                </th>
                {data.periods.map((period) => (
                  <th
                    key={period.key}
                    scope="col"
                    className="px-3 py-3 text-right text-xs font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {period.label}
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-5 py-4 text-right text-xs font-medium text-muted-foreground"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.cropId} className="border-b border-border last:border-0">
                  <th scope="row" className="px-5 py-4 text-left font-medium">
                    {row.cropName}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {row.cycleCount} cycle{row.cycleCount === 1 ? "" : "s"}
                    </span>
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.periodKey} className="px-3 py-3 text-right">
                      {cell.expectedKg > 0 ? (
                        <span className="inline-flex flex-col items-end gap-1">
                          <span className="text-sm font-medium tabular-nums">
                            {num(cell.expectedKg)} kg
                          </span>
                          <span
                            aria-hidden
                            className="h-1 rounded-full bg-primary/70"
                            style={{
                              width: `${Math.max(8, (cell.expectedKg / peak) * 64)}px`,
                            }}
                          />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-4 text-right font-semibold tabular-nums">
                    {num(row.totalKg)} kg
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/40">
                <th scope="row" className="px-5 py-4 text-left text-sm font-semibold">
                  All crops
                </th>
                {data.periods.map((period) => (
                  <td
                    key={period.key}
                    className={cn(
                      "px-3 py-3 text-right text-sm font-semibold tabular-nums",
                    )}
                  >
                    {num(data.totalsByPeriod[period.key] ?? 0)} kg
                  </td>
                ))}
                <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums">
                  {num(data.grandTotalKg)} kg
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Figures are the expected output recorded on each cycle, bucketed by its
        expected harvest date. Cycles already being picked are excluded — their
        real numbers live under Crop Cycles as available-to-sell.
      </p>
    </div>
  );
}
