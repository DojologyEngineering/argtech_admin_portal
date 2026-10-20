"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable, type Column } from "@/components/data-table";
import { OrderStatusBadge, StatusBadge } from "@/components/status-badge";
import { NotInCatalogTag, OrderTags } from "@/components/orders/order-tags";
import { Button } from "@/components/ui/button";
import {
  hasOpenIssue,
  isOpenRequest,
  listOrders,
  type PurchaseOrderView,
} from "@/lib/services/orders";
import { dateLabel } from "@/lib/order-rules";
import { money, num, prettyDate } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

/**
 * Requested and Declined requests live on the Requests page, so the Orders list
 * and its filter chips only cover confirmed orders and later (plus cancelled).
 */
const ORDER_FILTERS = ORDER_STATUSES.filter(
  (s) => s !== "Requested" && s !== "Declined",
);

type StatusFilter = "" | OrderStatus;

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = React.useState<PurchaseOrderView[]>([]);
  const [waiting, setWaiting] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("");

  React.useEffect(() => {
    void listOrders().then((next) => {
      setOrders(next.filter((o) => !isOpenRequest(o)));
      setWaiting(next.filter((o) => o.status === "Requested").length);
      setLoading(false);
    });
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (status && o.status !== status) return false;
      if (!q) return true;
      return [o.code, o.buyerName, o.type, o.method, ...o.cropNames, ...o.farmerNames]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [orders, query, status]);

  const counts = React.useMemo(() => {
    const by = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
    return Object.fromEntries(ORDER_FILTERS.map((s) => [s, by(s)])) as Record<
      OrderStatus,
      number
    >;
  }, [orders]);

  const multiFarmer = orders.filter((o) => o.farmerNames.length > 1).length;

  const columns: Array<Column<PurchaseOrderView>> = [
    {
      key: "code",
      header: "Order",
      primary: true,
      className: "min-w-[13rem]",
      cell: (o) => (
        <div className="space-y-1">
          <span className="font-medium">{o.code}</span>
          <OrderTags type={o.type} method={o.method} className="font-normal" />
        </div>
      ),
    },
    {
      key: "crop",
      header: "Crop",
      cell: (o) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="max-w-[12rem] truncate"
            title={o.cropNames.join(", ")}
          >
            {o.cropNames.join(", ") || "—"}
          </span>
          {o.notInCatalog ? <NotInCatalogTag /> : null}
        </div>
      ),
    },
    {
      key: "qty",
      header: "Quantity",
      align: "right",
      cell: (o) => (
        <div>
          <span className="tabular-nums">{num(o.totalQuantityKg)} kg</span>
          {o.suppliedKg !== null && o.suppliedKg < o.requestedKg ? (
            <div className="text-xs text-muted-foreground tabular-nums">
              of {num(o.requestedKg)} kg asked
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "buyer",
      header: "Buyer",
      cell: (o) => (
        <span className="block max-w-[12rem] truncate" title={o.buyerName}>
          {o.buyerName}
        </span>
      ),
      subtitle: true,
    },
    {
      key: "date",
      header: "Date",
      cell: (o) => (
        <div className="whitespace-nowrap">
          <span>{prettyDate(o.deliveryDate)}</span>
          <div className="text-xs text-muted-foreground">{dateLabel(o)}</div>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (o) =>
        o.totalPrice === null ? (
          <span className="text-muted-foreground" title="Priced when confirmed">
            —
          </span>
        ) : (
          <span className="font-medium tabular-nums">{money(o.totalPrice)}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (o) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <OrderStatusBadge status={o.status} method={o.method} />
          {hasOpenIssue(o) ? <StatusBadge status="Issue" /> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/requests"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        {waiting === 1 ? "1 request waiting" : `${waiting} requests waiting`}
        <ArrowRight className="size-4" />
      </Link>

      <PageHeader
        title="Purchase Orders"
        subtitle={`${orders.length} orders · ${multiFarmer} drawing from more than one farmer`}
        actions={
          <Button onClick={() => router.push("/orders/new")}>
            <Plus className="size-4" />
            New Order
          </Button>
        }
      />

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by ID, buyer, crop or farmer…"
      >
        <div
          role="group"
          aria-label="Filter by status"
          className="flex flex-wrap items-center gap-1.5"
        >
          {(["", ...ORDER_FILTERS] as const).map((value) => {
            const active = status === value;
            const count = value === "" ? orders.length : counts[value];
            return (
              <Button
                key={value || "all"}
                size="sm"
                className="rounded-full px-4"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                title={
                  value === "Delivered" ? "Includes Picked up orders" : undefined
                }
                onClick={() => setStatus(value)}
              >
                {value || "All"}
                <span
                  className={
                    active ? "opacity-80" : "text-muted-foreground"
                  }
                >
                  {count}
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
        rowKey={(o) => o.id}
        loading={loading}
        onRowClick={(o) => router.push(`/orders/${o.id}`)}
        emptyTitle="No orders match this search"
        emptyHint="Try another buyer, crop or status."
        footer={`Showing ${filtered.length} of ${orders.length}`}
        actions={(o) => (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Open ${o.code}`}
            onClick={() => router.push(`/orders/${o.id}`)}
          >
            <Eye className="size-4" />
          </Button>
        )}
      />
    </div>
  );
}
