"use client";

import * as React from "react";
import { cn } from "cn";
import { BarChart3, Table as TableIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { num, percent } from "@/lib/format";
import type { HarvestPoint } from "@/lib/services/dashboard";

/**
 * Harvest volume by month.
 *
 * One series, so there is no legend — the heading names what is plotted. The
 * peak month carries a direct label; every other value is reachable from the
 * axis, the per-bar tooltip, and the table view, which is always one tap away.
 */
export function HarvestChart({
  data,
  trend,
}: {
  data: HarvestPoint[];
  trend: number | null;
}) {
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const [hovered, setHovered] = React.useState<string | null>(null);

  const max = Math.max(0, ...data.map((d) => d.kg));
  const axisMax = niceMax(max);
  const ticks = [axisMax, axisMax / 2, 0];
  const peakKey = data.reduce<HarvestPoint | null>(
    (best, d) => (d.kg > (best?.kg ?? -1) ? d : best),
    null,
  )?.key;
  const hasData = max > 0;

  return (
    <section className="flex h-full flex-col card-surface p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Harvest Overview</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Volume picked per month, in kilograms. The latest month is month to date.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {trend !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                trend >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-destructive",
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {percent(Math.abs(trend))} vs same days last month
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={view === "chart" ? "Show as table" : "Show as chart"}
            title={view === "chart" ? "Show as table" : "Show as chart"}
            onClick={() => setView(view === "chart" ? "table" : "chart")}
          >
            {view === "chart" ? (
              <TableIcon className="size-4" />
            ) : (
              <BarChart3 className="size-4" />
            )}
          </Button>
        </div>
      </header>

      {view === "table" ? (
        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Harvest volume per month in kilograms</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 text-left text-xs font-medium text-muted-foreground">
                Month
              </th>
              <th scope="col" className="py-2 text-right text-xs font-medium text-muted-foreground">
                Harvested
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.key} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 text-left font-normal">
                  {point.label}
                </th>
                <td className="py-2 text-right tabular-nums">{num(point.kg)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-5 flex flex-1 flex-col">
          <div className="flex flex-1 gap-3">
            {/* y-axis ticks, rounded to clean numbers */}
            <div className="flex min-h-52 w-12 shrink-0 flex-col justify-between py-0 text-right text-xs text-muted-foreground tabular-nums">
              {ticks.map((tick) => (
                <span key={tick} className="-translate-y-1.5">
                  {num(tick, 0)}
                </span>
              ))}
            </div>

            <div className="relative min-h-52 min-w-0 flex-1">
              {/* recessive hairline gridlines */}
              <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
                {ticks.map((tick) => (
                  <span key={tick} className="h-px w-full bg-border" />
                ))}
              </div>

              <ul className="absolute inset-0 flex items-end gap-1">
                {data.map((point) => {
                  const heightPct = axisMax > 0 ? (point.kg / axisMax) * 100 : 0;
                  const isHovered = hovered === point.key;
                  return (
                    <li
                      key={point.key}
                      className="group relative flex h-full flex-1 items-end justify-center"
                      onPointerEnter={() => setHovered(point.key)}
                      onPointerLeave={() => setHovered(null)}
                    >
                      {/* the whole band is the hit target, not just the painted bar */}
                      <button
                        type="button"
                        onFocus={() => setHovered(point.key)}
                        onBlur={() => setHovered(null)}
                        aria-label={`${point.label}: ${num(point.kg)} kilograms`}
                        className="absolute inset-0 cursor-default rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      />

                      {point.key === peakKey && point.kg > 0 ? (
                        <span
                          className="absolute right-0 left-0 text-center text-xs font-medium text-foreground"
                          style={{ bottom: `calc(${heightPct}% + 6px)` }}
                        >
                          {num(point.kg)}
                        </span>
                      ) : null}

                      <span
                        className={cn(
                          "pointer-events-none w-full max-w-7 rounded-t-[6px] transition-opacity",
                          isHovered ? "opacity-100" : "opacity-85",
                        )}
                        style={{
                          height: `${Math.max(point.kg > 0 ? 2 : 0, heightPct)}%`,
                          backgroundColor:
                            point.key === data.at(-1)?.key
                              ? "var(--chart-1)"
                              : "var(--chart-2)",
                        }}
                      />

                      {isHovered ? (
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-popover px-2.5 py-1.5 text-center shadow-md ring-1 ring-foreground/10">
                          <span className="block text-sm font-semibold whitespace-nowrap tabular-nums">
                            {num(point.kg)} kg
                          </span>
                          <span className="block text-xs whitespace-nowrap text-muted-foreground">
                            {point.label}
                          </span>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="mt-2 flex gap-3">
            <span className="w-12 shrink-0" />
            <ul className="flex min-w-0 flex-1 gap-1">
              {data.map((point) => (
                <li
                  key={point.key}
                  className="flex-1 text-center text-xs text-muted-foreground"
                >
                  {point.label}
                </li>
              ))}
            </ul>
          </div>

          {!hasData ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              No harvest has been logged in the last six months.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** Rounds an axis maximum up to a clean 1 / 2 / 5 x 10^n value. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}
