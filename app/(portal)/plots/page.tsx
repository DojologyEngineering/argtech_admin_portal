"use client";

import * as React from "react";
import { Eye, MapPin, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable, type Column } from "@/components/data-table";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { StatusBadge } from "@/components/status-badge";
import { PlotFormDialog } from "@/components/plots/plot-form-dialog";
import { PlotDetailDialog } from "@/components/plots/plot-detail-dialog";
import { Button } from "@/components/ui/button";
import { listPlots, type PlotView } from "@/lib/services/plots";
import { provinceNames } from "@/lib/address";
import { dash, num } from "@/lib/format";

export default function PlotsPage() {
  const [plots, setPlots] = React.useState<PlotView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [province, setProvince] = React.useState("");
  const [ownership, setOwnership] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PlotView | null>(null);

  const refresh = React.useCallback(
    () =>
      listPlots().then((rows) => {
        setPlots(rows);
        setLoading(false);
      }),
    [],
  );

  // Derived from the list, so an edit is reflected without re-syncing a copy.
  const selected = plots.find((p) => p.id === selectedId) ?? null;

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return plots.filter((p) => {
      if (province && p.province !== province) return false;
      if (ownership && p.ownershipType !== ownership) return false;
      if (!q) return true;
      return [p.name, p.farmerName, p.province, p.district, p.commune, p.soilType]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [plots, query, province, ownership]);

  const tracedCount = plots.filter((p) => p.areaSource === "polygon").length;
  const totalArea = plots.reduce((s, p) => s + p.areaHectares, 0);

  const columns: Array<Column<PlotView>> = [
    {
      key: "name",
      header: "Name",
      primary: true,
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <MapPin className="size-4 shrink-0 text-primary" />
          <span className="font-medium whitespace-nowrap">{p.name}</span>
        </div>
      ),
    },
    { key: "farmer", header: "Farmer", cell: (p) => p.farmerName },
    {
      key: "location",
      header: "Location",
      cell: (p) => `${p.province}, ${p.district}`,
      hideBelow: "lg",
    },
    {
      key: "area",
      header: "Area",
      align: "right",
      cell: (p) =>
        p.areaHectares > 0 ? (
          <span className="whitespace-nowrap tabular-nums">{num(p.areaHectares, 3)} ha</span>
        ) : (
          <span className="text-muted-foreground">Not measured</span>
        ),
    },
    {
      key: "ownership",
      header: "Ownership",
      cell: (p) => <StatusBadge status={p.ownershipType} />,
    },
    {
      key: "soil",
      header: "Soil",
      cell: (p) => dash(p.soilType),
      hideBelow: "xl",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farm Plots"
        subtitle={`${plots.length} registered plots · ${num(totalArea, 2)} ha total · ${tracedCount} traced on satellite`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add Plot
          </Button>
        }
      />

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search plots…"
      >
        <div className="w-full sm:w-52">
          <FormSelect
            value={province}
            onChange={setProvince}
            options={[
              { value: "", label: "All provinces" },
              ...stringOptions(provinceNames()),
            ]}
            placeholder="All provinces"
          />
        </div>
        <div className="w-full sm:w-44">
          <FormSelect
            value={ownership}
            onChange={setOwnership}
            options={[
              { value: "", label: "All ownership" },
              { value: "Own", label: "Own" },
              { value: "Rent", label: "Rent" },
            ]}
            placeholder="All ownership"
          />
        </div>
      </ListToolbar>

      <DataTable
        tableFrom="xl"
        columns={columns}
        rows={filtered}
        rowKey={(p) => p.id}
        loading={loading}
        onRowClick={(p) => {
          setSelectedId(p.id);
          setDetailOpen(true);
        }}
        emptyTitle="No plots match this search"
        emptyHint="Try another farmer name, province or soil type."
        footer={`Showing ${filtered.length} of ${plots.length}`}
        actions={(p) => (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`View ${p.name}`}
              onClick={() => {
                setSelectedId(p.id);
                setDetailOpen(true);
              }}
            >
              <Eye className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${p.name}`}
              onClick={() => {
                setEditing(p);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
          </>
        )}
      />

      {detailOpen ? (
        <PlotDetailDialog
          open
          onOpenChange={setDetailOpen}
          plot={selected}
          onEdit={() => {
            setEditing(selected);
            setDetailOpen(false);
            setFormOpen(true);
          }}
        />
      ) : null}

      {formOpen ? (
        <PlotFormDialog
          open
          onOpenChange={setFormOpen}
          plot={editing}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}
