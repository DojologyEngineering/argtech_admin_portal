"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { DetailItem, Field, FormGrid } from "@/components/form/field";
import { ComboCreate } from "@/components/form/combo-create";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCertificate, type FarmerView } from "@/lib/services/farmers";
import { listPlotsByFarmer, type PlotView } from "@/lib/services/plots";
import { listCyclesByFarmer, type CropCycleView } from "@/lib/services/cycles";
import { listCrops } from "@/lib/services/crops";
import { CertificateCard } from "@/components/farmers/certificate-card";
import { addLookupValue, getLookup } from "@/lib/services/lookups";
import { dash, hectares, initials, prettyDate } from "@/lib/format";
import { CERTIFICATE_CAPTION, type CertificateType } from "@/lib/types";

export function FarmerDetailDialog({
  open,
  onOpenChange,
  farmer,
  onEdit,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmer: FarmerView | null;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [plots, setPlots] = React.useState<PlotView[]>([]);
  const [cycles, setCycles] = React.useState<CropCycleView[]>([]);
  const [certNames, setCertNames] = React.useState<string[]>([]);
  const [crops, setCrops] = React.useState<Array<{ id: string; name: string }>>([]);
  const [adding, setAdding] = React.useState(false);
  // One certificate is open at a time.
  const [openCertId, setOpenCertId] = React.useState<string | null>(null);

  const farmerId = farmer?.id;
  React.useEffect(() => {
    if (!farmerId) return;
    void listPlotsByFarmer(farmerId).then(setPlots);
    void listCyclesByFarmer(farmerId).then(setCycles);
    void getLookup("certificateName").then(setCertNames);
    void listCrops().then((rows) => setCrops(rows.map((c) => ({ id: c.id, name: c.name }))));
  }, [farmerId]);

  if (!farmer) return null;

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Farmer Profile"
      size="md"
    >
      <div className="space-y-6">
        {/* ------------------------------------------------ profile card */}
        <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-semibold text-primary">
              {initials(farmer.fullName)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">{farmer.fullName}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {[farmer.province, farmer.district].filter(Boolean).join(", ")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" />
                  {farmer.primaryPhone}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>

        {/* --------------------------------------------- personal details */}
        <section>
          <h4 className="mb-3 text-sm font-semibold">Personal Details</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            <DetailItem label="Gender" value={dash(farmer.gender)} />
            <DetailItem label="Date of Birth" value={prettyDate(farmer.dateOfBirth)} />
            <DetailItem label="Education" value={dash(farmer.educationLevel)} />
            <DetailItem label="Primary Phone" value={dash(farmer.primaryPhone)} />
            <DetailItem label="Secondary Phone" value={dash(farmer.secondaryPhone)} />
            <DetailItem label="Commune" value={dash(farmer.commune)} />
            <DetailItem label="Village" value={dash(farmer.village)} />
            <DetailItem
              label="Registered"
              value={prettyDate(farmer.createdAt)}
            />
            <DetailItem
              label="Remark"
              value={dash(farmer.remark)}
              className="col-span-2 sm:col-span-1"
            />
          </dl>
        </section>

        {/* ------------------------------------------------- linked plots */}
        <section>
          <h4 className="mb-3 text-sm font-semibold">
            Farm Plots ({plots.length})
          </h4>
          {plots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No plots recorded for this farmer yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {plots.map((plot) => (
                <li
                  key={plot.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3.5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
                      <MapPin className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{plot.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {plot.province} · {hectares(plot.areaHectares)} ·{" "}
                        {plot.soilType || "Soil not recorded"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={plot.ownershipType} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --------------------------------------------------- crop cycles */}
        <section>
          <h4 className="mb-3 text-sm font-semibold">Crop cycles ({cycles.length})</h4>
          {cycles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No crop cycles yet
            </p>
          ) : (
            <ul className="space-y-2">
              {cycles.map((cycle) => (
                <li
                  key={cycle.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                      <span>{cycle.cropName}</span>
                      <span className="text-xs font-normal text-muted-foreground tabular-nums">
                        {cycle.code}
                      </span>
                      <StatusBadge status={cycle.metrics.status} />
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Planted {prettyDate(cycle.plantingDate)} · Expected harvest{" "}
                      {prettyDate(cycle.expectedHarvestDate)}
                    </p>
                  </div>
                  <Link
                    href={`/cycles/${cycle.id}`}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    View cycle
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* -------------------------------------------------- certificates */}
        <section>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">
                Certificates ({farmer.certificates.length})
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Buyers see shared certificates as: {CERTIFICATE_CAPTION}
              </p>
            </div>
            {!adding ? (
              <Button size="sm" className="shrink-0" onClick={() => setAdding(true)}>
                <Plus className="size-3.5" />
                Add Certificate
              </Button>
            ) : null}
          </div>

          {adding ? (
            <CertificateForm
              options={certNames}
              onCancel={() => setAdding(false)}
              onSubmit={async (input) => {
                await addCertificate(farmer.id, {
                  ...input,
                  type: certificateTypeFor(input.name),
                  scope: "",
                });
                if (input.name) await addLookupValue("certificateName", input.name);
                toast.success("Certificate added.");
                setAdding(false);
                onChanged();
              }}
            />
          ) : null}

          {farmer.certificates.length === 0 && !adding ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No certificates added yet
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {farmer.certificates.map((cert) => (
                <CertificateCard
                  key={cert.id}
                  farmerId={farmer.id}
                  certificate={cert}
                  cycles={cycles}
                  crops={crops}
                  expanded={openCertId === cert.id}
                  onToggle={() => setOpenCertId(openCertId === cert.id ? null : cert.id)}
                  onChanged={onChanged}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppDialog>
  );
}

/** The form only asks for a name, so the Agent App's type is inferred from it. */
function certificateTypeFor(name: string): CertificateType {
  if (/gap/i.test(name)) return "GAP";
  if (/organic/i.test(name)) return "Organic";
  return "Other";
}

function CertificateForm({
  options,
  onSubmit,
  onCancel,
}: {
  options: string[];
  onSubmit: (input: {
    name: string;
    issuer: string;
    issuedDate: string;
    expiryDate: string | null;
    note: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState("");
  const [issuer, setIssuer] = React.useState("");
  const [issuedDate, setIssuedDate] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const valid = name.trim() && issuedDate;

  return (
    <div className="space-y-4 rounded-xl bg-muted/50 p-4">
      <FormGrid>
        <Field label="Certificate" required>
          <ComboCreate
            value={name}
            onChange={setName}
            options={options}
            placeholder="Select or type to create…"
          />
        </Field>
        <Field label="Issuer">
          <Input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="e.g. GDA / MAFF"
          />
        </Field>
        <Field label="Issued Date" required>
          <Input
            type="date"
            value={issuedDate}
            onChange={(e) => setIssuedDate(e.target.value)}
          />
        </Field>
        <Field label="Expiry Date" hint="Leave blank if it does not expire">
          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </Field>
      </FormGrid>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit({
                name: name.trim(),
                issuer: issuer.trim(),
                issuedDate,
                expiryDate: expiryDate || null,
                note: "",
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          Save Certificate
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
