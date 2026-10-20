"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/app-dialog";
import { Field, FormGrid, FormSection } from "@/components/form/field";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { ComboCreate } from "@/components/form/combo-create";
import { AddressFields } from "@/components/form/address-fields";
import { PlotAreaField } from "@/components/map/plot-area-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPlot, updatePlot, type PlotInput } from "@/lib/services/plots";
import { farmerOptions } from "@/lib/services/farmers";
import { addLookupValue, listLookups } from "@/lib/services/lookups";
import { OWNERSHIP_TYPES, type LookupKey, type Lookups, type Plot } from "@/lib/types";

const EMPTY: PlotInput = {
  name: "",
  farmerId: "",
  ownershipType: "Own",
  province: "",
  district: "",
  commune: "",
  village: "",
  latitude: null,
  longitude: null,
  areaSource: "polygon",
  boundary: null,
  manualLengthM: null,
  manualWidthM: null,
  soilType: "",
  irrigationType: "",
  infrastructure: "",
  remark: "",
};

type Errors = Partial<Record<"name" | "farmerId" | "province" | "district", string>>;

/** Strips the fields the form does not own off an existing record. */
function toInput(plot: Plot | null | undefined, defaultFarmerId?: string): PlotInput {
  if (!plot) return { ...EMPTY, farmerId: defaultFarmerId ?? "" };
  const { id, createdAt, areaHectares, ...rest } = plot;
  void id;
  void createdAt;
  void areaHectares;
  return rest;
}

export function PlotFormDialog({
  open,
  onOpenChange,
  plot,
  defaultFarmerId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot?: Plot | null;
  defaultFarmerId?: string;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<PlotInput>(() =>
    toInput(plot, defaultFarmerId),
  );
  const [errors, setErrors] = React.useState<Errors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [farmers, setFarmers] = React.useState<Array<{ value: string; label: string }>>([]);
  const [lookups, setLookups] = React.useState<Lookups | null>(null);

  React.useEffect(() => {
    void farmerOptions().then(setFarmers);
    void listLookups().then(setLookups);
  }, []);

  const set = <K extends keyof PlotInput>(key: K, value: PlotInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** Persists a newly typed lookup value and refreshes the visible options. */
  const createLookup = async (key: LookupKey, value: string) => {
    await addLookupValue(key, value);
    setLookups(await listLookups());
  };

  const handleSubmit = async () => {
    const next: Errors = {};
    if (!form.name.trim()) next.name = "A plot name is required.";
    if (!form.farmerId) next.farmerId = "Select the farmer who manages this plot.";
    if (!form.province) next.province = "Province is required.";
    if (!form.district) next.district = "District is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Check the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      if (plot) {
        await updatePlot(plot.id, form);
        toast.success(`${form.name} updated.`);
      } else {
        await createPlot(form);
        toast.success(`${form.name} registered.`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the plot.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={plot ? "Edit Plot" : "Register New Plot"}
      submitLabel={plot ? "Update Plot" : "Register Plot"}
      submitting={submitting}
      onSubmit={handleSubmit}
      size="lg"
    >
      <FormSection title="Basic Information">
        <FormGrid>
          <Field
            label="Plot Name"
            required
            error={errors.name}
            hint="A descriptive name for this plot"
            htmlFor="plotName"
          >
            <Input
              id="plotName"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Prek Toal Vegetable Field"
              aria-invalid={Boolean(errors.name) || undefined}
            />
          </Field>
          <Field
            label="Farmer (Owner)"
            required
            error={errors.farmerId}
            hint="Which farmer manages this plot?"
          >
            <FormSelect
              value={form.farmerId}
              onChange={(v) => set("farmerId", v)}
              options={farmers}
              placeholder="Select farmer"
              invalid={Boolean(errors.farmerId)}
            />
          </Field>
          <Field label="Ownership Type">
            <FormSelect
              value={form.ownershipType}
              onChange={(v) => set("ownershipType", v as Plot["ownershipType"])}
              options={stringOptions([...OWNERSHIP_TYPES])}
              placeholder="Select ownership"
            />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Location"
        description="Cascading address — select province first"
      >
        <AddressFields
          value={form}
          onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
          errors={{ province: errors.province, district: errors.district }}
        />
      </FormSection>

      <FormSection
        title="Area & Boundary"
        description="Trace the field on satellite imagery — area is calculated from the shape"
      >
        <PlotAreaField
          value={form}
          onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
        />
      </FormSection>

      <FormSection
        title="Soil & Infrastructure"
        description="Select an existing value or create a new one"
      >
        <FormGrid>
          <Field label="Soil Type" hint="Select or create a new soil type">
            <ComboCreate
              value={form.soilType}
              onChange={(v) => set("soilType", v)}
              options={lookups?.soilType ?? []}
              onCreate={(v) => createLookup("soilType", v)}
            />
          </Field>
          <Field label="Irrigation Type">
            <ComboCreate
              value={form.irrigationType}
              onChange={(v) => set("irrigationType", v)}
              options={lookups?.irrigationType ?? []}
              onCreate={(v) => createLookup("irrigationType", v)}
            />
          </Field>
          <Field label="Infrastructure" hint="Select or create a new type">
            <ComboCreate
              value={form.infrastructure}
              onChange={(v) => set("infrastructure", v)}
              options={lookups?.infrastructure ?? []}
              onCreate={(v) => createLookup("infrastructure", v)}
            />
          </Field>
        </FormGrid>
      </FormSection>

      <Field label="Remark" hint="Additional notes about this plot" htmlFor="plotRemark">
        <Textarea
          id="plotRemark"
          rows={3}
          value={form.remark}
          onChange={(e) => set("remark", e.target.value)}
          placeholder="Additional notes about this plot…"
        />
      </Field>
    </FormDialog>
  );
}
