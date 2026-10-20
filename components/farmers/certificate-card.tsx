"use client";

import * as React from "react";
import { toast } from "sonner";
import { Award, ChevronDown, ImagePlus, Trash2 } from "lucide-react";
import { cn } from "cn";
import { FormSelect } from "@/components/form/form-select";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  removeCertificate,
  removeCertificateSafeImage,
  setCertificateAppliesTo,
  setCertificateCoversCrops,
  setCertificateImageApproved,
  setCertificateSafeImage,
  setCertificateSharing,
} from "@/lib/services/farmers";
import type { CropCycleView } from "@/lib/services/cycles";
import { dash, prettyDate } from "@/lib/format";
import {
  CERTIFICATE_SHARING,
  type Certificate,
  type CertificateSharing,
} from "@/lib/types";

const MAX_IMAGE_BYTES = 1_000_000;
const IMAGE_TYPES = ["image/png", "image/jpeg"];

export const NOT_VISIBLE_NOTE = "Not visible to buyers yet: no crop cycle selected";

/** "Details only · 2 cycles", or "Hidden". */
function summaryOf(cert: Certificate): string {
  if (cert.sharing === "Hidden") return "Hidden";
  const n = cert.appliesTo.length;
  return `${cert.sharing} · ${n} ${n === 1 ? "cycle" : "cycles"}`;
}

/**
 * One certificate. Collapsed it is a single summary row; expanded it holds the
 * sharing controls. Buyers only ever see what is set here: nothing, the details,
 * or the details with a buyer-safe copy of the document that staff have prepared
 * and approved.
 */
export function CertificateCard({
  farmerId,
  certificate: cert,
  cycles,
  crops,
  expanded,
  onToggle,
  onChanged,
}: {
  farmerId: string;
  certificate: Certificate;
  cycles: CropCycleView[];
  crops: Array<{ id: string; name: string }>;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  // "Details and image" needs an approved image first; this holds the choice
  // while the image is being uploaded and approved.
  const [wantsImage, setWantsImage] = React.useState(false);

  const imageReady = Boolean(cert.safeImage) && cert.safeImageApproved;
  const shownSharing: CertificateSharing = wantsImage ? "Details and image" : cert.sharing;
  const notVisible = cert.sharing !== "Hidden" && cert.appliesTo.length === 0;

  const run = async (
    action: () => Promise<{ notice?: string } | unknown>,
    done?: string,
  ): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    try {
      const result = (await action()) as { notice?: string } | undefined;
      if (result && typeof result === "object" && result.notice) {
        setNotice(result.notice);
        toast.info(result.notice);
      } else if (done) {
        toast.success(done);
      }
      onChanged();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the change.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error("Use a PNG or JPG image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("The image is over 1 MB. Use a smaller copy.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      void run(
        () => setCertificateSafeImage(farmerId, cert.id, String(reader.result)),
        "Buyer-safe image saved. Approve it before it can be shared.",
      );
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const changeSharing = (value: string) => {
    const sharing = value as CertificateSharing;
    if (sharing === "Details and image" && !imageReady) {
      setWantsImage(true);
      return;
    }
    setWantsImage(false);
    void run(() => setCertificateSharing(farmerId, cert.id, sharing), "Sharing updated.");
  };

  const approve = async (checked: boolean) => {
    const ok = await run(
      () => setCertificateImageApproved(farmerId, cert.id, checked),
      checked ? "Approved for buyers." : "No longer approved.",
    );
    if (ok && checked && wantsImage) {
      setWantsImage(false);
      await run(() => setCertificateSharing(farmerId, cert.id, "Details and image"));
    }
  };

  const setCycles = (next: string[]) =>
    void run(() => setCertificateAppliesTo(farmerId, cert.id, next));

  const toggleCycle = (cycleId: string, on: boolean) =>
    setCycles(
      on ? [...new Set([...cert.appliesTo, cycleId])] : cert.appliesTo.filter((id) => id !== cycleId),
    );

  const toggleCrop = (cropId: string) => {
    const next = cert.coversCropIds.includes(cropId)
      ? cert.coversCropIds.filter((id) => id !== cropId)
      : [...cert.coversCropIds, cropId];
    void run(() => setCertificateCoversCrops(farmerId, cert.id, next));
  };

  // Cycles grouped by crop, in the order the crops first appear.
  const groups = React.useMemo(() => {
    const byCrop = new Map<string, { cropId: string; name: string; items: CropCycleView[] }>();
    for (const cycle of cycles) {
      const group = byCrop.get(cycle.cropId) ?? {
        cropId: cycle.cropId,
        name: cycle.cropName,
        items: [],
      };
      group.items.push(cycle);
      byCrop.set(cycle.cropId, group);
    }
    return [...byCrop.values()];
  }, [cycles]);

  const matching = cycles.filter(
    (c) => cert.coversCropIds.includes(c.cropId) && !cert.appliesTo.includes(c.id),
  );
  const panelId = `cert-panel-${cert.id}`;

  return (
    <li className="rounded-xl bg-muted/40">
      {/* ---------------------------------------------------- summary row */}
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
            <Award className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="truncate text-sm font-medium">{cert.name}</span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {cert.type}
              </span>
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {summaryOf(cert)}
              {notVisible ? (
                <span className="text-amber-700 dark:text-amber-300"> · {NOT_VISIBLE_NOTE}</span>
              ) : null}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${cert.name}`}
          onClick={() =>
            void run(() => removeCertificate(farmerId, cert.id), "Certificate removed.")
          }
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {expanded ? (
        <div id={panelId} className="space-y-4 border-t border-border px-3.5 pt-3 pb-4">
          {/* ---------------------------------------------------- details */}
          <div>
            {cert.scope ? (
              <p className="text-xs text-muted-foreground">{cert.scope}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {dash(cert.issuer)}
              {cert.issuedDate ? ` · Issued ${prettyDate(cert.issuedDate)}` : ""}
              {cert.expiryDate ? ` · Expires ${prettyDate(cert.expiryDate)}` : " · No expiry"}
            </p>
            {cert.note ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{cert.note}</p>
            ) : null}
          </div>

          {/* --------------------------------------------------- sharing */}
          <div className="max-w-xs">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Sharing (what buyers can see)
            </p>
            <FormSelect
              value={shownSharing}
              onChange={changeSharing}
              options={CERTIFICATE_SHARING.map((value) => ({
                value,
                label: value,
                disabled: busy,
              }))}
            />
          </div>

          {notice ? (
            <p role="status" className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {notice}
            </p>
          ) : null}

          {/* ------------------------------------------------- safe image */}
          {shownSharing === "Details and image" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Buyer-safe image
                </p>
                {cert.safeImage ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cert.safeImage}
                      alt={`Buyer-safe copy of ${cert.name}`}
                      className="h-24 w-36 rounded-xl object-cover ring-1 ring-black/5"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => fileRef.current?.click()}
                      >
                        <ImagePlus className="size-3.5" />
                        Replace
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => removeCertificateSafeImage(farmerId, cert.id),
                            "Buyer-safe image removed.",
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`approved-${cert.id}`}
                        checked={cert.safeImageApproved}
                        disabled={busy}
                        onCheckedChange={(checked) => void approve(checked)}
                      />
                      <Label htmlFor={`approved-${cert.id}`} className="text-xs">
                        Approved for buyers
                      </Label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Upload a copy with names, ID numbers, addresses and QR codes hidden. PNG
                      or JPG, up to 1 MB.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImagePlus className="size-3.5" />
                      Upload image
                    </Button>
                  </div>
                )}
                {wantsImage ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Buyers see the details only until the image is approved.
                  </p>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label={`Upload buyer-safe image for ${cert.name}`}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </div>

              {cert.originalImage ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Original (staff only)
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cert.originalImage}
                    alt={`Original document for ${cert.name}, staff only`}
                    className="h-24 w-36 rounded-xl object-cover ring-1 ring-black/5"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Buyers never see this one.</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ------------------------------------------- covers crops */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Covers crops (optional)
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {crops.map((crop) => {
                const on = cert.coversCropIds.includes(crop.id);
                return (
                  <button
                    key={crop.id}
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => toggleCrop(crop.id)}
                    className={cn(
                      "h-7 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
                      on
                        ? "border-primary/30 bg-brand-soft text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-hover-tint",
                    )}
                  >
                    {crop.name}
                  </button>
                );
              })}
              <Button
                size="sm"
                variant="outline"
                className="ml-1"
                disabled={busy || matching.length === 0}
                onClick={() => {
                  setCycles([...cert.appliesTo, ...matching.map((c) => c.id)]);
                }}
              >
                Select matching cycles
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              A guide only. The button ticks this farmer&apos;s cycles of these crops below and never
              unticks one.
            </p>
          </div>

          {/* ---------------------------------------- show on lots from */}
          <fieldset>
            <legend className="mb-0.5 text-xs font-medium text-muted-foreground">
              Show on lots from these crop cycles
            </legend>
            <p className="mb-2 text-xs text-muted-foreground">
              Buyers see this certificate on lots from the ticked cycles.
            </p>
            {cycles.length === 0 ? (
              <p className="text-xs text-muted-foreground">This farmer has no crop cycles yet.</p>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => {
                  const ids = group.items.map((c) => c.id);
                  const allOn = ids.every((id) => cert.appliesTo.includes(id));
                  return (
                    <div key={group.cropId}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold">{group.name}</p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setCycles(
                              allOn
                                ? cert.appliesTo.filter((id) => !ids.includes(id))
                                : [...new Set([...cert.appliesTo, ...ids])],
                            )
                          }
                          className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
                        >
                          {allOn ? `Clear ${group.name}` : `Select all ${group.name}`}
                        </button>
                      </div>
                      <ul className="space-y-1">
                        {group.items.map((cycle) => {
                          const id = `${cert.id}-${cycle.id}`;
                          return (
                            <li key={cycle.id} className="flex items-center gap-2">
                              <Checkbox
                                id={id}
                                checked={cert.appliesTo.includes(cycle.id)}
                                onCheckedChange={(checked) =>
                                  toggleCycle(cycle.id, Boolean(checked))
                                }
                                disabled={busy}
                              />
                              <Label
                                htmlFor={id}
                                className="flex flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-normal"
                              >
                                <span className="font-medium tabular-nums">{cycle.code}</span>
                                <StatusBadge status={cycle.metrics.status} dot={false} />
                                <span className="text-muted-foreground">
                                  Planted {prettyDate(cycle.plantingDate)}
                                </span>
                              </Label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            {notVisible ? (
              <p
                role="status"
                className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
              >
                {NOT_VISIBLE_NOTE}
              </p>
            ) : null}
          </fieldset>
        </div>
      ) : null}
    </li>
  );
}
