"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Database, ListFilter, RotateCcw, User } from "lucide-react";
import { DetailItem } from "@/components/form/field";
import { ComboCreate } from "@/components/form/combo-create";
import { Button } from "@/components/ui/button";
import { PickupPointsSection } from "@/components/settings/pickup-points";
import { addLookupValue, listLookups } from "@/lib/services/lookups";
import {
  getServerSessionSnapshot,
  getSessionSnapshot,
  subscribeSession,
} from "@/lib/services/auth";
import { resetDb } from "@/lib/mock/store";
import type { LookupKey, Lookups } from "@/lib/types";

const LOOKUP_LABELS: Array<{ key: LookupKey; label: string; hint: string }> = [
  { key: "soilType", label: "Soil types", hint: "Offered on the plot form" },
  { key: "irrigationType", label: "Irrigation types", hint: "Offered on the plot form" },
  { key: "infrastructure", label: "Infrastructure", hint: "Offered on the plot form" },
  { key: "seedSource", label: "Seed sources", hint: "Offered on the crop form" },
  { key: "variety", label: "Varieties", hint: "Offered on the crop form" },
  { key: "certificateName", label: "Certificates", hint: "Offered on farmer profiles" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [lookups, setLookups] = React.useState<Lookups | null>(null);
  const session = React.useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );

  const refresh = React.useCallback(() => listLookups().then(setLookups), []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleReset = () => {
    resetDb();
    toast.success("Demo data reset to the seeded records.");
    router.refresh();
    window.location.reload();
  };

  return (
    <div className="space-y-6">

      <section className="card-surface p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <User className="size-5 text-primary" />
          Signed in
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <DetailItem label="Name" value={session?.fullName ?? "—"} />
          <DetailItem label="Username" value={session?.username ?? "—"} />
          <DetailItem label="Role" value={session?.role ?? "—"} />
        </dl>
      </section>

      <PickupPointsSection />

      <section className="card-surface p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ListFilter className="size-5 text-primary" />
          Reference lists
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Values field agents can extend on the fly. Adding one here makes it
          available in the matching form.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {LOOKUP_LABELS.map(({ key, label, hint }) => (
            <div key={key} className="rounded-xl bg-muted/40 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{label}</p>
                <span className="text-xs text-muted-foreground">
                  {lookups?.[key].length ?? 0}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>

              <ul className="mt-2 flex flex-wrap gap-1.5">
                {(lookups?.[key] ?? []).map((value) => (
                  <li
                    key={value}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs"
                  >
                    {value}
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <ComboCreate
                  value=""
                  onChange={async (value) => {
                    if (!value) return;
                    await addLookupValue(key, value);
                    void refresh();
                    toast.success(`"${value}" added to ${label.toLowerCase()}.`);
                  }}
                  options={[]}
                  placeholder="Add a value…"
                  emptyHint="Type a new value to add it."
                  allowClear={false}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Database className="size-5 text-primary" />
          Demo tools
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Put the sample data in this browser back to how it started. Anything
          you added or changed here is removed.
        </p>
        <Button variant="outline" onClick={handleReset} className="mt-4">
          <RotateCcw className="size-4" />
          Reset demo data
        </Button>
      </section>
    </div>
  );
}
