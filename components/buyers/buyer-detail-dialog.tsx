"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { DetailItem } from "@/components/form/field";
import { OrderStatusBadge } from "@/components/status-badge";
import { NotInCatalogTag, OrderTags } from "@/components/orders/order-tags";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteBuyer,
  getBuyerActivity,
  getBuyerView,
  type BuyerActivity,
  type BuyerView,
} from "@/lib/services/buyers";
import { dash, initials, money, num, prettyDate } from "@/lib/format";

export function BuyerDetailDialog({
  open,
  onOpenChange,
  buyerId,
  onEdit,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerId: string;
  onEdit: () => void;
  /** Called after the buyer is deleted so the list can refresh. */
  onChanged: () => void;
}) {
  const [buyer, setBuyer] = React.useState<BuyerView | null>(null);
  const [activity, setActivity] = React.useState<BuyerActivity | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([getBuyerView(buyerId), getBuyerActivity(buyerId)]).then(
      ([view, acts]) => {
        if (cancelled) return;
        setBuyer(view);
        setActivity(acts);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [buyerId]);

  if (!buyer || !activity) return null;

  const blocked = buyer.recordCount > 0;
  const recordWord = buyer.recordCount === 1 ? "record" : "records";

  const remove = async () => {
    try {
      await deleteBuyer(buyer.id);
      toast.success(`${buyer.name} deleted.`);
      setConfirmOpen(false);
      onOpenChange(false);
      onChanged();
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err instanceof Error ? err.message : "Could not delete the buyer.");
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buyer Profile"
      size="md"
    >
      <div className="space-y-6">
        {/* ------------------------------------------------ profile card */}
        <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-semibold text-primary">
              {initials(buyer.name)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">{buyer.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {buyer.phone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5" />
                    {buyer.phone}
                  </span>
                ) : null}
                {buyer.email ? (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3.5" />
                    {buyer.email}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>

        {/* ------------------------------------------------- summary */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <DetailItem label="Orders" value={num(buyer.orderCount)} />
          <DetailItem label="Requests waiting" value={num(buyer.requestCount)} />
          <DetailItem label="Total ordered" value={money(buyer.totalOrdered)} />
          <DetailItem label="Last order" value={prettyDate(buyer.lastOrderDate)} />
        </dl>

        {/* ------------------------------------------------- profile */}
        <section>
          <h4 className="mb-3 text-sm font-semibold">Profile</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            <DetailItem label="Contact person" value={dash(buyer.contactPerson)} />
            <DetailItem label="Phone" value={dash(buyer.phone)} />
            <DetailItem
              label="Email"
              value={dash(buyer.email)}
              className="col-span-2 sm:col-span-3"
            />
          </dl>
        </section>

        <section>
          <h4 className="mb-3 text-sm font-semibold">
            Delivery addresses ({buyer.addresses.length})
          </h4>
          {buyer.addresses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              No delivery address saved.
            </p>
          ) : (
            <ul className="space-y-2">
              {buyer.addresses.map((address) => (
                <li
                  key={address.id}
                  className="flex items-start gap-3 rounded-xl bg-muted/40 px-3.5 py-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
                    <MapPin className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{address.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {[address.line, address.district, address.city]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ----------------------------------------- orders and requests */}
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Orders ({activity.orders.length})</TabsTrigger>
            <TabsTrigger value="requests">
              Requests ({activity.requests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-3">
            {activity.orders.length === 0 ? (
              <EmptyTab>No orders yet.</EmptyTab>
            ) : (
              <ul className="divide-y divide-card overflow-hidden rounded-xl bg-muted/40">
                {activity.orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-hover-tint focus-visible:bg-hover-tint focus-visible:outline-none"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">
                          {o.code}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {o.cropName} · {num(o.totalQuantityKg)} kg
                          </span>
                        </p>
                        <OrderTags type={o.type} method={o.method} />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums">
                            {o.totalPrice === null ? "—" : money(o.totalPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {prettyDate(o.deliveryDate)}
                          </p>
                        </div>
                        <OrderStatusBadge status={o.status} method={o.method} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-3">
            {activity.requests.length === 0 ? (
              <EmptyTab>No requests.</EmptyTab>
            ) : (
              <ul className="divide-y divide-card overflow-hidden rounded-xl bg-muted/40">
                {activity.requests.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/requests/${r.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-hover-tint focus-visible:bg-hover-tint focus-visible:outline-none"
                    >
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                        {r.code}
                        <span className="font-normal text-muted-foreground">
                          {r.cropName} · {num(r.requestedKg)} kg
                        </span>
                        {r.notInCatalog ? <NotInCatalogTag /> : null}
                      </p>
                      <div className="flex items-center gap-4">
                        <p className="text-xs text-muted-foreground">
                          Needed by {prettyDate(r.deliveryDate)}
                        </p>
                        <OrderStatusBadge status={r.status} method={r.method} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        {/* --------------------------------------------------- delete */}
        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {blocked
              ? `Cannot be deleted: ${buyer.recordCount} order or request ${recordWord} on file.`
              : "This buyer has no orders or requests, so it can be deleted."}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={blocked}
            title={blocked ? "This buyer has orders or requests" : "Delete buyer"}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete buyer
          </Button>
        </section>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {buyer.name}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppDialog>
  );
}

function EmptyTab({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
