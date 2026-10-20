"use client";

import * as React from "react";
import { MapPin, Pencil, Satellite } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { DetailItem } from "@/components/form/field";
import { StatusBadge } from "@/components/status-badge";
import { BoundaryMap } from "@/components/map/boundary-map";
import { Button } from "@/components/ui/button";
import { dash, num, prettyDate } from "@/lib/format";
import { polygonAreaSqm } from "@/lib/geo";
import type { PlotView } from "@/lib/services/plots";

export function PlotDetailDialog({
  open,
  onOpenChange,
  plot,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot: PlotView | null;
  onEdit: () => void;
}) {
  if (!plot) return null;

  const hasBoundary = Boolean(plot.boundary && plot.boundary.length >= 3);

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title="Plot Details" size="md">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary">
              <MapPin className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">{plot.name}</h3>
              <p className="truncate text-xs text-muted-foreground">
                {plot.farmerName} · {plot.province}, {plot.district}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={plot.ownershipType} />
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
        </div>

        {/* ------------------------------------------------ traced boundary */}
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Satellite className="size-4 text-muted-foreground" />
            Boundary
          </h4>
          {hasBoundary ? (
            <div className="h-64 overflow-hidden rounded-xl">
              <BoundaryMap
                boundary={plot.boundary}
                onChange={() => undefined}
                center={
                  plot.latitude != null && plot.longitude != null
                    ? [plot.latitude, plot.longitude]
                    : null
                }
                readOnly
              />
            </div>
          ) : (
            <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              No boundary traced. Area came from manual length × width
              {plot.manualLengthM && plot.manualWidthM
                ? ` (${num(plot.manualLengthM)} m × ${num(plot.manualWidthM)} m)`
                : ""}
              .
            </p>
          )}
        </section>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <DetailItem
            label="Area"
            value={
              plot.areaHectares > 0 ? `${num(plot.areaHectares, 3)} ha` : "Not measured"
            }
          />
          <DetailItem
            label="Area source"
            value={hasBoundary ? "Traced polygon" : "Manual dimensions"}
          />
          <DetailItem
            label="Area (m²)"
            value={
              hasBoundary
                ? num(polygonAreaSqm(plot.boundary), 0)
                : plot.areaHectares > 0
                  ? num(plot.areaHectares * 10000, 0)
                  : "—"
            }
          />
          <DetailItem label="Location" value={`${dash(plot.commune)}, ${dash(plot.village)}`} />
          <DetailItem label="Soil Type" value={dash(plot.soilType)} />
          <DetailItem label="Irrigation" value={dash(plot.irrigationType)} />
          <DetailItem label="Infrastructure" value={dash(plot.infrastructure)} />
          <DetailItem
            label="Coordinates"
            value={
              plot.latitude != null && plot.longitude != null
                ? `${plot.latitude.toFixed(5)}, ${plot.longitude.toFixed(5)}`
                : "—"
            }
          />
          <DetailItem label="Crop cycles" value={plot.cycleCount} />
          <DetailItem label="Registered" value={prettyDate(plot.createdAt)} />
          <DetailItem
            label="Remark"
            value={dash(plot.remark)}
            className="col-span-2 sm:col-span-3"
          />
        </dl>
      </div>
    </AppDialog>
  );
}
