"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/app-dialog";
import { SupplyMatcher, type DraftLine } from "./supply-matcher";
import { OrderDetailsFields, type OrderDetailsValue } from "./order-details-fields";
import {
  findOrCreateBuyer,
  updateOrder,
  type PurchaseOrderView,
} from "@/lib/services/orders";

/**
 * Edit an existing order.
 *
 * Reuses the supply matcher so lines can be re-allocated across farmers; the
 * order's own current lines are excluded from the "already sold" calculation,
 * otherwise reopening an order would show its own stock as unavailable.
 */
export function OrderEditDialog({
  open,
  onOpenChange,
  order,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrderView;
  onSaved: () => void;
}) {
  const [details, setDetails] = React.useState<OrderDetailsValue>(() => ({
    buyerName: order.buyerName,
    orderDate: order.orderDate,
    deliveryDate: order.deliveryDate,
    type: order.type,
    method: order.method,
    deliveryAddress: order.deliveryAddress ?? "",
    note: order.note,
  }));
  const [lines, setLines] = React.useState<DraftLine[]>(() =>
    order.lineItems.map((li) => ({
      cropCycleId: li.cropCycleId,
      quantityKg: li.quantityKg,
      pricePerKg: li.pricePerKg,
      // Keep the price agreed when the order was confirmed.
      priceEdited: true,
    })),
  );
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!details.buyerName.trim()) {
      toast.error("A buyer is required.");
      return;
    }
    if (details.method === "Delivery" && !details.deliveryAddress.trim()) {
      toast.error("A delivery order needs a delivery address.");
      return;
    }
    if (lines.length === 0) {
      toast.error("An order needs at least one line item.");
      return;
    }

    setSubmitting(true);
    try {
      const buyer = await findOrCreateBuyer(details.buyerName);
      await updateOrder(order.id, {
        buyerId: buyer.id,
        orderDate: details.orderDate,
        deliveryDate: details.deliveryDate,
        method: details.method,
        deliveryAddress: details.deliveryAddress,
        note: details.note,
        lineItems: lines.map((l) => ({
          cropCycleId: l.cropCycleId,
          quantityKg: l.quantityKg,
          pricePerKg: l.pricePerKg,
        })),
      });
      toast.success(`${order.code} updated.`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${order.code}`}
      description="Re-allocate supply or change the buyer, date and delivery or pickup details"
      submitLabel="Update Order"
      submitting={submitting}
      onSubmit={handleSubmit}
      size="xl"
    >
      <SupplyMatcher
        lines={lines}
        onLinesChange={setLines}
        excludeOrderId={order.id}
        initialCropId={order.cropId ?? undefined}
      />
      <section className="card-surface p-4 sm:p-6">
        <h3 className="mb-4 text-base font-semibold">Buyer &amp; logistics</h3>
        <OrderDetailsFields value={details} onChange={setDetails} lockType />
      </section>
    </FormDialog>
  );
}
