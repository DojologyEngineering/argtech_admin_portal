"use client";

import * as React from "react";
import { toast } from "sonner";
import { CircleCheck, MessageSquare, TriangleAlert } from "lucide-react";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  hasOpenIssue,
  saveFollowUp,
  type PurchaseOrderView,
} from "@/lib/services/orders";
import { prettyDate } from "@/lib/format";
import {
  FEEDBACK_OUTCOME_LABEL,
  FOLLOW_UP_STATUSES,
  type FollowUpStatus,
} from "@/lib/types";

/**
 * What the buyer answered to "How was the produce?" in the Buyer App, with the
 * same labels, plus the staff follow-up when the buyer reported an issue.
 */
export function BuyerFeedbackCard({
  order,
  onChanged,
}: {
  order: PurchaseOrderView;
  onChanged: () => void;
}) {
  const feedback = order.feedback;
  const [status, setStatus] = React.useState<FollowUpStatus>(order.followUp.status);
  const [note, setNote] = React.useState(order.followUp.note);
  const [saving, setSaving] = React.useState(false);

  const dirty = status !== order.followUp.status || note.trim() !== order.followUp.note;

  const save = async () => {
    setSaving(true);
    try {
      await saveFollowUp(order.id, status, note);
      toast.success("Follow-up saved.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the follow-up.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-5 text-primary" />
          Buyer feedback
        </h3>
        {hasOpenIssue(order) ? <StatusBadge status="Issue" /> : null}
      </div>

      {!feedback ? (
        <p className="mt-3 text-sm text-muted-foreground">No feedback yet</p>
      ) : (
        <>
          <div className="mt-3 flex items-start gap-3">
            <span
              className={
                feedback.outcome === "issue"
                  ? "flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
                  : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary"
              }
            >
              {feedback.outcome === "issue" ? (
                <TriangleAlert className="size-4" />
              ) : (
                <CircleCheck className="size-4" />
              )}
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold">
                {FEEDBACK_OUTCOME_LABEL[feedback.outcome]}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {prettyDate(feedback.at)}
                </span>
              </p>
              {feedback.reasons.length > 0 ? <p>{feedback.reasons.join(", ")}</p> : null}
              {feedback.note ? (
                <p className="mt-0.5 text-muted-foreground">
                  &ldquo;{feedback.note}&rdquo;
                </p>
              ) : null}
              {feedback.lotCodes.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Linked to {feedback.lotCodes.map((c) => `Lot ${c}`).join(", ")}.
                </p>
              ) : null}
            </div>
          </div>

          {feedback.outcome === "issue" ? (
            <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Follow-up status
                </p>
                <FormSelect
                  value={status}
                  onChange={(v) => setStatus(v as FollowUpStatus)}
                  options={stringOptions([...FOLLOW_UP_STATUSES])}
                />
              </div>
              <div>
                <label
                  htmlFor="follow-up-note"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Follow-up note
                </label>
                <Textarea
                  id="follow-up-note"
                  rows={1}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Agreed a credit with the buyer"
                  className="min-h-8"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => void save()}
                disabled={!dirty || saving}
              >
                {saving ? "Saving…" : "Save follow-up"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
