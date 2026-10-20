"use client";

import * as React from "react";
import { toast } from "sonner";
import { Droplets, FlaskConical, Plus, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormGrid } from "@/components/form/field";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import {
  addActivity,
  addHarvestEntry,
  removeActivity,
  removeHarvestEntry,
} from "@/lib/services/cycles";
import { num, prettyDate, todayISO } from "@/lib/format";
import { ACTIVITY_TYPES, type FieldActivity, type HarvestEntry, type ID } from "@/lib/types";

/**
 * Harvest log.
 *
 * A vegetable cycle is picked over and over, so this is a repeatable list of
 * dated quantities rather than one "actual harvest" field — and it records no
 * price, because picking is not selling.
 */
export function HarvestLogCard({
  cycleId,
  entries,
  soldKg,
  onChanged,
  disabled,
}: {
  cycleId: ID;
  entries: HarvestEntry[];
  soldKg: number;
  onChanged: () => void;
  disabled?: boolean;
}) {
  const [adding, setAdding] = React.useState(false);
  const [date, setDate] = React.useState(todayISO());
  const [quantity, setQuantity] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const total = entries.reduce((s, e) => s + e.quantityKg, 0);

  const reset = () => {
    setDate(todayISO());
    setQuantity("");
    setNote("");
    setAdding(false);
  };

  const submit = async () => {
    const qty = Number(quantity);
    if (!date || !qty || qty <= 0) {
      toast.error("Enter a date and a quantity greater than zero.");
      return;
    }
    setBusy(true);
    try {
      await addHarvestEntry(cycleId, { date, quantityKg: qty, note: note.trim() });
      toast.success(`${num(qty)} kg logged.`);
      reset();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log the harvest.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: HarvestEntry) => {
    try {
      await removeHarvestEntry(cycleId, entry.id);
      toast.success("Harvest entry removed.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the entry.");
    }
  };

  return (
    <section className="card-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Scissors className="size-5 text-primary" />
            Harvest Log
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entries.length} picking{entries.length === 1 ? "" : "s"} ·{" "}
            {num(total)} kg harvested so far
          </p>
        </div>
        {!adding && !disabled ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            Log Harvest
          </Button>
        ) : null}
      </header>

      {adding ? (
        <div className="space-y-3 border-b border-border bg-muted/30 p-4">
          <FormGrid columns={3}>
            <Field label="Date picked" required>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Quantity (kg)" required>
              <Input
                type="number"
                min={0}
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 380"
              />
            </Field>
            <Field label="Note">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. First pick"
              />
            </Field>
          </FormGrid>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void submit()} disabled={busy}>
              Save Entry
            </Button>
            <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing picked yet. Each picking is logged separately so repeat
          harvests build up over the season.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {num(entry.quantityKg)} kg
                  <span className="ml-2 font-normal text-muted-foreground">
                    {prettyDate(entry.date)}
                  </span>
                </p>
                {entry.note ? (
                  <p className="truncate text-xs text-muted-foreground">{entry.note}</p>
                ) : null}
              </div>
              {!disabled ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove harvest of ${entry.quantityKg} kg`}
                  onClick={() => void remove(entry)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {soldKg > 0 ? (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          {num(soldKg)} kg is already committed to purchase orders, so the log
          cannot be reduced below that.
        </p>
      ) : null}
    </section>
  );
}

/** Irrigation and fertilisation events, kept separate from the harvest log. */
export function ActivityLogCard({
  cycleId,
  activities,
  onChanged,
  disabled,
}: {
  cycleId: ID;
  activities: FieldActivity[];
  onChanged: () => void;
  disabled?: boolean;
}) {
  const [adding, setAdding] = React.useState(false);
  const [type, setType] = React.useState<string>("Irrigation");
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setType("Irrigation");
    setDate(todayISO());
    setNote("");
    setAdding(false);
  };

  const submit = async () => {
    if (!date) {
      toast.error("Pick a date for the activity.");
      return;
    }
    setBusy(true);
    try {
      await addActivity(cycleId, {
        type: type as FieldActivity["type"],
        date,
        note: note.trim(),
      });
      toast.success(`${type} logged.`);
      reset();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log the activity.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Droplets className="size-5 text-primary" />
            Field Activities
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activities.length} irrigation and fertilisation event
            {activities.length === 1 ? "" : "s"}
          </p>
        </div>
        {!adding && !disabled ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            Add Activity
          </Button>
        ) : null}
      </header>

      {adding ? (
        <div className="space-y-3 border-b border-border bg-muted/30 p-4">
          <FormGrid columns={3}>
            <Field label="Type" required>
              <FormSelect
                value={type}
                onChange={setType}
                options={stringOptions([...ACTIVITY_TYPES])}
              />
            </Field>
            <Field label="Date" required>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Note">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Urea top-dress"
              />
            </Field>
          </FormGrid>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void submit()} disabled={busy}>
              Save Activity
            </Button>
            <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {activities.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No field activities recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {activities.map((activity) => (
            <li
              key={activity.id}
              className="flex items-center justify-between gap-3 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
                  {activity.type === "Irrigation" ? (
                    <Droplets className="size-4" />
                  ) : (
                    <FlaskConical className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {activity.type}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {prettyDate(activity.date)}
                    </span>
                  </p>
                  {activity.note ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {activity.note}
                    </p>
                  ) : null}
                </div>
              </div>
              {!disabled ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${activity.type} on ${activity.date}`}
                  onClick={async () => {
                    await removeActivity(cycleId, activity.id);
                    toast.success("Activity removed.");
                    onChanged();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
