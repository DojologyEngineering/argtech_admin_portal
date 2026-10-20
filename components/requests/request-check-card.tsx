"use client";

import * as React from "react";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, ListChecks } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getRequestCheck,
  setMeetCheck,
  type PurchaseOrderView,
  type RequestCheck,
  type RequestCheckField,
} from "@/lib/services/orders";
import { num, prettyDate } from "@/lib/format";
import { MEET_DECISIONS, type MeetDecision } from "@/lib/types";

/** Small badge for the staff decision. Nothing is shown until someone has checked. */
export function MeetDecisionBadge({
  decision,
  className,
}: {
  decision: MeetDecision;
  className?: string;
}) {
  if (decision === "Not checked yet") return null;
  return <StatusBadge status={`Can meet: ${decision}`} className={className} />;
}

/**
 * "Can we meet this?" — compares a request with the crop's standard and with the
 * stock available, and records the staff decision. It is guidance only and never
 * blocks Confirm or Decline.
 */
export function RequestCheckCard({
  request,
  onSaved,
}: {
  request: PurchaseOrderView;
  onSaved: () => void;
}) {
  const [check, setCheck] = React.useState<RequestCheck | null>(null);
  const [decision, setDecision] = React.useState<MeetDecision>(request.meetCheck.decision);
  const [note, setNote] = React.useState(request.meetCheck.note);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void getRequestCheck(request.id).then((next) => {
      if (!cancelled) setCheck(next);
    });
    return () => {
      cancelled = true;
    };
  }, [request.id, request.cropId, request.requestedKg, request.deliveryDate]);

  const dirty =
    decision !== request.meetCheck.decision || note.trim() !== request.meetCheck.note;

  const save = async () => {
    setSaving(true);
    try {
      await setMeetCheck(request.id, decision, note);
      toast.success("Staff decision saved.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the decision.");
    } finally {
      setSaving(false);
    }
  };

  const specDiffers = check ? !check.ripeness.matches || !check.size.matches : false;

  return (
    <section className="card-surface p-4 sm:p-6">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <ListChecks className="size-5 text-primary" />
        Can we meet this?
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        A quick check of the buyer&apos;s requirements and the stock available. It
        is guidance for staff and does not block Confirm or Decline.
      </p>

      {!check ? (
        <p className="mt-4 text-sm text-muted-foreground">Checking…</p>
      ) : (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {/* ------------------------------------------------ specification */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">
              Specification
            </h4>
            {!check.hasStandard ? (
              <div className="mt-2 space-y-1 text-sm">
                {request.notInCatalog && check.buyerText ? (
                  <p>
                    <span className="text-muted-foreground">Buyer asked for: </span>
                    {check.buyerText}
                  </p>
                ) : null}
                <p className="text-muted-foreground">
                  {request.notInCatalog
                    ? "No standard for this crop."
                    : "No standard set for this crop yet. Add its specification in Crop Management."}
                </p>
              </div>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                <SpecRow label="Ripeness" field={check.ripeness} />
                <SpecRow label="Size" field={check.size} />
                {specDiffers ? (
                  <li className="text-xs text-muted-foreground">
                    Confirm with the agent and farmer.
                  </li>
                ) : null}
              </ul>
            )}
          </div>

          {/* ---------------------------------------------------------- supply */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">
              Supply
            </h4>
            {check.supply === null ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No stock records: this crop is not in the catalog.
              </p>
            ) : (
              <div className="mt-2 space-y-1.5 text-sm">
                {check.supply.enough ? (
                  <p className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                    <CircleCheck className="size-4" aria-hidden />
                    Enough: {num(check.supply.totalKg)} kg available
                  </p>
                ) : (
                  <p className="inline-flex items-center gap-1.5 font-medium text-destructive">
                    <CircleAlert className="size-4" aria-hidden />
                    Short by {num(check.supply.shortKg)} kg
                  </p>
                )}
                <p className="text-xs text-muted-foreground tabular-nums">
                  Asked {num(check.supply.requestedKg)} kg · in stock now{" "}
                  {num(check.supply.inStockKg)} kg · due by{" "}
                  {prettyDate(check.supply.neededBy)} {num(check.supply.dueKg)} kg
                  {check.supply.dueCycleCount > 0
                    ? ` (${check.supply.dueCycleCount} cycle${check.supply.dueCycleCount === 1 ? "" : "s"})`
                    : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------- staff decision */}
      <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Staff decision</p>
          <FormSelect
            value={decision}
            onChange={(v) => setDecision(v as MeetDecision)}
            options={stringOptions([...MEET_DECISIONS])}
          />
        </div>
        <div>
          <label
            htmlFor="meet-note"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Note (optional)
          </label>
          <Textarea
            id="meet-note"
            rows={1}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Agent says two farmers can deliver"
            className="min-h-8"
          />
        </div>
        <Button variant="outline" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save decision"}
        </Button>
      </div>
    </section>
  );
}

function SpecRow({ label, field }: { label: string; field: RequestCheckField }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="w-16 text-muted-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">Standard: {field.standard}</span>
      <span className="w-full sm:w-auto">
        {field.matches ? (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300">
            <CircleCheck className="size-3.5" aria-hidden />
            Matches standard
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
            <CircleAlert className="size-3.5" aria-hidden />
            Different from standard: {field.choice}
          </span>
        )}
      </span>
    </li>
  );
}
