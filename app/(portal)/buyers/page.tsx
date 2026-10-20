"use client";

import * as React from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable, type Column } from "@/components/data-table";
import { BuyerDetailDialog } from "@/components/buyers/buyer-detail-dialog";
import { BuyerFormDialog } from "@/components/buyers/buyer-form-dialog";
import { Button } from "@/components/ui/button";
import { listBuyerViews, type BuyerView } from "@/lib/services/buyers";
import { dash, initials, money, num, prettyDate } from "@/lib/format";

export default function BuyersPage() {
  const [buyers, setBuyers] = React.useState<BuyerView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BuyerView | null>(null);

  const refresh = React.useCallback(
    () =>
      listBuyerViews().then((rows) => {
        setBuyers(rows);
        setLoading(false);
      }),
    [],
  );

  // Derived from the list, so an edit is reflected without re-syncing a copy.
  const selected = buyers.find((b) => b.id === selectedId) ?? null;

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((b) => b.name.toLowerCase().includes(q));
  }, [buyers, query]);

  const open = (buyer: BuyerView) => {
    setSelectedId(buyer.id);
    setDetailOpen(true);
  };

  const columns: Array<Column<BuyerView>> = [
    {
      key: "name",
      header: "Name",
      primary: true,
      cell: (b) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-primary">
            {initials(b.name)}
          </span>
          <span className="font-medium">{b.name}</span>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact person",
      cell: (b) => dash(b.contactPerson),
      hideBelow: "lg",
    },
    { key: "phone", header: "Phone", cell: (b) => dash(b.phone) },
    {
      key: "email",
      header: "Email",
      cell: (b) => <span className="text-muted-foreground">{dash(b.email)}</span>,
      hideBelow: "xl",
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      cell: (b) => num(b.orderCount),
    },
    {
      key: "requests",
      header: "Requests",
      align: "right",
      cell: (b) => num(b.requestCount),
    },
    {
      key: "total",
      header: "Total ordered",
      align: "right",
      cell: (b) => <span className="font-medium tabular-nums">{money(b.totalOrdered)}</span>,
    },
    {
      key: "last",
      header: "Last order",
      cell: (b) => prettyDate(b.lastOrderDate),
      hideBelow: "md",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buyers"
        subtitle={`${buyers.length} registered buyer${buyers.length === 1 ? "" : "s"}`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add Buyer
          </Button>
        }
      />

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by buyer name…"
      />

      <DataTable
        tableFrom="xl"
        columns={columns}
        rows={filtered}
        rowKey={(b) => b.id}
        loading={loading}
        onRowClick={open}
        emptyTitle="No buyers match this search"
        emptyHint="Try a different name."
        footer={`Showing ${filtered.length} of ${buyers.length}`}
        actions={(b) => (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`View ${b.name}`}
              onClick={() => open(b)}
            >
              <Eye className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${b.name}`}
              onClick={() => {
                setEditing(b);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
          </>
        )}
      />

      {detailOpen && selected ? (
        <BuyerDetailDialog
          key={`${selected.id}-${selected.name}-${selected.orderCount}`}
          open
          onOpenChange={setDetailOpen}
          buyerId={selected.id}
          onEdit={() => {
            setEditing(selected);
            setDetailOpen(false);
            setFormOpen(true);
          }}
          onChanged={() => void refresh()}
        />
      ) : null}

      {formOpen ? (
        <BuyerFormDialog
          open
          onOpenChange={setFormOpen}
          buyer={editing}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}
