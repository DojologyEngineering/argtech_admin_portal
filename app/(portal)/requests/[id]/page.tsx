"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CircleX, Inbox, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { OrderStatusBadge } from "@/components/status-badge";
import { DetailItem } from "@/components/form/field";
import { CropFormDialog } from "@/components/crops/crop-dialogs";
import { ReasonDialog } from "@/components/orders/reason-dialog";
import { RequestCheckCard } from "@/components/requests/request-check-card";
import { MethodTag, NotInCatalogTag } from "@/components/orders/order-tags";
import { Button } from "@/components/ui/button";
import {
  getOrder,
  linkCatalogCrop,
  moveOrder,
  type PurchaseOrderView,
} from "@/lib/services/orders";
import { num, prettyDate } from "@/lib/format";

const DECLINE_REASONS = [
  "Not enough supply for your date",
  "Crop not available this season",
  "Quantity too small",
  "Other",
];

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const requestId = params.id;

  const [request, setRequest] = React.useState<PurchaseOrderView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [cropOpen, setCropOpen] = React.useState(false);

  const refresh = React.useCallback(
    () =>
      getOrder(requestId).then(
        (next) => {
          setRequest(next);
          setLoading(false);
        },
        () => {
          setNotFound(true);
          setLoading(false);
        },
      ),
    [requestId],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading request…
      </div>
    );
  }

  if (notFound || !request || request.type !== "Request") {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
          That request no longer exists.
        </p>
      </div>
    );
  }

  // A request that has moved on lives on the Orders page under its PO code.
  if (request.status !== "Requested" && request.status !== "Declined") {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
          This request is now {request.code} ({request.statusLabel.toLowerCase()}).{" "}
          <Link href={`/orders/${request.id}`} className="text-primary hover:underline">
            Open the order
          </Link>
        </p>
      </div>
    );
  }

  const declined = request.status === "Declined";
  const catalogMissing = request.notInCatalog;

  const decline = async (reason: string) => {
    await moveOrder(request.id, "Declined", reason);
    toast.success(`${request.code} declined.`);
    await refresh();
  };

  const linkCrop = async (cropId: string) => {
    try {
      await linkCatalogCrop(request.id, cropId);
      toast.success(`${request.cropName} linked to ${request.code}. You can confirm it now.`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link the crop.");
    }
  };

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        title={`${request.code} · ${request.buyerName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <OrderStatusBadge status={request.status} method={request.method} />
            <MethodTag method={request.method} />
            {catalogMissing ? <NotInCatalogTag /> : null}
            <span aria-hidden>·</span>
            <span>
              {request.cropName} · {num(request.requestedKg)} kg
            </span>
          </span>
        }
      />

      {/* --------------------------------------------------------- reply */}
      {declined ? (
        <section className="card-surface p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <CircleX className="size-4 text-destructive" />
            Declined
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            <DetailItem
              label="Reason"
              value={request.declineReason || "—"}
              className="col-span-2 sm:col-span-3"
            />
            <DetailItem label="Declined on" value={prettyDate(request.declinedAt)} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            This request is read-only.{" "}
            <Link
              href={`/orders/${request.id}`}
              className="underline-offset-2 hover:underline"
            >
              Open the order record
            </Link>
          </p>
        </section>
      ) : (
        <>
        <RequestCheckCard request={request} onSaved={() => void refresh()} />
        <section className="card-surface p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Inbox className="size-5 text-primary" />
                Reply to this request
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Confirm it by matching farmers, or decline it with a reason.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setDeclineOpen(true)}>
                Decline
              </Button>
              {catalogMissing ? (
                <Button variant="outline" onClick={() => setCropOpen(true)}>
                  <Plus className="size-4" />
                  Add to catalog
                </Button>
              ) : null}
              <Button
                disabled={catalogMissing}
                onClick={() => router.push(`/orders/new?confirm=${request.id}`)}
              >
                Confirm and match farmers
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
          {catalogMissing ? (
            <p className="mt-3 text-xs text-muted-foreground">
              This crop is not in the catalog yet. Add it, or decline the request.
            </p>
          ) : null}
        </section>
        </>
      )}

      {/* ------------------------------------------------------- details */}
      <section className="card-surface p-4 sm:p-6">
        <h3 className="text-base font-semibold">Request details</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <DetailItem label="Buyer" value={request.buyerName} />
          <DetailItem
            label="Crop"
            value={
              <span className="flex flex-wrap items-center gap-1.5">
                {request.cropName || "—"}
                {catalogMissing ? <NotInCatalogTag /> : null}
              </span>
            }
          />
          <DetailItem label="Requested" value={`${num(request.requestedKg)} kg`} />
          <DetailItem label="Needed by" value={prettyDate(request.deliveryDate)} />
          <DetailItem label="Method" value={<MethodTag method={request.method} />} />
          <DetailItem
            label={request.method === "Delivery" ? "Delivery address" : "Pickup"}
            value={
              request.method === "Delivery"
                ? request.deliveryAddress || "—"
                : "Pickup, ARG TECH will arrange the meeting point"
            }
            className="col-span-2"
          />
          <DetailItem label="Requested on" value={prettyDate(request.orderDate)} />
          <DetailItem
            label={
              catalogMissing ? "Buyer requirements (their own words)" : "Buyer requirements"
            }
            value={request.requirements || "—"}
            className="col-span-2 sm:col-span-4"
          />
          <DetailItem
            label="Buyer's note"
            value={request.note || "—"}
            className="col-span-2 sm:col-span-4"
          />
        </dl>
      </section>

      <ReasonDialog
        key={declineOpen ? "open" : "closed"}
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title={`Decline ${request.code}`}
        description="The buyer sees this reason with the declined request."
        label="Reason for declining"
        placeholder="e.g. Not enough supply for your date"
        suggestions={DECLINE_REASONS}
        submitLabel="Decline request"
        onSubmit={decline}
      />

      {cropOpen ? (
        <CropFormDialog
          open
          onOpenChange={setCropOpen}
          initialName={request.cropName}
          onSaved={(crop) => void linkCrop(crop.id)}
        />
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/requests"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Requests
    </Link>
  );
}
