"use client";

import * as React from "react";
import { toast } from "sonner";
import { ClipboardCheck, Hourglass } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { DetailItem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addQualityNote,
  type OrderLineView,
  type PurchaseOrderView,
} from "@/lib/services/orders";
import {
  getServerSessionSnapshot,
  getSessionSnapshot,
  subscribeSession,
} from "@/lib/services/auth";
import { money, num, prettyDate } from "@/lib/format";
import { cn } from "cn";

const LOG_PREVIEW = 5;

/**
 * Quality panel. The quality promise in three steps: the buyer sees a written
 * specification, an ARG TECH field agent checks the produce at handover, and the
 * buyer pays only for the kg accepted. The check is saved by the agent in the
 * field, so it is read-only here; staff add notes to the log.
 */
export function QualityPanel({
  order,
  onChanged,
}: {
  order: PurchaseOrderView;
  onChanged: () => void;
}) {
  const [photo, setPhoto] = React.useState<{ src: string; label: string } | null>(null);

  const checked = order.lines.filter((l) => l.handover);
  const waiting = checked.length === 0;
  const received = sum(checked, (l) => l.handover!.receivedKg);
  const accepted = sum(checked, (l) => l.handover!.acceptedKg);
  const rejected = sum(checked, (l) => l.handover!.rejectedKg);
  const amountDue = sum(checked, (l) => l.handover!.acceptedKg * l.pricePerKg);
  const partial = !waiting && checked.length < order.lines.length;

  return (
    <section className="card-surface p-4 sm:p-6">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <ClipboardCheck className="size-5 text-primary" />
        Quality
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        The buyer sees the specification before ordering. An ARG TECH field agent
        checks the produce at handover, and the buyer pays only for the kg
        accepted.
      </p>

      {/* ------------------------------------------------------- summary */}
      <div className="mt-4 rounded-lg bg-muted/40 p-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
          <DetailItem label="Ordered" value={`${num(order.totalQuantityKg)} kg`} />
          {waiting ? (
            <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
              <Hourglass className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Waiting for handover check</p>
            </div>
          ) : (
            <>
              <DetailItem label="Received" value={`${num(received)} kg`} />
              <DetailItem label="Accepted" value={`${num(accepted)} kg`} />
              <DetailItem label="Rejected" value={`${num(rejected)} kg`} />
              <DetailItem
                label="Amount due"
                value={
                  <span>
                    <span className="font-semibold">{money(amountDue)}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Based on accepted kg
                    </span>
                  </span>
                }
              />
            </>
          )}
        </dl>
        {partial ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {checked.length} of {order.lines.length} farmer lines checked so far.
            Totals cover the checked lines only.
          </p>
        ) : null}
      </div>

      {/* --------------------------------------------- specification used */}
      <div className="mt-4">
        <h4 className="text-xs font-medium text-muted-foreground">
          Specification used
        </h4>
        <p className="mt-1 text-sm">
          {order.specSnapshot || (
            <span className="text-muted-foreground">No specification was recorded.</span>
          )}
        </p>
        {order.requirements ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Buyer&apos;s choice: {order.requirements}
          </p>
        ) : null}
      </div>

      {/* ---------------------------------------------------- per-line cards */}
      <div className="mt-4 space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground">
          Handover check by farmer line
        </h4>
        {order.lines.map((line) => (
          <LineCard
            key={line.id}
            line={line}
            pickup={order.method === "Pickup"}
            onPhoto={(src, label) => setPhoto({ src, label })}
          />
        ))}
        <p className="text-xs text-muted-foreground">
          The agent saves each check in the field, so it cannot be edited here.
          Add a staff note in the log below.
        </p>
      </div>

      <QualityLog order={order} onChanged={onChanged} />

      {photo ? (
        <AppDialog
          open
          onOpenChange={(open) => {
            if (!open) setPhoto(null);
          }}
          title={photo.label}
          size="md"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={photo.label}
            className="mx-auto max-h-[70vh] w-full rounded-xl ring-1 ring-black/5 object-contain"
          />
        </AppDialog>
      ) : null}
    </section>
  );
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return Math.round(rows.reduce((total, row) => total + pick(row), 0) * 100) / 100;
}

function yesNo(value: boolean | null): string {
  return value === null ? "Not recorded" : value ? "Yes" : "No";
}

function LineCard({
  line,
  pickup,
  onPhoto,
}: {
  line: OrderLineView;
  pickup: boolean;
  onPhoto: (src: string, label: string) => void;
}) {
  const h = line.handover;
  return (
    <div className="rounded-xl bg-muted/40 p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {line.farmerName}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {line.plotName} · {line.cycleCode}
            {line.lotCode ? ` · Lot ${line.lotCode}` : ""}
          </span>
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {num(line.quantityKg)} kg ordered
        </p>
      </div>

      {!h ? (
        <p className="mt-2 text-sm text-muted-foreground">Check not saved yet</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <DetailItem label="Received" value={`${num(h.receivedKg)} kg`} />
            <DetailItem label="Accepted" value={`${num(h.acceptedKg)} kg`} />
            <DetailItem label="Rejected" value={`${num(h.rejectedKg)} kg`} />
            <DetailItem
              label="Reason"
              value={h.rejectedKg > 0 ? h.rejectReason || "—" : "—"}
            />
            {pickup ? (
              <>
                <DetailItem
                  label="Buyer representative present"
                  value={yesNo(h.buyerRepPresent)}
                  className="col-span-2"
                />
                <DetailItem
                  label="Representative matches the order"
                  value={yesNo(h.repMatchesOrder)}
                  className="col-span-2"
                />
              </>
            ) : null}
            <DetailItem
              label="Checked"
              value={prettyDate(h.checkedAt)}
            />
            {h.note ? (
              <DetailItem
                label="Agent note"
                value={h.note}
                className="col-span-2 sm:col-span-3"
              />
            ) : null}
          </dl>
          {h.photos.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Handover photos">
              {h.photos.slice(0, 2).map((src, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onPhoto(src, `${line.farmerName}, photo ${i + 1}`)}
                    aria-label={`Open photo ${i + 1} for ${line.farmerName}`}
                    className="overflow-hidden rounded-xl ring-1 ring-black/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-16 w-24 object-cover transition-opacity hover:opacity-85"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- the log */

function QualityLog({
  order,
  onChanged,
}: {
  order: PurchaseOrderView;
  onChanged: () => void;
}) {
  const session = React.useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const [showAll, setShowAll] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const log = order.qualityLog;
  const visible = showAll ? log : log.slice(0, LOG_PREVIEW);

  const add = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await addQualityNote(order.id, draft, session?.fullName ?? "Staff");
      setDraft("");
      toast.success("Note added to the quality log.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h4 className="text-xs font-medium text-muted-foreground">
        Quality log
      </h4>

      {log.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing logged yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {visible.map((entry) => (
            <li key={entry.id} className="flex gap-3 py-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                {prettyDate(entry.at)}
              </span>
              <span className={cn("min-w-0", entry.kind === "note" && "italic")}>
                {entry.text}
                {entry.by ? (
                  <span className="ml-1.5 text-xs text-muted-foreground not-italic">
                    — {entry.by}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {log.length > LOG_PREVIEW ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
        >
          {showAll ? "Show latest five" : `Show all (${log.length})`}
        </Button>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="quality-note"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Add a staff note
          </label>
          <Textarea
            id="quality-note"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Called the buyer about the cracked cucumbers"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => void add()}
          disabled={saving || !draft.trim()}
        >
          {saving ? "Adding…" : "Add note"}
        </Button>
      </div>
    </div>
  );
}
