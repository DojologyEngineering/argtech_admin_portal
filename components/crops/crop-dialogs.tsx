"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil, Sprout } from "lucide-react";
import { AppDialog, FormDialog } from "@/components/app-dialog";
import { DetailItem, Field, FormGrid, FormSection } from "@/components/form/field";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { ComboCreate } from "@/components/form/combo-create";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCrop, updateCrop, type CropInput, type CropView } from "@/lib/services/crops";
import { addLookupValue, listLookups } from "@/lib/services/lookups";
import { dash, moneyPrecise } from "@/lib/format";
import {
  MAX_SPEC_CHIPS,
  SEASONS,
  STANDARD_OPTION,
  type Crop,
  type LookupKey,
  type Lookups,
} from "@/lib/types";
import {
  buyerPricesLabel,
  EMPTY_PRICES,
  EMPTY_SPEC,
  specSummary,
} from "@/lib/crop-spec";
import { ChipListEditor } from "@/components/crops/chip-list-editor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const EMPTY: CropInput = {
  name: "",
  variety: "",
  season: "Wet Season",
  seedSource: "",
  daysToHarvest: 0,
  note: "",
  spec: EMPTY_SPEC,
  buyerPrices: EMPTY_PRICES,
};

type Errors = Partial<
  Record<
    | "name"
    | "variety"
    | "daysToHarvest"
    | "bestUsedWithinDays"
    | "under200"
    | "from200"
    | "from1000",
    string
  >
>;

/** "" -> null, otherwise the number. */
const toNumberOrNull = (value: string): number | null =>
  value.trim() === "" ? null : Number(value);

function toInput(crop: Crop | null | undefined, initialName = ""): CropInput {
  if (!crop) return { ...EMPTY, name: initialName };
  const { id, ...rest } = crop;
  void id;
  // Copy the nested lists so editing the form never changes the saved crop.
  return {
    ...rest,
    spec: {
      ...rest.spec,
      chips: [...rest.spec.chips],
      ripenessOptions: [...rest.spec.ripenessOptions],
      sizeOptions: [...rest.spec.sizeOptions],
    },
    buyerPrices: { ...rest.buyerPrices },
  };
}

/**
 * Crop catalogue editor.
 *
 * This is the one module where editing lives with admins rather than field
 * agents: the price and days-to-harvest here feed every farmer's break-even
 * calculation, so the values have to stay consistent across the whole platform.
 */
export function CropFormDialog({
  open,
  onOpenChange,
  crop,
  initialName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crop?: Crop | null;
  /** Prefills the name of a new crop, e.g. the crop a buyer asked for. */
  initialName?: string;
  /** Receives the saved crop. */
  onSaved: (crop: Crop) => void;
}) {
  const [form, setForm] = React.useState<CropInput>(() => toInput(crop, initialName));
  const [errors, setErrors] = React.useState<Errors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [lookups, setLookups] = React.useState<Lookups | null>(null);

  React.useEffect(() => {
    void listLookups().then(setLookups);
  }, []);

  const set = <K extends keyof CropInput>(key: K, value: CropInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setSpec = (patch: Partial<CropInput["spec"]>) =>
    setForm((prev) => ({ ...prev, spec: { ...prev.spec, ...patch } }));

  const setPrice = (key: keyof CropInput["buyerPrices"], value: string) =>
    setForm((prev) => ({
      ...prev,
      buyerPrices: { ...prev.buyerPrices, [key]: toNumberOrNull(value) },
    }));

  const createLookup = async (key: LookupKey, value: string) => {
    await addLookupValue(key, value);
    setLookups(await listLookups());
  };

  const handleSubmit = async () => {
    const next: Errors = {};
    if (!form.name.trim()) next.name = "A crop name is required.";
    if (!form.variety.trim()) next.variety = "A variety is required.";
    if (form.daysToHarvest <= 0) {
      next.daysToHarvest = "Days to harvest seeds every cycle's expected harvest date.";
    }
    const days = form.spec.bestUsedWithinDays;
    if (days !== null && !(days > 0)) {
      next.bestUsedWithinDays = "Enter a number of days above zero.";
    }
    const { under200, from200, from1000 } = form.buyerPrices;
    if ([under200, from200, from1000].some((p) => p !== null)) {
      if (under200 === null) next.under200 = "Enter a price.";
      if (from200 === null) next.from200 = "Enter a price.";
      if (from1000 === null) next.from1000 = "Enter a price.";
      if ([under200, from200, from1000].some((p) => p !== null && !(p >= 0))) {
        if (under200 !== null && !(under200 >= 0)) next.under200 = "Price cannot be negative.";
        if (from200 !== null && !(from200 >= 0)) next.from200 = "Price cannot be negative.";
        if (from1000 !== null && !(from1000 >= 0)) next.from1000 = "Price cannot be negative.";
      }
      if (under200 !== null && from200 !== null && from200 > under200 && !next.from200) {
        next.from200 = "Cannot be higher than the under 200 kg price.";
      }
      if (from200 !== null && from1000 !== null && from1000 > from200 && !next.from1000) {
        next.from1000 = "Cannot be higher than the 200 to 999 kg price.";
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Check the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      let saved: Crop;
      if (crop) {
        saved = await updateCrop(crop.id, form);
        toast.success(`${form.name} updated.`);
      } else {
        saved = await createCrop(form);
        toast.success(`${form.name} registered.`);
      }
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the crop.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={crop ? "Edit Crop" : "Register New Crop"}
      submitLabel={crop ? "Update Crop" : "Register Crop"}
      submitting={submitting}
      onSubmit={handleSubmit}
      size="md"
    >
      <div className="space-y-4">
        <Field
          label="Crop Name"
          required
          error={errors.name}
          hint="Common name of the crop"
          htmlFor="cropName"
        >
          <Input
            id="cropName"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Cucumber"
            aria-invalid={Boolean(errors.name) || undefined}
          />
        </Field>

        <Field
          label="Variety"
          required
          error={errors.variety}
          hint="Select existing or create a new variety"
        >
          <ComboCreate
            value={form.variety}
            onChange={(v) => set("variety", v)}
            options={lookups?.variety ?? []}
            onCreate={(v) => createLookup("variety", v)}
            invalid={Boolean(errors.variety)}
          />
        </Field>

        <Field label="Season" required>
          <FormSelect
            value={form.season}
            onChange={(v) => set("season", v as Crop["season"])}
            options={stringOptions([...SEASONS])}
            placeholder="Select season"
          />
        </Field>

        <Field label="Seed Source" hint="Where seeds are sourced — select or create new">
          <ComboCreate
            value={form.seedSource}
            onChange={(v) => set("seedSource", v)}
            options={lookups?.seedSource ?? []}
            onCreate={(v) => createLookup("seedSource", v)}
          />
        </Field>

        <Field
          label="Days to Harvest"
          required
          error={errors.daysToHarvest}
          hint="Seeds the expected harvest date"
          htmlFor="dth"
        >
          <Input
            id="dth"
            type="number"
            min={1}
            step="1"
            value={form.daysToHarvest}
            onChange={(e) => set("daysToHarvest", Number(e.target.value))}
            placeholder="e.g. 40"
            aria-invalid={Boolean(errors.daysToHarvest) || undefined}
          />
        </Field>

        <Field label="Agronomy Note" htmlFor="cropNote">
          <Textarea
            id="cropNote"
            rows={3}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Growing notes shared with field agents…"
          />
        </Field>

        {/* ------------------------------------------------ specification */}
        <FormSection
          title="Specification"
          description="The written specification buyers see. Agents check produce against it at handover."
          className="pt-2"
        >
          <FormGrid>
            <Field label="Ripeness" htmlFor="specRipeness">
              <Input
                id="specRipeness"
                value={form.spec.ripeness}
                onChange={(e) => setSpec({ ripeness: e.target.value })}
                placeholder="e.g. Firm, mostly red-ripe"
              />
            </Field>
            <Field label="Size" htmlFor="specSize">
              <Input
                id="specSize"
                value={form.spec.size}
                onChange={(e) => setSpec({ size: e.target.value })}
                placeholder="e.g. Medium"
              />
            </Field>
            <Field
              label="Condition"
              hint="Fixed: buyers cannot lower it"
              htmlFor="specCondition"
            >
              <Input
                id="specCondition"
                value={form.spec.condition}
                onChange={(e) => setSpec({ condition: e.target.value })}
                placeholder="e.g. No cracks, rot or bruising"
              />
            </Field>
            <Field
              label="Best used within (days)"
              error={errors.bestUsedWithinDays}
              htmlFor="specDays"
            >
              <Input
                id="specDays"
                type="number"
                min={1}
                step="1"
                value={form.spec.bestUsedWithinDays ?? ""}
                onChange={(e) =>
                  setSpec({ bestUsedWithinDays: toNumberOrNull(e.target.value) })
                }
                placeholder="e.g. 7"
                aria-invalid={Boolean(errors.bestUsedWithinDays) || undefined}
              />
            </Field>
          </FormGrid>

          <Field
            label={`Buyer request options (up to ${MAX_SPEC_CHIPS})`}
            hint="Short labels on the buyer's crop card, e.g. Firm, Medium, Red-ripe"
          >
            <ChipListEditor
              label="Buyer request options"
              values={form.spec.chips}
              onChange={(chips) => setSpec({ chips })}
              max={MAX_SPEC_CHIPS}
              placeholder="Add a chip"
            />
          </Field>

          <div className="rounded-xl bg-muted/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="buyerChoice" className="text-sm font-medium">
                  Buyer can choose on requests
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Lets a buyer pick a ripeness or size when they send a request.
                  Condition is never buyer-chosen.
                </p>
              </div>
              <Switch
                id="buyerChoice"
                checked={form.spec.buyerCanChoose}
                onCheckedChange={(checked) => setSpec({ buyerCanChoose: checked })}
                aria-label="Buyer can choose on requests"
              />
            </div>
            {form.spec.buyerCanChoose ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Ripeness options">
                  <ChipListEditor
                    label="Ripeness options"
                    leading={STANDARD_OPTION}
                    values={form.spec.ripenessOptions.slice(1)}
                    onChange={(rest) =>
                      setSpec({ ripenessOptions: [STANDARD_OPTION, ...rest] })
                    }
                    placeholder="e.g. Partly ripe"
                  />
                </Field>
                <Field label="Size options">
                  <ChipListEditor
                    label="Size options"
                    leading={STANDARD_OPTION}
                    values={form.spec.sizeOptions.slice(1)}
                    onChange={(rest) =>
                      setSpec({ sizeOptions: [STANDARD_OPTION, ...rest] })
                    }
                    placeholder="e.g. Large"
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="font-semibold">Crop specification: </span>
            {specSummary(form.spec) || (
              <span className="text-muted-foreground">not set yet</span>
            )}
          </p>
        </FormSection>

        {/* --------------------------------------------------- buyer prices */}
        <FormSection
          title="Buyer prices ($/kg)"
          description="The price applies to the whole order quantity. Each tier cannot be higher than the one before it."
          className="pt-2"
        >
          <FormGrid columns={3}>
            <Field label="Under 200 kg" error={errors.under200} htmlFor="priceUnder200">
              <Input
                id="priceUnder200"
                type="number"
                min={0}
                step="0.01"
                value={form.buyerPrices.under200 ?? ""}
                onChange={(e) => setPrice("under200", e.target.value)}
                placeholder="e.g. 0.65"
                aria-invalid={Boolean(errors.under200) || undefined}
              />
            </Field>
            <Field label="200 to 999 kg" error={errors.from200} htmlFor="price200">
              <Input
                id="price200"
                type="number"
                min={0}
                step="0.01"
                value={form.buyerPrices.from200 ?? ""}
                onChange={(e) => setPrice("from200", e.target.value)}
                placeholder="e.g. 0.60"
                aria-invalid={Boolean(errors.from200) || undefined}
              />
            </Field>
            <Field label="1,000 kg and above" error={errors.from1000} htmlFor="price1000">
              <Input
                id="price1000"
                type="number"
                min={0}
                step="0.01"
                value={form.buyerPrices.from1000 ?? ""}
                onChange={(e) => setPrice("from1000", e.target.value)}
                placeholder="e.g. 0.55"
                aria-invalid={Boolean(errors.from1000) || undefined}
              />
            </Field>
          </FormGrid>
        </FormSection>
      </div>
    </FormDialog>
  );
}

export function CropDetailDialog({
  open,
  onOpenChange,
  crop,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crop: CropView | null;
  onEdit: () => void;
}) {
  if (!crop) return null;

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title="Crop Details" size="sm">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary">
              <Sprout className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{crop.name}</h3>
              <p className="truncate text-xs text-muted-foreground">
                {crop.variety} · {crop.season}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <DetailItem label="Variety" value={crop.variety} />
          <DetailItem label="Season" value={<StatusBadge status={crop.season} />} />
          <DetailItem label="Seed Source" value={dash(crop.seedSource)} />
          <DetailItem
            label="Buyer prices ($/kg)"
            value={buyerPricesLabel(crop.buyerPrices)}
          />
          <DetailItem
            label="Typical cost per kg"
            value={
              crop.typicalCostPerKg === null
                ? "No data yet"
                : `${moneyPrecise(crop.typicalCostPerKg)}/kg`
            }
          />
          <DetailItem label="Days to Harvest" value={`${crop.daysToHarvest} days`} />
          <DetailItem
            label="Crop Cycles"
            value={`${crop.cycleCount} total · ${crop.activeCycleCount} active`}
          />
          <DetailItem
            label="Crop specification"
            value={specSummary(crop.spec) || "Missing"}
            className="col-span-2"
          />
          <DetailItem
            label="Best used within"
            value={
              crop.spec.bestUsedWithinDays ? `${crop.spec.bestUsedWithinDays} days` : "—"
            }
          />
          <DetailItem
            label="Buyer request options"
            value={crop.spec.chips.join(", ") || "—"}
          />
          <DetailItem
            label="Buyer can choose on requests"
            value={crop.spec.buyerCanChoose ? "Yes" : "No"}
            className="col-span-2"
          />
          {crop.note.trim() && (
            <DetailItem label="Agronomy Note" value={crop.note} className="col-span-2" />
          )}
        </dl>
      </div>
    </AppDialog>
  );
}
