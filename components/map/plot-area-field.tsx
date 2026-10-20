"use client";

import * as React from "react";
import { cn } from "cn";
import { Crosshair, Info, PencilRuler, Satellite, Trash2 } from "lucide-react";
import { BoundaryMap } from "./boundary-map";
import { Field, FormGrid } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { polygonAreaHectares, polygonAreaSqm, polygonCentroid, rectangleAreaHectares } from "@/lib/geo";
import { num } from "@/lib/format";
import type { AreaSource, LatLng } from "@/lib/types";

export interface AreaValue {
  areaSource: AreaSource;
  boundary: LatLng[] | null;
  manualLengthM: number | null;
  manualWidthM: number | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Plot area capture.
 *
 * Tracing the boundary on satellite imagery is the primary path: the polygon's
 * area is calculated with Turf and the GPS coordinate is taken from its centre.
 * The manual length x width entry exists only for plots with no usable imagery,
 * and switching between the two swaps which one owns the area — the plot never
 * carries two competing figures.
 */
export function PlotAreaField({
  value,
  onChange,
  error,
}: {
  value: AreaValue;
  onChange: (next: AreaValue) => void;
  error?: string | null;
}) {
  const isPolygon = value.areaSource === "polygon";

  const polygonHa = polygonAreaHectares(value.boundary);
  const manualHa = rectangleAreaHectares(value.manualLengthM, value.manualWidthM);
  const areaHa = isPolygon ? polygonHa : manualHa;

  const setSource = (areaSource: AreaSource) => {
    if (areaSource === value.areaSource) return;
    onChange(
      areaSource === "polygon"
        ? { ...value, areaSource, manualLengthM: null, manualWidthM: null }
        : { ...value, areaSource, boundary: null },
    );
  };

  const handleBoundary = (ring: LatLng[] | null) => {
    const centroid = polygonCentroid(ring);
    onChange({
      ...value,
      boundary: ring,
      latitude: centroid?.[0] ?? value.latitude,
      longitude: centroid?.[1] ?? value.longitude,
    });
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------- method switch */}
      <div
        role="tablist"
        aria-label="Area measurement method"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <MethodTab
          selected={isPolygon}
          onSelect={() => setSource("polygon")}
          icon={<Satellite className="size-4" />}
          title="Trace on map"
          hint="Recommended — area is calculated from the shape"
        />
        <MethodTab
          selected={!isPolygon}
          onSelect={() => setSource("manual")}
          icon={<PencilRuler className="size-4" />}
          title="Manual length × width"
          hint="Fallback when imagery is unusable"
        />
      </div>

      {isPolygon ? (
        <div className="space-y-3">
          <div className="h-[320px] overflow-hidden rounded-xl sm:h-[400px]">
            <BoundaryMap
              boundary={value.boundary}
              onChange={handleBoundary}
              center={
                value.latitude != null && value.longitude != null
                  ? [value.latitude, value.longitude]
                  : null
              }
            />
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Use the polygon or rectangle tool in the map&apos;s top-left corner to trace
            the field boundary. Drag the vertices to adjust it — the area updates as
            you go.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-softer p-3">
            <div>
              <p className="text-xs text-muted-foreground">Calculated area</p>
              <p className="text-lg font-semibold tabular-nums">
                {value.boundary ? `${num(polygonHa, 3)} ha` : "Not traced yet"}
              </p>
              {value.boundary ? (
                <p className="text-xs text-muted-foreground">
                  {num(polygonAreaSqm(value.boundary), 0)} m² ·{" "}
                  {value.boundary.length} points
                </p>
              ) : null}
            </div>
            {value.boundary ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...value, boundary: null })}
              >
                <Trash2 className="size-3.5" />
                Clear boundary
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <FormGrid>
            <Field label="Length (m)" hint="Longest side of the plot">
              <Input
                type="number"
                min={0}
                step="0.1"
                value={value.manualLengthM ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    manualLengthM: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="e.g. 120"
              />
            </Field>
            <Field label="Width (m)" hint="Measured across the plot">
              <Input
                type="number"
                min={0}
                step="0.1"
                value={value.manualWidthM ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    manualWidthM: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="e.g. 65"
              />
            </Field>
          </FormGrid>

          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Calculated area</p>
            <p className="text-lg font-semibold tabular-nums">
              {manualHa > 0 ? `${num(manualHa, 3)} ha` : "Enter both dimensions"}
            </p>
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Manual dimensions assume a rectangle, so they only approximate an
            irregular field. Trace the boundary on the next visit if imagery allows.
          </p>
        </div>
      )}

      {/* --------------------------------------------- GPS coordinate */}
      <FormGrid>
        <Field
          label="Latitude"
          hint={isPolygon ? "Filled from the traced centre" : "GPS coordinate"}
        >
          <Input
            type="number"
            step="0.000001"
            value={value.latitude ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                latitude: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="e.g. 13.3633"
          />
        </Field>
        <Field
          label="Longitude"
          hint={isPolygon ? "Filled from the traced centre" : "GPS coordinate"}
        >
          <Input
            type="number"
            step="0.000001"
            value={value.longitude ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                longitude: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="e.g. 103.8564"
          />
        </Field>
      </FormGrid>

      {areaHa <= 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Crosshair className="size-3.5" />
          The plot will be saved without an area until a boundary is traced or
          dimensions are entered.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function MethodTab({
  selected,
  onSelect,
  icon,
  title,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-primary bg-brand-softer ring-1 ring-primary/30"
          : "border-border hover:bg-hover-tint",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
