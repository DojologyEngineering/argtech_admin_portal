"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable, type Column } from "@/components/data-table";
import { OrderStatusBadge } from "@/components/status-badge";
import { MethodTag, NotInCatalogTag } from "@/components/orders/order-tags";
import { MeetDecisionBadge } from "@/components/requests/request-check-card";
import { Button } from "@/components/ui/button";
import { listRequests, type PurchaseOrderView } from "@/lib/services/orders";
import { num, prettyDate } from "@/lib/format";

type Filter = "" | "Requested" | "Declined";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "", label: "All" },
  { value: "Requested", label: "Requested" },
  { value: "Declined", label: "Declined" },
];

/** Requested first (oldest needed-by date first), then Declined (latest first). */
function sortRequests(a: PurchaseOrderView, b: PurchaseOrderView): number {
  if (a.status !== b.status) return a.status === "Requested" ? -1 : 1;
  if (a.status === "Requested") {
    return a.deliveryDate.localeCompare(b.deliveryDate) || a.code.localeCompare(b.code);
  }
  return (b.declinedAt ?? "").localeCompare(a.declinedAt ?? "");
}

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = React.useState<PurchaseOrderView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<Filter>("");

  React.useEffect(() => {
    void listRequests().then((next) => {
      setRequests(next.sort(sortRequests));
      setLoading(false);
    });
  }, []);

  const counts = {
    "": requests.length,
    Requested: requests.filter((r) => r.status === "Requested").length,
    Declined: requests.filter((r) => r.status === "Declined").length,
  } satisfies Record<Filter, number>;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (status && r.status !== status) return false;
      if (!q) return true;
      return [r.code, r.buyerName, r.cropName, r.requirements]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [requests, query, status]);

  const columns: Array<Column<PurchaseOrderView>> = [
    {
      key: "code",
      header: "Code",
      primary: true,
      cell: (r) => (
        <div className="space-y-1">
          <span className="font-medium whitespace-nowrap">{r.code}</span>
          {r.status === "Requested" ? (
            <div>
              <MeetDecisionBadge decision={r.meetCheck.decision} />
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "crop",
      header: "Crop",
      cell: (r) => (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="max-w-[9rem] truncate" title={r.cropName}>
              {r.cropName || "—"}
            </span>
            {r.notInCatalog ? <NotInCatalogTag /> : null}
          </div>
          {/* Below 2xl the Requirements column is folded into this cell. */}
          {r.requirements ? (
            <span
              className="mt-0.5 block max-w-[14rem] truncate text-xs text-muted-foreground 2xl:hidden"
              title={r.requirements}
            >
              {r.requirements}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "kg",
      header: "Requested kg",
      align: "right",
      cell: (r) => `${num(r.requestedKg)} kg`,
      className: "whitespace-nowrap",
    },
    {
      key: "buyer",
      header: "Buyer",
      cell: (r) => (
        <span className="block max-w-[9rem] truncate" title={r.buyerName}>
          {r.buyerName}
        </span>
      ),
      subtitle: true,
    },
    {
      key: "needed",
      header: "Needed by",
      cell: (r) => prettyDate(r.deliveryDate),
      className: "whitespace-nowrap",
      headerClassName: "whitespace-nowrap",
    },
    {
      key: "method",
      header: "Method",
      cell: (r) => <MethodTag method={r.method} />,
    },
    {
      key: "requirements",
      header: "Requirements",
      cell: (r) =>
        r.requirements ? (
          <span
            className="block max-w-[14rem] truncate text-muted-foreground"
            title={r.requirements}
          >
            {r.requirements}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      hideBelow: "2xl",
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <OrderStatusBadge status={r.status} method={r.method} />,
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        View confirmed orders
        <ArrowRight className="size-4" />
      </Link>

      <PageHeader
        title="Requests"
        subtitle={`${counts.Requested} waiting for a reply · ${counts.Declined} declined`}
      />

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by code, buyer or crop…"
      >
        <div
          role="group"
          aria-label="Filter by status"
          className="flex flex-wrap items-center gap-1.5"
        >
          {FILTERS.map(({ value, label }) => {
            const active = status === value;
            return (
              <Button
                key={label}
                size="sm"
                className="rounded-full px-4"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => setStatus(value)}
              >
                {label}
                <span className={active ? "opacity-80" : "text-muted-foreground"}>
                  {counts[value]}
                </span>
              </Button>
            );
          })}
        </div>
      </ListToolbar>

      <DataTable
        tableFrom="xl"
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={(r) => router.push(`/requests/${r.id}`)}
        emptyTitle={
          requests.length === 0 ? "No requests yet" : "No requests match this search"
        }
        emptyHint={
          requests.length === 0
            ? "Requests from buyers appear here as soon as they are sent."
            : "Try another buyer, crop or status."
        }
        footer={`Showing ${filtered.length} of ${requests.length}`}
        actions={(r) => (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Open ${r.code}`}
            onClick={() => router.push(`/requests/${r.id}`)}
          >
            <Eye className="size-4" />
          </Button>
        )}
      />
    </div>
  );
}
