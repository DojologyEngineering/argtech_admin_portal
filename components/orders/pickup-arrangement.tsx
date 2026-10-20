"use client";

import * as React from "react";
import { toast } from "sonner";
import { CircleCheck, ExternalLink, MapPin, TriangleAlert } from "lucide-react";
import { DetailItem, Field, FormGrid } from "@/components/form/field";
import { FormSelect } from "@/components/form/form-select";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { arrangePickup, type PurchaseOrderView } from "@/lib/services/orders";
import {
  listPickupPoints,
  type PickupPointView,
} from "@/lib/services/pickup-points";
import { prettyDate } from "@/lib/format";
import type { PickupDetails } from "@/lib/types";

/** "8:00 to 10:00" -> { start: "08:00", end: "10:00" } for the time inputs. */
function parseWindow(window: string): { start: string; end: string } {
  const [from = "", to = ""] = window.split(" to ").map((part) => part.trim());
  const pad = (t: string) => {
    const [h = "", m = ""] = t.split(":");
    return h && m ? `${h.padStart(2, "0")}:${m}` : "";
  };
  return { start: pad(from), end: pad(to) };
}

interface FormState {
  pointId: string;
  date: string;
  start: string;
  end: string;
  collectorName: string;
  collectorPhone: string;
  instructions: string;
}

function toForm(order: PurchaseOrderView, pickup: PickupDetails): FormState {
  const window = parseWindow(pickup.timeWindow);
  return {
    pointId: pickup.pointId ?? "",
    // Until it is arranged, start from the date the buyer wished for.
    date: pickup.date ?? order.deliveryDate,
    start: window.start,
    end: window.end,
    collectorName: pickup.collectorName,
    collectorPhone: pickup.collectorPhone,
    instructions: pickup.instructions,
  };
}

type Errors = Partial<Record<"pointId" | "date" | "window", string>>;

/**
 * Pickup arrangement. Staff choose the meeting point, date, time window and
 * collector, then share it with the buyer. Editable while the order is
 * Confirmed; read-only once it has been picked up.
 */
export function PickupArrangement({
  order,
  onSaved,
}: {
  order: PurchaseOrderView;
  onSaved: () => void;
}) {
  const pickup = order.pickup;
  const [form, setForm] = React.useState<FormState | null>(() =>
    pickup ? toForm(order, pickup) : null,
  );
  const [points, setPoints] = React.useState<PickupPointView[]>([]);
  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void listPickupPoints().then(setPoints);
  }, []);

  if (!pickup || !form) return null;

  const editable = order.status === "Confirmed";
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  // Active points, plus the saved one even if it was deactivated since.
  const choices = points.filter((p) => p.active || p.id === pickup.pointId);
  const chosen = points.find((p) => p.id === form.pointId);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(order, pickup));

  const save = async () => {
    const next: Errors = {};
    if (!form.pointId) next.pointId = "Choose a pickup point.";
    if (!form.date) next.date = "Choose a pickup date.";
    if (!form.start || !form.end) next.window = "Enter the start and end time.";
    else if (form.start >= form.end) next.window = "The window must end after it starts.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Check the pickup details.");
      return;
    }

    setSaving(true);
    try {
      await arrangePickup(order.id, {
        pointId: form.pointId,
        date: form.date,
        startTime: form.start,
        endTime: form.end,
        collectorName: form.collectorName,
        collectorPhone: form.collectorPhone,
        instructions: form.instructions,
      });
      toast.success("Pickup saved and shared with the buyer app.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the pickup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="size-5 text-primary" />
            Pickup arrangement
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Where and when the buyer&apos;s representative collects the produce.
          </p>
        </div>
        <StatusBadge status={pickup.state} className="h-7 px-3" />
      </div>

      {editable ? (
        <div className="mt-4 space-y-4">
          <FormGrid>
            <Field label="Pickup point" required error={errors.pointId}>
              <FormSelect
                value={form.pointId}
                onChange={(v) => set("pointId", v)}
                options={choices.map((p) => ({
                  value: p.id,
                  label: p.name,
                  description: p.district,
                }))}
                placeholder={
                  choices.length === 0 ? "No active pickup points" : "Select a pickup point"
                }
                disabled={choices.length === 0}
                invalid={Boolean(errors.pointId)}
              />
            </Field>
            <Field label="Pickup date" required error={errors.date} htmlFor="pickupDate">
              <Input
                id="pickupDate"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                aria-invalid={Boolean(errors.date) || undefined}
              />
            </Field>
            <Field
              label="Time window"
              required
              error={errors.window}
              className="sm:col-span-2"
            >
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={form.start}
                  onChange={(e) => set("start", e.target.value)}
                  aria-label="Window start"
                  aria-invalid={Boolean(errors.window) || undefined}
                  className="max-w-36"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={form.end}
                  onChange={(e) => set("end", e.target.value)}
                  aria-label="Window end"
                  aria-invalid={Boolean(errors.window) || undefined}
                  className="max-w-36"
                />
              </div>
            </Field>
            <Field label="Collector name" htmlFor="collectorName">
              <Input
                id="collectorName"
                value={form.collectorName}
                onChange={(e) => set("collectorName", e.target.value)}
                placeholder="Who collects for the buyer"
              />
            </Field>
            <Field label="Collector phone" htmlFor="collectorPhone">
              <Input
                id="collectorPhone"
                type="tel"
                value={form.collectorPhone}
                onChange={(e) => set("collectorPhone", e.target.value)}
                placeholder="+855 …"
              />
            </Field>
          </FormGrid>

          <Field label="Instructions (optional)" htmlFor="pickupInstructions">
            <Textarea
              id="pickupInstructions"
              rows={2}
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="e.g. Bring crates. Ask for the ARG TECH agent at the gate."
            />
          </Field>

          {chosen ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span>
                <span className="text-muted-foreground">Landmark: </span>
                {chosen.landmark || "—"}
              </span>
              {chosen.mapUrl ? (
                <a
                  href={chosen.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open in Google Maps
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={saving || choices.length === 0}>
              {saving ? "Saving…" : "Save and share with buyer"}
            </Button>
            {pickup.state === "Arranged" && !dirty ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <CircleCheck className="size-4" aria-hidden />
                Shared with the buyer app
                {pickup.sharedAt ? ` on ${prettyDate(pickup.sharedAt)}` : ""}
              </p>
            ) : pickup.state === "Arranged" ? (
              <p className="text-xs text-muted-foreground">
                Unsaved changes. Save to update what the buyer sees.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <DetailItem
            label="Pickup point"
            value={
              pickup.pointName
                ? `${pickup.pointName}${pickup.district ? `, ${pickup.district}` : ""}`
                : "—"
            }
            className="col-span-2"
          />
          <DetailItem label="Landmark" value={pickup.landmark || "—"} />
          <DetailItem
            label="Map"
            value={
              pickup.mapUrl ? (
                <a
                  href={pickup.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open in Google Maps
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                "—"
              )
            }
          />
          <DetailItem
            label={pickup.state === "Picked up" ? "Picked up on" : "Pickup date"}
            value={prettyDate(pickup.date)}
          />
          <DetailItem label="Time window" value={pickup.timeWindow || "—"} />
          <DetailItem
            label="Collector"
            value={
              pickup.collectorName
                ? `${pickup.collectorName}${pickup.collectorPhone ? ` · ${pickup.collectorPhone}` : ""}`
                : "—"
            }
            className="col-span-2"
          />
          {pickup.instructions ? (
            <DetailItem
              label="Instructions"
              value={pickup.instructions}
              className="col-span-2 sm:col-span-4"
            />
          ) : null}
        </dl>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
        This is a meeting point. Never choose a farm, and never show farmer
        details to the buyer.
      </p>
    </section>
  );
}
