"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Eye, Pencil, Plus, Sprout, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable, type Column } from "@/components/data-table";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { StatusBadge } from "@/components/status-badge";
import { CropDetailDialog, CropFormDialog } from "@/components/crops/crop-dialogs";
import { Button } from "@/components/ui/button";
import { deleteCrop, listCrops, type CropView } from "@/lib/services/crops";
import { buyerPricesLabel, isSpecComplete } from "@/lib/crop-spec";
import { SEASONS } from "@/lib/types";

export default function CropsPage() {
  const [crops, setCrops] = React.useState<CropView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [season, setSeason] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CropView | null>(null);

  const refresh = React.useCallback(
    () =>
      listCrops().then((rows) => {
        setCrops(rows);
        setLoading(false);
      }),
    [],
  );

  // Derived from the list, so an edit is reflected without re-syncing a copy.
  const selected = crops.find((c) => c.id === selectedId) ?? null;

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return crops.filter((c) => {
      if (season && c.season !== season) return false;
      if (!q) return true;
      return [c.name, c.variety, c.seedSource]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [crops, query, season]);

  const handleDelete = async (crop: CropView) => {
    try {
      await deleteCrop(crop.id);
      toast.success(`${crop.name} removed from the catalogue.`);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the crop.");
    }
  };

  const columns: Array<Column<CropView>> = [
    {
      key: "name",
      header: "Name",
      primary: true,
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <Sprout className="size-4 shrink-0 text-primary" />
          <span className="font-medium">{c.name}</span>
        </div>
      ),
    },
    { key: "variety", header: "Variety", cell: (c) => c.variety },
    {
      key: "season",
      header: "Season",
      cell: (c) => <StatusBadge status={c.season} dot={false} />,
    },
    {
      key: "dth",
      header: "Days to Harvest",
      align: "right",
      cell: (c) => `${c.daysToHarvest}d`,
      hideBelow: "md",
    },
    {
      key: "buyerPrice",
      header: "Buyer price ($/kg)",
      headerSub: "<200 / 200 to 999 / 1,000+ kg",
      headerTitle: "Price per kg by order size: under 200 kg / 200 to 999 kg / 1,000 kg and above. The price for the order size applies to the whole quantity.",
      align: "right",
      cell: (c) => (
        <span className="font-medium whitespace-nowrap tabular-nums">
          {buyerPricesLabel(c.buyerPrices)}
        </span>
      ),
    },
    {
      key: "spec",
      header: "Specification",
      cell: (c) =>
        isSpecComplete(c.spec) ? (
          <span className="flex h-5 items-center text-emerald-700 dark:text-emerald-300">
            <Check className="size-4" aria-hidden />
            <span className="sr-only">Complete</span>
          </span>
        ) : (
          <span className="text-amber-700 dark:text-amber-300">Missing</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crop Management"
        subtitle={`${crops.length} registered crops`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add Crop
          </Button>
        }
      />

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by name or variety…"
      >
        <div className="w-full sm:w-44">
          <FormSelect
            value={season}
            onChange={setSeason}
            options={[
              { value: "", label: "All seasons" },
              ...stringOptions([...SEASONS]),
            ]}
            placeholder="All seasons"
          />
        </div>
      </ListToolbar>

      <DataTable
        tableFrom="xl"
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        loading={loading}
        onRowClick={(c) => {
          setSelectedId(c.id);
          setDetailOpen(true);
        }}
        emptyTitle="No crops match this search"
        emptyHint="Try another crop name, variety or season."
        footer={`Showing ${filtered.length} of ${crops.length}`}
        actions={(c) => (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`View ${c.name}`}
              onClick={() => {
                setSelectedId(c.id);
                setDetailOpen(true);
              }}
            >
              <Eye className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${c.name}`}
              onClick={() => {
                setEditing(c);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${c.name}`}
              disabled={c.cycleCount > 0}
              title={
                c.cycleCount > 0
                  ? "Crop cycles reference this crop"
                  : `Delete ${c.name}`
              }
              onClick={() => void handleDelete(c)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      />

      {detailOpen ? (
        <CropDetailDialog
          open
          onOpenChange={setDetailOpen}
          crop={selected}
          onEdit={() => {
            setEditing(selected);
            setDetailOpen(false);
            setFormOpen(true);
          }}
        />
      ) : null}

      {formOpen ? (
        <CropFormDialog
          open
          onOpenChange={setFormOpen}
          crop={editing}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}
