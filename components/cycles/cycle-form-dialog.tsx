"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/app-dialog";
import { Field, FormGrid, FormSection, ReadOnlyField } from "@/components/form/field";
import { FormSelect } from "@/components/form/form-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCycle, updateCycle, type CropCycleView, type CycleInput } from "@/lib/services/cycles";
import { farmerOptions } from "@/lib/services/farmers";
import { listPlots, type PlotView } from "@/lib/services/plots";
import { listCrops, type CropView } from "@/lib/services/crops";
import { addDays, money, num, todayISO } from "@/lib/format";
import type { CycleCosts } from "@/lib/types";

const EMPTY: CycleInput = {
  farmerId: "",
  plotId: "",
  cropId: "",
  plantingDate: todayISO(),
  expectedHarvestDate: "",
  expectedOutputKg: 0,
  costs: { seed: 0, fertilizer: 0, labor: 0, other: 0 },
  remark: "",
};

type Errors = Partial<Record<"farmerId" | "plotId" | "cropId" | "plantingDate", string>>;

function toInput(cycle: CropCycleView | null | undefined): CycleInput {
  if (!cycle) return EMPTY;
  return {
    farmerId: cycle.farmerId,
    plotId: cycle.plotId,
    cropId: cycle.cropId,
    plantingDate: cycle.plantingDate,
    expectedHarvestDate: cycle.expectedHarvestDate,
    expectedOutputKg: cycle.expectedOutputKg,
    costs: { ...cycle.costs },
    remark: cycle.remark,
  };
}

const COST_FIELDS: Array<{ key: keyof CycleCosts; label: string; hint: string }> = [
  { key: "seed", label: "Seed ($)", hint: "Seed and seedling purchases" },
  { key: "fertilizer", label: "Fertilizer ($)", hint: "Fertiliser and pesticide" },
  { key: "labor", label: "Labour ($)", hint: "Hired and family labour" },
  { key: "other", label: "Other ($)", hint: "Transport, rental, water" },
];

/**
 * Create/edit a crop cycle.
 *
 * Actual harvest is deliberately absent: pickings are logged individually on
 * the cycle's detail screen, because vegetables come off the plot repeatedly
 * over several weeks rather than on a single date.
 */
export function CycleFormDialog({
  open,
  onOpenChange,
  cycle,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle?: CropCycleView | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<CycleInput>(() => toInput(cycle));
  const [errors, setErrors] = React.useState<Errors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [farmers, setFarmers] = React.useState<Array<{ value: string; label: string }>>([]);
  const [plots, setPlots] = React.useState<PlotView[]>([]);
  const [crops, setCrops] = React.useState<CropView[]>([]);
  // Once the date is edited by hand, stop deriving it from the crop.
  const [harvestTouched, setHarvestTouched] = React.useState(() => Boolean(cycle));

  React.useEffect(() => {
    void farmerOptions().then(setFarmers);
    void listPlots().then(setPlots);
    void listCrops().then(setCrops);
  }, []);

  const selectedCrop = crops.find((c) => c.id === form.cropId);
  const selectedPlot = plots.find((p) => p.id === form.plotId);
  const farmerPlots = plots.filter((p) => p.farmerId === form.farmerId);

  // Derived during render rather than synced by an effect: until someone edits
  // the field, it always reflects the crop's typical days-to-harvest.
  const expectedHarvestDate =
    !harvestTouched && selectedCrop && form.plantingDate
      ? addDays(form.plantingDate, selectedCrop.daysToHarvest)
      : form.expectedHarvestDate;

  const totalCost =
    form.costs.seed + form.costs.fertilizer + form.costs.labor + form.costs.other;

  const handleSubmit = async () => {
    const next: Errors = {};
    if (!form.farmerId) next.farmerId = "Select the farmer running this cycle.";
    if (!form.plotId) next.plotId = "Select the plot being planted.";
    if (!form.cropId) next.cropId = "Select the crop.";
    if (!form.plantingDate) next.plantingDate = "A planting date is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Check the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CycleInput = { ...form, expectedHarvestDate };
      if (cycle) {
        await updateCycle(cycle.id, payload);
        toast.success(`${cycle.code} updated.`);
      } else {
        await createCycle(payload);
        toast.success("Crop cycle created.");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the cycle.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={cycle ? `Edit Cycle ${cycle.code}` : "New Crop Cycle"}
      submitLabel={cycle ? "Update Cycle" : "Create Cycle"}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      <FormSection
        title="Farmer, Plot & Crop"
        description="Select the farmer first to filter their plots"
      >
        <FormGrid>
          <Field label="Farmer" required error={errors.farmerId}>
            <FormSelect
              value={form.farmerId}
              onChange={(farmerId) =>
                setForm((prev) => ({ ...prev, farmerId, plotId: "" }))
              }
              options={farmers}
              placeholder="Select farmer"
              invalid={Boolean(errors.farmerId)}
            />
          </Field>
          <Field
            label="Farm Plot"
            required
            error={errors.plotId}
            hint={
              form.farmerId
                ? `${farmerPlots.length} plot(s) available`
                : "Select a farmer first"
            }
          >
            <FormSelect
              value={form.plotId}
              onChange={(plotId) => setForm((prev) => ({ ...prev, plotId }))}
              options={farmerPlots.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select plot"
              disabled={!form.farmerId}
              invalid={Boolean(errors.plotId)}
            />
          </Field>
          <Field label="Crop" required error={errors.cropId}>
            <FormSelect
              value={form.cropId}
              onChange={(cropId) => setForm((prev) => ({ ...prev, cropId }))}
              options={crops.map((c) => ({
                value: c.id,
                label: `${c.name} · ${c.variety}`,
              }))}
              placeholder="Select crop"
              invalid={Boolean(errors.cropId)}
            />
          </Field>
          <ReadOnlyField
            label="Cultivated area"
            value={
              selectedPlot && selectedPlot.areaHectares > 0
                ? `${num(selectedPlot.areaHectares, 3)} ha`
                : ""
            }
            hint="Inherited from the plot's traced boundary"
          />
        </FormGrid>
      </FormSection>

      <FormSection title="Schedule" description="Planting and expected harvest">
        <FormGrid>
          <Field label="Planting Date" required error={errors.plantingDate} htmlFor="planting">
            <Input
              id="planting"
              type="date"
              value={form.plantingDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, plantingDate: e.target.value }))
              }
              aria-invalid={Boolean(errors.plantingDate) || undefined}
            />
          </Field>
          <Field
            label="Expected Harvest"
            hint={
              selectedCrop
                ? `Suggested from ${selectedCrop.name}'s ${selectedCrop.daysToHarvest}-day cycle — edit if needed`
                : "Calculated once a crop is selected"
            }
            htmlFor="expectedHarvest"
          >
            <Input
              id="expectedHarvest"
              type="date"
              value={expectedHarvestDate}
              onChange={(e) => {
                setHarvestTouched(true);
                setForm((prev) => ({ ...prev, expectedHarvestDate: e.target.value }));
              }}
            />
          </Field>
          <Field
            label="Expected Output (kg)"
            hint="Drives the supply forecast before anything is picked"
            htmlFor="expectedOutput"
          >
            <Input
              id="expectedOutput"
              type="number"
              min={0}
              step="1"
              value={form.expectedOutputKg}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  expectedOutputKg: Number(e.target.value),
                }))
              }
              placeholder="e.g. 1400"
            />
          </Field>
        </FormGrid>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Actual harvest is not entered here — log each picking on the cycle&apos;s
          detail screen so repeat harvests are recorded individually.
        </p>
      </FormSection>

      <FormSection
        title="Costs"
        description="Itemised production costs, used for break-even"
      >
        <FormGrid>
          {COST_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} hint={field.hint}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.costs[field.key]}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    costs: { ...prev.costs, [field.key]: Number(e.target.value) },
                  }))
                }
                placeholder="0"
              />
            </Field>
          ))}
        </FormGrid>
        <div className="flex items-center justify-between rounded-lg bg-brand-softer px-3 py-2.5">
          <span className="text-sm font-medium">Total cost</span>
          <span className="text-base font-semibold tabular-nums">
            {money(totalCost)}
          </span>
        </div>
      </FormSection>

      <Field label="Remark" hint="Notes about this cycle" htmlFor="cycleRemark">
        <Textarea
          id="cycleRemark"
          rows={3}
          value={form.remark}
          onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
          placeholder="Additional notes…"
        />
      </Field>
    </FormDialog>
  );
}
