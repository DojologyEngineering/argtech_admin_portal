"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "cn";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Loader2,
  Package,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { OrderStatusBadge, StatusBadge } from "@/components/status-badge";
import { DetailItem } from "@/components/form/field";
import { OrderEditDialog } from "@/components/orders/order-edit-dialog";
import { BuyerFeedbackCard } from "@/components/orders/buyer-feedback-card";
import { PickupArrangement } from "@/components/orders/pickup-arrangement";
import { QualityPanel } from "@/components/orders/quality-panel";
import { ReasonDialog } from "@/components/orders/reason-dialog";
import {
  MethodTag,
  NotInCatalogTag,
  OrderTags,
  TypeTag,
} from "@/components/orders/order-tags";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  deleteOrder,
  getOrder,
  hasOpenIssue,
  moveOrder,
  type PurchaseOrderView,
} from "@/lib/services/orders";
import {
  canCancel,
  canDecline,
  canDelete,
  dateLabel,
  nextStatus,
  statusLabel,
} from "@/lib/order-rules";
import { money, moneyPrecise, num, prettyDate } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

/** The forward path. Declined and Cancelled are end states shown separately. */
const LADDER: OrderStatus[] = ["Requested", "Confirmed", "Delivered", "Completed"];

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;

  const [order, setOrder] = React.useState<PurchaseOrderView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [reasonFor, setReasonFor] = React.useState<"Declined" | "Cancelled" | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  // The chosen tab is remembered for this order while staff move around inside it.
  const [tab, setTab] = React.useState<string>(() => {
    try {
      return window.sessionStorage.getItem(`order-tab:${orderId}`) ?? "overview";
    } catch {
      return "overview";
    }
  });
  const chooseTab = (value: string) => {
    setTab(value);
    try {
      window.sessionStorage.setItem(`order-tab:${orderId}`, value);
    } catch {
      // Storage can be blocked; the tab still works for this visit.
    }
  };

  const refresh = React.useCallback(
    () =>
      getOrder(orderId).then(
        (next) => {
          setOrder(next);
          setLoading(false);
        },
        () => {
          setNotFound(true);
          setLoading(false);
        },
      ),
    [orderId],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading order…
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
          That purchase order no longer exists.
        </p>
      </div>
    );
  }

  const next = nextStatus(order.status);
  const ended = order.status === "Declined" || order.status === "Cancelled";
  const ladderIndex = LADDER.indexOf(order.status);
  // The Quality panel only applies once an order has gone ahead.
  const showQuality =
    order.status === "Confirmed" ||
    order.status === "Delivered" ||
    order.status === "Completed";
  // Pickup arrangement exists for pickup orders that have gone ahead.
  const showPickupTab = Boolean(order.pickup) && showQuality;
  const tabValues = [
    "overview",
    ...(showQuality ? ["quality"] : []),
    ...(showPickupTab ? ["pickup"] : []),
  ];
  const activeTab = tabValues.includes(tab) ? tab : "overview";
  const needsCatalogCrop = order.status === "Requested" && order.notInCatalog;
  // A pickup order cannot be marked picked up before the pickup is arranged.
  const needsPickupArranged =
    next === "Delivered" &&
    order.method === "Pickup" &&
    order.pickup?.state !== "Arranged";

  const primaryLabel =
    next === "Confirmed"
      ? "Confirm and match farmers"
      : next === "Delivered"
        ? order.method === "Pickup"
          ? "Mark picked up"
          : "Mark delivered"
        : next === "Completed"
          ? "Mark completed"
          : "";

  const advance = async () => {
    if (!next) return;
    if (next === "Confirmed") {
      router.push(`/orders/new?confirm=${order.id}`);
      return;
    }
    setMoving(true);
    try {
      await moveOrder(order.id, next);
      toast.success(
        `${order.code} marked ${statusLabel(next, order.method).toLowerCase()}.`,
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the order.");
    } finally {
      setMoving(false);
    }
  };

  const withReason = async (to: "Declined" | "Cancelled", reason: string) => {
    await moveOrder(order.id, to, reason);
    toast.success(`${order.code} ${to.toLowerCase()}.`);
    await refresh();
  };

  const remove = async () => {
    try {
      await deleteOrder(order.id);
      toast.success(`${order.code} deleted.`);
      router.push("/orders");
    } catch (err) {
      setDeleteOpen(false);
      toast.error(err instanceof Error ? err.message : "Could not delete the order.");
    }
  };

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        title={`${order.code} · ${order.buyerName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <OrderStatusBadge status={order.status} method={order.method} />
            <OrderTags
              type={order.type}
              method={order.method}
              notInCatalog={order.notInCatalog}
            />
            {order.requestedAs ? (
              <span className="text-xs">Requested as {order.requestedAs}</span>
            ) : null}
            <span aria-hidden>·</span>
            <span>{num(order.totalQuantityKg)} kg</span>
            <span aria-hidden>·</span>
            <span>
              {order.totalPrice === null ? "Price set when confirmed" : money(order.totalPrice)}
            </span>
            {order.lineCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {order.lineCount} line item{order.lineCount === 1 ? "" : "s"} from{" "}
                  {order.farmerNames.length} farmer
                  {order.farmerNames.length === 1 ? "" : "s"}
                </span>
              </>
            ) : null}
          </span>
        }
        actions={
          <>
            {order.status === "Confirmed" ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            ) : null}
            {canDelete(order.status) ? (
              <Button variant="outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      {/* ------------------------------------------------- status flow */}
      <section className="card-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Order Status Flow</h3>
            {ended ? (
              <div className="mt-3 space-y-1.5">
                <OrderStatusBadge
                  status={order.status}
                  method={order.method}
                  className="h-7 px-3"
                />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Reason: </span>
                  {(order.status === "Declined"
                    ? order.declineReason
                    : order.cancelReason) || "—"}
                </p>
              </div>
            ) : (
              <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                {LADDER.map((step, i) => {
                  const done = i < ladderIndex;
                  const active = i === ladderIndex;
                  return (
                    <li key={step} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          active && "bg-primary text-primary-foreground",
                          done && "bg-brand-soft text-primary",
                          !active && !done && "bg-muted text-muted-foreground",
                        )}
                      >
                        {done ? <CircleCheck className="size-3.5" /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          "text-sm",
                          active ? "font-semibold" : "text-muted-foreground",
                        )}
                      >
                        {statusLabel(step, order.method)}
                      </span>
                      {i < LADDER.length - 1 ? (
                        <span
                          aria-hidden
                          className={cn(
                            "mx-1 h-px w-8",
                            done ? "bg-primary/40" : "bg-border",
                          )}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canDecline(order) ? (
              <Button variant="outline" onClick={() => setReasonFor("Declined")}>
                Decline
              </Button>
            ) : null}
            {canCancel(order.status) ? (
              <Button variant="outline" onClick={() => setReasonFor("Cancelled")}>
                Cancel order
              </Button>
            ) : null}
            {needsPickupArranged ? (
              <span className="text-xs text-muted-foreground">
                Arrange the pickup first.
              </span>
            ) : null}
            {next ? (
              <Button
                onClick={() => void advance()}
                disabled={moving || needsCatalogCrop || needsPickupArranged}
              >
                {primaryLabel}
                <ArrowRight className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {needsCatalogCrop ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {order.cropName} is not in the catalog, so there is no farmer supply
            to match yet. You can decline or cancel this request.
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------- tabs */}
      <Tabs value={activeTab} onValueChange={chooseTab}>
        {tabValues.length > 1 ? (
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <TabsList aria-label="Order sections">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {showQuality ? (
                <TabsTrigger value="quality">
                  Quality
                  {hasOpenIssue(order) ? <StatusBadge status="Issue" /> : null}
                </TabsTrigger>
              ) : null}
              {showPickupTab ? <TabsTrigger value="pickup">Pickup</TabsTrigger> : null}
            </TabsList>
          </div>
        ) : null}

        <TabsContent value="overview" className="mt-6 space-y-6">
      {/* -------------------------------------------------- line items */}
      <section className="overflow-hidden card-surface">
        <header className="border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Users className="size-5 text-primary" />
            Line items
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Farmer, plot and crop are read from each line&apos;s crop cycle — they are
            never re-entered on the order.
          </p>
        </header>

        {order.lines.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {order.status === "Requested"
              ? "No farmers are matched yet. Confirm the request to match supply."
              : "No stock is held for this order, so there are no farmer lines."}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Farmer", "Crop", "Plot", "Cycle", "Qty", "Price/kg", "Line total"].map(
                      (h, i) => (
                        <th
                          key={h}
                          scope="col"
                          className={cn(
                            "px-5 py-4 text-left text-xs font-medium text-muted-foreground",
                            i >= 4 && "text-right",
                          )}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={line.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-4 font-medium">
                        {line.farmerName}
                        {line.lotCode ? (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            Lot {line.lotCode}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        {line.cropName}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {line.cropVariety}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{line.plotName}</td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/cycles/${line.cropCycleId}`}
                          className="whitespace-nowrap text-primary hover:underline"
                        >
                          {line.cycleCode}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap tabular-nums">
                        {num(line.quantityKg)} kg
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap tabular-nums">
                        {moneyPrecise(line.pricePerKg)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium whitespace-nowrap tabular-nums">
                        {money(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/40">
                    <td colSpan={4} className="px-5 py-4 text-sm font-semibold">
                      Order total
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold whitespace-nowrap tabular-nums">
                      {num(order.totalQuantityKg)} kg
                    </td>
                    <td />
                    <td className="px-5 py-4 text-right text-sm font-semibold whitespace-nowrap tabular-nums">
                      {order.totalPrice === null ? "—" : money(order.totalPrice)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* stacked cards on phones */}
            <ul className="divide-y divide-border xl:hidden">
              {order.lines.map((line) => (
                <li key={line.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{line.farmerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {line.cropName} · {line.plotName}
                        {line.lotCode ? ` · Lot ${line.lotCode}` : ""}
                      </p>
                    </div>
                    <Link
                      href={`/cycles/${line.cropCycleId}`}
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      {line.cycleCode}
                    </Link>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Qty</dt>
                      <dd className="tabular-nums">{num(line.quantityKg)} kg</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Price</dt>
                      <dd className="tabular-nums">{moneyPrecise(line.pricePerKg)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Total</dt>
                      <dd className="font-medium tabular-nums">{money(line.lineTotal)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
              <li className="flex items-center justify-between bg-muted/40 px-5 py-4 text-sm font-semibold">
                <span>{num(order.totalQuantityKg)} kg</span>
                <span className="tabular-nums">
                  {order.totalPrice === null ? "—" : money(order.totalPrice)}
                </span>
              </li>
            </ul>
          </>
        )}
      </section>

      {/* ----------------------------------------------------- details */}
      <section className="card-surface p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Package className="size-5 text-primary" />
          Order details
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <DetailItem label="Buyer" value={order.buyerName} />
          <DetailItem label="Order date" value={prettyDate(order.orderDate)} />
          <DetailItem label="Type" value={<TypeTag type={order.type} />} />
          <DetailItem label="Method" value={<MethodTag method={order.method} />} />
          <DetailItem label={dateLabel(order)} value={prettyDate(order.deliveryDate)} />
          <DetailItem
            label="Crop"
            value={
              <span className="flex flex-wrap items-center gap-1.5">
                {order.cropName || "—"}
                {order.notInCatalog ? <NotInCatalogTag /> : null}
              </span>
            }
          />
          <DetailItem label="Requested" value={`${num(order.requestedKg)} kg`} />
          <DetailItem
            label="Supplied"
            value={order.suppliedKg === null ? "—" : `${num(order.suppliedKg)} kg`}
          />
          <DetailItem
            label="Price per kg"
            value={
              order.displayPricePerKg === null
                ? "—"
                : `${moneyPrecise(order.displayPricePerKg)}${order.priceMixed ? " (average)" : ""}`
            }
          />
          <DetailItem label="Farmers" value={order.farmerNames.join(", ") || "—"} />
          {order.method === "Delivery" ? (
            <DetailItem
              label="Delivery address"
              value={order.deliveryAddress || "—"}
              className="col-span-2"
            />
          ) : null}
          {order.requirements ? (
            <DetailItem
              label="Buyer requirements"
              value={order.requirements}
              className="col-span-2"
            />
          ) : null}
          {order.declineReason ? (
            <DetailItem
              label="Decline reason"
              value={order.declineReason}
              className="col-span-2"
            />
          ) : null}
          {order.cancelReason ? (
            <DetailItem
              label="Cancel reason"
              value={order.cancelReason}
              className="col-span-2"
            />
          ) : null}
          <DetailItem
            label="Note"
            value={order.note || "—"}
            className="col-span-2 sm:col-span-4"
          />
        </dl>
      </section>

        </TabsContent>

        {showQuality ? (
          <TabsContent value="quality" className="mt-6 space-y-6">

          <QualityPanel order={order} onChanged={() => void refresh()} />
          <BuyerFeedbackCard
            key={`${order.followUp.status}-${order.followUp.updatedAt}`}
            order={order}
            onChanged={() => void refresh()}
          />
                  </TabsContent>
        ) : null}

        {showPickupTab ? (
          <TabsContent value="pickup" className="mt-6 space-y-6">
            <PickupArrangement
              key={`${order.pickup!.state}-${order.pickup!.sharedAt}-${order.pickup!.date}`}
              order={order}
              onSaved={() => void refresh()}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      {editOpen ? (
        <OrderEditDialog
          open
          onOpenChange={setEditOpen}
          order={order}
          onSaved={() => void refresh()}
        />
      ) : null}

      <ReasonDialog
        key={reasonFor ?? "closed"}
        open={reasonFor !== null}
        onOpenChange={(open) => {
          if (!open) setReasonFor(null);
        }}
        title={reasonFor === "Declined" ? `Decline ${order.code}` : `Cancel ${order.code}`}
        description={
          reasonFor === "Declined"
            ? "The buyer sees this reason with the declined request."
            : "The buyer sees this reason, and any farmer stock held for the order is released."
        }
        label={reasonFor === "Declined" ? "Reason for declining" : "Reason for cancelling"}
        placeholder={
          reasonFor === "Declined"
            ? "e.g. Not enough supply for your date"
            : "e.g. Farmer could not deliver"
        }
        submitLabel={reasonFor === "Declined" ? "Decline request" : "Cancel order"}
        onSubmit={(reason) => withReason(reasonFor ?? "Cancelled", reason)}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {order.code}?</AlertDialogTitle>
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
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/orders"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Purchase Orders
    </Link>
  );
}
