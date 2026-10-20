"use client";

import * as React from "react";
import { Field, FormGrid, FormSection } from "@/components/form/field";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { BuyerFormDialog } from "@/components/buyers/buyer-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listBuyers } from "@/lib/services/orders";
import { DELIVERY_METHODS, ORDER_TYPES } from "@/lib/types";
import type { DeliveryMethod, OrderType } from "@/lib/types";

export interface OrderDetailsValue {
  buyerName: string;
  orderDate: string;
  /** Delivery date, pickup date, or needed-by date. */
  deliveryDate: string;
  type: OrderType;
  method: DeliveryMethod;
  deliveryAddress: string;
  note: string;
}

/**
 * Buyer and logistics fields.
 *
 * Status is not edited here: it only moves along the allowed flow, from the
 * order's detail page. A delivery order keeps an address; a pickup order has none.
 */
export function OrderDetailsFields({
  value,
  onChange,
  errors,
  lockType = false,
}: {
  value: OrderDetailsValue;
  onChange: (next: OrderDetailsValue) => void;
  errors?: Partial<Record<keyof OrderDetailsValue, string>>;
  /** Type cannot change once an order exists. */
  lockType?: boolean;
}) {
  const [buyerNames, setBuyerNames] = React.useState<string[]>([]);
  const [newBuyerOpen, setNewBuyerOpen] = React.useState(false);

  React.useEffect(() => {
    void listBuyers().then((buyers) => setBuyerNames(buyers.map((b) => b.name)));
  }, []);

  const set = <K extends keyof OrderDetailsValue>(
    key: K,
    next: OrderDetailsValue[K],
  ) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-6">
      <FormSection title="Buyer" description="Who is purchasing this order">
        <FormGrid>
          <Field
            label="Buyer"
            required
            error={errors?.buyerName}
            hint={
              <>
                Choose an existing buyer, or{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => setNewBuyerOpen(true)}
                >
                  add a new buyer
                </Button>
              </>
            }
          >
            <FormSelect
              value={value.buyerName}
              onChange={(v) => set("buyerName", v)}
              options={stringOptions(buyerNames)}
              placeholder="Select a buyer"
              invalid={Boolean(errors?.buyerName)}
            />
          </Field>
          <Field label="Order Date" required error={errors?.orderDate}>
            <Input
              type="date"
              value={value.orderDate}
              onChange={(e) => set("orderDate", e.target.value)}
              aria-invalid={Boolean(errors?.orderDate) || undefined}
            />
          </Field>
          <Field label="Type">
            <FormSelect
              value={value.type}
              onChange={(v) => set("type", v as OrderType)}
              options={stringOptions([...ORDER_TYPES])}
              disabled={lockType}
            />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="Delivery or pickup" description="Scheduling and logistics">
        <FormGrid>
          <Field label="Method">
            <FormSelect
              value={value.method}
              onChange={(v) => set("method", v as DeliveryMethod)}
              options={stringOptions([...DELIVERY_METHODS])}
            />
          </Field>
          <Field
            label={value.method === "Pickup" ? "Pickup Date" : "Delivery Date"}
            required
            error={errors?.deliveryDate}
          >
            <Input
              type="date"
              value={value.deliveryDate}
              onChange={(e) => set("deliveryDate", e.target.value)}
              aria-invalid={Boolean(errors?.deliveryDate) || undefined}
            />
          </Field>
          {value.method === "Delivery" ? (
            <Field
              label="Delivery Address"
              required
              error={errors?.deliveryAddress}
              className="sm:col-span-2"
              htmlFor="deliveryAddress"
            >
              <Input
                id="deliveryAddress"
                value={value.deliveryAddress}
                onChange={(e) => set("deliveryAddress", e.target.value)}
                placeholder="e.g. Warehouse, No. 112, National Road 1, Phnom Penh"
                aria-invalid={Boolean(errors?.deliveryAddress) || undefined}
              />
            </Field>
          ) : null}
        </FormGrid>
      </FormSection>

      {newBuyerOpen ? (
        <BuyerFormDialog
          open
          onOpenChange={setNewBuyerOpen}
          onSaved={(buyer) => {
            setBuyerNames((names) => [...names, buyer.name].sort());
            set("buyerName", buyer.name);
          }}
        />
      ) : null}

      <Field label="Note" hint="Internal notes about this order" htmlFor="orderNote">
        <Textarea
          id="orderNote"
          rows={3}
          value={value.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="Additional details…"
        />
      </Field>
    </div>
  );
}
