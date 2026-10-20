"use client";

import * as React from "react";
import { toast } from "sonner";
import { ExternalLink, MapPin, Pencil, Plus } from "lucide-react";
import { FormDialog } from "@/components/app-dialog";
import { Field } from "@/components/form/field";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createPickupPoint,
  listPickupPoints,
  setPickupPointActive,
  updatePickupPoint,
  type PickupPointInput,
  type PickupPointView,
} from "@/lib/services/pickup-points";
import { PICKUP_DISTRICTS } from "@/lib/types";

const EMPTY: PickupPointInput = {
  name: "",
  district: "",
  landmark: "",
  mapUrl: "",
  active: true,
};

/**
 * Settings section: the public meeting points staff can choose for pickup
 * orders. Points are deactivated rather than deleted, so orders that used one
 * keep their history.
 */
export function PickupPointsSection() {
  const [points, setPoints] = React.useState<PickupPointView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PickupPointView | null>(null);

  const refresh = React.useCallback(
    () =>
      listPickupPoints().then((rows) => {
        setPoints(rows);
        setLoading(false);
      }),
    [],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = async (point: PickupPointView, active: boolean) => {
    try {
      await setPickupPointActive(point.id, active);
      toast.success(`${point.name} ${active ? "activated" : "deactivated"}.`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the point.");
    }
  };

  return (
    <section className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="size-5 text-primary" />
            Pickup points
          </h3>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Use a public meeting point such as a market or roadside spot, never a
            farm. Farmers stay anonymous to buyers.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          Add point
        </Button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : points.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No pickup points yet. Add one to arrange pickup orders.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-card overflow-hidden rounded-xl bg-muted/40">
          {points.map((point) => (
            <li
              key={point.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
            >
              <div className={point.active ? "min-w-0" : "min-w-0 opacity-60"}>
                <p className="text-sm font-medium">
                  {point.name}
                  {!point.active ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Inactive
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {point.district}
                  {point.landmark ? ` · ${point.landmark}` : ""}
                  {point.orderCount > 0
                    ? ` · used by ${point.orderCount} order${point.orderCount === 1 ? "" : "s"}`
                    : ""}
                </p>
                {point.mapUrl ? (
                  <a
                    href={point.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open in Google Maps
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`active-${point.id}`}
                    checked={point.active}
                    onCheckedChange={(checked) => void toggle(point, checked)}
                    aria-label={`${point.name} active`}
                  />
                  <Label
                    htmlFor={`active-${point.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    {point.active ? "Active" : "Inactive"}
                  </Label>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${point.name}`}
                  onClick={() => {
                    setEditing(point);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen ? (
        <PickupPointFormDialog
          open
          onOpenChange={setFormOpen}
          point={editing}
          onSaved={() => void refresh()}
        />
      ) : null}
    </section>
  );
}

function PickupPointFormDialog({
  open,
  onOpenChange,
  point,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: PickupPointView | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<PickupPointInput>(() =>
    point
      ? {
          name: point.name,
          district: point.district,
          landmark: point.landmark,
          mapUrl: point.mapUrl,
          active: point.active,
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<{ name?: string; district?: string; mapUrl?: string }>({});
  const [submitting, setSubmitting] = React.useState(false);

  const set = <K extends keyof PickupPointInput>(key: K, value: PickupPointInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "A pickup point needs a name.";
    if (!form.district) next.district = "Choose a district.";
    if (form.mapUrl.trim() && !/^https?:\/\//i.test(form.mapUrl.trim())) {
      next.mapUrl = "The link must start with http:// or https://.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      if (point) {
        await updatePickupPoint(point.id, form);
        toast.success(`${form.name} updated.`);
      } else {
        await createPickupPoint(form);
        toast.success(`${form.name} added.`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the pickup point.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={point ? "Edit Pickup Point" : "Add Pickup Point"}
      description="A public meeting point, never a farm"
      submitLabel={point ? "Update Point" : "Add Point"}
      submitting={submitting}
      onSubmit={handleSubmit}
      size="sm"
    >
      <div className="space-y-4">
        <Field label="Name" required error={errors.name} htmlFor="pointName">
          <Input
            id="pointName"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Kang Meas market gate"
            aria-invalid={Boolean(errors.name) || undefined}
          />
        </Field>
        <Field label="District" required error={errors.district}>
          <FormSelect
            value={form.district}
            onChange={(v) => set("district", v)}
            options={stringOptions([...PICKUP_DISTRICTS])}
            placeholder="Select district"
            invalid={Boolean(errors.district)}
          />
        </Field>
        <Field label="Landmark note" hint="A recognisable spot, e.g. Next to the market gate" htmlFor="pointLandmark">
          <Input
            id="pointLandmark"
            value={form.landmark}
            onChange={(e) => set("landmark", e.target.value)}
          />
        </Field>
        <Field label="Google Maps link" error={errors.mapUrl} htmlFor="pointMap">
          <Input
            id="pointMap"
            type="url"
            value={form.mapUrl}
            onChange={(e) => set("mapUrl", e.target.value)}
            placeholder="https://www.google.com/maps/…"
            aria-invalid={Boolean(errors.mapUrl) || undefined}
          />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3.5 py-3">
          <Label htmlFor="pointActive" className="text-sm font-medium">
            Active
            <span className="block text-xs font-normal text-muted-foreground">
              Inactive points cannot be chosen for new arrangements
            </span>
          </Label>
          <Switch
            id="pointActive"
            checked={form.active}
            onCheckedChange={(checked) => set("active", checked)}
          />
        </div>
      </div>
    </FormDialog>
  );
}
