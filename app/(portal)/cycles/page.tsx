"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Eye, Leaf, Package, Pencil, Plus, Scissors, Sprout } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable, type Column } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { StatusBadge } from "@/components/status-badge";
import { CycleFormDialog } from "@/components/cycles/cycle-form-dialog";
import { Button } from "@/components/ui/button";
import { listCycles, type CropCycleView } from "@/lib/services/cycles";
import { num, prettyDate } from "@/lib/format";
import { CYCLE_STATUSES } from "@/lib/types";

export default function CyclesPage() {
  const router = useRouter();
  const [cycles, setCycles] = React.useState<CropCycleView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CropCycleView | null>(null);

  const refresh = React.useCallback(
    () =>
      listCycles().then((rows) => {
        setCycles(rows);
        setLoading(false);
      }),
    [],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return cycles.filter((c) => {
      if (status && c.metrics.status !== status) return false;
      if (!q) return true;
      return [c.code, c.cropName, c.cropVariety, c.farmerName, c.plotName]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [cycles, query, status]);

  const counts = React.useMemo(() => {
    const by = (s: string) => cycles.filter((c) => c.metrics.status === s).length;
    return {
      growing: by("Growing"),
      ready: by("Ready to Harvest"),
      harvesting: by("Harvesting"),
      completed: by("Completed"),
      available: cycles.reduce((s, c) => s + c.metrics.availableKg, 0),
    };
  }, [cycles]);

  const columns: Array<Column<CropCycleView>> = [
    {
      key: "crop",
      header: "Crop",
      primary: true,
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <Leaf className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="font-medium">{c.cropName}</div>
            <div className="text-xs text-muted-foreground">{c.code}</div>
          </div>
        </div>
      ),
    },
    { key: "farmer", header: "Farmer", cell: (c) => c.farmerName },
    { key: "plot", header: "Plot", cell: (c) => c.plotName, hideBelow: "lg" },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge status={c.metrics.status} />,
    },
    {
      key: "planting",
      header: "Planting",
      cell: (c) => prettyDate(c.plantingDate),
      hideBelow: "xl",
    },
    {
      key: "harvest",
      header: "Exp. harvest",
      cell: (c) => prettyDate(c.expectedHarvestDate),
      hideBelow: "lg",
    },
    {
      key: "harvested",
      header: "Harvested",
      align: "right",
      cell: (c) =>
        c.metrics.harvestedKg > 0 ? (
          <span className="tabular-nums">{num(c.metrics.harvestedKg)} kg</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "available",
      header: "Available",
      align: "right",
      cell: (c) =>
        c.metrics.availableKg > 0 ? (
          <span className="font-medium text-primary tabular-nums">
            {num(c.metrics.availableKg)} kg
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crop Cycles"
        subtitle={`${cycles.length} cycles across all farmers`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            New Cycle
          </Button>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Sprout />} value={counts.growing} label="Growing" />
        <StatCard icon={<CalendarCheck />} value={counts.ready} label="Ready to Harvest" />
        <StatCard icon={<Scissors />} value={counts.harvesting} label="Harvesting" />
        <StatCard
          icon={<Package />}
          value={`${num(counts.available)} kg`}
          label="Available to sell"
          hint="Across every cycle"
        />
      </div>

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by crop, farmer or plot…"
      >
        <div className="w-full sm:w-52">
          <FormSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "All statuses" },
              ...stringOptions([...CYCLE_STATUSES]),
            ]}
            placeholder="All statuses"
          />
        </div>
      </ListToolbar>

      <DataTable
        tableFrom="xl"
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        loading={loading}
        onRowClick={(c) => router.push(`/cycles/${c.id}`)}
        emptyTitle="No crop cycles match this search"
        emptyHint="Try another crop, farmer or status."
        footer={`Showing ${filtered.length} of ${cycles.length}`}
        actions={(c) => (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Open ${c.code}`}
              onClick={() => router.push(`/cycles/${c.id}`)}
            >
              <Eye className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${c.code}`}
              onClick={() => {
                setEditing(c);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
          </>
        )}
      />

      {formOpen ? (
        <CycleFormDialog
          open
          onOpenChange={setFormOpen}
          cycle={editing}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}
