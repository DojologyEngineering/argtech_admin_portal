"use client";

import * as React from "react";
import { Eye, Pencil, Plus, Sprout } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable, type Column } from "@/components/data-table";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { FarmerFormDialog } from "@/components/farmers/farmer-form-dialog";
import { FarmerDetailDialog } from "@/components/farmers/farmer-detail-dialog";
import { Button } from "@/components/ui/button";
import { listFarmers, type FarmerView } from "@/lib/services/farmers";
import { dash, initials } from "@/lib/format";

export default function FarmersPage() {
  const [farmers, setFarmers] = React.useState<FarmerView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [district, setDistrict] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FarmerView | null>(null);

  const refresh = React.useCallback(
    () =>
      listFarmers().then((rows) => {
        setFarmers(rows);
        setLoading(false);
      }),
    [],
  );

  // Derived from the list, so an edit is reflected without re-syncing a copy.
  const selected = farmers.find((f) => f.id === selectedId) ?? null;

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return farmers.filter((f) => {
      if (district && f.district !== district) return false;
      if (!q) return true;
      return [f.fullName, f.primaryPhone, f.secondaryPhone, f.district, f.commune, f.village]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [farmers, query, district]);

  // Every farmer is in the Kampong Cham pilot, so the useful split is by district.
  const districts = React.useMemo(
    () => [...new Set(farmers.map((f) => f.district).filter(Boolean))].sort(),
    [farmers],
  );

  const columns: Array<Column<FarmerView>> = [
    {
      key: "name",
      header: "Name",
      primary: true,
      cell: (f) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-primary">
            {initials(f.fullName)}
          </span>
          <span className="font-medium">{f.fullName}</span>
        </div>
      ),
    },
    { key: "phone", header: "Phone", cell: (f) => f.primaryPhone },
    { key: "district", header: "District", cell: (f) => dash(f.district) },
    {
      key: "plots",
      header: "Plots",
      align: "right",
      cell: (f) => f.plotCount,
      hideBelow: "md",
    },
    {
      key: "cycles",
      header: "Active cycles",
      align: "right",
      cell: (f) => f.activeCycleCount,
      hideBelow: "md",
    },
    {
      key: "certs",
      header: "Certificates",
      cell: (f) => {
        if (f.certificateCount === 0) return <span className="text-muted-foreground">None</span>;
        const noun = `${f.certificateCount} certificate${f.certificateCount === 1 ? "" : "s"}`;
        return (
          <span className="whitespace-nowrap font-normal">
            {noun}
            {f.sharedCertificateCount > 0 ? ` · ${f.sharedCertificateCount} shared` : ""}
          </span>
        );
      },
      hideBelow: "lg",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farmers"
        subtitle={`${farmers.length} registered farmers`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add Farmer
          </Button>
        }
      />

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by name, phone, district…"
      >
        <div className="w-full sm:w-52">
          <FormSelect
            value={district}
            onChange={setDistrict}
            options={[
              { value: "", label: "All districts" },
              ...stringOptions(districts),
            ]}
            placeholder="All districts"
          />
        </div>
      </ListToolbar>

      <DataTable
        tableFrom="xl"
        columns={columns}
        rows={filtered}
        rowKey={(f) => f.id}
        loading={loading}
        onRowClick={(f) => {
          setSelectedId(f.id);
          setDetailOpen(true);
        }}
        emptyTitle="No farmers match this search"
        emptyHint="Try a different name, phone number or district."
        footer={`Showing ${filtered.length} of ${farmers.length}`}
        actions={(f) => (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`View ${f.fullName}`}
              onClick={() => {
                setSelectedId(f.id);
                setDetailOpen(true);
              }}
            >
              <Eye className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${f.fullName}`}
              onClick={() => {
                setEditing(f);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
          </>
        )}
      />

      {farmers.length === 0 && !loading ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Sprout className="size-4" />
          Field agents have not synced any farmers yet.
        </p>
      ) : null}

      {detailOpen ? (
        <FarmerDetailDialog
          open
          onOpenChange={setDetailOpen}
          farmer={selected}
          onEdit={() => {
            setEditing(selected);
            setDetailOpen(false);
            setFormOpen(true);
          }}
          onChanged={() => void refresh()}
        />
      ) : null}

      {formOpen ? (
        <FarmerFormDialog
          open
          onOpenChange={setFormOpen}
          farmer={editing}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}
