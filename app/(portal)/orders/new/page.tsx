"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Handshake, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SupplyMatcher, type DraftLine } from "@/components/orders/supply-matcher";
import {
  OrderDetailsFields,
  type OrderDetailsValue,
} from "@/components/orders/order-details-fields";
import { OrderStatusBadge } from "@/components/status-badge";
import { OrderTags } from "@/components/orders/order-tags";
import { DetailItem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import {
  confirmOrder,
  createOrder,
  findOrCreateBuyer,
  getOrder,
  type PurchaseOrderView,
} from "@/lib/services/orders";
import { dateLabel } from "@/lib/order-rules";
import { addDays, money, num, prettyDate, todayISO } from "@/lib/format";

/**
 * Supply Matching.
 *
 * Without a query string it builds a new confirmed order from farmer supply.
 * With `?confirm=<order id>` it confirms an open request: the request's crop and
 * quantity are preselected and the order keeps its number.
 */
export default function NewOrderPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      }
    >
      <NewOrderScreen />
    </React.Suspense>
  );
}

function NewOrderScreen() {
  const confirmId = useSearchParams().get("confirm");
  const [request, setRequest] = React.useState<PurchaseOrderView | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing">(
    confirmId ? "loading" : "ready",
  );

  React.useEffect(() => {
    if (!confirmId) return;
    let cancelled = false;
    void getOrder(confirmId).then(
      (found) => {
        if (cancelled) return;
        setRequest(found);
        setState("ready");
      },
      () => {
        if (!cancelled) setState("missing");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [confirmId]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading request…
      </div>
    );
  }

  if (confirmId) {
    if (state === "missing" || !request) {
      return (
        <div className="space-y-4">
          <BackLink href="/orders" label="Purchase Orders" />
          <p className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
            That request no longer exists.
          </p>
        </div>
      );
    }
    if (request.status !== "Requested" || request.notInCatalog) {
      return (
        <div className="space-y-4">
          <BackLink href={`/orders/${request.id}`} label={request.code} />
          <p className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
            {request.notInCatalog
              ? `${request.cropName} is not in the catalog, so there is no supply to match.`
              : `${request.code} is ${request.statusLabel.toLowerCase()} and cannot be confirmed.`}
          </p>
        </div>
      );
    }
    return <ConfirmRequest request={request} />;
  }

  return <NewOrder />;
}

/* ------------------------------------------------- confirm a request */

function ConfirmRequest({ request }: { request: PurchaseOrderView }) {
  const router = useRouter();
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const totalKg = lines.reduce((s, l) => s + l.quantityKg, 0);
  const totalValue = lines.reduce((s, l) => s + l.quantityKg * l.pricePerKg, 0);

  const handleConfirm = async () => {
    if (lines.length === 0) {
      toast.error("Allocate supply from at least one farmer first.");
      return;
    }
    if (lines.some((l) => l.quantityKg <= 0)) {
      toast.error("Every line item needs a quantity greater than zero.");
      return;
    }
    setSubmitting(true);
    try {
      const confirmed = await confirmOrder(
        request.id,
        lines.map((l) => ({
          cropCycleId: l.cropCycleId,
          quantityKg: l.quantityKg,
          pricePerKg: l.pricePerKg,
        })),
      );
      toast.success(
        `${confirmed.code} confirmed — ${num(totalKg)} kg from ${lines.length} farmer allocation(s).`,
      );
      router.push(`/orders/${confirmed.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not confirm the request.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <BackLink href={`/orders/${request.id}`} label={request.code} />

      <PageHeader
        title={`Confirm ${request.code}`}
        subtitle="Match farmers to this request. The price follows the buyer price tier for the total quantity."
      />

      <section className="card-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">
            {request.buyerName} · {request.cropName}
          </h3>
          <OrderStatusBadge status={request.status} method={request.method} />
          <OrderTags type={request.type} method={request.method} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <DetailItem label="Asked for" value={`${num(request.requestedKg)} kg`} />
          <DetailItem label={dateLabel(request)} value={prettyDate(request.deliveryDate)} />
          <DetailItem
            label={request.method === "Delivery" ? "Delivery address" : "Method"}
            value={request.deliveryAddress ?? request.method}
            className="col-span-2"
          />
          {request.requirements ? (
            <DetailItem
              label="Buyer requirements"
              value={request.requirements}
              className="col-span-2 sm:col-span-4"
            />
          ) : null}
          {request.note ? (
            <DetailItem label="Note" value={request.note} className="col-span-2 sm:col-span-4" />
          ) : null}
        </dl>
      </section>

      <SupplyMatcher
        lines={lines}
        onLinesChange={setLines}
        initialCropId={request.cropId ?? undefined}
        initialTargetKg={request.requestedKg}
      />

      <ActionBar
        totalKg={totalKg}
        lineCount={lines.length}
        totalValue={totalValue}
        cancelHref={`/orders/${request.id}`}
        submitLabel="Confirm order"
        busyLabel="Confirming…"
        submitting={submitting}
        onSubmit={() => void handleConfirm()}
      />
    </div>
  );
}

/* ----------------------------------------------- build a new order */

function NewOrder() {
  const router = useRouter();
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [details, setDetails] = React.useState<OrderDetailsValue>({
    buyerName: "",
    orderDate: todayISO(),
    deliveryDate: addDays(todayISO(), 5),
    type: "Order now",
    method: "Delivery",
    deliveryAddress: "",
    note: "",
  });
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof OrderDetailsValue, string>>
  >({});
  const [submitting, setSubmitting] = React.useState(false);

  const totalKg = lines.reduce((s, l) => s + l.quantityKg, 0);
  const totalValue = lines.reduce((s, l) => s + l.quantityKg * l.pricePerKg, 0);

  const handleSubmit = async () => {
    const next: Partial<Record<keyof OrderDetailsValue, string>> = {};
    if (!details.buyerName.trim()) next.buyerName = "A buyer is required.";
    if (!details.orderDate) next.orderDate = "An order date is required.";
    if (!details.deliveryDate) {
      next.deliveryDate =
        details.method === "Pickup"
          ? "A pickup date is required."
          : "A delivery date is required.";
    }
    if (details.method === "Delivery" && !details.deliveryAddress.trim()) {
      next.deliveryAddress = "A delivery address is required.";
    }
    setErrors(next);

    if (Object.keys(next).length > 0) {
      toast.error("Check the buyer and delivery details.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Allocate supply from at least one farmer first.");
      return;
    }
    if (lines.some((l) => l.quantityKg <= 0)) {
      toast.error("Every line item needs a quantity greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const buyer = await findOrCreateBuyer(details.buyerName);
      const order = await createOrder({
        buyerId: buyer.id,
        orderDate: details.orderDate,
        deliveryDate: details.deliveryDate,
        type: details.type,
        method: details.method,
        deliveryAddress: details.deliveryAddress,
        note: details.note,
        lineItems: lines.map((l) => ({
          cropCycleId: l.cropCycleId,
          quantityKg: l.quantityKg,
          pricePerKg: l.pricePerKg,
        })),
      });
      toast.success(
        `${order.code} created — ${num(totalKg)} kg from ${lines.length} farmer allocation(s).`,
      );
      router.push(`/orders/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the order.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <BackLink href="/orders" label="Purchase Orders" />

      <PageHeader
        title="Supply Matching"
        subtitle="Build one buyer order from several farmers' harvests"
      />

      <SupplyMatcher lines={lines} onLinesChange={setLines} />

      <section className="card-surface p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Handshake className="size-5 text-primary" />
          4 · Finalise the order
        </h3>
        <p className="mt-0.5 mb-4 text-xs text-muted-foreground">
          Order totals are summed from the line items above and are never entered
          directly. A new order starts as Confirmed.
        </p>
        <OrderDetailsFields
          value={details}
          onChange={setDetails}
          errors={errors}
        />
      </section>

      <ActionBar
        totalKg={totalKg}
        lineCount={lines.length}
        totalValue={totalValue}
        cancelHref="/orders"
        submitLabel="Create Order"
        busyLabel="Creating…"
        submitting={submitting}
        onSubmit={() => void handleSubmit()}
      />
    </div>
  );
}

/* ----------------------------------------------------------- shared */

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}

/** Action bar stays reachable on a phone without scrolling to the end. */
function ActionBar({
  totalKg,
  lineCount,
  totalValue,
  cancelHref,
  submitLabel,
  busyLabel,
  submitting,
  onSubmit,
}: {
  totalKg: number;
  lineCount: number;
  totalValue: number;
  cancelHref: string;
  submitLabel: string;
  busyLabel: string;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const router = useRouter();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-card/95 px-5 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:px-8 lg:pl-[calc(15rem+2rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-semibold tabular-nums">{num(totalKg)} kg</span>
          <span className="text-muted-foreground">
            {" "}
            · {lineCount} line item{lineCount === 1 ? "" : "s"} ·{" "}
          </span>
          <span className="font-semibold tabular-nums">{money(totalValue)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(cancelHref)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting || lineCount === 0}>
            {submitting ? busyLabel : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
